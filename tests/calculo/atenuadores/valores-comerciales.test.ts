import { describe, expect, it } from 'vitest';
import {
  type Atenuador,
  type PadMinimaPerdida,
  calcularAtenuadores,
  calcularMinimaPerdida,
} from '../../../src/calculo/atenuadores/atenuadores';
import {
  type OpcionComercial,
  disponiblesDe,
  roeDePr,
  valoresComerciales,
} from '../../../src/calculo/atenuadores/valores-comerciales';
import { inventarioVacio, valoresCargados } from '../../../src/calculo/arreglos/inventario';
import {
  type Elemento,
  atenuacionDb,
  cascada,
  derivacionR,
  perdidaDeRetornoDb,
  serie,
  zEntrada,
  zSalida,
} from '../../oraculos/abcd';
import {
  CASOS_COMPORTAMIENTO_COMERCIAL,
  CASOS_VERIFICACION_COMERCIAL,
  TOLERANCIA_COMERCIAL,
} from './casos-comerciales';
import { valoresDelCaso } from './comerciales';
import { medirOpcion } from './elementos';

// Valores comerciales de los atenuadores (spec §10.4): el redondeo al más cercano y las 3 mejores
// combinaciones, contra el oráculo ABCD de tests/oraculos/ armado con los valores que elige el
// Asistente.

const E12 = valoresCargados('resistencia', 'E12');
const E6 = valoresCargados('resistencia', 'E6');
const CONFIG = { disponibles: E12, tolerancia: 0.05, ventana: 0.1 };

function redT(a: number, z1: number, z2: number): Atenuador {
  const r = calcularAtenuadores({ atenuacion: a, z1, z2 });
  if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
  return r.t;
}

function redPi(a: number, z1: number, z2: number): Atenuador {
  const r = calcularAtenuadores({ atenuacion: a, z1, z2 });
  if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
  return r.pi;
}

function pad(z1: number, z2: number): PadMinimaPerdida {
  const r = calcularMinimaPerdida({ z1, z2 });
  if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
  return r.pad;
}

// Los valores de una opción por nombre: "R1" → 27.
const porNombre = (o: OpcionComercial) =>
  Object.fromEntries(o.resistencias.map((r) => [r.nombre, r.valor]));

// La escalera de la fuente a la carga con los valores de una opción, para el oráculo.
function elementosT(v: Record<string, number>): Elemento[] {
  return [serie(v.R1), derivacionR(v.R3), serie(v.R2)];
}
function elementosPi(v: Record<string, number>): Elemento[] {
  return [derivacionR(v.R1), serie(v.R3), derivacionR(v.R2)];
}

// El oráculo sobre una escalera: atenuación y pérdidas de retorno de entrada y de salida.
function oraculo(elementos: Elemento[], z1: number, z2: number) {
  const m = cascada(elementos);
  return {
    atenuacion: atenuacionDb(m, z1, z2),
    prEntrada: perdidaDeRetornoDb(zEntrada(m, z2), z1),
    prSalida: perdidaDeRetornoDb(zSalida(m, z1), z2),
  };
}

describe('el redondeo al más cercano', () => {
  it('T de 10 dB de 50 a 50 Ω en E12: 27, 33 y 27 Ω, y su atenuación y PR son las del oráculo', () => {
    // Ideales: R1 = R2 = 25,97 Ω y R3 = 35,14 Ω. En escala logarítmica el más cercano de 35,14 es
    // 33 (ln 35,14/33 = 0,063) y no 39 (ln 39/35,14 = 0,104).
    const v = valoresComerciales(redT(10, 50, 50), { z1: 50, z2: 50, frecuencia: null }, CONFIG);
    expect(porNombre(v.redondeo)).toEqual({ R1: 27, R2: 27, R3: 33 });
    const esperado = oraculo(elementosT(porNombre(v.redondeo)), 50, 50);
    expect(v.redondeo.atenuacion).toBeCloseTo(esperado.atenuacion, 9);
    expect(v.redondeo.prEntrada).toBeCloseTo(esperado.prEntrada, 6);
    expect(v.redondeo.prSalida).toBeCloseTo(esperado.prSalida, 6);
  });
});

// Los n valores de la lista más cercanos al ideal en escala logarítmica, de menor a mayor.
function vecinos(ideal: number, lista: readonly number[], n = 7): number[] {
  return [...lista]
    .sort((a, b) => Math.abs(Math.log(a / ideal)) - Math.abs(Math.log(b / ideal)))
    .slice(0, n)
    .sort((a, b) => a - b);
}

