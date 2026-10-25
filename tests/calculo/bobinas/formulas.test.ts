import { describe, expect, it } from 'vitest';
import {
  E_MAXWELL,
  MAXWELL_EXTERNO,
  bsAjuste,
  despejarVueltas,
  diametroRF,
  dosCapas,
  geometria,
  geometriaDosCapas,
  hazeltine,
  kLundin,
  km,
  ksExterna,
  maxwell93,
  rosaGrover91,
  unaCapa,
  vueltasDeHazeltine,
  vueltasDeWheeler,
  wheeler1928,
} from '../../../src/calculo/bobinas/formulas';
import { kLorenz } from '../../oraculos/anillos';

const mm = 1e-3;

describe('kL de Lundin (spec §6.3)', () => {
  it('error menor a 3 ppm contra la lámina exacta, en las dos ramas', () => {
    let peor = 0;
    for (let i = 0; i <= 600; i++) {
      // D/ℓ de 10⁻³ a 10³
      const x = 10 ** (-3 + i / 100);
      peor = Math.max(peor, Math.abs(kLundin(x) / kLorenz(x) - 1));
    }
    expect(peor).toBeLessThan(3e-6);
  });

  it('las dos ramas se juntan en x = 1 (0,688423) a menos de 3 ppm', () => {
    expect(kLundin(1)).toBeCloseTo(0.688423, 6);
    expect(Math.abs(kLundin(1 - 1e-12) / kLundin(1) - 1)).toBeLessThan(3e-6);
  });
});

describe('km de Knight, ec. 10.18 (spec §6.3)', () => {
  it('los controles: km(1) = 0, km(2) = 0,113706 y km(40) = 0,314236', () => {
    expect(km(1)).toBeCloseTo(0, 6);
    expect(km(2)).toBeCloseTo(0.113706, 6);
    expect(km(40)).toBeCloseTo(0.314236, 6);
  });

  it('vale para N no entero y crece hacia ln(2π) − 3/2', () => {
    expect(km(2.5)).toBeGreaterThan(km(2));
    expect(km(2.5)).toBeLessThan(km(3));
    expect(km(1e6)).toBeCloseTo(Math.log(2 * Math.PI) - 1.5, 5);
  });
});

describe('ks externa (spec §6.3)', () => {
  it('con vueltas juntas es 3/2 − ln 2 = 0,8069', () => {
    expect(ksExterna(1 * mm, 1 * mm)).toBeCloseTo(0.8069, 4);
  });

  it('se anula con p/d = e^(3/2)/2', () => {
    expect(ksExterna((Math.exp(1.5) / 2) * mm, 1 * mm)).toBeCloseTo(0, 12);
  });
});

describe('geometría (spec §6.2)', () => {
  it('p = d + s y D0 = Diámetro del carrete + d', () => {
    const g = geometria({ carrete: 5 * mm, cable: 0.8 * mm, separacion: 0.2 * mm });
    expect(g.entreCentros).toBeCloseTo(1 * mm, 15);
    expect(g.d0).toBeCloseTo(5.8 * mm, 15);
  });
});

describe('diámetro efectivo de RF, Knight ec. 4.2 (spec §6.3)', () => {
  const vueltasJuntas = geometria({ carrete: 5 * mm, cable: 0.8 * mm, separacion: 0 });

  it('Dmin = D0 − d + 2d/N', () => {
    expect(diametroRF(vueltasJuntas, 4).dMin).toBeCloseTo((5.8 - 0.8 + 0.4) * mm, 15);
  });

  it('con vueltas juntas w → ∞ y D∞ = Dmin', () => {
    const rf = diametroRF(vueltasJuntas, 4);
    expect(rf.w).toBe(Infinity);
    expect(rf.dInfinito).toBe(rf.dMin);
  });

  it('con p = 2d el peso es 1 y D∞ queda a mitad de camino', () => {
    const g = geometria({ carrete: 6 * mm, cable: 1 * mm, separacion: 1 * mm });
    const rf = diametroRF(g, 6);
    expect(rf.w).toBeCloseTo(1, 12);
    expect(rf.dInfinito).toBeCloseTo((g.d0 + rf.dMin) / 2, 15);
  });

  it('con vueltas muy separadas D∞ tiende a D0', () => {
    const g = geometria({ carrete: 6 * mm, cable: 0.5 * mm, separacion: 10 * mm });
    expect(diametroRF(g, 10).dInfinito / g.d0).toBeCloseTo(1, 3);
  });
});

