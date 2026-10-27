import type {
  Aproximacion,
  BandaEntrada,
  CodigoAvisoFiltro,
  CodigoCorteFiltro,
  EntradaFiltro,
  PedidoAtenuacion,
  Prototipo,
  TipoBajoAlto,
  TipoDeBanda,
  TipoFiltro,
  TopologiaFiltro,
} from '../../../src/calculo/filtros/filtros';
import type { Nivel } from '../../../src/calculo/comun/valor-impracticable';
import { MEDIA_UNIDAD, type Tolerancia } from '../../casos';

// Casos de prueba de la Calculadora de filtros, pasa bajos y pasa altos en π y T (spec §13.3). Los
// g salen de las tablas de Matthaei, leídas en el escaneo del informe del SRI; los circuitos y las
// atenuaciones, de research/sintesis-filtros-lc.md §7.

const MATTHAEI =
  'Matthaei, Young y Jones, Design of Microwave Filters, Impedance-Matching Networks, and ' +
  'Coupling Structures, vol. I (SRI, 1963; DTIC AD0402852)';
const INVESTIGACION = 'research/sintesis-filtros-lc.md, §7';
const ORACULO = 'tests/oraculos/abcd.ts (ABCD con complejos)';
const Q_POR_DEFECTO = 100;

// El Orden como lo da el Alumno: un entero, o la atenuación As (dB) pedida a fs (Hz) (spec §7.6).
type OrdenEntrada = number | PedidoAtenuacion;
export const pedido = (as: number, fs: number): PedidoAtenuacion => ({ as, fs });

interface Opciones {
  ripple?: number | null;
  rs?: number;
  rl?: number;
}

export const entradaFiltro = (
  tipo: TipoBajoAlto,
  aproximacion: Aproximacion,
  topologia: TopologiaFiltro,
  orden: OrdenEntrada,
  fc: number,
  { ripple = null, rs = 50, rl = 50 }: Opciones = {},
): Extract<EntradaFiltro, { fc: number }> => ({
  tipo,
  aproximacion,
  ripple,
  topologia,
  orden,
  fc,
  rs,
  rl,
  qBobina: Q_POR_DEFECTO,
});

// Pasa banda y rechaza banda: la banda como f1 y f2, o como f0 y BW.
export const entradaBanda = (
  tipo: TipoDeBanda,
  aproximacion: Aproximacion,
  topologia: TopologiaFiltro,
  orden: OrdenEntrada,
  banda: BandaEntrada,
  { ripple = null, rs = 50, rl = 50 }: Opciones = {},
): Extract<EntradaFiltro, { banda: BandaEntrada }> => ({
  tipo,
  aproximacion,
  ripple,
  topologia,
  orden,
  banda,
  rs,
  rl,
  qBobina: Q_POR_DEFECTO,
});

// Los bordes de banda (Ω = 1 del prototipo) de una entrada: fc, o f1 y f2.
export const bordesDe = (e: EntradaFiltro): number[] =>
  'fc' in e ? [e.fc] : 'f1' in e.banda ? [e.banda.f1, e.banda.f2] : [];

// --- Referencia ----------------------------------------------------------------------------------

// Una fila de una tabla de g: g1 … gn y g(n+1), como están impresos.
export interface CasoReferenciaG {
  clase: 'referencia';
  id: string;
  aproximacion: Aproximacion;
  orden: number;
  ripple: number | null;
  impresos: readonly string[];
  tolerancia: Tolerancia;
  referencia: string;
}

// La Tabla 4.05-1 imprime 4 cifras significativas; la fórmula cerrada es exacta.
const BUTTERWORTH: readonly (readonly string[])[] = [
  ['2,000', '1,000'],
  ['1,414', '1,414', '1,000'],
  ['1,000', '2,000', '1,000', '1,000'],
  ['0,7654', '1,848', '1,848', '0,7654', '1,000'],
  ['0,6180', '1,618', '2,000', '1,618', '0,6180', '1,000'],
  ['0,5176', '1,414', '1,932', '1,932', '1,414', '0,5176', '1,000'],
  ['0,4450', '1,247', '1,802', '2,000', '1,802', '1,247', '0,4450', '1,000'],
];

// La Tabla 4.05-2(a) se calculó en 1963 y no siempre redondea la cuarta cifra: en 0,01 y 0,1 dB a
// veces la trunca, y en 7 elementos se aparta hasta 2,4 unidades de su propia ec. 4.05-2. Las filas
// que se apartan más que media unidad llevan 3 unidades, con la cifra que se aparta como motivo.
const apartada = (cifra: string): Extract<Tolerancia, { tipo: 'absoluta' }> => ({
  tipo: 'absoluta',
  valor: 3e-4,
  motivo:
    `La tabla impresa se aparta de su ec. 4.05-2 más que media unidad (${cifra}): 3 unidades ` +
    'de la cuarta cifra.',
});

interface FilaChebyshev {
  impresos: readonly string[];
  // La cifra que se aparta, si la fila no entra en media unidad.
  apartada?: string;
}

