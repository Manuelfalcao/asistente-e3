import { describe, expect, it } from 'vitest';
import { SERIES_E, valoresDeSerie } from '../../src/calculo/comun/series-e';
import {
  CASOS_SERIES,
  CASO_EXCEPCIONES_E24,
  excepcionesE24,
  serieGuardada,
} from './arreglos/casos';

// Casos de referencia de las series E (spec §8.3 y §13.3): las tablas guardadas contra IEC 60063,
// transcriptas de Vishay 31001, y los valores históricos que no salen de la fórmula 10^(i/n).

describe('series E contra IEC 60063 (Vishay 31001)', () => {
  for (const caso of CASOS_SERIES) {
    it(caso.id, () => {
      expect(serieGuardada(caso.serie)).toEqual(caso.esperado);
    });
  }

  it(`${CASO_EXCEPCIONES_E24.id}: redondeada a 2 cifras`, () => {
    expect(excepcionesE24()).toEqual(CASO_EXCEPCIONES_E24.esperado);
  });

  it('E6 está en E12, y E12 en E24', () => {
    expect(SERIES_E.E6.every((m) => SERIES_E.E12.includes(m))).toBe(true);
    expect(SERIES_E.E12.every((m) => SERIES_E.E24.includes(m))).toBe(true);
  });
});

describe('valores de una serie en un rango', () => {
  it('E12 de 1 pF a 10 nF son 49 valores, con los extremos', () => {
    const v = valoresDeSerie('E12', 1e-12, 10e-9);
    expect(v).toHaveLength(49);
    expect(v[0]).toBe(1e-12);
    expect(v[1]).toBe(1.2e-12);
    expect(v.at(-1)).toBe(1e-8);
  });

  it('E12 de 1 Ω a 10 MΩ son 85 valores; E24 de 1 pF a 10 nF, 97', () => {
    expect(valoresDeSerie('E12', 1, 10e6)).toHaveLength(85);
    expect(valoresDeSerie('E24', 1e-12, 10e-9)).toHaveLength(97);
  });

  it('cada valor es el número decimal exacto de la tabla: 4,7 pF es 4.7e-12', () => {
    const v = valoresDeSerie('E12', 1e-12, 100e-12);
    expect(v).toContain(4.7e-12);
    expect(v).toContain(82e-12);
    expect(v).toContain(3.9e-11);
  });
});
