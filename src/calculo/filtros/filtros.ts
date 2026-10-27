import { formatearValor } from '../../entrada/formato';
import { numeroLatex as numero, porcentajeLatex, valorLatex } from '../comun/latex';
import type { Aviso, Paso, Referencia } from '../comun/resultado';
import { type Revision, errorDeMontaje, revisarValores } from '../comun/valor-impracticable';
import {
  FORMULAS_TAKAHASI_BUTTERWORTH,
  FORMULAS_TAKAHASI_CHEBYSHEV,
  type ParametrosTakahasi,
  admiteOrdenPar,
  desadaptacionDirecta,
  relacionMinima,
  takahasi,
} from './takahasi';

// La Calculadora de filtros (spec §7): escaleras LC π y T. Por ahora los cuatro Tipos de filtro,
// Butterworth, Chebyshev y Bessel, con el Orden ingresado o calculado desde una atenuación (spec
// §7.6), y con Rs ≠ RL por las fórmulas de Takahasi (spec §7.4; Bessel no). Prototipo pasa bajos
// normalizado (g0 = 1, corte en 1 rad/s), transformación de frecuencia según el Tipo de filtro y
// escala de impedancia por R0. Puro: recibe Hz, ohms, dB y el Q de las bobinas.

export type TipoBajoAlto = 'pasa-bajos' | 'pasa-altos';
export type TipoDeBanda = 'pasa-banda' | 'rechaza-banda';
export type TipoFiltro = TipoBajoAlto | TipoDeBanda;
export type Aproximacion = 'butterworth' | 'chebyshev' | 'bessel';
export type TopologiaFiltro = 'π' | 'T';

export const esDeBanda = (tipo: TipoFiltro): tipo is TipoDeBanda =>
  tipo === 'pasa-banda' || tipo === 'rechaza-banda';

// La banda como la escribe el Alumno: sus dos bordes, o la central y el ancho (spec §7.1). En Hz.
export type BandaEntrada = { f1: number; f2: number } | { f0: number; bw: number };

// Las cuatro, siempre: f0 es la central geométrica √(f1·f2).
export interface Banda {
  f1: number;
  f2: number;
  f0: number;
  bw: number;
  // BW / f0
  fbw: number;
}

// En lugar del Orden, la atenuación mínima As (dB) que el Alumno pide a la frecuencia fs (Hz): el
// Asistente calcula el Orden más chico que la cumple (spec §7.6).
export interface PedidoAtenuacion {
  as: number;
  fs: number;
}

interface EntradaComun {
  aproximacion: Aproximacion;
  // En dB; solo en Chebyshev.
  ripple: number | null;
  topologia: TopologiaFiltro;
  // El que escribió el Alumno (1 a 10), o la atenuación de la que se calcula.
  orden: number | PedidoAtenuacion;
  rs: number;
  rl: number;
  // Qu, para la pérdida de Cohn.
  qBobina: number;
}

export type EntradaFiltro =
  | (EntradaComun & {
      tipo: TipoBajoAlto;
      // En Hz: −3 dB en Butterworth y Bessel, el borde del ripple en Chebyshev.
      fc: number;
    })
  | (EntradaComun & {
      tipo: TipoDeBanda;
      // f1 y f2 son los bordes de banda que corresponden a Ω = 1 del prototipo.
      banda: BandaEntrada;
    });

// Con f1 y f2: f0 = √(f1·f2) y BW = f2 − f1. Con f0 y BW: f1,2 = √(f0² + (BW/2)²) ∓ BW/2, que
// respeta f1·f2 = f0² y f2 − f1 = BW (spec §7.1).
export function bandaDe(banda: BandaEntrada): Banda {
  if ('f1' in banda) {
    const { f1, f2 } = banda;
    const f0 = Math.sqrt(f1 * f2);
    return { f1, f2, f0, bw: f2 - f1, fbw: (f2 - f1) / f0 };
  }
  const { f0, bw } = banda;
  const centro = Math.sqrt(f0 * f0 + (bw / 2) ** 2);
  return { f1: centro - bw / 2, f2: centro + bw / 2, f0, bw, fbw: bw / f0 };
}

export interface Prototipo {
  aproximacion: Aproximacion;
  orden: number;
  ripple: number | null;
  // g1 … gn, de la fuente a la carga.
  g: readonly number[];
  // g(n+1): 1 salvo en Chebyshev par.
  carga: number;
  // Solo en Chebyshev.
  beta: number | null;
  gamma: number | null;
  // Solo en Bessel: el ω3dB del Orden, por el que se multiplicó la tabla de retardo de 1 s.
  factorRetardo: number | null;
  // Solo con Rs ≠ RL (spec §7.4): a, â o α, K y ρ0 de Takahasi.
  takahasi: ParametrosTakahasi | null;
  pasos: readonly Paso[];
}

export type Posicion = 'serie' | 'derivacion';

export const DONDE: Record<Posicion, string> = { serie: 'en serie', derivacion: 'en derivación' };

// Un L o C de la escalera. Se nombra por su posición desde la fuente: "C1", "L2". En pasa banda y
// rechaza banda, por el resonador al que pertenece: el "L2" y el "C2" del segundo.
export interface ElementoFiltro {
  componente: 'L' | 'C';
  nombre: string;
  // En H o F.
  valor: number;
  posicion: Posicion;
  // Su lugar desde la fuente, y el índice y el valor del g del prototipo del que sale. El índice es
  // k salvo en las escaleras de Takahasi armadas de la carga a la fuente, que empiezan por gn.
  k: number;
  indiceG: number;
  g: number;
}

// Un resonador LC de pasa banda o rechaza banda: el L y el C de un elemento g del prototipo, juntos
// en serie o en paralelo, en el brazo en serie o en derivación de la escalera. Sintoniza en ω0.
export interface ResonadorFiltro {
  nombre: string;
  k: number;
  g: number;
  posicion: Posicion;
  conexion: 'serie' | 'paralelo';
  // Los mismos objetos que están en `elementos`.
  l: ElementoFiltro;
  c: ElementoFiltro;
}

export type CodigoCorteFiltro =
  | 'entrada-invalida'
  // Bessel no tiene fórmulas de Takahasi (spec §7.4).
  | 'bessel-terminaciones-distintas'
  // Orden calculado (spec §7.6 y §7.10): fs cae en la banda pasante, haría falta más de 10, o
  // Bessel no llega a la atenuación con ningún Orden hasta 10.
  | 'banda-pasante'
  | 'orden-excedido'
  | 'bessel-sin-solucion';

export type CodigoAvisoFiltro =
  'perdida-plana' | 'chebyshev-par' | 'topologia-orden-par' | 'f0-geometrica';

// Las cuatro escaleras de Takahasi, con la misma respuesta (spec §7.4; research/filtros-
// terminaciones-desiguales.md §3). (a) es la de las fórmulas: g1 en serie, la fuente en la R menor y
// la carga en la mayor. (b) es su dual, vista desde la R mayor; (c) y (d) son las mismas dos armadas
// de la carga a la fuente, de gn a g1.
export type VarianteTakahasi = 'a' | 'b' | 'c' | 'd';

// Una escalera de Takahasi armada: la que se muestra o su alternativa.
export interface EscaleraTakahasi {
  variante: VarianteTakahasi;
  // La R con la que se escala: la menor en (a) y (c), la mayor en (b) y (d).
  r0: number;
  elementos: readonly ElementoFiltro[];
  resonadores: readonly ResonadorFiltro[];
  // El mayor de los cocientes máximo/mínimo entre sus L y entre sus C.
  dispersion: number;
  // El peor error relativo del montaje entre sus valores (spec §5.6), como fracción.
  peorError: number;
}

// Lo que agrega un filtro con Rs ≠ RL (spec §7.4 y §7.9).
export interface Terminaciones extends Omit<EscaleraTakahasi, 'elementos' | 'resonadores'> {
  // R mayor sobre R menor.
  r: number;
  // La transmisión máxima de la banda pasante.
  k: number;
  // La desadaptación directa, −10·log10(4r/(1+r)²), en dB: la pérdida plana del aviso.
  perdidaPlana: number;
  // −10·log10 K, en dB: la menor pérdida de la banda pasante, donde más transmite. Es la plana,
  // salvo en Chebyshev par, que en los picos del ripple pierde el ripple menos.
  perdidaMinima: number;
  // La otra escalera de la misma Topología, si hay (Orden par). Va en los pasos intermedios.
  alternativa: EscaleraTakahasi | null;
}

// El Orden calculado desde una atenuación y lo que muestra el resultado (spec §7.6 y §7.9).
export interface OrdenCalculado {
  as: number;
  fs: number;
  // La frecuencia fs en el prototipo; infinita si cae justo en la central de un rechaza banda.
  omegaS: number;
  // El n de la fórmula sin redondear; null en Bessel, que no tiene fórmula.
  nExacto: number | null;
  // El elegido: redondeado hacia arriba, y impar en Chebyshev con terminaciones iguales.
  orden: number;
  // La atenuación del prototipo en fs con el n elegido, en dB.
  atenuacionReal: number;
  // Ωs, la fórmula del Orden con sus valores y la atenuación real.
  pasos: readonly Paso[];
}

export type ResultadoOrden =
  | ({ estado: 'calculado' } & OrdenCalculado)
  | {
      estado: 'corte';
      codigo: Extract<CodigoCorteFiltro, 'banda-pasante' | 'orden-excedido' | 'bessel-sin-solucion'>;
      texto: string;
    };

export type ResultadoFiltro =
  | { estado: 'corte'; codigo: CodigoCorteFiltro; texto: string }
  | {
      estado: 'calculado';
      tipo: TipoFiltro;
      aproximacion: Aproximacion;
      // La que se usa y la que pidió el Alumno: con Orden par y Rs ≠ RL solo existe una.
      topologia: TopologiaFiltro;
      topologiaPedida: TopologiaFiltro;
      // El que escribió el Alumno (null si lo pidió desde una atenuación) y el que se usa: Chebyshev
      // par sube al impar.
      ordenPedido: number | null;
      orden: number;
      // Solo si el Orden se calculó desde una atenuación.
      ordenCalculado: OrdenCalculado | null;
      prototipo: Prototipo;
      // La banda de pasa banda y rechaza banda; null en pasa bajos y pasa altos.
      banda: Banda | null;
      // La frecuencia a la que se evalúa el Valor impracticable: fc, o f2 en pasa banda y rechaza
      // banda (spec §7.10).
      frecuenciaRevision: number;
      // De la fuente a la carga. En pasa banda y rechaza banda, los L y C de los resonadores.
      elementos: readonly ElementoFiltro[];
      // Solo en pasa banda y rechaza banda.
      resonadores: readonly ResonadorFiltro[];
      // Solo con Rs ≠ RL.
      terminaciones: Terminaciones | null;
      // Estimación de Cohn, en dB. Null en rechaza banda (spec §12.1, P1) y con Rs ≠ RL, porque
      // Matthaei ec. 4.13-11 supone terminaciones iguales.
      perdidaCohn: number | null;
      // Solo en Bessel pasa bajos: τ0 = factor/ωc, en s. Sin curva de retardo (spec §7.3).
      retardoContinua: number | null;
      // Las fórmulas del resultado principal, sin números.
      formulas: readonly string[];
      pasos: readonly Paso[];
      // Valor dudoso o impracticable de cada L y C en frecuenciaRevision. Su cuenta está al final de
      // pasos.
      revision: Revision;
      referencias: readonly Referencia[];
      avisos: readonly Aviso<CodigoAvisoFiltro>[];
      notas: readonly string[];
    };

