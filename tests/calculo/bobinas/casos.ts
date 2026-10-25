import type {
  CodigoAviso,
  CodigoCorte,
  Diametro,
  EntradaBobina,
} from '../../../src/calculo/bobinas/bobinas';
import type { LaminaUnaCapa, Medidas } from '../../../src/calculo/bobinas/formulas';
import type { Nivel } from '../../../src/calculo/comun/valor-impracticable';
import type { LadoDeBandera } from '../../casos-informe';
import { type DiferenciaEsperada, MEDIA_UNIDAD, type Tolerancia, leerImpreso } from '../../casos';

// Casos de prueba de la Calculadora de bobinas, una capa (spec §13.3). Los valores salen de
// research/formulas-bobinas.md, que los cita, salvo la Tabla 10, transcripta de la Circular 74.

const MU0 = 4 * Math.PI * 1e-7;
const mm = 1e-3;
const nH = 1e-9;

// Un número con coma decimal, como en los id: "0,25".
const coma = (x: number) => String(x).replace('.', ',');

// --- La bandera del plan B (spec §13.5) ----------------------------------------------------------

export const DEDUCCION_RF = 'diametro-rf-una-capa';

export interface Lado {
  bandera: LadoDeBandera;
  planB: boolean;
  // El diámetro del resultado principal de ese lado.
  diametro: Diametro;
  // Lo que se le suma al id del caso.
  sufijo: string;
}

// Los casos que dependen del resultado principal corren de los dos lados de la bandera.
export const LADOS: readonly Lado[] = [
  {
    bandera: { deduccion: DEDUCCION_RF, lado: 'propia' },
    planB: false,
    diametro: 'rf',
    sufijo: '',
  },
  {
    bandera: { deduccion: DEDUCCION_RF, lado: 'plan-b' },
    planB: true,
    diametro: 'd0',
    sufijo: ', plan B',
  },
];

// --- Referencia: kL de la Circular 74, Tabla 10 --------------------------------------------------

const TABLA_10 = 'NBS, Circular 74 (1918), Tabla 10, pág. 283';

export interface CasoKL {
  clase: 'referencia';
  id: string;
  // D/ℓ, la "Diameter/Length" de la tabla.
  x: number;
  esperado: string;
  tolerancia: Tolerancia;
  referencia: string;
}

const kl = (x: number, esperado: string, largoSobreDiametro: string): CasoKL => ({
  clase: 'referencia',
  id: `Tabla 10: D/ℓ = ${coma(x)} (ℓ/D = ${largoSobreDiametro})`,
  x,
  esperado,
  tolerancia: MEDIA_UNIDAD,
  referencia: TABLA_10,
});

// Las dos ramas de Lundin, con ℓ/D de 0,1 a 5.
export const CASOS_KL: readonly CasoKL[] = [
  kl(0.2, '0,9201', '5'),
  kl(0.25, '0,9016', '4'),
  kl(0.5, '0,8181', '2'),
  kl(1, '0,6884', '1'),
  kl(1.5, '0,5950', '0,667'),
  kl(2, '0,5255', '0,5'),
  kl(2.5, '0,4719', '0,4'),
  kl(4, '0,3654', '0,25'),
  kl(5, '0,3198', '0,2'),
  kl(10, '0,2033', '0,1'),
];

// --- Bobinas publicadas, con su geometría y sus vueltas -------------------------------------------

// Una bobina con N fijo: los casos de referencia, de medición y de verificación la calculan con
// esas vueltas, como un paso intermedio.
export interface Bobina extends Medidas {
  vueltas: number;
}

// Knight da el largo de la lámina ℓ = N·p, D0 y el cable, en mm.
function deKnight(largo: number, d0: number, cable: number, vueltas: number): Bobina {
  return {
    carrete: (d0 - cable) * mm,
    cable: cable * mm,
    separacion: (largo / vueltas - cable) * mm,
    vueltas,
  };
}

