import { describe, expect, it } from 'vitest';
import { respuesta } from '../../../src/calculo/comun/barrido';
import type { Filtrado } from '../../../src/calculo/comun/red-l';
import {
  type EntradaRedL,
  type VarianteL,
  NOTAS_REDES,
  REFERENCIAS_RED_L,
  SUGERENCIA_REDES,
  calcularRedL,
} from '../../../src/calculo/redes/redes';
import { dentroDeTolerancia, margen } from '../../casos';
import {
  CASOS_ANCHO_DE_BANDA,
  CASOS_COMPORTAMIENTO,
  CASOS_REFERENCIA,
  TOLERANCIA_ORACULO,
} from './casos';
import { cruceDeGamma } from './elementos';
import { recorrerBarrido, recorrerGrilla } from './grilla';

// La red L de la Calculadora de redes de adaptación (spec §9 y §13.3).

function calculado(e: EntradaRedL) {
  const r = calcularRedL(e);
  if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
  return r;
}

const de = (variantes: readonly VarianteL[], filtrado: Filtrado) =>
  variantes.find((v) => v.filtrado === filtrado)!;

const nombre = (v: VarianteL, componente: 'L' | 'C') =>
  v.componentes.find((x) => x.componente === componente)!;

describe('casos de referencia', () => {
  for (const caso of CASOS_REFERENCIA) {
    it(caso.id, () => {
      const v = de(calculado(caso.entradas).variantes, caso.variante);
      const l = nombre(v, 'L').valor * 1e9;
      const cc = nombre(v, 'C').valor * 1e12;
      const { l: impresoL, c: impresoC } = caso.esperado;
      expect(
        dentroDeTolerancia(l, impresoL, caso.tolerancia),
        `L ${l} nH contra ${impresoL} ± ${margen(caso.tolerancia, impresoL)}`,
      ).toBe(true);
      expect(
        dentroDeTolerancia(cc, impresoC, caso.tolerancia),
        `C ${cc} pF contra ${impresoC} ± ${margen(caso.tolerancia, impresoC)}`,
      ).toBe(true);
    });
  }
});

describe('la red L', () => {
  it('Bowick 4-1: Q = 3, L en serie del lado de 100 Ω y C en derivación del de 1000 Ω', () => {
    const r = calculado({ f0: 100e6, rs: 100, rl: 1000, qBobina: 100 });
    expect(r.q).toBeCloseTo(3, 14);
    const pb = de(r.variantes, 'pasa-bajos');
    expect(pb.componentes.map((x) => [x.nombre, x.posicion, x.lado])).toEqual([
      ['L1', 'serie', 'R_s'],
      ['C1', 'derivacion', 'R_L'],
    ]);
    expect(pb.componentes[0].reactancia).toBeCloseTo(300, 10);
    expect(pb.componentes[1].reactancia).toBeCloseTo(-1000 / 3, 10);
  });

  it('pasa altos: C en serie de 5,305 pF y L en derivación de 530,5 nH (L1′ de la investigación)', () => {
    const pa = de(
      calculado({ f0: 100e6, rs: 100, rl: 1000, qBobina: 100 }).variantes,
      'pasa-altos',
    );
    expect(pa.componentes.map((x) => [x.nombre, x.posicion])).toEqual([
      ['C1', 'serie'],
      ['L1', 'derivacion'],
    ]);
    expect(pa.componentes[0].valor).toBeCloseTo(5.305e-12, 15);
    expect(pa.componentes[1].valor).toBeCloseTo(530.5e-9, 10);
  });

  it('con R_s mayor que R_L la derivación va del lado de la fuente', () => {
    const pb = de(
      calculado({ f0: 100e6, rs: 1000, rl: 100, qBobina: 100 }).variantes,
      'pasa-bajos',
    );
    expect(pb.componentes.map((x) => [x.nombre, x.posicion, x.lado])).toEqual([
      ['C1', 'derivacion', 'R_s'],
      ['L1', 'serie', 'R_L'],
    ]);
  });

  it('pasa bajos primero, y cada una con las etiquetas de Bowick', () => {
    const r = calculado({ f0: 100e6, rs: 50, rl: 200, qBobina: 100 });
    expect(r.variantes.map((v) => v.filtrado)).toEqual(['pasa-bajos', 'pasa-altos']);
    expect(r.variantes[0].etiquetas).toEqual(['deja pasar la continua', 'atenúa armónicas']);
    expect(r.variantes[1].etiquetas).toEqual(['bloquea la continua']);
  });

  it('Zin con R_L conectada es R_s en f₀', () => {
    for (const [rs, rl] of [
      [100, 1000],
      [1000, 100],
    ]) {
      for (const v of calculado({ f0: 145e6, rs, rl, qBobina: 100 }).variantes) {
        expect(Math.abs(v.zEntrada.re / rs - 1)).toBeLessThan(1e-12);
        expect(Math.abs(v.zEntrada.im / rs)).toBeLessThan(1e-12);
      }
    }
  });

  it('el resultado principal es el Q con su fórmula, sus pasos y las referencias de la red L', () => {
    const r = calculado({ f0: 100e6, rs: 100, rl: 1000, qBobina: 100 });
    expect(r.formula).toContain('\\sqrt');
    expect(r.pasos[0].latex).toContain('= 3');
    expect(r.referencias).toBe(REFERENCIAS_RED_L);
    expect(REFERENCIAS_RED_L.map((x) => x.obra)).toEqual([
      'RF Circuit Design',
      'Impedance Matching Networks Applied to RF Power Transistors',
    ]);
    expect(r.notas).toBe(NOTAS_REDES);
    expect(NOTAS_REDES.some((n) => n.includes('trimmer'))).toBe(true);
  });

  it('los pasos de cada variante: la transformación serie a paralelo y la verificación de Zin', () => {
    const v = calculado({ f0: 100e6, rs: 100, rl: 1000, qBobina: 100 }).variantes[0];
    const textos = v.pasos.map((p) => p.texto);
    expect(textos.some((t) => t.includes('pasada a paralelo'))).toBe(true);
    expect(textos.some((t) => t.startsWith('Verificación: impedancia de entrada'))).toBe(true);
    const zin = v.pasos.find((p) => p.texto.startsWith('Verificación'))!;
    expect(zin.latex).toMatch(/= 100 \+ j0\\,\\mathrm\{\\Omega\}$/);
  });
});