export const REFERENCIAS_FILTROS: readonly Referencia[] = [
  {
    autor: 'G. L. Matthaei, L. Young y E. M. T. Jones',
    obra: 'Microwave Filters, Impedance-Matching Networks, and Coupling Structures',
    edicion: '1.ª',
    editor: 'McGraw-Hill',
    anio: 1964,
    ubicacion:
      'ec. 4.04-2 a 4.04-4, 4.05-1, 4.05-2, 4.13-2 y 4.13-11, Sec. 12.02, tablas 4.05-1, 4.05-2 y 4.07-1',
  },
  {
    autor: 'D. M. Pozar',
    obra: 'Microwave Engineering',
    edicion: '4.ª',
    editor: 'Wiley',
    anio: 2012,
    ubicacion: '§8.3 y §8.4, Tabla 8.6',
  },
  {
    autor: 'A. I. Zverev',
    obra: 'Handbook of Filter Synthesis',
    edicion: '1.ª',
    editor: 'Wiley',
    anio: 1967,
    ubicacion: 'tablas de prototipos LC',
  },
  {
    autor: 'A. B. Williams y F. J. Taylor',
    obra: 'Electronic Filter Design Handbook',
    edicion: '4.ª',
    editor: 'McGraw-Hill',
    anio: 2006,
    ubicacion: 'filtros LC pasa bajos, pasa altos, pasa banda y rechaza banda',
  },
];

// Con Rs ≠ RL (spec §7.11). El original de Takahasi no se leyó (spec §12.3).
export const REFERENCIAS_TAKAHASI: readonly Referencia[] = [
  {
    autor: 'H. Takahasi',
    obra: 'Journal of the Institute of Electrical Communication Engineers of Japan',
    volumen: '34(2)',
    anio: 1951,
    ubicacion:
      'págs. 65-74, a través de Matthaei, Young y Jones, Sec. 4.10, ec. 4.10-2 a 4.10-4, y de ' +
      'Weinberg y Slepian (1960)',
  },
  {
    autor: 'L. Weinberg y P. Slepian',
    obra: 'IRE Transactions on Circuit Theory',
    volumen: 'CT-7(2)',
    anio: 1960,
    ubicacion: 'págs. 88-101',
  },
];

export const SUGERENCIA_FILTROS = 'Cambiá de Topología π ↔ T.';
// En el rechaza banda angosto esta es la única respuesta de esta Versión (spec §7.10).
export const SUGERENCIA_RECHAZA_BANDA = 'Cambiá de Topología π ↔ T, o ensanchá la banda.';

export const ORDEN_MAXIMO = 10;
export const RANGO_RIPPLE = { min: 0.01, max: 3 } as const;

// 10/ln 10: los dB de un logaritmo natural. Matthaei lo escribe 4,343 (y 40/ln 10 como 17,37).
const DB_POR_NEPER = 10 / Math.LN10;

const ohms = (r: number) => valorLatex(r, 'resistencia');
const hz = (f: number) => valorLatex(f, 'frecuencia');
const db = (x: number) => valorLatex(x, 'decibeles');
const numeroTexto = (x: number) => formatearValor(x, 'numero');

// R mayor sobre R menor: 1 con terminaciones iguales.
export const relacionDe = (rs: number, rl: number) => Math.max(rs, rl) / Math.min(rs, rl);

// Chebyshev de Orden par se arma solo entre R distintas con r ≥ r_min; con Rs = RL nunca (spec §7.3
// y §7.4). Si no, se usa el impar siguiente.
const parSeArma = (ripple: number | null, r: number) =>
  r !== 1 && ripple !== null && admiteOrdenPar(ripple, r);

export const ordenEfectivo = (
  aproximacion: Aproximacion,
  n: number,
  ripple: number | null,
  r: number,
) => (aproximacion === 'chebyshev' && n % 2 === 0 && !parSeArma(ripple, r) ? n + 1 : n);

// En π g1 va en derivación junto a la fuente; en T, en serie. Después alternan.
const posicionDe = (topologia: TopologiaFiltro, k: number): Posicion =>
  (topologia === 'T') === (k % 2 === 1) ? 'serie' : 'derivacion';

// Con Orden par y Rs ≠ RL el elemento en serie va del lado de la R menor y el de derivación del de
// la mayor: desde la R menor solo hay T, y desde la mayor solo π (spec §7.4).
const topologiaDeOrdenPar = (rs: number, rl: number): TopologiaFiltro => (rs < rl ? 'T' : 'π');

// Matthaei ec. 4.04-2 a 4.04-4 y Pozar, Tabla 8.6, con ωc = 2π·fc: qué es cada g según el Tipo de
// filtro y su posición, y su fórmula sin números y con ellos.
interface Escala {
  componente: 'L' | 'C';
  valor: (g: number, r0: number, omega: number) => number;
  formula: (g: string) => string;
  sustituida: (g: string, fc: string, r0: string) => string;
}

const ESCALA: Record<TipoBajoAlto, Record<Posicion, Escala>> = {
  'pasa-bajos': {
    serie: {
      componente: 'L',
      valor: (g, r0, omega) => (g * r0) / omega,
      formula: (g) => `\\dfrac{${g} R_0}{2\\pi f_c}`,
      sustituida: (g, fc, r0) => `\\dfrac{${g} \\cdot ${r0}}{2\\pi \\cdot ${fc}}`,
    },
    derivacion: {
      componente: 'C',
      valor: (g, r0, omega) => g / (r0 * omega),
      formula: (g) => `\\dfrac{${g}}{2\\pi f_c R_0}`,
      sustituida: (g, fc, r0) => `\\dfrac{${g}}{2\\pi \\cdot ${fc} \\cdot ${r0}}`,
    },
  },
  'pasa-altos': {
    serie: {
      componente: 'C',
      valor: (g, r0, omega) => 1 / (g * r0 * omega),
      formula: (g) => `\\dfrac{1}{2\\pi f_c\\, ${g} R_0}`,
      sustituida: (g, fc, r0) => `\\dfrac{1}{2\\pi \\cdot ${fc} \\cdot ${g} \\cdot ${r0}}`,
    },
    derivacion: {
      componente: 'L',
      valor: (g, r0, omega) => r0 / (g * omega),
      formula: (g) => `\\dfrac{R_0}{2\\pi f_c\\, ${g}}`,
      sustituida: (g, fc, r0) => `\\dfrac{${r0}}{2\\pi \\cdot ${fc} \\cdot ${g}}`,
    },
  },
};

// Matthaei ec. 4.04-2 a 4.04-4 y Sec. 12.02, y Pozar, Tabla 8.6, con ω0 = √(ω1·ω2) y BWω = ω2 − ω1:
// cada g de pasa banda y rechaza banda es un resonador LC. Las fórmulas se escriben una vez, con
// los símbolos o con los números sustituidos.
interface Simbolos {
  g: string;
  r0: string;
  // BWω
  bw: string;
  // ω0²
  w02: string;
  // El signo de producto: un espacio fino en la fórmula y un punto con los números.
  por: string;
}

interface EscalaBanda {
  conexion: 'serie' | 'paralelo';
  l: {
    valor: (g: number, r0: number, w0: number, bw: number) => number;
    formula: (s: Simbolos) => string;
  };
  c: {
    valor: (g: number, r0: number, w0: number, bw: number) => number;
    formula: (s: Simbolos) => string;
  };
}

const ESCALA_BANDA: Record<TipoDeBanda, Record<Posicion, EscalaBanda>> = {
  'pasa-banda': {
    serie: {
      conexion: 'serie',
      l: {
        valor: (g, r0, _w0, bw) => (g * r0) / bw,
        formula: ({ g, r0, bw, por }) => `\\dfrac{${g}${por}${r0}}{${bw}}`,
      },
      c: {
        valor: (g, r0, w0, bw) => bw / (w0 * w0 * g * r0),
        formula: ({ g, r0, bw, w02, por }) => `\\dfrac{${bw}}{${w02}${por}${g}${por}${r0}}`,
      },
    },
    derivacion: {
      conexion: 'paralelo',
      l: {
        valor: (g, r0, w0, bw) => (r0 * bw) / (w0 * w0 * g),
        formula: ({ g, r0, bw, w02, por }) => `\\dfrac{${r0}${por}${bw}}{${w02}${por}${g}}`,
      },
      c: {
        valor: (g, r0, _w0, bw) => g / (r0 * bw),
        formula: ({ g, r0, bw, por }) => `\\dfrac{${g}}{${r0}${por}${bw}}`,
      },
    },
  },
  'rechaza-banda': {
    serie: {
      conexion: 'paralelo',
      l: {
        valor: (g, r0, w0, bw) => (g * r0 * bw) / (w0 * w0),
        formula: ({ g, r0, bw, w02, por }) => `\\dfrac{${g}${por}${r0}${por}${bw}}{${w02}}`,
      },
      c: {
        valor: (g, r0, _w0, bw) => 1 / (g * r0 * bw),
        formula: ({ g, r0, bw, por }) => `\\dfrac{1}{${g}${por}${r0}${por}${bw}}`,
      },
    },
    derivacion: {
      conexion: 'serie',
      l: {
        valor: (g, r0, _w0, bw) => r0 / (g * bw),
        formula: ({ g, r0, bw, por }) => `\\dfrac{${r0}}{${g}${por}${bw}}`,
      },
      c: {
        valor: (g, r0, w0, bw) => (g * bw) / (w0 * w0 * r0),
        formula: ({ g, r0, bw, w02, por }) => `\\dfrac{${g}${por}${bw}}{${w02}${por}${r0}}`,
      },
    },
  },
};

// Las bobinas son las series en pasa bajos y las derivaciones en pasa altos; en pasa banda y
// rechaza banda, la de cada resonador.
export function contarBobinas(tipo: TipoFiltro, topologia: TopologiaFiltro, n: number): number {
  if (esDeBanda(tipo)) return n;
  let cuenta = 0;
  for (let k = 1; k <= n; k++) {
    if (ESCALA[tipo][posicionDe(topologia, k)].componente === 'L') cuenta++;
  }
  return cuenta;
}

// Lo que la Topología por defecto necesita además del Orden, porque con Rs ≠ RL cambia cuál se
// arma: sin esto, Rs = RL.
export interface DatosDeTopologia {
  ripple: number | null;
  rs: number;
  rl: number;
}