const CHEBYSHEV: readonly { ripple: number; filas: Record<number, FilaChebyshev> }[] = [
  {
    ripple: 0.01,
    filas: {
      3: {
        impresos: ['0,6291', '0,9702', '0,6291', '1,0000'],
        apartada: 'g2 = 0,9702 donde la ecuación da 0,97028',
      },
      4: {
        impresos: ['0,7128', '1,2003', '1,3212', '0,6476', '1,1007'],
        apartada: 'g3 = 1,3212 donde la ecuación da 1,32128',
      },
      5: { impresos: ['0,7563', '1,3049', '1,5773', '1,3049', '0,7563', '1,0000'] },
      7: {
        impresos: ['0,7969', '1,3924', '1,7481', '1,6331', '1,7481', '1,3924', '0,7969', '1,0000'],
      },
    },
  },
  {
    ripple: 0.1,
    filas: {
      3: {
        impresos: ['1,0315', '1,1474', '1,0315', '1,0000'],
        apartada: 'g1 = 1,0315 donde la ecuación da 1,03156',
      },
      4: {
        impresos: ['1,1088', '1,3061', '1,7703', '0,8180', '1,3554'],
        apartada: 'g2 = 1,3061 donde la ecuación da 1,30618',
      },
      5: { impresos: ['1,1468', '1,3712', '1,9750', '1,3712', '1,1468', '1,0000'] },
      7: {
        impresos: ['1,1811', '1,4228', '2,0966', '1,5733', '2,0966', '1,4228', '1,1811', '1,0000'],
        apartada: 'g4 = 1,5733 donde la ecuación da 1,57340',
      },
    },
  },
  {
    ripple: 0.5,
    filas: {
      3: { impresos: ['1,5963', '1,0967', '1,5963', '1,0000'] },
      4: { impresos: ['1,6703', '1,1926', '2,3661', '0,8419', '1,9841'] },
      5: { impresos: ['1,7058', '1,2296', '2,5408', '1,2296', '1,7058', '1,0000'] },
      7: {
        impresos: ['1,7372', '1,2583', '2,6381', '1,3444', '2,6381', '1,2583', '1,7372', '1,0000'],
        apartada: 'g3 = 2,6381 donde la ecuación da 2,63829',
      },
    },
  },
  {
    ripple: 1,
    filas: {
      3: { impresos: ['2,0236', '0,9941', '2,0236', '1,0000'] },
      4: {
        impresos: ['2,0991', '1,0644', '2,8311', '0,7892', '2,6599'],
        apartada: 'g5 = 2,6599 donde la ecuación da 2,65972',
      },
      5: { impresos: ['2,1349', '1,0911', '3,0009', '1,0911', '2,1349', '1,0000'] },
      7: {
        impresos: ['2,1664', '1,1116', '3,0934', '1,1736', '3,0934', '1,1116', '2,1664', '1,0000'],
        apartada: 'g3 = 3,0934 donde la ecuación da 3,09364',
      },
    },
  },
];

// La Tabla 4.07-1 (Weinberg) imprime los g normalizados a retardo de 1 s, con 4 decimales, y el
// factor ω3dB de cada Orden es el de research/sintesis-filtros-lc.md §3.3. La tabla guardada tiene
// los g renormalizados a −3 dB: acá se comparan de vuelta contra los impresos (ver `comoImpresos`).
const BESSEL: readonly (readonly string[])[] = [
  ['1,5774', '0,4226', '1,0000'],
  ['1,2550', '0,5528', '0,1922', '1,0000'],
  ['1,0598', '0,5116', '0,3181', '0,1104', '1,0000'],
  ['0,9303', '0,4577', '0,3312', '0,2090', '0,0718', '1,0000'],
  ['0,8377', '0,4116', '0,3158', '0,2364', '0,1480', '0,0505', '1,0000'],
  ['0,7677', '0,3744', '0,2944', '0,2378', '0,1778', '0,1104', '0,0375', '1,0000'],
  ['0,7125', '0,3446', '0,2735', '0,2297', '0,1867', '0,1387', '0,0855', '0,0289', '1,0000'],
  [
    '0,6678', '0,3203', '0,2547', '0,2184', '0,1859', '0,1506', '0,1112', '0,0682', '0,0230',
    '1,0000',
  ],
  [
    '0,6305', '0,3002', '0,2384', '0,2066', '0,1808', '0,1539', '0,1240', '0,0910', '0,0556',
    '0,0187', '1,0000',
  ],
];

// Los g y la carga en la normalización de la tabla impresa. Solo Bessel cambia: se guarda a −3 dB.
export const comoImpresos = (p: Prototipo): number[] => {
  const escala = p.factorRetardo ?? 1;
  return [...p.g.map((g) => g / escala), p.carga];
};

const rippleTexto = (r: number) => `${String(r).replace('.', ',')} dB`;

export const CASOS_REFERENCIA_G: readonly CasoReferenciaG[] = [
  ...BESSEL.map((impresos, i): CasoReferenciaG => ({
    clase: 'referencia',
    id: `Bessel n = ${i + 2}`,
    aproximacion: 'bessel',
    orden: i + 2,
    ripple: null,
    impresos,
    tolerancia: MEDIA_UNIDAD,
    referencia: `${MATTHAEI}, tabla 4.07-1`,
  })),
  ...BUTTERWORTH.map((impresos, i): CasoReferenciaG => ({
    clase: 'referencia',
    id: `Butterworth n = ${i + 1}`,
    aproximacion: 'butterworth',
    orden: i + 1,
    ripple: null,
    impresos,
    tolerancia: MEDIA_UNIDAD,
    referencia: `${MATTHAEI}, tabla 4.05-1(a), pág. 98`,
  })),
  ...CHEBYSHEV.flatMap(({ ripple, filas }) =>
    Object.entries(filas).map(([n, fila]): CasoReferenciaG => ({
      clase: 'referencia',
      id: `Chebyshev ${rippleTexto(ripple)}, n = ${n}`,
      aproximacion: 'chebyshev',
      orden: Number(n),
      ripple,
      impresos: fila.impresos,
      tolerancia: fila.apartada ? apartada(fila.apartada) : MEDIA_UNIDAD,
      referencia: `${MATTHAEI}, tabla 4.05-2(a), ${ripple === 1 ? 'pág. 101' : 'pág. 100'}`,
    })),
  ),
];

// --- Verificación --------------------------------------------------------------------------------

export const TOLERANCIA_ORACULO: Extract<Tolerancia, { tipo: 'relativa' }> = {
  tipo: 'relativa',
  valor: 1e-9,
  motivo: 'Dos vías exactas en doble precisión: queda solo el redondeo de la aritmética.',
};

// La tabla de Bessel se guarda con 4 cifras (g y factor), así que el −3 dB en fc no es exacto como en
// las fórmulas cerradas; medido: 1,3·10⁻⁴ en C3.
export const TOLERANCIA_BORDE_BESSEL: Extract<Tolerancia, { tipo: 'relativa' }> = {
  tipo: 'relativa',
  valor: 1e-3,
  motivo: 'Los g y el factor ω3dB de la tabla de Bessel tienen 4 cifras: el borde queda a ~1e-4.',
};

export const toleranciaBorde = (aproximacion: Aproximacion) =>
  aproximacion === 'bessel' ? TOLERANCIA_BORDE_BESSEL : TOLERANCIA_ORACULO;

export const TOLERANCIA_VALORES: Extract<Tolerancia, { tipo: 'relativa' }> = {
  tipo: 'relativa',
  valor: 1e-3,
  motivo: 'La investigación imprime 4 cifras: ±0,1 %, como propone para las pruebas.',
};

export const TOLERANCIA_DB: Extract<Tolerancia, { tipo: 'absoluta' }> = {
  tipo: 'absoluta',
  valor: 0.01,
  motivo: 'Atenuación simulada contra la de la investigación: ±0,01 dB (spec §13.2).',
};

