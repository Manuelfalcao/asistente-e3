import {
  type Inventario,
  type ToleranciaValor,
  type ValorCargado,
  valoresCargados,
} from '../arreglos/inventario';
import type { SerieE } from '../comun/series-e';
import { type Complejo, type ElementoBarrido, respuesta } from '../comun/barrido';
import { type Revision, revisarValores } from '../comun/valor-impracticable';
import {
  type Atenuador,
  FRECUENCIA_POR_DEFECTO,
  type PadMinimaPerdida,
  type Resistencia,
  SUGERENCIA_ATENUADORES,
} from './atenuadores';

// Atenuadores con Valores comerciales (spec §10.4): el redondeo al más cercano de cada resistencia
// y lo que pasa de verdad con él. La atenuación, las pérdidas de retorno y el peor caso por
// tolerancia salen del barrido común (spec §5.7), no de las fórmulas del atenuador ideal.

// Con qué se redondea: una serie E completa o el Inventario de resistencias (spec §10.1).
export type Redondeo = SerieE | 'inventario';

// Los valores comerciales de un Redondeo. Con Inventario por exclusión vale la serie dada (la del
// selector de Arreglos equivalentes); con una serie E sola, el Inventario no cuenta.
export function disponiblesDe(
  redondeo: Redondeo,
  serieDelInventario: SerieE,
  inventario: Inventario,
): ValorCargado[] {
  return redondeo === 'inventario'
    ? valoresCargados('resistencia', serieDelInventario, inventario)
    : valoresCargados('resistencia', redondeo);
}

// Con qué se redondea: los valores comerciales ya resueltos (una serie E o un Inventario), la
// tolerancia que vale donde un valor no trae la propia (fracción) y la ventana de atenuación (dB).
export interface ConfigComercial {
  disponibles: readonly ValorCargado[];
  tolerancia: number;
  ventana: number;
}

export interface ContextoComercial {
  z1: number;
  z2: number;
  // En Hz, para el criterio de valor impracticable. Null: 300 MHz.
  frecuencia: number | null;
}

// Una resistencia de una opción: con la forma de `Resistencia` y el valor ideal del que sale.
export interface ResistenciaComercial extends Resistencia {
  // El valor ideal que calculó el atenuador.
  ideal: number;
  tolerancia: ToleranciaValor;
}

export interface OpcionComercial {
  // En el orden de la fuente a la carga.
  resistencias: readonly ResistenciaComercial[];
  // En dB, con la carga y la fuente conectadas.
  atenuacion: number;
  // En dB, la pérdida de retorno vista desde la fuente (contra Z1) y desde la carga (contra Z2).
  prEntrada: number;
  prSalida: number;
  // La relación de onda estacionaria equivalente a cada pérdida de retorno.
  roeEntrada: number;
  roeSalida: number;
  peorCaso: PeorCaso;
  // Valor dudoso o impracticable de cada resistencia redondeada (spec §5.6), como en las ideales.
  revision: Revision;
}

// Con cada resistencia al mínimo o al máximo de su tolerancia (2^n combinaciones de extremos).
export interface PeorCaso {
  // En dB.
  atenuacionMin: number;
  atenuacionMax: number;
  // En dB: la menor pérdida de retorno, de entrada o de salida, de todas las combinaciones.
  prMinima: number;
  // La ROE equivalente a esa PR.
  roeMinima: number;
}

// Una combinación evaluada, antes de calcular su peor caso.
type Candidata = Omit<OpcionComercial, 'roeEntrada' | 'roeSalida' | 'peorCaso' | 'revision'>;

export interface ValoresComerciales {
  // El redondeo al más cercano de cada resistencia.
  redondeo: OpcionComercial;
  // Las mejores combinaciones entre los vecinos, de la mejor a la peor.
  mejores: readonly OpcionComercial[];
  // Falso: ninguna combinación entra en la ventana y `mejores` son las de menor error de atenuación.
  dentroDeLaVentana: boolean;
  // Cuántas combinaciones se evaluaron.
  evaluadas: number;
}

// Cuántos valores comerciales cercanos se prueban para cada resistencia (spec §10.4).
const VECINOS = 7;
const MEJORES = 3;

// Las resistencias de la red en el orden de la fuente a la carga.
function enOrden(red: Atenuador | PadMinimaPerdida): Resistencia[] {
  if (red.topologia === 'L') {
    return red.serie.lado === 'Z1' ? [red.serie, red.derivacion] : [red.derivacion, red.serie];
  }
  return [red.r1, red.r3, red.r2];
}

// El valor de la lista más cercano al ideal en escala logarítmica (|ln(v/ideal)|).
const distancia = (ideal: number, valor: number) => Math.abs(Math.log(valor / ideal));

// Los `n` valores más cercanos al ideal, de menor a mayor.
function vecinos(ideal: number, disponibles: readonly ValorCargado[], n: number): ValorCargado[] {
  return [...disponibles]
    .sort((a, b) => distancia(ideal, a.valor) - distancia(ideal, b.valor))
    .slice(0, n)
    .sort((a, b) => a.valor - b.valor);
}

// |Γ| de una impedancia contra una de referencia.
function gamma(z: Complejo, referencia: number): number {
  const num = (z.re - referencia) ** 2 + z.im ** 2;
  const den = (z.re + referencia) ** 2 + z.im ** 2;
  return Math.sqrt(num / den);
}

