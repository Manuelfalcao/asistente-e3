import { describe, expect, it } from 'vitest';
import {
  type EntradaFiltro,
  SUGERENCIA_FILTROS,
  SUGERENCIA_RECHAZA_BANDA,
  bandaDe,
  calcularFiltro,
  topologiaSugerida,
} from '../../../src/calculo/filtros/filtros';
import { entradaBanda, entradaFiltro } from './casos';
import { atenuacionResonadores } from './elementos';

// Pasa banda y rechaza banda en π y T (spec §7.1, §7.5, §7.8 y §7.10). Los casos C5 a C8 están en
// casos.ts; acá van las propiedades de la banda, de los resonadores y de la pérdida de Cohn.

function calculado(e: EntradaFiltro) {
  const r = calcularFiltro(e);
  if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
  return r;
}

const FM = { f1: 88e6, f2: 108e6 };
const ANGOSTA = { f1: 144e6, f2: 148e6 };

describe('la banda: f1 y f2, o f0 y BW (spec §7.1)', () => {
  it('con f1 y f2: f0 es la geométrica y BW la diferencia', () => {
    const b = bandaDe(FM);
    expect(b.f0).toBeCloseTo(97.49e6, -4);
    expect(b.f0).toBeCloseTo(Math.sqrt(88e6 * 108e6), 3);
    expect(b.bw).toBe(20e6);
    expect(b.fbw).toBeCloseTo(20e6 / b.f0, 12);
  });

  it('con f0 y BW: f1,2 = √(f0² + (BW/2)²) ∓ BW/2', () => {
    const b = bandaDe({ f0: 100e6, bw: 20e6 });
    const raiz = Math.sqrt(100e6 ** 2 + 10e6 ** 2);
    expect(b.f1).toBeCloseTo(raiz - 10e6, 3);
    expect(b.f2).toBeCloseTo(raiz + 10e6, 3);
    expect(b.f1 * b.f2).toBeCloseTo(100e6 ** 2, -2);
    expect(b.f2 - b.f1).toBeCloseTo(20e6, 3);
    expect(b.f0).toBe(100e6);
    expect(b.bw).toBe(20e6);
  });

  it('las dos formas de dar la misma banda dan el mismo filtro', () => {
    const a = calculado(entradaBanda('pasa-banda', 'butterworth', 'π', 3, FM));
    const b = calculado(
      entradaBanda('pasa-banda', 'butterworth', 'π', 3, { f0: a.banda!.f0, bw: 20e6 }),
    );
    a.elementos.forEach((e, i) => expect(b.elementos[i].valor / e.valor).toBeCloseTo(1, 12));
  });

  it('el resultado muestra siempre f1, f2, f0 y BW', () => {
    const r = calculado(
      entradaBanda('rechaza-banda', 'butterworth', 'T', 3, { f0: 98e6, bw: 10e6 }),
    );
    expect(r.banda).not.toBeNull();
    const { f1, f2, f0, bw } = r.banda!;
    expect(f0).toBe(98e6);
    expect(bw).toBeCloseTo(10e6, 3);
    expect(f2 - f1).toBeCloseTo(10e6, 3);
    expect(Math.sqrt(f1 * f2)).toBeCloseTo(98e6, 3);
    const r2 = calculado(entradaBanda('pasa-banda', 'butterworth', 'T', 3, FM));
    expect([r2.banda!.f1, r2.banda!.f2]).toEqual([88e6, 108e6]);
  });

  it('pasa bajos y pasa altos no tienen banda', () => {
    expect(calculado(entradaFiltro('pasa-bajos', 'butterworth', 'π', 3, 100e6)).banda).toBeNull();
  });

  it('el aviso de f0 dice que es la central geométrica', () => {
    const r = calculado(
      entradaBanda('pasa-banda', 'butterworth', 'π', 3, { f0: 97.5e6, bw: 20e6 }),
    );
    expect(r.avisos).toHaveLength(1);
    expect(r.avisos[0].texto).toMatch(/geométrica/);
    expect(r.avisos[0].texto).toContain('√(f1·f2)');
  });
});

