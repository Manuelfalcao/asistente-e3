import type { ElementoFiltro, TipoFiltro } from '../../../src/calculo/filtros/filtros';
import { type Elemento, atenuacionDb, c, cascada, derivacion, serie } from '../../oraculos/abcd';

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
  tipo: TipoFiltro,
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
