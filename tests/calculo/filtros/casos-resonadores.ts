import type {
  CodigoAvisoResonadores,
  CodigoCorteResonadores,
  EntradaResonadores,
  OpcionesResonadores,
  ResultadoResonadores,
} from '../../../src/calculo/filtros/resonadores';
import type { Nivel } from '../../../src/calculo/comun/valor-impracticable';
import { MEDIA_UNIDAD, type Tolerancia } from '../../casos';
import type { LadoDeBandera } from '../../casos-informe';

// Casos de prueba de la Topología de resonadores acoplados (spec §13.3): CR1 a CR14 de
// research/resonadores-acoplados.md §5, todos en 144–148 MHz con L = 22 nH salvo que se diga otra
// cosa, simulados con el oráculo ABCD. Los valores de la investigación salieron de su propio script
// en Python, con el mismo diseño; el oráculo es la segunda vía.

const INVESTIGACION = 'research/resonadores-acoplados.md, §5';
const ORACULO =
  'tests/oraculos/abcd.ts (ABCD con complejos), con la red armada en tests/calculo/filtros/elementos.ts';
const BANDA = { f1: 144e6, f2: 148e6 };

export const entradaResonadores = (e: Partial<EntradaResonadores> = {}): EntradaResonadores => ({
  aproximacion: 'butterworth',
  ripple: null,
  orden: 3,
  banda: BANDA,
  rs: 50,
  rl: 50,
  qBobina: 100,
  inductancia: 22e-9,
  ...e,
});

type Calculado = Extract<ResultadoResonadores, { estado: 'calculado' }>;

// Un valor del resultado por el nombre con que lo imprime la investigación: "Rp1", "Rpn", un
// capacitor ("C01", "C12", "C2") o un lado de un divisor ("Ca entrada", "Cb salida").
export function valorDe(r: Calculado, nombre: string): number {
  if (nombre === 'Rp1') return r.extremos[0].rp;
  if (nombre === 'Rpn') return r.extremos[1].rp;
  const divisor = /^(Ca|Cb) (entrada|salida)$/.exec(nombre);
  if (divisor) {
    const d = r.extremos[divisor[2] === 'entrada' ? 0 : 1].divisor!;
    return divisor[1] === 'Ca' ? d.ca : d.cb;
  }
  const capacitores = [
    ...r.extremos.map((x) => x.capacitor),
    ...r.acoples.map((a) => a.capacitor),
    ...r.sintonias.map((s) => s.capacitor),
  ];
  const c = capacitores.find((x) => x.nombre === nombre);
  if (!c) throw new Error(`no hay ${nombre}`);
  return c.valor;
}

export const ESCALA_RESONADORES = { Ω: 1, pF: 1e12, MHz: 1e-6 } as const;

// "Rp1 736,5 Ω · C01 5,886 pF", como lo imprime la investigación.
const valores = (lista: string) =>
  lista.split(' · ').map((v) => {
    const [nombre, impreso, unidad] = v.split(/ (?=[^ ]+ [^ ]+$)| (?=[^ ]+$)/) as [
      string,
      string,
      keyof typeof ESCALA_RESONADORES,
    ];
    return { nombre, impreso, unidad };
  });

// Los valores de la investigación salieron de su script con el mismo diseño (spec §13.2: media
// unidad de la última cifra impresa, como una tabla).
const TOLERANCIA_VALORES: Tolerancia = {
  ...MEDIA_UNIDAD,
  motivo:
    'La investigación imprime 4 o 5 cifras, salidas de su script con el mismo diseño: media ' +
    'unidad de la última cifra impresa.',
};

// En Chebyshev el script calculó β con el 17,37 que imprime Matthaei y no con 40/ln 10 = 17,3718:
// su β queda 1·10⁻⁴ más chico y sus g, otro tanto más grandes (Rp1 de CR2: 759,8 contra 759,733).
const TOLERANCIA_VALORES_CHEBYSHEV: Extract<Tolerancia, { tipo: 'relativa' }> = {
  tipo: 'relativa',
  valor: 5e-4,
  motivo:
    'La investigación calculó β con el 17,37 que imprime Matthaei y no con 40/ln 10 = 17,3718: ' +
    'sus g de Chebyshev quedan hasta 1·10⁻⁴ por encima, y eso se suma al redondeo de las 4 ' +
    'cifras impresas (hasta 5·10⁻⁴ relativo). ±5·10⁻⁴ relativo.',
};

