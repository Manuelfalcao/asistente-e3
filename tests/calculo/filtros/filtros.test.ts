import { describe, expect, it } from 'vitest';
import {
  type EntradaFiltro,
  REFERENCIAS_FILTROS,
  SUGERENCIA_FILTROS,
  calcularFiltro,
  prototipo,
  topologiaSugerida,
} from '../../../src/calculo/filtros/filtros';
import { dentroDeTolerancia, margen } from '../../casos';
import {
  CASOS_COHN,
  CASOS_COMPORTAMIENTO,
  CASOS_REFERENCIA_G,
  CASOS_TOPOLOGIA,
  CASOS_VERIFICACION,
  TOLERANCIA_COHN,
  TOLERANCIA_DB,
  TOLERANCIA_ORACULO,
  TOLERANCIA_VALORES,
  entradaFiltro,
} from './casos';
import { atenuacionOraculo, atenuacionTeorica, perdidaSimulada } from './elementos';

// La Calculadora de filtros, pasa bajos y pasa altos en π y T (spec §7 y §13.3).

function calculado(e: EntradaFiltro) {
  const r = calcularFiltro(e);
  if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
  return r;
}

const ESCALA = { nH: 1e9, pF: 1e12 } as const;

describe('casos de referencia: los g de Matthaei', () => {
  for (const caso of CASOS_REFERENCIA_G) {
    it(caso.id, () => {
      const p = prototipo(caso.aproximacion, caso.orden, caso.ripple);
      const obtenidos = [...p.g, p.carga];
      expect(obtenidos).toHaveLength(caso.impresos.length);
      caso.impresos.forEach((impreso, i) => {
        expect(
          dentroDeTolerancia(obtenidos[i], impreso, caso.tolerancia),
          `g${i + 1}: ${obtenidos[i]} contra ${impreso} ± ${margen(caso.tolerancia, impreso)}`,
        ).toBe(true);
      });
    });
  }
});

describe('casos de verificación: C1, C2 y C4 contra el oráculo ABCD', () => {
  for (const caso of CASOS_VERIFICACION) {
    it(caso.id, () => {
      const r = calculado(caso.entradas);
      expect(r.elementos.map((e) => e.nombre)).toEqual(caso.valores.map((v) => v.nombre));
      caso.valores.forEach(({ nombre, impreso, unidad }, i) => {
        const obtenido = r.elementos[i].valor * ESCALA[unidad];
        expect(
          dentroDeTolerancia(obtenido, impreso, TOLERANCIA_VALORES),
          `${nombre}: ${obtenido} contra ${impreso}`,
        ).toBe(true);
      });
      const { rs, fc, aproximacion, ripple } = caso.entradas;
      for (const { f, impreso } of caso.atenuaciones) {
        const a = atenuacionOraculo(r.elementos, f, rs);
        expect(dentroDeTolerancia(a, impreso, TOLERANCIA_DB), `${f} Hz: ${a} dB`).toBe(true);
      }
      // En fc, la de la Aproximación: 3,01 dB en Butterworth y el ripple en Chebyshev.
      const enFc = atenuacionOraculo(r.elementos, fc, rs);
      const teorica = atenuacionTeorica(aproximacion, r.orden, 1, ripple);
      expect(Math.abs(enFc / teorica - 1)).toBeLessThan(TOLERANCIA_ORACULO.valor);
    });
  }
});

describe('casos de verificación: la pérdida de Cohn contra la simulación', () => {
  for (const caso of CASOS_COHN) {
    it(caso.id, () => {
      const r = calculado(caso.entradas);
      const { tipo, fc, rs, qBobina } = caso.entradas;
      const simulada = perdidaSimulada(r.elementos, tipo, fc, rs, qBobina);
      const esperada = simulada * (1 + caso.diferencia.relativa);
      expect(Math.abs(r.perdidaCohn - esperada)).toBeLessThanOrEqual(
        TOLERANCIA_COHN.valor * simulada,
      );
    });
  }
});

describe('casos de comportamiento', () => {
  for (const caso of CASOS_COMPORTAMIENTO) {
    it(caso.id, () => {
      const r = calcularFiltro(caso.entradas);
      const { esperado } = caso;
      if ('corte' in esperado) {
        expect(r.estado).toBe('corte');
        if (r.estado === 'corte') expect(r.codigo).toBe(esperado.corte);
        return;
      }
      if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
      expect(r.orden).toBe(esperado.orden);
      expect(r.avisos.map((a) => a.codigo)).toEqual(esperado.avisos);
      if (esperado.marcados) {
        expect(Object.fromEntries(r.revision.marcados.map((m) => [m.nombre, m.nivel]))).toEqual(
          esperado.marcados,
        );
      }
    });
  }
});

