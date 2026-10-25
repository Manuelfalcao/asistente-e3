// Series E de valores comerciales (spec §8.3): IEC 60063:2015, con los valores de la tabla de décadas
// de Vishay Dale, documento 31001. Se guardan como tablas y no se generan por fórmula: E6, E12 y E24
// tienen valores históricos que no salen de redondear 10^(i/n) (en E24 son 8, de 2,7 a 8,2). Las
// usan los Arreglos equivalentes y, con valores comerciales, los atenuadores.

export type SerieE = 'E6' | 'E12' | 'E24';

// Una década, de 1 a 10.
export const SERIES_E: Record<SerieE, readonly number[]> = {
  E6: [1.0, 1.5, 2.2, 3.3, 4.7, 6.8],
  E12: [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2],
  E24: [
    1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6,
    6.2, 6.8, 7.5, 8.2, 9.1,
  ],
};

// Los valores de la serie entre min y max (incluidos), en SI y ordenados. Cada uno es el decimal
// exacto de la tabla ("4.7e-12"), sin el error de multiplicar por una potencia de 10.
export function valoresDeSerie(serie: SerieE, min: number, max: number): number[] {
  const desde = Math.floor(Math.log10(min)) - 1;
  const hasta = Math.ceil(Math.log10(max)) + 1;
  const valores: number[] = [];
  for (let exponente = desde; exponente <= hasta; exponente++) {
    for (const mantisa of SERIES_E[serie]) {
      const v = Number(`${mantisa}e${exponente}`);
      if (v >= min * (1 - 1e-12) && v <= max * (1 + 1e-12)) valores.push(v);
    }
  }
  return valores;
}
