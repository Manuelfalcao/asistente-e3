import temml from 'temml';
import { describe, expect, it } from 'vitest';
import { revisarValores, umbrales } from '../../../src/calculo/comun/valor-impracticable';
import { dentroDeTolerancia, margen } from '../../casos';
import { CASOS_CORTES, CASOS_UMBRALES } from './casos';

const L = (nombre: string, nH: number) => ({ componente: 'L' as const, nombre, valor: nH * 1e-9 });
const C = (nombre: string, pF: number) => ({ componente: 'C' as const, nombre, valor: pF * 1e-12 });
const R = (nombre: string, ohms: number) => ({ componente: 'R' as const, nombre, valor: ohms });

describe('revisión de cada L, C y R (spec §5.6)', () => {
  it('una L de 5 nH es Valor impracticable por los ±3 nH del montaje', () => {
    const r = revisarValores({ l1: L('L1', 5) }, null);
    expect(r.marcados).toEqual([
      expect.objectContaining({
        nombre: 'L1',
        nivel: 'impracticable',
        motivo: 'L1: suponiendo montaje Manhattan, ±3 nH → 60 % de error',
      }),
    ]);
  });

  it('una C de 2 pF es Valor dudoso por los ±0,5 pF del montaje (el ejemplo de §5.6)', () => {
    const r = revisarValores({ c1: C('C1', 2) }, null);
    expect(r.marcados).toEqual([
      expect.objectContaining({
        nombre: 'C1',
        nivel: 'dudoso',
        motivo: 'C1: suponiendo montaje Manhattan, ±0,5 pF → 25 % de error',
      }),
    ]);
  });

  it('una C de 100 pF a 150 MHz está cerca de su autorresonancia: Valor dudoso', () => {
    // f_SRF = 1/(2π·√(2,8 nH · 100 pF)) = 300,8 MHz; (f/f_SRF)² = 0,2487 → 0,2487/0,7513 = 33 %.
    const r = revisarValores({ c1: C('C1', 100) }, 150e6);
    expect(r.marcados).toEqual([
      expect.objectContaining({
        nivel: 'dudoso',
        motivo: 'C1: cerca de su autorresonancia (ESL de 2,8 nH) → 33 % de error a 150 MHz',
      }),
    ]);
    expect(r.marcados[0].error).toBeCloseTo(0.331, 3);
  });

  it('una C por encima de su autorresonancia es Valor impracticable', () => {
    const r = revisarValores({ c1: C('C1', 1000) }, 300e6);
    expect(r.marcados).toEqual([
      expect.objectContaining({
        nivel: 'impracticable',
        motivo: 'C1: por encima de su autorresonancia (ESL de 2,8 nH) a 300 MHz',
      }),
    ]);
  });

  it('una R chica: la inductancia del axial en serie', () => {
    // ω·Ls/R = 2π · 150 MHz · 4,5 nH / 10,1 Ω = 0,42.
    const r = revisarValores({ r3: R('R3', 10.1) }, 150e6);
    expect(r.marcados).toEqual([
      expect.objectContaining({
        nivel: 'dudoso',
        motivo:
          'R3: suponiendo resistencia axial de película, 4,5 nH en serie → 42 % de error a 150 MHz',
      }),
    ]);
  });

  it('una R grande: la capacidad del axial en paralelo', () => {
    // ω·Cp·R = 2π · 150 MHz · 0,43 pF · 2 kΩ = 0,81.
    const r = revisarValores({ r1: R('R1', 2000) }, 150e6);
    expect(r.marcados).toEqual([
      expect.objectContaining({
        nivel: 'impracticable',
        motivo:
          'R1: suponiendo resistencia axial de película, 0,43 pF en paralelo → 81 % de error a 150 MHz',
      }),
    ]);
  });

  it('sin frecuencia no se revisan la C máxima ni las R', () => {
    const r = revisarValores({ c1: C('C1', 10000), r1: R('R1', 0.1), r2: R('R2', 1e6) }, null);
    expect(r.marcados).toEqual([]);
  });

  it('no hay L máxima común', () => {
    expect(revisarValores({ l1: L('L1', 100000) }, 300e6).marcados).toEqual([]);
  });

  it('nunca bloquea: un valor sano no se marca', () => {
    const r = revisarValores({ l1: L('L1', 100), c1: C('C1', 10), r1: R('R1', 50) }, 145e6);
    expect(r.marcados).toEqual([]);
  });

  it('encuentra cada valor a cualquier profundidad y una sola vez', () => {
    const r1 = R('R1', 1);
    const resultado = {
      tarjetas: [{ valores: [r1, L('L2', 2)] }, { otra: { mas: C('C3', 0.5) } }],
      repetida: r1,
      texto: 'R1',
      numero: 3,
      nada: null,
    };
    const r = revisarValores(resultado, 30e6);
    expect(r.marcados.map((m) => m.nombre)).toEqual(['R1', 'L2', 'C3']);
  });
});

