import type {
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
} from '../../oraculos/abcd';

// La escalera que arma el cálculo de filtros, pasada al oráculo ABCD. Es el único lugar donde los
// tests conocen la forma del resultado; el oráculo no sabe nada de él.

// Un L o C a la frecuencia f, ideal.
function elemento(e: ElementoFiltro, f: number): Elemento {
  const omega = 2 * Math.PI * f;
  const z = e.componente === 'L' ? c(0, omega * e.valor) : c(0, -1 / (omega * e.valor));
  return e.posicion === 'serie' ? serie(z) : derivacion(c(0, -1 / z.im));
}

// La atenuación de transductor de la escalera ideal entre R0 y R0, en dB.
export function atenuacionOraculo(elementos: readonly ElementoFiltro[], f: number, r0: number) {
  return atenuacionDb(cascada(elementos.map((e) => elemento(e, f))), r0, r0);
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
  aproximacion: 'butterworth' | 'chebyshev',
  n: number,
  omega: number,
  ripple: number | null,
): number {
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

// La atenuación de transductor de la escalera de resonadores, ideal, entre R0 y R0, en dB.
export function atenuacionResonadores(
  resonadores: readonly ResonadorFiltro[],
  f: number,
  r0: number,
): number {
  return atenuacionDb(cascada(resonadores.map((r) => resonador(r, f))), r0, r0);
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
