import { describe, expect, it } from 'vitest';
import {
  type EntradaFiltro,
  type PedidoAtenuacion,
  type ResultadoFiltro,
  atenuacionPrototipo,
  calcularFiltro,
  frecuenciaNormalizada,
  ordenDesdeAtenuacion,
} from '../../../src/calculo/filtros/filtros';
import { MEDIA_UNIDAD, dentroDeTolerancia, margen } from '../../casos';
import {
  CASOS_COMPORTAMIENTO,
  CASOS_REFERENCIA_ORDEN,
  CASOS_VERIFICACION_ORDEN,
  TOLERANCIA_ORDEN_BESSEL_DB,
  TOLERANCIA_ORDEN_DB,
  entradaBanda,
  entradaFiltro,
  pedido,
} from './casos';
import { atenuacionOraculo, atenuacionResonadores } from './elementos';

// El Orden calculado desde una atenuación (spec §7.6): Ωs, las fórmulas de cada Aproximación, la
// atenuación real con el n elegido y los cortes.

function calculado(e: EntradaFiltro) {
  const r = calcularFiltro(e);
  if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
  return r;
}

// La atenuación de un resultado a la frecuencia f, con el oráculo de su forma.
function atenuacion(r: Extract<ResultadoFiltro, { estado: 'calculado' }>, f: number, r0: number) {
  return r.resonadores.length > 0
    ? atenuacionResonadores(r.resonadores, f, r0)
    : atenuacionOraculo(r.elementos, f, r0);
}

// El pedido de un caso: su orden es siempre una atenuación a una frecuencia.
const pedidoDe = (e: EntradaFiltro): PedidoAtenuacion => {
  if (typeof e.orden === 'number') throw new Error('el caso trae un Orden ingresado');
  return e.orden;
};

describe('casos de referencia: el ejemplo de Orden de Matthaei 8.04', () => {
  for (const caso of CASOS_REFERENCIA_ORDEN) {
    it(caso.id, () => {
      const { as, fs } = pedidoDe(caso.entradas);
      const o = ordenDesdeAtenuacion(caso.entradas, pedido(as, fs));
      if (o.estado !== 'calculado') throw new Error(`no calculó: ${o.codigo}`);
      // Ωs y n sin redondear salen de fórmulas: media unidad de lo impreso.
      expect(dentroDeTolerancia(o.omegaS, caso.omegaS, MEDIA_UNIDAD), `Ωs = ${o.omegaS}`).toBe(
        true,
      );
      expect(dentroDeTolerancia(o.nExacto!, caso.nExacto, MEDIA_UNIDAD), `n = ${o.nExacto}`).toBe(
        true,
      );
      for (const { n, impreso } of caso.atenuaciones) {
        const a = atenuacionPrototipo('chebyshev', n, o.omegaS, caso.entradas.ripple);
        expect(
          dentroDeTolerancia(a, impreso, caso.tolerancia),
          `n = ${n}: ${a} dB contra ${impreso} ± ${margen(caso.tolerancia, impreso)}`,
        ).toBe(true);
      }
    });
  }
});

describe('casos de verificación: el Orden calculado alcanza As en fs, simulado con el oráculo ABCD', () => {
  for (const caso of CASOS_VERIFICACION_ORDEN) {
    it(caso.id, () => {
      const { as, fs } = pedidoDe(caso.entradas);
      const { rs, aproximacion } = caso.entradas;
      const r = calculado(caso.entradas);
      expect(r.orden).toBe(caso.ordenEsperado);
      expect(r.ordenPedido).toBeNull();

      // La red armada llega a As en fs…
      const simulada = atenuacion(r, fs, rs);
      expect(simulada, `${simulada} dB contra As = ${as} dB`).toBeGreaterThanOrEqual(as);
      // …y la atenuación real que informa el Asistente es la de la red.
      const tolerancia =
        aproximacion === 'bessel' ? TOLERANCIA_ORDEN_BESSEL_DB : TOLERANCIA_ORDEN_DB;
      expect(Math.abs(simulada - r.ordenCalculado!.atenuacionReal)).toBeLessThanOrEqual(
        tolerancia.valor,
      );

      // El Orden anterior (el impar anterior en Chebyshev, que no se arma par) no llega: es el mínimo.
      const anterior = caso.ordenEsperado - (aproximacion === 'chebyshev' ? 2 : 1);
      if (anterior >= 1) {
        const corta = calculado({ ...caso.entradas, orden: anterior });
        const quedaCorta = atenuacion(corta, fs, rs);
        expect(quedaCorta, `n = ${anterior}: ${quedaCorta} dB`).toBeLessThan(as);
      }
    });
  }
});

