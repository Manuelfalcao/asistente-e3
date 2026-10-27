import { describe, expect, it } from 'vitest';
import {
  type ElementoFiltro,
  type EntradaFiltro,
  type ResultadoFiltro,
  calcularFiltro,
  prototipo,
  topologiaSugerida,
} from '../../../src/calculo/filtros/filtros';
import {
  admiteOrdenPar,
  relacionMinima,
  takahasi,
  transmisionMaxima,
} from '../../../src/calculo/filtros/takahasi';
import { dentroDeTolerancia, margen } from '../../casos';
import { bordesDe, entradaBanda, entradaFiltro, pedido } from './casos';
import {
  CASOS_RELACION_MINIMA,
  CASOS_REFERENCIA_TAKAHASI,
  CASOS_VERIFICACION_TAKAHASI,
  TOLERANCIA_ORACULO_TAKAHASI,
  TOLERANCIA_VALORES_TAKAHASI,
  atenuacionEnBorde,
  centroDe,
  comoEnLaTabla,
  perdidaPlanaTeorica,
  perdidaSobreK,
} from './casos-takahasi';
import { atenuacionEntre } from './elementos';

// Las fórmulas de Takahasi en la parametrización de Green (spec §7.4): el prototipo entre una fuente
// y una carga distintas.

describe('casos de referencia: Takahasi contra Zverev, Williams y Matthaei', () => {
  for (const caso of CASOS_REFERENCIA_TAKAHASI) {
    it(caso.id, () => {
      const p = takahasi(caso.aproximacion, caso.orden, caso.ripple, caso.r);
      const obtenidos = comoEnLaTabla(caso, p);
      expect(obtenidos).toHaveLength(caso.impresos.length);
      caso.impresos.forEach((impreso, i) => {
        expect(
          dentroDeTolerancia(obtenidos[i], impreso, caso.tolerancia),
          `${i + 1}.º: ${obtenidos[i]} contra ${impreso} ± ${margen(caso.tolerancia, impreso)}`,
        ).toBe(true);
      });
      if (caso.carga) {
        expect(dentroDeTolerancia(p.carga, caso.carga, caso.tolerancia), `carga ${p.carga}`).toBe(
          true,
        );
      }
    });
  }

  for (const caso of CASOS_RELACION_MINIMA) {
    it(caso.id, () => {
      const r = relacionMinima(caso.ripple);
      expect(dentroDeTolerancia(r, caso.impreso, caso.tolerancia), `${r}`).toBe(true);
    });
  }
});

