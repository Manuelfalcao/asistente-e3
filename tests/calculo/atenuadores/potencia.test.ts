import temml from 'temml';
import { describe, expect, it } from 'vitest';
import {
  type PotenciaRed,
  NOTAS_ATENUADORES,
  calcularAtenuadores,
  calcularMinimaPerdida,
} from '../../../src/calculo/atenuadores/atenuadores';
import { leerCampo } from '../../../src/entrada/campo';
import { POTENCIA } from '../../../src/ui/atenuadores/campos';
import { MEDIA_UNIDAD, dentroDeTolerancia } from '../../casos';
import { CASOS_POTENCIA } from './casos-pad';

function calculado(atenuacion: number, z1: number, z2: number, potencia?: number | null) {
  const r = calcularAtenuadores({ atenuacion, z1, z2, potencia });
  if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
  return r;
}

const de = (p: PotenciaRed | null, nombre: string) => {
  const r = p?.resistencias.find((x) => x.nombre === nombre);
  if (!r) throw new Error(`sin potencia de ${nombre}`);
  return r;
};

describe('potencia disipada (spec §10.3)', () => {
  for (const caso of CASOS_POTENCIA) {
    it(`${caso.id}: ${caso.entradas.z1} → ${caso.entradas.z2} Ω, ${caso.entradas.atenuacion} dB, 1 W`, () => {
      const r = calculado(
        caso.entradas.atenuacion,
        caso.entradas.z1,
        caso.entradas.z2,
        caso.entradas.potencia,
      );
      for (const [clave, ternas] of Object.entries(caso.esperado) as [
        't' | 'pi',
        { r1: string; r2: string; r3: string },
      ][]) {
        for (const nombre of ['r1', 'r2', 'r3'] as const) {
          const obtenido = de(r[clave].potencia, nombre.toUpperCase()).disipada;
          expect(
            dentroDeTolerancia(obtenido, ternas[nombre], MEDIA_UNIDAD),
            `${clave} ${nombre}: ${obtenido} contra ${ternas[nombre]}`,
          ).toBe(true);
        }
      }
    });
  }

  it('sin potencia de entrada no hay potencias', () => {
    const r = calculado(10, 50, 50);
    expect(r.t.potencia).toBeNull();
    expect(r.pi.potencia).toBeNull();
    const r2 = calculado(10, 50, 50, null);
    expect(r2.t.potencia).toBeNull();
  });

  it('lo que no disipan las resistencias llega a la carga: P − P/K²', () => {
    for (const [a, z1, z2] of [
      [10, 50, 50],
      [10, 50, 75],
      [20, 300, 50],
      [3, 50, 50],
      [40, 75, 50],
    ]) {
      const r = calculado(a, z1, z2, 2.5);
      const llegaAlaCarga = 2.5 / 10 ** (a / 10);
      for (const red of [r.t, r.pi]) {
        const disipada = red.potencia!.resistencias.reduce((s, x) => s + x.disipada, 0);
        expect(disipada + llegaAlaCarga).toBeCloseTo(2.5, 9);
      }
    }
  });

  it('la potencia de entrada se escala: el doble de potencia, el doble en cada resistencia', () => {
    const uno = calculado(10, 50, 75, 1).t.potencia!;
    const dos = calculado(10, 50, 75, 2).t.potencia!;
    for (const x of uno.resistencias) {
      expect(de(dos, x.nombre).disipada).toBeCloseTo(2 * x.disipada, 12);
    }
  });

  it('casi toda la potencia queda en la resistencia del lado de la entrada', () => {
    const { t } = calculado(20, 50, 50, 1);
    expect(de(t.potencia, 'R1').disipada).toBeGreaterThan(0.8);
    expect(de(t.potencia, 'R2').disipada).toBeLessThan(0.01);
  });

  it('con Z1 = Z2 el T y el π disipan lo mismo en la resistencia de entrada', () => {
    const r = calculado(10, 50, 50, 1);
    expect(de(r.t.potencia, 'R1').disipada).toBeCloseTo(de(r.pi.potencia, 'R1').disipada, 12);
  });
});

