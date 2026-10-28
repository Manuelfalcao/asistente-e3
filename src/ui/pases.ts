import type { TipoComponente } from '../calculo/arreglos/arreglos';
import type { Nivel } from '../calculo/comun/valor-impracticable';
import type { EstadoCampo } from '../entrada/campo';
import { type Magnitud, opcionesDelSelector } from '../entrada/campos';
import { formatearValor } from '../entrada/formato';
import type { IdCalculadora } from './calculadoras';

// El pase de un valor a otra Calculadora (spec §4.2 y §5.5): qué se lleva, la pila de pases y cómo
// llega el valor al campo de destino. Todo puro; el armazón guarda el estado y dibuja las franjas.

export type MagnitudPasable = Extract<Magnitud, 'inductancia' | 'capacidad' | 'resistencia'>;

// Lo común a todo pase: de dónde sale, a dónde va y el aviso que la franja repite.
interface PaseBase {
  origen: IdCalculadora;
  // El aviso del valor en el origen: la franja repite el rótulo y su motivo.
  nivel?: Nivel;
  motivo?: string;
  // Una nota que la franja agrega, como la de la potencia en los Arreglos equivalentes.
  nota?: string;
}

// Una L a Bobinas, o una C o una R a Arreglos equivalentes.
export interface PaseDeValor extends PaseBase {
  destino: 'bobinas' | 'arreglos';
  // "C1": cómo lo nombra la Calculadora de origen.
  nombre: string;
  magnitud: MagnitudPasable;
  // En H, F u Ω, con precisión completa.
  valor: number;
  // La frecuencia de evaluación del origen, en Hz: en bobinas llega como frecuencia de trabajo.
  frecuencia?: number;
}

// Desde el aviso de pérdida plana de un filtro con Rs ≠ RL a redes de adaptación (spec §9.7).
export interface PaseARedes extends PaseBase {
  destino: 'redes';
  // En Ω y en Hz, con precisión completa. f₀ solo si el filtro es pasa banda.
  rs: number;
  rl: number;
  f0?: number;
}

export type Pase = PaseDeValor | PaseARedes;

const MAGNITUD_DE: Record<'L' | 'C' | 'R', MagnitudPasable> = {
  L: 'inductancia',
  C: 'capacidad',
  R: 'resistencia',
};

// Las L van a Bobinas; las C y las R, a Arreglos equivalentes (spec §5.5).
export function crearPase(pase: Omit<PaseDeValor, 'destino'>): PaseDeValor {
  return { ...pase, destino: pase.magnitud === 'inductancia' ? 'bobinas' : 'arreglos' };
}

// El pase de una L, C o R del resultado de una Calculadora. Si el valor tiene aviso, el pase lleva su
// nivel y su motivo (spec §4.2).
export function paseDeComponente(
  origen: IdCalculadora,
  componente: { componente: 'L' | 'C' | 'R'; nombre: string; valor: number },
  marcados: readonly { nombre: string; nivel: Nivel; motivo: string }[],
  extra: Pick<PaseDeValor, 'frecuencia' | 'nota'> = {},
): PaseDeValor {
  const marca = marcados.find((m) => m.nombre === componente.nombre);
  return crearPase({
    origen,
    nombre: componente.nombre,
    magnitud: MAGNITUD_DE[componente.componente],
    valor: componente.valor,
    ...(marca && { nivel: marca.nivel, motivo: marca.motivo }),
    ...extra,
  });
}

// El tipo de componente que el pase deja elegido en Arreglos equivalentes.
export function componenteDelPase(pase: PaseDeValor): TipoComponente {
  return pase.magnitud === 'resistencia' ? 'resistencia' : 'capacitor';
}

// "C1 = 87,4 pF", o "Rs = 50 Ω, RL = 300 Ω, f₀ = 146 MHz"
export function textoDeFranja(pase: Pase): string {
  if (pase.destino !== 'redes') {
    return `${pase.nombre} = ${formatearValor(pase.valor, pase.magnitud)}`;
  }
  return [
    `Rs = ${formatearValor(pase.rs, 'resistencia')}`,
    `RL = ${formatearValor(pase.rl, 'resistencia')}`,
    ...(pase.f0 === undefined ? [] : [`f₀ = ${formatearValor(pase.f0, 'frecuencia')}`]),
  ].join(', ');
}

// ---------- La pila ----------

export interface EstadoNavegacion {
  activa: IdCalculadora;
  // El último pase es el que muestra la franja de la Calculadora activa. No se guarda.
  pila: readonly Pase[];
}

export function pasar(estado: EstadoNavegacion, pase: Pase): EstadoNavegacion {
  return { activa: pase.destino, pila: [...estado.pila, pase] };
}

// Vuelve a la Calculadora de origen del último pase y lo deshace; los demás siguen apilados.
export function volver(estado: EstadoNavegacion): EstadoNavegacion {
  const ultimo = estado.pila.at(-1);
  if (!ultimo) return estado;
  return { activa: ultimo.origen, pila: estado.pila.slice(0, -1) };
}

// La ✕ de la franja: quita el último pase y se queda donde está.
export function quitar(estado: EstadoNavegacion): EstadoNavegacion {
  return { ...estado, pila: estado.pila.slice(0, -1) };
}

// Cambiar de Calculadora desde las pestañas o el menú vacía la pila; tocar la que ya está abierta
// no cambia nada.
export function irA(estado: EstadoNavegacion, id: IdCalculadora): EstadoNavegacion {
  return id === estado.activa ? estado : { activa: id, pila: [] };
}

export function franjaVisible(estado: EstadoNavegacion): Pase | undefined {
  const ultimo = estado.pila.at(-1);
  return ultimo?.destino === estado.activa ? ultimo : undefined;
}

// ---------- El valor en el campo de destino ----------

// Lo que se escribe en el campo de destino y el valor completo que le corresponde.
export interface Precarga {
  texto: string;
  // La unidad del Selector; ausente cuando la unidad va escrita en el texto.
  unidad?: string;
  valor: number;
}

// El campo muestra 4 cifras (spec §4.2), con la unidad en el Selector si este la ofrece.
export function precargaDe(valor: number, magnitud: Magnitud): Precarga {
  const escrito = formatearValor(valor, magnitud, 'paso');
  const corte = escrito.indexOf(' ');
  const unidad = escrito.slice(corte + 1);
  if (corte > 0 && opcionesDelSelector(magnitud).includes(unidad)) {
    return { texto: escrito.slice(0, corte), unidad, valor };
  }
  return { texto: escrito, valor };
}

// f₀ al llegar a Redes: el del filtro si era pasa banda; si no, el campo queda vacío, para que la
// cuenta no use un f₀ viejo que la franja no nombra (spec §9.7).
export function precargaDeF0(pase: PaseARedes): Precarga {
  return pase.f0 === undefined ? { texto: '', valor: NaN } : precargaDe(pase.f0, 'frecuencia');
}

// Mientras el texto y el Selector de unidad sigan como llegaron, el valor es el completo y no el
// que se lee de las 4 cifras.
export function conValorCompleto(
  estado: EstadoCampo,
  precarga: Precarga | null,
  texto: string,
  unidad: string | undefined,
): EstadoCampo {
  if (estado.estado !== 'valido' || !precarga) return estado;
  if (texto !== precarga.texto) return estado;
  if (precarga.unidad !== undefined && unidad !== precarga.unidad) return estado;
  return { ...estado, valor: precarga.valor };
}
