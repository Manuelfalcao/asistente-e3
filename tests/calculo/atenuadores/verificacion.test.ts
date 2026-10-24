import { describe, expect, it } from 'vitest';
import {
  type Atenuador,
  calcularAtenuadores,
  calcularMinimaPerdida,
} from '../../../src/calculo/atenuadores/atenuadores';
import { MEDIA_UNIDAD, dentroDeTolerancia, margen } from '../../casos';
import { CASOS_POTENCIA, CASOS_VERIFICACION, TOLERANCIA_ORACULO } from './casos-pad';
import { escaleraDeAtenuador, escaleraDePad, medir, potencias } from './elementos';
import { recorrerGrilla, recorrerGrillaPad } from './grilla';

// Casos de verificación (spec §13.3): las resistencias que calcula el Asistente, armadas en el
// oráculo ABCD de tests/oraculos/, dan Z1 a la entrada, Z2 a la salida y la atenuación pedida.

const { impedancia, atenuacion: tolA } = TOLERANCIA_ORACULO;

// La tolerancia con su motivo es la de los casos: acá solo se aplica.
const errorRelativo = (obtenido: number, esperado: number) => Math.abs(obtenido / esperado - 1);

function redes(a: number, z1: number, z2: number) {
  const r = calcularAtenuadores({ atenuacion: a, z1, z2 });
  if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
  return r;
}

function verificar(red: Atenuador, a: number, z1: number, z2: number, donde: string) {
  const m = medir(escaleraDeAtenuador(red), z1, z2);
  expect(errorRelativo(m.zEntrada, z1), `${donde}: Zin ${m.zEntrada}`).toBeLessThan(
    impedancia.valor,
  );
  expect(errorRelativo(m.zSalida, z2), `${donde}: Zout ${m.zSalida}`).toBeLessThan(
    impedancia.valor,
  );
  expect(Math.abs(m.atenuacion - a), `${donde}: ${m.atenuacion} dB contra ${a} dB`).toBeLessThan(
    tolA.valor,
  );
}

describe('A1 a A15: las resistencias, contra la investigación y contra el oráculo ABCD', () => {
  for (const caso of CASOS_VERIFICACION) {
    it(`${caso.id}: ${caso.entradas.z1} → ${caso.entradas.z2} Ω, ${caso.entradas.atenuacion} dB`, () => {
      const { atenuacion: a, z1, z2 } = caso.entradas;
      const r = redes(a, z1, z2);
      // el T y el π dan Z1, Z2 y A con el oráculo, haya o no valor impreso para el caso
      verificar(r.t, a, z1, z2, `${caso.id} T`);
      verificar(r.pi, a, z1, z2, `${caso.id} π`);
      for (const [clave, impresas] of Object.entries(caso.esperado) as [
        't' | 'pi',
        { r1: string; r2: string; r3: string },
      ][]) {
        for (const nombre of ['r1', 'r2', 'r3'] as const) {
          const obtenido = r[clave][nombre].valor;
          expect(
            dentroDeTolerancia(obtenido, impresas[nombre], MEDIA_UNIDAD),
            `${caso.id} ${clave} ${nombre}: ${obtenido} contra ${impresas[nombre]} ± ${margen(MEDIA_UNIDAD, impresas[nombre])}`,
          ).toBe(true);
        }
      }
    });
  }
});

describe('el T y el π, en una grilla de Z1, Z2 y dB', () => {
  it('Grilla de Z1, Z2 y dB: T y π dan Z1, Z2 y la atenuación pedida con el oráculo', () => {
    const g = recorrerGrilla();
    // Debajo de A_min es un corte, y no queda ningún valor negativo que verificar.
    expect(g.fueraDeLugar).toEqual([]);
    // 8 × 8 pares con 10 atenuaciones son 640; quedan 328 una vez sacadas las de debajo de A_min,
    // y cada una arma un T y un π.
    expect(g.redes).toBe(656);
    expect(g.zEntrada.valor, `Zin: ${g.zEntrada.donde}`).toBeLessThan(impedancia.valor);
    expect(g.zSalida.valor, `Zout: ${g.zSalida.donde}`).toBeLessThan(impedancia.valor);
    expect(g.atenuacion.valor, `A: ${g.atenuacion.donde}`).toBeLessThan(tolA.valor);
  });
});

describe('el pad de mínima pérdida, en una grilla de Z1 y Z2', () => {
  it('Grilla del pad: da Z1, Z2 y A_min con el oráculo, con la serie del lado de la mayor', () => {
    const g = recorrerGrillaPad();
    expect(g.redes).toBe(56);
    expect(g.zEntrada.valor, `Zin: ${g.zEntrada.donde}`).toBeLessThan(impedancia.valor);
    expect(g.zSalida.valor, `Zout: ${g.zSalida.donde}`).toBeLessThan(impedancia.valor);
    expect(g.atenuacion.valor, `A: ${g.atenuacion.donde}`).toBeLessThan(tolA.valor);
  });

  it('A_min es el piso: con un poco menos de atenuación el T se vuelve negativo', () => {
    // El oráculo no calcula valores negativos: lo que se mira es que A_min del pad es el punto en
    // que el cálculo general deja de cortar.
    for (const [z1, z2] of [
      [50, 75],
      [300, 50],
    ]) {
      const { aMin } = calcularMinimaPerdida({ z1, z2 }) as { aMin: number };
      expect(calcularAtenuadores({ atenuacion: aMin - 0.01, z1, z2 }).estado).toBe('corte');
      expect(calcularAtenuadores({ atenuacion: aMin + 0.01, z1, z2 }).estado).toBe('calculado');
    }
  });
});

describe('la potencia por resistencia, contra el oráculo ABCD', () => {
  it('A14 y A15, y la grilla, coinciden con las del oráculo', () => {
    const casos: [number, number, number, number][] = [
      ...CASOS_POTENCIA.map(
        (c) =>
          [c.entradas.atenuacion, c.entradas.z1, c.entradas.z2, c.entradas.potencia!] as [
            number,
            number,
            number,
            number,
          ],
      ),
      [20, 50, 300, 2],
      [14, 300, 50, 0.5],
      [3, 75, 75, 10],
      [40, 50, 75, 1],
    ];
    for (const [a, z1, z2, p] of casos) {
      const r = calcularAtenuadores({ atenuacion: a, z1, z2, potencia: p });
      if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
      for (const red of [r.t, r.pi]) {
        const esperadas = potencias(escaleraDeAtenuador(red), z2, p);
        for (const x of red.potencia!.resistencias) {
          const oraculo = esperadas.get(x.nombre)!;
          expect(
            Math.abs(x.disipada - oraculo),
            `${red.topologia} ${x.nombre} ${z1} → ${z2}, ${a} dB: ${x.disipada} contra ${oraculo}`,
          ).toBeLessThan(1e-9 * p);
        }
      }
    }
  });

  it('el pad: su potencia coincide con la del oráculo', () => {
    for (const [z1, z2, p] of [
      [50, 75, 1],
      [75, 50, 1],
      [50, 300, 0.25],
      [300, 50, 5],
    ]) {
      const r = calcularMinimaPerdida({ z1, z2, potencia: p });
      if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
      const esperadas = potencias(escaleraDePad(r.pad), z2, p);
      for (const x of r.pad.potencia!.resistencias) {
        expect(Math.abs(x.disipada - esperadas.get(x.nombre)!)).toBeLessThan(1e-9 * p);
      }
    }
  });
});
