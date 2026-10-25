import type { EspecSinSelector } from '../../entrada/campo';

// Los campos de la Calculadora de bobinas y su rango válido (spec §6.1). No hay tope de N ni de L:
// los cortes (menos de una vuelta) y los avisos los pone el cálculo.

const MAYOR_QUE_CERO = { min: 0, minIncluido: false };

export const INDUCTANCIA: EspecSinSelector = {
  nombre: 'Inductancia buscada',
  magnitud: 'inductancia',
  obligatorio: true,
  rango: MAYOR_QUE_CERO,
};

export const CARRETE: EspecSinSelector = {
  nombre: 'Diámetro del carrete',
  magnitud: 'largo',
  obligatorio: true,
  rango: MAYOR_QUE_CERO,
};

// Con esmalte: para alambre desnudo o plateado, el diámetro desnudo.
export const CABLE: EspecSinSelector = { ...CARRETE, nombre: 'Diámetro del cable' };

// Cero es vueltas juntas.
export const SEPARACION: EspecSinSelector = {
  nombre: 'Separación entre vueltas',
  magnitud: 'largo',
  obligatorio: true,
  rango: { min: 0 },
};

// Opcional: para el aviso de autorresonancia.
export const FRECUENCIA: EspecSinSelector = {
  nombre: 'Frecuencia de trabajo',
  magnitud: 'frecuencia',
  rango: MAYOR_QUE_CERO,
};

export const SEPARACION_POR_DEFECTO = '0';
