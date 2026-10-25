import { leerCampo } from '../../entrada/campo';
import { leerEntrada } from '../../entrada/leer';
import { formatearValor } from '../../entrada/formato';
import { type SerieE, valoresDeSerie } from '../comun/series-e';

// El Inventario de Arreglos equivalentes (spec §8.2): los Valores comerciales que el Alumno tiene,
// uno por tipo de componente. Sin Inventario propio se busca en la serie completa en un rango fijo;
// por inclusión, en la lista de valores que escribió; por exclusión, en una serie E en un rango
// menos los Valores excluidos y más unos pocos extras. No guarda cantidades. Todo en SI (F u Ω).

export type TipoComponente = 'capacitor' | 'resistencia';

export type MagnitudArreglo = 'capacidad' | 'resistencia';

export const MAGNITUD: Record<TipoComponente, MagnitudArreglo> = {
  capacitor: 'capacidad',
  resistencia: 'resistencia',
};

// La tolerancia de un valor del Inventario: relativa (fracción) o absoluta (F u Ω).
export type ToleranciaValor =
  { tipo: 'relativa'; fraccion: number } | { tipo: 'absoluta'; valor: number };

// Sin Inventario propio, la serie completa en un rango fijo (spec §8.2).
export const RANGO_SIN_INVENTARIO: Record<TipoComponente, { min: number; max: number }> = {
  capacitor: { min: 1e-12, max: 10e-9 },
  resistencia: { min: 1, max: 10e6 },
};

export function valoresSinInventario(componente: TipoComponente, serie: SerieE): number[] {
  const { min, max } = RANGO_SIN_INVENTARIO[componente];
  return valoresDeSerie(serie, min, max);
}

// --- El Inventario y lo que se guarda ---------------------------------------------------------------

// 'ninguno' es "sin Inventario propio". Las listas de los dos modos se guardan siempre: cambiar de
// modo no borra la del otro.
export type ModoInventario = 'ninguno' | 'inclusion' | 'exclusion';

// Un valor cargado a mano. Sin `tolerancia` vale la tolerancia por defecto del tipo.
export interface ValorCargado {
  valor: number;
  tolerancia?: ToleranciaValor;
}

export interface Inventario {
  modo: ModoInventario;
  inclusion: ValorCargado[];
  exclusion: {
    min: number;
    max: number;
    // Valores, no posiciones en la serie: siguen valiendo si se cambia de serie.
    excluidos: number[];
    // Valores fuera de la serie, o dentro, que se suman a lo que queda.
    extras: ValorCargado[];
  };
}

export function inventarioVacio(componente: TipoComponente): Inventario {
  const { min, max } = RANGO_SIN_INVENTARIO[componente];
  return { modo: 'ninguno', inclusion: [], exclusion: { min, max, excluidos: [], extras: [] } };
}

const esObjeto = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const esPositivo = (x: unknown): x is number =>
  typeof x === 'number' && Number.isFinite(x) && x > 0;
const esNoNegativo = (x: unknown): x is number =>
  typeof x === 'number' && Number.isFinite(x) && x >= 0;

function leerToleranciaGuardada(crudo: unknown): ToleranciaValor | undefined {
  if (!esObjeto(crudo)) return undefined;
  if (crudo.tipo === 'relativa' && esNoNegativo(crudo.fraccion) && crudo.fraccion <= 1) {
    return { tipo: 'relativa', fraccion: crudo.fraccion };
  }
  if (crudo.tipo === 'absoluta' && esNoNegativo(crudo.valor)) {
    return { tipo: 'absoluta', valor: crudo.valor };
  }
  return undefined;
}

function leerCargados(crudo: unknown): ValorCargado[] {
  if (!Array.isArray(crudo)) return [];
  return crudo.flatMap((x): ValorCargado[] => {
    if (!esObjeto(x) || !esPositivo(x.valor)) return [];
    const tolerancia = leerToleranciaGuardada(x.tolerancia);
    return [tolerancia ? { valor: x.valor, tolerancia } : { valor: x.valor }];
  });
}

