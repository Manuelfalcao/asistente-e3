import type { Paso } from '../src/calculo/comun/resultado';
import type { IdCalculadora } from '../src/ui/calculadoras';
import {
  type DiferenciaEsperada,
  type Tolerancia,
  dentroDeTolerancia,
  leerImpreso,
  margen,
} from './casos';

// Lo que las tablas de Casos de prueba le dan al Informe de casos (spec §13.6). Cada Calculadora
// escribe en su `informe.ts` el adaptador de sus tablas: corre el cálculo con las entradas del caso
// y devuelve esto, ya como texto. El generador solo lo muestra; no sabe nada de ninguna Calculadora.

// Una comparación dentro de un caso: un valor esperado, el que dio el Asistente y la tolerancia.
export interface Medida {
  // Qué se compara: "R1 (T)", "Z₁ a la entrada".
  nombre: string;
  esperado: string;
  obtenido: string;
  // Fracción con signo, obtenido / esperado − 1. Null si el esperado es cero.
  errorRelativo: number | null;
  tolerancia: string;
  motivo: string;
  diferencia?: { texto: string; motivo: string };
  dentro: boolean;
}

// Los pasos intermedios de un resultado, los mismos que ve el Alumno. Un caso puede tener varios
// resultados (el T y el π).
export interface GrupoPasos {
  titulo: string;
  pasos: readonly Paso[];
}

// Un caso de una Deducción propia (spec §13.5) que se corre con la fórmula propia o con su plan B.
export interface LadoDeBandera {
  // El id de la entrada del registro común.
  deduccion: string;
  lado: 'propia' | 'plan-b';
}

interface CasoBase {
  // Corto y único. El estado sale del test de Vitest cuyo título es el id, o empieza con "id:".
  id: string;
  entradas: string;
  // Con edición y página.
  referencia: string;
  bandera?: LadoDeBandera;
}

// Los casos de referencia, de medición y de verificación: fila con el esperado y el obtenido.
export interface CasoDeRevision extends CasoBase {
  clase: 'referencia' | 'medicion' | 'verificacion';
  medidas: readonly Medida[];
  // Solo en los de verificación: el archivo de tests/oraculos/ y cómo se llama.
  oraculo?: string;
  pasos: readonly GrupoPasos[];
}

// Los de comportamiento van en una lista compacta: entrada, aviso esperado y estado.
export interface CasoDeComportamiento extends CasoBase {
  clase: 'comportamiento';
  esperado: string;
  obtenido: string;
  coincide: boolean;
}

export type CasoInforme = CasoDeRevision | CasoDeComportamiento;

// Lo que exporta cada `informe.ts`: la Calculadora a cuya sección van sus casos ('comun' para lo
// que es de todas) y una función que los arma. Se levantan solos con import.meta.glob.
export interface AporteInforme {
  calculadora: IdCalculadora | 'comun';
  casos: () => CasoInforme[];
}

// --- Ayudas para escribir los adaptadores --------------------------------------------------------

const MENOS = '−';

// Un número con coma decimal y el menos tipográfico, sin redondear de más.
export function escribirNumero(x: number, decimales: number): string {
  return x.toFixed(decimales).replace('.', ',').replace('-', MENOS);
}

function decimalesDe(impreso: string): number {
  return impreso.split(',')[1]?.length ?? 0;
}

// El obtenido con dos decimales más que el impreso del esperado, para que se vea la diferencia.
export function comoImpreso(obtenido: number, impreso: string, extra = 2): string {
  return escribirNumero(obtenido, decimalesDe(impreso) + extra);
}

// Un número chico (1e-9) en notación científica con coma: "1e-9".
function cientifica(x: number): string {
  return String(x).replace('.', ',').replace('-', MENOS);
}

