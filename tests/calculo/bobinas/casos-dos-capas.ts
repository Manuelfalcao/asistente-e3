import type { EntradaBobina } from '../../../src/calculo/bobinas/bobinas';
import type {
  CodigoAvisoDosCapas,
  CodigoFueraDeRango,
  CorreccionDosCapas,
} from '../../../src/calculo/bobinas/dos-capas';
import type { Medidas, RosaGrover91 } from '../../../src/calculo/bobinas/formulas';
import type { LadoDeBandera } from '../../casos-informe';
import { sumaDeAnillosDosCapas } from '../../oraculos/anillos';
import type { DiferenciaEsperada, Tolerancia } from '../../casos';

// Casos de prueba de la Calculadora de bobinas, dos capas (spec §13.3). Los valores salen de
// research/formulas-bobinas.md, que los cita.

const mm = 1e-3;
const nH = 1e-9;

const coma = (x: number) => String(x).replace('.', ',');

// --- La bandera del plan B (spec §13.5) ----------------------------------------------------------

export const DEDUCCION_MAXWELL = 'maxwell-externo-dos-capas';

export interface LadoDosCapas {
  bandera: LadoDeBandera;
  planB: boolean;
  // La corrección de la L de dos capas de ese lado.
  correccion: CorreccionDosCapas;
  sufijo: string;
}

// Los casos que dependen de la L de dos capas corren de los dos lados de la bandera.
export const LADOS_DOS_CAPAS: readonly LadoDosCapas[] = [
  {
    bandera: { deduccion: DEDUCCION_MAXWELL, lado: 'propia' },
    planB: false,
    correccion: 'maxwell',
    sufijo: '',
  },
  {
    bandera: { deduccion: DEDUCCION_MAXWELL, lado: 'plan-b' },
    planB: true,
    correccion: 'plan-b',
    sufijo: ', plan B',
  },
];

// --- Referencia: la Circular 74, ec. 156 ---------------------------------------------------------

type ValorDeRosa = 'ls' | 'deltaL1' | 'inductancia';

export interface MedidaRosa {
  nombre: string;
  que: ValorDeRosa;
  // En µH, como está impreso.
  impreso: string;
  tolerancia: Tolerancia;
}

export interface CasoVariasCapas {
  clase: 'referencia';
  id: string;
  // a, b y c en m, y N, el total de las capas.
  radioMedio: number;
  largo: number;
  profundidad: number;
  vueltas: number;
  medidas: readonly MedidaRosa[];
  referencia: string;
}

// El valor de Rosa y Grover (91) que se compara, en µH.
export function obtenidoDeRosa(
  rosa: Pick<RosaGrover91, 'ls' | 'deltaL1'>,
  que: ValorDeRosa,
): number {
  const valor = que === 'inductancia' ? rosa.ls - rosa.deltaL1 : rosa[que];
  return valor / 1e-6;
}

const CUARTA_CIFRA: Tolerancia = {
  tipo: 'relativa',
  valor: 5e-4,
  motivo:
    'El ejemplo imprime Ls = 207 400 µH, pero su propia cuenta con K = 0,5255 de la Tabla 10 da ' +
    '207 459 µH: la cuarta cifra quedó corrida una unidad, y la L la hereda. Se acepta ±5·10⁻⁴ ' +
    '(unos 100 µH).',
};

// 10 capas de 100 vueltas, con a = 10 cm, b = 10 cm y c = 1 cm (b/c = 10).
export const CASO_C74_VARIAS_CAPAS: CasoVariasCapas = {
  clase: 'referencia',
  id: 'Circular 74: varias capas, 10 de 100 vueltas',
  radioMedio: 0.1,
  largo: 0.1,
  profundidad: 0.01,
  vueltas: 1000,
  medidas: [
    { nombre: 'Ls (lámina)', que: 'ls', impreso: '207400', tolerancia: CUARTA_CIFRA },
    {
      nombre: 'ΔL1',
      que: 'deltaL1',
      impreso: '12200',
      tolerancia: {
        tipo: 'absoluta',
        valor: 50,
        motivo: 'La Circular la imprime con tres cifras, hasta las centenas: media unidad.',
      },
    },
    { nombre: 'L', que: 'inductancia', impreso: '195200', tolerancia: CUARTA_CIFRA },
  ],
  referencia:
    'NBS, Circular 74 (1918), ec. 156, ejemplo de la pág. 260; research/formulas-bobinas.md, §5.3',
};

// --- Referencia: Bs de la Tabla X de Rosa y Grover -----------------------------------------------

export interface CasoBs {
  clase: 'referencia';
  id: string;
  nPrima: number;
  esperado: string;
  tolerancia: Tolerancia;
  referencia: string;
}

