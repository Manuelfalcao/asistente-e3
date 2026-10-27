import type { Redondeo } from '../../../src/calculo/atenuadores/valores-comerciales';
import type { ClaseCaso, Tolerancia } from '../../casos';

// Casos de prueba de los atenuadores con Valores comerciales (spec §10.4 y §13.3): las opciones que
// elige el Asistente, armadas en el oráculo ABCD de tests/oraculos/, dan la atenuación y las pérdidas
// de retorno que calcula el barrido común. Los de comportamiento fijan qué pasa cuando ninguna
// combinación entra en la ventana y cuándo se redondea con el Inventario.

const ORACULO = 'tests/oraculos/abcd.ts (ABCD con complejos)';
const SPEC = 'spec §10.4';

export interface CasoComercial {
  clase: ClaseCaso;
  id: string;
  topologia: 'T' | 'π' | 'pad';
  // La atenuación del T o del π; el pad se calcula con A_min.
  atenuacion?: number;
  z1: number;
  z2: number;
  // Con qué se redondea. Un Inventario por inclusión lleva sus valores.
  redondeo: Redondeo;
  inventario?: readonly number[];
  // En dB. Vacía: la por defecto, ±0,1 dB.
  ventana?: number;
  referencia: string;
}

export interface CasoVerificacionComercial extends CasoComercial {
  clase: 'verificacion';
  oraculo: string;
}

export interface CasoComportamientoComercial extends CasoComercial {
  clase: 'comportamiento';
  // Las resistencias del redondeo en el orden de la fuente a la carga, y cuántas combinaciones se
  // evaluaron; y si alguna entró en la ventana.
  esperado: { redondeo: readonly number[]; evaluadas: number; dentroDeLaVentana: boolean };
}

// Lo que se le pide al oráculo, con su motivo: no hay otra tolerancia (spec §13.2).
export const TOLERANCIA_COMERCIAL: {
  atenuacion: Extract<Tolerancia, { tipo: 'absoluta' }>;
  perdidaDeRetorno: Extract<Tolerancia, { tipo: 'absoluta' }>;
} = {
  atenuacion: {
    tipo: 'absoluta',
    valor: 1e-9,
    motivo: 'Dos vías exactas en doble precisión: queda solo el redondeo de la aritmética.',
  },
  perdidaDeRetorno: {
    tipo: 'absoluta',
    valor: 1e-6,
    motivo:
      'Dos vías exactas en doble precisión; la PR sale de un cociente de impedancias complejas ' +
      'y amplifica un poco el redondeo.',
  },
};

export const CASOS_VERIFICACION_COMERCIAL: readonly CasoVerificacionComercial[] = [
  {
    clase: 'verificacion',
    id: 'Comercial V1: T de 10 dB, 50 → 50 Ω, E12',
    topologia: 'T',
    atenuacion: 10,
    z1: 50,
    z2: 50,
    redondeo: 'E12',
    referencia: SPEC,
    oraculo: ORACULO,
  },
  {
    clase: 'verificacion',
    id: 'Comercial V2: π de 20 dB, 50 → 75 Ω, E12',
    topologia: 'π',
    atenuacion: 20,
    z1: 50,
    z2: 75,
    redondeo: 'E12',
    referencia: SPEC,
    oraculo: ORACULO,
  },
  {
    clase: 'verificacion',
    id: 'Comercial V3: pad de mínima pérdida, 50 → 75 Ω, E24',
    topologia: 'pad',
    z1: 50,
    z2: 75,
    redondeo: 'E24',
    referencia: SPEC,
    oraculo: ORACULO,
  },
  {
    clase: 'verificacion',
    id: 'Comercial V4: pad de mínima pérdida, 300 → 50 Ω, E6',
    topologia: 'pad',
    z1: 300,
    z2: 50,
    redondeo: 'E6',
    referencia: SPEC,
    oraculo: ORACULO,
  },
];

export const CASOS_COMPORTAMIENTO_COMERCIAL: readonly CasoComportamientoComercial[] = [
  {
    clase: 'comportamiento',
    id: 'Comercial C1: ninguna combinación dentro de la ventana',
    topologia: 'T',
    atenuacion: 10,
    z1: 50,
    z2: 50,
    redondeo: 'E6',
    ventana: 0.0001,
    referencia: `${SPEC}: si ninguna entra, las 3 de menor error de atenuación, con un aviso`,
    esperado: { redondeo: [22, 33, 22], evaluadas: 343, dentroDeLaVentana: false },
  },
  {
    clase: 'comportamiento',
    id: 'Comercial C2: redondeo con el Inventario de resistencias',
    topologia: 'T',
    atenuacion: 10,
    z1: 50,
    z2: 50,
    redondeo: 'inventario',
    inventario: [22, 47, 100],
    referencia: `${SPEC} y §8.2: el Inventario de resistencias también lo usan los atenuadores`,
    // Con 22, 47 y 100 Ω entran dos en ±0,1 dB: (22, 47, 47) y (47, 47, 22), con 10,037 dB.
    esperado: { redondeo: [22, 47, 22], evaluadas: 27, dentroDeLaVentana: true },
  },
];