// La Topología por defecto: la que usa menos bobinas, que en VHF son las de menor Q y más
// dispersión; π cuando las dos usan las mismas (spec §7.1 y §12.2). Con Orden par y Rs ≠ RL, la
// única que se arma (spec §7.4). La nota lo explica en una línea junto al campo.
export function topologiaSugerida(
  tipo: TipoFiltro,
  aproximacion: Aproximacion,
  orden: number | null,
  { ripple, rs, rl }: DatosDeTopologia = { ripple: null, rs: 1, rl: 1 },
): { topologia: TopologiaFiltro; nota: string } {
  if (orden === null) {
    return { topologia: 'π', nota: 'Por defecto, la que usa menos bobinas según el Orden.' };
  }
  const r = relacionDe(rs, rl);
  const n = ordenEfectivo(aproximacion, orden, ripple, r);
  if (r !== 1 && aproximacion !== 'bessel' && n % 2 === 0) {
    const unica = topologiaDeOrdenPar(rs, rl);
    return {
      topologia: unica,
      nota:
        `Con Orden par y Rs ≠ RL solo se puede armar ${unica}: el elemento en serie va del lado ` +
        'de la R menor.',
    };
  }
  const enPi = contarBobinas(tipo, 'π', n);
  const enT = contarBobinas(tipo, 'T', n);
  if (enPi === enT) {
    return {
      topologia: 'π',
      nota: `π y T llevan ${enPi} ${enPi === 1 ? 'bobina' : 'bobinas'} cada una: por defecto, π.`,
    };
  }
  const [mejor, menos, otra, mas] = enPi < enT ? ['π', enPi, 'T', enT] : ['T', enT, 'π', enPi];
  const lleva = menos === 0 ? 'no lleva ninguna' : `lleva ${menos}`;
  return {
    topologia: mejor as TopologiaFiltro,
    nota: `Por defecto, la que usa menos bobinas: ${mejor} ${lleva} y ${otra}, ${mas}.`,
  };
}

// --- Prototipo -----------------------------------------------------------------------------------

const FORMULA_BUTTERWORTH = 'g_k = 2 \\operatorname{sen}\\left[\\dfrac{(2k - 1)\\pi}{2n}\\right]';
const FORMULAS_CHEBYSHEV = [
  '\\beta = \\ln\\left[\\coth\\left(\\dfrac{r}{17{,}37}\\right)\\right],\\; ' +
    '\\gamma = \\operatorname{senh}\\left(\\dfrac{\\beta}{2n}\\right)',
  'a_k = \\operatorname{sen}\\left[\\dfrac{(2k - 1)\\pi}{2n}\\right],\\; ' +
    'b_k = \\gamma^2 + \\operatorname{sen}^2\\left(\\dfrac{k\\pi}{n}\\right)',
  'g_1 = \\dfrac{2 a_1}{\\gamma},\\; g_k = \\dfrac{4 a_{k-1} a_k}{b_{k-1} g_{k-1}}',
];

const FORMULA_BESSEL =
  'g_k = g_k^{(\\tau)} \\cdot \\omega_{3\\mathrm{dB}},\\; ' +
  '\\tau_0 = \\dfrac{\\omega_{3\\mathrm{dB}}}{2\\pi f_c}';

const FUENTE_BUTTERWORTH = 'Matthaei, Young y Jones, ec. 4.05-1.';
const FUENTE_CHEBYSHEV = 'Matthaei, Young y Jones, ec. 4.05-2.';
const FUENTE_BESSEL =
  'Matthaei, Young y Jones, tabla 4.07-1 (datos de Weinberg), normalizada a retardo de 1 s y ' +
  'renormalizada a −3 dB.';

// La Tabla 4.07-1: g1 … gn con el retardo en continua en 1 s, y el factor ω3dB de cada Orden (la
// frecuencia de −3 dB, en rad/s, de ese filtro). El g grande va del lado de g1. Con n = 1 coincide
// con Butterworth (g1 = 2, ω3dB = 1). Se guarda la tabla: la síntesis pierde precisión desde n ≈ 10.
const BESSEL_RETARDO: Record<number, { g: readonly number[]; factor: number }> = {
  1: { g: [2], factor: 1 },
  2: { g: [1.5774, 0.4226], factor: 1.3617 },
  3: { g: [1.255, 0.5528, 0.1922], factor: 1.7557 },
  4: { g: [1.0598, 0.5116, 0.3181, 0.1104], factor: 2.1139 },
  5: { g: [0.9303, 0.4577, 0.3312, 0.209, 0.0718], factor: 2.4274 },
  6: { g: [0.8377, 0.4116, 0.3158, 0.2364, 0.148, 0.0505], factor: 2.7034 },
  7: { g: [0.7677, 0.3744, 0.2944, 0.2378, 0.1778, 0.1104, 0.0375], factor: 2.9517 },
  8: { g: [0.7125, 0.3446, 0.2735, 0.2297, 0.1867, 0.1387, 0.0855, 0.0289], factor: 3.1796 },
  9: {
    g: [0.6678, 0.3203, 0.2547, 0.2184, 0.1859, 0.1506, 0.1112, 0.0682, 0.023],
    factor: 3.3917,
  },
  10: {
    g: [0.6305, 0.3002, 0.2384, 0.2066, 0.1808, 0.1539, 0.124, 0.091, 0.0556, 0.0187],
    factor: 3.591,
  },
};

// r = R mayor/R menor. Con r ≠ 1, las fórmulas de Takahasi; Bessel no las tiene (spec §7.4).
export function prototipo(
  aproximacion: Aproximacion,
  n: number,
  ripple: number | null,
  r = 1,
): Prototipo {
  if (aproximacion === 'bessel') {
    if (r !== 1) throw new Error('Bessel no tiene fórmulas con Rs ≠ RL');
    return bessel(n);
  }
  if (r !== 1) return takahasi(aproximacion, n, ripple, r);
  return aproximacion === 'butterworth' ? butterworth(n) : chebyshev(n, ripple!);
}

function bessel(n: number): Prototipo {
  const { g: retardo, factor } = BESSEL_RETARDO[n];
  const g = retardo.map((x) => x * factor);
  const pasos: Paso[] = [
    {
      texto: 'Factor ω3dB del Orden, de la tabla de retardo de 1 s',
      latex: `\\omega_{3\\mathrm{dB}} = ${numero(factor)}`,
      fuente: FUENTE_BESSEL,
    },
    ...g.map((gk, i) => ({
      texto: `g${i + 1}`,
      latex:
        `g_{${i + 1}} = g_{${i + 1}}^{(\\tau)} \\cdot \\omega_{3\\mathrm{dB}} = ` +
        `${numero(retardo[i])} \\cdot ${numero(factor)} = ${numero(gk)}`,
    })),
    { texto: 'Carga del prototipo: igual a la fuente', latex: `g_{${n + 1}} = 1` },
  ];
  return {
    aproximacion: 'bessel',
    orden: n,
    ripple: null,
    g,
    carga: 1,
    beta: null,
    gamma: null,
    factorRetardo: factor,
    takahasi: null,
    pasos,
  };
}

function butterworth(n: number): Prototipo {
  const g = Array.from({ length: n }, (_, i) => 2 * Math.sin(((2 * i + 1) * Math.PI) / (2 * n)));
  const pasos: Paso[] = g.map((gk, i) => ({
    texto: `g${i + 1}`,
    latex:
      `g_{${i + 1}} = 2 \\operatorname{sen}\\left[\\dfrac{(2 \\cdot ${i + 1} - 1)\\pi}{2 \\cdot ${n}}\\right] = ` +
      numero(gk),
    ...(i === 0 && { fuente: FUENTE_BUTTERWORTH }),
  }));
  pasos.push({ texto: 'Carga del prototipo: igual a la fuente', latex: `g_{${n + 1}} = 1` });
  return {
    aproximacion: 'butterworth',
    orden: n,
    ripple: null,
    g,
    carga: 1,
    beta: null,
    gamma: null,
    factorRetardo: null,
    takahasi: null,
    pasos,
  };
}

function chebyshev(n: number, ripple: number): Prototipo {
  const beta = Math.log(1 / Math.tanh(ripple / (4 * DB_POR_NEPER)));
  const gamma = Math.sinh(beta / (2 * n));
  const a = (k: number) => Math.sin(((2 * k - 1) * Math.PI) / (2 * n));
  const b = (k: number) => gamma * gamma + Math.sin((k * Math.PI) / n) ** 2;
  const g = [(2 * a(1)) / gamma];
  for (let k = 2; k <= n; k++) g.push((4 * a(k - 1) * a(k)) / (b(k - 1) * g[k - 2]));
  const par = n % 2 === 0;
  const carga = par ? 1 / Math.tanh(beta / 4) ** 2 : 1;

  const lista = (f: (k: number) => number, hasta: number) =>
    Array.from({ length: hasta }, (_, i) => numero(f(i + 1))).join(',\\; ');
  const pasos: Paso[] = [
    {
      texto: 'β, del ripple',
      latex:
        `\\beta = \\ln\\left[\\coth\\left(\\dfrac{r}{17{,}37}\\right)\\right] = ` +
        `\\ln\\left[\\coth\\left(\\dfrac{${numero(ripple)}}{17{,}37}\\right)\\right] = ${numero(beta)}`,
      fuente: `${FUENTE_CHEBYSHEV} 17,37 es 40/ln 10; la cuenta usa el valor exacto.`,
    },
    {
      texto: 'γ',
      latex:
        `\\gamma = \\operatorname{senh}\\left(\\dfrac{\\beta}{2n}\\right) = ` +
        `\\operatorname{senh}\\left(\\dfrac{${numero(beta)}}{2 \\cdot ${n}}\\right) = ${numero(gamma)}`,
    },
    {
      texto: `a1 … a${n}`,
      latex: `a_k = \\operatorname{sen}\\left[\\dfrac{(2k - 1)\\pi}{2 \\cdot ${n}}\\right]:\\; ${lista(a, n)}`,
    },
    ...(n > 1
      ? [
          {
            texto: `b1 … b${n - 1}`,
            latex:
              `b_k = \\gamma^2 + \\operatorname{sen}^2\\left(\\dfrac{k\\pi}{${n}}\\right):\\; ` +
              lista(b, n - 1),
          },
        ]
      : []),
    {
      texto: 'g1',
      latex:
        `g_{1} = \\dfrac{2 a_{1}}{\\gamma} = \\dfrac{2 \\cdot ${numero(a(1))}}{${numero(gamma)}} = ` +
        numero(g[0]),
    },
    ...g.slice(1).map((gk, i) => {
      const k = i + 2;
      return {
        texto: `g${k}`,
        latex:
          `g_{${k}} = \\dfrac{4 a_{${k - 1}} a_{${k}}}{b_{${k - 1}} g_{${k - 1}}} = ` +
          `\\dfrac{4 \\cdot ${numero(a(k - 1))} \\cdot ${numero(a(k))}}` +
          `{${numero(b(k - 1))} \\cdot ${numero(g[k - 2])}} = ${numero(gk)}`,
      };
    }),
    par
      ? {
          texto: 'Carga del prototipo: Orden par, distinta de la fuente',
          latex:
            `g_{${n + 1}} = \\coth^2\\left(\\dfrac{\\beta}{4}\\right) = ` +
            `\\coth^2\\left(\\dfrac{${numero(beta)}}{4}\\right) = ${numero(carga)}`,
        }
      : { texto: 'Carga del prototipo: Orden impar, igual a la fuente', latex: `g_{${n + 1}} = 1` },
  ];
  return {
    aproximacion: 'chebyshev',
    orden: n,
    ripple,
    g,
    carga,
    beta,
    gamma,
    factorRetardo: null,
    takahasi: null,
    pasos,
  };
}

// --- Escalera ------------------------------------------------------------------------------------