// Un circuito de la investigación: los valores en orden desde la fuente (nH o pF) y la atenuación
// de la escalera ideal a cada frecuencia, todo como está impreso.
export interface CasoVerificacionFiltro {
  clase: 'verificacion';
  id: string;
  entradas: EntradaFiltro;
  valores: readonly { nombre: string; impreso: string; unidad: 'nH' | 'pF' }[];
  atenuaciones: readonly { f: number; impreso: string }[];
  oraculo: string;
  referencia: string;
}

// "L1 16,75 nH · C1 159,2 pF" como valores impresos; vacía si no hay.
export const valores = (lista: string) =>
  lista === ''
    ? []
    : lista.split(' · ').map((v) => {
        const [nombre, impreso, unidad] = v.split(' ') as [string, string, 'nH' | 'pF'];
        return { nombre, impreso, unidad };
      });

const ATENUACION_C1 = [
  { f: 50e6, impreso: '0,004' },
  { f: 100e6, impreso: '3,010' },
  { f: 200e6, impreso: '30,11' },
  { f: 300e6, impreso: '47,71' },
];
const ATENUACION_C2 = [
  { f: 50e6, impreso: '0,131' },
  { f: 100e6, impreso: '0,500' },
  { f: 200e6, impreso: '42,04' },
  { f: 300e6, impreso: '61,40' },
];
const ATENUACION_C4 = [
  { f: 25e6, impreso: '18,13' },
  { f: 50e6, impreso: '3,010' },
  { f: 100e6, impreso: '0,067' },
];

const BANDA_FM = { f1: 88e6, f2: 108e6 };
const F0_FM = Math.sqrt(BANDA_FM.f1 * BANDA_FM.f2);

const ATENUACION_C5 = [
  { f: 70e6, impreso: '31,02' },
  { f: 88e6, impreso: '3,010' },
  { f: F0_FM, impreso: '0,000' },
  { f: 108e6, impreso: '3,010' },
  { f: 130e6, impreso: '27,25' },
];
const ATENUACION_C6 = [
  { f: 70e6, impreso: '33,30' },
  { f: 88e6, impreso: '0,500' },
  { f: 108e6, impreso: '0,500' },
  { f: 130e6, impreso: '29,31' },
];
// En f0 la atenuación es infinita en el modelo ideal; afuera de la banda rechazada no hay pérdida.
const ATENUACION_C7 = [
  { f: 50e6, impreso: '0,000' },
  { f: 88e6, impreso: '3,010' },
  { f: 108e6, impreso: '3,010' },
  { f: 200e6, impreso: '0,000' },
];

const verificacion = (
  id: string,
  entradas: EntradaFiltro,
  lista: string,
  atenuaciones: CasoVerificacionFiltro['atenuaciones'],
): CasoVerificacionFiltro => ({
  clase: 'verificacion',
  id,
  entradas,
  valores: valores(lista),
  atenuaciones,
  oraculo: ORACULO,
  referencia: INVESTIGACION,
});

export const CASOS_VERIFICACION: readonly CasoVerificacionFiltro[] = [
  verificacion(
    'C1 π: Butterworth pasa bajos, n = 5, 100 MHz',
    entradaFiltro('pasa-bajos', 'butterworth', 'π', 5, 100e6),
    'C1 19,67 pF · L2 128,8 nH · C3 63,66 pF · L4 128,8 nH · C5 19,67 pF',
    ATENUACION_C1,
  ),
  verificacion(
    'C1 T: Butterworth pasa bajos, n = 5, 100 MHz',
    entradaFiltro('pasa-bajos', 'butterworth', 'T', 5, 100e6),
    'L1 49,18 nH · C2 51,50 pF · L3 159,2 nH · C4 51,50 pF · L5 49,18 nH',
    ATENUACION_C1,
  ),
  verificacion(
    'C2 π: Chebyshev 0,5 dB pasa bajos, n = 5, 100 MHz',
    entradaFiltro('pasa-bajos', 'chebyshev', 'π', 5, 100e6, { ripple: 0.5 }),
    'C1 54,30 pF · L2 97,85 nH · C3 80,88 pF · L4 97,85 nH · C5 54,30 pF',
    ATENUACION_C2,
  ),
  verificacion(
    'C2 T: Chebyshev 0,5 dB pasa bajos, n = 5, 100 MHz',
    entradaFiltro('pasa-bajos', 'chebyshev', 'T', 5, 100e6, { ripple: 0.5 }),
    'L1 135,7 nH · C2 39,14 pF · L3 202,2 nH · C4 39,14 pF · L5 135,7 nH',
    ATENUACION_C2,
  ),
  verificacion(
    'C3 π: Bessel pasa bajos, n = 5, 100 MHz',
    entradaFiltro('pasa-bajos', 'bessel', 'π', 5, 100e6),
    'C1 71,88 pF · L2 88,41 nH · C3 25,59 pF · L4 40,36 nH · C5 5,549 pF',
    [
      { f: 50e6, impreso: '0,720' },
      { f: 100e6, impreso: '3,010' },
      { f: 200e6, impreso: '14,06' },
      { f: 300e6, impreso: '28,34' },
    ],
  ),
  verificacion(
    'C4 T: Butterworth pasa altos, n = 3, 50 MHz',
    entradaFiltro('pasa-altos', 'butterworth', 'T', 3, 50e6),
    'C1 63,66 pF · L2 79,58 nH · C3 63,66 pF',
    ATENUACION_C4,
  ),
  verificacion(
    'C4 π: Butterworth pasa altos, n = 3, 50 MHz',
    entradaFiltro('pasa-altos', 'butterworth', 'π', 3, 50e6),
    'L1 159,2 nH · C2 31,83 pF · L3 159,2 nH',
    ATENUACION_C4,
  ),
  verificacion(
    'C5 π: Butterworth pasa banda, n = 3, 88 a 108 MHz',
    entradaBanda('pasa-banda', 'butterworth', 'π', 3, BANDA_FM),
    'L1 16,75 nH · C1 159,2 pF · L2 795,8 nH · C2 3,349 pF · L3 16,75 nH · C3 159,2 pF',
    ATENUACION_C5,
  ),
  verificacion(
    'C5 T: Butterworth pasa banda, n = 3, 88 a 108 MHz',
    entradaBanda('pasa-banda', 'butterworth', 'T', 3, BANDA_FM),
    'L1 397,9 nH · C1 6,698 pF · L2 8,373 nH · C2 318,3 pF · L3 397,9 nH · C3 6,698 pF',
    ATENUACION_C5,
  ),
  verificacion(
    'C6 π: Chebyshev 0,5 dB pasa banda, n = 3, 88 a 108 MHz',
    entradaBanda('pasa-banda', 'chebyshev', 'π', 3, BANDA_FM, { ripple: 0.5 }),
    'L1 10,49 nH · C1 254,1 pF · L2 436,4 nH · C2 6,108 pF · L3 10,49 nH · C3 254,1 pF',
    ATENUACION_C6,
  ),
  verificacion(
    'C7 T: Butterworth rechaza banda, n = 3, 88 a 108 MHz',
    entradaBanda('rechaza-banda', 'butterworth', 'T', 3, BANDA_FM),
    'L1 16,75 nH · C1 159,2 pF · L2 198,9 nH · C2 13,40 pF · L3 16,75 nH · C3 159,2 pF',
    ATENUACION_C7,
  ),
  verificacion(
    'C7 π: Butterworth rechaza banda, n = 3, 88 a 108 MHz',
    entradaBanda('rechaza-banda', 'butterworth', 'π', 3, BANDA_FM),
    'L1 397,9 nH · C1 6,698 pF · L2 33,49 nH · C2 79,58 pF · L3 397,9 nH · C3 6,698 pF',
    ATENUACION_C7,
  ),
];

