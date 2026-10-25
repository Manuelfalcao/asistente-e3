import type {
  Aproximacion,
  CodigoAvisoFiltro,
  CodigoCorteFiltro,
  EntradaFiltro,
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

export const entradaFiltro = (
  tipo: TipoFiltro,
  aproximacion: Aproximacion,
  topologia: TopologiaFiltro,
  orden: number,
  fc: number,
  { ripple = null, rs = 50, rl = 50 }: { ripple?: number | null; rs?: number; rl?: number } = {},
): EntradaFiltro => ({
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

const rippleTexto = (r: number) => `${String(r).replace('.', ',')} dB`;

export const CASOS_REFERENCIA_G: readonly CasoReferenciaG[] = [
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

const valores = (lista: string) =>
  lista.split(' · ').map((v) => {
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
    id: 'Rs ≠ RL todavía no se calcula',
    entradas: entradaFiltro('pasa-bajos', 'butterworth', 'π', 5, 100e6, { rs: 50, rl: 75 }),
    esperado: { corte: 'terminaciones-distintas' },
    referencia: 'spec §7.4',
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