describe('la cuenta en los pasos intermedios, con sus fuentes', () => {
  it('L: ΔL/L, con la Circular 74 para los terminales', () => {
    const { pasos } = revisarValores({ l1: L('L1', 5) }, null);
    expect(pasos).toEqual([
      {
        texto: 'L1: incertidumbre del montaje sobre L',
        latex: '\\dfrac{\\Delta L}{L} = \\dfrac{3\\,\\mathrm{nH}}{5\\,\\mathrm{nH}} = 0{,}6',
        fuente: expect.stringContaining('Circular 74'),
      },
    ]);
  });

  it('C chica: ΔC/C', () => {
    const { pasos } = revisarValores({ c1: C('C1', 2) }, null);
    expect(pasos.map((p) => p.latex)).toEqual([
      '\\dfrac{\\Delta C}{C} = \\dfrac{0{,}5\\,\\mathrm{pF}}{2\\,\\mathrm{pF}} = 0{,}25',
    ]);
  });

  it('C cerca de su autorresonancia: f_SRF y f/f_SRF, con KYOCERA AVX para la ESL', () => {
    const { pasos } = revisarValores({ c1: C('C1', 100) }, 150e6);
    const latex = pasos.map((p) => p.latex).join('\n');
    expect(latex).toContain('f_{\\mathrm{SRF}} = ');
    expect(latex).toContain('= 300{,}8\\,\\mathrm{MHz}');
    expect(latex).toMatch(/= 0\{,\}3311$/);
    expect(pasos.map((p) => p.fuente).join(' ')).toContain('KYOCERA AVX');
  });

  it('R: X/R, con KOA y Brinson', () => {
    const { pasos } = revisarValores({ r3: R('R3', 10.1) }, 150e6);
    expect(pasos).toEqual([
      {
        texto: 'R3: reactancia parásita sobre R a 150 MHz',
        latex:
          '\\dfrac{\\omega L_s}{R} = ' +
          '\\dfrac{2\\pi \\cdot 150\\,\\mathrm{MHz} \\cdot 4{,}5\\,\\mathrm{nH}}{10{,}1\\,\\mathrm{\\Omega}} = 0{,}4199',
        fuente: expect.stringMatching(/KOA.*Brinson/),
      },
    ]);
  });

  it('R grande: ω·Cp·R', () => {
    const { pasos } = revisarValores({ r1: R('R1', 2000) }, 150e6);
    expect(pasos[0].latex).toBe(
      '\\omega C_p R = 2\\pi \\cdot 150\\,\\mathrm{MHz} \\cdot 0{,}43\\,\\mathrm{pF} ' +
        '\\cdot 2\\,\\mathrm{k\\Omega} = 0{,}8105',
    );
  });

  it('todas las cuentas se dibujan con Temml sin errores', () => {
    const resultado = [
      L('L1', 5),
      C('C1', 2),
      C('C2', 100),
      C('C3', 1000),
      R('R1', 1),
      R('R2', 1e4),
    ];
    const { pasos } = revisarValores(resultado, 300e6);
    expect(pasos.length).toBeGreaterThanOrEqual(6);
    for (const p of pasos) {
      expect(() =>
        temml.renderToString(p.latex, { throwOnError: true, wrap: 'tex' }),
      ).not.toThrow();
    }
  });

  it('un valor sin marca no suma pasos', () => {
    expect(revisarValores({ l1: L('L1', 100), r1: R('R1', 50) }, 145e6).pasos).toEqual([]);
  });
});

describe('casos de verificación: la tabla de umbrales de §5.6, recalculada desde la medida', () => {
  for (const caso of CASOS_UMBRALES) {
    it(caso.id, () => {
      const corte = umbrales(caso.frecuencia)[caso.corte];
      expect(corte, 'sin frecuencia no hay corte').not.toBeNull();
      const obtenido = corte![caso.nivel] / caso.unidad.escala;
      expect(
        dentroDeTolerancia(obtenido, caso.esperado, caso.tolerancia),
        `${obtenido} ${caso.unidad.nombre} contra ${caso.esperado} ± ${margen(caso.tolerancia, caso.esperado)}`,
      ).toBe(true);
    });
  }

  it('sin frecuencia solo quedan los mínimos de L y C', () => {
    const sinF = umbrales(null);
    expect(sinF.cMax).toBeNull();
    expect(sinF.rMin).toBeNull();
    expect(sinF.rMax).toBeNull();
    expect(sinF.lMin).not.toBeNull();
    expect(sinF.cMin).not.toBeNull();
  });
});

describe('casos de verificación: un valor de cada lado de cada corte', () => {
  for (const caso of CASOS_CORTES) {
    it(caso.id, () => {
      const r = revisarValores({ valor: caso.componente }, caso.frecuencia);
      expect(r.marcados[0]?.nivel ?? null).toBe(caso.esperado);
    });
  }
});
