import type {
  Aproximacion,
  ElementoFiltro,
  ResonadorFiltro,
  TipoBajoAlto,
} from '../../../src/calculo/filtros/filtros';
import {
  type Complejo,
  type Elemento,
  atenuacionDb,
  c,
  cascada,
  derivacion,
  serie,
  zEntrada,
} from '../../oraculos/abcd';

// La escalera que arma el cálculo de filtros, pasada al oráculo ABCD. Es el único lugar donde los
// tests conocen la forma del resultado; el oráculo no sabe nada de él.

// Un L o C a la frecuencia f, ideal.
function elemento(e: ElementoFiltro, f: number): Elemento {
  const omega = 2 * Math.PI * f;
  const z = e.componente === 'L' ? c(0, omega * e.valor) : c(0, -1 / (omega * e.valor));
  return e.posicion === 'serie' ? serie(z) : derivacion(c(0, -1 / z.im));
}

// La atenuación de transductor de la escalera ideal entre Rs y RL (por defecto iguales), en dB.
export function atenuacionOraculo(
  elementos: readonly ElementoFiltro[],
  f: number,
  rs: number,
  rl = rs,
) {
  return atenuacionDb(cascada(elementos.map((e) => elemento(e, f))), rs, rl);
}

// La pérdida con el modelo de Matthaei (Sec. 4.13), dk = 1/Qu en cada bobina y transformado al
// circuito real: en pasa bajos una R de ωc·L/Qu en serie con cada L, vista en continua (fc·10⁻⁶);
// en pasa altos una R de Qu·ωc·L en paralelo con cada L, vista muy por encima de fc (fc·10⁶).
export function perdidaSimulada(
  elementos: readonly ElementoFiltro[],
  tipo: TipoBajoAlto,
  fc: number,
  r0: number,
  qu: number,
): number {
  const omegaC = 2 * Math.PI * fc;
  const f = tipo === 'pasa-bajos' ? fc * 1e-6 : fc * 1e6;
  const omega = 2 * Math.PI * f;
  // En pasa bajos las bobinas van todas en serie; en pasa altos, todas en derivación.
  const escalera = elementos.map((e): Elemento => {
    if (e.componente === 'C') return elemento(e, f);
    const l = e.valor;
    return tipo === 'pasa-bajos'
      ? serie(c((omegaC * l) / qu, omega * l))
      : derivacion(c(1 / (qu * omegaC * l), -1 / (omega * l)));
  });
  return atenuacionDb(cascada(escalera), r0, r0);
}

// La atenuación de la Aproximación en la frecuencia normalizada Ω (Matthaei ec. 4.03-1 y 4.03-3).
export function atenuacionTeorica(
  aproximacion: Aproximacion,
  n: number,
  omega: number,
  ripple: number | null,
): number {
  // Bessel no tiene fórmula cerrada simple; en su fc, por construcción, la atenuación es 3,01 dB.
  if (aproximacion === 'bessel') {
    if (omega !== 1) throw new Error('Bessel: la atenuación teórica solo se da en Ω = 1');
    return 10 * Math.log10(2);
  }
  if (aproximacion === 'butterworth') return 10 * Math.log10(1 + omega ** (2 * n));
  const eps2 = 10 ** (ripple! / 10) - 1;
  const t = omega <= 1 ? Math.cos(n * Math.acos(omega)) : Math.cosh(n * Math.acosh(omega));
  return 10 * Math.log10(1 + eps2 * t * t);
}

// 1/(a + jb)
const inverso = (re: number, im: number): Complejo => {
  const d = re * re + im * im;
  return c(re / d, -im / d);
};

// Un resonador a la frecuencia f, en su rama. La L puede traer una R en serie (la pérdida de la
// bobina); la C es ideal. Un LC serie en derivación o un LC paralelo en serie se arman como
// admitancia o impedancia del resonador.
function resonador(r: ResonadorFiltro, f: number, rBobina = 0): Elemento {
  const omega = 2 * Math.PI * f;
  const xL = omega * r.l.valor;
  const xC = -1 / (omega * r.c.valor);
  if (r.conexion === 'serie') {
    const z = c(rBobina, xL + xC);
    return r.posicion === 'serie' ? serie(z) : derivacion(inverso(z.re, z.im));
  }
  // La rama de L (con su R) en paralelo con la de C.
  const yL = inverso(rBobina, xL);
  const y = c(yL.re, yL.im + omega * r.c.valor);
  return r.posicion === 'derivacion' ? derivacion(y) : serie(inverso(y.re, y.im));
}

// La atenuación de transductor de la escalera de resonadores, ideal, entre Rs y RL (por defecto
// iguales), en dB.
export function atenuacionResonadores(
  resonadores: readonly ResonadorFiltro[],
  f: number,
  rs: number,
  rl = rs,
): number {
  return atenuacionDb(cascada(resonadores.map((r) => resonador(r, f))), rs, rl);
}