type ValorDeLamina = 'inductancia' | 'ls' | 'correccion' | 'kL' | 'ks' | 'km';

// El valor de la lámina que se compara, como lo imprime la fuente: las L en µH.
export function obtenidoDe(lamina: Pick<LaminaUnaCapa, ValorDeLamina>, que: ValorDeLamina): number {
  return que === 'kL' || que === 'ks' || que === 'km' ? lamina[que] : lamina[que] / 1e-6;
}

// Una comparación de un caso con N fijo. `que` es el valor de la lámina que se compara.
export interface MedidaBobina {
  nombre: string;
  que: ValorDeLamina;
  // Como está impreso, en µH si es una L.
  impreso: string;
  tolerancia: Tolerancia;
  diferencia?: DiferenciaEsperada;
}

export interface CasoConD0 {
  clase: 'referencia';
  id: string;
  bobina: Bobina;
  medidas: readonly MedidaBobina[];
  referencia: string;
}

// La Circular 74, pág. 253: 400 vueltas de alambre desnudo de 0,05 cm con 10 vueltas por cm, con
// el radio al centro del alambre de 10 cm.
const C74 = { carrete: 0.2 - 0.0005, cable: 0.0005, separacion: 0.0005, vueltas: 400 };
const TOLERANCIA_C74: Tolerancia = {
  tipo: 'relativa',
  valor: 1e-4,
  motivo:
    'El ejemplo toma K = 0,8181 de la Tabla 10, con cuatro decimales (media unidad son ' +
    '6·10⁻⁵ de L), y A y B de sus tablas con tres.',
};

export const CASO_C74: CasoConD0 = {
  clase: 'referencia',
  id: 'Circular 74: una capa de 400 vueltas',
  bobina: C74,
  medidas: [
    { nombre: 'Ls (lámina)', que: 'ls', impreso: '12919', tolerancia: TOLERANCIA_C74 },
    {
      nombre: 'L con D0',
      que: 'inductancia',
      impreso: '12909',
      tolerancia: TOLERANCIA_C74,
      diferencia: {
        relativa: -((MU0 * 0.2 * 400) / 8) / (12909 * 1e-6),
        motivo:
          'La Circular usa la A de Rosa, que lleva la inductancia interna de continua (5/4 − ' +
          'ln(2p/d)); el Asistente usa la ks externa, la de VHF (3/2 − ln(2p/d)): la corrección ' +
          'crece μ0·D0·N/8 = 12,57 µH.',
      },
    },
  ],
  referencia: 'NBS, Circular 74 (1918), ec. 153 y 155, ejemplo de la pág. 253',
};

const KNIGHT_B1B =
  'D. W. Knight, Inductance calculation (g3ynh.info, part_1), ejemplo B1b; research/formulas-bobinas.md, §5.2';

// Knight suma Li, la inductancia interna a la frecuencia de medición; el Asistente no la lleva.
function l0DeKnight(id: string, bobina: Bobina, l0: string, li: string): CasoConD0 {
  return {
    clase: 'referencia',
    id: `L0 de Knight: ${id}`,
    bobina,
    medidas: [
      {
        nombre: 'L con D0',
        que: 'inductancia',
        impreso: l0,
        tolerancia: {
          tipo: 'absoluta',
          valor: 0.001,
          motivo: 'Media unidad del L0 y de la Li impresos (0,0005 µH cada uno).',
        },
        diferencia: {
          relativa: -leerImpreso(li) / leerImpreso(l0),
          motivo:
            `Knight suma la inductancia interna a la frecuencia de medición, Li = ${li} µH; el ` +
            'Asistente usa la ks externa, sin Li, como en VHF.',
        },
      },
    ],
    referencia: KNIGHT_B1B,
  };
}