describe('los resonadores del pasa banda y del rechaza banda (spec §7.5)', () => {
  const CASOS = [
    ['pasa-banda', 'butterworth', 'π', null],
    ['pasa-banda', 'butterworth', 'T', null],
    ['pasa-banda', 'chebyshev', 'π', 0.5],
    ['pasa-banda', 'chebyshev', 'T', 0.1],
    ['rechaza-banda', 'butterworth', 'π', null],
    ['rechaza-banda', 'butterworth', 'T', null],
    ['rechaza-banda', 'chebyshev', 'T', 0.5],
  ] as const;

  for (const [tipo, aproximacion, topologia, ripple] of CASOS) {
    it(`${tipo} ${aproximacion} ${topologia}: cada resonador sintoniza en ω0 (L·C = 1/ω0²)`, () => {
      for (const orden of [1, 3, 5, 7]) {
        const r = calculado(
          entradaBanda(tipo, aproximacion, topologia, orden, { f1: 140e6, f2: 160e6 }, { ripple }),
        );
        const omega0 = 2 * Math.PI * r.banda!.f0;
        expect(r.resonadores).toHaveLength(r.orden);
        for (const res of r.resonadores) {
          expect(res.l.valor * res.c.valor * omega0 ** 2).toBeCloseTo(1, 12);
        }
      }
    });
  }

  it('el pasa banda pone un LC serie en cada rama en serie y un LC paralelo en cada derivación', () => {
    const r = calculado(entradaBanda('pasa-banda', 'butterworth', 'π', 3, FM));
    expect(r.resonadores.map((x) => [x.nombre, x.posicion, x.conexion])).toEqual([
      ['R1', 'derivacion', 'paralelo'],
      ['R2', 'serie', 'serie'],
      ['R3', 'derivacion', 'paralelo'],
    ]);
  });

  it('el rechaza banda lo invierte: LC paralelo en serie y LC serie en derivación', () => {
    const r = calculado(entradaBanda('rechaza-banda', 'butterworth', 'T', 3, FM));
    expect(r.resonadores.map((x) => [x.posicion, x.conexion])).toEqual([
      ['serie', 'paralelo'],
      ['derivacion', 'serie'],
      ['serie', 'paralelo'],
    ]);
  });

  it('los elementos son los L y C de los resonadores, en orden desde la fuente', () => {
    const r = calculado(entradaBanda('pasa-banda', 'butterworth', 'π', 2, FM));
    expect(r.elementos.map((e) => e.nombre)).toEqual(['L1', 'C1', 'L2', 'C2']);
    expect(r.elementos[0]).toBe(r.resonadores[0].l);
    expect(r.elementos[3]).toBe(r.resonadores[1].c);
  });

  it('pasa bajos y pasa altos no tienen resonadores', () => {
    expect(calculado(entradaFiltro('pasa-altos', 'butterworth', 'T', 3, 50e6)).resonadores).toEqual(
      [],
    );
  });

  it('escala con R0: con 75 Ω el LC serie sube la L en 75/50 y baja la C', () => {
    const a = calculado(entradaBanda('pasa-banda', 'butterworth', 'T', 3, FM));
    const b = calculado(entradaBanda('pasa-banda', 'butterworth', 'T', 3, FM, { rs: 75, rl: 75 }));
    expect(b.resonadores[0].l.valor / a.resonadores[0].l.valor).toBeCloseTo(75 / 50, 12);
    expect(b.resonadores[0].c.valor / a.resonadores[0].c.valor).toBeCloseTo(50 / 75, 12);
  });

  it('π y T dan la misma respuesta', () => {
    for (const tipo of ['pasa-banda', 'rechaza-banda'] as const) {
      const pi = calculado(entradaBanda(tipo, 'chebyshev', 'π', 5, FM, { ripple: 0.1 }));
      const t = calculado(entradaBanda(tipo, 'chebyshev', 'T', 5, FM, { ripple: 0.1 }));
      for (const f of [60e6, 80e6, 120e6, 150e6]) {
        expect(atenuacionResonadores(pi.resonadores, f, 50)).toBeCloseTo(
          atenuacionResonadores(t.resonadores, f, 50),
          8,
        );
      }
    }
  });

  it('en el rechaza banda la atenuación en f0 es muy grande (infinita en el modelo ideal)', () => {
    const r = calculado(entradaBanda('rechaza-banda', 'butterworth', 'T', 3, FM));
    expect(atenuacionResonadores(r.resonadores, r.banda!.f0 * (1 + 1e-9), 50)).toBeGreaterThan(100);
  });

  it('los pasos muestran cada L y C escalados y el chequeo de sintonía', () => {
    const r = calculado(entradaBanda('pasa-banda', 'butterworth', 'π', 3, FM));
    for (const nombre of ['L_{1}', 'C_{1}', 'L_{2}', 'C_{2}']) {
      expect(r.pasos.some((p) => p.latex.startsWith(`${nombre} = `))).toBe(true);
    }
    expect(r.pasos.filter((p) => p.texto.startsWith('Sintonía')).length).toBe(3);
  });
});

