import type { Aproximacion, EntradaFiltro, Prototipo } from '../../../src/calculo/filtros/filtros';
import { MEDIA_UNIDAD, type Tolerancia } from '../../casos';
import { TOLERANCIA_ORACULO, entradaBanda, entradaFiltro, valores } from './casos';
import { atenuacionTeorica } from './elementos';

// Casos de prueba de los filtros π y T con Rs ≠ RL (spec §7.4 y §13.3): los g de Takahasi contra
// las tablas de Zverev, Williams y Matthaei, y las escaleras de 50 a 300 Ω simuladas con el oráculo.
// Los valores salen de research/filtros-terminaciones-desiguales.md §6.

const INVESTIGACION = 'research/filtros-terminaciones-desiguales.md, §6';
const ZVEREV = 'Zverev, Handbook of Filter Synthesis (Wiley, 1967)';
const WILLIAMS =
  'Williams y Taylor, Electronic Filter Design Handbook, 4.ª ed. (McGraw-Hill, 2006), reimpresas ' +
  'de Zverev';
const MATTHAEI =
  'Matthaei, Young y Jones, Design of Microwave Filters, Impedance-Matching Networks, and ' +
  'Coupling Structures, vol. I (SRI, 1963; DTIC AD0402852)';
const ORACULO = 'tests/oraculos/abcd.ts (ABCD con complejos)';

// --- Referencia ----------------------------------------------------------------------------------

// Una fila de una tabla de terminaciones desiguales. Las fórmulas dan g1 … gn con g1 en serie y la
// fuente en la R menor; Zverev y Williams normalizan con RL = 1 y listan la escalera desde la otra
// punta, de gn a g1. Chebyshev, además, lo normalizan a −3 dB y no al borde del ripple.
export interface CasoReferenciaTakahasi {
  clase: 'referencia';
  id: string;
  aproximacion: 'butterworth' | 'chebyshev';
  orden: number;
  ripple: number | null;
  // R mayor sobre R menor.
  r: number;
  // Como están impresos, en el orden de la tabla.
  impresos: readonly string[];
  // La tabla los lista de gn a g1.
  invertida: boolean;
  // Por cuánto se multiplica cada g de las fórmulas para llevarlo a la normalización de la tabla.
  normalizacion: { factor: number; motivo: string } | null;
  // g(n+1), si la tabla lo imprime.
  carga?: string;
  tolerancia: Tolerancia;
  referencia: string;
}

// ω de −3 dB de Chebyshev respecto del borde del ripple, cosh[(1/n)·arccosh(1/ε)]: es el factor de
// la investigación (§2.4), escrito acá aparte del cálculo.
const factorMenos3dB = (n: number, ripple: number) => ({
  factor: Math.cosh(Math.acosh(1 / Math.sqrt(10 ** (ripple / 10) - 1)) / n),
  motivo:
    'Zverev y Williams normalizan Chebyshev a −3 dB: cada g de las fórmulas va por ' +
    'cosh[(1/n)·arccosh(1/ε)].',
});

// r_min = (ε + √(1 + ε²))², escrito acá aparte del cálculo, para el caso que arranca justo en él.
const relacionMinimaAparte = (ripple: number) => {
  const e = Math.sqrt(10 ** (ripple / 10) - 1);
  return (e + Math.sqrt(1 + e * e)) ** 2;
};

// Los g de las fórmulas en el orden y la normalización de la tabla del caso.
export function comoEnLaTabla(caso: CasoReferenciaTakahasi, p: Prototipo): number[] {
  const factor = caso.normalizacion?.factor ?? 1;
  const g = p.g.map((x) => x * factor);
  return caso.invertida ? g.reverse() : g;
}

const referencia = (
  id: string,
  datos: Omit<CasoReferenciaTakahasi, 'clase' | 'id' | 'tolerancia'> & { tolerancia?: Tolerancia },
): CasoReferenciaTakahasi => ({ clase: 'referencia', id, tolerancia: MEDIA_UNIDAD, ...datos });

