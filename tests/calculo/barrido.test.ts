import { describe, expect, it } from 'vitest';
import {
  BARRIDO,
  type RedBarrido,
  atenuacionDb,
  bordesMenos3dB,
  respuesta,
} from '../../src/calculo/comun/barrido';

// El barrido común (spec §5.7) contra resultados que se saben sin él. La comparación contra el
// oráculo ABCD está con los casos de verificación de redes de adaptación.

const R = 50;

describe('respuesta de una red en escalera', () => {
  it('sin elementos es un cable: sin pérdida con R_s = R_L y Zin = R_L', () => {
    const r = respuesta({ rs: 50, rl: 50, elementos: [] }, 100e6);
    expect(r.s21Cuadrado).toBeCloseTo(1, 14);
    expect(r.zEntrada.re).toBeCloseTo(50, 12);
    expect(r.zEntrada.im).toBeCloseTo(0, 12);
  });

  it('sin red entre R_s y R_L distintas transfiere 4·R_s·R_L/(R_s + R_L)²', () => {
    const r = respuesta({ rs: 50, rl: 200, elementos: [] }, 1e6);
    expect(r.s21Cuadrado).toBeCloseTo((4 * 50 * 200) / 250 ** 2, 14);
  });

  it('una L en serie vale R_L + jωL a la entrada', () => {
    const f = 10e6;
    const l = 1e-6;
    const r = respuesta(
      { rs: R, rl: R, elementos: [{ componente: 'L', posicion: 'serie', valor: l }] },
      f,
    );
    expect(r.zEntrada.re).toBeCloseTo(R, 12);
    expect(r.zEntrada.im).toBeCloseTo(2 * Math.PI * f * l, 9);
  });

  it('la R de pérdida en serie con la L suma a la parte real', () => {
    const r = respuesta(
      {
        rs: R,
        rl: R,
        elementos: [{ componente: 'L', posicion: 'serie', valor: 1e-6, rSerie: 2 }],
      },
      10e6,
    );
    expect(r.zEntrada.re).toBeCloseTo(R + 2, 12);
  });

  it('una C en derivación: Zin es R_L en paralelo con 1/(jωC)', () => {
    const f = 1e6;
    const c = 1 / (2 * Math.PI * f * 100); // X = −100 Ω
    const r = respuesta(
      { rs: 100, rl: 100, elementos: [{ componente: 'C', posicion: 'derivacion', valor: c }] },
      f,
    );
    // 100 || −j100 = 50 − j50
    expect(r.zEntrada.re).toBeCloseTo(50, 9);
    expect(r.zEntrada.im).toBeCloseTo(-50, 9);
  });

  it('una L en serie vale R_s + jωL vista desde la carga', () => {
    const f = 10e6;
    const l = 1e-6;
    const r = respuesta(
      { rs: 75, rl: R, elementos: [{ componente: 'L', posicion: 'serie', valor: l }] },
      f,
    );
    expect(r.zSalida.re).toBeCloseTo(75, 12);
    expect(r.zSalida.im).toBeCloseTo(2 * Math.PI * f * l, 9);
  });

  it('una R en derivación vale R_s en paralelo con ella vista desde la carga', () => {
    const r = respuesta(
      { rs: 50, rl: 200, elementos: [{ componente: 'R', posicion: 'derivacion', valor: 50 }] },
      1e6,
    );
    expect(r.zSalida.re).toBeCloseTo(25, 12);
    expect(r.zSalida.im).toBeCloseTo(0, 12);
  });

  it('la atenuación es −10·log10 |S21|²', () => {
    const red: RedBarrido = {
      rs: 50,
      rl: 50,
      elementos: [{ componente: 'R', posicion: 'serie', valor: 100 }],
    };
    // |S21|² = 4·50·50 / 200² = 1/4
    expect(atenuacionDb(red, 1e6)).toBeCloseTo(10 * Math.log10(4), 12);
  });
});

// Una sola reactancia X en serie entre R iguales: |S21|² = 1/(1 + (X/2R)²). La mitad de la de f₀
// cae donde (X/2R)² = 1 + 2·(X₀/2R)².
const cruce = (x0SobreDosR: number) => Math.sqrt(1 + 2 * x0SobreDosR ** 2);

describe('bordes a −3 dB, desde la ganancia en f₀', () => {
  it('una L en serie entre R iguales corta arriba, sin borde inferior', () => {
    const l = 100e-9;
    const red: RedBarrido = {
      rs: R,
      rl: R,
      elementos: [{ componente: 'L', posicion: 'serie', valor: l }],
    };
    // en f₀, X/2R = 0,5
    const f0 = (0.5 * 2 * R) / (2 * Math.PI * l);
    const corte = (f0 * cruce(0.5)) / 0.5;
    const b = bordesMenos3dB(red, f0);
    expect(b.fInf).toBeNull();
    expect(Math.abs(b.fSup! / corte - 1)).toBeLessThan(1e-12);
  });

  it('una C en serie corta abajo, sin borde superior', () => {
    const c = 10e-12;
    const red: RedBarrido = {
      rs: R,
      rl: R,
      elementos: [{ componente: 'C', posicion: 'serie', valor: c }],
    };
    // en f₀, |X|/2R = 1/3
    const f0 = 3 / (2 * Math.PI * c * 2 * R);
    const corte = f0 / (3 * cruce(1 / 3));
    const b = bordesMenos3dB(red, f0);
    expect(b.fSup).toBeNull();
    expect(Math.abs(b.fInf! / corte - 1)).toBeLessThan(1e-12);
  });

  it('un borde fuera del rango barrido no se informa', () => {
    const l = 100e-9;
    const red: RedBarrido = {
      rs: R,
      rl: R,
      elementos: [{ componente: 'L', posicion: 'serie', valor: l }],
    };
    const corte = (2 * R) / (2 * Math.PI * l);
    // f₀ tan abajo que 50·f₀ no llega al corte
    const b = bordesMenos3dB(red, corte / (BARRIDO.hasta * 1.01));
    expect(b.fSup).toBeNull();
  });

  it('el rango es de f₀/50 a 50·f₀, con unos cientos de puntos por década', () => {
    expect(BARRIDO.desde).toBe(1 / 50);
    expect(BARRIDO.hasta).toBe(50);
    expect(BARRIDO.puntosPorDecada).toBeGreaterThanOrEqual(100);
  });
});
