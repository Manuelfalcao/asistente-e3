import type { EspecSinSelector } from '../../entrada/campo';
import type { Opcion } from '../comun/BotonesSegmentados';

// Los campos de la Calculadora de redes de adaptación y su rango válido (spec §9.1). No hay tope en
// la relación de impedancias: los extremos los cubren los avisos de valor impracticable.

const MAYOR_QUE_CERO = { min: 0, minIncluido: false };

export type Topologia = 'L' | 'π' | 'T';

// π y T llegan con el Q de diseño.
export const TOPOLOGIAS: readonly Opcion<Topologia>[] = [
  { valor: 'L', texto: 'L' },
  { valor: 'π', texto: 'π' },
  { valor: 'T', texto: 'T' },
];

export const F0: EspecSinSelector = {
  nombre: 'f₀',
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

// Para la pérdida estimada: una R de ω₀·L/Q en serie con cada L.
export const Q_BOBINA: EspecSinSelector = {
  nombre: 'Q de la bobina',
  magnitud: 'numero',
  obligatorio: true,
  rango: MAYOR_QUE_CERO,
};

export const RS_POR_DEFECTO = '50';
export const Q_BOBINA_POR_DEFECTO = '100';
