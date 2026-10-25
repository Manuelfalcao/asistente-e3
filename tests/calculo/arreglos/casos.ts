import {
  type EntradaArreglos,
  MAGNITUD,
  POR_DEFECTO,
  type ResultadoArreglos,
} from '../../../src/calculo/arreglos/arreglos';
import type { Paso } from '../../../src/calculo/comun/resultado';
import { type Inventario, inventarioVacio } from '../../../src/calculo/arreglos/inventario';
import { SERIES_E, type SerieE } from '../../../src/calculo/comun/series-e';
import { formatearErrorRelativo, formatearValor } from '../../../src/entrada/formato';
import { MEDIA_UNIDAD, type Tolerancia } from '../../casos';

// Casos de prueba de la Calculadora de Arreglos equivalentes (spec §13.3). Los valores salen de
// research/busqueda-arreglos-equivalentes.md; las series, de la tabla de décadas de Vishay.

const VISHAY =
  'IEC 60063:2015, a través de Vishay Dale, doc. 31001 (Standard Decade Values), tabla de décadas';
const OEIS =
  'OEIS A000084 (Riordan y Shannon, J. Math. Phys. 21, 1942); research/busqueda-arreglos-equivalentes.md §1';
const SPEC = 'spec §8.4 y §8.5';
const RESEARCH_TOLERANCIA = 'research/busqueda-arreglos-equivalentes.md §5, Tolerancia del arreglo';

// --- Referencia -------------------------------------------------------------------------------------

// Una serie E como está impresa, década de 1 a 10.
export interface CasoSerie {
  clase: 'referencia';
  id: string;
  serie: SerieE;
  esperado: readonly string[];
  referencia: string;
}

const serie = (s: SerieE, impresa: string): CasoSerie => ({
  clase: 'referencia',
  id: `Serie ${s} completa`,
  serie: s,
  esperado: impresa.split(' '),
  referencia: s === 'E6' ? `${VISHAY} (E6: términos alternos de E12)` : VISHAY,
});

export const CASOS_SERIES: readonly CasoSerie[] = [
  serie('E6', '1,0 1,5 2,2 3,3 4,7 6,8'),
  serie('E12', '1,0 1,2 1,5 1,8 2,2 2,7 3,3 3,9 4,7 5,6 6,8 8,2'),
  serie(
    'E24',
    '1,0 1,1 1,2 1,3 1,5 1,6 1,8 2,0 2,2 2,4 2,7 3,0 3,3 3,6 3,9 4,3 4,7 5,1 5,6 6,2 6,8 7,5 8,2 9,1',
  ),
];

// Los valores históricos de E24 que no salen de redondear 10^(i/24) a 2 cifras, con lo que daría
// la fórmula.
export const CASO_EXCEPCIONES_E24 = {
  clase: 'referencia' as const,
  id: 'E24: las 8 excepciones a la fórmula',
  esperado: [
    ['2,7', '2,6'],
    ['3,0', '2,9'],
    ['3,3', '3,2'],
    ['3,6', '3,5'],
    ['3,9', '3,8'],
    ['4,3', '4,2'],
    ['4,7', '4,6'],
    ['8,2', '8,3'],
  ] as const,
  referencia: `${VISHAY}; research/busqueda-arreglos-equivalentes.md §4`,
};

// Una mantisa de la tabla como está impresa: 4.7 es "4,7" y 3 es "3,0".
export const escribirMantisa = (x: number) => x.toFixed(1).replace('.', ',');

// La tabla guardada, escrita como la impresa.
export const serieGuardada = (s: SerieE) => SERIES_E[s].map(escribirMantisa);

// Lo que da la tabla guardada: los valores de E24 que no son 10^(i/24) redondeado a 2 cifras, con
// lo que da la fórmula.
export function excepcionesE24(): string[][] {
  const n = SERIES_E.E24.length;
  return SERIES_E.E24.flatMap((m, i) => {
    const formula = Number((10 ** (i / n)).toPrecision(2));
    return formula === m ? [] : [[escribirMantisa(m), escribirMantisa(formula)]];
  });
}

export const CASO_FORMAS = {
  clase: 'referencia' as const,
  id: 'Formas de conexión de 1 a 4 componentes',
  esperado: [1, 2, 4, 10] as const,
  referencia: OEIS,
};

// --- Verificación ---------------------------------------------------------------------------------

