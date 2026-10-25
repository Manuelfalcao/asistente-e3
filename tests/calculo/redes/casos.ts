import type { Filtrado } from '../../../src/calculo/comun/red-l';
import type { Nivel } from '../../../src/calculo/comun/valor-impracticable';
import type { CodigoCorte, EntradaRedL } from '../../../src/calculo/redes/redes';
import { MEDIA_UNIDAD, type Tolerancia } from '../../casos';

// Casos de prueba de la Calculadora de redes de adaptación, red L (spec §13.3). Los valores salen de
// research/redes-adaptacion.md, §5 y §8.

const BOWICK_4_1 = 'Bowick, RF Circuit Design, 1.ª ed. (Sams, 1982), cap. 4, ejemplo 4-1';
const ORACULO = 'tests/oraculos/abcd.ts (ABCD con complejos)';
const SPEC_CASOS = 'spec §9.5 y §9.7';
const Q_POR_DEFECTO = 100;

const entrada = (rs: number, rl: number, f0 = 100e6): EntradaRedL => ({
  f0,
  rs,
  rl,
  qBobina: Q_POR_DEFECTO,
});

// --- Referencia ----------------------------------------------------------------------------------

// Los valores de una variante como los imprime el libro: la L en nH y la C en pF.
export interface CasoReferencia {
  clase: 'referencia';
  id: string;
  entradas: EntradaRedL;
  variante: Filtrado;
  esperado: { l: string; c: string };
  tolerancia: Tolerancia;
  referencia: string;
}

// Bowick 4-1: de 100 Ω a 1000 Ω a 100 MHz, pasa bajos con continua. El libro imprime 477 nH y
// 4,8 pF; los exactos son 477,46 nH y 4,775 pF. Los ejemplos 4-2 y 4-3 tienen cargas complejas y
// quedan afuera.
export const CASOS_REFERENCIA: readonly CasoReferencia[] = [
  {
    clase: 'referencia',
    id: 'Bowick 4-1',
    entradas: entrada(100, 1000),
    variante: 'pasa-bajos',
    esperado: { l: '477', c: '4,8' },
    tolerancia: MEDIA_UNIDAD,
    referencia: BOWICK_4_1,
  },
];

// --- Verificación --------------------------------------------------------------------------------

export const TOLERANCIA_ORACULO: Extract<Tolerancia, { tipo: 'relativa' }> = {
  tipo: 'relativa',
  valor: 1e-9,
  motivo: 'Dos vías exactas en doble precisión: queda solo el redondeo de la aritmética.',
};

// El BW del barrido contra una segunda vía: el cruce de |Γ| = 1/√2 a la entrada, con la impedancia
// que da el oráculo ABCD. En una red sin pérdidas, |S21|² = 1 − |Γ|², así que los dos cruces son
// el mismo punto.
export interface CasoAnchoDeBanda {
  clase: 'verificacion';
  id: string;
  entradas: EntradaRedL;
  // El f₀/BW de los barridos propios de la investigación (§5), con media unidad de su cifra.
  // Solo los que imprime; null donde falta un borde.
  investigacion?: Partial<Record<Filtrado, string>>;
  oraculo: string;
  referencia: string;
}

const anchoDeBanda = (
  rs: number,
  rl: number,
  investigacion?: CasoAnchoDeBanda['investigacion'],
): CasoAnchoDeBanda => ({
  clase: 'verificacion',
  id: `BW: ${rs} → ${rl} Ω`,
  entradas: entrada(rs, rl),
  ...(investigacion && { investigacion }),
  oraculo: ORACULO,
  referencia: investigacion
    ? 'research/redes-adaptacion.md, §5 (barridos propios)'
    : 'spec §13.3 (Redes de adaptación, verificación)',
});