const menorPr = (m: { prEntrada: number; prSalida: number }) => Math.min(m.prEntrada, m.prSalida);

describe('las 3 mejores combinaciones entre vecinos', () => {
  it('T de 20 dB de 50 a 75 Ω en E12: son las 3 de mayor PR dentro de la ventana, contra el oráculo', () => {
    const red = redT(20, 50, 75);
    const v = valoresComerciales(red, { z1: 50, z2: 75, frecuencia: null }, CONFIG);
    expect(v.evaluadas).toBe(7 ** 3);

    // Fuerza bruta con el oráculo sobre los 7 valores más cercanos de cada resistencia.
    const lista = E12.map((x) => x.valor);
    const [n1, n3, n2] = [red.r1, red.r3, red.r2].map((r) => vecinos(r.valor, lista));
    const todas: { valores: number[]; pr: number }[] = [];
    for (const r1 of n1) {
      for (const r3 of n3) {
        for (const r2 of n2) {
          const m = oraculo(elementosT({ R1: r1, R3: r3, R2: r2 }), 50, 75);
          if (Math.abs(m.atenuacion - 20) <= 0.1) {
            todas.push({ valores: [r1, r3, r2], pr: menorPr(m) });
          }
        }
      }
    }
    todas.sort((a, b) => b.pr - a.pr);
    expect(todas.length).toBeGreaterThanOrEqual(3);

    expect(v.dentroDeLaVentana).toBe(true);
    expect(v.mejores).toHaveLength(3);
    expect(v.mejores.map((o) => o.resistencias.map((r) => r.valor))).toEqual(
      todas.slice(0, 3).map((t) => t.valores),
    );
    for (const o of v.mejores) {
      const esperado = oraculo(elementosT(porNombre(o)), 50, 75);
      expect(o.atenuacion).toBeCloseTo(esperado.atenuacion, 9);
      expect(o.prEntrada).toBeCloseTo(esperado.prEntrada, 6);
      expect(o.prSalida).toBeCloseTo(esperado.prSalida, 6);
    }
  });
});

// Las 2^n combinaciones de extremos de las resistencias, con el oráculo: cada una al mínimo o al
// máximo de su tolerancia.
function peorCasoOraculo(
  valores: number[],
  tolerancia: number,
  armar: (v: number[]) => Elemento[],
  z1: number,
  z2: number,
) {
  const atenuaciones: number[] = [];
  const prs: number[] = [];
  for (let mascara = 0; mascara < 2 ** valores.length; mascara++) {
    const extremos = valores.map((v, i) => v * (1 + (mascara & (1 << i) ? 1 : -1) * tolerancia));
    const m = oraculo(armar(extremos), z1, z2);
    atenuaciones.push(m.atenuacion);
    prs.push(m.prEntrada, m.prSalida);
  }
  return {
    atenuacionMin: Math.min(...atenuaciones),
    atenuacionMax: Math.max(...atenuaciones),
    prMinima: Math.min(...prs),
  };
}

describe('el peor caso por tolerancia', () => {
  it('π de 10 dB de 50 a 75 Ω en E12 con ±5 %: la atenuación [mín, máx] y la PR mínima de las 8 combinaciones', () => {
    const v = valoresComerciales(redPi(10, 50, 75), { z1: 50, z2: 75, frecuencia: null }, CONFIG);
    for (const o of [v.redondeo, ...v.mejores]) {
      const { R1, R3, R2 } = porNombre(o);
      const esperado = peorCasoOraculo(
        [R1, R3, R2],
        0.05,
        ([a, b, c]) => elementosPi({ R1: a, R3: b, R2: c }),
        50,
        75,
      );
      expect(o.peorCaso.atenuacionMin).toBeCloseTo(esperado.atenuacionMin, 9);
      expect(o.peorCaso.atenuacionMax).toBeCloseTo(esperado.atenuacionMax, 9);
      expect(o.peorCaso.prMinima).toBeCloseTo(esperado.prMinima, 6);
      expect(o.peorCaso.atenuacionMin).toBeLessThan(o.atenuacion);
      expect(o.peorCaso.atenuacionMax).toBeGreaterThan(o.atenuacion);
    }
  });

  it('una tolerancia absoluta del Inventario corre el valor en ohms, no en porcentaje', () => {
    const disponibles = [
      { valor: 27, tolerancia: { tipo: 'absoluta' as const, valor: 2 } },
      { valor: 33 },
      { valor: 39 },
    ];
    const v = valoresComerciales(
      redT(10, 50, 50),
      { z1: 50, z2: 50, frecuencia: null },
      { disponibles, tolerancia: 0.05, ventana: 0.1 },
    );
    const { R1, R3, R2 } = porNombre(v.redondeo);
    expect([R1, R3, R2]).toEqual([27, 33, 27]);
    // R1 y R2 (27 Ω ± 2 Ω) y R3 (33 Ω ± 5 %)
    const m = [-1, 1].flatMap((s1) =>
      [-1, 1].flatMap((s3) =>
        [-1, 1].map((s2) =>
          oraculo(
            elementosT({ R1: 27 + 2 * s1, R3: 33 * (1 + 0.05 * s3), R2: 27 + 2 * s2 }),
            50,
            50,
          ),
        ),
      ),
    );
    expect(v.redondeo.peorCaso.atenuacionMin).toBeCloseTo(
      Math.min(...m.map((x) => x.atenuacion)),
      9,
    );
    expect(v.redondeo.peorCaso.prMinima).toBeCloseTo(
      Math.min(...m.flatMap((x) => [x.prEntrada, x.prSalida])),
      6,
    );
  });
});