// La pérdida de Cohn contra la escalera simulada con la pérdida de cada bobina: en pasa bajos una R
// de ωc·L/Qu en serie, en continua; en pasa altos una R de Qu·ωc·L en paralelo, muy por encima de
// fc. Es el modelo de Matthaei (Sec. 4.13): dk = 1/Qk constante, transformado al circuito real.
export interface CasoCohn {
  clase: 'verificacion';
  id: string;
  entradas: EntradaFiltro;
  diferencia: { relativa: number; motivo: string };
  oraculo: string;
  referencia: string;
}

const MOTIVO_COHN =
  'Cohn es de primer orden en 1/Qu: suma las pérdidas de cada bobina como si no interactuaran, y ' +
  'queda apenas por encima de la simulada. La diferencia se midió con esta misma simulación.';

export const TOLERANCIA_COHN: Extract<Tolerancia, { tipo: 'relativa' }> = {
  tipo: 'relativa',
  valor: 1e-3,
  motivo: 'Alrededor de la Diferencia esperada, que está escrita con 3 cifras: ±0,1 %.',
};

// En pasa banda la simulación pone una R en serie de ω0·L/Qu en cada bobina y mide en f0 (Q
// constante de Matthaei, Sec. 4.13). Cohn queda apenas por encima, y más cuanto más angosta la
// banda y mayor la pérdida, porque es de primer orden en 1/Qu.
const MOTIVO_COHN_BANDA =
  'Cohn es de primer orden en 1/Qk: suma la pérdida de cada resonador como si no interactuaran, ' +
  'y queda por encima de la simulada, más cuanto más pierde el filtro. La diferencia se midió con ' +
  'esta misma simulación.';

const cohnBanda = (id: string, entradas: EntradaFiltro, relativa: number): CasoCohn => ({
  ...cohn(id, entradas, relativa),
  diferencia: { relativa, motivo: MOTIVO_COHN_BANDA },
  referencia: 'Matthaei, Young y Jones (1964), ec. 4.13-2 y 4.13-11; spec §7.8',
});

const cohn = (id: string, entradas: EntradaFiltro, relativa: number): CasoCohn => ({
  clase: 'verificacion',
  id,
  entradas,
  diferencia: { relativa, motivo: MOTIVO_COHN },
  oraculo: ORACULO,
  referencia: 'Matthaei, Young y Jones (1964), ec. 4.13-11; spec §7.8',
});

export const CASOS_COHN: readonly CasoCohn[] = [
  cohn(
    'Cohn C1 π: Butterworth pasa bajos, n = 5, Qu = 100',
    entradaFiltro('pasa-bajos', 'butterworth', 'π', 5, 100e6),
    0.00807,
  ),
  cohn(
    'Cohn C2 π: Chebyshev 0,5 dB pasa bajos, n = 5, Qu = 100',
    entradaFiltro('pasa-bajos', 'chebyshev', 'π', 5, 100e6, { ripple: 0.5 }),
    0.00614,
  ),
  cohn(
    'Cohn C2 T: Chebyshev 0,5 dB pasa bajos, n = 5, Qu = 100',
    entradaFiltro('pasa-bajos', 'chebyshev', 'T', 5, 100e6, { ripple: 0.5 }),
    0.01481,
  ),
  cohn(
    'Cohn C4 T: Butterworth pasa altos, n = 3, Qu = 100',
    entradaFiltro('pasa-altos', 'butterworth', 'T', 3, 50e6),
    0.00499,
  ),
  cohnBanda(
    'Cohn C5 π: Butterworth pasa banda, n = 3, 88 a 108 MHz, Qu = 100',
    entradaBanda('pasa-banda', 'butterworth', 'π', 3, BANDA_FM),
    0.000444,
  ),
  cohnBanda(
    'Cohn C5 T: Butterworth pasa banda, n = 3, 88 a 108 MHz, Qu = 100',
    entradaBanda('pasa-banda', 'butterworth', 'T', 3, BANDA_FM),
    0.000444,
  ),
  cohnBanda(
    'Cohn C6 π: Chebyshev 0,5 dB pasa banda, n = 3, 88 a 108 MHz, Qu = 100',
    entradaBanda('pasa-banda', 'chebyshev', 'π', 3, BANDA_FM, { ripple: 0.5 }),
    0.0117,
  ),
  cohnBanda(
    'Cohn C6 T: Chebyshev 0,5 dB pasa banda, n = 3, 88 a 108 MHz, Qu = 100',
    entradaBanda('pasa-banda', 'chebyshev', 'T', 3, BANDA_FM, { ripple: 0.5 }),
    0.0117,
  ),
  cohnBanda(
    'Cohn C8 π: Butterworth pasa banda angosto, n = 3, 144 a 148 MHz, Qu = 100',
    entradaBanda('pasa-banda', 'butterworth', 'π', 3, { f1: 144e6, f2: 148e6 }),
    0.0204,
  ),
];

// --- Comportamiento ------------------------------------------------------------------------------