export const CASOS_REFERENCIA_TAKAHASI: readonly CasoReferenciaTakahasi[] = [
  referencia('R1: Butterworth n = 3, r = 2', {
    aproximacion: 'butterworth',
    orden: 3,
    ripple: null,
    r: 2,
    impresos: ['1,1811', '0,7789', '3,2612'],
    invertida: true,
    normalizacion: null,
    referencia: `${ZVEREV}, pág. 312, Rs = 0,5, fila π; ${WILLIAMS}, tabla 11-2`,
  }),
  referencia('R2: Butterworth n = 3, r = 5', {
    aproximacion: 'butterworth',
    orden: 3,
    ripple: null,
    r: 5,
    impresos: ['2,6687', '0,2842', '7,9102'],
    invertida: true,
    normalizacion: null,
    referencia: `${WILLIAMS}, tabla 11-2, Rs = 0,2, y ejemplo 3-4 (1 kΩ a 5 kΩ)`,
  }),
  referencia('R3: Butterworth n = 3, r = 1/0,9', {
    aproximacion: 'butterworth',
    orden: 3,
    ripple: null,
    r: 1 / 0.9,
    impresos: ['0,8082', '1,6332', '1,5994'],
    invertida: true,
    normalizacion: null,
    referencia: `${WILLIAMS}, tabla 11-2, Rs = 0,9`,
  }),
  referencia('R4: Butterworth n = 4, r = 2', {
    aproximacion: 'butterworth',
    orden: 4,
    ripple: null,
    r: 2,
    impresos: ['0,2175', '2,4524', '0,8826', '3,1868'],
    invertida: true,
    normalizacion: null,
    referencia: `${WILLIAMS}, tabla 11-2, Rs = 2,0`,
  }),
  referencia('R5: Chebyshev 0,1 dB n = 3, r = 2', {
    aproximacion: 'chebyshev',
    orden: 3,
    ripple: 0.1,
    r: 2,
    impresos: ['1,8530', '0,8383', '3,1594'],
    invertida: true,
    normalizacion: factorMenos3dB(3, 0.1),
    // La fórmula da 3,159450 para el último: la tabla queda 5,008·10⁻⁵ abajo, apenas más que media
    // unidad.
    tolerancia: {
      tipo: 'absoluta',
      valor: 1e-4,
      motivo:
        'La tabla imprime 3,1594 donde la fórmula da 3,159450: se aparta apenas más que media ' +
        'unidad. Una unidad de la cuarta cifra.',
    },
    referencia: `${WILLIAMS}, tabla 11-28, Rs = 0,5`,
  }),
  referencia('R6: Chebyshev 0,1 dB n = 4, r = 2', {
    aproximacion: 'chebyshev',
    orden: 4,
    ripple: 0.1,
    r: 2,
    impresos: ['0,4398', '3,2269', '0,9672', '2,8563'],
    invertida: true,
    normalizacion: factorMenos3dB(4, 0.1),
    referencia: `${WILLIAMS}, tabla 11-28, Rs = 2,0`,
  }),
  referencia('R7: Chebyshev 0,1 dB n = 4, r = 10', {
    aproximacion: 'chebyshev',
    orden: 4,
    ripple: 0.1,
    r: 10,
    impresos: ['0,0704', '14,8873', '0,1802', '15,2297'],
    invertida: true,
    normalizacion: factorMenos3dB(4, 0.1),
    referencia: `${WILLIAMS}, tabla 11-28, Rs = 10`,
  }),
  referencia('R8: Chebyshev 0,5 dB n = 4, r = r_min (las de terminaciones iguales)', {
    aproximacion: 'chebyshev',
    orden: 4,
    ripple: 0.5,
    r: relacionMinimaAparte(0.5),
    impresos: ['1,6703', '1,1926', '2,3661', '0,8419'],
    invertida: false,
    normalizacion: null,
    carga: '1,9841',
    referencia: `${MATTHAEI}, tabla 4.05-2(a), pág. 100; ${ZVEREV}, pág. 294 (1,9841)`,
  }),
];

// R9: el r_min de Chebyshev par, coth²(β/4), según el ripple. No depende del Orden.
export interface CasoRelacionMinima {
  clase: 'referencia';
  id: string;
  ripple: number;
  impreso: string;
  tolerancia: Tolerancia;
  referencia: string;
}

