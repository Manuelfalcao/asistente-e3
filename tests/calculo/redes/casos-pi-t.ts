import type {
  CodigoCortePiT,
  EntradaRedPiT,
  TipoVariantePiT,
  TopologiaPiT,
} from '../../../src/calculo/redes/redes-pi-t';
import { MEDIA_UNIDAD, type Tolerancia } from '../../casos';

// Casos de prueba de la Calculadora de redes de adaptación, redes π y T (spec §13.3). Los valores
// salen de research/redes-adaptacion.md, §3, §4 y §8.

const BOWICK = 'Bowick, RF Circuit Design, 1.ª ed. (Sams, 1982), cap. 4';
const KAUNE = 'Kaune, QEX (ARRL), sept./oct. 2015, tabla 1';
const ORACULO = 'tests/oraculos/abcd.ts (ABCD con complejos)';
const Q_BOBINA = 100;

export const entradaPiT = (
  topologia: TopologiaPiT,
  rs: number,
  rl: number,
  q: number | null,
  f0 = 100e6,
): EntradaRedPiT => ({ topologia, f0, rs, rl, qBobina: Q_BOBINA, q });

// --- Referencia ----------------------------------------------------------------------------------

// Qué cifra de la variante es la que imprime el libro.
export type Medido =
  | { de: 'resistencia-virtual' }
  // La reactancia (en valor absoluto) del componente en esa posición, de la fuente a la carga.
  | { de: 'reactancia'; indice: number }
  // El Q de la sección del lado de la fuente (0) o de la carga (1).
  | { de: 'q'; seccion: 0 | 1 };

export interface CasoReferenciaPiT {
  clase: 'referencia';
  id: string;
  entradas: EntradaRedPiT;
  variante: TipoVariantePiT;
  // Lo impreso, con coma decimal.
  impresos: readonly { nombre: string; impreso: string; unidad: string; medido: Medido }[];
  tolerancia: Tolerancia;
  referencia: string;
  // Por qué hay cifras del ejemplo que no entran.
  omitidas?: string;
}

const REDONDEO_DEL_LIBRO =
  'El libro redondea la Resistencia virtual y los Q intermedios (4,42 y 4,6, por ejemplo) antes ' +
  'de seguir: las cifras que arrastran ese redondeo se alejan más que media unidad de la exacta.';

// Bowick 4-4 (π de 100 a 1000 Ω, Q = 15) y 4-5 (T de 10 a 50 Ω, Q = 10): solo las cifras que el
// libro imprime sin arrastrar su redondeo, con media unidad. Las otras (X_s2 = 66,3, X_p = 21,7,
// el total de 86,8 de la π; X_p2 = 230 y X_s2 = 220 de la T) salen de intermedios redondeados.
export const CASOS_REFERENCIA_PI_T: readonly CasoReferenciaPiT[] = [
  {
    clase: 'referencia',
    id: 'Bowick 4-4 (π)',
    entradas: entradaPiT('π', 100, 1000, 15),
    variante: 'pasa-bajos',
    impresos: [
      {
        nombre: 'Resistencia virtual',
        impreso: '4,42',
        unidad: 'Ω',
        medido: { de: 'resistencia-virtual' },
      },
      {
        nombre: 'X_p del lado de 1000 Ω',
        impreso: '66,7',
        unidad: 'Ω',
        medido: { de: 'reactancia', indice: 2 },
      },
    ],
    tolerancia: MEDIA_UNIDAD,
    referencia: `${BOWICK}, ejemplo 4-4`,
    omitidas: REDONDEO_DEL_LIBRO,
  },
  {
    clase: 'referencia',
    id: 'Bowick 4-5 (T)',
    entradas: entradaPiT('T', 10, 50, 10),
    variante: 'pasa-bajos',
    impresos: [
      {
        nombre: 'Resistencia virtual',
        impreso: '1010',
        unidad: 'Ω',
        medido: { de: 'resistencia-virtual' },
      },
      { nombre: 'X_s1', impreso: '100', unidad: 'Ω', medido: { de: 'reactancia', indice: 0 } },
      { nombre: 'Q₂', impreso: '4,4', unidad: '', medido: { de: 'q', seccion: 1 } },
      {
        nombre: 'X_p1 || X_p2',
        impreso: '70,2',
        unidad: 'Ω',
        medido: { de: 'reactancia', indice: 1 },
      },
    ],
    tolerancia: MEDIA_UNIDAD,
    referencia: `${BOWICK}, ejemplo 4-5`,
    omitidas: REDONDEO_DEL_LIBRO,
  },
  // Kaune diseña por ancho de banda: su tabla da X_C1, X_L y X_C2 de la π pasa bajos. El Q de
  // Bowick que la reproduce es R_mayor / X_C de la terminal mayor, que la tabla no imprime.
  ...(
    [
      {
        id: 'Kaune P2 (500 → 50 Ω)',
        rs: 500,
        rl: 50,
        q: 500 / 32.1,
        xc1: '32,1',
        xl: '41,9',
        xc2: '10,3',
      },
      {
        id: 'Kaune P3 (5000 → 50 Ω)',
        rs: 5000,
        rl: 50,
        q: 5000 / 264,
        xc1: '264',
        // La tabla imprime 285 para X_L; la exacta es 285,67. Esa cifra no entra.
        xl: null,
        xc2: '31,0',
      },
      {
        id: 'Kaune P4 (5 → 50 Ω)',
        rs: 5,
        rl: 50,
        q: 50 / 3.21,
        xc1: '1,03',
        xl: '4,19',
        xc2: '3,21',
      },
      {
        id: 'Kaune P4 (50 → 50 Ω)',
        rs: 50,
        rl: 50,
        q: 50 / 4.91,
        xc1: '4,91',
        xl: '9,73',
        xc2: '4,91',
      },
    ] as const
  ).map((k): CasoReferenciaPiT => ({
    clase: 'referencia',
    id: k.id,
    entradas: entradaPiT('π', k.rs, k.rl, k.q),
    variante: 'pasa-bajos',
    impresos: [
      { nombre: 'X_C1', impreso: k.xc1, unidad: 'Ω', medido: { de: 'reactancia', indice: 0 } },
      ...(k.xl === null
        ? []
        : [
            {
              nombre: 'X_L',
              impreso: k.xl,
              unidad: 'Ω',
              medido: { de: 'reactancia', indice: 1 },
            } as const,
          ]),
      { nombre: 'X_C2', impreso: k.xc2, unidad: 'Ω', medido: { de: 'reactancia', indice: 2 } },
    ],
    tolerancia: MEDIA_UNIDAD,
    referencia: KAUNE,
    omitidas:
      'El Q es el implícito en la tabla, R_mayor / X_C de la terminal mayor. El f₀/BW de Kaune ' +
      'no entra: da 10,20 contra 9,98 del barrido, y su método de barrido no está publicado.',
  })),
];