export interface CasoComportamientoFiltro {
  clase: 'comportamiento';
  id: string;
  entradas: EntradaFiltro;
  esperado:
    | { corte: CodigoCorteFiltro }
    | {
        orden: number;
        avisos: readonly CodigoAvisoFiltro[];
        // La Topología con la que se calcula, si el caso la fija.
        topologia?: TopologiaFiltro;
        // Los valores marcados, con su nivel; los que no están no se marcan.
        marcados?: Readonly<Record<string, Nivel>>;
      };
  referencia: string;
}

export const CASOS_COMPORTAMIENTO: readonly CasoComportamientoFiltro[] = [
  {
    clase: 'comportamiento',
    id: 'Chebyshev 0,5 dB de Orden 4 sube a 5 y avisa',
    entradas: entradaFiltro('pasa-bajos', 'chebyshev', 'π', 4, 100e6, { ripple: 0.5 }),
    esperado: { orden: 5, avisos: ['chebyshev-par'] },
    referencia: 'spec §7.3 y §7.10',
  },
  {
    clase: 'comportamiento',
    id: 'Chebyshev 1 dB de Orden 10 sube a 11 y avisa',
    entradas: entradaFiltro('pasa-altos', 'chebyshev', 'T', 10, 100e6, { ripple: 1 }),
    esperado: { orden: 11, avisos: ['chebyshev-par'] },
    referencia: 'spec §7.3 y §7.10',
  },
  {
    clase: 'comportamiento',
    id: 'Butterworth de Orden 4 no cambia de Orden',
    entradas: entradaFiltro('pasa-bajos', 'butterworth', 'π', 4, 100e6),
    esperado: { orden: 4, avisos: [] },
    referencia: 'spec §7.3',
  },
  {
    clase: 'comportamiento',
    id: 'Bessel de Orden 4 no cambia de Orden',
    entradas: entradaFiltro('pasa-bajos', 'bessel', 'π', 4, 100e6),
    esperado: { orden: 4, avisos: [] },
    referencia: 'spec §7.3',
  },
  {
    clase: 'comportamiento',
    id: 'Bessel con Rs ≠ RL no se calcula en π ni en T',
    entradas: entradaFiltro('pasa-bajos', 'bessel', 'π', 5, 100e6, { rs: 50, rl: 75 }),
    esperado: { corte: 'bessel-terminaciones-distintas' },
    referencia: 'spec §7.4 y §7.10',
  },
  {
    clase: 'comportamiento',
    id: 'Bessel con Rs ≠ RL tampoco en pasa banda, ni con el Orden calculado',
    entradas: entradaBanda('pasa-banda', 'bessel', 'T', pedido(20, 70e6), BANDA_FM, {
      rs: 300,
      rl: 50,
    }),
    esperado: { corte: 'bessel-terminaciones-distintas' },
    referencia: 'spec §7.4 y §7.10',
  },
  {
    clase: 'comportamiento',
    id: 'Rs ≠ RL: Butterworth de 50 a 75 Ω se calcula con el aviso de pérdida plana',
    entradas: entradaFiltro('pasa-bajos', 'butterworth', 'π', 5, 100e6, { rs: 50, rl: 75 }),
    esperado: { orden: 5, avisos: ['perdida-plana'], topologia: 'π' },
    referencia: 'spec §7.4 y §7.10',
  },
  {
    clase: 'comportamiento',
    id: 'R10: Chebyshev 0,1 dB de Orden 4 con r = 1,3 no tiene diseño y sube a 5',
    entradas: entradaFiltro('pasa-bajos', 'chebyshev', 'T', 4, 100e6, {
      ripple: 0.1,
      rs: 50,
      rl: 65,
    }),
    esperado: { orden: 5, avisos: ['perdida-plana', 'chebyshev-par'], topologia: 'T' },
    referencia: 'spec §7.4 y §7.10; research/filtros-terminaciones-desiguales.md, §6.1 (R10)',
  },
  {
    clase: 'comportamiento',
    id: 'Chebyshev 0,5 dB de Orden 4 de 50 a 75 Ω (r = 1,5 < r_min = 1,98) sube a 5',
    entradas: entradaBanda('pasa-banda', 'chebyshev', 'π', 4, BANDA_FM, {
      ripple: 0.5,
      rs: 50,
      rl: 75,
    }),
    esperado: { orden: 5, avisos: ['perdida-plana', 'chebyshev-par'], topologia: 'π' },
    referencia: 'spec §7.4 y §7.10',
  },
  {
    clase: 'comportamiento',
    id: 'Chebyshev 0,1 dB de Orden 4 de 50 a 300 Ω (r = 6 ≥ r_min) se arma par',
    entradas: entradaFiltro('pasa-altos', 'chebyshev', 'T', 4, 100e6, {
      ripple: 0.1,
      rs: 50,
      rl: 300,
    }),
    esperado: { orden: 4, avisos: ['perdida-plana'], topologia: 'T' },
    referencia: 'spec §7.4',
  },
  {
    clase: 'comportamiento',
    id: 'Topología imposible: Butterworth de Orden 4 desde 50 Ω hacia 300 Ω en π pasa a T',
    entradas: entradaFiltro('pasa-bajos', 'butterworth', 'π', 4, 100e6, { rs: 50, rl: 300 }),
    esperado: { orden: 4, avisos: ['perdida-plana', 'topologia-orden-par'], topologia: 'T' },
    referencia: 'spec §7.4 y §7.10',
  },
  {
    clase: 'comportamiento',
    id: 'Topología imposible: Chebyshev 0,1 dB de Orden 4 desde 300 Ω hacia 50 Ω en T pasa a π',
    entradas: entradaBanda('rechaza-banda', 'chebyshev', 'T', 4, BANDA_FM, {
      ripple: 0.1,
      rs: 300,
      rl: 50,
    }),
    esperado: { orden: 4, avisos: ['perdida-plana', 'topologia-orden-par'], topologia: 'π' },
    referencia: 'spec §7.4 y §7.10',
  },
  {
    clase: 'comportamiento',
    id: 'Orden calculado con Rs ≠ RL: Chebyshev 0,1 dB de 50 a 300 Ω sale par (6)',
    // El mismo pedido que O3: con Rs = RL sale 6 y pasa a 7; con r = 6 ≥ r_min el 6 se arma.
    entradas: entradaFiltro('pasa-bajos', 'chebyshev', 'T', pedido(40, 200e6), 100e6, {
      ripple: 0.1,
      rs: 50,
      rl: 300,
    }),
    esperado: { orden: 6, avisos: ['perdida-plana'], topologia: 'T' },
    referencia: 'spec §7.4 y §7.6',
  },
  {
    clase: 'comportamiento',
    id: 'Orden calculado con Rs ≠ RL: Chebyshev 0,1 dB de 50 a 60 Ω (r = 1,2 < r_min) sale 7',
    entradas: entradaFiltro('pasa-bajos', 'chebyshev', 'T', pedido(40, 200e6), 100e6, {
      ripple: 0.1,
      rs: 50,
      rl: 60,
    }),
    esperado: { orden: 7, avisos: ['perdida-plana'], topologia: 'T' },
    referencia: 'spec §7.4 y §7.6',
  },
  {
    clase: 'comportamiento',
    id: 'Valor impracticable: Chebyshev 2 dB pasa bajos π de Orden 5 a 300 MHz',
    // C3 = 40,1 pF está cerca de su autorresonancia a 300 MHz; C1 y C5, de 30,0 pF, son dudosos. En
    // T las C quedan en 9,5 pF y no se marcan.
    entradas: entradaFiltro('pasa-bajos', 'chebyshev', 'π', 5, 300e6, { ripple: 2 }),
    esperado: {
      orden: 5,
      avisos: [],
      marcados: { C1: 'dudoso', C3: 'impracticable', C5: 'dudoso' },
    },
    referencia: 'spec §5.6 y §7.10',
  },
  {
    clase: 'comportamiento',
    id: 'Valor impracticable: el mismo filtro en T no marca nada',
    entradas: entradaFiltro('pasa-bajos', 'chebyshev', 'T', 5, 300e6, { ripple: 2 }),
    esperado: { orden: 5, avisos: [], marcados: {} },
    referencia: 'spec §5.6 y §7.10',
  },
  {
    clase: 'comportamiento',
    id: 'C8: pasa banda angosto de 144 a 148 MHz marca casi todos sus valores',
    // Cuentas a mano con los umbrales de §5.6 a f2 = 148 MHz: L1 de 1,494 nH (200 %), C1 de 795,8 pF
    // (por encima de su autorresonancia de 106,6 MHz) y C2 de 0,2987 pF (167 %) son impracticables;
    // L2 de 3979 nH no se marca.
    entradas: entradaBanda('pasa-banda', 'butterworth', 'π', 3, { f1: 144e6, f2: 148e6 }),
    esperado: {
      orden: 3,
      avisos: [],
      marcados: {
        L1: 'impracticable',
        C1: 'impracticable',
        C2: 'impracticable',
        L3: 'impracticable',
        C3: 'impracticable',
      },
    },
    referencia: 'research/sintesis-filtros-lc.md, §6 y §7 (C8); spec §5.6 y §7.10',
  },
  {
    clase: 'comportamiento',
    id: 'Rechaza banda angosto de 144 a 148 MHz: Valor impracticable, evaluado en f2',
    // C1 de 0,5974 pF (84 %), L2 de 2,987 nH (100 %) y C2 de 397,9 pF (por encima de su
    // autorresonancia de 150,8 MHz, que a 148 MHz da 2600 %) son impracticables; L1 de 1,989 µH no.
    entradas: entradaBanda('rechaza-banda', 'butterworth', 'π', 3, { f1: 144e6, f2: 148e6 }),
    esperado: {
      orden: 3,
      avisos: [],
      marcados: {
        C1: 'impracticable',
        L2: 'impracticable',
        C2: 'impracticable',
        C3: 'impracticable',
      },
    },
    referencia: 'spec §5.6 y §7.10',
  },
  {
    clase: 'comportamiento',
    id: 'Con f0 y BW avisa que f0 es la central geométrica',
    entradas: entradaBanda('pasa-banda', 'butterworth', 'π', 3, { f0: F0_FM, bw: 20e6 }),
    esperado: { orden: 3, avisos: ['f0-geometrica'] },
    referencia: 'spec §7.1',
  },
  {
    clase: 'comportamiento',
    id: 'Con f1 y f2 no hay aviso de f0',
    entradas: entradaBanda('rechaza-banda', 'butterworth', 'T', 3, BANDA_FM),
    esperado: { orden: 3, avisos: [] },
    referencia: 'spec §7.1',
  },
  {
    clase: 'comportamiento',
    id: 'Chebyshev 0,5 dB pasa banda de Orden 4 sube a 5 y avisa',
    entradas: entradaBanda('pasa-banda', 'chebyshev', 'π', 4, BANDA_FM, { ripple: 0.5 }),
    esperado: { orden: 5, avisos: ['chebyshev-par'] },
    referencia: 'spec §7.3 y §7.10',
  },
  {
    clase: 'comportamiento',
    id: 'f2 menor que f1 es entrada inválida',
    entradas: entradaBanda('pasa-banda', 'butterworth', 'π', 3, { f1: 108e6, f2: 88e6 }),
    esperado: { corte: 'entrada-invalida' },
    referencia: 'spec §7.1',
  },
  {
    clase: 'comportamiento',
    id: 'BW igual a cero es entrada inválida',
    entradas: entradaBanda('rechaza-banda', 'butterworth', 'π', 3, { f0: 98e6, bw: 0 }),
    esperado: { corte: 'entrada-invalida' },
    referencia: 'spec §7.1',
  },
  {
    clase: 'comportamiento',
    id: 'Ripple de 0 dB es entrada inválida',
    entradas: entradaFiltro('pasa-bajos', 'chebyshev', 'π', 5, 100e6, { ripple: 0 }),
    esperado: { corte: 'entrada-invalida' },
    referencia: 'spec §7.1',
  },
  {
    clase: 'comportamiento',
    id: 'Orden 11 ingresado es entrada inválida',
    entradas: entradaFiltro('pasa-bajos', 'butterworth', 'π', 11, 100e6),
    esperado: { corte: 'entrada-invalida' },
    referencia: 'spec §7.1',
  },
  {
    clase: 'comportamiento',
    id: 'Orden calculado: Bessel 20 dB a 2·fc no tiene solución (llega a ~14 dB)',
    entradas: entradaFiltro('pasa-bajos', 'bessel', 'π', pedido(20, 200e6), 100e6),
    esperado: { corte: 'bessel-sin-solucion' },
    referencia: 'spec §7.6 y §7.10; research/sintesis-filtros-lc.md, §4 (O7)',
  },
  {
    clase: 'comportamiento',
    id: 'Orden calculado: Butterworth 100 dB a 1,2·fc pide más de 10 y no se calcula',
    entradas: entradaFiltro('pasa-bajos', 'butterworth', 'π', pedido(100, 120e6), 100e6),
    esperado: { corte: 'orden-excedido' },
    referencia: 'spec §7.6 y §7.10',
  },
  {
    clase: 'comportamiento',
    id: 'Orden calculado: Chebyshev que sale en 10 pasa a 11 y no se calcula',
    // 0,5 dB y Ωs = 1,3: n = 9 da 44,0 dB y n = 10 da 50,5 dB, así que 48 dB sale con n = 10, que
    // es par y con Rs = RL pasa al 11.
    entradas: entradaFiltro('pasa-bajos', 'chebyshev', 'π', pedido(48, 130e6), 100e6, {
      ripple: 0.5,
    }),
    esperado: { corte: 'orden-excedido' },
    referencia: 'spec §7.3 y §7.6',
  },
  {
    clase: 'comportamiento',
    id: 'Orden calculado: fs dentro de la banda pasante (pasa bajos) no tiene solución',
    entradas: entradaFiltro('pasa-bajos', 'butterworth', 'π', pedido(40, 80e6), 100e6),
    esperado: { corte: 'banda-pasante' },
    referencia: 'spec §7.6 y §7.10',
  },
  {
    clase: 'comportamiento',
    id: 'Orden calculado: fs igual a fc (Ωs = 1) tampoco tiene solución',
    entradas: entradaFiltro('pasa-altos', 'chebyshev', 'T', pedido(40, 50e6), 50e6, { ripple: 0.5 }),
    esperado: { corte: 'banda-pasante' },
    referencia: 'spec §7.6',
  },
  {
    clase: 'comportamiento',
    id: 'Orden calculado: fs dentro de la banda pasante de un pasa banda no tiene solución',
    entradas: entradaBanda('pasa-banda', 'butterworth', 'π', pedido(30, 95e6), BANDA_FM),
    esperado: { corte: 'banda-pasante' },
    referencia: 'spec §7.6 y §7.10',
  },
  {
    clase: 'comportamiento',
    id: 'Orden calculado: fs fuera de la banda rechazada de un rechaza banda no tiene solución',
    entradas: entradaBanda('rechaza-banda', 'butterworth', 'π', pedido(30, 70e6), BANDA_FM),
    esperado: { corte: 'banda-pasante' },
    referencia: 'spec §7.6 y §7.10',
  },
  {
    clase: 'comportamiento',
    id: 'Orden calculado: Chebyshev sale directamente impar, sin el aviso de Orden par',
    entradas: entradaFiltro('pasa-bajos', 'chebyshev', 'π', pedido(40, 200e6), 100e6, {
      ripple: 0.1,
    }),
    esperado: { orden: 7, avisos: [] },
    referencia: 'spec §7.3 y §7.6',
  },
  {
    clase: 'comportamiento',
    id: 'Orden calculado: con f0 y BW sigue el aviso de la central geométrica',
    entradas: entradaBanda('pasa-banda', 'butterworth', 'π', pedido(30, 70e6), {
      f0: F0_FM,
      bw: 20e6,
    }),
    esperado: { orden: 3, avisos: ['f0-geometrica'] },
    referencia: 'spec §7.1 y §7.6',
  },
  {
    clase: 'comportamiento',
    id: 'Orden calculado: rechaza banda con fs en la central (atenuación infinita) da Orden 1',
    entradas: entradaBanda('rechaza-banda', 'butterworth', 'T', pedido(60, F0_FM), BANDA_FM),
    esperado: { orden: 1, avisos: [] },
    referencia: 'spec §7.6 (Ωs infinito en el modelo ideal)',
  },
  {
    clase: 'comportamiento',
    id: 'Orden calculado: atenuación pedida menor que el ripple da Orden 1',
    entradas: entradaFiltro('pasa-bajos', 'chebyshev', 'π', pedido(0.2, 200e6), 100e6, {
      ripple: 0.5,
    }),
    esperado: { orden: 1, avisos: [] },
    referencia: 'spec §7.6',
  },
  {
    clase: 'comportamiento',
    id: 'Orden calculado: una atenuación de 0 dB o negativa es entrada inválida',
    entradas: entradaFiltro('pasa-bajos', 'butterworth', 'π', pedido(0, 200e6), 100e6),
    esperado: { corte: 'entrada-invalida' },
    referencia: 'spec §7.1',
  },
];