// Los valores de Knight y de la Circular 74 son Casos de prueba (casos.ts).
describe('L de Rosa y Nagaoka (spec §6.3)', () => {
  it('ℓ = N·p y x = D/ℓ', () => {
    const g = geometria({ carrete: 5 * mm, cable: 0.8 * mm, separacion: 0 });
    const l = unaCapa(g, 5, g.d0);
    expect(l.largo).toBeCloseTo(4 * mm, 15);
    expect(l.x).toBeCloseTo(5.8 / 4, 12);
  });

  it('L crece con N en una grilla amplia, con D0 y con D∞, si el carrete no es más fino que el cable', () => {
    const noCrece: string[] = [];
    for (const carrete of [1, 2, 4, 6, 10, 20, 30]) {
      for (const cable of [0.2, 0.5, 1, 2]) {
        if (carrete < cable) continue;
        for (const veces of [0, 0.25, 1, 3]) {
          const g = geometria({
            carrete: carrete * mm,
            cable: cable * mm,
            separacion: veces * cable * mm,
          });
          let previas = [-Infinity, -Infinity];
          for (let n = 1; n <= 200; n += 0.05) {
            const ahora = [g.d0, diametroRF(g, n).dInfinito].map(
              (d) => unaCapa(g, n, d).inductancia,
            );
            if (ahora.some((l, i) => !(l > previas[i]))) {
              noCrece.push(`${carrete}/${cable}/${veces}, N = ${n}`);
            }
            previas = ahora;
          }
        }
      }
    }
    expect(noCrece).toEqual([]);
  });
});

describe('Wheeler 1928 (spec §6.6)', () => {
  it('las vueltas de Wheeler son las que, con b = n·p, dan la L buscada', () => {
    for (const [carrete, cable, separacion, l] of [
      [5, 0.8, 0, 100e-9],
      [6, 1, 1, 100e-9],
      [6, 0.5, 0, 1e-6],
    ]) {
      const g = geometria({
        carrete: carrete * mm,
        cable: cable * mm,
        separacion: separacion * mm,
      });
      const n = vueltasDeWheeler(g, l);
      expect(wheeler1928(g.d0, n * g.entreCentros, n) / l).toBeCloseTo(1, 12);
    }
  });
});

describe('despeje de N por bisección (spec §6.5)', () => {
  const g = geometria({ carrete: 5 * mm, cable: 0.8 * mm, separacion: 0 });
  const conD0 = (n: number) => unaCapa(g, n, g.d0).inductancia;

  it('da el N real con la L buscada, con 10⁻⁹ de precisión', () => {
    const n = despejarVueltas(conD0, 100e-9);
    expect(n).not.toBeNull();
    expect(Math.abs(conD0(n!) / 100e-9 - 1)).toBeLessThan(1e-8);
    // research/formulas-bobinas.md §7: 100 nH sobre 5 mm con 0,8 mm da 4,789 vueltas.
    expect(n).toBeCloseTo(4.789, 3);
  });

  it('sirve también para cientos de vueltas', () => {
    const n = despejarVueltas(conD0, 1e-3);
    expect(Math.abs(conD0(n!) / 1e-3 - 1)).toBeLessThan(1e-8);
  });

  it('sin una cota que alcance la L buscada, no hay N', () => {
    expect(despejarVueltas(() => 1e-9, 2e-9)).toBeNull();
  });

  it('puede arrancar desde otro mínimo: en dos capas, el n con n′ = 1', () => {
    const n = despejarVueltas(conD0, 100e-9, 2.5);
    expect(n).toBeCloseTo(4.789, 3);
    // Con la L buscada debajo del mínimo, la bisección se queda en el mínimo.
    expect(despejarVueltas(conD0, 1e-9, 2.5)).toBeCloseTo(2.5, 6);
  });
});

