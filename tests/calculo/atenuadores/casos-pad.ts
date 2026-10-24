import type {
  EntradaAtenuador,
  EntradaMinimaPerdida,
} from '../../../src/calculo/atenuadores/atenuadores';
import { MEDIA_UNIDAD, type Tolerancia } from '../../casos';

// Casos de prueba de la Calculadora de atenuadores que llegan con el pad de mínima pérdida, la
// potencia y el oráculo ABCD (spec §13.3 y §13.4). Los de referencia están transcriptos de la
// pág. 260 del libro; los de verificación son A1 a A15 de research/formulas-atenuadores.md, §7.

const FIG_7 = 'Reference Data for Radio Engineers, 4.ª ed. (ITT, 1956), cap. 9, Fig. 7, pág. 260';
const ORACULO = 'tests/oraculos/abcd.ts (ABCD con complejos)';
const INVESTIGACION = 'research/formulas-atenuadores.md, §7';

// --- Mínima pérdida: la Fig. 7 del libro ---------------------------------------------------------

// Un pad de mínima pérdida de la tabla, con los valores tal como están impresos. En el libro Z1 es la
// impedancia mayor: la rama en serie R1 queda de su lado y la de derivación R3, del lado de Z2.
export interface CasoReferenciaPad {
  clase: 'referencia';
  id: string;
  entradas: EntradaMinimaPerdida;
  esperado: { perdida: string; serie: string; derivacion: string };
  tolerancia: Tolerancia;
  referencia: string;
}

const fig7 = (
  z1: number,
  z2: number,
  perdida: string,
  serie: string,
  derivacion: string,
): CasoReferenciaPad => ({
  clase: 'referencia',
  id: `Fig. 7: ${z1} → ${z2} Ω, ${perdida} dB`,
  entradas: { z1, z2 },
  esperado: { perdida, serie, derivacion },
  tolerancia: MEDIA_UNIDAD,
  referencia: FIG_7,
});

// Las 26 filas, en el orden del libro y con las cifras impresas (el libro separa los miles con
// coma: "9,747" es 9747). La columna Z1/Z2 no se transcribe: sale de las dos impedancias.
export const CASOS_REFERENCIA_PAD: readonly CasoReferenciaPad[] = [
  fig7(10000, 500, '18,92', '9747', '513,0'),
  fig7(8000, 500, '17,92', '7746', '516,4'),
  fig7(6000, 500, '16,63', '5745', '522,2'),
  fig7(5000, 500, '15,79', '4743', '527,0'),
  fig7(4000, 500, '14,77', '3742', '534,5'),
  fig7(3000, 500, '13,42', '2739', '547,7'),
  fig7(2500, 500, '12,54', '2236', '559,0'),
  fig7(2000, 500, '11,44', '1732', '577,4'),
  fig7(1500, 500, '9,96', '1224,7', '612,4'),
  fig7(1200, 500, '8,73', '916,5', '654,7'),
  fig7(1000, 500, '7,66', '707,1', '707,1'),
  fig7(800, 500, '6,19', '489,9', '816,5'),
  fig7(600, 500, '3,77', '244,9', '1224,7'),
  fig7(500, 400, '4,18', '223,6', '894,4'),
  fig7(500, 300, '6,48', '316,2', '474,3'),
  fig7(500, 250, '7,66', '353,6', '353,6'),
  fig7(500, 200, '8,96', '387,3', '258,2'),
  fig7(500, 160, '10,17', '412,3', '194,0'),
  fig7(500, 125, '11,44', '433,0', '144,3'),
  fig7(500, 100, '12,54', '447,2', '111,80'),
  fig7(500, 80, '13,61', '458,3', '87,29'),
  fig7(500, 65, '14,58', '466,4', '69,69'),
  fig7(500, 50, '15,79', '474,3', '52,70'),
  fig7(500, 40, '16,81', '479,6', '41,70'),
  fig7(500, 30, '18,11', '484,8', '30,94'),
  fig7(500, 25, '18,92', '487,3', '25,65'),
];

// --- Verificación con el oráculo ABCD ------------------------------------------------------------

// Las tres resistencias de un T o de un π, tal como están impresas en la investigación.
export interface Ternas {
  r1: string;
  r2: string;
  r3: string;
}

export interface CasoVerificacion {
  clase: 'verificacion';
  // "A4"
  id: string;
  entradas: EntradaAtenuador;
  // Los valores de la investigación, con media unidad de su última cifra. Solo los que imprime.
  esperado: { t?: Ternas; pi?: Ternas };
  // Con las resistencias calculadas, el oráculo da Z1, Z2 y la atenuación pedidas.
  oraculo: string;
  referencia: string;
}

// Lo que se le pide al oráculo, con su motivo: no hay otra tolerancia (spec §13.2).
export const TOLERANCIA_ORACULO: {
  impedancia: Extract<Tolerancia, { tipo: 'relativa' }>;
  atenuacion: Extract<Tolerancia, { tipo: 'absoluta' }>;
} = {
  impedancia: {
    tipo: 'relativa',
    valor: 1e-9,
    motivo: 'Dos vías exactas en doble precisión: queda solo el redondeo de la aritmética.',
  },
  atenuacion: {
    tipo: 'absoluta',
    valor: 1e-9,
    motivo: 'Dos vías exactas en doble precisión: queda solo el redondeo de la aritmética.',
  },
};

const verificacion = (
  id: string,
  entradas: EntradaAtenuador,
  esperado: CasoVerificacion['esperado'],
): CasoVerificacion => ({
  clase: 'verificacion',
  id,
  entradas,
  esperado,
  oraculo: ORACULO,
  referencia: INVESTIGACION,
});