// --- Verificación --------------------------------------------------------------------------------

export const TOLERANCIA_ORACULO: Extract<Tolerancia, { tipo: 'relativa' }> = {
  tipo: 'relativa',
  valor: 1e-9,
  motivo: 'Dos vías exactas en doble precisión: queda solo el redondeo de la aritmética.',
};

export const ORACULO_PI_T = ORACULO;

// El BW del barrido contra una segunda vía: el cruce de |Γ| = 1/√2 a la entrada con la impedancia
// del oráculo ABCD. Solo en la pasa bajos, el f₀/BW de los barridos propios de la investigación
// (§5), con media unidad de su cifra; las otras variantes se comparan solo entre las dos vías.
export interface CasoAnchoDeBandaPiT {
  clase: 'verificacion';
  id: string;
  entradas: EntradaRedPiT;
  investigacion?: string;
  oraculo: string;
  referencia: string;
}

const anchoDeBanda = (
  topologia: TopologiaPiT,
  rs: number,
  rl: number,
  q: number,
  investigacion?: string,
): CasoAnchoDeBandaPiT => ({
  clase: 'verificacion',
  id: `BW ${topologia}: ${rs} → ${rl} Ω, Q = ${String(Math.round(q * 100) / 100).replace('.', ',')}`,
  entradas: entradaPiT(topologia, rs, rl, q),
  ...(investigacion && { investigacion }),
  oraculo: ORACULO,
  referencia: investigacion
    ? 'research/redes-adaptacion.md, §5 (barridos propios)'
    : 'spec §13.3 (Redes de adaptación, verificación)',
});

export const CASOS_ANCHO_DE_BANDA_PI_T: readonly CasoAnchoDeBandaPiT[] = [
  anchoDeBanda('π', 100, 1000, 15, '9,59'),
  anchoDeBanda('π', 500, 50, 15.58, '9,98'),
  anchoDeBanda('π', 5000, 50, 18.94, '9,96'),
  anchoDeBanda('π', 50, 1000, 5, '2,39'),
  anchoDeBanda('π', 50, 300, 5, '2,77'),
  anchoDeBanda('T', 10, 50, 10, '6,89'),
  anchoDeBanda('T', 50, 50, 5, '4,58'),
  anchoDeBanda('π', 1000, 100, 15),
  anchoDeBanda('T', 50, 10, 10),
  anchoDeBanda('T', 50, 300, 5),
];