const TOLERANCIA_TABLA_X: Tolerancia = {
  tipo: 'absoluta',
  valor: 1e-4,
  motivo:
    'La investigación recalculó Bs desde su definición y la Tabla X coincide dentro de ±0,0001: ' +
    'la tabla redondea la cuarta cifra. El ajuste agrega menos de 10⁻⁵.',
};

const bs = (nPrima: number, esperado: string): CasoBs => ({
  clase: 'referencia',
  id: `Tabla X: Bs(${coma(nPrima)})`,
  nPrima,
  esperado,
  tolerancia: TOLERANCIA_TABLA_X,
  referencia:
    'E. B. Rosa y F. W. Grover, Bull. Bureau of Standards 8(1), 1912, Tabla X, pág. 201; ' +
    'research/formulas-bobinas.md, §5.3',
});

export const CASOS_BS: readonly CasoBs[] = [
  bs(1, '0'),
  bs(2, '0,1202'),
  bs(3, '0,1753'),
  bs(5, '0,2292'),
  bs(10, '0,2792'),
  bs(20, '0,3099'),
  bs(30, '0,3218'),
];

// --- Verificación: las 7 geometrías de la investigación contra la suma de anillos -----------------

type Relativa = Extract<Tolerancia, { tipo: 'relativa' }>;

export interface BobinaDosCapas extends Medidas {
  vueltasPorCapa: number;
}

// La L de la bobina por la suma de anillos de dos capas, el oráculo de sus casos de verificación.
export const sumaDosCapas = (b: BobinaDosCapas) =>
  sumaDeAnillosDosCapas(b.carrete, b.vueltasPorCapa, b.cable + b.separacion, b.cable);

export interface CasoAnillosDosCapas {
  clase: 'verificacion';
  id: string;
  bobina: BobinaDosCapas;
  tolerancia: Relativa;
  toleranciaPlanB: Relativa;
  oraculo: string;
  referencia: string;
}

const ORACULO_DOS_CAPAS = 'tests/oraculos/anillos.ts (suma de anillos de dos capas apiladas)';
const SECCION_5_4 = 'spec §13.3; research/formulas-bobinas.md, §5.4';

const UN_POR_CIENTO: Relativa = {
  tipo: 'relativa',
  valor: 0.01,
  motivo:
    'Rosa y Grover (91) con Maxwell (93) adaptada son correcciones a la corriente repartida en la ' +
    'sección; contra la suma de anillos la investigación vio de −0,53 a +0,16 % en 11 geometrías.',
};

const PLAN_B_HASTA_MEDIO_D: Relativa = {
  tipo: 'relativa',
  valor: 0.01,
  motivo:
    'Rosa y Grover (91) sola: contra la suma de anillos da de −0,03 a +0,19 % con vueltas juntas ' +
    'y −0,83 % con s = d/2.',
};

const PLAN_B_CON_S_IGUAL_A_D: Relativa = {
  tipo: 'relativa',
  valor: 0.03,
  motivo:
    'Rosa y Grover (91) sola deja afuera ΔL2, la corrección por el cable redondo, que con s = d ' +
    'suma un 2,7 % de la L.',
};

const bobinaDosCapas = (
  carrete: number,
  cable: number,
  separacion: number,
  vueltasPorCapa: number,
): BobinaDosCapas => ({
  carrete: carrete * mm,
  cable: cable * mm,
  separacion: separacion * mm,
  vueltasPorCapa,
});

const nombre = ([carrete, cable, separacion, n]: [number, number, number, number]) =>
  `${n} por capa sobre ${coma(carrete)} mm con cable de ${coma(cable)} mm` +
  (separacion ? ` separado ${coma(separacion)} mm` : '');

// [carrete, cable, Separación, vueltas por capa], en mm
type Fila = [number, number, number, number];

const anillos = (fila: Fila): CasoAnillosDosCapas => ({
  clase: 'verificacion',
  id: `Dos capas contra la suma de anillos: ${nombre(fila)}`,
  bobina: bobinaDosCapas(...fila),
  tolerancia: UN_POR_CIENTO,
  toleranciaPlanB: fila[2] >= fila[1] ? PLAN_B_CON_S_IGUAL_A_D : PLAN_B_HASTA_MEDIO_D,
  oraculo: ORACULO_DOS_CAPAS,
  referencia: SECCION_5_4,
});

const FILAS_5_4: readonly Fila[] = [
  [5, 0.5, 0, 10],
  [5, 0.5, 0, 20],
  [6, 0.8, 0, 8],
  [8, 1, 0, 12],
  [10, 0.5, 0, 30],
  [6, 0.8, 0.4, 8],
  [6, 0.8, 0.8, 6],
];

export const CASOS_ANILLOS_DOS_CAPAS: readonly CasoAnillosDosCapas[] = FILAS_5_4.map(anillos);

