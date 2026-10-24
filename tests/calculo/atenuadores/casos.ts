import type {
  CodigoAviso,
  CodigoCorte,
  EntradaAtenuador,
} from '../../../src/calculo/atenuadores/atenuadores';
import type { Nivel } from '../../../src/calculo/comun/valor-impracticable';
import {
  type ClaseCaso,
  type DiferenciaEsperada,
  MEDIA_UNIDAD,
  type Tolerancia,
} from '../../casos';

// Casos de prueba de la Calculadora de atenuadores (spec §13.3). Los de referencia están
// transcriptos de la pág. 262 del libro; research/contraste-atenuadores.md, sección 4.2, los
// contrasta.

const FIG_8 = 'Reference Data for Radio Engineers, 4.ª ed. (ITT, 1956), cap. 9, Fig. 8, pág. 262';
const SPEC_LIMITES = 'spec §10.5';

interface CasoBase {
  clase: ClaseCaso;
  // Corto y único: lo usan el nombre del test y el Informe de casos.
  id: string;
  entradas: EntradaAtenuador;
  // Con edición y página.
  referencia: string;
}

// Un pad T de la tabla, con los valores tal como están impresos.
export interface CasoReferenciaT extends CasoBase {
  clase: 'referencia';
  esperado: { r1: string; r2: string; r3: string };
  tolerancia: Tolerancia;
  // Solo si la tabla usó otra aproximación (spec §13.2).
  diferencia?: DiferenciaEsperada;
}

export interface CasoComportamiento extends CasoBase {
  clase: 'comportamiento';
  // Un corte, o la lista completa de avisos con que sí se calcula.
  esperado: { corte: CodigoCorte } | { avisos: readonly CodigoAviso[] };
}

const fig8 = (
  z1: number,
  z2: number,
  atenuacion: number,
  r1: string,
  r2: string,
  r3: string,
): CasoReferenciaT => ({
  clase: 'referencia',
  id: `Fig. 8: ${z1} → ${z2} Ω, ${atenuacion} dB`,
  entradas: { atenuacion, z1, z2 },
  esperado: { r1, r2, r3 },
  tolerancia: MEDIA_UNIDAD,
  referencia: FIG_8,
});

// Pads T entre impedancias distintas: R1 en serie del lado de Z1, R2 del lado de Z2, R3 en
// derivación. Las 13 filas, en el orden del libro y con las cifras impresas (el libro separa los
// miles con coma: "3,889" es 3889).
export const CASOS_REFERENCIA: readonly CasoReferenciaT[] = [
  fig8(5000, 2000, 10, '3889', '222', '2222'),
  fig8(5000, 2000, 15, '4165', '969', '1161'),
  fig8(5000, 2000, 20, '4462', '1402', '639'),
  fig8(5000, 500, 20, '4782', '190,7', '319,4'),
  fig8(2000, 500, 15, '1763', '165,4', '367,3'),
  fig8(2000, 500, 20, '1838', '308,1', '202,0'),
  fig8(2000, 200, 20, '1913', '76,3', '127,8'),
  fig8(500, 200, 10, '388,9', '22,2', '222,2'),
  fig8(500, 200, 15, '416,5', '96,9', '116,1'),
  fig8(500, 200, 20, '446,2', '140,2', '63,9'),
  fig8(500, 50, 20, '478,2', '19,07', '31,94'),
  fig8(200, 50, 15, '176,3', '16,54', '36,73'),
  fig8(200, 50, 20, '183,8', '30,81', '20,20'),
];

const comportamiento = (
  id: string,
  entradas: EntradaAtenuador,
  esperado: CasoComportamiento['esperado'],
): CasoComportamiento => ({
  clase: 'comportamiento',
  id,
  entradas,
  esperado,
  referencia: SPEC_LIMITES,
});