describe('el prototipo de Takahasi', () => {
  it('con r = 1 da los g de terminaciones iguales: Butterworth de cualquier Orden', () => {
    for (let n = 1; n <= 10; n++) {
      const t = takahasi('butterworth', n, null, 1);
      const igual = prototipo('butterworth', n, null);
      t.g.forEach((g, i) => expect(g).toBeCloseTo(igual.g[i], 12));
      expect(t.carga).toBeCloseTo(1, 12);
    }
  });

  it('con r = 1 da los g de terminaciones iguales: Chebyshev de Orden impar', () => {
    for (const ripple of [0.01, 0.1, 0.5, 1, 3]) {
      for (const n of [1, 3, 5, 7, 9]) {
        const t = takahasi('chebyshev', n, ripple, 1);
        const igual = prototipo('chebyshev', n, ripple);
        t.g.forEach((g, i) => expect(g).toBeCloseTo(igual.g[i], 12));
        expect(t.carga).toBeCloseTo(1, 12);
      }
    }
  });

  it('Chebyshev par con r = r_min da los de terminaciones iguales, con carga coth²(β/4)', () => {
    for (const ripple of [0.1, 0.5, 1]) {
      for (const n of [2, 4, 6, 10]) {
        const igual = prototipo('chebyshev', n, ripple);
        const t = takahasi('chebyshev', n, ripple, relacionMinima(ripple));
        t.g.forEach((g, i) => expect(g).toBeCloseTo(igual.g[i], 6));
        expect(t.carga).toBeCloseTo(igual.carga, 9);
      }
    }
  });

  it('la carga g(n+1) es r, en Butterworth y en Chebyshev', () => {
    for (const r of [1.5, 2, 6, 20]) {
      expect(takahasi('butterworth', 4, null, r).carga).toBeCloseTo(r, 9);
      expect(takahasi('chebyshev', 5, 0.5, r).carga).toBeCloseTo(r, 9);
      // El par, solo desde r_min = 1,9841.
      if (r >= 2) expect(takahasi('chebyshev', 4, 0.5, r).carga).toBeCloseTo(r, 9);
    }
  });

  it('K = 4r/(1+r)², y en Chebyshev par (1+ε²) veces eso', () => {
    expect(transmisionMaxima('butterworth', 4, null, 6)).toBeCloseTo(24 / 49, 14);
    expect(transmisionMaxima('chebyshev', 3, 0.1, 6)).toBeCloseTo(24 / 49, 14);
    expect(transmisionMaxima('chebyshev', 4, 0.1, 6)).toBeCloseTo((24 / 49) * 10 ** 0.01, 14);
    // La investigación: K = 0,50120 para Chebyshev 0,1 dB de Orden 4 de 50 a 300 Ω.
    expect(transmisionMaxima('chebyshev', 4, 0.1, 6)).toBeCloseTo(0.5012, 4);
  });

  it('guarda a, â, K y ρ0 en Chebyshev, y α en Butterworth', () => {
    const c = takahasi('chebyshev', 3, 0.1, 6);
    const epsilon = Math.sqrt(10 ** 0.01 - 1);
    expect(c.takahasi!.a).toBeCloseTo(Math.asinh(1 / epsilon) / 3, 14);
    expect(c.takahasi!.aGorro).toBeCloseTo(Math.asinh(Math.sqrt(1 - 24 / 49) / epsilon) / 3, 14);
    expect(c.takahasi!.k).toBeCloseTo(24 / 49, 14);
    expect(c.takahasi!.rho0).toBeCloseTo(5 / 7, 12);
    expect(c.takahasi!.alfa).toBeNull();
    const b = takahasi('butterworth', 3, null, 6);
    expect(b.takahasi!.alfa).toBeCloseTo((1 - 24 / 49) ** (1 / 6), 14);
    expect(b.takahasi!.rho0).toBeCloseTo(5 / 7, 12);
    expect(b.takahasi!.a).toBeNull();
  });

  it('los pasos muestran a, â, K, ρ0 y cada g', () => {
    const latex = takahasi('chebyshev', 4, 0.1, 6).pasos.map((p) => p.latex);
    for (const inicio of ['K = ', 'a = ', '\\hat{a} = ', '\\rho_0 = ', 'g_{1} = ', 'g_{4} = ']) {
      expect(
        latex.some((l) => l.startsWith(inicio)),
        inicio,
      ).toBe(true);
    }
    const butterworth = takahasi('butterworth', 3, null, 6).pasos.map((p) => p.latex);
    for (const inicio of ['K = ', '\\alpha = ', '\\rho_0 = ', 'g_{3} = ']) {
      expect(
        butterworth.some((l) => l.startsWith(inicio)),
        inicio,
      ).toBe(true);
    }
  });

  it('prototipo con r ≠ 1 es el de Takahasi', () => {
    expect(prototipo('butterworth', 3, null, 6).g).toEqual(takahasi('butterworth', 3, null, 6).g);
    expect(prototipo('butterworth', 3, null).takahasi).toBeNull();
  });
});

