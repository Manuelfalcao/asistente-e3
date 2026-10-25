import type { ElementoBarrido } from '../../../src/calculo/comun/barrido';
import type { VarianteL } from '../../../src/calculo/redes/redes';
import {
  type Complejo,
  type Elemento,
  c,
  cascada,
  derivacion,
  modulo,
  s21Cuadrado,
  serie,
  zEntrada,
} from '../../oraculos/abcd';

// Lo que arma el cálculo de redes de adaptación, pasado al oráculo ABCD, y la segunda vía del ancho
// de banda: el cruce de |Γ| = 1/√2. Es el único lugar donde los tests conocen la forma del
// resultado; el oráculo no sabe nada de él.

// Un L, C o R de la escalera a la frecuencia f, como elemento del oráculo.
export function elementoOraculo(e: ElementoBarrido, f: number): Elemento {
  const omega = 2 * Math.PI * f;
  const z: Complejo =
    e.componente === 'L'
      ? c(e.rSerie ?? 0, omega * e.valor)
      : e.componente === 'C'
        ? c(0, -1 / (omega * e.valor))
        : c(e.valor);
  if (e.posicion === 'serie') return serie(z);
  const d = z.re * z.re + z.im * z.im;
  return derivacion(c(z.re / d, -z.im / d));
}

export const escaleraDeVariante = (v: VarianteL, f: number): Elemento[] =>
  v.componentes.map((x) => elementoOraculo(x, f));

// Con los valores calculados, en f₀ y con R_L conectada.
export function zEntradaOraculo(v: VarianteL, f: number, rl: number): Complejo {
  return zEntrada(cascada(escaleraDeVariante(v, f)), rl);
}

export function s21Oraculo(
  elementos: readonly ElementoBarrido[],
  f: number,
  rs: number,
  rl: number,
) {
  return s21Cuadrado(cascada(elementos.map((e) => elementoOraculo(e, f))), rs, rl);
}

// |Γ| a la entrada contra R_s.
function gamma(v: VarianteL, f: number, rs: number, rl: number): number {
  const z = zEntradaOraculo(v, f, rl);
  return modulo(c(z.re - rs, z.im)) / modulo(c(z.re + rs, z.im));
}

// El primer cruce de |Γ| = 1/√2 desde f₀ hacia `hasta` (f₀/50 o 50·f₀): un paso fijo de 1/1000 de
// década y después bisección. Null si no cruza.
export function cruceDeGamma(
  v: VarianteL,
  f0: number,
  rs: number,
  rl: number,
  hasta: number,
): number | null {
  const umbral = Math.SQRT1_2;
  const sube = hasta > 1;
  const pasos = Math.round(Math.abs(Math.log10(hasta)) * 1000);
  let adentro = f0;
  for (let i = 1; i <= pasos; i++) {
    const f = f0 * 10 ** ((sube ? i : -i) / 1000);
    if (gamma(v, f, rs, rl) > umbral) {
      let afuera = f;
      for (let k = 0; k < 200 && Math.abs(afuera - adentro) > 1e-15 * f; k++) {
        const medio = (adentro + afuera) / 2;
        if (gamma(v, medio, rs, rl) > umbral) afuera = medio;
        else adentro = medio;
      }
      return (adentro + afuera) / 2;
    }
    adentro = f;
  }
  return null;
}
