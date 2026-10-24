import temml from 'temml';
import { describe, expect, it } from 'vitest';
import {
  type Atenuador,
  REFERENCIAS_ATENUADORES,
  calcularAtenuadores,
} from '../../../src/calculo/atenuadores/atenuadores';
import { dentroDeTolerancia, margen } from '../../casos';
import { CASOS_COMPORTAMIENTO, CASOS_REFERENCIA, CASOS_VALOR } from './casos';

function calculado(atenuacion: number, z1: number, z2: number) {
  const r = calcularAtenuadores({ atenuacion, z1, z2 });
  if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
  return r;
}

const valores = (a: Atenuador) => [a.r1, a.r2, a.r3].map((r) => r.valor);

describe('casos de referencia: pads T de la Fig. 8', () => {
  for (const caso of CASOS_REFERENCIA) {
    it(caso.id, () => {
      const { t } = calculado(caso.entradas.atenuacion, caso.entradas.z1, caso.entradas.z2);
      for (const nombre of ['r1', 'r2', 'r3'] as const) {
        const impreso = caso.esperado[nombre];
        const obtenido = t[nombre].valor;
        expect(
          dentroDeTolerancia(obtenido, impreso, caso.tolerancia, caso.diferencia),
          `${nombre}: ${obtenido} contra ${impreso} ± ${margen(caso.tolerancia, impreso)}`,
        ).toBe(true);
      }
    });
  }
});

describe('casos de comportamiento (spec §10.5)', () => {
  for (const caso of CASOS_COMPORTAMIENTO) {
    it(caso.id, () => {
      const r = calcularAtenuadores(caso.entradas);
      if ('corte' in caso.esperado) {
        expect(r.estado).toBe('corte');
        if (r.estado === 'corte') expect(r.codigo).toBe(caso.esperado.corte);
      } else {
        expect(r.estado).toBe('calculado');
        if (r.estado === 'calculado') {
          expect(r.avisos.map((a) => a.codigo)).toEqual(caso.esperado.avisos);
        }
      }
    });
  }

  it('debajo de A_min informa A_min y no da valores', () => {
    const r = calcularAtenuadores({ atenuacion: 5, z1: 50, z2: 75 });
    expect(r.estado).toBe('corte');
    if (r.estado !== 'corte') return;
    expect(r.aMin).toBeCloseTo(5.719475, 6);
    expect(r.texto).toContain('5,72 dB');
    expect(r.pasos.map((p) => p.latex).join(' ')).toContain('A_{\\mathrm{min}}');
  });

  it('A_min de 50 a 300 Ω', () => {
    const r = calcularAtenuadores({ atenuacion: 10, z1: 300, z2: 50 });
    expect(r.estado === 'corte' && r.aMin).toBeCloseTo(13.415226, 6);
  });

  it('nunca da una resistencia negativa ni infinita', () => {
    for (const [z1, z2] of [
      [50, 75],
      [75, 50],
      [50, 300],
      [300, 50],
      [50, 52],
    ]) {
      for (let a = 0.1; a <= 60; a += 0.1) {
        const r = calcularAtenuadores({ atenuacion: a, z1, z2 });
        if (r.estado !== 'calculado') continue;
        for (const v of [...valores(r.t), ...valores(r.pi)]) {
          expect(Number.isFinite(v) && v >= 0, `${z1} → ${z2}, ${a} dB: ${v}`).toBe(true);
        }
      }
    }
  });

  it('la nota fija de VHF va siempre', () => {
    const r = calculado(10, 50, 50);
    expect(r.notas.join(' ')).toMatch(/película o SMD.*no de alambre.*terminales cortos/);
  });
});