// --- Verificación: Hazeltine contra la suma de anillos, con su Diferencia esperada ----------------

export interface CasoHazeltine {
  clase: 'verificacion';
  id: string;
  bobina: BobinaDosCapas;
  diferencia: DiferenciaEsperada;
  tolerancia: Relativa;
  oraculo: string;
  referencia: string;
}

const casoHazeltine = (fila: Fila, porcentaje: number): CasoHazeltine => ({
  clase: 'verificacion',
  id: `Hazeltine contra la suma de anillos: ${nombre(fila)}`,
  bobina: bobinaDosCapas(...fila),
  diferencia: {
    relativa: porcentaje / 100,
    motivo:
      'Hazeltine es una fórmula de bolsillo de corriente repartida en la sección. Wheeler la ' +
      'declara correcta a cerca del 1 % cuando 6a, 9b y 10c son parecidos, y en dos capas c es ' +
      'mucho menor que a y que b.',
  },
  tolerancia: {
    tipo: 'relativa',
    valor: 5e-4,
    motivo: 'La investigación da la Diferencia esperada con un decimal en %: media unidad.',
  },
  oraculo: ORACULO_DOS_CAPAS,
  referencia:
    'H. A. Wheeler, Proc. IRE 16(10), 1928, ec. 1 (Hazeltine); la diferencia, de ' +
    'research/formulas-bobinas.md, §5.4',
});

// La de 6 mm con s = d no tiene la diferencia de Hazeltine en la investigación.
export const CASOS_HAZELTINE: readonly CasoHazeltine[] = [
  casoHazeltine(FILAS_5_4[0], -0.4),
  casoHazeltine(FILAS_5_4[1], -1.4),
  casoHazeltine(FILAS_5_4[2], 0.2),
  casoHazeltine(FILAS_5_4[3], -0.3),
  casoHazeltine(FILAS_5_4[4], -3.1),
  casoHazeltine(FILAS_5_4[5], -0.8),
];

// --- Comportamiento --------------------------------------------------------------------------------

export interface CasoComportamientoDosCapas {
  clase: 'comportamiento';
  id: string;
  entrada: EntradaBobina;
  // Fuera de rango con su motivo, o calculada con estos avisos.
  esperado: { fueraDeRango: CodigoFueraDeRango } | { avisos: readonly CodigoAvisoDosCapas[] };
  referencia: string;
}

const comportamiento = (
  id: string,
  [l, carrete, cable, separacion, frecuencia]: [number, number, number, number, number?],
  esperado: CasoComportamientoDosCapas['esperado'],
): CasoComportamientoDosCapas => ({
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
  referencia: 'spec §6.4 y §6.7',
});

export const CASOS_COMPORTAMIENTO_DOS_CAPAS: readonly CasoComportamientoDosCapas[] = [
  comportamiento(
    'Dos capas fuera de rango, c/a > 0,42: 470 nH sobre 4 mm con 0,8 mm',
    [470, 4, 0.8, 0],
    {
      fueraDeRango: 'cable-grueso',
    },
  ),
  comportamiento(
    'Dos capas fuera de rango, n′ < 1: 150 nH sobre 10 mm con 0,5 mm',
    [150, 10, 0.5, 0],
    {
      fueraDeRango: 'mas-corta-que-profunda',
    },
  ),
  comportamiento(
    'Dos capas fuera de rango, n′ < 1 en el vecino de abajo: 150 nH sobre 10 mm separado 0,25 mm',
    [150, 10, 0.5, 0.25],
    { fueraDeRango: 'mas-corta-que-profunda' },
  ),
  comportamiento(
    'Dos capas con menos de una vuelta por capa: 40 nH sobre 10 mm separado 1 mm',
    [40, 10, 0.5, 1],
    { fueraDeRango: 'menos-de-una-vuelta-por-capa' },
  ),
  comportamiento(
    'Dos capas dentro del rango ampliado, c/a = 0,4: 470 nH sobre 4 mm con 0,5 mm',
    [470, 4, 0.5, 0],
    { avisos: ['rf'] },
  ),
  comportamiento('Dos capas dentro del rango: 4,7 µH sobre 8 mm con 0,4 mm', [4700, 8, 0.4, 0], {
    avisos: ['rf'],
  }),
  comportamiento('Dos capas, f > SRF/3: 4,7 µH sobre 8 mm a 50 MHz', [4700, 8, 0.4, 0, 50e6], {
    avisos: ['rf', 'autorresonancia'],
  }),
  comportamiento(
    'Dos capas, f < SRF/3: 4,7 µH sobre 8 mm a 30 MHz no avisa',
    [4700, 8, 0.4, 0, 30e6],
    {
      avisos: ['rf'],
    },
  ),
];
