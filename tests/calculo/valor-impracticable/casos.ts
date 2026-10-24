import type { Componente, Nivel, Umbrales } from '../../../src/calculo/comun/valor-impracticable';
import type { Tolerancia } from '../../casos';

// Casos de prueba del criterio común de valor impracticable (spec §13.3, Común): la tabla de
// umbrales que resultan de §5.6, recalculada desde la medida, y un caso a cada lado de cada corte.

const TABLA = 'spec §5.6, tabla de umbrales que resultan (ticket 20)';
const ORACULO =
  'La tabla de §5.6, calculada aparte en la investigación (research/valor-impracticable.md, §2.4, ' +
  '§4.2 y §5.3) y en el ticket 20.';

export type Corte = keyof Umbrales;

export interface CasoUmbral {
  clase: 'verificacion';
  id: string;
  corte: Corte;
  nivel: Nivel;
  // Hz; null en los mínimos fijos.
  frecuencia: number | null;
  // Como está impreso en la tabla, en `unidad`: "1675", "2,5".
  esperado: string;
  unidad: { nombre: string; escala: number };
  tolerancia: Tolerancia;
  oraculo: string;
  referencia: string;
}

// La tabla está redondeada: media unidad de la última cifra significativa impresa ("490" va con
// ±5, "1675" con ±0,5 y "2,5" con ±0,05).
function mediaUnidadSignificativa(impreso: string): Tolerancia {
  const [entera, decimales] = impreso.split(',');
  const valor = decimales
    ? 0.5 * 10 ** -decimales.length
    : 0.5 * 10 ** (entera.length - entera.replace(/0+$/, '').length);
  return {
    tipo: 'absoluta',
    valor,
    motivo: 'Tabla redondeada: media unidad de la última cifra significativa impresa.',
  };
}

const UNIDADES = {
  nH: { nombre: 'nH', escala: 1e-9 },
  pF: { nombre: 'pF', escala: 1e-12 },
  Ω: { nombre: 'Ω', escala: 1 },
  kΩ: { nombre: 'kΩ', escala: 1e3 },
};

const NOMBRE_CORTE: Record<Corte, string> = {
  lMin: 'L mínima',
  cMin: 'C mínima',
  cMax: 'C máxima',
  rMin: 'R mínima',
  rMax: 'R máxima',
};

// Cada valor como está impreso, con su unidad: "1675 pF", "2,5 kΩ".
const umbral = (
  corte: Corte,
  frecuencia: number | null,
  dudoso: string,
  impracticable: string,
): CasoUmbral[] =>
  (['dudoso', 'impracticable'] as const).map((nivel) => {
    const impreso = nivel === 'dudoso' ? dudoso : impracticable;
    const [esperado, unidad] = impreso.split(' ') as [string, keyof typeof UNIDADES];
    const a = frecuencia === null ? '' : ` a ${frecuencia / 1e6} MHz`;
    return {
      clase: 'verificacion',
      id: `${NOMBRE_CORTE[corte]}${a}, Valor ${nivel}: ${impreso}`,
      corte,
      nivel,
      frecuencia,
      esperado,
      unidad: UNIDADES[unidad],
      tolerancia: mediaUnidadSignificativa(esperado),
      oraculo: ORACULO,
      referencia: TABLA,
    };
  });

const MHZ = 1e6;

export const CASOS_UMBRALES: readonly CasoUmbral[] = [
  ...umbral('lMin', null, '15 nH', '6 nH'),
  ...umbral('cMin', null, '2,5 pF', '1 pF'),
  ...umbral('cMax', 30 * MHZ, '1675 pF', '3350 pF'),
  ...umbral('cMax', 100 * MHZ, '151 pF', '302 pF'),
  ...umbral('cMax', 150 * MHZ, '67 pF', '134 pF'),
  ...umbral('cMax', 300 * MHZ, '17 pF', '34 pF'),
  ...umbral('rMin', 30 * MHZ, '4,2 Ω', '1,7 Ω'),
  ...umbral('rMax', 30 * MHZ, '2,5 kΩ', '6,2 kΩ'),
  ...umbral('rMin', 100 * MHZ, '14 Ω', '5,7 Ω'),
  ...umbral('rMax', 100 * MHZ, '740 Ω', '1,85 kΩ'),
  ...umbral('rMin', 150 * MHZ, '21 Ω', '8,5 Ω'),
  ...umbral('rMax', 150 * MHZ, '490 Ω', '1,2 kΩ'),
  ...umbral('rMin', 300 * MHZ, '42 Ω', '17 Ω'),
  ...umbral('rMax', 300 * MHZ, '250 Ω', '620 Ω'),
];

// Un valor apenas de cada lado de un corte de la tabla, con el nivel que le toca.
export interface CasoCorte {
  clase: 'verificacion';
  id: string;
  componente: Componente;
  frecuencia: number | null;
  esperado: Nivel | null;
  oraculo: string;
  referencia: string;
}

// 3 % de cada lado: más que el redondeo de la tabla (el peor, 250 Ω contra 246,7 Ω, es 1,3 %).
const LADO = 0.03;

const COMPONENTE_DEL_CORTE: Record<Corte, Componente['componente']> = {
  lMin: 'L',
  cMin: 'C',
  cMax: 'C',
  rMin: 'R',
  rMax: 'R',
};

export const CASOS_CORTES: readonly CasoCorte[] = CASOS_UMBRALES.flatMap((u) => {
  const valor = Number(u.esperado.replace(',', '.')) * u.unidad.escala;
  const minimo = u.corte === 'lMin' || u.corte === 'cMin' || u.corte === 'rMin';
  const menor: Nivel | null = u.nivel === 'impracticable' ? 'dudoso' : null;
  // Del lado malo del corte toca el nivel del corte; del lado bueno, el nivel de abajo.
  const lados: [string, number, Nivel | null][] = [
    ['debajo', valor * (1 - LADO), minimo ? u.nivel : menor],
    ['encima', valor * (1 + LADO), minimo ? menor : u.nivel],
  ];
  const tipo = COMPONENTE_DEL_CORTE[u.corte];
  return lados.map(([lado, v, esperado]) => ({
    clase: 'verificacion' as const,
    id: `${u.id}, 3 % por ${lado}`,
    componente: { componente: tipo, nombre: `${tipo}1`, valor: v },
    frecuencia: u.frecuencia,
    esperado,
    oraculo: ORACULO,
    referencia: TABLA,
  }));
});