// La Topología por defecto: la que usa menos bobinas, y π cuando usan las mismas (spec §7.1 y
// §12.2).
export const CASOS_TOPOLOGIA: readonly {
  tipo: TipoFiltro;
  aproximacion: Aproximacion;
  orden: number;
  sugerida: TopologiaFiltro;
}[] = [
  { tipo: 'pasa-bajos', aproximacion: 'butterworth', orden: 5, sugerida: 'π' },
  { tipo: 'pasa-altos', aproximacion: 'butterworth', orden: 5, sugerida: 'T' },
  { tipo: 'pasa-bajos', aproximacion: 'butterworth', orden: 4, sugerida: 'π' },
  { tipo: 'pasa-altos', aproximacion: 'butterworth', orden: 4, sugerida: 'π' },
  // Chebyshev de Orden par sube al impar: la sugerencia es la del impar.
  { tipo: 'pasa-altos', aproximacion: 'chebyshev', orden: 4, sugerida: 'T' },
  { tipo: 'pasa-bajos', aproximacion: 'butterworth', orden: 1, sugerida: 'π' },
  { tipo: 'pasa-altos', aproximacion: 'butterworth', orden: 1, sugerida: 'T' },
];

// --- Orden calculado desde una atenuación (spec §7.6) --------------------------------------------