const BASE = { ...POR_DEFECTO };

export const ORACULO_FUERZA_BRUTA =
  'tests/oraculos/arreglos.ts: fuerza bruta sobre todas las redes de hasta 4 componentes';

export const TOLERANCIA_ORACULO: Extract<Tolerancia, { tipo: 'relativa' }> = {
  tipo: 'relativa',
  valor: 1e-9,
  motivo: 'Verificación: 1e-9 relativo, el mismo con que se agrupan los Arreglos de igual valor.',
};

export interface CasoTop10 {
  clase: 'verificacion';
  id: string;
  entrada: EntradaArreglos;
  oraculo: string;
  referencia: string;
}

const top10 = (
  componente: EntradaArreglos['componente'],
  buscado: number,
  s: SerieE,
): CasoTop10 => {
  const magnitud = MAGNITUD[componente];
  return {
    clase: 'verificacion',
    id: `Top-10 de ${formatearValor(buscado, magnitud)} con ${s}`,
    entrada: { ...BASE, componente, buscado, serie: s },
    oraculo: ORACULO_FUERZA_BRUTA,
    referencia: `spec §8.3 y §8.4; research/busqueda-arreglos-equivalentes.md §3`,
  };
};

// Con Inventario: la fuerza bruta recibe la misma lista de valores que el Inventario arma, y las
// listas de cada modo se verifican aparte (inventario.test.ts).
const top10ConInventario = (id: string, buscado: number, inventario: Inventario): CasoTop10 => ({
  clase: 'verificacion',
  id: `Top-10 de ${formatearValor(buscado, 'capacidad')} ${id}`,
  entrada: { ...BASE, componente: 'capacitor', buscado, inventario },
  oraculo: ORACULO_FUERZA_BRUTA,
  referencia: `spec §8.2, §8.3 y §8.4`,
});

const pF = (x: number) => Number(`${x}e-12`);

const vacio = inventarioVacio('capacitor');

// E12 de 1 a 100 pF sin el 47 pF ni el 39 pF.
export const SIN_47_Y_39: Inventario = {
  ...vacio,
  modo: 'exclusion',
  exclusion: { ...vacio.exclusion, min: pF(1), max: pF(100), excluidos: [pF(47), pF(39)] },
};

// Lo que tiene el Alumno, con valores que no son de la serie.
export const INCLUSION_FUERA_DE_SERIE: Inventario = {
  ...vacio,
  modo: 'inclusion',
  inclusion: [0.5, 4.3, 10, 22, 33, 56].map((x) => ({ valor: pF(x) })),
};

// 37,3 pF y 47 pF de la investigación; 66,9 Ω y 16,6 Ω son las del T de 6 dB entre 50 Ω, que
// llegan desde atenuadores.
export const CASOS_TOP10: readonly CasoTop10[] = [
  top10('capacitor', 37.3e-12, 'E12'),
  top10('capacitor', 47e-12, 'E12'),
  top10('resistencia', 66.9, 'E12'),
  top10('resistencia', 16.6, 'E6'),
  top10ConInventario('con E12 por exclusión, sin 47 pF ni 39 pF', 47e-12, SIN_47_Y_39),
  top10ConInventario('por inclusión, con 0,5 pF y 4,3 pF', 4.8e-12, INCLUSION_FUERA_DE_SERIE),
];