// T: R1 serie del lado de Z1, R3 en derivación y R2 serie del lado de Z2. π: R1 en derivación del
// lado de Z1, R3 en serie y R2 en derivación del lado de Z2. A10 y A11 (el pad) y A14 y A15
// (potencias) van aparte; A12 (sin solución) está entre los casos de comportamiento; A16 y A17
// (Valores comerciales) llegan con su Calculadora, y el oráculo ya los reproduce (abcd.test.ts);
// A18 no está contrastado.
export const CASOS_VERIFICACION: readonly CasoVerificacion[] = [
  verificacion(
    'A1',
    { atenuacion: 3, z1: 50, z2: 50 },
    { t: { r1: '8,5499', r2: '8,5499', r3: '141,926' } },
  ),
  verificacion(
    'A2',
    { atenuacion: 3, z1: 50, z2: 50 },
    { pi: { r1: '292,402', r2: '292,402', r3: '17,615' } },
  ),
  verificacion(
    'A3',
    { atenuacion: 6, z1: 50, z2: 50 },
    { t: { r1: '16,6139', r2: '16,6139', r3: '66,931' } },
  ),
  verificacion(
    'A4',
    { atenuacion: 10, z1: 50, z2: 50 },
    { t: { r1: '25,9747', r2: '25,9747', r3: '35,1364' } },
  ),
  verificacion(
    'A5',
    { atenuacion: 10, z1: 50, z2: 50 },
    { pi: { r1: '96,2475', r2: '96,2475', r3: '71,1512' } },
  ),
  verificacion(
    'A6',
    { atenuacion: 20, z1: 50, z2: 50 },
    {
      t: { r1: '40,9091', r2: '40,9091', r3: '10,1010' },
      pi: { r1: '61,1111', r2: '61,1111', r3: '247,500' },
    },
  ),
  verificacion(
    'A7',
    { atenuacion: 3, z1: 75, z2: 75 },
    { t: { r1: '12,8248', r2: '12,8248', r3: '212,889' } },
  ),
  verificacion(
    'A8',
    { atenuacion: 10, z1: 50, z2: 75 },
    {
      t: { r1: '18,0780', r2: '48,6335', r3: '43,0331' },
      pi: { r1: '77,1073', r2: '207,435', r3: '87,1421' },
    },
  ),
  verificacion(
    'A9',
    { atenuacion: 20, z1: 300, z2: 50 },
    {
      t: { r1: '281,318', r2: '26,2678', r3: '24,7423' },
      pi: { r1: '571,042', r2: '53,3204', r3: '606,249' },
    },
  ),
  verificacion(
    'A13',
    { atenuacion: 14, z1: 50, z2: 300 },
    {
      t: { r1: '3,2460', r2: '273,977', r3: '50,9001' },
      pi: { r1: '54,7492', r2: '4621,05', r3: '294,695' },
    },
  ),
];

// A10 y A11: el pad de mínima pérdida, con la resistencia en serie del lado de la impedancia mayor.
export interface CasoVerificacionPad {
  clase: 'verificacion';
  id: string;
  entradas: EntradaMinimaPerdida;
  esperado: { aMin: string; serie: string; derivacion: string };
  oraculo: string;
  referencia: string;
}

export const CASOS_VERIFICACION_PAD: readonly CasoVerificacionPad[] = [
  {
    clase: 'verificacion',
    id: 'A10',
    entradas: { z1: 50, z2: 75 },
    esperado: { aMin: '5,7195', serie: '43,301', derivacion: '86,603' },
    oraculo: ORACULO,
    referencia: INVESTIGACION,
  },
  {
    clase: 'verificacion',
    id: 'A11',
    entradas: { z1: 50, z2: 300 },
    esperado: { aMin: '13,4152', serie: '273,861', derivacion: '54,772' },
    oraculo: ORACULO,
    referencia: INVESTIGACION,
  },
];

// La grilla en la que T, π y pad dan Z1, Z2 y la atenuación exactas. Con Z1 ≠ Z2, las atenuaciones
// debajo de A_min se saltean: son un corte (spec §10.5).
export const GRILLA_IMPEDANCIAS: readonly number[] = [10, 50, 75, 100, 300, 600, 1000, 5000];
export const GRILLA_ATENUACIONES: readonly number[] = [0.5, 1, 3, 6, 10, 14, 20, 30, 40, 60];

// --- Potencia (spec §10.3) -----------------------------------------------------------------------

// La potencia que disipa cada resistencia con 1 W en la entrada, de la investigación (A14 y A15).
// Los valores están en W, tal como están impresos.
export interface CasoPotencia {
  clase: 'verificacion';
  id: string;
  entradas: EntradaAtenuador;
  esperado: { t?: Ternas; pi?: Ternas };
  oraculo: string;
  referencia: string;
}

export const CASOS_POTENCIA: readonly CasoPotencia[] = [
  {
    clase: 'verificacion',
    id: 'A14',
    entradas: { atenuacion: 10, z1: 50, z2: 50, potencia: 1 },
    esperado: { t: { r1: '0,5195', r3: '0,3286', r2: '0,0519' } },
    oraculo: ORACULO,
    referencia: INVESTIGACION,
  },
  {
    clase: 'verificacion',
    id: 'A15',
    entradas: { atenuacion: 10, z1: 50, z2: 75, potencia: 1 },
    esperado: {
      t: { r1: '0,3616', r3: '0,4736', r2: '0,0648' },
      pi: { r1: '0,6484', r3: '0,2154', r2: '0,0362' },
    },
    oraculo: ORACULO,
    referencia: INVESTIGACION,
  },
];
