import { describe, expect, it } from 'vitest';
import { leerEntrada } from '../../src/entrada/leer';
import { CASOS_ENTRADA, TOLERANCIA_RELATIVA } from './casos';

describe('Entrada flexible: casos de comportamiento', () => {
  for (const caso of CASOS_ENTRADA) {
    const nombre = `«${caso.texto}» en ${caso.campo.magnitud} (${caso.campo.unidad ?? 'sin selector'})`;
    it(nombre, () => {
      const lectura = leerEntrada(caso.texto, caso.campo);
      const esperado = caso.esperado;
      if ('vacio' in esperado) {
        expect(lectura).toEqual({ tipo: 'vacio' });
      } else if ('error' in esperado) {
        expect(lectura.tipo).toBe('error');
        if (lectura.tipo === 'error') expect(lectura.mensaje).toContain(esperado.error);
      } else {
        expect(lectura.tipo).toBe('valor');
        if (lectura.tipo !== 'valor') return;
        const cota = Math.abs(esperado.valor) * TOLERANCIA_RELATIVA;
        expect(Math.abs(lectura.valor - esperado.valor)).toBeLessThanOrEqual(cota);
        expect(lectura.aviso).toBe(esperado.aviso);
        if (esperado.dbm !== undefined) {
          expect(lectura.dbm).toBeCloseTo(esperado.dbm, 12);
        } else {
          expect(lectura.dbm).toBeUndefined();
        }
      }
    });
  }

  it('el error de «4,7x» es exactamente el de la spec', () => {
    expect(leerEntrada('4,7x', { magnitud: 'inductancia', unidad: 'nH' })).toEqual({
      tipo: 'error',
      mensaje: 'No entiendo «4,7x»',
    });
  });

  it('hay unas 40 cadenas distintas', () => {
    expect(new Set(CASOS_ENTRADA.map((c) => c.texto)).size).toBeGreaterThanOrEqual(40);
  });
});