const formulasEscala = (tipo: TipoBajoAlto) =>
  (['serie', 'derivacion'] as const).map((posicion) => {
    const { componente, formula } = ESCALA[tipo][posicion];
    return `${componente}_k = ${formula('g_k')}\\;\\text{(${DONDE[posicion]})}`;
  });

const SIMBOLOS_BANDA: Simbolos = {
  g: 'g_k',
  r0: 'R_0',
  bw: '\\mathrm{BW}_\\omega',
  w02: '\\omega_0^2',
  por: '\\,',
};

const formulasBanda = (tipo: TipoDeBanda) => [
  'f_0 = \\sqrt{f_1 f_2},\\; \\mathrm{BW} = f_2 - f_1,\\; ' +
    '\\omega_0 = 2\\pi f_0,\\; \\mathrm{BW}_\\omega = 2\\pi\\,\\mathrm{BW}',
  ...(['serie', 'derivacion'] as const).map((posicion) => {
    const { conexion, l, c } = ESCALA_BANDA[tipo][posicion];
    return (
      `L_k = ${l.formula(SIMBOLOS_BANDA)},\\; C_k = ${c.formula(SIMBOLOS_BANDA)}` +
      `\\;\\text{(LC ${conexion} ${DONDE[posicion]})}`
    );
  }),
];

const FORMULA_COHN = '\\Delta L_0 \\approx 4{,}343 \\sum \\dfrac{g_k}{Q_u}\\;\\text{(bobinas)}';
export const FORMULA_COHN_BANDA =
  '\\Delta L_0 \\approx 4{,}343 \\sum \\dfrac{g_k}{Q_k},\\; Q_k = \\mathrm{FBW} \\cdot Q_u';

// Cómo se arma la escalera desde la fuente: la Topología, los g en ese orden con su índice en el
// prototipo, y la R con la que se escalan. Con Rs = RL, g1 … gn y R0 = Rs.
interface Disposicion {
  topologia: TopologiaFiltro;
  g: readonly number[];
  indices: readonly number[];
  r0: number;
}

function elementoDe(
  tipo: TipoBajoAlto,
  { topologia, g: gs, indices, r0 }: Disposicion,
  k: number,
  fc: number,
): { elemento: ElementoFiltro; paso: Paso } {
  const posicion = posicionDe(topologia, k);
  const escala = ESCALA[tipo][posicion];
  const { componente } = escala;
  const nombre = `${componente}${k}`;
  const g = gs[k - 1];
  const indiceG = indices[k - 1];
  const valor = escala.valor(g, r0, 2 * Math.PI * fc);
  const magnitud = componente === 'L' ? 'inductancia' : 'capacidad';
  return {
    elemento: { componente, nombre, valor, posicion, k, indiceG, g },
    paso: {
      texto: `${nombre}, ${DONDE[posicion]}`,
      latex:
        `${componente}_{${k}} = ${escala.formula(`g_{${indiceG}}`)} = ` +
        `${escala.sustituida(numero(g), hz(fc), ohms(r0))} = ${valorLatex(valor, magnitud)}`,
    },
  };
}

// El g de lugar k hecho resonador (spec §7.5): su L y su C, y el chequeo de que sintoniza en ω0.
function resonadorDe(
  tipo: TipoDeBanda,
  { topologia, g: gs, indices, r0 }: Disposicion,
  k: number,
  banda: Banda,
): { resonador: ResonadorFiltro; pasos: Paso[] } {
  const posicion = posicionDe(topologia, k);
  const escala = ESCALA_BANDA[tipo][posicion];
  const g = gs[k - 1];
  const indiceG = indices[k - 1];
  const w0 = 2 * Math.PI * banda.f0;
  const bw = 2 * Math.PI * banda.bw;
  const simbolos: Simbolos = { ...SIMBOLOS_BANDA, g: `g_{${indiceG}}` };
  const sustituidos: Simbolos = {
    g: numero(g),
    r0: ohms(r0),
    bw: `2\\pi \\cdot ${hz(banda.bw)}`,
    w02: `\\left(2\\pi \\cdot ${hz(banda.f0)}\\right)^2`,
    por: ' \\cdot ',
  };

  const armar = (componente: 'L' | 'C'): ElementoFiltro => {
    const { valor } = componente === 'L' ? escala.l : escala.c;
    return {
      componente,
      nombre: `${componente}${k}`,
      valor: valor(g, r0, w0, bw),
      posicion,
      k,
      indiceG,
      g,
    };
  };
  const l = armar('L');
  const c = armar('C');
  const nombre = `R${k}`;
  const paso = (e: ElementoFiltro, formula: (s: Simbolos) => string): Paso => ({
    texto: `${e.nombre} del resonador ${nombre}: LC ${escala.conexion} ${DONDE[posicion]}`,
    latex:
      `${e.componente}_{${k}} = ${formula(simbolos)} = ${formula(sustituidos)} = ` +
      valorLatex(e.valor, e.componente === 'L' ? 'inductancia' : 'capacidad'),
  });
  const sintonia = 1 / (2 * Math.PI * Math.sqrt(l.valor * c.valor));
  return {
    resonador: { nombre, k, g, posicion, conexion: escala.conexion, l, c },
    pasos: [
      paso(l, escala.l.formula),
      paso(c, escala.c.formula),
      {
        texto: `Sintonía de ${nombre}: tiene que dar f0`,
        latex:
          `\\dfrac{1}{2\\pi\\sqrt{L_{${k}} C_{${k}}}} = ` +
          `\\dfrac{1}{2\\pi\\sqrt{${valorLatex(l.valor, 'inductancia')} \\cdot ` +
          `${valorLatex(c.valor, 'capacidad')}}} = ${hz(sintonia)}`,
      },
    ],
  };
}

// Los pasos de la banda: los cuatro valores y cómo salen de los que dio el Alumno.
function pasosDeBanda(entrada: BandaEntrada, b: Banda): Paso[] {
  const fuente = 'Matthaei, Young y Jones, ec. 8.04-1 y Sec. 12.02: f0 es la central geométrica.';
  const fbw = {
    texto: 'Ancho de banda relativo',
    latex: `\\mathrm{FBW} = \\dfrac{\\mathrm{BW}}{f_0} = \\dfrac{${hz(b.bw)}}{${hz(b.f0)}} = ${numero(b.fbw)}`,
  };
  if ('f1' in entrada) {
    return [
      {
        texto: 'Central geométrica y ancho de banda',
        latex:
          `f_0 = \\sqrt{f_1 f_2} = \\sqrt{${hz(b.f1)} \\cdot ${hz(b.f2)}} = ${hz(b.f0)},\\; ` +
          `\\mathrm{BW} = f_2 - f_1 = ${hz(b.bw)}`,
        fuente,
      },
      fbw,
    ];
  }
  const raiz = `\\sqrt{f_0^2 + (\\mathrm{BW}/2)^2}`;
  const raizValor = `\\sqrt{${hz(b.f0)}^2 + (${hz(b.bw)}/2)^2}`;
  return [
    {
      texto: 'Bordes de la banda, a partir de f0 y BW',
      latex:
        `f_1 = ${raiz} - \\dfrac{\\mathrm{BW}}{2} = ${raizValor} - \\dfrac{${hz(b.bw)}}{2} = ` +
        `${hz(b.f1)},\\; f_2 = ${raiz} + \\dfrac{\\mathrm{BW}}{2} = ${hz(b.f2)}`,
      fuente,
    },
    fbw,
  ];
}

// --- Orden calculado desde una atenuación (spec §7.6) -------------------------------------------

// Lo que hace falta para pasar fs al prototipo: el Tipo de filtro, la Aproximación y las frecuencias.
export type DatosDeOrden =
  | { tipo: TipoBajoAlto; aproximacion: Aproximacion; ripple: number | null; fc: number }
  | { tipo: TipoDeBanda; aproximacion: Aproximacion; ripple: number | null; banda: BandaEntrada };

// Matthaei ec. 8.04-1 y 12.02-1: la frecuencia fs en el prototipo pasa bajos. En pasa banda y
// rechaza banda el valor absoluto es la simetría geométrica de la respuesta. Ωs ≤ 1 es la banda
// pasante; en el rechaza banda, fs justo en f0 da infinito.
export function frecuenciaNormalizada(datos: DatosDeOrden, fs: number): number {
  if ('fc' in datos) return datos.tipo === 'pasa-bajos' ? fs / datos.fc : datos.fc / fs;
  const { f0, fbw } = bandaDe(datos.banda);
  const separacion = Math.abs(fs / f0 - f0 / fs);
  return datos.tipo === 'pasa-banda' ? separacion / fbw : fbw / separacion;
}

const factorial = (m: number): number => (m <= 1 ? 1 : m * factorial(m - 1));

// El cuadrado del módulo del polinomio inverso de Bessel, θn(jx) = Σ (2n−k)!/(2^(n−k)·k!·(n−k)!)·(jx)^k,
// dividido por θn(0)²: la atenuación de Bessel es 10·log10 de eso.
function moduloBessel2(n: number, x: number): number {
  const coef = (k: number) =>
    factorial(2 * n - k) / (2 ** (n - k) * factorial(k) * factorial(n - k));
  let re = 0;
  let im = 0;
  for (let k = 0; k <= n; k++) {
    const termino = coef(k) * x ** k;
    // j^k recorre 1, j, −1, −j.
    if (k % 4 === 0) re += termino;
    else if (k % 4 === 1) im += termino;
    else if (k % 4 === 2) re -= termino;
    else im -= termino;
  }
  return (re * re + im * im) / coef(0) ** 2;
}

// La atenuación del prototipo de Orden n en la frecuencia normalizada Ω, en dB (Matthaei ec. 4.03-1 y
// 4.03-3). Bessel usa el polinomio normalizado a −3 dB con el mismo factor ω3dB de la tabla de g, así
// que describe a la escalera que se arma.
export function atenuacionPrototipo(
  aproximacion: Aproximacion,
  n: number,
  omega: number,
  ripple: number | null,
): number {
  if (omega === Infinity) return Infinity;
  if (aproximacion === 'butterworth') return 10 * Math.log10(1 + omega ** (2 * n));
  if (aproximacion === 'bessel') {
    return 10 * Math.log10(moduloBessel2(n, omega * BESSEL_RETARDO[n].factor));
  }
  const epsilon2 = 10 ** (ripple! / 10) - 1;
  const t = omega <= 1 ? Math.cos(n * Math.acos(omega)) : Math.cosh(n * Math.acosh(omega));
  return 10 * Math.log10(1 + epsilon2 * t * t);
}

// Cuánto puede quedar corta la atenuación por el redondeo de las cuentas y seguir cumpliendo.
const TOLERANCIA_CUMPLE_DB = 1e-9;

const dbTexto = (x: number) => (x === Infinity ? '∞' : formatearValor(x, 'decibeles'));
const dbLatex = (x: number) => (x === Infinity ? '\\infty' : db(x));
const numeroOInfinito = (x: number) => (x === Infinity ? '\\infty' : numero(x));

// Dónde cae fs cuando Ωs ≤ 1, para el aviso.
const ZONA_PASANTE: Record<TipoFiltro, string> = {
  'pasa-bajos': 'en fc o por debajo',
  'pasa-altos': 'en fc o por encima',
  'pasa-banda': 'dentro de la banda',
  'rechaza-banda': 'fuera de la banda rechazada',
};

