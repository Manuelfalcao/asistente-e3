import { describe, expect, it } from 'vitest';
import {
  type EntradaRedPiT,
  type TipoVariantePiT,
  type VariantePiT,
  REFERENCIAS_RED_PI_T,
  calcularRedPiT,
} from '../../../src/calculo/redes/redes-pi-t';
import { NOTAS_REDES, SUGERENCIA_REDES, calcularRedL } from '../../../src/calculo/redes/redes';
import { dentroDeTolerancia, margen } from '../../casos';
import {
  CASOS_ANCHO_DE_BANDA_PI_T,
  CASOS_COMPORTAMIENTO_PI_T,
  CASOS_REFERENCIA_PI_T,
  GRILLA_FRECUENCIAS_PI_T,
  GRILLA_Q_SIN_MINIMO,
  GRILLA_RESISTENCIAS_PI_T,
  MULTIPLOS_DEL_Q_MINIMO,
  TOLERANCIA_ORACULO,
  entradaPiT,
} from './casos-pi-t';
import { cruceDeGamma } from './elementos';
import { recorrerGrillaPiT } from './grilla';

// Las redes π y T de la Calculadora de redes de adaptación (spec §9 y §13.3).

function calculado(e: EntradaRedPiT) {
  const r = calcularRedPiT(e);
  if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.estado}`);
  return r;
}

const de = (variantes: readonly VariantePiT[], tipo: TipoVariantePiT) =>
  variantes.find((v) => v.tipo === tipo)!;

const reactancias = (v: VariantePiT) => v.componentes.map((c) => c.reactancia);
const nombres = (v: VariantePiT) => v.componentes.map((c) => c.nombre);

describe('casos de referencia', () => {
  for (const caso of CASOS_REFERENCIA_PI_T) {
    it(caso.id, () => {
      const r = calculado(caso.entradas);
      const v = de(r.variantes, caso.variante);
      for (const { nombre, impreso, medido } of caso.impresos) {
        const obtenido =
          medido.de === 'resistencia-virtual'
            ? r.resistenciaVirtual
            : medido.de === 'reactancia'
              ? Math.abs(v.componentes[medido.indice].reactancia)
              : v.secciones[medido.seccion].q;
        expect(
          dentroDeTolerancia(obtenido, impreso, caso.tolerancia),
          `${nombre}: ${obtenido} contra ${impreso} ± ${margen(caso.tolerancia, impreso)}`,
        ).toBe(true);
      }
    });
  }
});

describe('la red π', () => {
  const r = calculado(entradaPiT('π', 100, 1000, 15));

  it('Bowick 4-4: Resistencia virtual de R_mayor/(Q² + 1) y Q mínimo de 3', () => {
    expect(r.resistenciaVirtual).toBeCloseTo(1000 / 226, 12);
    expect(r.qMinimo).toBeCloseTo(3, 12);
    expect(r.q).toBe(15);
  });

  it('las variantes en orden: pasa bajos, pasa altos y las dos mixtas, ninguna destacada', () => {
    expect(r.variantes.map((v) => v.tipo)).toEqual([
      'pasa-bajos',
      'pasa-altos',
      'mixta-bajos-altos',
      'mixta-altos-bajos',
    ]);
  });

  it('pasa bajos C-L-C a 100 MHz: 73,97 pF, 138,36 nH y 23,87 pF (research P1)', () => {
    const pb = de(r.variantes, 'pasa-bajos');
    expect(pb.componentes.map((c) => [c.nombre, c.posicion, c.lado])).toEqual([
      ['C1', 'derivacion', 'R_s'],
      ['L1', 'serie', null],
      ['C2', 'derivacion', 'R_L'],
    ]);
    const v = pb.componentes.map((c) => c.valor);
    expect(v[0] * 1e12).toBeCloseTo(73.97, 2);
    expect(v[1] * 1e9).toBeCloseTo(138.36, 2);
    expect(v[2] * 1e12).toBeCloseTo(23.87, 2);
  });

  it('pasa altos L-C-L a 100 MHz: 34,24 nH, 18,31 pF y 106,10 nH (research P1)', () => {
    const pa = de(r.variantes, 'pasa-altos');
    expect(nombres(pa)).toEqual(['L1', 'C1', 'L2']);
    const v = pa.componentes.map((c) => c.valor);
    expect(v[0] * 1e9).toBeCloseTo(34.24, 2);
    expect(v[1] * 1e12).toBeCloseTo(18.31, 2);
    expect(v[2] * 1e9).toBeCloseTo(106.1, 2);
  });

  it('las dos reactancias en serie se suman con su signo', () => {
    // Pasa bajos: las dos son L. Mixta pasa bajos-pasa altos: X_s1 > 0 y X_s2 < 0, y se restan.
    const pb = de(r.variantes, 'pasa-bajos');
    expect(pb.componentes[1].reactancia).toBeCloseTo(86.9362, 3);
    const mixta = de(r.variantes, 'mixta-bajos-altos');
    const [xp1, xs, xp2] = reactancias(mixta);
    expect(xs).toBeCloseTo(20.5649 - 66.3717, 3);
    expect(xs).toBeLessThan(0);
    // Del lado de la fuente es pasa bajos (C en derivación); del de la carga, pasa altos (L).
    expect(xp1).toBeLessThan(0);
    expect(xp2).toBeGreaterThan(0);
    expect(mixta.componentes[1].componente).toBe('C');
    expect(nombres(mixta)).toEqual(['C1', 'C2', 'L1']);
  });

  it('en la mixta la rama neta puede salir L o C según qué sección pesa más', () => {
    const otra = de(r.variantes, 'mixta-altos-bajos');
    expect(otra.componentes[1].reactancia).toBeCloseTo(66.3717 - 20.5649, 3);
    expect(otra.componentes[1].componente).toBe('L');
  });

  it('el Q de cada sección: el de diseño del lado de R_mayor y el otro de R_menor/R_v', () => {
    const pb = de(r.variantes, 'pasa-bajos');
    expect(pb.secciones.map((s) => s.lado)).toEqual(['R_s', 'R_L']);
    expect(pb.secciones[0].q).toBeCloseTo(Math.sqrt(100 / (1000 / 226) - 1), 12);
    expect(pb.secciones[1].q).toBeCloseTo(15, 12);
  });

  it('con R_s mayor que R_L el Q de diseño queda del lado de la fuente', () => {
    const inv = calculado(entradaPiT('π', 1000, 100, 15));
    const pb = de(inv.variantes, 'pasa-bajos');
    expect(pb.secciones[0].q).toBeCloseTo(15, 12);
    expect(pb.componentes.map((c) => [c.nombre, c.lado])).toEqual([
      ['C1', 'R_s'],
      ['L1', null],
      ['C2', 'R_L'],
    ]);
  });

  it('las etiquetas de Bowick: la continua según el elemento en serie y las armónicas en pasa bajos', () => {
    expect(de(r.variantes, 'pasa-bajos').etiquetas).toEqual([
      'deja pasar la continua',
      'atenúa armónicas',
    ]);
    expect(de(r.variantes, 'pasa-altos').etiquetas).toEqual(['bloquea la continua']);
    // La rama neta de la mixta es C: bloquea.
    expect(de(r.variantes, 'mixta-bajos-altos').etiquetas).toEqual(['bloquea la continua']);
    expect(de(r.variantes, 'mixta-altos-bajos').etiquetas).toEqual(['deja pasar la continua']);
  });
});

describe('la red T', () => {
  const r = calculado(entradaPiT('T', 10, 50, 10));

  it('Bowick 4-5: Resistencia virtual de R_menor·(Q² + 1) y Q mínimo de 2', () => {
    expect(r.resistenciaVirtual).toBeCloseTo(1010, 10);
    expect(r.qMinimo).toBeCloseTo(2, 12);
  });

  it('pasa bajos L-C-L a 100 MHz: 159,15 nH, 22,66 pF y 348,69 nH (research T1)', () => {
    const pb = de(r.variantes, 'pasa-bajos');
    expect(pb.componentes.map((c) => [c.nombre, c.posicion, c.lado])).toEqual([
      ['L1', 'serie', 'R_s'],
      ['C1', 'derivacion', null],
      ['L2', 'serie', 'R_L'],
    ]);
    const v = pb.componentes.map((c) => c.valor);
    expect(v[0] * 1e9).toBeCloseTo(159.15, 2);
    expect(v[1] * 1e12).toBeCloseTo(22.66, 2);
    expect(v[2] * 1e9).toBeCloseTo(348.69, 2);
  });

  it('pasa altos C-L-C a 100 MHz: 15,92 pF, 111,77 nH y 7,264 pF (research T1)', () => {
    const pa = de(r.variantes, 'pasa-altos');
    expect(nombres(pa)).toEqual(['C1', 'L1', 'C2']);
    const v = pa.componentes.map((c) => c.valor);
    expect(v[0] * 1e12).toBeCloseTo(15.92, 2);
    expect(v[1] * 1e9).toBeCloseTo(111.77, 2);
    expect(v[2] * 1e12).toBeCloseTo(7.264, 3);
  });

  it('las dos reactancias en derivación se combinan en paralelo', () => {
    const pb = de(r.variantes, 'pasa-bajos');
    // X_p1 = 101 y X_p2 = 230,5, las dos C: 1/(1/101 + 1/230,5) = 70,23 Ω.
    expect(pb.componentes[1].reactancia).toBeCloseTo(-70.2277, 3);
  });

  it('T1 con AN721 (c): la mixta L-C-C da X_L1 = 100, X_C1 = 179,8 y X_C2 = 219,1', () => {
    // Del lado de R_s pasa bajos (L en serie); del lado de R_L pasa altos (C en serie). La rama
    // en derivación neta es C: 1/(1/(−101) + 1/230,5) = −179,8 Ω.
    const m = de(r.variantes, 'mixta-bajos-altos');
    expect(m.componentes.map((c) => [c.componente, c.posicion])).toEqual([
      ['L', 'serie'],
      ['C', 'derivacion'],
      ['C', 'serie'],
    ]);
    const [xl1, xc1, xc2] = reactancias(m);
    expect(xl1).toBeCloseTo(100, 6);
    expect(xc1).toBeCloseTo(-179.8, 1);
    expect(xc2).toBeCloseTo(-219.09, 2);
  });

  it('la continua: pasa solo si los dos elementos en serie son L', () => {
    expect(de(r.variantes, 'pasa-bajos').etiquetas).toContain('deja pasar la continua');
    expect(de(r.variantes, 'pasa-altos').etiquetas).toEqual(['bloquea la continua']);
    expect(de(r.variantes, 'mixta-bajos-altos').etiquetas).toEqual(['bloquea la continua']);
    expect(de(r.variantes, 'mixta-altos-bajos').etiquetas).toEqual(['bloquea la continua']);
  });
});

describe('Zin con R_L conectada', () => {
  it('es R_s en f₀ en las cuatro variantes de la π y de la T', () => {
    for (const [topologia, rs, rl, q] of [
      ['π', 100, 1000, 15],
      ['π', 1000, 100, 15],
      ['T', 10, 50, 10],
      ['T', 50, 10, 10],
    ] as const) {
      for (const v of calculado(entradaPiT(topologia, rs, rl, q)).variantes) {
        expect(Math.abs(v.zEntrada.re / rs - 1), `${topologia} ${v.tipo}`).toBeLessThan(1e-9);
        expect(Math.abs(v.zEntrada.im / rs), `${topologia} ${v.tipo}`).toBeLessThan(1e-9);
      }
    }
  });
});

describe('resultado principal, pasos y referencias', () => {
  const r = calculado(entradaPiT('π', 100, 1000, 15));

  it('el Q de diseño con el Q mínimo, con la fórmula visible', () => {
    expect(r.formulas.some((f) => f.includes('\\sqrt'))).toBe(true);
    expect(r.pasos[0].texto).toContain('Q mínimo');
    expect(r.pasos[0].latex).toContain('= 3');
    expect(r.pasos[1].texto).toContain('Resistencia virtual');
  });

  it('referencias: Bowick, Motorola AN721 y Kaune', () => {
    expect(r.referencias).toBe(REFERENCIAS_RED_PI_T);
    expect(REFERENCIAS_RED_PI_T.map((x) => x.obra)).toEqual([
      'RF Circuit Design',
      'Impedance Matching Networks Applied to RF Power Transistors',
      'Quality Factor, Bandwidth, and Harmonic Attenuation of Pi Networks',
    ]);
    expect(r.notas).toBe(NOTAS_REDES);
  });

  it('los pasos de cada variante: las dos secciones L, la combinación, Kaune y la verificación', () => {
    const textos = r.variantes[0].pasos.map((p) => p.texto);
    expect(textos.filter((t) => t.includes('pasada a paralelo'))).toHaveLength(2);
    expect(textos.some((t) => t.includes('Combinación'))).toBe(true);
    expect(textos.some((t) => t.includes('Kaune'))).toBe(true);
    expect(textos.some((t) => t.startsWith('Verificación: impedancia de entrada'))).toBe(true);
    const zin = r.variantes[0].pasos.find((p) => p.texto.startsWith('Verificación'))!;
    expect(zin.latex).toMatch(/= 100 \+ j0\\,\\mathrm\{\\Omega\}$/);
  });

  it('Kaune: Q_BW = (Q₁ + Q₂)/2 y BW = f₀/Q_BW, en los pasos y sin ser el resultado', () => {
    const pb = de(r.variantes, 'pasa-bajos');
    const [q1, q2] = pb.secciones.map((s) => s.q);
    expect(pb.qBw).toBeCloseTo((q1 + q2) / 2, 12);
    expect(pb.bwKaune).toBeCloseTo(100e6 / pb.qBw, 3);
    // El resultado es el del barrido, no el de la estimación (research §5: 9,59 contra 9,82).
    expect(pb.barrido.f0SobreBw!).toBeCloseTo(9.59, 2);
    expect(pb.qBw).toBeCloseTo(9.82, 2);
  });

  it('cada variante lleva la sugerencia de redes en su revisión de valores', () => {
    for (const v of calculado(entradaPiT('π', 5, 50, 10, 300e6)).variantes) {
      expect(v.revision.sugerencia).toBe(SUGERENCIA_REDES);
    }
  });
});

describe('barrido y pérdida', () => {
  it('cada variante trae el barrido de la red L: bordes, armónicas y pérdida', () => {
    for (const v of calculado(entradaPiT('π', 100, 1000, 15)).variantes) {
      expect(v.barrido.fInf).not.toBeNull();
      expect(v.barrido.fSup).not.toBeNull();
      expect(v.barrido.perdidaInsercion).toBeGreaterThan(0);
    }
  });

  it('el pasa bajos atenúa las armónicas más que el pasa altos', () => {
    const r = calculado(entradaPiT('π', 50, 300, 10));
    const [pb, pa] = r.variantes;
    expect(pb.barrido.atenuacion2f0).toBeGreaterThan(pa.barrido.atenuacion2f0);
    expect(pb.barrido.atenuacion3f0).toBeGreaterThan(pb.barrido.atenuacion2f0);
  });

  it('Kaune: la π pasa bajos de 500 a 50 Ω con su Q da f₀/BW de 9,98 (research §5)', () => {
    const r = calculado(entradaPiT('π', 500, 50, 500 / 32.1));
    expect(de(r.variantes, 'pasa-bajos').barrido.f0SobreBw!).toBeCloseTo(9.98, 1);
  });
});

describe('casos de verificación', () => {
  const { valor: tolerancia } = TOLERANCIA_ORACULO;
  const errorRelativo = (a: number | null, b: number | null) =>
    a === null || b === null ? (a === b ? 0 : Infinity) : Math.abs(a / b - 1);

  for (const caso of CASOS_ANCHO_DE_BANDA_PI_T) {
    it(caso.id, () => {
      const { f0, rs, rl } = caso.entradas;
      for (const v of calculado(caso.entradas).variantes) {
        const inf = cruceDeGamma(v, f0, rs, rl, 1 / 50);
        const sup = cruceDeGamma(v, f0, rs, rl, 50);
        expect(errorRelativo(v.barrido.fInf, inf), `${v.tipo} f_inf`).toBeLessThan(tolerancia);
        expect(errorRelativo(v.barrido.fSup, sup), `${v.tipo} f_sup`).toBeLessThan(tolerancia);
      }
      if (caso.investigacion !== undefined) {
        const obtenido = de(calculado(caso.entradas).variantes, 'pasa-bajos').barrido.f0SobreBw!;
        expect(
          dentroDeTolerancia(obtenido, caso.investigacion, { tipo: 'media-unidad', motivo: '' }),
          `pasa bajos f₀/BW ${obtenido} contra ${caso.investigacion}`,
        ).toBe(true);
      }
    });
  }

  it('Grilla de R_s, R_L, Q y variantes: |Zin − R_s|/R_s < 1e-9 con el oráculo', () => {
    const g = recorrerGrillaPiT();
    const n = GRILLA_RESISTENCIAS_PI_T.length;
    const desiguales = n * (n - 1) * MULTIPLOS_DEL_Q_MINIMO.length * 4;
    // Donde R_s = R_L las mixtas se anulan: quedan 2 variantes y no 4.
    const iguales = n * GRILLA_Q_SIN_MINIMO.length * 2;
    // Cada una en las dos topologías y en las frecuencias de la grilla.
    expect(g.redes).toBe((desiguales + iguales) * 2 * GRILLA_FRECUENCIAS_PI_T.length);
    expect(g.zEntrada.valor, g.zEntrada.donde).toBeLessThan(tolerancia);
  });
});

describe('casos de comportamiento', () => {
  for (const caso of CASOS_COMPORTAMIENTO_PI_T) {
    it(caso.id, () => {
      const r = calcularRedPiT(caso.entradas);
      const { esperado } = caso;
      if ('corte' in esperado) {
        expect(r.estado === 'corte' && r.codigo).toBe(esperado.corte);
        if (esperado.qMinimo !== undefined) {
          expect(r.estado === 'corte' && r.qMinimo).toBeCloseTo(esperado.qMinimo, 12);
        }
      } else if ('reducida' in esperado) {
        expect(r.estado).toBe('reducida-a-l');
      } else {
        if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.estado}`);
        expect(r.avisos.map((a) => a.codigo)).toEqual(esperado.avisos);
        expect(r.variantes).toHaveLength(esperado.variantes);
      }
    });
  }

  it('sin Q, el texto es "Completá: Q de diseño (mínimo X)"', () => {
    const r = calcularRedPiT(entradaPiT('π', 100, 1000, null));
    expect(r.estado === 'corte' && r.texto).toBe('Completá: Q de diseño (mínimo 3)');
  });

  it('con Q menor que el mínimo informa el mínimo y no calcula valores', () => {
    const r = calcularRedPiT(entradaPiT('π', 50, 1000, 3));
    expect(r.estado).toBe('corte');
    expect(r.estado === 'corte' && r.texto).toContain('4,36');
    expect('variantes' in r).toBe(false);
  });

  it('con Q igual al mínimo muestra la L equivalente', () => {
    const r = calcularRedPiT(entradaPiT('π', 100, 1000, 3));
    if (r.estado !== 'reducida-a-l') throw new Error(r.estado);
    expect(r.texto).toContain('red L');
    expect(r.redL).toEqual(calcularRedL({ f0: 100e6, rs: 100, rl: 1000, qBobina: 100 }));
  });

  it('con Q apenas arriba del mínimo ya calcula las cuatro variantes', () => {
    expect(calculado(entradaPiT('T', 100, 1000, 3.001)).variantes).toHaveLength(4);
  });

  it('con Q mayor que 20 no hay tope: calcula igual, con el aviso', () => {
    const r = calculado(entradaPiT('π', 50, 300, 100));
    expect(r.variantes).toHaveLength(4);
    expect(r.avisos.map((a) => a.codigo)).toEqual(['q-alto']);
    expect(r.avisos[0].texto).toMatch(/pérdida.*tensión y corriente.*crítico/);
  });

  it('R_s = R_L calcula igual, con una nota que manda a la Calculadora de filtros', () => {
    const r = calculado(entradaPiT('π', 50, 50, 5));
    expect(r.qMinimo).toBe(0);
    const aviso = r.avisos.find((a) => a.codigo === 'rs-igual-rl')!;
    expect(aviso.texto).toContain('Calculadora de filtros');
    expect(r.variantes.map((v) => v.tipo)).toEqual(['pasa-bajos', 'pasa-altos']);
  });
});