export const CASOS_COMPORTAMIENTO: readonly CasoComportamiento[] = [
  comportamiento(
    'A = 0 dB es inválida',
    { atenuacion: 0, z1: 50, z2: 50 },
    { corte: 'no-positiva' },
  ),
  comportamiento(
    'A negativa es inválida',
    { atenuacion: -3, z1: 50, z2: 50 },
    { corte: 'no-positiva' },
  ),
  comportamiento(
    'Más de 60 dB no se calcula',
    { atenuacion: 60.5, z1: 50, z2: 50 },
    { corte: 'mas-de-60' },
  ),
  comportamiento(
    '60 dB se calcula, con el aviso de más de 40 dB',
    { atenuacion: 60, z1: 50, z2: 50 },
    { avisos: ['mas-de-40', 'frecuencia-por-defecto'] },
  ),
  comportamiento(
    'Debajo de A_min de 50 a 75 Ω',
    { atenuacion: 5, z1: 50, z2: 75 },
    { corte: 'debajo-de-a-min' },
  ),
  comportamiento(
    'Debajo de A_min de 300 a 50 Ω',
    { atenuacion: 10, z1: 300, z2: 50 },
    { corte: 'debajo-de-a-min' },
  ),
  {
    ...comportamiento(
      'A12: de 50 a 300 Ω, 10 dB, debajo de A_min (13,42 dB)',
      { atenuacion: 10, z1: 50, z2: 300 },
      { corte: 'debajo-de-a-min' },
    ),
    referencia: 'research/formulas-atenuadores.md, §7 (A12); spec §10.5',
  },
  comportamiento(
    'Apenas arriba de A_min de 50 a 75 Ω se calcula',
    { atenuacion: 5.72, z1: 50, z2: 75 },
    { avisos: ['frecuencia-por-defecto'] },
  ),
  comportamiento(
    'Menos de 0,5 dB',
    { atenuacion: 0.3, z1: 50, z2: 50 },
    { avisos: ['menos-de-medio-db', 'frecuencia-por-defecto'] },
  ),
  comportamiento(
    '0,5 dB no avisa',
    { atenuacion: 0.5, z1: 50, z2: 50 },
    { avisos: ['frecuencia-por-defecto'] },
  ),
  comportamiento(
    'Más de 40 dB',
    { atenuacion: 45, z1: 50, z2: 75 },
    { avisos: ['mas-de-40', 'frecuencia-por-defecto'] },
  ),
  comportamiento(
    '40 dB no avisa',
    { atenuacion: 40, z1: 50, z2: 50 },
    { avisos: ['frecuencia-por-defecto'] },
  ),
];

// El criterio común de valor impracticable sobre las resistencias (spec §5.6 y §10.5). Con la
// frecuencia vacía se revisa a 300 MHz.
export interface CasoValor extends CasoBase {
  clase: 'comportamiento';
  // El nivel de cada resistencia marcada de cada red; las que no están, sin marca.
  esperado: { t: Partial<Record<NombreR, Nivel>>; pi: Partial<Record<NombreR, Nivel>> };
}

type NombreR = 'R1' | 'R2' | 'R3';

const SPEC_VALOR = 'spec §5.6 y §10.5';

const valor = (
  id: string,
  entradas: EntradaAtenuador,
  esperado: CasoValor['esperado'],
  referencia = SPEC_VALOR,
): CasoValor => ({ clase: 'comportamiento', id, entradas, esperado, referencia });

export const CASOS_VALOR: readonly CasoValor[] = [
  // En el T de 20 dB, R3 = 10,1 Ω da ω·Ls/R = 0,42 a 150 MHz y 0,84 a 300 MHz, y las serie de
  // 40,9 Ω llegan a 0,21 a 300 MHz. En el π, la serie de 247,5 Ω da ω·Cp·R = 0,2006 a 300 MHz.
  valor(
    'T de 20 dB a 150 MHz: R3 (10 Ω) es Valor dudoso',
    { atenuacion: 20, z1: 50, z2: 50, frecuencia: 150e6 },
    { t: { R3: 'dudoso' }, pi: {} },
  ),
  valor(
    'T de 20 dB a 300 MHz: R3 (10 Ω) es Valor impracticable',
    { atenuacion: 20, z1: 50, z2: 50, frecuencia: 300e6 },
    { t: { R1: 'dudoso', R2: 'dudoso', R3: 'impracticable' }, pi: { R3: 'dudoso' } },
  ),
  valor(
    'T de 20 dB sin frecuencia: se revisa a 300 MHz',
    { atenuacion: 20, z1: 50, z2: 50 },
    { t: { R1: 'dudoso', R2: 'dudoso', R3: 'impracticable' }, pi: { R3: 'dudoso' } },
  ),
  // El π de 40 dB tampoco se salva: su serie de 2,5 kΩ da ω·Cp·R = 0,20 a 30 MHz y 0,68 a 100 MHz.
  ...[30e6, 100e6, 150e6, 300e6].map((f) =>
    valor(
      `T de 40 dB a ${f / 1e6} MHz: R3 (1 Ω) es Valor impracticable (V13)`,
      { atenuacion: 40, z1: 50, z2: 50, frecuencia: f },
      { t: { R3: 'impracticable' }, pi: { R3: f === 30e6 ? 'dudoso' : 'impracticable' } },
      `${SPEC_VALOR}; research/valor-impracticable.md, §8 (V13)`,
    ),
  ),
  valor(
    'T de 10 dB a 30 MHz: nada marcado',
    { atenuacion: 10, z1: 50, z2: 50, frecuencia: 30e6 },
    { t: {}, pi: {} },
  ),
];