describe('geometría de dos capas (spec §6.2)', () => {
  it('b = n·p, c = 2d, a = Diámetro del carrete/2 + d y diámetro exterior = carrete + 4d', () => {
    const g = geometriaDosCapas({ carrete: 6 * mm, cable: 0.8 * mm, separacion: 0.4 * mm });
    expect(g.entreCentros).toBeCloseTo(1.2 * mm, 15);
    expect(g.profundidad).toBeCloseTo(1.6 * mm, 15);
    expect(g.radioMedio).toBeCloseTo(3.8 * mm, 15);
    expect(g.diametroExterior).toBeCloseTo(9.2 * mm, 15);
    const l = dosCapas(g, 5.5, true);
    expect(l.vueltasPorCapa).toBe(5.5);
    expect(l.vueltas).toBe(11);
    expect(l.largo).toBeCloseTo(6.6 * mm, 15);
  });
});

// La Tabla X de Rosa y Grover y el ejemplo de la Circular 74 son Casos de prueba (casos-dos-capas.ts).
describe('Bs con el ajuste cerrado propio (spec §6.4)', () => {
  it('Bs(1) = 0 exacto y tiende a 0,3522843', () => {
    expect(bsAjuste(1)).toBeCloseTo(0, 12);
    expect(bsAjuste(1e7)).toBeCloseTo(0.3522843, 6);
  });

  it('crece con n′', () => {
    let previo = -Infinity;
    for (let n = 1; n <= 400; n += 0.25) {
      expect(bsAjuste(n), `n′ = ${n}`).toBeGreaterThan(previo);
      previo = bsAjuste(n);
    }
  });
});

describe('Rosa y Grover (91) (spec §6.4)', () => {
  it('ΔL1 en SI es la (156) de la Circular 74 en µH con a en cm: 0,01257·N²·a·(c/b)·(0,693 + Bs)', () => {
    const r = rosaGrover91(0.1, 0.1, 0.01, 1000);
    expect(r.nPrima).toBeCloseTo(10, 12);
    expect(r.x).toBeCloseTo(2, 12);
    // 0,01257 es 4π/1000 redondeado: 3·10⁻⁴ de diferencia.
    const practica = 0.01257 * 1000 ** 2 * 10 * 0.1 * (0.693 + r.bs);
    expect(r.deltaL1 / 1e-6 / practica).toBeCloseTo(1, 3);
  });

  it('Ls es la lámina de Nagaoka con el radio medio', () => {
    const r = rosaGrover91(3e-3, 5e-3, 1e-3, 20);
    expect(r.ls).toBeCloseTo(
      (4 * Math.PI * 1e-7 * Math.PI * 6e-3 ** 2 * 400 * kLundin(6 / 5)) / (4 * 5e-3),
      20,
    );
  });
});

describe('corrección de Maxwell (93), versión externa (spec §6.4)', () => {
  it('−0,1119 = ln(2·0,447049): la constante de Maxwell, 0,13806, sin la interna de 1/4', () => {
    expect(MAXWELL_EXTERNO).toBeCloseTo(-0.1119, 4);
    expect(MAXWELL_EXTERNO + 0.25).toBeCloseTo(0.13806, 4);
  });

  it('con vueltas juntas D′ = d y el término es −0,1119 + E', () => {
    const m = maxwell93(3e-3, 20, 0.5e-3, 0.5e-3);
    expect(m.dPrima).toBeCloseTo(0.5e-3, 15);
    expect(m.termino).toBeCloseTo(MAXWELL_EXTERNO + E_MAXWELL, 12);
  });

  it('con vueltas separadas D′ = √(p·d): celdas de p × d', () => {
    const m = maxwell93(3e-3, 20, 2e-3, 0.5e-3);
    expect(m.dPrima).toBeCloseTo(1e-3, 15);
    expect(m.deltaL2).toBeCloseTo(
      4 * Math.PI * 1e-7 * 3e-3 * 20 * (Math.log(2) + MAXWELL_EXTERNO + E_MAXWELL),
      20,
    );
  });
});