describe('margen de potencia (spec §10.3)', () => {
  it('la nominal mínima sugerida es el doble de la disipada', () => {
    const { t, pi } = calculado(10, 50, 75, 1);
    for (const red of [t, pi]) {
      expect(red.potencia!.margen).toBe(2);
      for (const x of red.potencia!.resistencias) {
        expect(x.nominalMinima).toBeCloseTo(2 * x.disipada, 12);
      }
    }
  });

  it('el margen es un criterio de diseño y no asume potencias comerciales', () => {
    const { t } = calculado(10, 50, 50, 1);
    // 2 × 0,5195 W = 1,039 W: no se redondea a ningún valor de una lista
    expect(de(t.potencia, 'R1').nominalMinima).toBeCloseTo(1.039, 3);
    expect(de(t.potencia, 'R1').nominalMinima).not.toBe(1);
    expect(Object.keys(t.potencia!).sort()).toEqual(['entrada', 'margen', 'resistencias']);
  });

  it('los pasos muestran la disipada y la nominal con los números sustituidos', () => {
    const { t } = calculado(10, 50, 50, 1);
    const latex = t.pasos.map((p) => p.latex);
    expect(latex).toContain(
      'P_{R_1} = P \\dfrac{R_1}{Z_1} = 1\\,\\mathrm{W} \\cdot \\dfrac{25{,}97\\,\\mathrm{\\Omega}}{50\\,\\mathrm{\\Omega}} = ' +
        '519{,}5\\,\\mathrm{mW}',
    );
    expect(latex.some((l) => l.startsWith('P_{\\mathrm{nom}}') && l.includes('2 \\cdot'))).toBe(
      true,
    );
  });

  it('las fórmulas de potencia van a la vista solo si hay potencia', () => {
    expect(calculado(10, 50, 50).t.formulas.join(' ')).not.toContain('P_{R_1}');
    const con = calculado(10, 50, 50, 1);
    expect(con.t.formulas.join(' ')).toContain('P_{R_1} = P \\dfrac{R_1}{Z_1}');
    expect(con.pi.formulas.join(' ')).toContain('P_{R_1} = P \\dfrac{Z_1}{R_1}');
  });

  it('la cuenta del criterio de valor impracticable sigue al final de los pasos', () => {
    const { t } = calculado(40, 50, 50, 1);
    expect(t.pasos.at(-1)?.texto).toBe('R3: reactancia parásita sobre R a 300 MHz');
  });

  it('todas las fórmulas de potencia se dibujan con Temml sin errores', () => {
    for (const [a, z1, z2] of [
      [10, 50, 75],
      [20, 300, 50],
      [10, 50, 50],
    ]) {
      const r = calculado(a, z1, z2, 0.75);
      for (const red of [r.t, r.pi]) {
        for (const f of [...red.formulas, ...red.pasos.map((p) => p.latex)]) {
          expect(() => temml.renderToString(f, { throwOnError: true, wrap: 'tex' })).not.toThrow();
        }
      }
    }
  });
});

describe('potencia de entrada en dBm (spec §10.1)', () => {
  const leida = (texto: string, unidad: string) => {
    const e = leerCampo(texto, { ...POTENCIA, unidad });
    if (e.estado !== 'valido') throw new Error(`no se leyó "${texto}"`);
    return e.valor;
  };

  it('30 dBm son 1 W: las mismas potencias que con 1 W', () => {
    const enDbm = calculado(10, 50, 75, leida('30', 'dBm'));
    const enW = calculado(10, 50, 75, leida('1', 'W'));
    for (const red of ['t', 'pi'] as const) {
      for (const x of enW[red].potencia!.resistencias) {
        expect(de(enDbm[red].potencia, x.nombre).disipada).toBeCloseTo(x.disipada, 12);
      }
    }
    expect(enDbm.t.potencia!.entrada).toBeCloseTo(1, 12);
  });

  it('0 dBm son 1 mW, y "20 dBm" escrito con la unidad también', () => {
    expect(calculado(10, 50, 50, leida('0', 'dBm')).t.potencia!.entrada).toBeCloseTo(1e-3, 15);
    expect(calculado(10, 50, 50, leida('20 dBm', 'W')).t.potencia!.entrada).toBeCloseTo(0.1, 12);
    expect(calculado(10, 50, 50, leida('250 mW', 'W')).t.potencia!.entrada).toBeCloseTo(0.25, 12);
  });

  it('con 10 dBm, el T de 10 dB disipa 5,195 mW en R1', () => {
    const { t } = calculado(10, 50, 50, leida('10', 'dBm'));
    expect(de(t.potencia, 'R1').disipada).toBeCloseTo(5.195e-3, 6);
  });
});

describe('potencia en el pad de mínima pérdida', () => {
  const pad = (z1: number, z2: number, potencia: number | null) => {
    const r = calcularMinimaPerdida({ z1, z2, potencia });
    if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
    return r;
  };

  it('sin potencia de entrada, nada', () => {
    expect(pad(50, 75, null).pad.potencia).toBeNull();
  });

  it('suma lo mismo que lo que no llega a la carga, con la serie de cualquier lado', () => {
    for (const [z1, z2] of [
      [75, 50],
      [50, 75],
      [300, 50],
      [50, 300],
    ]) {
      const r = pad(z1, z2, 1);
      const disipada = r.pad.potencia!.resistencias.reduce((s, x) => s + x.disipada, 0);
      expect(disipada + 1 / r.k ** 2).toBeCloseTo(1, 9);
    }
  });

  it('cada resistencia lleva su margen de 2× y su nombre', () => {
    const { pad: p } = pad(50, 75, 1);
    expect(p.potencia!.resistencias.map((x) => x.nombre)).toEqual(['R1', 'R3']);
    for (const x of p.potencia!.resistencias)
      expect(x.nominalMinima).toBeCloseTo(2 * x.disipada, 12);
  });
});

describe('nota de potencia continua (spec §10.3)', () => {
  it('es fija: va junto a la de VHF', () => {
    const notas = NOTAS_ATENUADORES.join(' ');
    expect(notas).toMatch(/potencia continua/);
    expect(notas).toMatch(/señales moduladas.*potencia de pico/);
    expect(calculado(10, 50, 50).notas).toBe(NOTAS_ATENUADORES);
    const r = calcularMinimaPerdida({ z1: 50, z2: 75 });
    expect(r.estado === 'calculado' && r.notas).toBe(NOTAS_ATENUADORES);
  });
});