// El n de la fórmula, sin redondear, y el primer entero que cumple de verdad. Se arranca uno antes
// del redondeo hacia arriba para no depender de que la fórmula dé justo un entero, y se confirma con
// la atenuación. Pasado ORDEN_MAXIMO ya no se sigue.
function ordenMinimo(
  aproximacion: 'butterworth' | 'chebyshev',
  omegaS: number,
  ripple: number | null,
  as: number,
): { nExacto: number; n: number } {
  const exceso = 10 ** (as / 10) - 1;
  const cociente = exceso / (10 ** ((ripple ?? 0) / 10) - 1);
  // Butterworth (ec. 4.03-1) y Chebyshev (ec. 4.03-4), despejando n. Con As por debajo del ripple
  // el despeje no existe y alcanza con un elemento.
  const nExacto =
    aproximacion === 'butterworth'
      ? Math.log10(exceso) / (2 * Math.log10(omegaS))
      : cociente <= 1
        ? 0
        : Math.acosh(Math.sqrt(cociente)) / Math.acosh(omegaS);
  let n = Math.min(Math.max(1, Math.ceil(nExacto) - 1), ORDEN_MAXIMO + 1);
  while (
    n <= ORDEN_MAXIMO &&
    atenuacionPrototipo(aproximacion, n, omegaS, ripple) < as - TOLERANCIA_CUMPLE_DB
  ) {
    n++;
  }
  return { nExacto, n };
}

// Ωs con los valores de este caso (spec §7.9: pasos intermedios).
function pasoOmega(datos: DatosDeOrden, fs: number, omegaS: number): Paso {
  const fuente = 'Matthaei, Young y Jones, ec. 8.04-1 y 12.02-1.';
  const resultado = numeroOInfinito(omegaS);
  if ('fc' in datos) {
    const [simbolo, sustituida] =
      datos.tipo === 'pasa-bajos'
        ? ['\\dfrac{f_s}{f_c}', `\\dfrac{${hz(fs)}}{${hz(datos.fc)}}`]
        : ['\\dfrac{f_c}{f_s}', `\\dfrac{${hz(datos.fc)}}{${hz(fs)}}`];
    return {
      texto: 'Ωs, la frecuencia fs en el prototipo',
      latex: `\\Omega_s = ${simbolo} = ${sustituida} = ${resultado}`,
      fuente,
    };
  }
  const b = bandaDe(datos.banda);
  const separacion = '\\left|\\dfrac{f_s}{f_0} - \\dfrac{f_0}{f_s}\\right|';
  const separacionValor =
    `\\left|\\dfrac{${hz(fs)}}{${hz(b.f0)}} - \\dfrac{${hz(b.f0)}}{${hz(fs)}}\\right|`;
  const [simbolo, sustituida] =
    datos.tipo === 'pasa-banda'
      ? [`\\dfrac{${separacion}}{\\mathrm{FBW}}`, `\\dfrac{${separacionValor}}{${numero(b.fbw)}}`]
      : [`\\dfrac{\\mathrm{FBW}}{${separacion}}`, `\\dfrac{${numero(b.fbw)}}{${separacionValor}}`];
  return {
    texto: 'Ωs, la frecuencia fs en el prototipo',
    latex: `\\Omega_s = ${simbolo} = ${sustituida} = ${resultado}`,
    fuente: `${fuente} f0 es la central geométrica √(f1·f2).`,
  };
}

function pasoOrdenFormula(
  aproximacion: 'butterworth' | 'chebyshev',
  ripple: number | null,
  as: number,
  omegaS: number,
  nExacto: number,
): Paso {
  const exceso = `10^{${numero(as)}/10} - 1`;
  const omega = numeroOInfinito(omegaS);
  if (aproximacion === 'butterworth') {
    return {
      texto: 'Orden mínimo de Butterworth',
      latex:
        `n \\ge \\dfrac{\\log_{10}\\left(10^{A_s/10} - 1\\right)}{2 \\log_{10} \\Omega_s} = ` +
        `\\dfrac{\\log_{10}\\left(${exceso}\\right)}{2 \\log_{10}\\left(${omega}\\right)} = ` +
        numero(nExacto),
      fuente: 'Matthaei, Young y Jones, ec. 4.03-1.',
    };
  }
  const fuente = 'Matthaei, Young y Jones, ec. 4.03-4.';
  const epsilon = `10^{${numero(ripple!)}/10} - 1`;
  if ((10 ** (as / 10) - 1) / (10 ** (ripple! / 10) - 1) <= 1) {
    return {
      texto: 'Orden mínimo de Chebyshev: la atenuación pedida no supera el ripple',
      latex: `A_s = ${db(as)} \\le r = ${db(ripple!)} \\Rightarrow n \\ge 0`,
      fuente,
    };
  }
  return {
    texto: 'Orden mínimo de Chebyshev',
    latex:
      `n \\ge \\dfrac{\\operatorname{arccosh}\\sqrt{\\dfrac{10^{A_s/10} - 1}{10^{r/10} - 1}}}` +
      `{\\operatorname{arccosh} \\Omega_s} = ` +
      `\\dfrac{\\operatorname{arccosh}\\sqrt{\\dfrac{${exceso}}{${epsilon}}}}` +
      `{\\operatorname{arccosh}\\left(${omega}\\right)} = ${numero(nExacto)}`,
    fuente,
  };
}

const FORMULA_ATENUACION_BUTTERWORTH = 'A(\\Omega) = 10 \\log_{10}\\left(1 + \\Omega^{2n}\\right)';
const FORMULA_ATENUACION_CHEBYSHEV =
  'A(\\Omega) = 10 \\log_{10}\\left[1 + \\varepsilon^2 \\cosh^2\\left(n \\operatorname{arccosh} \\Omega\\right)\\right]';
const FORMULA_ATENUACION_BESSEL =
  'A_n(\\Omega) = 20 \\log_{10}\\left|\\dfrac{\\theta_n(j\\,\\omega_{3\\mathrm{dB}}\\Omega)}{\\theta_n(0)}\\right|';

const FORMULA_OMEGA: Record<TipoFiltro, string> = {
  'pasa-bajos': '\\Omega_s = \\dfrac{f_s}{f_c}',
  'pasa-altos': '\\Omega_s = \\dfrac{f_c}{f_s}',
  'pasa-banda':
    '\\Omega_s = \\dfrac{\\left|f_s/f_0 - f_0/f_s\\right|}{\\mathrm{FBW}},\\; \\mathrm{FBW} = \\dfrac{f_2 - f_1}{f_0}',
  'rechaza-banda':
    '\\Omega_s = \\dfrac{\\mathrm{FBW}}{\\left|f_s/f_0 - f_0/f_s\\right|},\\; \\mathrm{FBW} = \\dfrac{f_2 - f_1}{f_0}',
};

const FORMULA_ORDEN: Record<'butterworth' | 'chebyshev', string> = {
  butterworth: 'n \\ge \\dfrac{\\log_{10}\\left(10^{A_s/10} - 1\\right)}{2 \\log_{10} \\Omega_s}',
  chebyshev:
    'n \\ge \\dfrac{\\operatorname{arccosh}\\sqrt{\\dfrac{10^{A_s/10} - 1}{10^{r/10} - 1}}}{\\operatorname{arccosh} \\Omega_s}',
};

// Las fórmulas del Orden calculado, sin números, para el resultado principal.
const formulasDeOrden = (tipo: TipoFiltro, aproximacion: Aproximacion): string[] =>
  aproximacion === 'bessel'
    ? [FORMULA_OMEGA[tipo], FORMULA_ATENUACION_BESSEL]
    : [
        FORMULA_OMEGA[tipo],
        FORMULA_ORDEN[aproximacion],
        aproximacion === 'butterworth'
          ? FORMULA_ATENUACION_BUTTERWORTH
          : FORMULA_ATENUACION_CHEBYSHEV,
      ];

function pasoAtenuacionReal(
  aproximacion: Aproximacion,
  ripple: number | null,
  n: number,
  omegaS: number,
  atenuacion: number,
): Paso {
  const omega = numeroOInfinito(omegaS);
  const sustituida =
    aproximacion === 'butterworth'
      ? `10 \\log_{10}\\left(1 + ${omega}^{2 \\cdot ${n}}\\right)`
      : aproximacion === 'chebyshev'
        ? `10 \\log_{10}\\left[1 + \\left(10^{${numero(ripple!)}/10} - 1\\right) ` +
          `\\cosh^2\\left(${n} \\operatorname{arccosh}\\left(${omega}\\right)\\right)\\right]`
        : `20 \\log_{10}\\left|\\dfrac{\\theta_{${n}}(j\\,\\omega_{3\\mathrm{dB}}\\Omega_s)}{\\theta_{${n}}(0)}\\right|`;
  return {
    texto: `Atenuación real en fs con Orden ${n}`,
    latex: `A(\\Omega_s) = ${sustituida} = ${dbLatex(atenuacion)}`,
  };
}

// r = R mayor/R menor: con r ≥ r_min Chebyshev admite el Orden par (spec §7.4).
export function ordenDesdeAtenuacion(
  datos: DatosDeOrden,
  { as, fs }: PedidoAtenuacion,
  r = 1,
): ResultadoOrden {
  const { aproximacion, ripple } = datos;
  const omegaS = frecuenciaNormalizada(datos, fs);
  if (!(omegaS > 1)) {
    return {
      estado: 'corte',
      codigo: 'banda-pasante',
      texto:
        `fs = ${formatearValor(fs, 'frecuencia')} cae en la banda pasante del filtro ` +
        `(${ZONA_PASANTE[datos.tipo]}, Ωs = ${numeroTexto(omegaS)} ≤ 1): ahí el filtro no ` +
        'atenúa y ningún Orden alcanza la atenuación pedida. Pedí la atenuación a una frecuencia ' +
        'que ya esté fuera de la banda pasante.',
    };
  }
  const pasos = [pasoOmega(datos, fs, omegaS)];
  if (aproximacion === 'bessel') return ordenBessel(omegaS, as, fs, pasos);

  const { nExacto, n: minimo } = ordenMinimo(aproximacion, omegaS, ripple, as);
  // Chebyshev par se arma solo entre R distintas con r ≥ r_min: si no, el impar siguiente (spec
  // §7.3, §7.4 y §7.6).
  const orden = ordenEfectivo(aproximacion, minimo, ripple, r);
  const porQueSube =
    r === 1
      ? 'con Rs = RL'
      : `con r = ${numeroTexto(r)}, debajo de r_min = ${numeroTexto(relacionMinima(ripple!))},`;
  if (orden > ORDEN_MAXIMO) {
    const pide = Number.isFinite(nExacto) ? `n ≥ ${numeroTexto(nExacto)}` : 'un n enorme';
    const par =
      orden !== minimo ? ` Es par, y ${porQueSube} Chebyshev pasa al Orden ${orden}.` : '';
    return {
      estado: 'corte',
      codigo: 'orden-excedido',
      texto:
        `Alcanzar ${dbTexto(as)} a ${formatearValor(fs, 'frecuencia')} pide ${pide}, más que el ` +
        `máximo de ${ORDEN_MAXIMO}.${par} Con esos datos no se calcula: probá con una atenuación ` +
        'menor, con fs más lejos de la banda pasante o con otra Aproximación.',
    };
  }
  const atenuacionReal = atenuacionPrototipo(aproximacion, orden, omegaS, ripple);
  return {
    estado: 'calculado',
    as,
    fs,
    omegaS,
    nExacto,
    orden,
    atenuacionReal,
    pasos: [
      ...pasos,
      pasoOrdenFormula(aproximacion, ripple, as, omegaS, nExacto),
      {
        texto: `Orden ${minimo}: se redondea hacia arriba`,
        latex: `n = \\lceil ${numero(nExacto)} \\rceil = ${minimo}`,
      },
      ...(minimo !== orden
        ? [
            r === 1
              ? {
                  texto: `Orden ${minimo} es par: con Rs = RL se arma el impar siguiente, Orden ${orden}`,
                  latex: `n = ${minimo} + 1 = ${orden}`,
                  fuente: 'Spec §7.3: Chebyshev par pide una carga de coth²(β/4)·R0.',
                }
              : {
                  texto:
                    `Orden ${minimo} es par y r = ${numeroTexto(r)} no llega a r_min = ` +
                    `${numeroTexto(relacionMinima(ripple!))}: se arma el impar siguiente, Orden ${orden}`,
                  latex: `n = ${minimo} + 1 = ${orden}`,
                  fuente: 'Spec §7.4: Chebyshev par entre R distintas pide r ≥ r_min = coth²(β/4).',
                },
          ]
        : []),
      pasoAtenuacionReal(aproximacion, ripple, orden, omegaS, atenuacionReal),
    ],
  };
}