// Lo que sale del almacén (spec §4.4): lo que no se reconoce se deja en su valor por defecto.
export function leerInventario(crudo: unknown, componente: TipoComponente): Inventario {
  const inventario = inventarioVacio(componente);
  if (!esObjeto(crudo)) return inventario;
  if (crudo.modo === 'inclusion' || crudo.modo === 'exclusion' || crudo.modo === 'ninguno') {
    inventario.modo = crudo.modo;
  }
  inventario.inclusion = leerCargados(crudo.inclusion);
  if (esObjeto(crudo.exclusion)) {
    const { min, max, excluidos, extras } = crudo.exclusion;
    if (esPositivo(min) && esPositivo(max) && min < max) {
      inventario.exclusion.min = min;
      inventario.exclusion.max = max;
    }
    if (Array.isArray(excluidos)) inventario.exclusion.excluidos = excluidos.filter(esPositivo);
    inventario.exclusion.extras = leerCargados(extras);
  }
  return inventario;
}

// --- Qué valores salen de un Inventario -------------------------------------------------------------

// Dos valores que difieren en menos de 1e-9 relativo son el mismo (como los Arreglos de igual valor).
export const mismoValor = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(a, b);

export const estaExcluido = (excluidos: readonly number[], valor: number) =>
  excluidos.some((x) => mismoValor(x, valor));

// Un toque excluye el valor y otro lo vuelve a incluir.
export const alternarExcluido = (excluidos: readonly number[], valor: number): number[] =>
  estaExcluido(excluidos, valor)
    ? excluidos.filter((x) => !mismoValor(x, valor))
    : [...excluidos, valor];

// Ordenados de menor a mayor y sin repetir: si un valor está dos veces, vale el último.
function ordenarSinRepetir(valores: readonly ValorCargado[]): ValorCargado[] {
  return valores
    .filter((v, i) => !valores.slice(i + 1).some((otro) => mismoValor(otro.valor, v.valor)))
    .sort((a, b) => a.valor - b.valor);
}

// Los valores con que se busca, ordenados. Un extra pisa al valor de la serie que coincide, y también
// a uno excluido: el Alumno lo escribió a propósito.
export function valoresCargados(
  componente: TipoComponente,
  serie: SerieE,
  inventario?: Inventario,
): ValorCargado[] {
  if (!inventario || inventario.modo === 'ninguno') {
    return valoresSinInventario(componente, serie).map((valor) => ({ valor }));
  }
  if (inventario.modo === 'inclusion') return ordenarSinRepetir(inventario.inclusion);
  const { min, max, excluidos, extras } = inventario.exclusion;
  const deLaSerie = valoresDeSerie(serie, min, max)
    .filter((v) => !estaExcluido(excluidos, v))
    .map((valor) => ({ valor }));
  return ordenarSinRepetir([...deLaSerie, ...extras]);
}

// Una fila de la grilla de exclusión: la década y los valores de la serie que entran en el rango.
export interface Decada {
  decada: number;
  valores: number[];
}

export function decadasDeSerie(serie: SerieE, min: number, max: number): Decada[] {
  const filas = new Map<number, number[]>();
  for (const v of valoresDeSerie(serie, min, max)) {
    const decada = Math.floor(Math.log10(v) + 1e-9);
    filas.set(decada, [...(filas.get(decada) ?? []), v]);
  }
  return [...filas].map(([decada, valores]) => ({ decada, valores }));
}

// --- La tolerancia de un valor, escrita -------------------------------------------------------------

export type LecturaTolerancia =
  | { tipo: 'vacio' }
  | { tipo: 'valor'; tolerancia: ToleranciaValor }
  | { tipo: 'error'; motivo: string };

const EJEMPLO_ABSOLUTA: Record<TipoComponente, string> = {
  capacitor: '0,25 pF',
  resistencia: '2 Ω',
};

