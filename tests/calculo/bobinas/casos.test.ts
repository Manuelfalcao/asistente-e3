import { describe, expect, it } from 'vitest';
import { calcularBobinas, unaCapaConPasos } from '../../../src/calculo/bobinas/bobinas';
import { geometria, kLundin, wheeler1928 } from '../../../src/calculo/bobinas/formulas';
import { dentroDeTolerancia, margen } from '../../casos';
import { medidaNumerica } from '../../casos-informe';
import { laminaExacta, sumaDeAnillos } from '../../oraculos/anillos';
import {
  CASOS_ANILLOS,
  CASOS_COMPORTAMIENTO,
  CASOS_KL,
  CASOS_KNIGHT,
  CASOS_MEDICION,
  CASOS_WHEELER,
  CASO_C74,
  LADOS,
  obtenidoDe,
} from './casos';

// Los Casos de prueba de bobinas, una capa (spec §13.3). Cada test se llama como su caso: de ahí
// sale su estado en el Informe de casos. Los que dependen del resultado principal corren de los
// dos lados de la bandera del plan B.

describe('casos de referencia: kL de la Tabla 10 de la Circular 74', () => {
  for (const caso of CASOS_KL) {
    it(caso.id, () => {
      const obtenido = kLundin(caso.x);
      expect(
        dentroDeTolerancia(obtenido, caso.esperado, caso.tolerancia),
        `${obtenido} contra ${caso.esperado}`,
      ).toBe(true);
    });
  }
});

describe('casos de referencia: la L con D0 de bobinas publicadas, como paso intermedio', () => {
  for (const caso of [CASO_C74, ...CASOS_KNIGHT]) {
    it(caso.id, () => {
      const { lamina } = unaCapaConPasos(caso.bobina, caso.bobina.vueltas, 'd0');
      for (const m of caso.medidas) {
        const obtenido = obtenidoDe(lamina, m.que);
        expect(
          dentroDeTolerancia(obtenido, m.impreso, m.tolerancia, m.diferencia),
          `${m.nombre}: ${obtenido} contra ${m.impreso} ± ${margen(m.tolerancia, m.impreso)}`,
        ).toBe(true);
      }
    });
  }
});

describe('casos de medición: M31 y M32 contra el resultado principal', () => {
  for (const caso of CASOS_MEDICION) {
    for (const lado of LADOS) {
      it(`${caso.id}${lado.sufijo}`, () => {
        const { vueltas } = caso.bobina;
        const { lamina } = unaCapaConPasos(caso.bobina, vueltas, lado.diametro);
        const obtenido = lamina.inductancia / 1e-6;
        const tolerancia = lado.planB ? caso.toleranciaPlanB : caso.tolerancia;
        expect(
          dentroDeTolerancia(obtenido, caso.medida, tolerancia),
          `${obtenido} µH contra ${caso.medida} µH`,
        ).toBe(true);
      });
    }
  }
});

describe('casos de verificación: bobinas de VHF contra la suma de anillos', () => {
  for (const caso of CASOS_ANILLOS) {
    for (const lado of LADOS) {
      it(`${caso.id}${lado.sufijo}`, () => {
        const { lamina } = unaCapaConPasos(caso.entrada, caso.vueltas, lado.diametro);
        const g = geometria(caso.entrada);
        const suma = sumaDeAnillos(lamina.diametro, caso.vueltas, g.entreCentros, g.cable);
        expect(Math.abs(lamina.inductancia / suma - 1)).toBeLessThanOrEqual(caso.tolerancia.valor);
        // La bobina buscada también se calcula: sus pasos van al Informe de casos.
        const r = calcularBobinas(caso.entrada, { planB: lado.planB });
        expect(r.estado).toBe('calculado');
      });
    }
  }
});

describe('casos de verificación: Wheeler contra la lámina de corriente exacta', () => {
  const diametro = 10e-3;
  const vueltas = 10;
  for (const caso of CASOS_WHEELER) {
    it(caso.id, () => {
      const largo = caso.largoSobreDiametro * diametro;
      const obtenido = wheeler1928(diametro, largo, vueltas);
      const exacta = laminaExacta(diametro, largo, vueltas);
      const medida = medidaNumerica({
        nombre: 'Wheeler',
        esperado: exacta,
        obtenido,
        tolerancia: caso.tolerancia,
        diferencia: caso.diferencia,
        decimales: null,
      });
      expect(
        medida.dentro,
        `${(obtenido / exacta - 1) * 100} % contra ${caso.diferencia.relativa * 100} %`,
      ).toBe(true);
    });
  }
});

describe('casos de comportamiento (spec §6.5 y §6.7)', () => {
  for (const caso of CASOS_COMPORTAMIENTO) {
    for (const lado of LADOS) {
      it(`${caso.id}${lado.sufijo}`, () => {
        const r = calcularBobinas(caso.entrada, { planB: lado.planB });
        expect(r.revision.marcados[0]?.nivel ?? null).toBe(caso.esperado.buscada);
        if ('corte' in caso.esperado) {
          expect(r.estado === 'corte' && r.codigo).toBe(caso.esperado.corte);
          return;
        }
        if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
        expect(r.avisos.map((a) => a.codigo)).toEqual(caso.esperado.avisos);
      });
    }
  }
});
