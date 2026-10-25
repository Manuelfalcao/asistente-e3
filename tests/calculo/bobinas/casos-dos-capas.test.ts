import { describe, expect, it } from 'vitest';
import { calcularBobinas } from '../../../src/calculo/bobinas/bobinas';
import { dosCapasConPasos, rosaGrover91ConPasos } from '../../../src/calculo/bobinas/dos-capas';
import { bsAjuste, geometriaDosCapas, hazeltine } from '../../../src/calculo/bobinas/formulas';
import { dentroDeTolerancia, margen } from '../../casos';
import { medidaNumerica } from '../../casos-informe';
import {
  CASOS_ANILLOS_DOS_CAPAS,
  CASOS_BS,
  CASOS_COMPORTAMIENTO_DOS_CAPAS,
  CASOS_HAZELTINE,
  CASO_C74_VARIAS_CAPAS,
  LADOS_DOS_CAPAS,
  obtenidoDeRosa,
  sumaDosCapas,
} from './casos-dos-capas';

// Los Casos de prueba de bobinas, dos capas (spec §13.3). Cada test se llama como su caso: de ahí
// sale su estado en el Informe de casos. Los que dependen de la L de dos capas corren de los dos
// lados de la bandera del plan B.

describe('casos de referencia: Rosa y Grover (91) con el ejemplo de la Circular 74', () => {
  const caso = CASO_C74_VARIAS_CAPAS;
  it(caso.id, () => {
    const { rosa } = rosaGrover91ConPasos(
      caso.radioMedio,
      caso.largo,
      caso.profundidad,
      caso.vueltas,
    );
    for (const m of caso.medidas) {
      const obtenido = obtenidoDeRosa(rosa, m.que);
      expect(
        dentroDeTolerancia(obtenido, m.impreso, m.tolerancia),
        `${m.nombre}: ${obtenido} contra ${m.impreso} ± ${margen(m.tolerancia, m.impreso)}`,
      ).toBe(true);
    }
  });
});

describe('casos de referencia: Bs de la Tabla X de Rosa y Grover', () => {
  for (const caso of CASOS_BS) {
    it(caso.id, () => {
      const obtenido = bsAjuste(caso.nPrima);
      expect(
        dentroDeTolerancia(obtenido, caso.esperado, caso.tolerancia),
        `${obtenido} contra ${caso.esperado}`,
      ).toBe(true);
    });
  }
});

describe('casos de verificación: dos capas contra la suma de anillos', () => {
  for (const caso of CASOS_ANILLOS_DOS_CAPAS) {
    for (const lado of LADOS_DOS_CAPAS) {
      it(`${caso.id}${lado.sufijo}`, () => {
        const { lamina } = dosCapasConPasos(
          caso.bobina,
          caso.bobina.vueltasPorCapa,
          lado.correccion,
        );
        const tolerancia = lado.planB ? caso.toleranciaPlanB : caso.tolerancia;
        const error = lamina.inductancia / sumaDosCapas(caso.bobina) - 1;
        expect(Math.abs(error), `${error * 100} %`).toBeLessThanOrEqual(tolerancia.valor);
      });
    }
  }
});

describe('casos de verificación: Hazeltine contra la suma de anillos', () => {
  for (const caso of CASOS_HAZELTINE) {
    it(caso.id, () => {
      const g = geometriaDosCapas(caso.bobina);
      const n = caso.bobina.vueltasPorCapa;
      const obtenido = hazeltine(g.radioMedio, n * g.entreCentros, g.profundidad, 2 * n);
      const esperado = sumaDosCapas(caso.bobina);
      const medida = medidaNumerica({
        nombre: 'Hazeltine',
        esperado,
        obtenido,
        tolerancia: caso.tolerancia,
        diferencia: caso.diferencia,
        decimales: null,
      });
      expect(
        medida.dentro,
        `${(obtenido / esperado - 1) * 100} % contra ${caso.diferencia.relativa * 100} %`,
      ).toBe(true);
    });
  }
});

describe('casos de comportamiento de dos capas (spec §6.4 y §6.7)', () => {
  for (const caso of CASOS_COMPORTAMIENTO_DOS_CAPAS) {
    for (const lado of LADOS_DOS_CAPAS) {
      it(`${caso.id}${lado.sufijo}`, () => {
        const r = calcularBobinas(caso.entrada, { planBDosCapas: lado.planB });
        if (r.estado !== 'calculado') throw new Error(`una capa no calculó: ${r.codigo}`);
        const { dosCapas } = r;
        if ('fueraDeRango' in caso.esperado) {
          expect(dosCapas.estado === 'fuera-de-rango' && dosCapas.codigo).toBe(
            caso.esperado.fueraDeRango,
          );
          return;
        }
        if (dosCapas.estado !== 'calculado') throw new Error(`fuera de rango: ${dosCapas.codigo}`);
        expect(dosCapas.avisos.map((a) => a.codigo)).toEqual(caso.esperado.avisos);
      });
    }
  }
});