export const toleranciaDeValores = (aproximacion: EntradaResonadores['aproximacion']) =>
  aproximacion === 'chebyshev' ? TOLERANCIA_VALORES_CHEBYSHEV : TOLERANCIA_VALORES;

// Los dos son el cruce más externo del umbral en la red ideal, pero las simulaciones difieren en
// decenas de Hz: en CR13 este da 143,99448 MHz y la investigación imprime 143,995.
export const TOLERANCIA_BORDES: Extract<Tolerancia, { tipo: 'absoluta' }> = {
  tipo: 'absoluta',
  valor: 0.001,
  motivo:
    'La investigación imprime los bordes simulados en MHz con 3 decimales, y su búsqueda del cruce ' +
    'difiere de esta en decenas de Hz (CR13: 143,99448 contra 143,995): ±1 kHz, una unidad de la ' +
    'última cifra.',
};

export const TOLERANCIA_FUERA_DE_BANDA: Extract<Tolerancia, { tipo: 'absoluta' }> = {
  tipo: 'absoluta',
  valor: 0.01,
  motivo: 'Atenuación simulada contra la de la investigación, impresa con 2 decimales: ±0,01 dB.',
};

// En la Frecuencia de sintonía los Capacitores de acople y la red L de los extremos son exactos.
export const TOLERANCIA_EXACTA_DB: Extract<Tolerancia, { tipo: 'absoluta' }> = {
  tipo: 'absoluta',
  valor: 1e-9,
  motivo:
    'En la Frecuencia de sintonía el diseño es exacto (Capacitores de acople y red L de los ' +
    'extremos): queda ' +
    'el redondeo de la aritmética.',
};

export const TOLERANCIA_ADAPTA: Extract<Tolerancia, { tipo: 'relativa' }> = {
  tipo: 'relativa',
  valor: 1e-9,
  motivo: 'El filtro adapta en la Frecuencia de sintonía: Zin = Rs exacto, salvo el redondeo.',
};

export interface CasoVerificacionResonadores {
  clase: 'verificacion';
  id: string;
  entradas: EntradaResonadores;
  opciones?: OpcionesResonadores;
  bandera?: LadoDeBandera;
  // El Orden con que tiene que calcular, si el caso lo fija (el plan B del Chebyshev par lo sube).
  orden?: number;
  valores: readonly { nombre: string; impreso: string; unidad: keyof typeof ESCALA_RESONADORES }[];
  // Los bordes simulados, f1 y f2, en MHz con 3 decimales; el umbral es −3,01 dB o el ripple.
  bordes: readonly [string, string] | null;
  // La atenuación simulada a Ω = ±2 y ±3, con Ω del mapeo de pasa banda con el f0 de Cohn.
  fueraDeBanda: readonly { omega: number; impreso: string }[];
  // La pérdida en la Frecuencia de sintonía: 0 dB, o el ripple en Chebyshev par.
  enSintonia: number;
  // Con el divisor capacitivo en los dos extremos en lugar del Capacitor de extremo.
  conDivisor?: boolean;
  oraculo: string;
  referencia: string;
}

const DEDUCCION_PAR = 'chebyshev-par-resonadores';
export const DEDUCCION_DIVISOR = 'divisor-capacitivo';

const casoCR = (
  id: string,
  entradas: Partial<EntradaResonadores>,
  lista: string,
  bordes: readonly [string, string] | null,
  extra: Partial<CasoVerificacionResonadores> = {},
): CasoVerificacionResonadores => ({
  clase: 'verificacion',
  id,
  entradas: entradaResonadores(entradas),
  valores: valores(lista),
  bordes,
  fueraDeBanda: [],
  enSintonia: 0,
  oraculo: ORACULO,
  referencia: INVESTIGACION,
  ...extra,
});

const propia = (deduccion: string): LadoDeBandera => ({ deduccion, lado: 'propia' });
const planB = (deduccion: string): LadoDeBandera => ({ deduccion, lado: 'plan-b' });

const CHEBYSHEV_01 = { aproximacion: 'chebyshev', ripple: 0.1 } as const;
const CHEBYSHEV_05 = { aproximacion: 'chebyshev', ripple: 0.5 } as const;