describe('la ROE equivalente a la PR', () => {
  it('30,5 dB de PR es una ROE de 1,06', () => {
    expect(roeDePr(30.5)).toBeCloseTo(1.0616, 3);
  });

  it('cada opción trae la ROE de su PR de entrada y de salida', () => {
    const v = valoresComerciales(redT(10, 50, 75), { z1: 50, z2: 75, frecuencia: null }, CONFIG);
    expect(v.redondeo.roeEntrada).toBeCloseTo(roeDePr(v.redondeo.prEntrada), 12);
    expect(v.redondeo.roeSalida).toBeCloseTo(roeDePr(v.redondeo.prSalida), 12);
    expect(v.redondeo.peorCaso.roeMinima).toBeCloseTo(roeDePr(v.redondeo.peorCaso.prMinima), 12);
  });
});

// El pad: la serie del lado de la impedancia mayor; la fuente ve primero la serie si es Z1.
function elementosPad(p: PadMinimaPerdida, v: Record<string, number>): Elemento[] {
  const s = serie(v[p.serie.nombre]);
  const d = derivacionR(v[p.derivacion.nombre]);
  return p.serie.lado === 'Z1' ? [s, d] : [d, s];
}

describe('el pad de mínima pérdida con valores comerciales', () => {
  for (const [z1, z2] of [
    [75, 50],
    [50, 75],
    [50, 300],
  ]) {
    it(`de ${z1} a ${z2} Ω en E12: redondeo y 3 mejores de 2 resistencias (7² = 49), contra el oráculo`, () => {
      const p = pad(z1, z2);
      const v = valoresComerciales(p, { z1, z2, frecuencia: null }, CONFIG);
      expect(v.evaluadas).toBe(7 ** 2);
      expect(v.mejores.length).toBeLessThanOrEqual(3);
      for (const o of [v.redondeo, ...v.mejores]) {
        expect(o.resistencias).toHaveLength(2);
        const esperado = oraculo(elementosPad(p, porNombre(o)), z1, z2);
        expect(o.atenuacion).toBeCloseTo(esperado.atenuacion, 9);
        expect(o.prEntrada).toBeCloseTo(esperado.prEntrada, 6);
        expect(o.prSalida).toBeCloseTo(esperado.prSalida, 6);
      }
    });
  }

  it('si el redondeo deja el pad desadaptado, se ve en las PR y no hay otro aviso', () => {
    // 50 → 75 Ω: ideales R1 = 43,30 Ω y R3 = 86,60 Ω, con A_min = 5,72 dB y PR infinita. Con los
    // únicos valores 40 y 80 Ω la atenuación sale 5,73 dB pero la PR de entrada baja a 30,7 dB.
    const p = pad(50, 75);
    const v = valoresComerciales(
      p,
      { z1: 50, z2: 75, frecuencia: null },
      { disponibles: [{ valor: 40 }, { valor: 80 }], tolerancia: 0.05, ventana: 0.1 },
    );
    const { redondeo } = v;
    expect(porNombre(redondeo)).toEqual({ R1: 40, R3: 80 });
    expect(redondeo.atenuacion).toBeCloseTo(5.7295, 3);
    expect(redondeo.prEntrada).toBeCloseTo(30.745, 2);
    expect(Object.keys(v).sort()).toEqual([
      'dentroDeLaVentana',
      'evaluadas',
      'mejores',
      'redondeo',
    ]);
  });
});