const casoRelacionMinima = (ripple: number, impreso: string, cita: string): CasoRelacionMinima => ({
  clase: 'referencia',
  id: `R9: r_min de Chebyshev par con ${String(ripple).replace('.', ',')} dB`,
  ripple,
  impreso,
  tolerancia: MEDIA_UNIDAD,
  referencia: cita,
});

export const CASOS_RELACION_MINIMA: readonly CasoRelacionMinima[] = [
  casoRelacionMinima(0.01, '1,1007', `${MATTHAEI}, tabla 4.05-2(a), g5 de n = 4, pág. 100`),
  casoRelacionMinima(
    0.1,
    '1,3554',
    `${WILLIAMS}, tabla 11-28, primera fila de Orden par; ${MATTHAEI}, tabla 4.05-2(a)`,
  ),
  casoRelacionMinima(0.5, '1,9841', `${ZVEREV}, pág. 294; ${MATTHAEI}, tabla 4.05-2(a)`),
  casoRelacionMinima(
    1,
    '2,6597',
    `${ZVEREV}, primera fila de Orden par de 1 dB; ${INVESTIGACION} (R9)`,
  ),
];

// --- Verificación --------------------------------------------------------------------------------

// Lo que se espera de la red armada, escrito acá aparte del cálculo (investigación §2.1): en el
// centro de la banda pasante la red conecta la fuente directo a la carga, y la transmisión máxima es
// K = 4r/(1+r)², por 1 + ε² en Chebyshev par.
export const perdidaPlanaTeorica = (rs: number, rl: number) =>
  -10 * Math.log10((4 * rs * rl) / (rs + rl) ** 2);

export const perdidaSobreK = (
  aproximacion: Aproximacion,
  n: number,
  ripple: number | null,
  rs: number,
  rl: number,
) => {
  const par = aproximacion === 'chebyshev' && n % 2 === 0;
  return perdidaPlanaTeorica(rs, rl) - (par ? ripple! : 0);
};

// En el borde de la banda (Ω = 1): la de la Aproximación sobre la transmisión máxima K.
export const atenuacionEnBorde = (e: EntradaFiltro, n: number) =>
  perdidaSobreK(e.aproximacion, n, e.ripple, e.rs, e.rl) +
  atenuacionTeorica(e.aproximacion, n, 1, e.ripple);

// Una frecuencia donde el prototipo está en Ω ≈ 0: continua en pasa bajos y rechaza banda, muy
// arriba en pasa altos y f0 en pasa banda. A 10⁻⁶ de Ω = 0 la atenuación de la Aproximación queda
// por debajo de 10⁻¹⁰ dB.
export function centroDe(e: EntradaFiltro): number {
  if ('fc' in e) return e.tipo === 'pasa-bajos' ? e.fc * 1e-6 : e.fc * 1e6;
  const f0 = 'f1' in e.banda ? Math.sqrt(e.banda.f1 * e.banda.f2) : e.banda.f0;
  return e.tipo === 'pasa-banda' ? f0 : f0 * 1e-6;
}

export const TOLERANCIA_ORACULO_TAKAHASI: Extract<Tolerancia, { tipo: 'relativa' }> = {
  ...TOLERANCIA_ORACULO,
  motivo:
    'La red simulada entre Rs y RL contra la desadaptación directa, o contra la respuesta de la ' +
    'Aproximación sobre K: dos vías exactas, queda el redondeo de la aritmética.',
};

export const TOLERANCIA_VALORES_TAKAHASI: Tolerancia = {
  tipo: 'media-unidad',
  motivo:
    'La investigación imprime los valores con 2 decimales, en nH o pF: media unidad de la última ' +
    'cifra.',
};

// Una escalera con Rs ≠ RL: los valores de la investigación (en nH o pF, desde la fuente), los de
// la escalera alternativa si hay, y la respuesta simulada con el oráculo entre Rs y RL. En el centro
// de la banda pasante la pérdida tiene que ser la desadaptación directa 4r/(1+r)², y en los bordes
// la de la Aproximación sobre la transmisión máxima K.
export interface CasoVerificacionTakahasi {
  clase: 'verificacion';
  id: string;
  entradas: EntradaFiltro;
  valores: readonly { nombre: string; impreso: string; unidad: 'nH' | 'pF' }[];
  alternativa: readonly { nombre: string; impreso: string; unidad: 'nH' | 'pF' }[];
  oraculo: string;
  referencia: string;
}