describe('la pérdida de Cohn en pasa banda y rechaza banda (spec §7.8)', () => {
  it('pasa banda: 4,343·Σg/(FBW·Qu), con Qk = FBW·Qu (C5: 0,85 dB; C8: 6,34 dB)', () => {
    const c5 = calculado(entradaBanda('pasa-banda', 'butterworth', 'π', 3, FM));
    const fbw5 = 20e6 / Math.sqrt(88e6 * 108e6);
    expect(c5.perdidaCohn).toBeCloseTo(((10 / Math.LN10) * 4) / (fbw5 * 100), 12);
    expect(c5.perdidaCohn).toBeCloseTo(0.85, 2);
    const c8 = calculado(entradaBanda('pasa-banda', 'butterworth', 'π', 3, ANGOSTA));
    expect(c8.perdidaCohn).toBeCloseTo(6.34, 2);
  });

  it('suma todos los g: cada elemento del prototipo es un resonador con su bobina', () => {
    const r = calculado(entradaBanda('pasa-banda', 'chebyshev', 'T', 5, FM, { ripple: 0.5 }));
    const suma = r.prototipo.g.reduce((a, g) => a + g, 0);
    expect(r.perdidaCohn).toBeCloseTo(((10 / Math.LN10) * suma) / (r.banda!.fbw * 100), 12);
  });

  it('rechaza banda: no se muestra (P1)', () => {
    const r = calculado(entradaBanda('rechaza-banda', 'butterworth', 'π', 3, FM));
    expect(r.perdidaCohn).toBeNull();
    expect(r.pasos.some((p) => p.texto.startsWith('Pérdida de Cohn'))).toBe(false);
  });
});

describe('el criterio de valor impracticable en f2 (spec §7.10)', () => {
  it('se evalúa en f2, no en f1', () => {
    // La C1 de 159,2 pF de la banda de FM resuena (con la ESL del montaje) en 238 MHz: a f2 = 108 MHz
    // (f/SRF = 0,45) es Valor dudoso; a f1 = 88 MHz (0,37) no se marcaría.
    const r = calculado(entradaBanda('pasa-banda', 'butterworth', 'π', 3, FM));
    const c1 = r.resonadores[0].c;
    const srf = 1 / (2 * Math.PI * Math.sqrt(2.8e-9 * c1.valor));
    expect(88e6 / srf).toBeLessThan(0.408);
    expect(108e6 / srf).toBeGreaterThan(0.408);
    expect(r.frecuenciaRevision).toBe(108e6);
    const marca = r.revision.marcados.find((m) => m.nombre === 'C1');
    expect(marca?.nivel).toBe('dudoso');
    expect(marca?.motivo).toContain('108 MHz');
  });

  it('en pasa banda la sugerencia es la de siempre', () => {
    const r = calculado(entradaBanda('pasa-banda', 'butterworth', 'π', 3, ANGOSTA));
    expect(r.revision.sugerencia).toBe(SUGERENCIA_FILTROS);
  });

  it('en rechaza banda la sugerencia agrega ensanchar la banda', () => {
    const r = calculado(entradaBanda('rechaza-banda', 'butterworth', 'π', 3, ANGOSTA));
    expect(r.revision.sugerencia).toBe(SUGERENCIA_RECHAZA_BANDA);
    expect(SUGERENCIA_RECHAZA_BANDA).toMatch(/π ↔ T/);
    expect(SUGERENCIA_RECHAZA_BANDA).toMatch(/ensanch/);
  });

  it('cada L y C se revisa una sola vez', () => {
    const r = calculado(entradaBanda('pasa-banda', 'butterworth', 'π', 3, ANGOSTA));
    const nombres = r.revision.marcados.map((m) => m.nombre);
    expect(new Set(nombres).size).toBe(nombres.length);
  });
});

describe('la Topología por defecto en pasa banda y rechaza banda', () => {
  it('cada resonador lleva una bobina: π y T usan las mismas y se sugiere π', () => {
    for (const tipo of ['pasa-banda', 'rechaza-banda'] as const) {
      for (const orden of [3, 4]) {
        const s = topologiaSugerida(tipo, 'butterworth', orden);
        expect(s.topologia).toBe('π');
        expect(s.nota).toBe(`π y T llevan ${orden} bobinas cada una: por defecto, π.`);
      }
    }
  });
});

describe('el resultado de banda', () => {
  it('Rs ≠ RL todavía no se calcula, también en pasa banda', () => {
    const r = calcularFiltro(
      entradaBanda('pasa-banda', 'butterworth', 'π', 3, FM, { rs: 50, rl: 75 }),
    );
    expect(r.estado).toBe('corte');
  });

  it('las fórmulas del pasa banda llevan ω0 y BW', () => {
    const r = calculado(entradaBanda('pasa-banda', 'butterworth', 'π', 3, FM));
    const todas = r.formulas.join(' ');
    expect(todas).toContain('\\omega_0');
    expect(todas).toContain('BW');
  });

  it('las notas explican f1 y f2 en pasa banda y en rechaza banda avisan que no hay pérdida de Cohn', () => {
    const pb = calculado(entradaBanda('pasa-banda', 'butterworth', 'π', 3, FM));
    const rb = calculado(entradaBanda('rechaza-banda', 'butterworth', 'π', 3, FM));
    expect(pb.notas.some((n) => /f1 y f2/.test(n))).toBe(true);
    expect(rb.notas.some((n) => /rechaza/.test(n))).toBe(true);
    expect(rb.notas.some((n) => /Cohn/.test(n) && /no se muestra/.test(n))).toBe(true);
    expect(pb.notas.some((n) => /FBW/.test(n))).toBe(true);
  });
});
