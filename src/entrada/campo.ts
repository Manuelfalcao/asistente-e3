import type { Campo } from './campos';
import { formatearDbm, formatearValor } from './formato';
import { leerEntrada } from './leer';

// Un campo de valor tal como lo ve una Calculadora: lo que dice el lector de la Entrada flexible más el rango válido que
// fija ella (spec §5.1: el lector solo lee).

export interface Rango {
  // En la unidad del valor leído (SI, o dB / % / número).
  min?: number;
  // Si el mínimo vale. Por defecto sí.
  minIncluido?: boolean;
  max?: number;
}

export interface EspecCampo extends Campo {
  // Como se nombra en "Corregí: …" y "Completá: …".
  nombre: string;
  obligatorio?: boolean;
  rango?: Rango;
}

// La especificación de un campo antes de saber qué marca su Selector de unidad.
export type EspecSinSelector = Omit<EspecCampo, 'unidad'>;

export type EstadoCampo =
  | { estado: 'vacio' }
  | { estado: 'valido'; valor: number; dbm?: number; eco: string; aviso?: string }
  | { estado: 'invalido'; motivo: string };

function fueraDeRango(valor: number, spec: EspecCampo): string | null {
  const { rango } = spec;
  if (!rango) return null;
  const texto = (v: number) => formatearValor(v, spec.magnitud);
  if (rango.min !== undefined) {
    if (rango.minIncluido === false ? valor <= rango.min : valor < rango.min) {
      return rango.minIncluido === false
        ? `Tiene que ser mayor que ${texto(rango.min)}`
        : `Tiene que ser ${texto(rango.min)} o más`;
    }
  }
  if (rango.max !== undefined && valor > rango.max) {
    return `Tiene que ser ${texto(rango.max)} o menos`;
  }
  return null;
}

export function leerCampo(texto: string, spec: EspecCampo): EstadoCampo {
  const lectura = leerEntrada(texto, spec);
  if (lectura.tipo === 'vacio') return { estado: 'vacio' };
  if (lectura.tipo === 'error') return { estado: 'invalido', motivo: lectura.mensaje };
  const motivo = fueraDeRango(lectura.valor, spec);
  if (motivo) return { estado: 'invalido', motivo };
  const eco =
    lectura.dbm === undefined
      ? `= ${formatearValor(lectura.valor, spec.magnitud)}`
      : `= ${formatearDbm(lectura.dbm)} = ${formatearValor(lectura.valor, 'potencia')}`;
  return {
    estado: 'valido',
    valor: lectura.valor,
    ...(lectura.dbm === undefined ? {} : { dbm: lectura.dbm }),
    eco,
    ...(lectura.aviso ? { aviso: lectura.aviso } : {}),
  };
}

// Qué muestra el área de resultados cuando no se puede calcular (spec §5.1): con un campo inválido
// no se calcula y no queda el resultado viejo; con un obligatorio vacío, tampoco. Devuelve null
// cuando se puede calcular.
export function mensajeDeResultados(
  campos: readonly { nombre: string; obligatorio: boolean; estado: EstadoCampo }[],
): string | null {
  const invalidos = campos.filter((c) => c.estado.estado === 'invalido').map((c) => c.nombre);
  if (invalidos.length > 0) return `Corregí: ${invalidos.join(', ')}`;
  const faltan = campos
    .filter((c) => c.obligatorio && c.estado.estado === 'vacio')
    .map((c) => c.nombre);
  if (faltan.length > 0) return `Completá: ${faltan.join(', ')}`;
  return null;
}