export const BOBINAS_DE_KNIGHT = {
  M31: deKnight(70.9596, 50.9856, 0.9144, 40),
  M32: deKnight(48.26, 51.0, 0.9144, 38),
  MKG1: deKnight(69.92, 79.5, 1.4, 38),
  MKG2: deKnight(125.02, 79.5, 1.4, 47),
  MKG3: deKnight(150.5, 79.5, 1.4, 50),
  MKG4: deKnight(132.8, 81.2, 1.4, 80),
};

const M31_B1A: MedidaBobina[] = [
  { nombre: 'kL', que: 'kL', impreso: '0,755974', tolerancia: MEDIA_UNIDAD },
  { nombre: 'ks externa', que: 'ks', impreso: '0,1441', tolerancia: MEDIA_UNIDAD },
  { nombre: 'km', que: 'km', impreso: '0,3142', tolerancia: MEDIA_UNIDAD },
  { nombre: 'Ls (lámina)', que: 'ls', impreso: '43,7331', tolerancia: MEDIA_UNIDAD },
  {
    nombre: 'Corrección',
    que: 'correccion',
    impreso: '0,5873',
    tolerancia: {
      tipo: 'absoluta',
      valor: 0.0002,
      motivo:
        'Knight la calcula con ks y km ya redondeados a cuatro decimales: ±0,0001 en ks + km son ' +
        '±0,00013 µH, más media unidad de la cifra impresa.',
    },
  },
];

const { M31, M32, MKG1, MKG2, MKG3, MKG4 } = BOBINAS_DE_KNIGHT;

const L0_M31 = l0DeKnight('M31', M31, '43,248', '0,102');

export const CASOS_KNIGHT: readonly CasoConD0[] = [
  {
    ...L0_M31,
    medidas: [...L0_M31.medidas, ...M31_B1A],
    referencia: `${KNIGHT_B1B}; los valores intermedios, del ejemplo B1a`,
  },
  l0DeKnight('M32', M32, '51,084', '0,103'),
  l0DeKnight('MKG1', MKG1, '83,871', '0,475'),
  l0DeKnight('MKG2', MKG2, '85,247', '0,587'),
  l0DeKnight('MKG3', MKG3, '83,612', '0,624'),
  l0DeKnight('MKG4', MKG4, '243,367', '1,020'),
];

// --- Medición: M31 y M32 contra el resultado principal --------------------------------------------

// Solo las de Medhurst, medidas en HF (Knight les da una Li de un tercio de la de continua). Las
// MKG1 a MKG4 están medidas a baja frecuencia: su Li es la de continua completa, μ0·D·N/8, y ahí
// el D∞ de RF no corresponde (ver el ## Comments del ticket 33).
export interface CasoMedicion {
  clase: 'medicion';
  id: string;
  bobina: Bobina;
  // La L medida, en µH.
  medida: string;
  tolerancia: Tolerancia;
  // En el plan B el resultado principal es de baja frecuencia y queda por encima de la medida: el
  // caso muestra cuánto, con su propia tolerancia.
  toleranciaPlanB: Tolerancia;
  referencia: string;
}

const TOLERANCIA_MEDICION: Tolerancia = {
  tipo: 'relativa',
  valor: 0.01,
  motivo: 'D∞ semiempírico; residuo de Knight ≤ 0,5 % más la incertidumbre de la medición.',
};

const TOLERANCIA_MEDICION_PLAN_B: Tolerancia = {
  tipo: 'relativa',
  valor: 0.03,
  motivo:
    'El plan B es de baja frecuencia y en HF queda por encima de la medida: el L0 de Knight, con ' +
    'D0, da +2,1 % en M31 y +2,4 % en M32 sobre lo medido (research/formulas-bobinas.md, §6.1).',
};

function medhurst(id: string, bobina: Bobina, medida: string, incertidumbre: string): CasoMedicion {
  return {
    clase: 'medicion',
    id: `${id} (Medhurst)`,
    bobina,
    medida,
    tolerancia: TOLERANCIA_MEDICION,
    toleranciaPlanB: TOLERANCIA_MEDICION_PLAN_B,
    referencia:
      `R. G. Medhurst, Wireless Engineer, 1947 (medida ${incertidumbre}), con la geometría de ` +
      KNIGHT_B1B,
  };
}