describe('ninguna combinación dentro de la ventana', () => {
  it('con una ventana de ±0,0001 dB en E6: las 3 de menor error de atenuación, ordenadas por error', () => {
    const red = redT(10, 50, 50);
    const v = valoresComerciales(
      red,
      { z1: 50, z2: 50, frecuencia: null },
      { disponibles: E6, tolerancia: 0.05, ventana: 0.0001 },
    );
    expect(v.dentroDeLaVentana).toBe(false);
    expect(v.mejores).toHaveLength(3);

    // Fuerza bruta con el oráculo sobre los 7 valores más cercanos de cada resistencia.
    const lista = E6.map((x) => x.valor);
    const [n1, n3, n2] = [red.r1, red.r3, red.r2].map((r) => vecinos(r.valor, lista));
    const errores: number[] = [];
    for (const r1 of n1) {
      for (const r3 of n3) {
        for (const r2 of n2) {
          const m = oraculo(elementosT({ R1: r1, R3: r3, R2: r2 }), 50, 50);
          errores.push(Math.abs(m.atenuacion - red.verificacion.atenuacion));
        }
      }
    }
    errores.sort((a, b) => a - b);
    expect(errores[0]).toBeGreaterThan(0.0001);
    expect(v.mejores.map((o) => Math.abs(o.atenuacion - 10))).toEqual(
      v.mejores.map((_, i) => expect.closeTo(errores[i], 9)),
    );
  });

  it('con la ventana por defecto y E12 sí entran, y todas están adentro', () => {
    const v = valoresComerciales(redT(10, 50, 50), { z1: 50, z2: 50, frecuencia: null }, CONFIG);
    expect(v.dentroDeLaVentana).toBe(true);
    for (const o of v.mejores) expect(Math.abs(o.atenuacion - 10)).toBeLessThanOrEqual(0.1);
    // Ordenadas por la menor de las dos PR, de la mayor a la menor
    const prs = v.mejores.map((o) => Math.min(o.prEntrada, o.prSalida));
    expect([...prs].sort((a, b) => b - a)).toEqual(prs);
  });
});

describe('el Inventario de resistencias', () => {
  it('redondea con lo que hay: 22, 47 y 100 Ω, sin pasar a la serie', () => {
    // Ideales de un T de 10 dB de 50 Ω: 25,97 / 35,14 / 25,97. En escala logarítmica el más cercano
    // de 25,97 es 22 (ln 25,97/22 = 0,166) y no 47 (ln 47/25,97 = 0,593); el de 35,14, 47.
    const disponibles = [{ valor: 22 }, { valor: 47 }, { valor: 100 }];
    const v = valoresComerciales(
      redT(10, 50, 50),
      { z1: 50, z2: 50, frecuencia: null },
      { disponibles, tolerancia: 0.05, ventana: 0.1 },
    );
    expect(porNombre(v.redondeo)).toEqual({ R1: 22, R3: 47, R2: 22 });
    // 3 valores: 3³ = 27 combinaciones (menos de las 343 de una serie)
    expect(v.evaluadas).toBe(3 ** 3);
    const esperado = oraculo(elementosT(porNombre(v.redondeo)), 50, 50);
    expect(v.redondeo.atenuacion).toBeCloseTo(esperado.atenuacion, 9);
  });

  it('un Inventario de un solo valor da una sola combinación', () => {
    const v = valoresComerciales(
      redT(10, 50, 50),
      { z1: 50, z2: 50, frecuencia: null },
      { disponibles: [{ valor: 33 }], tolerancia: 0.05, ventana: 0.1 },
    );
    expect(v.evaluadas).toBe(1);
    expect(v.mejores).toHaveLength(1);
    expect(v.dentroDeLaVentana).toBe(false);
  });
});

describe('el criterio de valor impracticable en las resistencias redondeadas', () => {
  it('T de 20 dB de 50 Ω a 300 MHz: el R3 redondeado (10 Ω en derivación) es impracticable', () => {
    const v = valoresComerciales(redT(20, 50, 50), { z1: 50, z2: 50, frecuencia: 300e6 }, CONFIG);
    expect(porNombre(v.redondeo).R3).toBe(10);
    const r3 = v.redondeo.revision.marcados.find((m) => m.nombre === 'R3');
    expect(r3?.nivel).toBe('impracticable');
    expect(v.redondeo.revision.sugerencia).toBeTruthy();
  });

  it('sin frecuencia revisa a 300 MHz, como las ideales', () => {
    const v = valoresComerciales(redT(20, 50, 50), { z1: 50, z2: 50, frecuencia: null }, CONFIG);
    expect(v.redondeo.revision.marcados.map((m) => m.nombre)).toContain('R3');
  });

  it('cada mejor combinación también se revisa', () => {
    const v = valoresComerciales(redT(20, 50, 50), { z1: 50, z2: 50, frecuencia: 150e6 }, CONFIG);
    for (const o of v.mejores) expect(o.revision).toBeDefined();
  });
});