export const CASOS_VERIFICACION_RESONADORES: readonly CasoVerificacionResonadores[] = [
  casoCR(
    'CR1: Butterworth n = 3, 50 → 50 Ω',
    {},
    'Rp1 736,5 Ω · Rpn 736,5 Ω · C01 5,886 pF · C34 5,886 pF · C12 1,047 pF · C23 1,047 pF · ' +
      'C1 47,51 pF · C2 51,95 pF · C3 47,51 pF',
    ['143,988', '147,997'],
    {
      fueraDeBanda: [
        { omega: -2, impreso: '18,84' },
        { omega: 2, impreso: '17,23' },
        { omega: -3, impreso: '29,84' },
        { omega: 3, impreso: '27,21' },
      ],
    },
  ),
  casoCR(
    'CR2: Chebyshev 0,1 dB n = 3, 50 → 50 Ω',
    CHEBYSHEV_01,
    'Rp1 759,8 Ω · Rpn 759,8 Ω · C01 5,788 pF · C34 5,788 pF · C12 1,361 pF · C23 1,361 pF · ' +
      'C1 47,28 pF · C2 51,32 pF · C3 47,28 pF',
    ['143,982', '147,984'],
  ),
  casoCR(
    'CR3: Chebyshev 0,5 dB n = 3, 50 → 50 Ω',
    CHEBYSHEV_05,
    'Rp1 1175,7 Ω · Rpn 1175,7 Ω · C01 4,596 pF · C34 4,596 pF · C12 1,119 pF · C23 1,119 pF · ' +
      'C1 48,53 pF · C2 51,81 pF · C3 48,53 pF',
    ['143,992', '147,997'],
  ),
  casoCR(
    'CR4: Bessel n = 3 (−3 dB), 50 → 50 Ω',
    { aproximacion: 'bessel' },
    'Rp1 1622,8 Ω · Rpn 248,5 Ω · C01 3,888 pF · C34 10,94 pF · C12 1,012 pF · C23 2,587 pF · ' +
      'C1 49,26 pF · C2 50,45 pF · C3 42,72 pF',
    ['144,014', '148,003'],
    {
      fueraDeBanda: [
        { omega: -2, impreso: '12,53' },
        { omega: 2, impreso: '11,42' },
      ],
    },
  ),
  casoCR(
    'CR5: Chebyshev 0,1 dB n = 4, 50 → 50 Ω',
    { ...CHEBYSHEV_01, orden: 4 },
    'Rp1 816,6 Ω · Rpn 816,6 Ω · C01 5,569 pF · C45 5,569 pF · C12 1,230 pF · C23 0,9736 pF · ' +
      'C34 1,230 pF · C1 47,59 pF · C2 51,84 pF · C3 51,84 pF · C4 47,59 pF',
    ['143,992', '147,988'],
    { enSintonia: 0.1, bandera: propia(DEDUCCION_PAR), orden: 4 },
  ),
  casoCR(
    'CR6: Chebyshev 0,5 dB n = 2, 50 → 50 Ω',
    { ...CHEBYSHEV_05, orden: 2 },
    'Rp1 1033,3 Ω · Rpn 1033,3 Ω · C01 4,918 pF · C23 4,918 pF · C12 1,487 pF · C1 47,88 pF · ' +
      'C2 47,88 pF',
    ['143,986', '148,002'],
    { enSintonia: 0.5, bandera: propia(DEDUCCION_PAR), orden: 2 },
  ),
  casoCR(
    'CR7: Butterworth n = 3, 50 → 300 Ω',
    { rl: 300 },
    'Rp1 736,5 Ω · Rpn 736,5 Ω · C01 5,886 pF · C34 3,013 pF · C12 1,047 pF · C23 1,047 pF · ' +
      'C1 47,51 pF · C2 51,95 pF · C3 51,21 pF',
    ['143,989', '148,002'],
    {
      fueraDeBanda: [
        { omega: -2, impreso: '18,75' },
        { omega: 2, impreso: '17,22' },
      ],
    },
  ),
  casoCR(
    'CR8: Chebyshev 0,1 dB n = 3, 50 → 300 Ω',
    { ...CHEBYSHEV_01, rl: 300 },
    'Rp1 759,8 Ω · Rpn 759,8 Ω · C01 5,788 pF · C34 2,936 pF · C12 1,361 pF · C23 1,361 pF · ' +
      'C1 47,28 pF · C2 51,32 pF · C3 50,91 pF',
    ['143,987', '147,992'],
  ),
  casoCR(
    'CR10: Butterworth n = 3, 50 → 300 Ω, con divisor capacitivo',
    { rl: 300 },
    'Ca entrada 71,59 pF · Cb entrada 202,3 pF · Ca salida 146,5 pF · Cb salida 82,99 pF · ' +
      'C12 1,047 pF · C23 1,047 pF · C2 51,95 pF',
    ['144,008', '148,011'],
    { conDivisor: true, bandera: propia(DEDUCCION_DIVISOR) },
  ),
  casoCR(
    'CR11: Chebyshev 0,5 dB n = 4, 50 → 300 Ω',
    { ...CHEBYSHEV_05, orden: 4, rl: 300 },
    'Rp1 1230,2 Ω · Rpn 1230,2 Ω · C01 4,489 pF · C45 2,064 pF · C12 1,049 pF · C23 0,8814 pF · ' +
      'C34 1,049 pF · C1 48,69 pF · C2 52,11 pF · C3 52,11 pF · C4 51,44 pF',
    ['143,995', '147,998'],
    { enSintonia: 0.5, bandera: propia(DEDUCCION_PAR), orden: 4 },
  ),
  casoCR(
    'CR12: Butterworth n = 5, 50 → 50 Ω',
    { orden: 5 },
    'Rp1 455,2 Ω · Rpn 455,2 Ω · C01 7,661 pF · C56 7,661 pF · C12 1,481 pF · C23 0,8230 pF · ' +
      'C34 0,8230 pF · C45 1,481 pF · C1 45,75 pF · C2 51,74 pF · C3 52,40 pF · C4 51,74 pF · ' +
      'C5 45,75 pF',
    ['143,999', '147,992'],
  ),
  casoCR(
    'CR13: Butterworth n = 3, 50 → 300 Ω, L = 10 nH',
    { rl: 300, inductancia: 10e-9 },
    'Rp1 334,8 Ω · Rpn 334,8 Ω · C01 9,138 pF · C34 10,68 pF · C12 2,303 pF · C23 2,303 pF · ' +
      'C1 108,8 pF · C2 114,3 pF · C3 115,5 pF',
    ['143,995', '148,007'],
  ),
  casoCR(
    'CR14: Bessel n = 3, 50 → 300 Ω, invertido (g grande del lado de 300 Ω)',
    { aproximacion: 'bessel', rl: 300 },
    'Rp1 248,5 Ω · Rpn 1622,8 Ω · C01 10,94 pF · C34 1,731 pF · C12 2,587 pF · C23 1,012 pF · ' +
      'C1 42,72 pF · C2 50,45 pF · C3 51,62 pF',
    null,
    {
      fueraDeBanda: [
        { omega: -2, impreso: '12,47' },
        { omega: 2, impreso: '11,42' },
      ],
    },
  ),
  // El plan B del Chebyshev par: el Orden sube al impar. No hay valores publicados de esos
  // filtros; se verifica que el impar adapte en la Frecuencia de sintonía.
  ...(
    [
      ['CR5', { ...CHEBYSHEV_01, orden: 4 }],
      ['CR6', { ...CHEBYSHEV_05, orden: 2 }],
      ['CR11', { ...CHEBYSHEV_05, orden: 4, rl: 300 }],
    ] as const
  ).map(([id, entradas]) =>
    casoCR(`${id}, plan B: Chebyshev par sube al impar`, entradas, '', null, {
      valores: [],
      opciones: { planBChebyshevPar: true },
      bandera: planB(DEDUCCION_PAR),
      orden: entradas.orden + 1,
      referencia: `${INVESTIGACION}; spec §13.5, plan B del Chebyshev par`,
    }),
  ),
];