export function textoTolerancia(tolerancia: Tolerancia, impreso: string): string {
  switch (tolerancia.tipo) {
    case 'media-unidad':
      return `± ${escribirNumero(margen(tolerancia, impreso), decimalesDe(impreso) + 1)}`;
    case 'relativa':
      return `± ${cientifica(tolerancia.valor)} relativo`;
    case 'absoluta':
      return `± ${cientifica(tolerancia.valor)}`;
  }
}

export function textoDiferencia(diferencia: DiferenciaEsperada): { texto: string; motivo: string } {
  const porcentaje = diferencia.relativa * 100;
  const signo = porcentaje > 0 ? '+' : '';
  return {
    texto: `${signo}${escribirNumero(porcentaje, 2)} %`,
    motivo: diferencia.motivo,
  };
}

interface EntradaMedida {
  nombre: string;
  // El esperado como está impreso en la tabla, con coma decimal.
  impreso: string;
  obtenido: number;
  tolerancia: Tolerancia;
  diferencia?: DiferenciaEsperada;
  // "Ω", "dB": se agrega al esperado y al obtenido.
  unidad?: string;
}

// Una medida contra un valor impreso en una tabla.
export function medidaImpresa({
  nombre,
  impreso,
  obtenido,
  tolerancia,
  diferencia,
  unidad,
}: EntradaMedida): Medida {
  const esperado = leerImpreso(impreso);
  const sufijo = unidad ? ` ${unidad}` : '';
  return {
    nombre,
    esperado: impreso + sufijo,
    obtenido: comoImpreso(obtenido, impreso) + sufijo,
    errorRelativo: esperado === 0 ? null : obtenido / esperado - 1,
    tolerancia: textoTolerancia(tolerancia, impreso),
    motivo: tolerancia.motivo,
    diferencia: diferencia && textoDiferencia(diferencia),
    dentro: dentroDeTolerancia(obtenido, impreso, tolerancia, diferencia),
  };
}

// Un número que no viene de una tabla impresa (lo calculó un oráculo): se compara con la tolerancia
// relativa o absoluta del caso. `decimales` es cuántos se muestran.
export function medidaNumerica({
  nombre,
  esperado,
  obtenido,
  tolerancia,
  decimales,
  unidad,
}: {
  nombre: string;
  esperado: number;
  obtenido: number;
  tolerancia: Extract<Tolerancia, { tipo: 'relativa' | 'absoluta' }>;
  // Cuántos decimales se muestran; null: notación científica, para errores del orden de 1e-14.
  decimales: number | null;
  unidad?: string;
}): Medida {
  const sufijo = unidad ? ` ${unidad}` : '';
  const cota =
    tolerancia.tipo === 'relativa' ? tolerancia.valor * Math.abs(esperado) : tolerancia.valor;
  const escribir = (x: number) =>
    decimales === null
      ? x.toExponential(2).replace('.', ',').replace('e-', 'e−')
      : escribirNumero(x, decimales);
  return {
    nombre,
    esperado: escribir(esperado) + sufijo,
    obtenido: escribir(obtenido) + sufijo,
    errorRelativo: esperado === 0 ? null : obtenido / esperado - 1,
    tolerancia: textoTolerancia(tolerancia, ''),
    motivo: tolerancia.motivo,
    dentro: Math.abs(obtenido - esperado) <= cota,
  };
}

// Un caso cuyo cálculo se rompió: en el informe sale en rojo con el error, en vez de tirar abajo
// todo el documento.
export function casoRoto(
  base: { id: string; referencia: string },
  error: unknown,
): CasoDeComportamiento {
  const mensaje = error instanceof Error ? error.message : String(error);
  return {
    id: base.id,
    referencia: base.referencia,
    entradas: '—',
    clase: 'comportamiento',
    esperado: 'que el cálculo no se rompa',
    obtenido: `Error: ${mensaje}`,
    coincide: false,
  };
}

// Corre `armar`; si se rompe, devuelve el caso en rojo.
export function enCaso(
  base: { id: string; referencia: string },
  armar: () => CasoInforme,
): CasoInforme {
  try {
    return armar();
  } catch (error) {
    return casoRoto(base, error);
  }
}
