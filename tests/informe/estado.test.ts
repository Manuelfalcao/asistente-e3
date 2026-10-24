import { describe, expect, it } from 'vitest';
import {
  type PruebaVitest,
  estadoDelCaso,
  leerResultadosVitest,
  resumenDeEstados,
} from '../../scripts/informe/estado';
import type { CasoDeComportamiento, CasoDeRevision } from '../casos-informe';

// El estado de cada caso sale del resultado de Vitest (spec §13.6): el test que lo corre se llama
// como el caso, y si algún número queda fuera de la tolerancia el caso también falla.

const prueba = (titulo: string, estado: PruebaVitest['estado'] = 'passed'): PruebaVitest => ({
  titulo,
  estado,
});

const revision = (id: string, dentro = true): CasoDeRevision => ({
  clase: 'referencia',
  id,
  entradas: '',
  referencia: '',
  pasos: [],
  medidas: [
    {
      nombre: 'x',
      esperado: '1',
      obtenido: '1',
      errorRelativo: 0,
      tolerancia: '± 1',
      motivo: '',
      dentro,
    },
  ],
});

const comportamiento = (id: string, coincide = true): CasoDeComportamiento => ({
  clase: 'comportamiento',
  id,
  entradas: '',
  referencia: '',
  esperado: '',
  obtenido: '',
  coincide,
});

describe('leer el JSON de Vitest', () => {
  it('junta los tests de todos los archivos con su estado', () => {
    const json = {
      testResults: [
        {
          name: 'a.test.ts',
          assertionResults: [
            { title: 'uno', status: 'passed' },
            { title: 'dos', status: 'failed' },
          ],
        },
        { name: 'b.test.ts', assertionResults: [{ title: 'tres', status: 'skipped' }] },
      ],
    };
    expect(leerResultadosVitest(json)).toEqual([
      { titulo: 'uno', estado: 'passed' },
      { titulo: 'dos', estado: 'failed' },
      { titulo: 'tres', estado: 'skipped' },
    ]);
  });

  it('un JSON que no es de Vitest es un error, no un informe vacío', () => {
    expect(() => leerResultadosVitest({ hola: 1 })).toThrow(/Vitest/);
    expect(() => leerResultadosVitest(null)).toThrow(/Vitest/);
  });
});

describe('estado de un caso', () => {
  it('pasa si el test que se llama como el caso pasó', () => {
    expect(
      estadoDelCaso(revision('Fig. 8: 5000 → 2000 Ω, 10 dB'), [
        prueba('Fig. 8: 5000 → 2000 Ω, 10 dB'),
      ]),
    ).toBe('ok');
  });

  it('el título puede seguir al id después de dos puntos', () => {
    expect(estadoDelCaso(revision('A1'), [prueba('A1: 50 → 50 Ω, 3 dB')])).toBe('ok');
  });

  it('A1 no toma el test de A10', () => {
    expect(estadoDelCaso(revision('A1'), [prueba('A10: 50 → 75 Ω', 'failed')])).toBe('sin-test');
  });

  it('falla si el test falló', () => {
    expect(estadoDelCaso(revision('A1'), [prueba('A1: x', 'failed')])).toBe('falla');
  });

  it('con varios tests del mismo caso alcanza uno en rojo', () => {
    const pruebas = [prueba('A1: x'), prueba('A1: y', 'failed')];
    expect(estadoDelCaso(revision('A1'), pruebas)).toBe('falla');
  });

  it('sin test que lo corra no está aprobado', () => {
    expect(estadoDelCaso(revision('A1'), [prueba('otro')])).toBe('sin-test');
  });

  it('un test salteado no cuenta como aprobado', () => {
    expect(estadoDelCaso(revision('A1'), [prueba('A1', 'skipped')])).toBe('sin-test');
  });

  it('falla aunque el test haya pasado si un número queda fuera de la tolerancia', () => {
    expect(estadoDelCaso(revision('A1', false), [prueba('A1')])).toBe('falla');
  });

  it('los de comportamiento fallan si lo obtenido no coincide con lo esperado', () => {
    expect(estadoDelCaso(comportamiento('corte'), [prueba('corte')])).toBe('ok');
    expect(estadoDelCaso(comportamiento('corte', false), [prueba('corte')])).toBe('falla');
  });
});

describe('resumen', () => {
  it('cuenta cada estado', () => {
    expect(resumenDeEstados(['ok', 'ok', 'falla', 'sin-test'])).toEqual({
      total: 4,
      ok: 2,
      falla: 1,
      sinTest: 1,
    });
  });
});
