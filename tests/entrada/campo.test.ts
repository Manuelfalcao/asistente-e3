import { describe, expect, it } from 'vitest';
import { leerCampo, mensajeDeResultados, type EspecCampo } from '../../src/entrada/campo';

const ATENUACION: EspecCampo = {
  nombre: 'Atenuación A',
  magnitud: 'decibeles',
  obligatorio: true,
  rango: { min: 0, minIncluido: false, max: 60 },
};
const Z1: EspecCampo = {
  nombre: 'Z1',
  magnitud: 'resistencia',
  unidad: 'Ω',
  obligatorio: true,
  rango: { min: 0, minIncluido: false },
};
const POTENCIA: EspecCampo = {
  nombre: 'Potencia de entrada',
  magnitud: 'potencia',
  unidad: 'W',
  dbm: true,
  rango: { min: 0, minIncluido: false },
};

describe('leerCampo', () => {
  it('un valor válido lleva su eco en el formato de salida', () => {
    expect(leerCampo('4n7', { nombre: 'L', magnitud: 'inductancia', unidad: 'nH' })).toEqual({
      estado: 'valido',
      valor: 4.7e-9,
      eco: '= 4,7 nH',
    });
  });

  it('el aviso suave deja el valor y reemplaza al eco', () => {
    expect(leerCampo('1.000', Z1)).toEqual({
      estado: 'valido',
      valor: 1,
      eco: '= 1 Ω',
      aviso: 'Se leyó 1 Ω. Para mil, escribí 1000 o 1k.',
    });
  });

  it('un campo vacío no es inválido', () => {
    expect(leerCampo('  ', Z1)).toEqual({ estado: 'vacio' });
  });

  it('lo que no se lee es inválido, con el motivo de una línea', () => {
    expect(leerCampo('4,7x', Z1)).toEqual({ estado: 'invalido', motivo: 'No entiendo «4,7x»' });
  });

  it('una potencia en dBm muestra los dos valores', () => {
    const estado = leerCampo('10 dBm', POTENCIA);
    expect(estado).toMatchObject({ estado: 'valido', eco: '= 10 dBm = 10 mW' });
  });

  describe('rango', () => {
    it('mayor que cero, sin incluirlo', () => {
      expect(leerCampo('0', Z1)).toEqual({
        estado: 'invalido',
        motivo: 'Tiene que ser mayor que 0 Ω',
      });
      expect(leerCampo('0,01', Z1).estado).toBe('valido');
    });

    it('un tope incluye su valor', () => {
      expect(leerCampo('60', ATENUACION).estado).toBe('valido');
      expect(leerCampo('60,01', ATENUACION)).toEqual({
        estado: 'invalido',
        motivo: 'Tiene que ser 60 dB o menos',
      });
    });

    it('un mínimo que se incluye', () => {
      const campo: EspecCampo = {
        nombre: 'Separación',
        magnitud: 'largo',
        rango: { min: 0 },
      };
      expect(leerCampo('0', campo).estado).toBe('valido');
      expect(leerCampo('-1', campo).estado).toBe('invalido');
    });

    it('la potencia en dBm negativa es válida: en vatios sigue siendo mayor que cero', () => {
      expect(leerCampo('-30 dBm', POTENCIA).estado).toBe('valido');
    });
  });
});

describe('mensajeDeResultados', () => {
  const campo = (nombre: string, texto: string, spec: EspecCampo) => ({
    nombre,
    obligatorio: !!spec.obligatorio,
    estado: leerCampo(texto, spec),
  });

  it('con todo en orden no hay mensaje', () => {
    expect(
      mensajeDeResultados([campo('Atenuación A', '20', ATENUACION), campo('Z1', '50', Z1)]),
    ).toBeNull();
  });

  it('un campo inválido pide corregir, con su nombre', () => {
    expect(mensajeDeResultados([campo('Z1', '5x', Z1)])).toBe('Corregí: Z1');
  });

  it('varios inválidos se listan', () => {
    expect(
      mensajeDeResultados([campo('Atenuación A', '90', ATENUACION), campo('Z1', '5x', Z1)]),
    ).toBe('Corregí: Atenuación A, Z1');
  });

  it('un obligatorio vacío pide completar', () => {
    expect(mensajeDeResultados([campo('Atenuación A', '', ATENUACION)])).toBe(
      'Completá: Atenuación A',
    );
  });

  it('un campo opcional vacío no pide nada', () => {
    expect(mensajeDeResultados([campo('Potencia de entrada', '', POTENCIA)])).toBeNull();
  });

  it('corregir va antes que completar', () => {
    expect(
      mensajeDeResultados([campo('Atenuación A', '', ATENUACION), campo('Z1', '5x', Z1)]),
    ).toBe('Corregí: Z1');
  });
});
