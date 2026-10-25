import { describe, expect, it } from 'vitest';
import { kLorenz, laminaExacta, mutuaDeAnillos, sumaDeAnillos } from './anillos';

// El oráculo contra lo que se sabe sin él: los kL exactos y las sumas de anillos de
// research/formulas-bobinas.md (§5.1 y §7), calculadas aparte, y los límites clásicos de la
// inductancia mutua de dos anillos.

const MU0 = 4 * Math.PI * 1e-7;
const mm = 1e-3;

describe('oráculo de suma de anillos', () => {
  it('kL de Lorenz con integrales elípticas (research §5.1)', () => {
    const exactos: [number, number][] = [
      [0.1, 0.203324],
      [0.2, 0.319825],
      [0.5, 0.52551],
      [1, 0.688423],
      [2, 0.818136],
      [5, 0.920093],
    ];
    for (const [largoSobreDiametro, kL] of exactos) {
      expect(kLorenz(1 / largoSobreDiametro)).toBeCloseTo(kL, 6);
    }
  });

  it('la lámina exacta de una bobina muy larga tiende a μ0·π·D²·N²/(4ℓ)', () => {
    const d = 10 * mm;
    const largo = 1000 * d;
    const ideal = (MU0 * Math.PI * d * d * 100 * 100) / (4 * largo);
    expect(laminaExacta(d, largo, 100) / ideal).toBeCloseTo(1, 3);
  });

  it('dos anillos lejanos se acoplan como dos dipolos: μ0·π·r1²·r2²/(2z³)', () => {
    const r = 1 * mm;
    const z = 1000 * mm;
    const dipolo = (MU0 * Math.PI * r ** 4) / (2 * z ** 3);
    expect(mutuaDeAnillos(r, r, z) / dipolo).toBeCloseTo(1, 5);
  });

  it('un anillo de cable fino: μ0·r·(ln(8r/a) − 2), su autoinductancia externa', () => {
    const r = 50 * mm;
    const a = 0.05 * mm;
    expect(mutuaDeAnillos(r, r, a) / (MU0 * r * (Math.log((8 * r) / a) - 2))).toBeCloseTo(1, 5);
  });

  it('la suma de anillos de los casos de VHF (research §7)', () => {
    // [carrete, cable, Separación, N, suma en nH]
    const casos: [number, number, number, number, number][] = [
      [4, 0.8, 0, 2, 18.86],
      [5, 0.8, 0, 3, 49.1],
      [5, 0.8, 0, 5, 106.42],
      [6, 1, 1, 6, 105.34],
      [6, 0.5, 0, 6, 227.71],
      [8, 0.5, 0, 7, 438.55],
      [6, 0.5, 0, 17, 978.27],
    ];
    for (const [carrete, cable, separacion, n, nH] of casos) {
      const suma = sumaDeAnillos((carrete + cable) * mm, n, (cable + separacion) * mm, cable * mm);
      expect(suma / 1e-9, `${carrete} mm, ${n} vueltas`).toBeCloseTo(nH, 2);
    }
  });

  it('la suma solo tiene sentido con vueltas enteras', () => {
    expect(() => sumaDeAnillos(5 * mm, 2.5, 1 * mm, 0.8 * mm)).toThrow();
  });
});
