import { describe, expect, it } from 'vitest';
import {
  CASOS_COHN_RESONADORES,
  CASOS_COMPORTAMIENTO_RESONADORES,
  CASOS_VERIFICACION_RESONADORES,
} from './casos-resonadores';
import { casoCohn, casoComportamiento, casoVerificacion } from './informe-resonadores';

// Los Casos de prueba de resonadores acoplados (spec §13.3), con las mismas medidas que muestra el
// Informe de casos. Los que dependen de una Deducción propia corren de los dos lados de su bandera.

describe('casos de verificación de resonadores acoplados: CR1 a CR14 con el oráculo ABCD', () => {
  for (const caso of CASOS_VERIFICACION_RESONADORES) {
    it(caso.id, () => {
      for (const m of casoVerificacion(caso).medidas) {
        expect(m.dentro, `${m.nombre}: ${m.obtenido} contra ${m.esperado}`).toBe(true);
      }
    });
  }
});

describe('pérdida de Cohn contra la red simulada con Qu', () => {
  for (const caso of CASOS_COHN_RESONADORES) {
    it(caso.id, () => {
      for (const m of casoCohn(caso).medidas) {
        expect(m.dentro, `${m.nombre}: ${m.obtenido} contra ${m.esperado}`).toBe(true);
      }
    });
  }
});

describe('casos de comportamiento de resonadores acoplados', () => {
  for (const caso of CASOS_COMPORTAMIENTO_RESONADORES) {
    it(caso.id, () => {
      const { esperado, obtenido } = casoComportamiento(caso);
      expect(obtenido).toBe(esperado);
    });
  }
});
