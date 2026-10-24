import { describe, expect, it } from 'vitest';
import {
  atenuacionDb,
  c,
  cascada,
  derivacion,
  derivacionR,
  modulo,
  perdidaDeRetornoDb,
  potenciaPorElemento,
  s21Cuadrado,
  serie,
  zEntrada,
  zSalida,
} from './abcd';

// El oráculo contra resultados que se saben sin él: líneas de transferencia triviales, un divisor
// resistivo y los casos A16 y A17 de research/formulas-atenuadores.md, calculados aparte.

describe('oráculo ABCD', () => {
  it('sin elementos, la red es un cable: sin pérdida y Zin = R_L', () => {
    const m = cascada([]);
    expect(s21Cuadrado(m, 50, 50)).toBeCloseTo(1, 12);
    expect(zEntrada(m, 75).re).toBeCloseTo(75, 12);
  });

  it('una R en serie entre cargas iguales: |S21|² = 4·Rs·RL / (Rs + R + RL)²', () => {
    const m = cascada([serie(100)]);
    expect(s21Cuadrado(m, 50, 50)).toBeCloseTo((4 * 50 * 50) / 200 ** 2, 12);
    expect(zEntrada(m, 50).re).toBeCloseTo(150, 12);
  });

  it('una R en derivación: Zin es el paralelo con la carga', () => {
    const m = cascada([derivacionR(100)]);
    expect(zEntrada(m, 100).re).toBeCloseTo(50, 12);
  });

  it('un elemento reactivo: Zin de una L en serie con la carga es R_L + jωL', () => {
    const m = cascada([serie(c(0, 30))]);
    const z = zEntrada(m, 50);
    expect(z.re).toBeCloseTo(50, 12);
    expect(z.im).toBeCloseTo(30, 12);
    // Reactancia pura: |S21|² = 4·50·50 / (100² + 30²)
    expect(s21Cuadrado(m, 50, 50)).toBeCloseTo(10000 / (10000 + 900), 12);
  });

  it('un capacitor en derivación pasa a ser admitancia pura', () => {
    const m = cascada([derivacion(c(0, 0.01))]);
    const z = zEntrada(m, 100);
    // 1 / (1/100 + j0,01) = 50 − j50
    expect(z.re).toBeCloseTo(50, 12);
    expect(z.im).toBeCloseTo(-50, 12);
  });

  it('Zout mira desde la carga: una R en serie suma a R_s', () => {
    expect(zSalida(cascada([serie(25)]), 50).re).toBeCloseTo(75, 12);
    expect(zSalida(cascada([derivacionR(100)]), 100).re).toBeCloseTo(50, 12);
  });

  it('A16: T de 27 / 36 / 27 Ω da 10,067 dB y PR 36,4 dB', () => {
    const m = cascada([serie(27), derivacionR(36), serie(27)]);
    expect(atenuacionDb(m, 50, 50)).toBeCloseTo(10.067, 3);
    expect(perdidaDeRetornoDb(zEntrada(m, 50), 50)).toBeCloseTo(36.4, 1);
  });

  it('A17: π de 95,3 / 71,5 / 95,3 Ω da 10,067 dB y PR 53,8 dB', () => {
    const m = cascada([derivacionR(95.3), serie(71.5), derivacionR(95.3)]);
    expect(atenuacionDb(m, 50, 50)).toBeCloseTo(10.067, 3);
    expect(perdidaDeRetornoDb(zEntrada(m, 50), 50)).toBeCloseTo(53.8, 1);
  });

  it('un pad adaptado disipa lo que no llega a la carga', () => {
    // T de 10 dB de 50 Ω (A4 de la investigación)
    const t = [serie(25.9747), derivacionR(35.1364), serie(25.9747)];
    const p = potenciaPorElemento(t, 50, 1);
    expect(p[0]).toBeCloseTo(0.5195, 4);
    expect(p[1]).toBeCloseTo(0.3286, 4);
    expect(p[2]).toBeCloseTo(0.0519, 4);
    const sobraEnLaCarga = 1 / 10;
    expect(p.reduce((a, b) => a + b, 0) + sobraEnLaCarga).toBeCloseTo(1, 4);
  });

  it('el módulo de Zin de una red adaptada es el de R_s', () => {
    const m = cascada([serie(25.9747), derivacionR(35.1364), serie(25.9747)]);
    expect(modulo(zEntrada(m, 50))).toBeCloseTo(50, 3);
  });
});
