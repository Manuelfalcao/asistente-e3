import {
  type Aproximacion,
  type TipoFiltro,
  type TopologiaFiltro,
  ORDEN_MAXIMO,
  RANGO_RIPPLE,
} from '../../calculo/filtros/filtros';
import type { EspecSinSelector } from '../../entrada/campo';
import type { Opcion } from '../comun/BotonesSegmentados';

// Los campos de la Calculadora de filtros y su rango válido (spec §7.1), con los valores por
// defecto de §12.2. Pasa banda, rechaza banda y Bessel llegan después.

const MAYOR_QUE_CERO = { min: 0, minIncluido: false };

export const TIPOS: readonly Opcion<TipoFiltro>[] = [
  { valor: 'pasa-bajos', texto: 'Pasa bajos' },
  { valor: 'pasa-altos', texto: 'Pasa altos' },
];

export const APROXIMACIONES: readonly Opcion<Aproximacion>[] = [
  { valor: 'butterworth', texto: 'Butterworth' },
  { valor: 'chebyshev', texto: 'Chebyshev' },
];

export const TOPOLOGIAS: readonly Opcion<TopologiaFiltro>[] = [
  { valor: 'π', texto: 'π' },
  { valor: 'T', texto: 'T' },
];

// Lo que se guarda de la Topología: "sugerida" mientras el Alumno no elija una, y entonces sigue a
// la que usa menos bobinas.
export type TopologiaElegida = TopologiaFiltro | 'sugerida';
export const TOPOLOGIAS_GUARDADAS: readonly Opcion<TopologiaElegida>[] = [
  { valor: 'sugerida', texto: 'La que usa menos bobinas' },
  ...TOPOLOGIAS,
];

// Solo en Chebyshev.
export const RIPPLE: EspecSinSelector = {
  nombre: 'Ripple',
  magnitud: 'decibeles',
  obligatorio: true,
  rango: { min: RANGO_RIPPLE.min, max: RANGO_RIPPLE.max },
};

export const RIPPLE_POR_DEFECTO = '0,5';
export const ATAJOS_RIPPLE: readonly string[] = ['0,1', '0,5', '1'];

export const ORDEN: EspecSinSelector = {
  nombre: 'Orden',
  magnitud: 'entero',
  obligatorio: true,
  rango: { min: 1, max: ORDEN_MAXIMO },
};

export const FC: EspecSinSelector = {
  nombre: 'fc',
  magnitud: 'frecuencia',
  obligatorio: true,
  rango: MAYOR_QUE_CERO,
};

export const RS: EspecSinSelector = {
  nombre: 'Rs',
  magnitud: 'resistencia',
  obligatorio: true,
  rango: MAYOR_QUE_CERO,
};

export const RL: EspecSinSelector = { ...RS, nombre: 'RL' };

// Qu, para la pérdida de Cohn.
export const Q_BOBINA: EspecSinSelector = {
  nombre: 'Q de las bobinas',
  magnitud: 'numero',
  obligatorio: true,
  rango: MAYOR_QUE_CERO,
};

export const R_POR_DEFECTO = '50';
export const Q_BOBINA_POR_DEFECTO = '100';