describe('el prototipo', () => {
  it('Butterworth: gk = 2·sen[(2k − 1)π/(2n)] y carga 1', () => {
    const p = prototipo('butterworth', 3, null);
    expect(p.g[0]).toBeCloseTo(1, 14);
    expect(p.g[1]).toBeCloseTo(2, 14);
    expect(p.carga).toBe(1);
    expect(p.beta).toBeNull();
  });

  it('Chebyshev: β y γ de Matthaei ec. 4.05-2, con 17,37 = 40/ln 10 exacto', () => {
    const p = prototipo('chebyshev', 5, 0.5);
    const beta = Math.log(1 / Math.tanh((0.5 * Math.LN10) / 40));
    expect(p.beta).toBeCloseTo(beta, 14);
    expect(p.gamma).toBeCloseTo(Math.sinh(beta / 10), 14);
    // El ejemplo de Matthaei Sec. 4.04: 0,1 dB y n = 2.
    const ejemplo = prototipo('chebyshev', 2, 0.1);
    expect(ejemplo.g[0]).toBeCloseTo(0.843, 3);
    expect(ejemplo.g[1]).toBeCloseTo(0.622, 3);
    expect(ejemplo.carga).toBeCloseTo(1.3554, 4);
  });

  it('Chebyshev par pide una carga de coth²(β/4), la misma para cualquier n', () => {
    const p4 = prototipo('chebyshev', 4, 0.5);
    const p6 = prototipo('chebyshev', 6, 0.5);
    expect(p4.carga).toBeCloseTo(1.9841, 4);
    expect(p6.carga).toBeCloseTo(p4.carga, 12);
  });

  it('los pasos muestran cada g', () => {
    const p = prototipo('chebyshev', 3, 0.5);
    const textos = p.pasos.map((x) => x.texto);
    expect(textos.some((t) => t.includes('β'))).toBe(true);
    expect(textos.some((t) => t.includes('γ'))).toBe(true);
    for (const k of [1, 2, 3])
      expect(p.pasos.some((x) => x.latex.startsWith(`g_{${k}}`))).toBe(true);
  });
});

describe('la escalera', () => {
  it('en π g1 va en derivación junto a la fuente y después alternan', () => {
    const r = calculado(entradaFiltro('pasa-bajos', 'butterworth', 'π', 5, 100e6));
    expect(r.elementos.map((e) => [e.nombre, e.posicion])).toEqual([
      ['C1', 'derivacion'],
      ['L2', 'serie'],
      ['C3', 'derivacion'],
      ['L4', 'serie'],
      ['C5', 'derivacion'],
    ]);
  });

  it('en T g1 va en serie; en pasa altos las series son C y las derivaciones L', () => {
    const r = calculado(entradaFiltro('pasa-altos', 'butterworth', 'T', 3, 50e6));
    expect(r.elementos.map((e) => [e.componente, e.posicion])).toEqual([
      ['C', 'serie'],
      ['L', 'derivacion'],
      ['C', 'serie'],
    ]);
  });

  it('cada elemento lleva su g', () => {
    const r = calculado(entradaFiltro('pasa-bajos', 'butterworth', 'T', 3, 100e6));
    expect(r.elementos.map((e) => e.g)).toEqual(r.prototipo.g);
  });

  it('π y T dan la misma respuesta', () => {
    const pi = calculado(entradaFiltro('pasa-altos', 'chebyshev', 'π', 7, 80e6, { ripple: 0.1 }));
    const t = calculado(entradaFiltro('pasa-altos', 'chebyshev', 'T', 7, 80e6, { ripple: 0.1 }));
    for (const f of [20e6, 60e6, 80e6, 150e6]) {
      expect(atenuacionOraculo(pi.elementos, f, 50)).toBeCloseTo(
        atenuacionOraculo(t.elementos, f, 50),
        9,
      );
    }
  });

  it('escala con R0: con 75 Ω las L crecen y las C bajan en 75/50', () => {
    const a = calculado(entradaFiltro('pasa-bajos', 'butterworth', 'π', 3, 100e6));
    const b = calculado(
      entradaFiltro('pasa-bajos', 'butterworth', 'π', 3, 100e6, { rs: 75, rl: 75 }),
    );
    expect(b.elementos[0].valor / a.elementos[0].valor).toBeCloseTo(50 / 75, 12);
    expect(b.elementos[1].valor / a.elementos[1].valor).toBeCloseTo(75 / 50, 12);
  });
});