// Bessel no tiene fórmula cerrada: se evalúa A(Ωs) de n = 1 a 10 y se toma el primero que cumple.
function ordenBessel(omegaS: number, as: number, fs: number, pasos: Paso[]): ResultadoOrden {
  const cumple = (atenuacion: number) => atenuacion >= as - TOLERANCIA_CUMPLE_DB;
  const probados: { n: number; atenuacion: number }[] = [];
  for (let n = 1; n <= ORDEN_MAXIMO; n++) {
    probados.push({ n, atenuacion: atenuacionPrototipo('bessel', n, omegaS, null) });
    if (cumple(probados[n - 1].atenuacion)) break;
  }
  const elegido = probados[probados.length - 1];
  if (!cumple(elegido.atenuacion)) {
    // Cerca del corte la atenuación deja de crecer con n: el máximo no está en n = 10.
    const mejor = probados.reduce((a, b) => (b.atenuacion > a.atenuacion ? b : a));
    return {
      estado: 'corte',
      codigo: 'bessel-sin-solucion',
      texto:
        `${dbTexto(as)} a ${formatearValor(fs, 'frecuencia')} no alcanzable con Bessel de Orden ≤ ` +
        `${ORDEN_MAXIMO}: lo máximo que llega ahí es ${dbTexto(mejor.atenuacion)}, con Orden ` +
        `${mejor.n}. Bessel prioriza el retardo y atenúa poco cerca del corte; probá con ` +
        'Butterworth o Chebyshev.',
    };
  }
  return {
    estado: 'calculado',
    as,
    fs,
    omegaS,
    nExacto: null,
    orden: elegido.n,
    atenuacionReal: elegido.atenuacion,
    pasos: [
      ...pasos,
      {
        texto: 'Bessel no tiene fórmula del Orden: se evalúa A(Ωs) de n = 1 en adelante',
        latex: FORMULA_ATENUACION_BESSEL,
        fuente: FUENTE_BESSEL,
      },
      ...probados.map(({ n, atenuacion }) => ({
        texto: `Bessel de Orden ${n}: ${cumple(atenuacion) ? 'cumple' : 'no llega'}`,
        latex:
          `A_{${n}}(\\Omega_s) = ${dbLatex(atenuacion)} ` +
          `${cumple(atenuacion) ? '\\ge' : '<'} A_s = ${db(as)}`,
      })),
      pasoAtenuacionReal('bessel', null, elegido.n, omegaS, elegido.atenuacion),
    ],
  };
}

// --- Cálculo -------------------------------------------------------------------------------------

const CORTE_INVALIDA =
  `Las frecuencias (fc, o f1 y f2, o f0 y BW), Rs, RL y el Q de las bobinas tienen que ser ` +
  `mayores que cero y f2 mayor que f1; el Orden, un entero de 1 a ${ORDEN_MAXIMO}, o la atenuación ` +
  `pedida y su frecuencia fs, mayores que cero; y el ripple, de ` +
  `${numeroTexto(RANGO_RIPPLE.min)} a ${numeroTexto(RANGO_RIPPLE.max)} dB.`;

const esPositivoFinito = (x: number) => Number.isFinite(x) && x > 0;

function ordenValido(orden: EntradaFiltro['orden']): boolean {
  if (typeof orden === 'number') {
    return Number.isInteger(orden) && orden >= 1 && orden <= ORDEN_MAXIMO;
  }
  return esPositivoFinito(orden.as) && esPositivoFinito(orden.fs);
}

function frecuenciasValidas(entrada: EntradaFiltro): boolean {
  if ('fc' in entrada) return entrada.fc > 0;
  const { banda } = entrada;
  return 'f1' in banda ? banda.f1 > 0 && banda.f2 > banda.f1 : banda.f0 > 0 && banda.bw > 0;
}

const CORTE_BESSEL =
  'Bessel con Rs ≠ RL no se calcula en π ni en T: las fórmulas de Takahasi valen para Butterworth ' +
  'y Chebyshev, y Bessel no tiene una equivalente. Podés pasar a Butterworth, o diseñar con Rs = ' +
  'RL y adaptar después con la Calculadora de redes de adaptación.';

export function calcularFiltro(entrada: EntradaFiltro): ResultadoFiltro {
  const { tipo, aproximacion, ripple, topologia, orden, rs, rl, qBobina } = entrada;
  const rippleValido =
    aproximacion !== 'chebyshev' ||
    (ripple !== null && ripple >= RANGO_RIPPLE.min && ripple <= RANGO_RIPPLE.max);
  if (
    !frecuenciasValidas(entrada) ||
    !(rs > 0 && rl > 0 && qBobina > 0) ||
    !ordenValido(orden) ||
    !rippleValido
  ) {
    return { estado: 'corte', codigo: 'entrada-invalida', texto: CORTE_INVALIDA };
  }
  const r = relacionDe(rs, rl);
  if (aproximacion === 'bessel' && r !== 1) {
    return { estado: 'corte', codigo: 'bessel-terminaciones-distintas', texto: CORTE_BESSEL };
  }

  // El Orden calculado ya sale impar en Chebyshev cuando hace falta: no lleva el aviso de Orden par.
  let ordenCalculado: OrdenCalculado | null = null;
  if (typeof orden !== 'number') {
    const o = ordenDesdeAtenuacion(entrada, orden, r);
    if (o.estado === 'corte') return { estado: 'corte', codigo: o.codigo, texto: o.texto };
    ordenCalculado = o;
  }
  const ordenPedido = typeof orden === 'number' ? orden : null;
  const n = ordenCalculado
    ? ordenCalculado.orden
    : ordenEfectivo(aproximacion, ordenPedido!, ripple, r);
  const avisoOrden =
    ordenPedido !== null && n !== ordenPedido
      ? avisoChebyshevPar(ordenPedido, n, ripple!, r)
      : null;

  const p = prototipo(aproximacion, n, ripple, r);
  const bandaEntrada = 'banda' in entrada ? entrada.banda : null;
  const banda = bandaEntrada && bandaDe(bandaEntrada);
  // fc, o f2: el borde alto de la banda, donde los parásitos del montaje pesan más.
  const frecuenciaRevision = 'fc' in entrada ? entrada.fc : banda!.f2;
  const armada =
    r === 1
      ? escaleraDeTerminacionesIguales(entrada, banda, p)
      : escaleraDeTakahasi(entrada, banda, p, frecuenciaRevision);
  const { elementos, resonadores } = armada.escalera;
  const { terminaciones } = armada;

  const revision = revisarValores(elementos, frecuenciaRevision, {
    sugerencia: tipo === 'rechaza-banda' ? SUGERENCIA_RECHAZA_BANDA : SUGERENCIA_FILTROS,
  });
  const cohn = r === 1 ? perdidaDeCohn(tipo, elementos, p, banda, qBobina) : SIN_COHN;
  const retardo = retardoDe(entrada, p);
  const avisos: Aviso<CodigoAvisoFiltro>[] = [
    ...(terminaciones ? [avisoPerdidaPlana(terminaciones, entrada, p)] : []),
    ...(avisoOrden ? [avisoOrden] : []),
    ...(armada.topologia !== topologia ? [avisoTopologia(armada.topologia, topologia, rs)] : []),
    ...(banda && bandaEntrada && 'f0' in bandaEntrada ? [avisoF0(banda)] : []),
  ];

  return {
    estado: 'calculado',
    tipo,
    aproximacion,
    topologia: armada.topologia,
    topologiaPedida: topologia,
    ordenPedido,
    orden: n,
    ordenCalculado,
    prototipo: p,
    banda,
    frecuenciaRevision,
    elementos,
    resonadores,
    terminaciones,
    perdidaCohn: cohn.perdida,
    retardoContinua: retardo.valor,
    formulas: [
      ...(ordenCalculado ? formulasDeOrden(tipo, aproximacion) : []),
      ...formulasPrototipo(aproximacion, r),
      ...(esDeBanda(tipo) ? formulasBanda(tipo) : formulasEscala(tipo)),
      ...(cohn.formula ? [cohn.formula] : []),
    ],
    pasos: [
      ...(ordenCalculado?.pasos ?? []),
      ...(r === 1 ? [] : [pasoRelacion(rs, rl, r)]),
      ...p.pasos,
      ...(banda && bandaEntrada ? pasosDeBanda(bandaEntrada, banda) : []),
      ...armada.pasos,
      ...cohn.pasos,
      ...retardo.pasos,
      ...revision.pasos,
    ],
    revision,
    referencias: r === 1 ? REFERENCIAS_FILTROS : [...REFERENCIAS_FILTROS, ...REFERENCIAS_TAKAHASI],
    avisos,
    notas: notasDe(tipo, aproximacion, terminaciones, ordenCalculado !== null),
  };
}

function avisoChebyshevPar(
  pedido: number,
  n: number,
  ripple: number,
  r: number,
): Aviso<CodigoAvisoFiltro> {
  if (r === 1) {
    const { carga } = prototipo('chebyshev', pedido, ripple);
    return {
      codigo: 'chebyshev-par',
      texto:
        `Chebyshev de Orden ${pedido} no se puede armar con Rs = RL: pide una carga de ` +
        `${numeroTexto(carga)} veces la fuente. Se calcula con Orden ${n}.`,
    };
  }
  return {
    codigo: 'chebyshev-par',
    texto:
      `Chebyshev de Orden ${pedido} entre Rs y RL distintas pide que la mayor sea al menos ` +
      `r_min = ${numeroTexto(relacionMinima(ripple))} veces la menor con ` +
      `${formatearValor(ripple, 'decibeles')} de ripple, y acá r = ${numeroTexto(r)}. Se calcula ` +
      `con Orden ${n}.`,
  };
}

