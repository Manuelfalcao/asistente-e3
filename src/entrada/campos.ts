// Qué es cada campo de valor: su magnitud y el Selector de unidad en que se lee un número escrito
// sin prefijo ni unidad (spec §5.1). Los rangos válidos los fija cada Calculadora (campo.ts).

export type Magnitud =
  | 'inductancia'
  | 'capacidad'
  | 'resistencia'
  | 'frecuencia'
  | 'potencia'
  | 'largo'
  | 'decibeles'
  | 'porcentaje'
  | 'numero'
  | 'entero';

export interface Campo {
  magnitud: Magnitud;
  // La unidad que marca el Selector de unidad, como se ve en el desplegable ("nH", "kΩ", "dBm").
  // Los campos sin Selector la dejan vacía y se leen en la unidad por defecto de la magnitud.
  unidad?: string;
  // El campo de potencia acepta dBm (solo en atenuadores).
  dbm?: boolean;
}

export type Unidad = 'H' | 'F' | 'Ω' | 'Hz' | 'W' | 'dBm' | 'mm' | 'dB' | '%';
export type Prefijo = 'p' | 'n' | 'µ' | 'm' | 'k' | 'M' | 'G' | 'P';

export const OHMIO = 'Ω';
export const MICRO = 'µ';
export const MENOS = '−';

export const EXPONENTE_DEL_PREFIJO: Record<Prefijo, number> = {
  p: -12,
  n: -9,
  [MICRO]: -6,
  m: -3,
  k: 3,
  M: 6,
  G: 9,
  P: 15,
};

interface Definicion {
  unidad: Unidad | null;
  // Cómo se nombra al campo en los motivos: "Este campo es de inductancia (H)".
  nombre: string;
  prefijos: readonly Prefijo[];
  // Notación RKM ("4n7"): solo en L, C y R.
  rkm: boolean;
  // Exponente de la unidad base respecto de la unidad SI en que se devuelve el valor (mm → m).
  exponenteBase: number;
  // Selector de unidad: opciones, con la primera por defecto (spec §5.1).
  selector: readonly string[];
}

export const DEFINICIONES: Record<Magnitud, Definicion> = {
  inductancia: {
    unidad: 'H',
    nombre: 'inductancia (H)',
    prefijos: ['n', MICRO, 'm'],
    rkm: true,
    exponenteBase: 0,
    selector: ['nH', `${MICRO}H`],
  },
  capacidad: {
    unidad: 'F',
    nombre: 'capacidad (F)',
    prefijos: ['p', 'n', MICRO],
    rkm: true,
    exponenteBase: 0,
    selector: ['pF', 'nF', `${MICRO}F`],
  },
  resistencia: {
    unidad: OHMIO,
    nombre: `resistencia (${OHMIO})`,
    prefijos: ['k', 'M'],
    rkm: true,
    exponenteBase: 0,
    selector: [OHMIO, `k${OHMIO}`, `M${OHMIO}`],
  },
  frecuencia: {
    unidad: 'Hz',
    nombre: 'frecuencia (Hz)',
    prefijos: ['k', 'M', 'G'],
    rkm: false,
    exponenteBase: 0,
    selector: ['MHz', 'kHz', 'GHz'],
  },
  potencia: {
    unidad: 'W',
    nombre: 'potencia (W)',
    prefijos: [MICRO, 'm'],
    rkm: false,
    exponenteBase: 0,
    selector: ['W', 'mW'],
  },
  largo: {
    unidad: 'mm',
    nombre: 'largo en mm',
    prefijos: [],
    rkm: false,
    exponenteBase: -3,
    selector: ['mm'],
  },
  decibeles: {
    unidad: 'dB',
    nombre: 'decibeles (dB)',
    prefijos: [],
    rkm: false,
    exponenteBase: 0,
    selector: [],
  },
  porcentaje: {
    unidad: '%',
    nombre: 'porcentaje (%)',
    prefijos: [],
    rkm: false,
    exponenteBase: 0,
    selector: [],
  },
  numero: {
    unidad: null,
    nombre: 'número',
    prefijos: [],
    rkm: false,
    exponenteBase: 0,
    selector: [],
  },
  entero: {
    unidad: null,
    nombre: 'número entero',
    prefijos: [],
    rkm: false,
    exponenteBase: 0,
    selector: [],
  },
};

// Las opciones del Selector de unidad de un campo; la primera es la que viene por defecto.
export function opcionesDelSelector(magnitud: Magnitud, conDbm = false): readonly string[] {
  const base = DEFINICIONES[magnitud].selector;
  return magnitud === 'potencia' && conDbm ? [...base, 'dBm'] : base;
}

// Exponente (de diez) con que el Selector de unidad pasa un número a la unidad SI.
export function exponenteDelSelector(campo: Campo): number {
  const def = DEFINICIONES[campo.magnitud];
  const unidad = campo.unidad;
  if (!unidad || unidad === 'dBm' || campo.magnitud === 'largo') return def.exponenteBase;
  const prefijo = unidad.length > 1 ? unidad[0] : undefined;
  if (prefijo && prefijo in EXPONENTE_DEL_PREFIJO) {
    return EXPONENTE_DEL_PREFIJO[prefijo as Prefijo];
  }
  return def.exponenteBase;
}