export const CASOS_MEDICION: readonly CasoMedicion[] = [
  medhurst('M31', M31, '42,374', '± 0,056 µH'),
  medhurst('M32', M32, '49,89', 'sin incertidumbre publicada'),
];

// --- Verificación: tres bobinas de VHF contra la suma de anillos ----------------------------------

export interface CasoAnillos {
  clase: 'verificacion';
  id: string;
  // La bobina buscada, para los pasos del cálculo completo.
  entrada: EntradaBobina;
  // Las vueltas enteras con que se compara el resultado principal.
  vueltas: number;
  tolerancia: Extract<Tolerancia, { tipo: 'relativa' }>;
  oraculo: string;
  referencia: string;
}

const ORACULO_ANILLOS =
  'tests/oraculos/anillos.ts (suma de anillos, con el mismo diámetro que el resultado principal)';

const anillos = (
  id: string,
  [l, carrete, cable, separacion]: [number, number, number, number],
  vueltas: number,
): CasoAnillos => ({
  clase: 'verificacion',
  id,
  entrada: {
    inductancia: l * nH,
    carrete: carrete * mm,
    cable: cable * mm,
    separacion: separacion * mm,
  },
  vueltas,
  tolerancia: {
    tipo: 'relativa',
    valor: 0.01,
    motivo:
      'ks y km son las correcciones de Rosa a la lámina de corriente; contra la suma de anillos ' +
      'la investigación vio hasta 0,6 % con vueltas separadas.',
  },
  oraculo: ORACULO_ANILLOS,
  referencia: 'spec §13.3; research/formulas-bobinas.md, §7',
});

export const CASOS_ANILLOS: readonly CasoAnillos[] = [
  anillos('22 nH: 2 vueltas sobre 4 mm con cable de 0,8 mm', [22, 4, 0.8, 0], 2),
  anillos('100 nH: 6 vueltas sobre 6 mm con cable de 1 mm separado 1 mm', [100, 6, 1, 1], 6),
  anillos('1 µH: 17 vueltas sobre 6 mm con cable de 0,5 mm', [1000, 6, 0.5, 0], 17),
];

// --- Verificación: Wheeler contra la lámina de corriente exacta -----------------------------------

export interface CasoWheeler {
  clase: 'verificacion';
  id: string;
  largoSobreDiametro: number;
  diferencia: DiferenciaEsperada;
  tolerancia: Extract<Tolerancia, { tipo: 'relativa' }>;
  oraculo: string;
  referencia: string;
}

const DOS_DECIMALES: CasoWheeler['tolerancia'] = {
  tipo: 'relativa',
  valor: 5e-5,
  motivo: 'La Diferencia esperada está impresa con dos decimales en %: media unidad.',
};
const UN_DECIMAL: CasoWheeler['tolerancia'] = {
  tipo: 'relativa',
  valor: 5e-4,
  motivo: 'Knight da la Diferencia esperada con un decimal en %: media unidad.',
};

const wheeler = (
  largoSobreDiametro: number,
  porcentaje: number,
  tolerancia: CasoWheeler['tolerancia'],
  fuente: string,
): CasoWheeler => ({
  clase: 'verificacion',
  id:
    `Wheeler 1928, ℓ/D = ${coma(largoSobreDiametro)} ` +
    `(${largoSobreDiametro > 0.4 ? 'dentro' : 'fuera'} de su rango)`,
  largoSobreDiametro,
  diferencia: {
    relativa: porcentaje / 100,
    motivo:
      'Wheeler aproxima la lámina de corriente con una fórmula cerrada; la declara exacta al 1 % ' +
      'con b > 0,8a (ℓ/D > 0,4).',
  },
  tolerancia,
  oraculo: 'tests/oraculos/anillos.ts (lámina de corriente exacta de Lorenz)',
  referencia: `H. A. Wheeler, Proc. IRE 16(10), 1928, ec. 2; la diferencia, de ${fuente}`,
});

