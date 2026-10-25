import { POR_DEFECTO } from '../../calculo/arreglos/arreglos';
import type { EspecSinSelector } from '../../entrada/campo';
import { formatearNumero } from '../../entrada/formato';

// Los campos de la Calculadora de Arreglos equivalentes y su rango válido (spec §8.1). El Valor
// buscado es un campo por tipo de componente, porque cada uno tiene su magnitud y su Selector de
// unidad.

const MAYOR_QUE_CERO = { min: 0, minIncluido: false };
const PORCENTAJE = { min: 0, max: 100 };

export const CAPACIDAD_BUSCADA: EspecSinSelector = {
  nombre: 'Valor buscado',
  magnitud: 'capacidad',
  obligatorio: true,
  rango: MAYOR_QUE_CERO,
};

export const RESISTENCIA_BUSCADA: EspecSinSelector = {
  ...CAPACIDAD_BUSCADA,
  magnitud: 'resistencia',
};

export const UMBRAL: EspecSinSelector = {
  nombre: 'Umbral de error',
  magnitud: 'porcentaje',
  obligatorio: true,
  rango: PORCENTAJE,
};

// La de las resistencias, y la de los capacitores de 10 pF o más.
export const TOLERANCIA: EspecSinSelector = {
  nombre: 'Tolerancia',
  magnitud: 'porcentaje',
  obligatorio: true,
  rango: PORCENTAJE,
};

// Los capacitores de menos de 10 pF se especifican en pF absolutos.
export const TOLERANCIA_CHICOS: EspecSinSelector = {
  nombre: 'Tolerancia debajo de 10 pF',
  magnitud: 'capacidad',
  obligatorio: true,
  rango: { min: 0 },
};

// Los valores por defecto de §8.1, como se escriben en los campos: "1", "5" y "0,25" (en pF).
const porcentaje = (fraccion: number) => formatearNumero(fraccion * 100, 3);
export const UMBRAL_POR_DEFECTO = porcentaje(POR_DEFECTO.umbral);
export const TOLERANCIA_POR_DEFECTO = porcentaje(POR_DEFECTO.tolerancia);
export const TOLERANCIA_CHICOS_POR_DEFECTO = formatearNumero(
  POR_DEFECTO.toleranciaChicos / 1e-12,
  3,
);

export const TOLERANCIA_CAPACITORES: EspecSinSelector = {
  ...TOLERANCIA,
  nombre: 'Tolerancia desde 10 pF',
};