// Un número solo o con "%" es relativo ("2", "2,5 %"); con la unidad del componente, absoluto
// ("0,1 pF", "2 Ω"). Vacío es "sin tolerancia propia": vale la de por defecto.
export function leerTolerancia(texto: string, componente: TipoComponente): LecturaTolerancia {
  const relativa = leerCampo(texto, {
    nombre: 'Tolerancia',
    magnitud: 'porcentaje',
    rango: { min: 0, max: 100 },
  });
  if (relativa.estado === 'vacio') return { tipo: 'vacio' };
  if (relativa.estado === 'valido') {
    return { tipo: 'valor', tolerancia: { tipo: 'relativa', fraccion: relativa.valor / 100 } };
  }
  // Un número solo o con "%" es siempre un porcentaje: si no cabe en 0–100 no se reinterpreta como
  // un valor absoluto.
  if (leerEntrada(texto, { magnitud: 'porcentaje' }).tipo === 'valor') {
    return { tipo: 'error', motivo: relativa.motivo };
  }
  const magnitud = MAGNITUD[componente];
  const absoluta = leerCampo(texto, {
    nombre: 'Tolerancia',
    magnitud,
    unidad: componente === 'capacitor' ? 'pF' : 'Ω',
    rango: { min: 0 },
  });
  if (absoluta.estado === 'valido') {
    return { tipo: 'valor', tolerancia: { tipo: 'absoluta', valor: absoluta.valor } };
  }
  return {
    tipo: 'error',
    motivo: `Escribí un porcentaje (5 %) o un valor con su unidad (${EJEMPLO_ABSOLUTA[componente]})`,
  };
}

export function escribirTolerancia(
  tolerancia: ToleranciaValor,
  componente: TipoComponente,
): string {
  return tolerancia.tipo === 'relativa'
    ? formatearValor(tolerancia.fraccion * 100, 'porcentaje')
    : formatearValor(tolerancia.valor, MAGNITUD[componente]);
}

// --- Cómo se describe -------------------------------------------------------------------------------

// Qué se usa para buscar. `texto` es la línea del bloque de Inventario (spec §8.2) y `detalle`, la
// de abajo.
export interface DescripcionInventario {
  texto: string;
  detalle: string;
  rango: string;
  cantidad: number;
}

export const TIPOS: Record<TipoComponente, string> = {
  capacitor: 'capacitores',
  resistencia: 'resistencias',
};

const cuantos = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function describirInventario(
  componente: TipoComponente,
  serie: SerieE,
  inventario?: Inventario,
): DescripcionInventario {
  const magnitud = MAGNITUD[componente];
  const cargados = valoresCargados(componente, serie, inventario);
  const cantidad = cargados.length;
  const valores = cuantos(cantidad, 'valor', 'valores');
  const escribir = (x: number) => formatearValor(x, magnitud);
  const rangoDe = (min: number, max: number) =>
    min === max ? escribir(min) : `${escribir(min)} – ${escribir(max)}`;
  const modo = inventario?.modo ?? 'ninguno';
  const nombre = `Inventario de ${TIPOS[componente]}`;

  if (modo === 'ninguno') {
    const { min, max } = RANGO_SIN_INVENTARIO[componente];
    const rango = rangoDe(min, max);
    return {
      texto: `Serie ${serie} completa, sin Inventario`,
      detalle: `${rango} · ${valores}`,
      rango,
      cantidad,
    };
  }
  if (modo === 'inclusion') {
    const rango = cantidad > 0 ? rangoDe(cargados[0].valor, cargados[cantidad - 1].valor) : '';
    return {
      texto: `${nombre}: por inclusión, ${cantidad > 0 ? `${valores}, ${rango}` : 'sin valores'}`,
      detalle: propias(cargados),
      rango,
      cantidad,
    };
  }
  const { min, max, excluidos, extras } = inventario!.exclusion;
  const rango = rangoDe(min, max);
  // Solo cuentan los que sacan algo: los que no son de esta serie o quedan fuera del rango no hacen nada.
  const nExcluidos = valoresDeSerie(serie, min, max).filter((v) =>
    estaExcluido(excluidos, v),
  ).length;
  const textoExcluidos =
    nExcluidos === 0
      ? 'ningún Valor excluido'
      : cuantos(nExcluidos, 'Valor excluido', 'Valores excluidos');
  return {
    texto: `${nombre}: ${serie} por exclusión, ${rango}, ${textoExcluidos}`,
    detalle: extras.length > 0 ? `${valores}, ${extras.length} extra` : valores,
    rango,
    cantidad,
  };
}

function propias(valores: readonly ValorCargado[]): string {
  const n = valores.filter((v) => v.tolerancia).length;
  return n > 0 ? `${n} con tolerancia propia` : '';
}