// La atenuación entre Rs y RL de una escalera del resultado, de L y C sueltos o de resonadores.
export function atenuacionEntre(
  escalera: { elementos: readonly ElementoFiltro[]; resonadores: readonly ResonadorFiltro[] },
  f: number,
  rs: number,
  rl: number,
): number {
  return escalera.resonadores.length > 0
    ? atenuacionResonadores(escalera.resonadores, f, rs, rl)
    : atenuacionOraculo(escalera.elementos, f, rs, rl);
}

// --- Resonadores acoplados -----------------------------------------------------------------------

// Lo que el oráculo necesita de un filtro de resonadores acoplados: la L, los Capacitores de extremo,
// de acople y de sintonía, y la Frecuencia de sintonía para la pérdida de las bobinas.
interface Acoplado {
  inductancia: { valor: number };
  sintonia: { f0: number };
  extremos: readonly { capacitor: { valor: number } }[];
  acoples: readonly { capacitor: { valor: number } }[];
  sintonias: readonly { capacitor: { valor: number } }[];
}

// Un divisor capacitivo en un extremo: Ca del resonador a la toma y Cb de la toma a masa, con la R en
// la toma. El resonador de ese extremo no lleva Capacitor de sintonía.
export interface DivisorOraculo {
  ca: number;
  cb: number;
}

// La red completa a la frecuencia f, de la fuente a la carga: el Capacitor de extremo en serie (o
// el divisor), cada resonador LC paralelo en derivación y los Capacitores de acople en serie. Con
// Qu, una R en paralelo de Qu·ω0·L en cada bobina (spec §5.7).
export function redAcoplada(
  r: Acoplado,
  f: number,
  {
    qu = null,
    divisores = null,
  }: { qu?: number | null; divisores?: readonly DivisorOraculo[] | null } = {},
): Elemento[] {
  const omega = 2 * Math.PI * f;
  const l = r.inductancia.valor;
  const enSerie = (cap: number) => serie(c(0, -1 / (omega * cap)));
  const aMasa = (cap: number) => derivacion(c(0, omega * cap));
  const perdida = qu === null ? 0 : 1 / (qu * 2 * Math.PI * r.sintonia.f0 * l);
  const n = r.sintonias.length;
  const resonador = (k: number) => {
    const cap = divisores && (k === 0 || k === n - 1) ? 0 : r.sintonias[k].capacitor.valor;
    return derivacion(c(perdida, omega * cap - 1 / (omega * l)));
  };
  const red: Elemento[] = divisores
    ? [aMasa(divisores[0].cb), enSerie(divisores[0].ca)]
    : [enSerie(r.extremos[0].capacitor.valor)];
  for (let k = 0; k < n; k++) {
    red.push(resonador(k));
    if (k < n - 1) red.push(enSerie(r.acoples[k].capacitor.valor));
  }
  red.push(
    ...(divisores
      ? [enSerie(divisores[1].ca), aMasa(divisores[1].cb)]
      : [enSerie(r.extremos[1].capacitor.valor)]),
  );
  return red;
}

export const atenuacionAcoplada = (
  r: Acoplado,
  f: number,
  rs: number,
  rl: number,
  opciones?: Parameters<typeof redAcoplada>[2],
) => atenuacionDb(cascada(redAcoplada(r, f, opciones)), rs, rl);

export const entradaAcoplada = (
  r: Acoplado,
  f: number,
  rl: number,
  divisores: readonly DivisorOraculo[] | null = null,
) => zEntrada(cascada(redAcoplada(r, f, { divisores })), rl);

// El borde de la banda pasante: el cruce más externo del umbral (−3,01 dB o el ripple), buscado desde
// `afuera`, donde atenúa más, hacia `adentro`, y refinado por bisección. Desde afuera, para no
// quedarse en un pico del ripple que pase apenas del umbral.
export function bordeSimulado(
  atenuacion: (f: number) => number,
  afuera: number,
  adentro: number,
  umbral: number,
): number {
  const pasos = 4000;
  let [lejos, cerca] = [afuera, adentro];
  for (let i = 1; i <= pasos; i++) {
    const f = afuera + ((adentro - afuera) * i) / pasos;
    if (atenuacion(f) <= umbral) {
      cerca = f;
      break;
    }
    lejos = f;
  }
  for (let i = 0; i < 200; i++) {
    const medio = (lejos + cerca) / 2;
    if (medio === lejos || medio === cerca) break;
    if (atenuacion(medio) <= umbral) cerca = medio;
    else lejos = medio;
  }
  return (lejos + cerca) / 2;
}

// La pérdida en el centro de la banda del pasa banda con la pérdida de cada bobina: una R en serie
// de ω0·L/Qu a ω0, que es el Q constante del modelo de Matthaei (Sec. 4.13).
export function perdidaSimuladaBanda(
  resonadores: readonly ResonadorFiltro[],
  f0: number,
  r0: number,
  qu: number,
): number {
  const omega0 = 2 * Math.PI * f0;
  const escalera = resonadores.map((r) => resonador(r, f0, (omega0 * r.l.valor) / qu));
  return atenuacionDb(cascada(escalera), r0, r0);
}