describe('L de dos capas (spec §6.4)', () => {
  const g = (carrete: number, cable: number, separacion = 0) =>
    geometriaDosCapas({ carrete: carrete * mm, cable: cable * mm, separacion: separacion * mm });

  it('L = Ls − ΔL1 + ΔL2, y sin Maxwell (el plan B) L = Ls − ΔL1', () => {
    const con = dosCapas(g(8, 0.4), 12, true);
    expect(con.inductancia).toBeCloseTo(con.ls - con.deltaL1 + con.maxwell!.deltaL2, 20);
    const sin = dosCapas(g(8, 0.4), 12, false);
    expect(sin.maxwell).toBeNull();
    expect(sin.inductancia).toBeCloseTo(sin.ls - sin.deltaL1, 20);
  });

  it('las bobinas de dos capas de la investigación, con n entero (research §7)', () => {
    // [carrete, cable, n, L de Rosa (91) + (93) en nH, como la imprime la tabla]
    const tabla: [number, number, number, number][] = [
      [4, 0.5, 5, 409.5],
      [5, 0.5, 7, 927.8],
      [6, 0.5, 11, 2328.4],
      [8, 0.4, 12, 4503.0],
    ];
    for (const [carrete, cable, n, l] of tabla) {
      const obtenida = dosCapas(g(carrete, cable), n, true).inductancia / 1e-9;
      expect(Math.abs(obtenida - l), `${carrete} mm, ${n} por capa`).toBeLessThanOrEqual(0.05);
    }
  });

  it('L crece con n en una grilla amplia, con y sin Maxwell, desde n′ = 1', () => {
    const noCrece: string[] = [];
    for (const carrete of [2, 4, 6, 10, 20, 30]) {
      for (const cable of [0.2, 0.5, 1, 2]) {
        for (const veces of [0, 0.25, 1, 3]) {
          const geo = g(carrete, cable, veces * cable);
          const desde = Math.max(1, geo.profundidad / geo.entreCentros);
          let previas = [-Infinity, -Infinity];
          for (let n = desde; n <= 100; n += 0.05) {
            const ahora = [true, false].map((c) => dosCapas(geo, n, c).inductancia);
            if (ahora.some((l, i) => !(l > previas[i]))) {
              noCrece.push(`${carrete}/${cable}/${veces}, n = ${n}`);
            }
            previas = ahora;
          }
        }
      }
    }
    expect(noCrece).toEqual([]);
  });
});

describe('Hazeltine (spec §6.6)', () => {
  const g = geometriaDosCapas({ carrete: 4 * mm, cable: 0.5 * mm, separacion: 0 });

  it('la de la investigación: 5 vueltas por capa sobre 4 mm con 0,5 mm dan 414,4 nH (research §7)', () => {
    const b = 5 * g.entreCentros;
    expect(hazeltine(g.radioMedio, b, g.profundidad, 10) / 1e-9).toBeCloseTo(414.4, 1);
  });

  it('las vueltas de Hazeltine son las que, con b = (N/2)·p, dan la L buscada', () => {
    const n = vueltasDeHazeltine(g, 470e-9);
    const b = (n / 2) * g.entreCentros;
    expect(hazeltine(g.radioMedio, b, g.profundidad, n) / 470e-9).toBeCloseTo(1, 12);
  });
});