// La pérdida de Cohn contra la red simulada con una R de Qu·ω0·L en paralelo con cada bobina
// (spec §7.8 y §5.7). Cohn suma la pérdida de cada resonador como si no interactuaran: queda unos
// puntos por encima, más en Chebyshev y Bessel.
export interface CasoCohnResonadores {
  clase: 'verificacion';
  id: string;
  entradas: EntradaResonadores;
  diferencia: { relativa: number; motivo: string };
  oraculo: string;
  referencia: string;
}

const MOTIVO_COHN =
  'Cohn es de primer orden en 1/Qk: suma la pérdida de cada resonador como si no interactuaran y ' +
  'queda por encima de la simulada (research/resonadores-acoplados.md §6.1: de 2 a 7 %). La ' +
  'diferencia se midió con esta misma simulación.';

const cohn = (id: string, entradas: Partial<EntradaResonadores>, relativa: number) => ({
  clase: 'verificacion' as const,
  id,
  entradas: entradaResonadores(entradas),
  diferencia: { relativa, motivo: MOTIVO_COHN },
  oraculo: `${ORACULO}, con la pérdida de cada bobina`,
  referencia:
    'Matthaei, Young y Jones (1964), ec. 4.13-2 y 4.13-11; research/resonadores-acoplados.md, §6.1',
});