describe('r_min de Chebyshev par', () => {
  it('es coth²(β/4), la carga de Chebyshev par con terminaciones iguales, para cualquier n', () => {
    for (const ripple of [0.01, 0.1, 0.5, 1, 3]) {
      expect(relacionMinima(ripple)).toBeCloseTo(prototipo('chebyshev', 4, ripple).carga, 12);
    }
  });

  it('R10: con 0,1 dB y r = 1,3 no hay Orden par (K > 1)', () => {
    expect(transmisionMaxima('chebyshev', 4, 0.1, 1.3)).toBeGreaterThan(1);
    expect(admiteOrdenPar(0.1, 1.3)).toBe(false);
    expect(admiteOrdenPar(0.1, 1.36)).toBe(true);
    // r = 1 (terminaciones iguales) nunca admite el par.
    expect(admiteOrdenPar(0.01, 1)).toBe(false);
  });

  it('admite el r_min mismo, aunque el redondeo dé K apenas por encima de 1', () => {
    for (const ripple of [0.01, 0.1, 0.5, 1, 3]) {
      expect(admiteOrdenPar(ripple, relacionMinima(ripple))).toBe(true);
    }
  });
});

// --- La escalera con Rs ≠ RL --------------------------------------------------------------------

type Calculado = Extract<ResultadoFiltro, { estado: 'calculado' }>;

function calculado(e: EntradaFiltro): Calculado {
  const r = calcularFiltro(e);
  if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
  return r;
}

// La atenuación de transductor entre Rs y RL de una escalera del resultado, con el oráculo.
const atenuacion = (
  escalera: Pick<Calculado, 'elementos' | 'resonadores'>,
  f: number,
  e: EntradaFiltro,
) => atenuacionEntre(escalera, f, e.rs, e.rl);

const ESCALA = { nH: 1e9, pF: 1e12 } as const;

function compararValores(
  elementos: readonly ElementoFiltro[],
  valores: readonly { nombre: string; impreso: string; unidad: 'nH' | 'pF' }[],
) {
  expect(elementos.map((x) => x.nombre)).toEqual(valores.map((v) => v.nombre));
  valores.forEach(({ nombre, impreso, unidad }, i) => {
    const obtenido = elementos[i].valor * ESCALA[unidad];
    expect(
      dentroDeTolerancia(obtenido, impreso, TOLERANCIA_VALORES_TAKAHASI),
      `${nombre}: ${obtenido} contra ${impreso}`,
    ).toBe(true);
  });
}

const relativo = (obtenido: number, esperado: number) => Math.abs(obtenido / esperado - 1);

describe('casos de verificación: escaleras con Rs ≠ RL contra el oráculo ABCD', () => {
  for (const caso of CASOS_VERIFICACION_TAKAHASI) {
    it(caso.id, () => {
      const e = caso.entradas;
      const r = calculado(e);
      if (caso.valores.length > 0) compararValores(r.elementos, caso.valores);
      const alternativa = r.terminaciones!.alternativa;
      if (caso.alternativa.length > 0) compararValores(alternativa!.elementos, caso.alternativa);

      for (const escalera of alternativa ? [r, alternativa] : [r]) {
        // En el centro de la banda pasante, la desadaptación directa 4r/(1+r)²…
        const plana = perdidaPlanaTeorica(e.rs, e.rl);
        expect(relativo(atenuacion(escalera, centroDe(e), e), plana)).toBeLessThan(
          TOLERANCIA_ORACULO_TAKAHASI.valor,
        );
        // …y en los bordes, la de la Aproximación sobre la transmisión máxima K.
        for (const borde of bordesDe(e)) {
          expect(
            relativo(atenuacion(escalera, borde, e), atenuacionEnBorde(e, r.orden)),
          ).toBeLessThan(TOLERANCIA_ORACULO_TAKAHASI.valor);
        }
      }
      // La alternativa da la misma respuesta también fuera de la banda pasante.
      if (alternativa) {
        for (const f of afueraDe(e)) {
          expect(atenuacion(alternativa, f, e)).toBeCloseTo(atenuacion(r, f, e), 9);
        }
      }
    });
  }
});