describe('valor impracticable en las resistencias (spec §5.6 y §10.5)', () => {
  for (const caso of CASOS_VALOR) {
    it(caso.id, () => {
      const r = calcularAtenuadores(caso.entradas);
      if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
      const niveles = (a: Atenuador) =>
        Object.fromEntries(a.revision.marcados.map((m) => [m.nombre, m.nivel]));
      expect(niveles(r.t)).toEqual(caso.esperado.t);
      expect(niveles(r.pi)).toEqual(caso.esperado.pi);
    });
  }

  it('con la frecuencia vacía se revisa a 300 MHz y el aviso lo dice', () => {
    const r = calculado(20, 50, 50);
    const aviso = r.avisos.find((a) => a.codigo === 'frecuencia-por-defecto');
    expect(aviso?.texto).toContain('300 MHz');
    expect(r.t.revision.marcados.find((m) => m.nombre === 'R3')?.motivo).toBe(
      'R3: suponiendo resistencia axial de película, 4,5 nH en serie → 84 % de error a 300 MHz',
    );
  });

  it('con frecuencia no hay aviso de la frecuencia', () => {
    const r = calcularAtenuadores({ atenuacion: 20, z1: 50, z2: 50, frecuencia: 145e6 });
    expect(r.estado === 'calculado' && r.avisos.map((a) => a.codigo)).toEqual([]);
  });

  it('la sugerencia es mirar la otra Topología', () => {
    const { t } = calculado(40, 50, 50);
    expect(t.revision.sugerencia).toBe(
      'Mirá la otra Topología (el π de 40 dB aguanta mucho mejor que el T).',
    );
  });

  it('la cuenta va al final de los pasos de cada red', () => {
    const { t } = calculado(40, 50, 50);
    expect(t.pasos.at(-1)?.texto).toBe('R3: reactancia parásita sobre R a 300 MHz');
    expect(t.pasos.at(-1)?.fuente).toMatch(/KOA.*Brinson/);
  });
});

describe('fórmulas generales (spec §10.2)', () => {
  it('con Z1 = Z2 dan las formas conocidas', () => {
    for (const a of [0.5, 3, 6, 10, 20, 40]) {
      const z0 = 50;
      const k = 10 ** (a / 20);
      const { t, pi } = calculado(a, z0, z0);
      const tSerie = (z0 * (k - 1)) / (k + 1);
      const tDeriv = (2 * k * z0) / (k * k - 1);
      const piDeriv = (z0 * (k + 1)) / (k - 1);
      const piSerie = (z0 * (k * k - 1)) / (2 * k);
      // Relativo: con 0,5 dB las derivaciones del π pasan de 1 kΩ.
      const igual = (obtenido: number, conocida: number) =>
        expect(Math.abs(obtenido / conocida - 1)).toBeLessThan(1e-12);
      igual(t.r1.valor, tSerie);
      igual(t.r2.valor, tSerie);
      igual(t.r3.valor, tDeriv);
      igual(pi.r1.valor, piDeriv);
      igual(pi.r2.valor, piDeriv);
      igual(pi.r3.valor, piSerie);
    }
  });

  it('el T de 10 dB de 50 Ω da 25,97 Ω y 35,14 Ω', () => {
    const { t } = calculado(10, 50, 50);
    expect(t.r1.valor).toBeCloseTo(25.97, 2);
    expect(t.r3.valor).toBeCloseTo(35.14, 2);
  });

  it('coinciden con el recálculo de la investigación (50 → 75 Ω, 10 dB)', () => {
    const { t, pi } = calculado(10, 50, 75);
    expect(valores(t).map((v) => v.toFixed(4))).toEqual(['18.0780', '48.6335', '43.0331']);
    expect(valores(pi).map((v) => v.toFixed(4))).toEqual(['77.1073', '207.4349', '87.1421']);
  });

  it('intercambiar Z1 y Z2 da el mismo atenuador al revés', () => {
    for (const [a, z1, z2] of [
      [10, 50, 75],
      [20, 50, 300],
      [14, 300, 50],
    ]) {
      const ida = calculado(a, z1, z2);
      const vuelta = calculado(a, z2, z1);
      for (const red of ['t', 'pi'] as const) {
        expect(ida[red].r1.valor).toBeCloseTo(vuelta[red].r2.valor, 9);
        expect(ida[red].r2.valor).toBeCloseTo(vuelta[red].r1.valor, 9);
        expect(ida[red].r3.valor).toBeCloseTo(vuelta[red].r3.valor, 9);
      }
    }
  });

  it('cada resistencia dice dónde está', () => {
    const { t, pi } = calculado(10, 50, 75);
    expect([t.r1, t.r2, t.r3].map((r) => [r.posicion, r.lado])).toEqual([
      ['serie', 'Z1'],
      ['serie', 'Z2'],
      ['derivacion', null],
    ]);
    expect([pi.r1, pi.r2, pi.r3].map((r) => [r.posicion, r.lado])).toEqual([
      ['derivacion', 'Z1'],
      ['derivacion', 'Z2'],
      ['serie', null],
    ]);
  });
});