export const CASOS_COHN_RESONADORES: readonly CasoCohnResonadores[] = [
  cohn('Cohn CR1: Butterworth n = 3, Qu = 100', {}, 0.02036),
  cohn('Cohn CR3: Chebyshev 0,5 dB n = 3, Qu = 100', CHEBYSHEV_05, 0.06608),
  cohn('Cohn CR7: Butterworth n = 3, 50 → 300 Ω, Qu = 100', { rl: 300 }, 0.02036),
  cohn('Cohn CR12: Butterworth n = 5, Qu = 100', { orden: 5 }, 0.01624),
  cohn('Cohn CR4: Bessel n = 3, Qu = 100', { aproximacion: 'bessel' }, 0.06754),
];

// El Orden calculado desde una atenuación (spec §7.7): el del prototipo y el que hace falta en la red
// simulada, con la L propuesta. La asimetría del flanco alto le quita unos dB a la red frente al
// prototipo (research/resonadores-acoplados.md §4): a 160 MHz, con Butterworth de Orden 3, 46,45 dB
// contra 49,56 dB.
export interface CasoOrdenResonadores {
  clase: 'verificacion';
  id: string;
  entradas: EntradaResonadores;
  ordenPrototipo: number;
  ordenEsperado: number;
  oraculo: string;
  referencia: string;
}

const ordenCalculado = (
  id: string,
  entradas: Partial<EntradaResonadores>,
  ordenPrototipo: number,
  ordenEsperado: number,
): CasoOrdenResonadores => ({
  clase: 'verificacion',
  id,
  entradas: entradaResonadores({ inductancia: null, ...entradas }),
  ordenPrototipo,
  ordenEsperado,
  oraculo: ORACULO,
  referencia: 'spec §7.6 y §7.7; Matthaei, Young y Jones (1964), ec. 8.04-1',
});

export const CASOS_ORDEN_RESONADORES: readonly CasoOrdenResonadores[] = [
  ordenCalculado(
    'Orden calculado en resonadores: Butterworth 30 dB a 140 MHz, alcanza el del prototipo (4)',
    { orden: { as: 30, fs: 140e6 } },
    4,
    4,
  ),
  ordenCalculado(
    'Orden calculado en resonadores: Butterworth 48 dB a 160 MHz, el prototipo pide 3 y hacen falta 4',
    { orden: { as: 48, fs: 160e6 } },
    3,
    4,
  ),
  ordenCalculado(
    'Orden calculado en resonadores: Butterworth 48 dB a 160 MHz, de 50 a 300 Ω',
    { orden: { as: 48, fs: 160e6 }, rl: 300 },
    3,
    4,
  ),
  ordenCalculado(
    'Orden calculado en resonadores: Chebyshev 0,5 dB 70 dB a 160 MHz sale par (4)',
    { ...CHEBYSHEV_05, orden: { as: 70, fs: 160e6 } },
    4,
    4,
  ),
  ordenCalculado(
    'Orden calculado en resonadores: Chebyshev 0,5 dB 72 dB a 160 MHz, el prototipo pide 4 y hacen falta 5',
    { ...CHEBYSHEV_05, orden: { as: 72, fs: 160e6 } },
    4,
    5,
  ),
  ordenCalculado(
    'Orden calculado en resonadores: Butterworth 30 dB a 130 MHz, por debajo de la banda',
    { orden: { as: 30, fs: 130e6 } },
    2,
    2,
  ),
];

// --- Comportamiento ------------------------------------------------------------------------------