// Dos frecuencias en la banda atenuada.
const afueraDe = (e: EntradaFiltro): number[] => {
  if ('fc' in e) return e.tipo === 'pasa-bajos' ? [1.5 * e.fc, 3 * e.fc] : [e.fc / 1.5, e.fc / 3];
  const { f1, f2 } = e.banda as { f1: number; f2: number };
  return e.tipo === 'pasa-banda' ? [0.8 * f1, 1.2 * f2] : [1.02 * f1, 0.98 * f2];
};

describe('el resultado con Rs ≠ RL', () => {
  it('el aviso obligatorio de pérdida plana: no adapta, cuánto pierde, redes y balun', () => {
    const r = calculado(entradaFiltro('pasa-bajos', 'butterworth', 'T', 3, 100e6, { rl: 300 }));
    const aviso = r.avisos.find((a) => a.codigo === 'perdida-plana')!;
    expect(aviso.texto).toContain(
      'Este filtro no adapta: tiene una pérdida plana de 3,1 dB, igual a la desadaptación ' +
        'directa, 4r/(1+r)²',
    );
    expect(aviso.texto).toContain('Calculadora de redes de adaptación');
    expect(aviso.texto).toMatch(/balun/);
    expect(aviso.texto).toMatch(/300 Ω/);
    expect(r.terminaciones!.perdidaPlana).toBeCloseTo(-10 * Math.log10(24 / 49), 12);
  });

  it('va en los cuatro Tipos de filtro', () => {
    const fm = { f1: 88e6, f2: 108e6 };
    for (const r of [
      calculado(entradaFiltro('pasa-bajos', 'butterworth', 'π', 3, 100e6, { rl: 75 })),
      calculado(entradaFiltro('pasa-altos', 'butterworth', 'π', 3, 100e6, { rl: 75 })),
      calculado(entradaBanda('pasa-banda', 'butterworth', 'π', 3, fm, { rl: 75 })),
      calculado(entradaBanda('rechaza-banda', 'butterworth', 'π', 3, fm, { rl: 75 })),
    ]) {
      expect(r.avisos.map((a) => a.codigo)).toContain('perdida-plana');
    }
  });

  it('en Chebyshev par dice cuánto pierde en los picos del ripple', () => {
    const r = calculado(
      entradaFiltro('pasa-bajos', 'chebyshev', 'T', 4, 100e6, { rl: 300, ripple: 0.1 }),
    );
    const aviso = r.avisos.find((a) => a.codigo === 'perdida-plana')!;
    expect(aviso.texto).toContain('va de 3 dB en los picos del ripple a 3,1 dB');
  });

  it('Chebyshev par con r < r_min sube al impar y dice el r_min del ripple', () => {
    const r = calculado(
      entradaFiltro('pasa-bajos', 'chebyshev', 'T', 4, 100e6, { rl: 65, ripple: 0.1 }),
    );
    expect(r.orden).toBe(5);
    expect(r.ordenPedido).toBe(4);
    const aviso = r.avisos.find((a) => a.codigo === 'chebyshev-par')!;
    expect(aviso.texto).toContain('r_min = 1,36');
    expect(aviso.texto).toContain('r = 1,3');
    expect(aviso.texto).toContain('Orden 5');
  });

  it('con Orden par la Topología queda fija: la serie del lado de la R menor', () => {
    const desdeMenor = calculado(
      entradaFiltro('pasa-bajos', 'butterworth', 'π', 4, 100e6, { rl: 300 }),
    );
    expect(desdeMenor.topologia).toBe('T');
    expect(desdeMenor.topologiaPedida).toBe('π');
    expect(desdeMenor.elementos[0].posicion).toBe('serie');
    const aviso = desdeMenor.avisos.find((a) => a.codigo === 'topologia-orden-par')!;
    expect(aviso.texto).toMatch(/solo se puede armar T/);

    const desdeMayor = calculado(
      entradaFiltro('pasa-bajos', 'butterworth', 'T', 4, 100e6, { rs: 300 }),
    );
    expect(desdeMayor.topologia).toBe('π');
    expect(desdeMayor.elementos[0].posicion).toBe('derivacion');
    expect(desdeMayor.avisos.map((a) => a.codigo)).toContain('topologia-orden-par');
  });

  it('con Orden impar respeta la Topología pedida, desde cualquier lado', () => {
    for (const [rs, rl] of [
      [50, 300],
      [300, 50],
    ]) {
      for (const topologia of ['π', 'T'] as const) {
        const r = calculado(
          entradaFiltro('pasa-bajos', 'butterworth', topologia, 3, 100e6, { rs, rl }),
        );
        expect(r.topologia).toBe(topologia);
        expect(r.avisos.map((a) => a.codigo)).toEqual(['perdida-plana']);
        expect(r.terminaciones!.alternativa).toBeNull();
      }
    }
  });

  it('cada elemento lleva el g del prototipo del que sale, también en la escalera invertida', () => {
    // π desde la R menor con Orden impar es la variante (d): de g3 a g1, escalada con la R mayor.
    const r = calculado(entradaFiltro('pasa-bajos', 'butterworth', 'π', 3, 100e6, { rl: 300 }));
    expect(r.terminaciones!.variante).toBe('d');
    expect(r.elementos.map((e) => e.indiceG)).toEqual([3, 2, 1]);
    expect(r.elementos.map((e) => e.g)).toEqual([...r.prototipo.g].reverse());
    expect(r.elementos[0].valor).toBeCloseTo(r.prototipo.g[2] / (300 * 2 * Math.PI * 100e6), 20);
  });

  it('la principal es la de menor dispersión; con empate, la de valores menos afectados por el montaje', () => {
    const r = calculado(entradaFiltro('pasa-bajos', 'butterworth', 'T', 4, 100e6, { rl: 300 }));
    const t = r.terminaciones!;
    expect(t.variante).toBe('d');
    expect(t.alternativa!.variante).toBe('a');
    // Por dualidad, las L de una son las C de la otra: la dispersión empata.
    expect(t.dispersion).toBeCloseTo(t.alternativa!.dispersion, 9);
    expect(t.peorError).toBeLessThan(t.alternativa!.peorError);
    expect(r.revision.marcados).toEqual([]);
  });

  it('los pasos muestran r, K, ρ0, la escalera elegida y la alternativa', () => {
    const r = calculado(entradaFiltro('pasa-bajos', 'butterworth', 'T', 4, 100e6, { rl: 300 }));
    const latex = r.pasos.map((p) => p.latex);
    const textos = r.pasos.map((p) => p.texto).join('\n');
    for (const inicio of ['r = ', 'K = ', '\\alpha = ', '\\rho_0 = ']) {
      expect(
        latex.some((l) => l.startsWith(inicio)),
        inicio,
      ).toBe(true);
    }
    expect(textos).toMatch(/Escalera \(d\)/);
    expect(textos).toMatch(/alternativa \(a\)/);
    expect(textos).toMatch(/dispersión/);
    // Los valores de la alternativa, después de los de la elegida.
    expect(latex.filter((l) => l.startsWith('C_{4} = '))).toHaveLength(2);
  });

  it('cita a Takahasi y a Weinberg y Slepian', () => {
    const r = calculado(entradaFiltro('pasa-bajos', 'butterworth', 'T', 3, 100e6, { rl: 300 }));
    const autores = r.referencias.map((x) => x.autor);
    expect(autores).toContain('H. Takahasi');
    expect(autores).toContain('L. Weinberg y P. Slepian');
    expect(r.referencias.find((x) => x.autor === 'H. Takahasi')!.ubicacion).toMatch(/Sec\. 4\.10/);
    const iguales = calculado(entradaFiltro('pasa-bajos', 'butterworth', 'T', 3, 100e6));
    expect(iguales.referencias.map((x) => x.autor)).not.toContain('H. Takahasi');
  });

  it('las fórmulas son las de Takahasi', () => {
    const r = calculado(
      entradaFiltro('pasa-bajos', 'chebyshev', 'T', 3, 100e6, { rl: 300, ripple: 0.5 }),
    );
    expect(r.formulas.join(' ')).toContain('\\hat{a}');
  });

  it('no muestra la pérdida de Cohn: la ec. 4.13-11 supone terminaciones iguales', () => {
    const r = calculado(entradaFiltro('pasa-bajos', 'butterworth', 'T', 3, 100e6, { rl: 300 }));
    expect(r.perdidaCohn).toBeNull();
    expect(r.notas.some((n) => /Cohn/.test(n) && /Rs ≠ RL/.test(n))).toBe(true);
  });

  it('Bessel no se calcula: explica y ofrece Butterworth o redes de adaptación', () => {
    const r = calcularFiltro(entradaFiltro('pasa-bajos', 'bessel', 'π', 5, 100e6, { rl: 75 }));
    expect(r.estado === 'corte' && r.codigo).toBe('bessel-terminaciones-distintas');
    if (r.estado !== 'corte') return;
    expect(r.texto).toMatch(/Butterworth/);
    expect(r.texto).toMatch(/Calculadora de redes de adaptación/);
  });
});