const verificacion = (
  id: string,
  entradas: EntradaFiltro,
  lista: string,
  alternativa = '',
  cita = `${INVESTIGACION}.2`,
): CasoVerificacionTakahasi => ({
  clase: 'verificacion',
  id,
  entradas,
  valores: valores(lista),
  alternativa: valores(alternativa),
  oraculo: ORACULO,
  referencia: cita,
});

const DE_50_A_300 = { rs: 50, rl: 300 };
const DE_300_A_50 = { rs: 300, rl: 50 };
const CHEBYSHEV_01 = { ...DE_50_A_300, ripple: 0.1 };
const SIN_VALORES = 'spec §7.4: solo la respuesta, con el oráculo';

export const CASOS_VERIFICACION_TAKAHASI: readonly CasoVerificacionTakahasi[] = [
  verificacion(
    'T1 T: Butterworth pasa bajos n = 3, de 50 a 300 Ω, 100 MHz',
    entradaFiltro('pasa-bajos', 'butterworth', 'T', 3, 100e6, DE_50_A_300),
    'L1 750,05 nH · C2 7,46 pF · L3 252,11 nH',
  ),
  verificacion(
    'T1 π: Butterworth pasa bajos n = 3, de 50 a 300 Ω, 100 MHz',
    entradaFiltro('pasa-bajos', 'butterworth', 'π', 3, 100e6, DE_50_A_300),
    'C1 16,81 pF · L2 111,93 nH · C3 50,00 pF',
  ),
  // Con Orden par desde 50 Ω solo hay T, en dos versiones con la misma respuesta: la de C4 = 2,12 pF
  // es Valor dudoso a 100 MHz, así que la principal es la otra.
  verificacion(
    'T2 T: Butterworth pasa bajos n = 4, de 50 a 300 Ω, 100 MHz, con su alternativa',
    entradaFiltro('pasa-bajos', 'butterworth', 'T', 4, 100e6, DE_50_A_300),
    'L1 31,73 nH · C2 35,89 pF · L3 130,59 nH · C4 50,33 pF',
    'L1 754,93 nH · C2 8,71 pF · L3 538,36 nH · C4 2,12 pF',
  ),
  verificacion(
    'T2 π: Butterworth pasa bajos n = 4, de 300 a 50 Ω, 100 MHz, con su alternativa',
    entradaFiltro('pasa-bajos', 'butterworth', 'π', 4, 100e6, DE_300_A_50),
    'C1 50,33 pF · L2 130,59 nH · C3 35,89 pF · L4 31,73 nH',
    'C1 2,12 pF · L2 538,36 nH · C3 8,71 pF · L4 754,93 nH',
  ),
  verificacion(
    'T3 T: Butterworth pasa bajos n = 5, de 50 a 300 Ω, 100 MHz',
    entradaFiltro('pasa-bajos', 'butterworth', 'T', 5, 100e6, DE_50_A_300),
    'L1 755,71 nH · C2 9,28 pF · L3 681,71 nH · C4 4,90 pF · L5 152,51 nH',
  ),
  verificacion(
    'T3 π: Butterworth pasa bajos n = 5, de 50 a 300 Ω, 100 MHz',
    entradaFiltro('pasa-bajos', 'butterworth', 'π', 5, 100e6, DE_50_A_300),
    'C1 10,17 pF · L2 73,56 nH · C3 45,45 pF · L4 139,14 nH · C5 50,38 pF',
  ),
  verificacion(
    'T4 T: Chebyshev 0,1 dB pasa bajos n = 3, de 50 a 300 Ω, 100 MHz',
    entradaFiltro('pasa-bajos', 'chebyshev', 'T', 3, 100e6, CHEBYSHEV_01),
    'L1 537,39 nH · C2 6,01 pF · L3 266,63 nH',
  ),
  verificacion(
    'T4 π: Chebyshev 0,1 dB pasa bajos n = 3, de 50 a 300 Ω, 100 MHz',
    entradaFiltro('pasa-bajos', 'chebyshev', 'π', 3, 100e6, CHEBYSHEV_01),
    'C1 17,78 pF · L2 90,18 nH · C3 35,83 pF',
  ),
  // r = 6 ≥ r_min = 1,3554: el Orden par se arma, con un pico de −3,00 dB y −3,10 dB en continua.
  verificacion(
    'T5 T: Chebyshev 0,1 dB pasa bajos n = 4, de 50 a 300 Ω, 100 MHz, con su alternativa',
    entradaFiltro('pasa-bajos', 'chebyshev', 'T', 4, 100e6, CHEBYSHEV_01),
    'L1 47,62 nH · C2 39,64 pF · L3 119,68 nH · C4 40,00 pF',
    'L1 599,96 nH · C2 7,98 pF · L3 594,57 nH · C4 3,17 pF',
  ),
  verificacion(
    'T6 T: Chebyshev 0,1 dB pasa bajos n = 5, de 50 a 300 Ω, 100 MHz',
    entradaFiltro('pasa-bajos', 'chebyshev', 'T', 5, 100e6, CHEBYSHEV_01),
    'L1 663,90 nH · C2 8,54 pF · L3 763,92 nH · C4 6,85 pF · L5 293,99 nH',
  ),
  verificacion(
    'T6 π: Chebyshev 0,1 dB pasa bajos n = 5, de 50 a 300 Ω, 100 MHz',
    entradaFiltro('pasa-bajos', 'chebyshev', 'π', 5, 100e6, CHEBYSHEV_01),
    'C1 19,60 pF · L2 102,79 nH · C3 50,93 pF · L4 128,13 nH · C5 44,26 pF',
  ),
  verificacion(
    'T7 T: Chebyshev 0,5 dB pasa bajos n = 3, de 50 a 300 Ω, 100 MHz',
    entradaFiltro('pasa-bajos', 'chebyshev', 'T', 3, 100e6, { ...DE_50_A_300, ripple: 0.5 }),
    'L1 668,50 nH · C2 7,00 pF · L3 421,09 nH',
  ),
  verificacion(
    'T7 π: Chebyshev 0,5 dB pasa bajos n = 3, de 50 a 300 Ω, 100 MHz',
    entradaFiltro('pasa-bajos', 'chebyshev', 'π', 3, 100e6, { ...DE_50_A_300, ripple: 0.5 }),
    'C1 28,07 pF · L2 105,05 nH · C3 44,57 pF',
  ),
  // Los otros Tipos de filtro: la pérdida plana es la misma y aparece a frecuencia infinita, en f0 o
  // en continua (investigación §1, punto 3).
  verificacion(
    'T8 T: Butterworth pasa altos n = 3, de 300 a 50 Ω, 50 MHz',
    entradaFiltro('pasa-altos', 'butterworth', 'T', 3, 50e6, DE_300_A_50),
    '',
    '',
    SIN_VALORES,
  ),
  verificacion(
    'T9 T: Chebyshev 0,5 dB pasa altos n = 4, de 75 a 300 Ω, 50 MHz, con su alternativa',
    // r = 4 ≥ r_min = 1,9841.
    entradaFiltro('pasa-altos', 'chebyshev', 'T', 4, 50e6, { rs: 75, rl: 300, ripple: 0.5 }),
    '',
    '',
    SIN_VALORES,
  ),
  verificacion(
    'T10 π: Butterworth pasa banda n = 3, 88 a 108 MHz, de 50 a 75 Ω',
    entradaBanda('pasa-banda', 'butterworth', 'π', 3, { f1: 88e6, f2: 108e6 }, { rs: 50, rl: 75 }),
    '',
    '',
    SIN_VALORES,
  ),
  verificacion(
    'T11 π: Chebyshev 0,1 dB pasa banda n = 4, 88 a 108 MHz, de 300 a 50 Ω',
    entradaBanda(
      'pasa-banda',
      'chebyshev',
      'π',
      4,
      { f1: 88e6, f2: 108e6 },
      { ...DE_300_A_50, ripple: 0.1 },
    ),
    '',
    '',
    SIN_VALORES,
  ),
  verificacion(
    'T12 T: Butterworth rechaza banda n = 4, 88 a 108 MHz, de 50 a 300 Ω',
    entradaBanda('rechaza-banda', 'butterworth', 'T', 4, { f1: 88e6, f2: 108e6 }, DE_50_A_300),
    '',
    '',
    SIN_VALORES,
  ),
];