export interface CasoComportamientoResonadores {
  clase: 'comportamiento';
  id: string;
  entradas: EntradaResonadores;
  opciones?: OpcionesResonadores;
  bandera?: LadoDeBandera;
  esperado:
    | { corte: CodigoCorteResonadores }
    | {
        orden: number;
        avisos: readonly CodigoAvisoResonadores[];
        marcados?: Readonly<Record<string, Nivel>>;
        // Si los pasos traen el divisor capacitivo, cuando el caso lo fija.
        divisor?: boolean;
      };
  referencia: string;
}

const comportamiento = (
  id: string,
  entradas: Partial<EntradaResonadores>,
  esperado: CasoComportamientoResonadores['esperado'],
  referencia: string,
  extra: Partial<CasoComportamientoResonadores> = {},
): CasoComportamientoResonadores => ({
  clase: 'comportamiento',
  id,
  entradas: entradaResonadores(entradas),
  esperado,
  referencia,
  ...extra,
});

export const CASOS_COMPORTAMIENTO_RESONADORES: readonly CasoComportamientoResonadores[] = [
  comportamiento(
    'CR9: con L = 8 nH de 50 a 300 Ω el extremo de salida no llega (Rp < 300 Ω)',
    { rl: 300, inductancia: 8e-9 },
    { corte: 'extremo-no-realizable' },
    `${INVESTIGACION}; spec §7.7 y §7.10`,
  ),
  comportamiento(
    'Resonadores: Ventana de L vacía (Butterworth n = 7, 50 → 300 Ω)',
    { orden: 7, rl: 300, inductancia: null },
    { orden: 7, avisos: ['ventana-vacia', 'trimmer'] },
    'spec §7.7 y §7.10',
  ),
  comportamiento(
    'Resonadores: L debajo de la L mínima de Valor impracticable',
    { inductancia: 5e-9 },
    // Con 5 nH, Cr = 238 pF: los Capacitores de sintonía pasan la C máxima de Valor impracticable a
    // 148 MHz (unos 130 pF) y también se marcan.
    {
      orden: 3,
      avisos: ['debajo-de-l-minima', 'trimmer'],
      marcados: {
        L: 'impracticable',
        C1: 'impracticable',
        C2: 'impracticable',
        C3: 'impracticable',
      },
    },
    'spec §5.6, §7.7 y §7.10',
  ),
  comportamiento(
    'Resonadores: L por encima de la ventana, acople debajo del mínimo',
    { inductancia: 27e-9 },
    {
      orden: 3,
      avisos: ['acople-debajo-del-minimo', 'trimmer'],
      marcados: { C12: 'impracticable', C23: 'impracticable' },
    },
    'spec §5.6, §7.7 y §7.10',
  ),
  comportamiento(
    'Resonadores: L propuesta dentro de la ventana, los acoples de CR1 son Valor dudoso',
    { inductancia: null },
    { orden: 3, avisos: ['trimmer'], marcados: { C12: 'dudoso', C23: 'dudoso' } },
    'spec §7.7: "el acople de ~1,05 pF es un Valor dudoso inevitable en esa banda"',
  ),
  comportamiento(
    'Resonadores: FBW hasta 10 %, sin aviso de FBW',
    { banda: { f1: 140e6, f2: 152e6 }, inductancia: null },
    { orden: 3, avisos: ['trimmer'] },
    'spec §7.7',
  ),
  comportamiento(
    'Resonadores: FBW entre 10 y 20 %, aviso informativo',
    { banda: { f1: 140e6, f2: 160e6 }, inductancia: null },
    { orden: 3, avisos: ['fbw-ancho', 'trimmer'] },
    'spec §7.7',
  ),
  comportamiento(
    'Resonadores: FBW de más de 20 %, aviso fuerte, y se calcula igual',
    { banda: { f1: 120e6, f2: 160e6 }, inductancia: null },
    { orden: 3, avisos: ['fbw-fuera-de-rango', 'trimmer'] },
    'spec §7.7',
  ),
  comportamiento(
    'Resonadores: con una L de más, el Capacitor de sintonía de un extremo queda negativo y corta',
    { banda: { f1: 120e6, f2: 160e6 }, inductancia: 220e-9 },
    { corte: 'sintonia-negativa' },
    'spec §7.7 y §7.10; §12.1, P7',
  ),
  comportamiento(
    'Resonadores: ninguna L arma el filtro (FBW de 90 %: C2 negativo con cualquier L)',
    { banda: { f1: 100e6, f2: 300e6 }, inductancia: 100e-9 },
    { corte: 'sin-l-realizable' },
    'spec §7.7 y §7.10; §12.1, P7',
  ),
  comportamiento(
    'Resonadores: ninguna L arma el filtro (200–300 MHz, 50 → 300 Ω), sin L propuesta que corte',
    { banda: { f1: 200e6, f2: 300e6 }, rl: 300, inductancia: null },
    { corte: 'sin-l-realizable' },
    'spec §7.7 y §7.10; §12.1, P5 y P7',
  ),
  // Con la L propuesta: con 22 nH el C23 de 0,97 pF ya avisa por el acople mínimo.
  comportamiento(
    'Resonadores: Chebyshev 0,1 dB de Orden 4 queda en 4, sin aviso',
    { ...CHEBYSHEV_01, orden: 4, inductancia: null },
    { orden: 4, avisos: ['trimmer'] },
    'spec §7.7 y §13.5',
    { bandera: propia(DEDUCCION_PAR) },
  ),
  comportamiento(
    'Resonadores: Chebyshev 0,1 dB de Orden 4, plan B: sube a 5 y avisa',
    { ...CHEBYSHEV_01, orden: 4, inductancia: null },
    { orden: 5, avisos: ['chebyshev-par', 'trimmer'] },
    'spec §7.7 y §13.5',
    { bandera: planB(DEDUCCION_PAR), opciones: { planBChebyshevPar: true } },
  ),
  comportamiento(
    'CR10: los pasos traen el divisor capacitivo de los dos extremos',
    { rl: 300 },
    { orden: 3, avisos: ['trimmer'], divisor: true },
    `${INVESTIGACION}; spec §7.7 y §13.5`,
    { bandera: propia(DEDUCCION_DIVISOR) },
  ),
  comportamiento(
    'CR10, plan B: el divisor capacitivo sale de los pasos',
    { rl: 300 },
    { orden: 3, avisos: ['trimmer'], divisor: false },
    'spec §7.7 y §13.5',
    { bandera: planB(DEDUCCION_DIVISOR), opciones: { planBDivisor: true } },
  ),
  comportamiento(
    'Orden calculado en resonadores: el prototipo alcanza, sin aviso de asimetría',
    { orden: { as: 30, fs: 140e6 }, inductancia: null },
    { orden: 4, avisos: ['trimmer'] },
    'spec §7.7',
  ),
  comportamiento(
    'Orden calculado en resonadores: sube de 3 a 4 por la asimetría del flanco alto y avisa',
    { orden: { as: 48, fs: 160e6 }, inductancia: null },
    { orden: 4, avisos: ['orden-por-asimetria', 'trimmer'] },
    'spec §7.7: "el prototipo pedía n = 3, pero por la asimetría del flanco alto hace falta n = 4"',
  ),
  comportamiento(
    'Orden calculado en resonadores: Chebyshev, plan B, sale impar',
    { ...CHEBYSHEV_05, orden: { as: 70, fs: 160e6 }, inductancia: null },
    { orden: 5, avisos: ['trimmer'] },
    'spec §7.7 y §13.5',
    { bandera: planB(DEDUCCION_PAR), opciones: { planBChebyshevPar: true } },
  ),
  comportamiento(
    'Orden calculado en resonadores: el prototipo pide 10 y la red simulada no llega con 10',
    // 140–160 MHz a 200 MHz: el prototipo de Orden 10 da 128,7 dB y la red, unos 105 dB.
    { orden: { as: 125, fs: 200e6 }, banda: { f1: 140e6, f2: 160e6 }, inductancia: null },
    { corte: 'orden-excedido' },
    'spec §7.7 y §7.10',
  ),
  comportamiento(
    'Orden calculado en resonadores: el prototipo ya pide más de 10',
    { orden: { as: 200, fs: 160e6 }, inductancia: null },
    { corte: 'orden-excedido' },
    'spec §7.6 y §7.10',
  ),
  comportamiento(
    'Orden calculado en resonadores: fs dentro de la banda no tiene solución',
    { orden: { as: 30, fs: 146e6 }, inductancia: null },
    { corte: 'banda-pasante' },
    'spec §7.6 y §7.10',
  ),
];