describe('casos de comportamiento del Orden calculado', () => {
  const delOrden = CASOS_COMPORTAMIENTO.filter((c) => typeof c.entradas.orden !== 'number');
  it('hay casos de Bessel sin solución, Orden mayor que 10 y fs en la banda pasante', () => {
    const cortes = delOrden.flatMap((c) => ('corte' in c.esperado ? [c.esperado.corte] : []));
    expect(cortes).toEqual(
      expect.arrayContaining(['bessel-sin-solucion', 'orden-excedido', 'banda-pasante']),
    );
  });
});

describe('Ωs según el Tipo de filtro', () => {
  const base = { aproximacion: 'butterworth', ripple: null } as const;
  const f0 = Math.sqrt(88e6 * 108e6);
  const fbw = 20e6 / f0;

  it('pasa bajos: fs/fc', () => {
    expect(frecuenciaNormalizada({ ...base, tipo: 'pasa-bajos', fc: 100e6 }, 250e6)).toBeCloseTo(
      2.5,
      12,
    );
  });

  it('pasa altos: fc/fs', () => {
    expect(frecuenciaNormalizada({ ...base, tipo: 'pasa-altos', fc: 50e6 }, 20e6)).toBeCloseTo(
      2.5,
      12,
    );
  });

  it('pasa banda: |fs/f0 − f0/fs| / FBW, igual a los dos lados de la banda', () => {
    const e = { ...base, tipo: 'pasa-banda', banda: { f1: 88e6, f2: 108e6 } } as const;
    const abajo = frecuenciaNormalizada(e, 70e6);
    expect(abajo).toBeCloseTo(Math.abs(70e6 / f0 - f0 / 70e6) / fbw, 12);
    expect(abajo).toBeCloseTo(3.2886, 4);
    // La frecuencia espejo de 70 MHz, f0²/70 MHz, tiene el mismo Ωs.
    expect(frecuenciaNormalizada(e, f0 ** 2 / 70e6)).toBeCloseTo(abajo, 10);
  });

  it('rechaza banda: FBW / |fs/f0 − f0/fs|', () => {
    const e = { ...base, tipo: 'rechaza-banda', banda: { f1: 88e6, f2: 108e6 } } as const;
    expect(frecuenciaNormalizada(e, 92e6)).toBeCloseTo(fbw / Math.abs(92e6 / f0 - f0 / 92e6), 12);
    expect(frecuenciaNormalizada(e, f0)).toBe(Infinity);
  });

  it('con f0 y BW la banda es la misma que con f1 y f2', () => {
    const a = frecuenciaNormalizada(
      { ...base, tipo: 'pasa-banda', banda: { f1: 88e6, f2: 108e6 } },
      70e6,
    );
    const b = frecuenciaNormalizada({ ...base, tipo: 'pasa-banda', banda: { f0, bw: 20e6 } }, 70e6);
    expect(b).toBeCloseTo(a, 10);
  });
});

describe('la atenuación del prototipo', () => {
  it('Butterworth y Chebyshev: ec. 4.03-1 y 4.03-3', () => {
    expect(atenuacionPrototipo('butterworth', 5, 2, null)).toBeCloseTo(30.11, 2);
    expect(atenuacionPrototipo('chebyshev', 5, 2, 0.5)).toBeCloseTo(42.04, 2);
    // En el borde de la banda pasante de Chebyshev vale el ripple.
    expect(atenuacionPrototipo('chebyshev', 3, 1, 0.5)).toBeCloseTo(0.5, 10);
  });

  // La tabla de la investigación, calculada con scipy.signal.bessel(..., norm='mag'): 1 decimal.
  const SCIPY: Record<number, readonly number[]> = {
    1.5: [6.4, 7.1, 7.4, 7.4, 7.3, 7.2, 7.1, 7.0, 7.0],
    2: [9.8, 12.0, 13.4, 14.1, 14.2, 14.0, 13.7, 13.4, 13.1],
    3: [15.7, 20.9, 25.1, 28.3, 30.7, 32.3, 33.4, 34.0, 34.1],
    4: [20.4, 27.8, 34.4, 40.0, 44.7, 48.6, 51.8, 54.5, 56.7],
  };
  for (const [omega, fila] of Object.entries(SCIPY)) {
    it(`Bessel normalizado a −3 dB en Ω = ${omega}: n = 2 a 10 contra scipy`, () => {
      fila.forEach((esperado, i) => {
        const a = atenuacionPrototipo('bessel', i + 2, Number(omega), null);
        expect(Math.abs(a - esperado), `n = ${i + 2}: ${a} dB contra ${esperado}`).toBeLessThan(
          0.06,
        );
      });
    });
  }

  it('Bessel vale 3,01 dB en su fc para cualquier n', () => {
    for (let n = 1; n <= 10; n++) {
      expect(atenuacionPrototipo('bessel', n, 1, null)).toBeCloseTo(10 * Math.log10(2), 2);
    }
  });
});

