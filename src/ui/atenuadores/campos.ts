import type { EspecSinSelector } from '../../entrada/campo';

// Los campos de la Calculadora de atenuadores y su rango válido (spec §10.1). El tope de 60 dB es
// duro; el resto de los avisos y cortes (§10.5) los pone el cálculo.

export const ATENUACION: EspecSinSelector = {
  nombre: 'Atenuación A',
  magnitud: 'decibeles',
  obligatorio: true,
  rango: { min: 0, minIncluido: false, max: 60 },
};

export const Z1: EspecSinSelector = {
  nombre: 'Z1',
  magnitud: 'resistencia',
  obligatorio: true,
  rango: { min: 0, minIncluido: false },
};

export const Z2: EspecSinSelector = { ...Z1, nombre: 'Z2' };

// Potencia que entra al atenuador: W o mW con el Selector de unidad, o dBm.
export const POTENCIA: EspecSinSelector = {
  nombre: 'Potencia de entrada',
  magnitud: 'potencia',
  dbm: true,
  rango: { min: 0, minIncluido: false },
};

// Para el criterio de Valor impracticable. Vacía: 300 MHz.
export const FRECUENCIA: EspecSinSelector = {
  nombre: 'Frecuencia',
  magnitud: 'frecuencia',
  rango: { min: 0, minIncluido: false },
};

// Z1 y Z2 vienen en 50 Ω.
export const Z_POR_DEFECTO = '50';

// Valores comerciales (spec §10.1). La tolerancia vale para todas las resistencias, salvo las del
// Inventario con tolerancia propia; la ventana es el ± en dB de las mejores combinaciones.
export const TOLERANCIA: EspecSinSelector = {
  nombre: 'Tolerancia',
  magnitud: 'porcentaje',
  obligatorio: true,
  rango: { min: 0, max: 100 },
};

export const VENTANA: EspecSinSelector = {
  nombre: 'Ventana de atenuación',
  magnitud: 'decibeles',
  obligatorio: true,
  rango: { min: 0, max: 60 },
};

// ±5 % y ±0,1 dB.
export const TOLERANCIA_POR_DEFECTO = '5';
export const VENTANA_POR_DEFECTO = '0,1';