describe('la pérdida de Cohn', () => {
  it('suma solo las bobinas, con Qk = Qu: 4,343·(g2 + g4)/Qu en C1 π', () => {
    const r = calculado(entradaFiltro('pasa-bajos', 'butterworth', 'π', 5, 100e6));
    const g = r.prototipo.g;
    expect(r.perdidaCohn).toBeCloseTo(((10 / Math.LN10) * (g[1] + g[3])) / 100, 12);
  });

  it('en pasa altos las bobinas son las de derivación', () => {
    const r = calculado(entradaFiltro('pasa-altos', 'butterworth', 'T', 3, 50e6));
    expect(r.perdidaCohn).toBeCloseTo(((10 / Math.LN10) * 2) / 100, 12);
  });

  it('sin bobinas no hay pérdida', () => {
    const r = calculado(entradaFiltro('pasa-bajos', 'butterworth', 'π', 1, 100e6));
    expect(r.elementos.map((e) => e.componente)).toEqual(['C']);
    expect(r.perdidaCohn).toBe(0);
  });
});

describe('la Topología por defecto', () => {
  for (const c of CASOS_TOPOLOGIA) {
    it(`${c.tipo}, ${c.aproximacion}, Orden ${c.orden}: ${c.sugerida}`, () => {
      expect(topologiaSugerida(c.tipo, c.aproximacion, c.orden).topologia).toBe(c.sugerida);
    });
  }

  it('la nota dice cuántas bobinas lleva cada una', () => {
    expect(topologiaSugerida('pasa-bajos', 'butterworth', 5).nota).toBe(
      'Por defecto, la que usa menos bobinas: π lleva 2 y T, 3.',
    );
    expect(topologiaSugerida('pasa-altos', 'butterworth', 4).nota).toBe(
      'π y T llevan 2 bobinas cada una: por defecto, π.',
    );
    expect(topologiaSugerida('pasa-bajos', 'butterworth', 1).nota).toBe(
      'Por defecto, la que usa menos bobinas: π no lleva ninguna y T, 1.',
    );
  });

  it('sin Orden sugiere π, con la nota general', () => {
    const s = topologiaSugerida('pasa-altos', 'butterworth', null);
    expect(s.topologia).toBe('π');
    expect(s.nota).toBe('Por defecto, la que usa menos bobinas según el Orden.');
  });
});

describe('el resultado', () => {
  it('Chebyshev par avisa por qué sube, con la carga que pediría', () => {
    const r = calculado(entradaFiltro('pasa-bajos', 'chebyshev', 'π', 4, 100e6, { ripple: 0.5 }));
    expect(r.ordenPedido).toBe(4);
    expect(r.avisos[0].texto).toContain('1,98');
    expect(r.avisos[0].texto).toContain('Orden 5');
  });

  it('Rs ≠ RL: el aviso dice que todavía no se calcula', () => {
    const r = calcularFiltro(
      entradaFiltro('pasa-altos', 'butterworth', 'T', 3, 100e6, { rs: 50, rl: 300 }),
    );
    expect(r.estado).toBe('corte');
    if (r.estado === 'corte') expect(r.texto).toMatch(/todavía no/);
  });

  it('cada valor se revisa en fc con la sugerencia de cambiar de Topología', () => {
    const r = calculado(entradaFiltro('pasa-bajos', 'chebyshev', 'π', 5, 300e6, { ripple: 2 }));
    expect(r.revision.sugerencia).toBe(SUGERENCIA_FILTROS);
    expect(SUGERENCIA_FILTROS).toMatch(/π ↔ T/);
    // La cuenta de cada valor marcado está al final de los pasos.
    expect(r.pasos.slice(-r.revision.pasos.length)).toEqual(r.revision.pasos);
  });

  it('en pasa altos una nota aclara que el desvío crece por encima de fc', () => {
    const pa = calculado(entradaFiltro('pasa-altos', 'butterworth', 'T', 3, 50e6));
    const pb = calculado(entradaFiltro('pasa-bajos', 'butterworth', 'π', 3, 50e6));
    expect(pa.notas.some((n) => /por encima de fc/.test(n))).toBe(true);
    expect(pb.notas.some((n) => /por encima de fc/.test(n))).toBe(false);
  });

  it('los pasos tienen cada elemento escalado con sus valores sustituidos', () => {
    const r = calculado(entradaFiltro('pasa-bajos', 'butterworth', 'π', 3, 100e6));
    expect(r.pasos.some((p) => p.latex.startsWith('C_{1} = '))).toBe(true);
    expect(r.pasos.some((p) => p.latex.startsWith('L_{2} = '))).toBe(true);
    expect(r.pasos.some((p) => p.texto.startsWith('Pérdida de Cohn'))).toBe(true);
  });

  it('cita a Matthaei y a Pozar', () => {
    expect(REFERENCIAS_FILTROS.map((x) => x.obra)).toContain(
      'Microwave Filters, Impedance-Matching Networks, and Coupling Structures',
    );
    expect(REFERENCIAS_FILTROS.map((x) => x.obra)).toContain('Microwave Engineering');
  });
});