describe('el Orden calculado', () => {
  const pasaBajos = (
    aproximacion: 'butterworth' | 'chebyshev' | 'bessel',
    ripple: number | null = null,
  ) => ({ tipo: 'pasa-bajos', aproximacion, ripple, fc: 100e6 }) as const;

  it('Butterworth: n ≥ log10(10^(As/10) − 1) / [2·log10 Ωs] (O1: 6,644 → 7)', () => {
    const o = ordenDesdeAtenuacion(pasaBajos('butterworth'), pedido(40, 200e6));
    if (o.estado !== 'calculado') throw new Error(o.codigo);
    expect(o.nExacto).toBeCloseTo(6.644, 3);
    expect(o.orden).toBe(7);
    expect(o.atenuacionReal).toBeCloseTo(10 * Math.log10(1 + 2 ** 14), 10);
  });

  it('Chebyshev: O2 (4,822 → 5) y O3 (5,450 → 6 → 7 por las terminaciones iguales)', () => {
    const o2 = ordenDesdeAtenuacion(pasaBajos('chebyshev', 0.5), pedido(40, 200e6));
    const o3 = ordenDesdeAtenuacion(pasaBajos('chebyshev', 0.1), pedido(40, 200e6));
    if (o2.estado !== 'calculado' || o3.estado !== 'calculado') throw new Error('sin solución');
    expect(o2.nExacto).toBeCloseTo(4.822, 3);
    expect(o2.orden).toBe(5);
    expect(o3.nExacto).toBeCloseTo(5.45, 2);
    expect(o3.orden).toBe(7);
  });

  it('Bessel: O6 evalúa n = 1, 2, … y se queda con el primero que cumple', () => {
    const o = ordenDesdeAtenuacion(pasaBajos('bessel'), pedido(30, 400e6));
    if (o.estado !== 'calculado') throw new Error(o.codigo);
    expect(o.orden).toBe(4);
    expect(o.nExacto).toBeNull();
    expect(o.atenuacionReal).toBeCloseTo(34.4, 1);
  });

  it('Bessel sin solución avisa "no alcanzable con Bessel de Orden ≤ 10" y sugiere otra Aproximación', () => {
    const o = ordenDesdeAtenuacion(pasaBajos('bessel'), pedido(20, 200e6));
    expect(o.estado).toBe('corte');
    if (o.estado !== 'corte') return;
    expect(o.codigo).toBe('bessel-sin-solucion');
    expect(o.texto).toContain('no alcanzable con Bessel de Orden ≤ 10');
    expect(o.texto).toMatch(/Butterworth o Chebyshev/);
    // Dice lo máximo que llega: 14,17 dB con n = 6 (scipy: 14,2).
    expect(o.texto).toContain('14,17 dB, con Orden 6');
  });

  it('un Orden mayor que 10 avisa y no se calcula, con el n que haría falta', () => {
    const o = ordenDesdeAtenuacion(pasaBajos('butterworth'), pedido(100, 120e6));
    expect(o.estado).toBe('corte');
    if (o.estado !== 'corte') return;
    expect(o.codigo).toBe('orden-excedido');
    // n = log10(10^10 − 1) / (2·log10 1,2) = 63,1: el texto lo dice.
    expect(o.texto).toContain('63');
  });

  it('un Orden exactamente 10 se calcula', () => {
    const a10 = atenuacionPrototipo('butterworth', 10, 1.5, null);
    const o = ordenDesdeAtenuacion(pasaBajos('butterworth'), pedido(a10 - 0.001, 150e6));
    if (o.estado !== 'calculado') throw new Error(o.codigo);
    expect(o.orden).toBe(10);
  });

  it('fs en la banda pasante (Ωs ≤ 1) no tiene solución', () => {
    for (const fs of [50e6, 100e6]) {
      const o = ordenDesdeAtenuacion(pasaBajos('butterworth'), pedido(40, fs));
      expect(o.estado === 'corte' && o.codigo).toBe('banda-pasante');
    }
  });

  it('la atenuación real nunca queda por debajo de la pedida', () => {
    const o = ordenDesdeAtenuacion(pasaBajos('butterworth'), pedido(40, 200e6));
    if (o.estado !== 'calculado') throw new Error(o.codigo);
    expect(o.atenuacionReal).toBeGreaterThanOrEqual(40);
  });

  it('el redondeo no deja un n corto: As igual a la de un n entero lo acepta', () => {
    const exacta = atenuacionPrototipo('butterworth', 4, 2, null);
    const o = ordenDesdeAtenuacion(pasaBajos('butterworth'), pedido(exacta, 200e6));
    if (o.estado !== 'calculado') throw new Error(o.codigo);
    expect(o.orden).toBe(4);
  });
});