const INVESTIGACION = 'research/formulas-bobinas.md, §2.2';

export const CASOS_WHEELER: readonly CasoWheeler[] = [
  wheeler(0.1, -10.8, UN_DECIMAL, `Knight, Solenoid Inductance Calculation (vía ${INVESTIGACION})`),
  wheeler(0.2, -4.06, DOS_DECIMALES, INVESTIGACION),
  wheeler(0.3, -1.57, DOS_DECIMALES, INVESTIGACION),
  wheeler(0.4, -0.54, DOS_DECIMALES, INVESTIGACION),
  wheeler(1, -0.1, DOS_DECIMALES, INVESTIGACION),
  wheeler(2, -0.49, DOS_DECIMALES, INVESTIGACION),
  wheeler(5, -0.56, DOS_DECIMALES, INVESTIGACION),
];

// --- Comportamiento --------------------------------------------------------------------------------

export interface CasoComportamiento {
  clase: 'comportamiento';
  id: string;
  entrada: EntradaBobina;
  // Un corte o los avisos con que se calcula, y el nivel de la L buscada, que se marca también
  // cuando no se calcula (spec §5.6: nunca se bloquea).
  esperado: ({ corte: CodigoCorte } | { avisos: readonly CodigoAviso[] }) & {
    buscada: Nivel | null;
  };
  referencia: string;
}

const comportamiento = (
  id: string,
  [l, carrete, cable, separacion, frecuencia]: [number, number, number, number, number?],
  esperado: CasoComportamiento['esperado'],
  referencia = 'spec §6.5 y §6.7',
): CasoComportamiento => ({
  clase: 'comportamiento',
  id,
  entrada: {
    inductancia: l * nH,
    carrete: carrete * mm,
    cable: cable * mm,
    separacion: separacion * mm,
    frecuencia: frecuencia ?? null,
  },
  esperado,
  referencia,
});

export const CASOS_COMPORTAMIENTO: readonly CasoComportamiento[] = [
  comportamiento('Menos de una vuelta: 5 nH sobre 5 mm', [5, 5, 0.8, 0], {
    corte: 'menos-de-una-vuelta',
    buscada: 'impracticable',
  }),
  comportamiento('Menos de dos vueltas: 14 nH sobre 4 mm', [14, 4, 0.8, 0], {
    avisos: ['menos-de-dos-vueltas', 'terminales'],
    buscada: 'dudoso',
  }),
  comportamiento('f > SRF/3: 1 µH a 145 MHz', [1000, 6, 0.5, 0, 145e6], {
    avisos: ['autorresonancia'],
    buscada: null,
  }),
  comportamiento('f < SRF/3: 1 µH a 50 MHz no avisa', [1000, 6, 0.5, 0, 50e6], {
    avisos: [],
    buscada: null,
  }),
  comportamiento('Nota de terminales debajo de 100 nH: 47 nH', [47, 5, 0.8, 0], {
    avisos: ['terminales'],
    buscada: null,
  }),
  comportamiento('Con 100 nH los terminales quedan en las notas', [100, 5, 0.8, 0], {
    avisos: [],
    buscada: null,
  }),
  comportamiento(
    'L mínima: 5 nH es Valor impracticable',
    [5, 1, 0.2, 0],
    { avisos: ['terminales'], buscada: 'impracticable' },
    'spec §5.6 y §6.7',
  ),
  comportamiento(
    'L mínima: 12 nH es Valor dudoso',
    [12, 2, 0.3, 0],
    { avisos: ['terminales'], buscada: 'dudoso' },
    'spec §5.6 y §6.7',
  ),
  comportamiento(
    'L mínima: 20 nH no se marca',
    [20, 2, 0.3, 0],
    { avisos: ['terminales'], buscada: null },
    'spec §5.6 y §6.7',
  ),
];
