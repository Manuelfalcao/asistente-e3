import { describe, expect, it } from 'vitest';
import {
  componenteDeReactancia,
  pasosSeccionL,
  qDeSeccionL,
  seccionL,
  serieAParalelo,
} from '../../src/calculo/comun/red-l';

// La red L serie-paralelo común (spec §9.2), con reactancias con signo. Los números de Bowick 4-1
// (100 Ω a 1000 Ω) están en research/redes-adaptacion.md, §8.

describe('serie a paralelo (Bowick ec. 2-7 y 2-8)', () => {
  it('100 Ω con +300 Ω en serie es 1000 Ω con +333,3 Ω en paralelo, Q = 3', () => {
    const p = serieAParalelo(100, 300);
    expect(p.q).toBeCloseTo(3, 14);
    expect(p.rp).toBeCloseTo(1000, 10);
    expect(p.xp).toBeCloseTo(1000 / 3, 10);
  });

  it('conserva el signo: una C en serie sigue siendo C en paralelo', () => {
    expect(serieAParalelo(100, -300).xp).toBeCloseTo(-1000 / 3, 10);
  });

  it('es lo mismo que invertir la impedancia', () => {
    const [r, x] = [37, -91];
    const d = r * r + x * x;
    // Y = 1/(R + jX) = (R − jX)/d: R_p = 1/Re(Y), X_p = −1/Im(Y)
    const p = serieAParalelo(r, x);
    expect(p.rp).toBeCloseTo(d / r, 9);
    expect(p.xp).toBeCloseTo(d / x, 9);
  });
});

describe('sección L (Bowick ec. 4-1 a 4-3)', () => {
  it('Q = √(R_mayor/R_menor − 1)', () => {
    expect(qDeSeccionL(100, 1000)).toBeCloseTo(3, 14);
    expect(qDeSeccionL(50, 200)).toBeCloseTo(Math.sqrt(3), 14);
  });

  it('pasa bajos: L en serie del lado de la R menor y C en derivación del lado de la mayor', () => {
    const s = seccionL(100, 1000, 'pasa-bajos');
    expect(s.q).toBeCloseTo(3, 14);
    expect(s.xSerie).toBeCloseTo(300, 10);
    expect(s.xDerivacion).toBeCloseTo(-1000 / 3, 10);
  });

  it('pasa altos: C en serie y L en derivación', () => {
    const s = seccionL(100, 1000, 'pasa-altos');
    expect(s.xSerie).toBeCloseTo(-300, 10);
    expect(s.xDerivacion).toBeCloseTo(1000 / 3, 10);
  });

  it('la derivación anula la reactancia en paralelo de la rama serie y deja R_mayor', () => {
    for (const filtrado of ['pasa-bajos', 'pasa-altos'] as const) {
      const s = seccionL(12, 75, filtrado);
      const p = serieAParalelo(12, s.xSerie);
      expect(p.rp).toBeCloseTo(75, 10);
      expect(p.xp + s.xDerivacion).toBeCloseTo(0, 10);
    }
  });
});

describe('de reactancia a componente', () => {
  const omega = 2 * Math.PI * 100e6;

  it('X > 0 es una L = X/ω', () => {
    const c = componenteDeReactancia(300, omega);
    expect(c.componente).toBe('L');
    // Bowick 4-1: 477,46 nH
    expect(c.valor).toBeCloseTo(477.4648e-9, 13);
  });

  it('X < 0 es una C = −1/(ωX)', () => {
    const c = componenteDeReactancia(-1000 / 3, omega);
    expect(c.componente).toBe('C');
    // Bowick 4-1: 4,775 pF
    expect(c.valor).toBeCloseTo(4.7746e-12, 15);
  });
});

describe('pasos de una sección', () => {
  it('Q, la reactancia en serie, la transformación a paralelo y la de derivación', () => {
    const pasos = pasosSeccionL(seccionL(100, 1000, 'pasa-bajos'), {
      menor: 'R_s',
      mayor: 'R_L',
    });
    expect(pasos.map((p) => p.texto)).toHaveLength(4);
    expect(pasos[0].latex).toContain('\\sqrt');
    // la transformación lleva la referencia a Bowick ec. 2-7 y 2-8
    expect(pasos.some((p) => p.fuente?.includes('2-7'))).toBe(true);
    expect(pasos.at(-1)!.latex).toContain('-333{,}3');
  });

  it('en el pasa altos los signos de las fórmulas siguen a los números', () => {
    const pasos = pasosSeccionL(seccionL(100, 1000, 'pasa-altos'), {
      menor: 'R_s',
      mayor: 'R_L',
    });
    expect(pasos[2].latex).toContain("X_p' = -\\dfrac{R_p}{Q} = -\\dfrac{1000}{3} = -333{,}3");
    expect(pasos[3].latex).toContain("X_p = -X_p' = \\dfrac{R_L}{Q} = 333{,}3");
  });
});