describe('barrido y pérdida', () => {
  it('Bowick 4-1: f₀/BW de 1,32 en el pasa bajos y 0,94 en el pasa altos', () => {
    const r = calculado({ f0: 100e6, rs: 100, rl: 1000, qBobina: 100 });
    expect(de(r.variantes, 'pasa-bajos').barrido.f0SobreBw!).toBeCloseTo(1.32, 2);
    expect(de(r.variantes, 'pasa-altos').barrido.f0SobreBw!).toBeCloseTo(0.94, 2);
  });

  it('el pasa bajos atenúa más las armónicas que el pasa altos', () => {
    const r = calculado({ f0: 100e6, rs: 50, rl: 1000, qBobina: 100 });
    const [pb, pa] = r.variantes;
    expect(pb.barrido.atenuacion2f0).toBeGreaterThan(pa.barrido.atenuacion2f0);
    expect(pb.barrido.atenuacion3f0).toBeGreaterThan(pb.barrido.atenuacion2f0);
  });

  it('la pérdida de inserción con Q = 100 es chica y crece al bajar el Q', () => {
    const conQ = (qBobina: number) =>
      calculado({ f0: 100e6, rs: 50, rl: 300, qBobina }).variantes[0].barrido.perdidaInsercion;
    expect(conQ(100)).toBeGreaterThan(0);
    expect(conQ(100)).toBeLessThan(0.2);
    expect(conQ(20)).toBeGreaterThan(conQ(100));
  });

  it('con un solo inductor, la pérdida es la de su R de ω₀·L/Q contra la red ideal', () => {
    // Pasa bajos 100 → 1000 Ω, L en serie: r = X_L/Q = 300/100 = 3 Ω. Con la red adaptada, la
    // fuente de 100 Ω ve 100 + 3 Ω, y |S21|² = 4·100·100/203² sobre la ideal (que es 1).
    const v = calculado({ f0: 100e6, rs: 100, rl: 1000, qBobina: 100 }).variantes[0];
    const esperada = -10 * Math.log10((4 * 100 * 100) / 203 ** 2);
    expect(v.barrido.perdidaInsercion).toBeCloseTo(esperada, 9);
  });

  it('la pérdida va rotulada estimación en los pasos', () => {
    const v = calculado({ f0: 100e6, rs: 50, rl: 300, qBobina: 100 }).variantes[0];
    expect(v.pasos.some((p) => p.texto.includes('(estimación)'))).toBe(true);
  });
});