// El ejemplo de Matthaei Sec. 8.04: Chebyshev de 1 dB, pasa banda de 2 a 4 kHz, al menos 50 dB a
// 1,5 kHz. El libro lee las atenuaciones de un gráfico, no de una tabla.
export interface CasoReferenciaOrden {
  clase: 'referencia';
  id: string;
  entradas: Extract<EntradaFiltro, { banda: BandaEntrada }>;
  // Ωs y el n sin redondear, como los imprime el libro.
  omegaS: string;
  nExacto: string;
  // La atenuación del prototipo en Ωs con n = 5 y con n = 6, leída de su gráfico.
  atenuaciones: readonly { n: number; impreso: string }[];
  tolerancia: Extract<Tolerancia, { tipo: 'absoluta' }>;
  referencia: string;
}

export const TOLERANCIA_GRAFICO: Extract<Tolerancia, { tipo: 'absoluta' }> = {
  tipo: 'absoluta',
  valor: 0.5,
  motivo:
    'Matthaei lee las atenuaciones de un gráfico, no las calcula: ±0,5 dB por la lectura (spec §13.3).',
};

export const CASOS_REFERENCIA_ORDEN: readonly CasoReferenciaOrden[] = [
  {
    clase: 'referencia',
    id: 'Matthaei 8.04: Chebyshev 1 dB pasa banda de 2 a 4 kHz, 50 dB a 1,5 kHz',
    entradas: entradaBanda(
      'pasa-banda',
      'chebyshev',
      'π',
      pedido(50, 1.5e3),
      { f1: 2e3, f2: 4e3 },
      { ripple: 1 },
    ),
    omegaS: '1,917',
    nExacto: '5,622',
    atenuaciones: [
      { n: 5, impreso: '43' },
      { n: 6, impreso: '54,5' },
    ],
    tolerancia: TOLERANCIA_GRAFICO,
    referencia: `${MATTHAEI}, Sec. 8.04 y ec. 8.04-1; research/sintesis-filtros-lc.md, §4 y §7 (O4)`,
  },
];