const avisoTopologia = (
  usada: TopologiaFiltro,
  pedida: TopologiaFiltro,
  rs: number,
): Aviso<CodigoAvisoFiltro> => ({
  codigo: 'topologia-orden-par',
  texto:
    `Con Orden par y Rs ≠ RL solo se puede armar ${usada} desde ` +
    `${formatearValor(rs, 'resistencia')}: el elemento en serie va del lado de la R menor y el de ` +
    `derivación, del de la mayor. Se calcula en ${usada} en lugar de ${pedida}.`,
});

const avisoF0 = (banda: Banda): Aviso<CodigoAvisoFiltro> => ({
  codigo: 'f0-geometrica',
  texto:
    `Con f0 y BW, f0 se toma como la central geométrica √(f1·f2), no como el promedio de ` +
    `f1 y f2: la banda va de ${formatearValor(banda.f1, 'frecuencia')} a ` +
    `${formatearValor(banda.f2, 'frecuencia')}.`,
});

// El aviso obligatorio de spec §7.4, en los cuatro Tipos de filtro. El botón de pase a redes de
// adaptación lo agrega la pantalla.
function avisoPerdidaPlana(
  t: Terminaciones,
  { rs, rl, ripple }: EntradaFiltro,
  p: Prototipo,
): Aviso<CodigoAvisoFiltro> {
  const plana = formatearValor(t.perdidaPlana, 'decibeles');
  const par = p.aproximacion === 'chebyshev' && p.orden % 2 === 0;
  return {
    codigo: 'perdida-plana',
    texto:
      `Este filtro no adapta: tiene una pérdida plana de ${plana}, igual a la desadaptación ` +
      `directa, 4r/(1+r)² = ${numeroTexto(desadaptacionDirecta(t.r))} con r = ` +
      `${numeroTexto(t.r)} (de ${formatearValor(rs, 'resistencia')} a ` +
      `${formatearValor(rl, 'resistencia')}).` +
      (par
        ? ` En Chebyshev de Orden par la banda pasante va de ` +
          `${formatearValor(t.perdidaMinima, 'decibeles')} en los picos del ripple a ${plana}.`
        : '') +
      ' Para filtrar y además adaptar, diseñalo con Rs = RL y adaptá con la Calculadora de redes ' +
      'de adaptación. Una carga balanceada (cinta de 300 Ω, dipolo plegado) necesita además un ' +
      'balun aparte.',
  };
}

function pasoRelacion(rs: number, rl: number, r: number): Paso {
  return {
    texto: 'Relación entre las terminaciones',
    latex:
      `r = \\dfrac{R_{\\max}}{R_{\\min}} = ` +
      `\\dfrac{${ohms(Math.max(rs, rl))}}{${ohms(Math.min(rs, rl))}} = ${numero(r)}`,
    fuente:
      'Spec §7.4: las fórmulas de Takahasi ponen la fuente en la R menor (g0 = 1) y la carga en ' +
      'g(n+1) = r.',
  };
}

export const formulasPrototipo = (aproximacion: Aproximacion, r: number): readonly string[] => {
  if (r !== 1) {
    return aproximacion === 'butterworth'
      ? FORMULAS_TAKAHASI_BUTTERWORTH
      : FORMULAS_TAKAHASI_CHEBYSHEV;
  }
  return aproximacion === 'butterworth'
    ? [FORMULA_BUTTERWORTH]
    : aproximacion === 'bessel'
      ? [FORMULA_BESSEL]
      : FORMULAS_CHEBYSHEV;
};

// El retardo en continua de Bessel, τ0 = factor/ωc (spec §7.3). Solo en pasa bajos: en pasa altos
// no hay retardo en continua, y en pasa banda y rechaza banda el retardo no es el del prototipo.
function retardoDe(
  entrada: EntradaFiltro,
  p: Prototipo,
): { valor: number | null; pasos: Paso[] } {
  if (p.factorRetardo === null || entrada.tipo !== 'pasa-bajos' || !('fc' in entrada)) {
    return { valor: null, pasos: [] };
  }
  const valor = p.factorRetardo / (2 * Math.PI * entrada.fc);
  return {
    valor,
    pasos: [
      {
        texto: 'Retardo en continua de Bessel',
        latex:
          `\\tau_0 = \\dfrac{\\omega_{3\\mathrm{dB}}}{2\\pi f_c} = ` +
          `\\dfrac{${numero(p.factorRetardo)}}{2\\pi \\cdot ${hz(entrada.fc)}} = ` +
          `${numero(valor * 1e9)}\\,\\mathrm{ns}`,
        fuente: FUENTE_BESSEL,
      },
    ],
  };
}

// Los L y C de una escalera, de la fuente a la carga, y la cuenta de cada uno.
interface Escalera {
  elementos: ElementoFiltro[];
  resonadores: ResonadorFiltro[];
  pasos: Paso[];
}

// En pasa banda y rechaza banda, cada g es un resonador.
function armarEscalera(entrada: EntradaFiltro, banda: Banda | null, d: Disposicion): Escalera {
  if ('fc' in entrada) {
    const armados = d.g.map((_, i) => elementoDe(entrada.tipo, d, i + 1, entrada.fc));
    return {
      elementos: armados.map((x) => x.elemento),
      resonadores: [],
      pasos: armados.map((x) => x.paso),
    };
  }
  const armados = d.g.map((_, i) => resonadorDe(entrada.tipo, d, i + 1, banda!));
  const resonadores = armados.map((x) => x.resonador);
  return {
    elementos: resonadores.flatMap((r) => [r.l, r.c]),
    resonadores,
    pasos: armados.flatMap((x) => x.pasos),
  };
}

// La escalera que se muestra, la Topología con la que quedó y los pasos de cómo se armó.
interface Armada {
  escalera: Escalera;
  topologia: TopologiaFiltro;
  terminaciones: Terminaciones | null;
  pasos: Paso[];
}

// Con Rs = RL: g1 … gn desde la fuente, en la Topología pedida, escalados con Rs.
function escaleraDeTerminacionesIguales(
  entrada: EntradaFiltro,
  banda: Banda | null,
  p: Prototipo,
): Armada {
  const escalera = armarEscalera(entrada, banda, {
    topologia: entrada.topologia,
    g: p.g,
    indices: p.g.map((_, i) => i + 1),
    r0: entrada.rs,
  });
  return { escalera, topologia: entrada.topologia, terminaciones: null, pasos: escalera.pasos };
}

const FORMA_VARIANTE: Record<
  VarianteTakahasi,
  { desdeMenor: boolean; dual: boolean; invertida: boolean; texto: string }
> = {
  a: {
    desdeMenor: true,
    dual: false,
    invertida: false,
    texto: 'la de las fórmulas, con g1 en serie junto a la R menor y escalada con ella',
  },
  b: {
    desdeMenor: false,
    dual: true,
    invertida: false,
    texto: 'la dual de la (a), con g1 en derivación junto a la R mayor y escalada con ella',
  },
  c: {
    desdeMenor: false,
    dual: false,
    invertida: true,
    texto:
      'la (a) armada de la carga a la fuente: de gn a g1 desde la R mayor, escalada con la menor',
  },
  d: {
    desdeMenor: true,
    dual: true,
    invertida: true,
    texto:
      'la (b) armada de la carga a la fuente: de gn a g1 desde la R menor, escalada con la mayor',
  },
};

// El primer elemento: en serie en (a), en derivación en (b), y en las invertidas el de gn, que en
// la (a) va en serie si n es impar y en la (b), en derivación.
function topologiaDeVariante(v: VarianteTakahasi, n: number): TopologiaFiltro {
  const impar = n % 2 === 1;
  const enSerie = { a: true, b: false, c: impar, d: !impar }[v];
  return enSerie ? 'T' : 'π';
}

// Una escalera de Takahasi armada, con lo que hace falta para elegir y para los pasos.
interface Candidata extends EscaleraTakahasi {
  escalera: Escalera;
  disposicion: Disposicion;
  // Los extremos de las L y de las C; null si hay menos de dos.
  extremos: Record<'L' | 'C', { max: number; min: number } | null>;
  // El nombre del valor con el peor error del montaje.
  peor: string;
}

function armarVariante(
  entrada: EntradaFiltro,
  banda: Banda | null,
  p: Prototipo,
  variante: VarianteTakahasi,
  frecuenciaRevision: number,
): Candidata {
  const { dual, invertida } = FORMA_VARIANTE[variante];
  const n = p.orden;
  const indices = Array.from({ length: n }, (_, i) => (invertida ? n - i : i + 1));
  const { rs, rl } = entrada;
  const disposicion: Disposicion = {
    topologia: topologiaDeVariante(variante, n),
    g: indices.map((i) => p.g[i - 1]),
    indices,
    r0: dual ? Math.max(rs, rl) : Math.min(rs, rl),
  };
  const escalera = armarEscalera(entrada, banda, disposicion);
  const extremosDe = (componente: 'L' | 'C') => {
    const valores = escalera.elementos
      .filter((e) => e.componente === componente)
      .map((e) => e.valor);
    return valores.length < 2 ? null : { max: Math.max(...valores), min: Math.min(...valores) };
  };
  const extremos = { L: extremosDe('L'), C: extremosDe('C') };
  const cociente = (x: { max: number; min: number } | null) => (x ? x.max / x.min : 1);
  const peor = escalera.elementos
    .map((e) => ({ nombre: e.nombre, error: errorDeMontaje(e, frecuenciaRevision) }))
    .reduce((a, b) => (b.error > a.error ? b : a));
  return {
    variante,
    r0: disposicion.r0,
    elementos: escalera.elementos,
    resonadores: escalera.resonadores,
    dispersion: Math.max(cociente(extremos.L), cociente(extremos.C)),
    peorError: peor.error,
    escalera,
    disposicion,
    extremos,
    peor: peor.nombre,
  };
}

// La de menor dispersión (spec §7.4). Las dos de Orden par empatan siempre, porque por dualidad las
// L de una son las C de la otra: desempata el criterio de valor impracticable (spec §5.6), con la
// que tiene su peor valor menos afectado por el montaje.
const EMPATE = 1e-9;
const empatan = (x: Candidata, y: Candidata) => Math.abs(x.dispersion / y.dispersion - 1) <= EMPATE;
const esMejor = (x: Candidata, y: Candidata) =>
  empatan(x, y) ? x.peorError <= y.peorError : x.dispersion < y.dispersion;

const comoEscalera = ({
  escalera: _escalera,
  disposicion: _disposicion,
  extremos: _extremos,
  peor: _peor,
  ...escalera
}: Candidata): EscaleraTakahasi => escalera;