describe('de dónde salen los valores con que se redondea', () => {
  it('una serie E sale completa, en el rango fijo de las resistencias, sin mirar el Inventario', () => {
    const inventario = { ...inventarioVacio('resistencia'), modo: 'inclusion' as const };
    const valores = disponiblesDe('E12', 'E24', inventario).map((v) => v.valor);
    expect(valores).toContain(27);
    expect(valores).toContain(10e6);
    expect(valores).not.toContain(27.5);
    expect(valores.every((v) => v >= 1 && v <= 10e6)).toBe(true);
  });

  it('el Inventario por inclusión trae sus valores, con la tolerancia propia de cada uno', () => {
    const inventario = {
      ...inventarioVacio('resistencia'),
      modo: 'inclusion' as const,
      inclusion: [
        { valor: 47 },
        { valor: 22, tolerancia: { tipo: 'relativa' as const, fraccion: 0.01 } },
      ],
    };
    expect(disponiblesDe('inventario', 'E12', inventario)).toEqual([
      { valor: 22, tolerancia: { tipo: 'relativa', fraccion: 0.01 } },
      { valor: 47 },
    ]);
  });

  it('el Inventario por exclusión usa la serie dada y saca los Valores excluidos', () => {
    const base = inventarioVacio('resistencia');
    const inventario = {
      ...base,
      modo: 'exclusion' as const,
      exclusion: { ...base.exclusion, min: 10, max: 100, excluidos: [27] },
    };
    const valores = disponiblesDe('inventario', 'E12', inventario).map((v) => v.valor);
    expect(valores).toEqual([10, 12, 15, 18, 22, 33, 39, 47, 56, 68, 82, 100]);
  });

  it('la tolerancia propia de un valor del Inventario gana sobre la del campo', () => {
    const inventario = {
      ...inventarioVacio('resistencia'),
      modo: 'inclusion' as const,
      inclusion: [{ valor: 33, tolerancia: { tipo: 'relativa' as const, fraccion: 0.01 } }],
    };
    const v = valoresComerciales(
      redT(10, 50, 50),
      { z1: 50, z2: 50, frecuencia: null },
      { disponibles: disponiblesDe('inventario', 'E12', inventario), tolerancia: 0.05, ventana: 1 },
    );
    expect(v.redondeo.resistencias.every((r) => r.tolerancia.tipo === 'relativa')).toBe(true);
    expect(
      v.redondeo.resistencias.map((r) => (r.tolerancia as { fraccion: number }).fraccion),
    ).toEqual([0.01, 0.01, 0.01]);
  });
});

describe('Casos de verificación de los Valores comerciales, contra el oráculo ABCD', () => {
  for (const caso of CASOS_VERIFICACION_COMERCIAL) {
    it(`${caso.id}: el redondeo y las mejores combinaciones dan la atenuación y las PR del oráculo`, () => {
      const v = valoresDelCaso(caso);
      for (const [nombre, o] of [
        ['redondeo', v.redondeo],
        ...v.mejores.map((m, i) => [`mejor ${i + 1}`, m] as const),
      ] as const) {
        const m = medirOpcion(o, caso.z1, caso.z2);
        const donde = `${caso.id}, ${nombre}`;
        expect(Math.abs(o.atenuacion - m.atenuacion), `${donde}: atenuación`).toBeLessThan(
          TOLERANCIA_COMERCIAL.atenuacion.valor,
        );
        expect(Math.abs(o.prEntrada - m.prEntrada), `${donde}: PR de entrada`).toBeLessThan(
          TOLERANCIA_COMERCIAL.perdidaDeRetorno.valor,
        );
        expect(Math.abs(o.prSalida - m.prSalida), `${donde}: PR de salida`).toBeLessThan(
          TOLERANCIA_COMERCIAL.perdidaDeRetorno.valor,
        );
      }
    });
  }
});

describe('Casos de comportamiento de los Valores comerciales', () => {
  for (const caso of CASOS_COMPORTAMIENTO_COMERCIAL) {
    it(`${caso.id}: redondeo, combinaciones y ventana`, () => {
      const v = valoresDelCaso(caso);
      expect(v.redondeo.resistencias.map((r) => r.valor)).toEqual(caso.esperado.redondeo);
      expect(v.evaluadas).toBe(caso.esperado.evaluadas);
      expect(v.dentroDeLaVentana).toBe(caso.esperado.dentroDeLaVentana);
    });
  }
});