describe('pasos intermedios (spec §10.6)', () => {
  const latex = (a: Atenuador) => a.pasos.map((p) => p.latex);

  it('K y N = K², con los números sustituidos', () => {
    const { t } = calculado(10, 50, 75);
    expect(latex(t)[0]).toBe('K = 10^{A/20} = 10^{10/20} = 3{,}162');
    expect(latex(t)[1]).toBe('N = K^2 = 10^{A/10} = 10');
  });

  it('A_min solo cuando Z1 ≠ Z2', () => {
    const tiene = (a: Atenuador) => latex(a).some((l) => l.startsWith('A_{\\mathrm{min}}'));
    expect(tiene(calculado(10, 50, 75).t)).toBe(true);
    expect(tiene(calculado(10, 50, 75).pi)).toBe(true);
    expect(tiene(calculado(10, 50, 50).t)).toBe(false);
  });

  it('cada resistencia con su fórmula y sus valores', () => {
    const { t } = calculado(10, 50, 75);
    expect(latex(t)).toContain(
      'R_3 = \\dfrac{2K\\sqrt{Z_1 Z_2}}{K^2 - 1} = ' +
        '\\dfrac{2 \\cdot 3{,}162 \\cdot \\sqrt{50 \\cdot 75}}{10 - 1} = 43{,}03\\,\\mathrm{\\Omega}',
    );
    expect(latex(t)).toContain(
      'R_1 = Z_1 \\dfrac{K^2 + 1}{K^2 - 1} - R_3 = ' +
        '50 \\cdot \\dfrac{10 + 1}{10 - 1} - 43{,}03 = 18{,}08\\,\\mathrm{\\Omega}',
    );
  });

  it('la verificación da Z1 a la entrada y la atenuación pedida', () => {
    for (const [a, z1, z2] of [
      [10, 50, 75],
      [6, 50, 75],
      [30, 300, 50],
      [0.3, 50, 50],
      [60, 50, 50],
    ]) {
      const r = calculado(a, z1, z2);
      for (const red of [r.t, r.pi]) {
        expect(Math.abs(red.verificacion.zEntrada / z1 - 1)).toBeLessThan(1e-9);
        expect(Math.abs(red.verificacion.atenuacion - a)).toBeLessThan(1e-9);
      }
    }
  });

  it('la verificación está en los pasos', () => {
    const { pi } = calculado(10, 50, 75);
    const todo = latex(pi).join('\n');
    expect(todo).toContain('Z_{\\mathrm{ent}}');
    expect(todo).toMatch(/= 50\\,\\mathrm\{\\Omega\}$/m);
    expect(todo).toMatch(/= 10\\,\\mathrm\{dB\}$/m);
  });

  it('con Z1 = Z2 los pasos usan las formas conocidas', () => {
    const { t, pi } = calculado(10, 50, 50);
    expect(latex(t).join(' ')).toContain('R_1 = R_2 = Z_0 \\dfrac{K - 1}{K + 1}');
    expect(latex(pi).join(' ')).toContain('R_1 = R_2 = Z_0 \\dfrac{K + 1}{K - 1}');
  });

  it('todas las fórmulas se dibujan con Temml sin errores', () => {
    const casos: [number, number, number][] = [
      [10, 50, 75],
      [10, 50, 50],
      [45, 300, 50],
      [5, 50, 75],
    ];
    for (const [a, z1, z2] of casos) {
      const r = calcularAtenuadores({ atenuacion: a, z1, z2 });
      const fuentes =
        r.estado === 'calculado'
          ? [r.t, r.pi].flatMap((red) => [...red.formulas, ...latex(red)])
          : r.pasos.map((p) => p.latex);
      for (const f of fuentes) {
        expect(() => temml.renderToString(f, { throwOnError: true, wrap: 'tex' })).not.toThrow();
      }
    }
  });
});

describe('referencia bibliográfica (spec §10.2)', () => {
  it('el Reference Data, 4.ª ed. y 1.ª ed., como datos', () => {
    expect(REFERENCIAS_ATENUADORES).toEqual([
      {
        obra: 'Reference Data for Radio Engineers',
        edicion: '4.ª',
        editor: 'ITT',
        anio: 1956,
        ubicacion: 'cap. 9, págs. 252-254',
      },
      {
        obra: 'Reference Data for Radio Engineers',
        edicion: '1.ª',
        anio: 1943,
        ubicacion: 'págs. 65-67',
      },
    ]);
  });

  it('cada atenuador la lleva', () => {
    const r = calculado(10, 50, 75);
    expect(r.referencias).toBe(REFERENCIAS_ATENUADORES);
  });
});
