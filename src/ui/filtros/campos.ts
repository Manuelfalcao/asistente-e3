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
// defecto de §12.2.

const MAYOR_QUE_CERO = { min: 0, minIncluido: false };

export const TIPOS: readonly Opcion<TipoFiltro>[] = [
  { valor: 'pasa-bajos', texto: 'Pasa bajos' },
  { valor: 'pasa-altos', texto: 'Pasa altos' },
  { valor: 'pasa-banda', texto: 'Pasa banda' },
  { valor: 'rechaza-banda', texto: 'Rechaza banda' },
];

// Cómo da la banda el Alumno en pasa banda y rechaza banda (spec §7.1).
export type ModoBanda = 'f1-f2' | 'f0-bw';
export const MODOS_BANDA: readonly Opcion<ModoBanda>[] = [
  { valor: 'f1-f2', texto: 'f1 y f2' },
  { valor: 'f0-bw', texto: 'f0 y BW' },
];

export const APROXIMACIONES: readonly Opcion<Aproximacion>[] = [
  { valor: 'butterworth', texto: 'Butterworth' },
  { valor: 'chebyshev', texto: 'Chebyshev' },
  { valor: 'bessel', texto: 'Bessel' },
];

// Las escaleras π y T, y en pasa banda también los resonadores acoplados (spec §7.1 y §7.7).
export type TopologiaPantalla = TopologiaFiltro | 'resonadores';

export const TOPOLOGIAS: readonly Opcion<TopologiaPantalla>[] = [
  { valor: 'π', texto: 'π' },
  { valor: 'T', texto: 'T' },
];

export const TOPOLOGIAS_PASA_BANDA: readonly Opcion<TopologiaPantalla>[] = [
  ...TOPOLOGIAS,
  { valor: 'resonadores', texto: 'Resonadores acoplados' },
];

// Lo que se guarda de la Topología: "sugerida" mientras el Alumno no elija una, y entonces sigue a
// la que usa menos bobinas.
export type TopologiaElegida = TopologiaPantalla | 'sugerida';
export const TOPOLOGIAS_GUARDADAS: readonly Opcion<TopologiaElegida>[] = [
  { valor: 'sugerida', texto: 'La que usa menos bobinas' },
  ...TOPOLOGIAS_PASA_BANDA,
];

// La L de los resonadores acoplados. Vacía, la que propone el Asistente (spec §7.7).
export const L_RESONADORES: EspecSinSelector = {
  nombre: 'L de los resonadores',
  magnitud: 'inductancia',
  rango: MAYOR_QUE_CERO,
};

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

// Cómo se da el Orden (spec §7.1): escrito, o calculado desde una atenuación mínima As a una fs.
export type ModoOrden = 'ingresar' | 'calcular';
export const MODOS_ORDEN: readonly Opcion<ModoOrden>[] = [
  { valor: 'ingresar', texto: 'Ingresar' },
  { valor: 'calcular', texto: 'Calcular desde una atenuación' },
];

// La atenuación mínima que se pide a fs, y esa frecuencia.
export const AS: EspecSinSelector = {
  nombre: 'As',
  magnitud: 'decibeles',
  obligatorio: true,
  rango: { min: 0, minIncluido: false },
};

export const FC: EspecSinSelector = {
  nombre: 'fc',
  magnitud: 'frecuencia',
  obligatorio: true,
  rango: MAYOR_QUE_CERO,
};

export const FS: EspecSinSelector = { ...FC, nombre: 'fs' };

// Los bordes, o la central y el ancho, de pasa banda y rechaza banda.
export const F1: EspecSinSelector = { ...FC, nombre: 'f1' };
export const F2: EspecSinSelector = { ...FC, nombre: 'f2' };
export const F0: EspecSinSelector = { ...FC, nombre: 'f0' };
export const BW: EspecSinSelector = { ...FC, nombre: 'BW' };

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