describe('el resultado con Orden calculado', () => {
  const entrada = entradaFiltro('pasa-bajos', 'butterworth', 'π', pedido(40, 200e6), 100e6);

  it('trae el Orden calculado y la atenuación real en fs', () => {
    const r = calculado(entrada);
    expect(r.orden).toBe(7);
    expect(r.elementos).toHaveLength(7);
    expect(r.ordenPedido).toBeNull();
    expect(r.ordenCalculado).toMatchObject({ as: 40, fs: 200e6, orden: 7 });
    expect(r.ordenCalculado!.omegaS).toBeCloseTo(2, 12);
    expect(r.ordenCalculado!.atenuacionReal).toBeCloseTo(42.14, 2);
  });

  it('con el Orden ingresado no hay Orden calculado', () => {
    const r = calculado(entradaFiltro('pasa-bajos', 'butterworth', 'π', 5, 100e6));
    expect(r.ordenCalculado).toBeNull();
    expect(r.ordenPedido).toBe(5);
  });

  it('los pasos muestran Ωs y la fórmula del Orden con sus valores, antes de los g', () => {
    const r = calculado(entrada);
    const iOmega = r.pasos.findIndex((p) => p.latex.startsWith('\\Omega_s'));
    const iOrden = r.pasos.findIndex((p) => p.latex.startsWith('n \\ge'));
    const iG1 = r.pasos.findIndex((p) => p.latex.startsWith('g_{1}'));
    expect(iOmega).toBeGreaterThanOrEqual(0);
    expect(iOrden).toBeGreaterThan(iOmega);
    expect(iG1).toBeGreaterThan(iOrden);
    // Los valores sustituidos: As = 40 dB y el n sin redondear, 6,64.
    expect(r.pasos[iOrden].latex).toContain('40');
    expect(r.pasos[iOrden].latex).toContain('6{,}64');
  });

  it('en Chebyshev los pasos explican por qué un n par pasa al impar', () => {
    const r = calculado(
      entradaFiltro('pasa-bajos', 'chebyshev', 'π', pedido(40, 200e6), 100e6, { ripple: 0.1 }),
    );
    const texto = r.pasos.map((p) => p.texto).join('\n');
    expect(texto).toMatch(/Orden 6/);
    expect(texto).toMatch(/Orden 7/);
  });

  it('en Bessel los pasos muestran la atenuación de cada n probado', () => {
    const r = calculado(entradaFiltro('pasa-bajos', 'bessel', 'π', pedido(30, 400e6), 100e6));
    const probados = r.pasos.filter((p) => /^Bessel de Orden \d+: /.test(p.texto));
    expect(probados.map((p) => p.texto.match(/\d+/)![0])).toEqual(['1', '2', '3', '4']);
  });

  it('con Rs ≠ RL sigue sin calcular', () => {
    const r = calcularFiltro({ ...entrada, rl: 75 });
    expect(r.estado === 'corte' && r.codigo).toBe('terminaciones-distintas');
  });

  it('un pedido inválido corta como entrada inválida', () => {
    for (const p of [pedido(-3, 200e6), pedido(40, 0), pedido(NaN, 200e6), pedido(40, Infinity)]) {
      const r = calcularFiltro(entradaFiltro('pasa-bajos', 'butterworth', 'π', p, 100e6));
      expect(r.estado === 'corte' && r.codigo, JSON.stringify(p)).toBe('entrada-invalida');
    }
  });

  it('rechaza banda con fs en la central: atenuación infinita y Orden 1', () => {
    const r = calculado(
      entradaBanda('rechaza-banda', 'butterworth', 'T', pedido(60, Math.sqrt(88e6 * 108e6)), {
        f1: 88e6,
        f2: 108e6,
      }),
    );
    expect(r.orden).toBe(1);
    expect(r.ordenCalculado!.atenuacionReal).toBe(Infinity);
  });
});