describe('el Orden calculado con Rs ≠ RL', () => {
  it('Chebyshev admite el Orden par cuando r ≥ r_min', () => {
    const e = entradaFiltro('pasa-bajos', 'chebyshev', 'T', pedido(40, 200e6), 100e6, {
      ripple: 0.1,
      rl: 300,
    });
    const r = calculado(e);
    expect(r.orden).toBe(6);
    // La red entre Rs y RL atenúa en fs la real más la pérdida sobre K.
    const simulada = atenuacion(r, 200e6, e);
    const sobreK = perdidaSobreK('chebyshev', 6, 0.1, 50, 300);
    expect(simulada).toBeCloseTo(r.ordenCalculado!.atenuacionReal + sobreK, 6);
    expect(r.ordenCalculado!.atenuacionReal).toBeGreaterThanOrEqual(40);
    expect(r.notas.some((n) => /transmisión máxima/.test(n))).toBe(true);
  });

  it('con r < r_min el par sigue pasando al impar, y los pasos dicen por qué', () => {
    const r = calculado(
      entradaFiltro('pasa-bajos', 'chebyshev', 'T', pedido(40, 200e6), 100e6, {
        ripple: 0.1,
        rl: 60,
      }),
    );
    expect(r.orden).toBe(7);
    expect(r.pasos.some((p) => /r_min/.test(p.texto))).toBe(true);
  });
});

describe('la Topología por defecto con Rs ≠ RL', () => {
  it('con Orden par es la única que se puede armar, con su nota', () => {
    const t = topologiaSugerida('pasa-bajos', 'butterworth', 4, { ripple: null, rs: 50, rl: 300 });
    expect(t.topologia).toBe('T');
    expect(t.nota).toMatch(/solo se puede armar T/);
    const pi = topologiaSugerida('pasa-altos', 'chebyshev', 4, { ripple: 0.1, rs: 300, rl: 50 });
    expect(pi.topologia).toBe('π');
  });

  it('Chebyshev par con r < r_min se sugiere con el impar que se arma', () => {
    // Sube a 5: en pasa altos T lleva 2 bobinas y π 3.
    const t = topologiaSugerida('pasa-altos', 'chebyshev', 4, { ripple: 0.1, rs: 50, rl: 60 });
    expect(t.topologia).toBe('T');
  });

  it('con Orden impar sigue siendo la que usa menos bobinas', () => {
    const t = topologiaSugerida('pasa-bajos', 'butterworth', 5, { ripple: null, rs: 50, rl: 300 });
    expect(t.topologia).toBe('π');
  });
});