// El Orden calculado y la red real: el n que da el Asistente, la atenuación que informa y la que da
// el oráculo ABCD con la escalera armada, en fs. El n anterior (el impar anterior en Chebyshev) no
// llega a As, así que es el mínimo.
export interface CasoVerificacionOrden {
  clase: 'verificacion';
  id: string;
  entradas: EntradaFiltro;
  // El Orden calculado, escrito a mano con las cuentas de la investigación.
  ordenEsperado: number;
  oraculo: string;
  referencia: string;
}

const ordenVerificado = (
  id: string,
  entradas: EntradaFiltro,
  ordenEsperado: number,
  referencia = INVESTIGACION,
): CasoVerificacionOrden => ({
  clase: 'verificacion',
  id,
  entradas,
  ordenEsperado,
  oraculo: ORACULO,
  referencia,
});

export const TOLERANCIA_ORDEN_DB: Extract<Tolerancia, { tipo: 'absoluta' }> = {
  tipo: 'absoluta',
  valor: 0.01,
  motivo: 'La atenuación del prototipo contra la de la red simulada: ±0,01 dB (spec §13.2).',
};

// Bessel se guarda con 4 cifras (g y factor ω3dB): la red se aparta del polinomio por ~1e-3 dB.
export const TOLERANCIA_ORDEN_BESSEL_DB: Extract<Tolerancia, { tipo: 'absoluta' }> = {
  tipo: 'absoluta',
  valor: 0.02,
  motivo:
    'Los g y el factor ω3dB de la tabla de Bessel tienen 4 cifras: la red se aparta del polinomio ' +
    'unas milésimas de dB, y más cuanto más atenúa.',
};

const CUENTAS = 'spec §7.6, con las cuentas hechas a mano; research/sintesis-filtros-lc.md, §4';

export const CASOS_VERIFICACION_ORDEN: readonly CasoVerificacionOrden[] = [
  ordenVerificado(
    'O1: Butterworth pasa bajos, 40 dB a 2·fc, fc = 100 MHz',
    entradaFiltro('pasa-bajos', 'butterworth', 'π', pedido(40, 200e6), 100e6),
    7,
  ),
  ordenVerificado(
    'O2: Chebyshev 0,5 dB pasa bajos, 40 dB a 2·fc, fc = 100 MHz',
    entradaFiltro('pasa-bajos', 'chebyshev', 'π', pedido(40, 200e6), 100e6, { ripple: 0.5 }),
    5,
  ),
  ordenVerificado(
    'O3: Chebyshev 0,1 dB pasa bajos, 40 dB a 2·fc: sale 6 y pasa a 7',
    entradaFiltro('pasa-bajos', 'chebyshev', 'T', pedido(40, 200e6), 100e6, { ripple: 0.1 }),
    7,
  ),
  ordenVerificado(
    'O4: Chebyshev 1 dB pasa banda de 2 a 4 kHz, 50 dB a 1,5 kHz: sale 6 y pasa a 7',
    entradaBanda(
      'pasa-banda',
      'chebyshev',
      'π',
      pedido(50, 1.5e3),
      { f1: 2e3, f2: 4e3 },
      { ripple: 1 },
    ),
    7,
  ),
  ordenVerificado(
    'O5: Butterworth pasa banda de 88 a 108 MHz, 30 dB a 70 MHz',
    entradaBanda('pasa-banda', 'butterworth', 'π', pedido(30, 70e6), BANDA_FM),
    3,
  ),
  ordenVerificado(
    'O6: Bessel pasa bajos, 30 dB a 4·fc, fc = 100 MHz',
    entradaFiltro('pasa-bajos', 'bessel', 'π', pedido(30, 400e6), 100e6),
    4,
  ),
  ordenVerificado(
    'O8: Butterworth pasa altos, 30 dB a fc/2, fc = 50 MHz',
    entradaFiltro('pasa-altos', 'butterworth', 'T', pedido(30, 25e6), 50e6),
    5,
    CUENTAS,
  ),
  ordenVerificado(
    'O9: Chebyshev 0,5 dB pasa altos, 40 dB a 30 MHz, fc = 50 MHz: sale 6 y pasa a 7',
    entradaFiltro('pasa-altos', 'chebyshev', 'π', pedido(40, 30e6), 50e6, { ripple: 0.5 }),
    7,
    CUENTAS,
  ),
  ordenVerificado(
    'O10: Butterworth rechaza banda de 88 a 108 MHz, 30 dB a 92 MHz',
    entradaBanda('rechaza-banda', 'butterworth', 'T', pedido(30, 92e6), BANDA_FM),
    7,
    CUENTAS,
  ),
  ordenVerificado(
    'O11: Bessel pasa banda de 88 a 108 MHz, 20 dB a 70 MHz',
    entradaBanda('pasa-banda', 'bessel', 'T', pedido(20, 70e6), BANDA_FM),
    // Ωs = 3,289: Bessel de n = 3 da ~20,9 dB (tabla de la investigación, Ωs = 3).
    3,
    CUENTAS,
  ),
];