// La cuenta a mano de research §5: 39 pF J ∥ 8,2 pF C con todos al mínimo y todos al máximo.
//   mínimo: 39·0,95 + (8,2 − 0,25) = 37,05 + 7,95 = 45,00 pF
//   máximo: 39·1,05 + (8,2 + 0,25) = 40,95 + 8,45 = 49,40 pF
//   respecto de 47,2 pF: −2,2/47,2 = −4,661 % y +2,2/47,2 = +4,661 %, o sea ±4,7 %.
export const CASO_TOLERANCIA_47 = {
  clase: 'verificacion' as const,
  id: 'Tolerancia del arreglo de 47 pF = 39 pF J ∥ 8,2 pF C',
  entrada: { ...BASE, componente: 'capacitor', buscado: 47e-12, serie: 'E12' } as EntradaArreglos,
  conexion: '8,2 pF ∥ 39 pF',
  esperado: { minimo: '45,00', maximo: '49,40', abajo: '4,7', arriba: '4,7' },
  tolerancia: MEDIA_UNIDAD,
  oraculo: 'Cuenta a mano, en los pasos "Cuenta a mano" del caso',
  // La cuenta, escrita a mano y no con el Asistente: la ve la Cátedra en el informe.
  cuentaAMano: [
    {
      texto: '39 pF J (±5 %) y 8,2 pF C (±0,25 pF), en paralelo: se suman',
      latex: 'C = 39 + 8{,}2 = 47{,}2\\,\\mathrm{pF}',
    },
    {
      texto: 'Mínimo: los dos al mínimo',
      latex:
        'C_{\\mathrm{min}} = 39 \\cdot 0{,}95 + (8{,}2 - 0{,}25) = 37{,}05 + 7{,}95 = 45{,}00\\,\\mathrm{pF}',
    },
    {
      texto: 'Máximo: los dos al máximo',
      latex:
        'C_{\\mathrm{max}} = 39 \\cdot 1{,}05 + (8{,}2 + 0{,}25) = 40{,}95 + 8{,}45 = 49{,}40\\,\\mathrm{pF}',
    },
    {
      texto: 'Respecto de 47,2 pF',
      latex:
        '\\dfrac{45{,}00 - 47{,}2}{47{,}2} = -4{,}661\\,\\%, \\quad \\dfrac{49{,}40 - 47{,}2}{47{,}2} = +4{,}661\\,\\%',
    },
  ] as readonly Paso[],
  referencia: RESEARCH_TOLERANCIA,
};

// --- Comportamiento -------------------------------------------------------------------------------

export interface CasoComportamiento {
  clase: 'comportamiento';
  id: string;
  entrada: EntradaArreglos;
  esperado: string;
  // Lo que el caso mira del resultado, escrito para compararlo con `esperado`.
  observar: (r: ResultadoArreglos) => string;
  referencia: string;
}

const capacitor = (buscado: number, extra: Partial<EntradaArreglos> = {}): EntradaArreglos => ({
  ...BASE,
  componente: 'capacitor',
  buscado,
  ...extra,
});

// El Inventario por exclusión con el rango fijo y sin Valores excluidos, más estos extras.
const conExtras = (extras: Inventario['exclusion']['extras']): Inventario => ({
  ...vacio,
  modo: 'exclusion',
  exclusion: { ...vacio.exclusion, extras },
});

const primera = (r: ResultadoArreglos) => r.filas[0];
const rango = (r: ResultadoArreglos) => {
  const t = primera(r).tolerancia;
  return `${primera(r).conexion}: [${formatearValor(t.minimo, 'capacidad', 'paso')}; ${formatearValor(t.maximo, 'capacidad', 'paso')}]`;
};
const nivel = (r: ResultadoArreglos) => r.revision.marcados[0]?.nivel ?? 'sin marca';