export const CASOS_ANCHO_DE_BANDA: readonly CasoAnchoDeBanda[] = [
  anchoDeBanda(100, 1000, { 'pasa-bajos': '1,32', 'pasa-altos': '0,94' }),
  anchoDeBanda(1000, 100),
  anchoDeBanda(50, 200),
  anchoDeBanda(200, 50),
  anchoDeBanda(50, 300),
  anchoDeBanda(12, 75),
  anchoDeBanda(50, 5000),
];

// La grilla en la que las dos variantes, armadas en el oráculo, dan |Zin − R_s|/R_s < 1e-9 en f₀.
export const GRILLA_RESISTENCIAS: readonly number[] = [5, 12, 50, 75, 100, 300, 1000, 5000];
export const GRILLA_FRECUENCIAS: readonly number[] = [3.5e6, 145e6, 433e6];

// Las frecuencias, en veces f₀, en las que el barrido común se compara contra el oráculo: los dos
// extremos del rango, f₀ y sus armónicas.
export const VECES_F0: readonly number[] = [1 / 50, 0.3, 1, 2, 3, 50];

// --- Comportamiento ------------------------------------------------------------------------------

export interface CasoComportamiento {
  clase: 'comportamiento';
  id: string;
  entradas: EntradaRedL;
  esperado:
    | { corte: CodigoCorte }
    // Qué borde falta en cada variante.
    | { sinBorde: Record<Filtrado, readonly ('inferior' | 'superior')[]> }
    // El nivel de cada componente marcado, por variante.
    | { marcados: Record<Filtrado, Record<string, Nivel>> };
  referencia: string;
}

export const CASOS_COMPORTAMIENTO: readonly CasoComportamiento[] = [
  {
    clase: 'comportamiento',
    id: 'La L pasa bajos de 50 a 200 Ω no tiene borde inferior',
    entradas: entrada(50, 200),
    // En continua el pasa bajos transfiere 4·R_s·R_L/(R_s + R_L)² = 0,64, más que la mitad.
    esperado: { sinBorde: { 'pasa-bajos': ['inferior'], 'pasa-altos': ['superior'] } },
    referencia: 'spec §9.5',
  },
  {
    clase: 'comportamiento',
    id: 'De 100 a 1000 Ω las dos variantes tienen los dos bordes',
    entradas: entrada(100, 1000),
    esperado: { sinBorde: { 'pasa-bajos': [], 'pasa-altos': [] } },
    referencia: 'spec §9.5',
  },
  {
    clase: 'comportamiento',
    id: 'R_s = R_L ya está adaptada',
    entradas: entrada(50, 50),
    esperado: { corte: 'ya-adaptada' },
    referencia: SPEC_CASOS,
  },
  {
    clase: 'comportamiento',
    id: 'R_s = 0 es entrada inválida',
    entradas: entrada(0, 50),
    esperado: { corte: 'entrada-invalida' },
    referencia: SPEC_CASOS,
  },
  {
    clase: 'comportamiento',
    id: 'R_L negativa es entrada inválida',
    entradas: entrada(50, -75),
    esperado: { corte: 'entrada-invalida' },
    referencia: SPEC_CASOS,
  },
  {
    clase: 'comportamiento',
    id: 'f₀ = 0 es entrada inválida',
    entradas: entrada(50, 200, 0),
    esperado: { corte: 'entrada-invalida' },
    referencia: SPEC_CASOS,
  },
  {
    // Q = 3: X_s = 15 Ω y X_p = 16,7 Ω. Pasa bajos: L1 = 7,96 nH (±3 nH, 38 %) y C1 = 31,8 pF,
    // cerca de su autorresonancia. Pasa altos: C1 = 35,4 pF, pasada del 50 %, y L1 = 8,84 nH.
    clase: 'comportamiento',
    id: 'De 5 a 50 Ω a 300 MHz, los valores chicos quedan marcados',
    entradas: entrada(5, 50, 300e6),
    esperado: {
      marcados: {
        'pasa-bajos': { L1: 'dudoso', C1: 'dudoso' },
        'pasa-altos': { C1: 'impracticable', L1: 'dudoso' },
      },
    },
    referencia: 'spec §5.6 y §9.6',
  },
];