// Con Rs ≠ RL (spec §7.4): las escaleras de Takahasi del lado de la fuente en la Topología pedida, o
// en la otra si con Orden par la pedida no existe. Con dos, la mejor y la alternativa.
function escaleraDeTakahasi(
  entrada: EntradaFiltro,
  banda: Banda | null,
  p: Prototipo,
  frecuenciaRevision: number,
): Armada {
  const { rs, rl, topologia } = entrada;
  const n = p.orden;
  const delLado = (['a', 'b', 'c', 'd'] as const).filter(
    (v) => FORMA_VARIANTE[v].desdeMenor === rs < rl,
  );
  // Con Orden impar hay una de cada Topología; con par, las dos son de la misma.
  const pedidas = delLado.filter((v) => topologiaDeVariante(v, n) === topologia);
  const candidatas = (pedidas.length > 0 ? pedidas : delLado).map((v) =>
    armarVariante(entrada, banda, p, v, frecuenciaRevision),
  );
  const [elegida, alternativa = null] =
    candidatas.length === 2 && !esMejor(candidatas[0], candidatas[1])
      ? [candidatas[1], candidatas[0]]
      : candidatas;

  const { k } = p.takahasi!;
  const r = relacionDe(rs, rl);
  return {
    escalera: elegida.escalera,
    topologia: elegida.disposicion.topologia,
    terminaciones: {
      ...comoEscalera(elegida),
      r,
      k,
      perdidaPlana: -10 * Math.log10(desadaptacionDirecta(r)),
      perdidaMinima: -10 * Math.log10(k),
      alternativa: alternativa && comoEscalera(alternativa),
    },
    pasos: [
      pasoVariante(elegida, 'Escalera'),
      ...(alternativa
        ? [pasoDispersion(elegida), pasoDispersion(alternativa), pasoEleccion(elegida, alternativa)]
        : []),
      ...elegida.escalera.pasos,
      ...(alternativa
        ? [
            pasoVariante(alternativa, 'Escalera alternativa', ', con la misma respuesta'),
            ...alternativa.escalera.pasos,
          ]
        : []),
    ],
  };
}

function pasoVariante(c: Candidata, titulo: string, agregado = ''): Paso {
  const { dual, texto } = FORMA_VARIANTE[c.variante];
  const orden = c.disposicion.indices.map((i) => `g_{${i}}`).join(', ');
  return {
    texto: `${titulo} (${c.variante})${agregado}: ${texto}`,
    latex:
      `R_0 = R_{${dual ? '\\max' : '\\min'}} = ${ohms(c.r0)},\\; ` +
      `\\text{desde la fuente: } ${orden}`,
    fuente:
      'research/filtros-terminaciones-desiguales.md, §3: las cuatro escaleras, por dualidad e ' +
      'inversión, dan la misma respuesta.',
  };
}

function pasoDispersion(c: Candidata): Paso {
  const cociente = (componente: 'L' | 'C') => {
    const x = c.extremos[componente];
    const simbolo = `\\dfrac{${componente}_{\\max}}{${componente}_{\\min}}`;
    if (!x) return `${simbolo} = 1`;
    const magnitud = componente === 'L' ? 'inductancia' : 'capacidad';
    return (
      `${simbolo} = \\dfrac{${valorLatex(x.max, magnitud)}}{${valorLatex(x.min, magnitud)}} = ` +
      numero(x.max / x.min)
    );
  };
  return {
    texto:
      `Dispersión de la escalera (${c.variante}), D: el mayor de los cocientes entre las L y ` +
      `entre las C. Su peor valor con el montaje es ${c.peor}, con e = ` +
      `${formatearValor(c.peorError * 100, 'porcentaje')} de error`,
    latex: `${cociente('L')},\\; ${cociente('C')}`,
  };
}

function pasoEleccion(elegida: Candidata, alternativa: Candidata): Paso {
  const d = (c: Candidata) => `D_{(${c.variante})} = ${numero(c.dispersion)}`;
  const e = (c: Candidata) => `e_{(${c.variante})} = ${porcentajeLatex(c.peorError)}`;
  const empate = empatan(elegida, alternativa);
  return {
    texto:
      `Se muestra la (${elegida.variante}) y la (${alternativa.variante}) queda como alternativa` +
      (empate
        ? ': la dispersión empata y desempata el peor valor con el montaje'
        : ': tiene menos dispersión'),
    latex: empate
      ? `${d(elegida)} = ${d(alternativa)},\\; ${e(elegida)} \\le ${e(alternativa)}`
      : `${d(elegida)} < ${d(alternativa)}`,
    fuente:
      'Spec §7.4: la de menor dispersión de valores. Con Orden par las dos empatan siempre (por ' +
      'dualidad, las L de una son las C de la otra) y desempata el criterio de valor ' +
      'impracticable (spec §5.6): la que tiene su peor valor menos afectado por el montaje.',
  };
}

interface Cohn {
  perdida: number | null;
  pasos: Paso[];
  formula: string | null;
}

const SIN_COHN: Cohn = { perdida: null, pasos: [], formula: null };

// Estimación de Cohn (Matthaei ec. 4.13-11). Pasa bajos y pasa altos suman las bobinas, con
// Qk = Qu; pasa banda suma todos los g, cada uno un resonador con Qk = FBW·Qu (ec. 4.13-2);
// rechaza banda no la muestra (spec §7.8 y §12.1, P1).
function perdidaDeCohn(
  tipo: TipoFiltro,
  elementos: readonly ElementoFiltro[],
  p: Prototipo,
  banda: Banda | null,
  qu: number,
): Cohn {
  if (tipo === 'rechaza-banda') return SIN_COHN;
  if (tipo === 'pasa-banda') {
    const q = banda!.fbw * qu;
    const perdida = (DB_POR_NEPER * p.g.reduce((s, g) => s + g, 0)) / q;
    return {
      perdida,
      pasos: [pasoCohnBanda(p.g, banda!, qu, perdida)],
      formula: FORMULA_COHN_BANDA,
    };
  }
  const bobinas = elementos.filter((e) => e.componente === 'L');
  const perdida = (DB_POR_NEPER * bobinas.reduce((s, e) => s + e.g, 0)) / qu;
  return { perdida, pasos: [pasoCohn(bobinas, qu, perdida)], formula: FORMULA_COHN };
}

function pasoCohn(bobinas: readonly ElementoFiltro[], qu: number, perdida: number): Paso {
  const fuente =
    'Matthaei, Young y Jones, ec. 4.13-11. Solo pierden las bobinas, con Qk = Qu; los ' +
    'capacitores se toman ideales. Estimación.';
  if (bobinas.length === 0) {
    return {
      texto: 'Pérdida de Cohn: sin bobinas no hay pérdida',
      latex: `\\Delta L_0 = ${db(0)}`,
      fuente,
    };
  }
  const indices = bobinas.map((e) => `g_{${e.indiceG}}`).join(' + ');
  const valores = bobinas.map((e) => numero(e.g)).join(' + ');
  return {
    texto: `Pérdida de Cohn en el centro de la banda pasante, con Qu = ${numeroTexto(qu)}`,
    latex:
      `\\Delta L_0 \\approx 4{,}343 \\cdot \\dfrac{${indices}}{Q_u} = ` +
      `4{,}343 \\cdot \\dfrac{${valores}}{${numero(qu)}} = ${db(perdida)}`,
    fuente,
  };
}

function pasoCohnBanda(g: readonly number[], banda: Banda, qu: number, perdida: number): Paso {
  const indices = g.map((_, i) => `g_{${i + 1}}`).join(' + ');
  const valores = g.map((x) => numero(x)).join(' + ');
  return {
    texto: `Pérdida de Cohn en el centro de la banda, con Qu = ${numeroTexto(qu)}`,
    latex:
      `\\Delta L_0 \\approx 4{,}343 \\cdot \\dfrac{${indices}}{\\mathrm{FBW} \\cdot Q_u} = ` +
      `4{,}343 \\cdot \\dfrac{${valores}}{${numero(banda.fbw)} \\cdot ${numero(qu)}} = ${db(perdida)}`,
    fuente:
      'Matthaei, Young y Jones, ec. 4.13-11 y 4.13-2: cada elemento del prototipo es un resonador ' +
      'con Qk = FBW·Qu. Solo pierden las bobinas; los capacitores se toman ideales. Estimación.',
  };
}

function notasDe(
  tipo: TipoFiltro,
  aproximacion: Aproximacion,
  terminaciones: Terminaciones | null,
  conOrdenCalculado: boolean,
): string[] {
  const borde = aproximacion === 'chebyshev' ? 'los bordes del ripple' : 'los puntos de −3 dB';
  return [
    ...notasDeFrecuencia(tipo, aproximacion, borde),
    terminaciones
      ? 'Con Rs ≠ RL hay varias escaleras con la misma respuesta: los g de Takahasi armados desde ' +
        'la fuente o desde la carga, y escalados con la R menor o con la mayor.'
      : 'π y T dan la misma respuesta con los mismos g: la diferencia es cuántas bobinas llevan.',
    ...(terminaciones && conOrdenCalculado
      ? [
          'Con Rs ≠ RL, la atenuación pedida y la real se cuentan desde la transmisión máxima de ' +
            'la banda pasante: entre Rs y RL hay que sumarles ' +
            `${formatearValor(terminaciones.perdidaMinima, 'decibeles')}.`,
        ]
      : []),
    'Los valores no se redondean a una serie E.',
    ...(terminaciones
      ? [
          'La pérdida de Cohn no se muestra con Rs ≠ RL: la ec. 4.13-11 de Matthaei supone fuente ' +
            'y carga iguales, y con terminaciones distintas cada bobina pesa distinto según de ' +
            'qué lado queda.',
        ]
      : notasDePerdida(tipo)),
    ...(tipo === 'pasa-altos'
      ? [
          'Los valores se revisan en fc, pero un pasa altos trabaja por encima de fc: ahí el ' +
            'desvío por el montaje y las parásitas crece.',
        ]
      : []),
    ...(esDeBanda(tipo)
      ? [
          'Los valores se revisan en f2, el borde alto de la banda: ahí el desvío por el montaje ' +
            'y las parásitas es el mayor.',
        ]
      : []),
  ];
}

function notasDeFrecuencia(tipo: TipoFiltro, aproximacion: Aproximacion, borde: string): string[] {
  if (tipo === 'pasa-banda') {
    return [
      `f1 y f2 son ${borde}, los bordes de la banda pasante; f0 = √(f1·f2) es la central ` +
        'geométrica y BW = f2 − f1.',
    ];
  }
  if (tipo === 'rechaza-banda') {
    return [
      `f1 y f2 son ${borde}, los bordes de la banda rechazada: fuera de ellos el filtro pasa y ` +
        'adentro atenúa. f0 = √(f1·f2) es la central geométrica y BW = f2 − f1.',
    ];
  }
  return [
    aproximacion === 'chebyshev'
      ? 'En Chebyshev, fc es el borde del ripple: ahí la atenuación vale el ripple, no 3 dB.'
      : `En ${aproximacion === 'bessel' ? 'Bessel' : 'Butterworth'}, fc es el punto de −3 dB.` +
        (aproximacion === 'bessel'
          ? ' La tabla de Bessel está normalizada a retardo de 1 s y se renormalizó a −3 dB.'
          : ''),
  ];
}

function notasDePerdida(tipo: TipoFiltro): string[] {
  switch (tipo) {
    case 'pasa-banda':
      return [
        'La pérdida es la estimación de Cohn en el centro de la banda: cada elemento del prototipo ' +
          'es un resonador con Qk = FBW·Qu, solo pierden las bobinas con el Q que ingresaste y los ' +
          'capacitores se toman ideales. Cuanto más angosta la banda, más pierde.',
      ];
    case 'rechaza-banda':
      return [
        'La pérdida de Cohn no se muestra en el rechaza banda: todavía no se investigó cómo se ' +
          'aplica ahí.',
      ];
    default:
      return [
        'La pérdida es la estimación de Cohn en el centro de la banda pasante: solo pierden las ' +
          'bobinas, con el Q que ingresaste; los capacitores se toman ideales.',
      ];
  }
}