export const CASOS_COMPORTAMIENTO: readonly CasoComportamiento[] = [
  {
    clase: 'comportamiento',
    id: 'Valores repetidos: 5 pF con E12',
    entrada: capacitor(5e-12),
    esperado: '10 pF serie 10 pF; usa 2 × 10 pF',
    observar: (r) => `${primera(r).conexion}; ${primera(r).repetidos}`,
    referencia: 'spec §8.2 (sin cantidades) y §8.5',
  },
  {
    clase: 'comportamiento',
    id: 'Umbral del 1 %: 37,3 pF con E12',
    entrada: capacitor(37.3e-12),
    esperado:
      'debajo del 1 %: por componentes y después por error; arriba: por error; ' +
      'la primera fila tiene 2 componentes y una con más componentes tiene menos error',
    observar: (r) => describirOrden(r, 0.01),
    referencia: SPEC,
  },
  {
    clase: 'comportamiento',
    id: 'Umbral del 0 %: 37,3 pF con E12, solo por error',
    entrada: capacitor(37.3e-12, { umbral: 0 }),
    esperado: 'ordenados por error; la primera fila tiene 3 componentes',
    observar: (r) => {
      const errores = r.filas.map((f) => Math.abs(f.error));
      const ordenados = errores.every((e, i) => i === 0 || errores[i - 1] <= e);
      return `${ordenados ? 'ordenados por error' : 'desordenados'}; la primera fila tiene ${primera(r).componentes} componentes`;
    },
    referencia: SPEC,
  },
  {
    clase: 'comportamiento',
    id: '±0,25 pF debajo de 10 pF: 2,2 pF',
    entrada: capacitor(2.2e-12),
    esperado: '2,2 pF: [1,95 pF; 2,45 pF]',
    observar: rango,
    referencia: 'spec §8.1; KEMET C1003_C0G, tabla 1A (C = ±0,25 pF)',
  },
  {
    clase: 'comportamiento',
    id: '±5 % desde 10 pF: 10 pF',
    entrada: capacitor(10e-12),
    esperado: '10 pF: [9,5 pF; 10,5 pF]',
    observar: rango,
    referencia: 'spec §8.1; KEMET C1003_C0G, tabla 1A (J = ±5 %)',
  },
  {
    clase: 'comportamiento',
    id: 'C mínima: 0,8 pF es Valor impracticable',
    entrada: capacitor(0.8e-12),
    esperado: 'impracticable',
    observar: nivel,
    referencia: 'spec §5.6 y §8.5',
  },
  {
    clase: 'comportamiento',
    id: 'C mínima: 2 pF es Valor dudoso',
    entrada: capacitor(2e-12),
    esperado: 'dudoso',
    observar: nivel,
    referencia: 'spec §5.6 y §8.5',
  },
  {
    clase: 'comportamiento',
    id: 'C mínima: 3,3 pF no se marca',
    entrada: capacitor(3.3e-12),
    esperado: 'sin marca',
    observar: nivel,
    referencia: 'spec §5.6 y §8.5',
  },
  {
    clase: 'comportamiento',
    id: 'Resistencia sin frecuencia: 1 Ω no se marca',
    entrada: { ...BASE, componente: 'resistencia', buscado: 1 },
    esperado: 'sin marca',
    observar: nivel,
    referencia: 'spec §5.6: Arreglos equivalentes no pide frecuencia, solo aplica la C mínima',
  },
  {
    clase: 'comportamiento',
    id: 'Nota de VHF: 37,3 pF con E12',
    entrada: capacitor(37.3e-12),
    esperado: 'con nota todas las filas de 3 o 4 componentes y ninguna de 1 o 2',
    observar: (r) => {
      const bien = r.filas.every((f) => (f.nota !== null) === f.componentes >= 3);
      return bien
        ? 'con nota todas las filas de 3 o 4 componentes y ninguna de 1 o 2'
        : r.filas.map((f) => `${f.componentes}: ${f.nota ? 'nota' : '—'}`).join(', ');
    },
    referencia: 'spec §8.5',
  },
  {
    clase: 'comportamiento',
    id: 'Inventario por exclusión: 47 pF sin el 47 pF ni el 39 pF',
    entrada: capacitor(47e-12, { inventario: SIN_47_Y_39 }),
    esperado: '10 pF ∥ 10 pF ∥ 27 pF; ninguna fila usa un Valor excluido',
    observar: (r) => {
      const usaExcluido = r.filas.some((f) => /(^|[ (])(47|39) pF/.test(f.conexion));
      return `${primera(r).conexion}; ${usaExcluido ? 'usa un Valor excluido' : 'ninguna fila usa un Valor excluido'}`;
    },
    referencia: 'spec §8.2 (Valores excluidos)',
  },
  {
    clase: 'comportamiento',
    id: 'Inventario por exclusión: valor extra fuera de la serie, 4,3 pF',
    entrada: capacitor(4.3e-12, { inventario: conExtras([{ valor: pF(4.3) }]) }),
    esperado: '4,3 pF: [4,05 pF; 4,55 pF]; 1 componente',
    observar: (r) => `${rango(r)}; ${primera(r).componentes} componente`,
    referencia: 'spec §8.2 (valores extra); tolerancia por defecto de spec §8.1',
  },
  {
    clase: 'comportamiento',
    id: 'Inventario por exclusión: tolerancia propia solo en el valor extra',
    entrada: capacitor(4.3e-12, {
      inventario: conExtras([{ valor: pF(4.3), tolerancia: { tipo: 'relativa', fraccion: 0.01 } }]),
    }),
    esperado: '4,3 pF: [4,257 pF; 4,343 pF]',
    observar: rango,
    referencia: 'spec §8.2 (tolerancia por valor): 4,3 · 0,99 = 4,257 y 4,3 · 1,01 = 4,343',
  },
  {
    clase: 'comportamiento',
    id: 'Inventario por exclusión: los valores de la serie conservan la tolerancia por defecto',
    entrada: capacitor(3.3e-12, {
      inventario: conExtras([{ valor: pF(4.3), tolerancia: { tipo: 'relativa', fraccion: 0.01 } }]),
    }),
    esperado: '3,3 pF: [3,05 pF; 3,55 pF]',
    observar: rango,
    referencia:
      'spec §8.2: en el resto del modo exclusión vale la tolerancia por defecto (±0,25 pF)',
  },
  {
    clase: 'comportamiento',
    id: 'Inventario por inclusión: 4,8 pF con 0,5 pF, 4,3 pF y otros fuera de la serie',
    entrada: capacitor(4.8e-12, { inventario: INCLUSION_FUERA_DE_SERIE }),
    esperado: '0,5 pF ∥ 4,3 pF; Error del arreglo 0 %',
    observar: (r) =>
      `${primera(r).conexion}; Error del arreglo ${formatearErrorRelativo(primera(r).error * 100)}`,
    referencia: 'spec §8.2 (por inclusión): 0,5 + 4,3 = 4,8 pF en paralelo',
  },
  {
    clase: 'comportamiento',
    id: 'Tolerancia por valor: 32 pF con 22 pF ±1 % y 10 pF ±0,1 pF',
    entrada: capacitor(32e-12, {
      inventario: {
        ...vacio,
        modo: 'inclusion',
        inclusion: [
          { valor: pF(22), tolerancia: { tipo: 'relativa', fraccion: 0.01 } },
          { valor: pF(10), tolerancia: { tipo: 'absoluta', valor: pF(0.1) } },
        ],
      },
    }),
    esperado: '10 pF ∥ 22 pF: [31,68 pF; 32,32 pF]',
    observar: rango,
    referencia:
      'spec §8.2 y §8.5: mínimo 22 · 0,99 + (10 − 0,1) = 21,78 + 9,90 = 31,68 pF; ' +
      'máximo 22 · 1,01 + (10 + 0,1) = 22,22 + 10,10 = 32,32 pF',
  },
  {
    clase: 'comportamiento',
    id: 'Sin cantidades: 5 pF con un solo valor de 10 pF en el Inventario',
    entrada: capacitor(5e-12, {
      inventario: { ...vacio, modo: 'inclusion', inclusion: [{ valor: pF(10) }] },
    }),
    esperado: '10 pF serie 10 pF; usa 2 × 10 pF',
    observar: (r) => `${primera(r).conexion}; ${primera(r).repetidos}`,
    referencia: 'spec §8.2: el Inventario no guarda cantidades, un valor se repite en el Arreglo',
  },
  {
    clase: 'comportamiento',
    id: 'Inventario sin valores: no hay Arreglos',
    entrada: capacitor(47e-12, { inventario: { ...vacio, modo: 'inclusion' } }),
    esperado: '0 filas',
    observar: (r) => `${r.filas.length} filas`,
    referencia: 'spec §8.2',
  },
];

// Qué regla de orden se ve en las filas: debajo del umbral por componentes y error, arriba por error.
function describirOrden(r: ResultadoArreglos, umbral: number): string {
  const debajo = r.filas.filter((f) => Math.abs(f.error) < umbral);
  const arriba = r.filas.filter((f) => Math.abs(f.error) >= umbral);
  const juntas = r.filas.every((f, i) => i < debajo.length === Math.abs(f.error) < umbral);
  const porComponentes = debajo.every(
    (f, i) =>
      i === 0 ||
      debajo[i - 1].componentes < f.componentes ||
      (debajo[i - 1].componentes === f.componentes &&
        Math.abs(debajo[i - 1].error) <= Math.abs(f.error)),
  );
  const porError = arriba.every(
    (f, i) => i === 0 || Math.abs(arriba[i - 1].error) <= Math.abs(f.error),
  );
  const primera = r.filas[0];
  const masMejor = r.filas.some(
    (f) => f.componentes > primera.componentes && Math.abs(f.error) < Math.abs(primera.error),
  );
  return [
    juntas && porComponentes
      ? 'debajo del 1 %: por componentes y después por error'
      : 'debajo: desordenado',
    porError ? 'arriba: por error' : 'arriba: desordenado',
    `la primera fila tiene ${primera.componentes} componentes` +
      (masMejor ? ' y una con más componentes tiene menos error' : ''),
  ].join('; ');
}