// La grilla en la que todas las variantes, armadas en el oráculo, dan |Zin − R_s|/R_s < 1e-9 en f₀.
// Cada Q es un múltiplo del Q mínimo de su par, para que siempre haya solución.
export const GRILLA_RESISTENCIAS_PI_T: readonly number[] = [5, 12, 50, 75, 300, 1000, 5000];
export const MULTIPLOS_DEL_Q_MINIMO: readonly number[] = [1.2, 2, 5];
export const GRILLA_Q_SIN_MINIMO: readonly number[] = [1, 10];
export const GRILLA_FRECUENCIAS_PI_T: readonly number[] = [3.5e6, 145e6];

// --- Comportamiento ------------------------------------------------------------------------------

export interface CasoComportamientoPiT {
  clase: 'comportamiento';
  id: string;
  entradas: EntradaRedPiT;
  esperado:
    | { corte: CodigoCortePiT; qMinimo?: number }
    | { reducida: true }
    | { avisos: readonly string[]; variantes: number };
  referencia: string;
}

export const CASOS_COMPORTAMIENTO_PI_T: readonly CasoComportamientoPiT[] = [
  {
    clase: 'comportamiento',
    id: 'π sin Q de diseño: pide completarlo con el mínimo',
    entradas: entradaPiT('π', 100, 1000, null),
    esperado: { corte: 'falta-q', qMinimo: 3 },
    referencia: 'spec §9.4',
  },
  {
    clase: 'comportamiento',
    id: 'P7: π de 50 a 1000 Ω con Q = 3 no tiene solución',
    entradas: entradaPiT('π', 50, 1000, 3),
    // Q mínimo = √(1000/50 − 1) = 4,36: la Resistencia virtual sería 100 Ω, que no es menor que 50.
    esperado: { corte: 'q-bajo', qMinimo: Math.sqrt(19) },
    referencia: 'research/redes-adaptacion.md, P7',
  },
  {
    clase: 'comportamiento',
    id: 'T3: T de 50 a 1000 Ω con Q = 3 no tiene solución',
    entradas: entradaPiT('T', 50, 1000, 3),
    // La Resistencia virtual sería 500 Ω, que no es mayor que 1000.
    esperado: { corte: 'q-bajo', qMinimo: Math.sqrt(19) },
    referencia: 'research/redes-adaptacion.md, T3',
  },
  {
    clase: 'comportamiento',
    id: 'π con Q igual al mínimo se reduce a una L',
    entradas: entradaPiT('π', 100, 1000, 3),
    esperado: { reducida: true },
    referencia: 'spec §9.4',
  },
  {
    clase: 'comportamiento',
    id: 'T con Q igual al mínimo se reduce a una L',
    entradas: entradaPiT('T', 100, 1000, 3),
    esperado: { reducida: true },
    referencia: 'spec §9.4',
  },
  {
    clase: 'comportamiento',
    id: 'π con Q mayor que 20 avisa y calcula las cuatro variantes',
    entradas: entradaPiT('π', 50, 300, 25),
    esperado: { avisos: ['q-alto'], variantes: 4 },
    referencia: 'spec §9.4',
  },
  {
    clase: 'comportamiento',
    id: 'Q = 20 no avisa',
    entradas: entradaPiT('T', 50, 300, 20),
    esperado: { avisos: [], variantes: 4 },
    referencia: 'spec §9.4',
  },
  {
    clase: 'comportamiento',
    id: 'π con R_s = R_L calcula las dos variantes que tienen solución, con la nota de filtros',
    entradas: entradaPiT('π', 50, 50, 5),
    // Las mixtas se anulan: la rama serie neta es X_s1 − X_s2 = 0.
    esperado: { avisos: ['rs-igual-rl'], variantes: 2 },
    referencia: 'spec §9.3 y §9.7',
  },
  {
    clase: 'comportamiento',
    id: 'T con R_s = R_L calcula las dos variantes que tienen solución, con la nota de filtros',
    entradas: entradaPiT('T', 50, 50, 5),
    // Las mixtas se anulan: las dos ramas en derivación se cancelan.
    esperado: { avisos: ['rs-igual-rl'], variantes: 2 },
    referencia: 'spec §9.3 y §9.7',
  },
  {
    clase: 'comportamiento',
    id: 'Q de diseño cero es entrada inválida',
    entradas: entradaPiT('π', 50, 300, 0),
    esperado: { corte: 'entrada-invalida' },
    referencia: 'spec §9.7',
  },
  {
    clase: 'comportamiento',
    id: 'T con f₀ = 0 es entrada inválida',
    entradas: entradaPiT('T', 50, 300, 5, 0),
    esperado: { corte: 'entrada-invalida' },
    referencia: 'spec §9.7',
  },
];
