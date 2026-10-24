import type {
  CodigoAviso,
  CodigoCorte,
  EntradaAtenuador,
} from '../../../src/calculo/atenuadores/atenuadores';
import {
  type ClaseCaso,
  type DiferenciaEsperada,
  MEDIA_UNIDAD,
  type Tolerancia,
} from '../../casos';

// Casos de prueba de la Calculadora de atenuadores (spec §13.3). Los valores salen de
// research/contraste-atenuadores.md, sección 4.2.

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
// derivación. Faltan 7 de las 13 filas: la investigación transcribió solo esta selección.
export const CASOS_REFERENCIA: readonly CasoReferenciaT[] = [
  fig8(5000, 2000, 10, '3889', '222', '2222'),
  fig8(5000, 500, 20, '4782', '190,7', '319,4'),
  fig8(2000, 200, 20, '1913', '76,3', '127,8'),
  fig8(500, 200, 15, '416,5', '96,9', '116,1'),
  fig8(500, 50, 20, '478,2', '19,07', '31,94'),
  fig8(200, 50, 15, '176,3', '16,54', '36,73'),
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
    { avisos: ['mas-de-40'] },
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
  comportamiento(
    'Apenas arriba de A_min de 50 a 75 Ω se calcula',
    { atenuacion: 5.72, z1: 50, z2: 75 },
    { avisos: [] },
  ),
  comportamiento(
    'Menos de 0,5 dB',
    { atenuacion: 0.3, z1: 50, z2: 50 },
    { avisos: ['menos-de-medio-db'] },
  ),
  comportamiento('0,5 dB no avisa', { atenuacion: 0.5, z1: 50, z2: 50 }, { avisos: [] }),
  comportamiento('Más de 40 dB', { atenuacion: 45, z1: 50, z2: 75 }, { avisos: ['mas-de-40'] }),
  comportamiento('40 dB no avisa', { atenuacion: 40, z1: 50, z2: 50 }, { avisos: [] }),
];
