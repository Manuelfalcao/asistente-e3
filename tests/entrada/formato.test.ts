import { describe, expect, it } from 'vitest';
import type { Magnitud } from '../../src/entrada/campos';
import {
  formatearDbm,
  formatearErrorRelativo,
  formatearValor,
  type Nivel,
} from '../../src/entrada/formato';

// Casos de comportamiento del formato de salida (spec §5.2).
const CASOS: readonly [valor: number, magnitud: Magnitud, esperado: string, nivel?: Nivel][] = [
  [4.7e-9, 'inductancia', '4,7 nH'],
  [4.7e-6, 'inductancia', '4,7 µH'],
  [0.0123, 'inductancia', '12,3 mH'],
  [1.23456e-9, 'inductancia', '1,23 nH'],
  [1.23456e-9, 'inductancia', '1,235 nH', 'paso'],
  [87.4e-12, 'capacidad', '87,4 pF'],
  [2.2e-12, 'capacidad', '2,2 pF'],
  [1e-9, 'capacidad', '1 nF'],
  [0.5e-12, 'capacidad', '0,5 pF'],
  [1200, 'resistencia', '1,2 kΩ'],
  [47, 'resistencia', '47 Ω'],
  [0.47, 'resistencia', '0,47 Ω'],
  [1.5e6, 'resistencia', '1,5 MΩ'],
  [145e6, 'frecuencia', '145 MHz'],
  [500e3, 'frecuencia', '500 kHz'],
  [1.2e9, 'frecuencia', '1,2 GHz'],
  [5e-3, 'potencia', '5 mW'],
  [50, 'potencia', '50 W'],
  [0.8e-3, 'largo', '0,8 mm'],
  [30.5, 'decibeles', '30,5 dB'],
  [20, 'decibeles', '20 dB'],
  [0.1, 'decibeles', '0,1 dB'],
  [5.7235, 'decibeles', '5,72 dB'],
  [4.74, 'porcentaje', '4,7 %'],
  [0.346, 'porcentaje', '0,35 %'],
  [100, 'porcentaje', '100 %'],
  [12.46, 'numero', '12,5'],
  [5, 'entero', '5'],
  [0, 'inductancia', '0 H'],
];

describe('formato de salida', () => {
  for (const [valor, magnitud, esperado, nivel] of CASOS) {
    it(`${valor} (${magnitud}${nivel ? `, ${nivel}` : ''}) → «${esperado}»`, () => {
      expect(formatearValor(valor, magnitud, nivel)).toBe(esperado);
    });
  }

  it('un redondeo que llega a 1000 pasa al prefijo de arriba', () => {
    expect(formatearValor(999.7e-9, 'inductancia')).toBe('1 µH');
    expect(formatearValor(999.4e-9, 'inductancia')).toBe('999 nH');
  });

  it('usa solo los prefijos que la Entrada flexible lee en esa magnitud', () => {
    expect(formatearValor(2e-3, 'capacidad')).toBe('2000 µF');
    expect(formatearValor(2500, 'inductancia')).toBe('2500 H');
  });

  it('los errores relativos llevan signo y el menos tipográfico', () => {
    expect(formatearErrorRelativo(4.74)).toBe('+4,7 %');
    expect(formatearErrorRelativo(-1.234)).toBe('−1,2 %');
    expect(formatearErrorRelativo(0)).toBe('0 %');
    expect(formatearErrorRelativo(-0.0001)).toBe('−0,0001 %');
  });

  it('los negativos usan el menos tipográfico', () => {
    expect(formatearDbm(-3)).toBe('−3 dBm');
    expect(formatearDbm(10)).toBe('10 dBm');
    expect(formatearDbm(-0.004)).toBe('0 dBm');
    expect(formatearValor(-0.5, 'decibeles')).toBe('−0,5 dB');
  });
});