const perdidaDeRetorno = (g: number) => -20 * Math.log10(g);

// ROE = (1 + |Γ|)/(1 − |Γ|), con |Γ| = 10^(−PR/20).
export function roeDePr(pr: number): number {
  const g = 10 ** (-pr / 20);
  return (1 + g) / (1 - g);
}

// El valor al mínimo (−1) o al máximo (+1) de su tolerancia. Una tolerancia que lo lleva a cero es un
// corto, y en derivación el barrido no admite 0 Ω: se deja en un valor despreciable.
const CORTO = 1e-9;
function enExtremo({ valor, tolerancia: t }: ResistenciaComercial, signo: -1 | 1): number {
  const delta = t.tipo === 'relativa' ? valor * t.fraccion : t.valor;
  return Math.max(valor + signo * delta, CORTO);
}

// Una frecuencia cualquiera: las resistencias son ideales y no dependen de ella.
const F_ANALISIS = 100e6;

function evaluar(
  resistencias: readonly Pick<Resistencia, 'posicion' | 'valor'>[],
  z1: number,
  z2: number,
) {
  const elementos: ElementoBarrido[] = resistencias.map((r) => ({
    componente: 'R',
    posicion: r.posicion,
    valor: r.valor,
  }));
  const r = respuesta({ rs: z1, rl: z2, elementos }, F_ANALISIS);
  return {
    atenuacion: -10 * Math.log10(r.s21Cuadrado),
    prEntrada: perdidaDeRetorno(gamma(r.zEntrada, z1)),
    prSalida: perdidaDeRetorno(gamma(r.zSalida, z2)),
  };
}

function peorCaso(resistencias: readonly ResistenciaComercial[], z1: number, z2: number): PeorCaso {
  let atenuacionMin = Infinity;
  let atenuacionMax = -Infinity;
  let prMinima = Infinity;
  for (let mascara = 0; mascara < 2 ** resistencias.length; mascara++) {
    const extremos = resistencias.map((r, i) => ({
      posicion: r.posicion,
      valor: enExtremo(r, mascara & (1 << i) ? 1 : -1),
    }));
    const m = evaluar(extremos, z1, z2);
    atenuacionMin = Math.min(atenuacionMin, m.atenuacion);
    atenuacionMax = Math.max(atenuacionMax, m.atenuacion);
    prMinima = Math.min(prMinima, m.prEntrada, m.prSalida);
  }
  return { atenuacionMin, atenuacionMax, prMinima, roeMinima: roeDePr(prMinima) };
}

const menorPr = (c: Candidata) => Math.min(c.prEntrada, c.prSalida);

export function valoresComerciales(
  red: Atenuador | PadMinimaPerdida,
  { z1, z2, frecuencia }: ContextoComercial,
  { disponibles, tolerancia, ventana }: ConfigComercial,
): ValoresComerciales {
  const ideales = enOrden(red);
  const objetivo = red.verificacion.atenuacion;
  const armar = (elegidos: readonly ValorCargado[]): Candidata => {
    const resistencias = ideales.map((r, i): ResistenciaComercial => ({
      ...r,
      valor: elegidos[i].valor,
      ideal: r.valor,
      tolerancia: elegidos[i].tolerancia ?? { tipo: 'relativa', fraccion: tolerancia },
    }));
    return { resistencias, ...evaluar(resistencias, z1, z2) };
  };
  // Las 2^n combinaciones de extremos solo se barren para lo que se muestra.
  const completar = (c: Candidata): OpcionComercial => ({
    ...c,
    roeEntrada: roeDePr(c.prEntrada),
    roeSalida: roeDePr(c.prSalida),
    peorCaso: peorCaso(c.resistencias, z1, z2),
    revision: revisarValores(c.resistencias, frecuencia ?? FRECUENCIA_POR_DEFECTO, {
      sugerencia: SUGERENCIA_ATENUADORES,
    }),
  });

  const redondeo = armar(ideales.map((r) => vecinos(r.valor, disponibles, 1)[0]));

  // Todas las combinaciones entre los vecinos de cada resistencia, sin forzar la simetría.
  let combinaciones: ValorCargado[][] = [[]];
  for (const r of ideales) {
    const cerca = vecinos(r.valor, disponibles, VECINOS);
    combinaciones = combinaciones.flatMap((c) => cerca.map((v) => [...c, v]));
  }
  const candidatas = combinaciones.map(armar);
  const error = (c: Candidata) => Math.abs(c.atenuacion - objetivo);
  // Un margen para que un valor justo en el borde de la ventana no la deje afuera por redondeo.
  const adentro = candidatas.filter((c) => error(c) <= ventana + 1e-9);
  const dentroDeLaVentana = adentro.length > 0;
  const mejores = dentroDeLaVentana
    ? adentro.sort((a, b) => menorPr(b) - menorPr(a) || error(a) - error(b))
    : candidatas.sort((a, b) => error(a) - error(b));

  return {
    redondeo: completar(redondeo),
    mejores: mejores.slice(0, MEJORES).map(completar),
    dentroDeLaVentana,
    evaluadas: candidatas.length,
  };
}
