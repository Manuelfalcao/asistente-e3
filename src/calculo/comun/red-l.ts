import { numeroLatex as numero, valorLatex } from './latex';
import type { Paso } from './resultado';

// La red L serie-paralelo de Bowick (spec §9.2), con reactancias con signo: X > 0 es una L y X < 0
// una C. Es la pieza con que se arman la red L y, espalda con espalda, la π y la T.

export const FUENTE_SERIE_A_PARALELO = 'Bowick, RF Circuit Design, ec. 2-7 y 2-8.';

export interface SerieAParalelo {
  q: number;
  rp: number;
  // Con el signo de la reactancia en serie.
  xp: number;
}

// Q = |X_s|/R_s, R_p = R_s·(1 + Q²), X_p = R_p/Q. Vale a una sola frecuencia.
export function serieAParalelo(rs: number, xs: number): SerieAParalelo {
  const q = Math.abs(xs) / rs;
  const rp = rs * (1 + q * q);
  return { q, rp, xp: Math.sign(xs) * (rp / q) };
}

// La L pasa bajos lleva L en serie y C en derivación; la pasa altos, al revés.
export type Filtrado = 'pasa-bajos' | 'pasa-altos';

export interface SeccionL {
  filtrado: Filtrado;
  q: number;
  rMenor: number;
  rMayor: number;
  // El elemento en serie va del lado de la R menor; el de derivación, del lado de la mayor. Son de
  // tipo opuesto.
  xSerie: number;
  xDerivacion: number;
}

export const qDeSeccionL = (rMenor: number, rMayor: number) => Math.sqrt(rMayor / rMenor - 1);

// Bowick ec. 4-1 a 4-3: Q = √(R_mayor/R_menor − 1), X_s = Q·R_menor y X_p = R_mayor/Q.
export function seccionL(rMenor: number, rMayor: number, filtrado: Filtrado): SeccionL {
  const q = qDeSeccionL(rMenor, rMayor);
  const signo = filtrado === 'pasa-bajos' ? 1 : -1;
  return {
    filtrado,
    q,
    rMenor,
    rMayor,
    xSerie: signo * q * rMenor,
    xDerivacion: -signo * (rMayor / q),
  };
}

export function componenteDeReactancia(
  x: number,
  omega: number,
): { componente: 'L' | 'C'; valor: number } {
  return x > 0
    ? { componente: 'L', valor: x / omega }
    : { componente: 'C', valor: -1 / (omega * x) };
}

const ohms = (r: number) => valorLatex(r, 'resistencia');

// Los pasos de una sección, con los símbolos de sus dos resistencias ("R_s", "R_L", "R_v").
export function pasosSeccionL(s: SeccionL, simbolos: { menor: string; mayor: string }): Paso[] {
  const { menor, mayor } = simbolos;
  const p = serieAParalelo(s.rMenor, s.xSerie);
  // El signo de la reactancia en serie y el de la de derivación, para las fórmulas.
  const signo = s.filtrado === 'pasa-bajos' ? '' : '-';
  const opuesto = s.filtrado === 'pasa-bajos' ? '-' : '';
  const tipoSerie = s.xSerie > 0 ? 'una L' : 'una C';
  return [
    {
      texto: 'Q de la sección L',
      latex:
        `Q = \\sqrt{\\dfrac{${mayor}}{${menor}} - 1} = ` +
        `\\sqrt{\\dfrac{${numero(s.rMayor)}}{${numero(s.rMenor)}} - 1} = ${numero(s.q)}`,
      fuente: 'Bowick, RF Circuit Design, ec. 4-1.',
    },
    {
      texto: `Reactancia en serie, del lado de ${menor.replace('_', '')}: ${tipoSerie}`,
      latex: `X_s = ${signo}Q \\cdot ${menor} = ${signo}${numero(s.q)} \\cdot ${numero(s.rMenor)} = ${ohms(s.xSerie)}`,
      fuente: 'Bowick, RF Circuit Design, ec. 4-2.',
    },
    {
      texto: `La rama serie, pasada a paralelo: da ${mayor.replace('_', '')}`,
      latex:
        `R_p = ${menor}\\left(1 + Q^2\\right) = ${numero(s.rMenor)} \\cdot \\left(1 + ${numero(s.q)}^2\\right) = ` +
        `${ohms(p.rp)},\\; X_p' = ${signo}\\dfrac{R_p}{Q} = ` +
        `${signo}\\dfrac{${numero(p.rp)}}{${numero(s.q)}} = ${ohms(p.xp)}`,
      fuente: FUENTE_SERIE_A_PARALELO,
    },
    {
      texto: `Reactancia en derivación, del lado de ${mayor.replace('_', '')}: anula la de la rama serie`,
      latex: `X_p = -X_p' = ${opuesto}\\dfrac{${mayor}}{Q} = ${ohms(s.xDerivacion)}`,
      fuente: 'Bowick, RF Circuit Design, ec. 4-3.',
    },
  ];
}
