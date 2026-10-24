import { describe, expect, it } from 'vitest';
import { Almacen, CLAVE, type Soporte, migrar } from '../../src/almacen/almacen';

function memoria(
  inicial: Record<string, string> = {},
): Soporte & { datos: Record<string, string> } {
  const datos = { ...inicial };
  return {
    datos,
    getItem: (k) => datos[k] ?? null,
    setItem: (k, v) => void (datos[k] = v),
    removeItem: (k) => void delete datos[k],
  };
}

const roto: Soporte = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
};

describe('almacén', () => {
  it('guarda y lee las entradas y la última Calculadora', () => {
    const s = memoria();
    const a = new Almacen(s);
    expect(a.guardarEntrada('atenuadores', 'z1', { texto: '75', unidad: 'Ω' })).toBe(true);
    expect(a.guardarEntrada('atenuadores', 'atenuacion', { texto: '10' })).toBe(true);
    expect(a.guardarUltima('atenuadores')).toBe(true);

    const b = new Almacen(s); // al reabrir
    expect(b.ultima()).toBe('atenuadores');
    expect(b.entrada('atenuadores', 'z1')).toEqual({ texto: '75', unidad: 'Ω' });
    expect(b.entrada('atenuadores', 'atenuacion')).toEqual({ texto: '10' });
    expect(b.entrada('bobinas', 'x')).toBeUndefined();
  });

  it('el JSON guardado lleva version', () => {
    const s = memoria();
    new Almacen(s).guardarUltima('filtros');
    expect(JSON.parse(s.datos[CLAVE]).version).toBe(1);
  });

  it('sin nada guardado arranca vacío', () => {
    expect(new Almacen(memoria()).ultima()).toBeUndefined();
  });

  it('migra: descarta lo de otra forma o versión y las entradas mal formadas', () => {
    expect(migrar(null).entradas).toEqual({});
    expect(migrar({ entradas: {} }).version).toBe(1);
    expect(migrar({ version: 99, ultima: 'redes' }).ultima).toBeUndefined();
    const m = migrar({
      version: 1,
      ultima: 'redes',
      entradas: { redes: { a: { texto: '1', unidad: 'nH' }, b: { texto: 5 }, c: 3 }, x: 7 },
      inventario: { R: [10] },
    });
    expect(m.ultima).toBe('redes');
    expect(m.entradas).toEqual({ redes: { a: { texto: '1', unidad: 'nH' } } });
    expect(m.inventario).toEqual({ R: [10] });
  });

  it('un JSON ilegible en el soporte no rompe el arranque', () => {
    expect(new Almacen(memoria({ [CLAVE]: '{no es json' })).ultima()).toBeUndefined();
  });

  it('conserva el Inventario al escribir otras cosas', () => {
    const s = memoria({ [CLAVE]: JSON.stringify({ version: 1, entradas: {}, inventario: [1] }) });
    new Almacen(s).guardarUltima('arreglos');
    expect(JSON.parse(s.datos[CLAVE]).inventario).toEqual([1]);
  });

  it('si la escritura falla, no tira error y sigue andando en memoria', () => {
    const a = new Almacen(roto);
    expect(a.guardarEntrada('atenuadores', 'z1', { texto: '75' })).toBe(false);
    expect(a.guardarUltima('redes')).toBe(false);
    expect(a.entrada('atenuadores', 'z1')).toEqual({ texto: '75' });
    expect(a.puedeGuardar()).toBe(false);
  });

  it('sin soporte tampoco tira error', () => {
    const a = new Almacen(null);
    expect(a.guardarUltima('redes')).toBe(false);
    expect(a.puedeGuardar()).toBe(false);
  });

  it('puedeGuardar prueba la escritura y no deja rastro', () => {
    const s = memoria();
    expect(new Almacen(s).puedeGuardar()).toBe(true);
    expect(Object.keys(s.datos)).toEqual([]);
  });
});