describe('valor impracticable', () => {
  it('cada L y C se revisa en f₀, con la sugerencia de redes', () => {
    const r = calculado({ f0: 300e6, rs: 5, rl: 50, qBobina: 100 });
    for (const v of r.variantes) {
      expect(v.revision.sugerencia).toBe(SUGERENCIA_REDES);
      expect(v.revision.marcados.length).toBeGreaterThan(0);
    }
    expect(SUGERENCIA_REDES).toBe('Probá otra variante o bajá el Q de diseño.');
  });
});

describe('casos de verificación', () => {
  const { valor: tolerancia } = TOLERANCIA_ORACULO;
  const errorRelativo = (a: number | null, b: number | null) =>
    a === null || b === null ? (a === b ? 0 : Infinity) : Math.abs(a / b - 1);

  for (const caso of CASOS_ANCHO_DE_BANDA) {
    it(caso.id, () => {
      const { f0, rs, rl } = caso.entradas;
      for (const v of calculado(caso.entradas).variantes) {
        const inf = cruceDeGamma(v, f0, rs, rl, 1 / 50);
        const sup = cruceDeGamma(v, f0, rs, rl, 50);
        expect(errorRelativo(v.barrido.fInf, inf), `${v.filtrado} f_inf`).toBeLessThan(tolerancia);
        expect(errorRelativo(v.barrido.fSup, sup), `${v.filtrado} f_sup`).toBeLessThan(tolerancia);
        const impreso = caso.investigacion?.[v.filtrado];
        if (impreso !== undefined) {
          const obtenido = v.barrido.f0SobreBw!;
          expect(
            dentroDeTolerancia(obtenido, impreso, { tipo: 'media-unidad', motivo: '' }),
            `${v.filtrado} f₀/BW ${obtenido} contra ${impreso}`,
          ).toBe(true);
        }
      }
    });
  }

  it('Grilla de R_s y R_L: |Zin − R_s|/R_s < 1e-9 con el oráculo', () => {
    const g = recorrerGrilla();
    // 8 × 7 pares distintos, 2 variantes y 3 frecuencias.
    expect(g.redes).toBe(336);
    expect(g.zEntrada.valor, g.zEntrada.donde).toBeLessThan(tolerancia);
  });

  it('Barrido común contra el oráculo ABCD: |S21|² y Zin', () => {
    const b = recorrerBarrido();
    expect(b.puntos).toBe(84);
    expect(b.s21.valor, b.s21.donde).toBeLessThan(tolerancia);
    expect(b.zEntrada.valor, b.zEntrada.donde).toBeLessThan(tolerancia);
  });
});

describe('casos de comportamiento', () => {
  for (const caso of CASOS_COMPORTAMIENTO) {
    it(caso.id, () => {
      const r = calcularRedL(caso.entradas);
      const { esperado } = caso;
      if ('corte' in esperado) {
        expect(r.estado === 'corte' && r.codigo).toBe(esperado.corte);
        return;
      }
      if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
      for (const v of r.variantes) {
        if ('sinBorde' in esperado) {
          const faltan = [
            ...(v.barrido.fInf === null ? ['inferior'] : []),
            ...(v.barrido.fSup === null ? ['superior'] : []),
          ];
          expect(faltan, v.filtrado).toEqual(esperado.sinBorde[v.filtrado]);
        } else {
          const marcados = Object.fromEntries(v.revision.marcados.map((m) => [m.nombre, m.nivel]));
          expect(marcados, v.filtrado).toEqual(esperado.marcados[v.filtrado]);
        }
      }
    });
  }

  it('sin borde, el BW y f₀/BW quedan vacíos', () => {
    const pb = calculado({ f0: 100e6, rs: 50, rl: 200, qBobina: 100 }).variantes[0];
    expect(pb.barrido.fInf).toBeNull();
    expect(pb.barrido.bw).toBeNull();
    expect(pb.barrido.f0SobreBw).toBeNull();
    expect(pb.pasos.some((p) => p.latex.includes('sin borde inferior'))).toBe(true);
  });

  it('el pasa bajos de 50 a 200 Ω transfiere 0,64 cerca de continua', () => {
    // 4·R_s·R_L/(R_s + R_L)² con R_s = 50 y R_L = 200: más que la mitad, por eso no hay borde.
    const pb = calculado({ f0: 100e6, rs: 50, rl: 200, qBobina: 100 }).variantes[0];
    const red = { rs: 50, rl: 200, elementos: pb.componentes };
    expect(respuesta(red, 100e6 / 1e6).s21Cuadrado).toBeCloseTo(0.64, 9);
  });
});
