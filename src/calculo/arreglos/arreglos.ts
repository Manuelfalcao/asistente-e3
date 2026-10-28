import { formatearValor } from '../../entrada/formato';
import {
  ARREGLOS_A_MOSTRAR,
  MAXIMO_DE_COMPONENTES,
  type Operacion,
  type Red,
  buscarArreglos,
  componentesDe,
  redesPosibles,
  valorDeRed,
} from '../comun/arreglos';
import { enteroLatex, errorLatex, porcentajeLatex, valorLatex } from '../comun/latex';
import type { Paso, Referencia } from '../comun/resultado';
import type { SerieE } from '../comun/series-e';
import { type Componente, type Revision, revisarValores } from '../comun/valor-impracticable';
import {
  type DescripcionInventario,
  type Inventario,
  type MagnitudArreglo,
  type TipoComponente,
  type ToleranciaValor,
  MAGNITUD,
  describirInventario,
  valoresCargados,
} from './inventario';

// La Calculadora de Arreglos equivalentes (spec §8): los 10 mejores Arreglos serie-paralelo de hasta
// 4 componentes de Valor comercial para un capacitor o una resistencia buscada. Busca con el
// Inventario del tipo (inventario.ts) o, sin él, en la serie E completa en el rango fijo del tipo.

export {
  type DescripcionInventario,
  type MagnitudArreglo,
  type TipoComponente,
  type ToleranciaValor,
  MAGNITUD,
  RANGO_SIN_INVENTARIO,
  describirInventario,
  valoresSinInventario,
} from './inventario';

export interface EntradaArreglos {
  componente: TipoComponente;
  // En F u Ω.
  buscado: number;
  // Con Inventario por exclusión es la serie de la que se descuentan los Valores excluidos; con
  // Inventario por inclusión no se usa.
  serie: SerieE;
  // El Inventario del tipo. Sin él (o con modo 'ninguno') busca en la serie completa.
  inventario?: Inventario;
  // Fracción: 0,01 es 1 %.
  umbral: number;
  // Fracción: la de las resistencias y la de los capacitores de 10 pF o más.
  tolerancia: number;
  // En F: la de los capacitores de menos de 10 pF, que se especifican en pF absolutos.
  toleranciaChicos: number;
}

// Los valores por defecto de §8.1: E12, umbral del 5 %, J (±5 %) y C (±0,25 pF).
export const POR_DEFECTO = {
  serie: 'E12' as SerieE,
  umbral: 0.05,
  tolerancia: 0.05,
  toleranciaChicos: 0.25e-12,
};

// Debajo de este valor un capacitor C0G se especifica con tolerancia absoluta (KEMET, tabla 1A).
export const LIMITE_CHICOS = 10e-12;

export interface ValorInventario {
  valor: number;
  tolerancia: ToleranciaValor;
  // Si la tolerancia la escribió el Alumno en el Inventario y no es la de por defecto.
  propia?: boolean;
}

// Los valores con que busca la entrada, de menor a mayor, cada uno con su tolerancia: la propia del
// Inventario si la tiene y, si no, la de por defecto del tipo.
export function inventarioDeBusqueda(entrada: EntradaArreglos): ValorInventario[] {
  return valoresCargados(entrada.componente, entrada.serie, entrada.inventario).map(
    ({ valor, tolerancia }): ValorInventario =>
      tolerancia
        ? { valor, tolerancia, propia: true }
        : { valor, tolerancia: toleranciaPorDefecto(entrada, valor) },
  );
}

export const valoresDeBusqueda = (entrada: EntradaArreglos): number[] =>
  inventarioDeBusqueda(entrada).map((v) => v.valor);

export interface FilaArreglo {
  // "(27 pF serie 68 pF) || 15 pF"
  conexion: string;
  valor: number;
  // Fracción con signo: (valor − buscado)/buscado.
  error: number;
  componentes: number;
  // "usa 3 × 10 pF", o null si no se repite ningún valor.
  repetidos: string | null;
  // El peor caso: la red con todos los componentes al mínimo y con todos al máximo.
  tolerancia: { minimo: number; maximo: number };
  // El Error del arreglo y la cuenta de la Tolerancia del arreglo.
  pasos: readonly Paso[];
}

export interface ResultadoArreglos {
  componente: TipoComponente;
  buscado: Componente;
  inventario: DescripcionInventario;
  filas: readonly FilaArreglo[];
  formulas: readonly string[];
  // Los comunes a todas las filas: serie y paralelo, combinaciones evaluadas, orden y C mínima.
  pasos: readonly Paso[];
  revision: Revision;
  referencias: readonly Referencia[];
  // Las del pie: la de VHF, si alguna fila tiene 3 o 4 componentes.
  notas: readonly string[];
}

export const NOTA_VHF = 'En VHF cada componente y cada soldadura agregan L y C parásitas.';

export const REFERENCIAS_ARREGLOS: readonly Referencia[] = [
  {
    obra: 'IEC 60063, Preferred number series for resistors and capacitors',
    edicion: '3.ª',
    anio: 2015,
    ubicacion: 'valores de Vishay Dale, doc. 31001 (Standard Decade Values)',
  },
  {
    autor: 'J. Riordan, C. E. Shannon',
    obra: 'Journal of Mathematics and Physics',
    volumen: '21',
    anio: 1942,
    ubicacion: 'formas de conexión según OEIS A000084',
  },
  {
    autor: 'KEMET',
    obra: 'Surface Mount Multilayer Ceramic Chip Capacitors, C0G Dielectric (C1003_C0G)',
    anio: 2025,
    ubicacion: 'tabla 1A, tolerancias',
  },
];

// Cómo se escribe y se conecta cada tipo: su magnitud, su símbolo y qué operación es la serie (la
// otra es el paralelo).
interface Convencion {
  magnitud: MagnitudArreglo;
  simbolo: 'C' | 'R';
  serie: Operacion;
}

const CONVENCIONES: Record<TipoComponente, Convencion> = {
  capacitor: { magnitud: MAGNITUD.capacitor, simbolo: 'C', serie: 'reciproca' },
  resistencia: { magnitud: MAGNITUD.resistencia, simbolo: 'R', serie: 'suma' },
};

export function calcularArreglos(entrada: EntradaArreglos): ResultadoArreglos {
  const { componente, buscado, serie, umbral } = entrada;
  const convencion = CONVENCIONES[componente];
  const inventario = inventarioDeBusqueda(entrada);
  const valores = inventario.map((v) => v.valor);
  const busqueda = buscarArreglos(valores, buscado, { umbral });

  const filas = busqueda.arreglos.map((a): FilaArreglo => {
    const red = ordenarParaMostrar(a.red, valores);
    // Un Arreglo exacto queda con un residuo de redondeo del orden de 1e-16: es 0.
    const error = Math.abs(a.error) < 1e-12 ? 0 : a.error;
    const tolerancia = {
      minimo: valorDeRed(red, (i) => extremo(inventario[i], -1)),
      maximo: valorDeRed(red, (i) => extremo(inventario[i], +1)),
    };
    return {
      conexion: conexion(red, valores, convencion, true),
      valor: a.valor,
      error,
      componentes: a.componentes,
      repetidos: repetidos(red, valores, convencion.magnitud),
      tolerancia,
      pasos: pasosDeFila(red, a.valor, error, tolerancia, buscado, inventario, convencion),
    };
  });

  const buscadoComo: Componente = {
    componente: convencion.simbolo,
    nombre: `${convencion.simbolo} buscada`,
    valor: buscado,
  };
  // Arreglos equivalentes no pide frecuencia: solo queda la C mínima (spec §5.6).
  const revision = revisarValores({ buscado: buscadoComo }, null);
  const formulas = formulasDe(convencion);

  return {
    componente,
    buscado: buscadoComo,
    inventario: describirInventario(componente, serie, entrada.inventario),
    filas,
    formulas,
    pasos: [
      ...pasosComunes(convencion, formulas, valores.length, busqueda.evaluadas, umbral),
      ...revision.pasos,
    ],
    revision,
    referencias: REFERENCIAS_ARREGLOS,
    notas: filas.some((f) => f.componentes >= 3) ? [NOTA_VHF] : [],
  };
}

function toleranciaPorDefecto(entrada: EntradaArreglos, valor: number): ToleranciaValor {
  return entrada.componente === 'capacitor' && valor < LIMITE_CHICOS * (1 - 1e-9)
    ? { tipo: 'absoluta', valor: entrada.toleranciaChicos }
    : { tipo: 'relativa', fraccion: entrada.tolerancia };
}

const delta = ({ valor, tolerancia: t }: ValorInventario) =>
  t.tipo === 'relativa' ? valor * t.fraccion : t.valor;

// El valor al mínimo (−1) o al máximo (+1) de su tolerancia; nunca menos de 0.
const extremo = (v: ValorInventario, signo: -1 | 1) => Math.max(0, v.valor + signo * delta(v));

// --- Cómo se escribe un Arreglo ---------------------------------------------------------------------

// Primero las subredes, de más a menos componentes, y después los componentes sueltos de menor a
// mayor: "(27 pF serie 68 pF) || 15 pF", "39 pF serie 270 pF".
function ordenarParaMostrar(red: Red, valores: readonly number[]): Red {
  if (!('op' in red)) return red;
  const hijos = red.hijos.map((h) => ordenarParaMostrar(h, valores));
  const peso = (h: Red) => ('op' in h ? -componentesDe(h) : 0);
  hijos.sort((a, b) => {
    const p = peso(a) - peso(b);
    if (p !== 0) return p;
    return 'op' in a || 'op' in b ? 0 : valores[a.hoja] - valores[b.hoja];
  });
  return { op: red.op, hijos };
}

// Con "serie" y "||" y paréntesis, nunca "+": con capacitores se leería como una suma (spec §8.5).
function conexion(red: Red, valores: readonly number[], c: Convencion, raiz: boolean): string {
  if (!('op' in red)) return formatearValor(valores[red.hoja], c.magnitud);
  const union = red.op === c.serie ? ' serie ' : ' || ';
  const texto = red.hijos.map((h) => conexion(h, valores, c, false)).join(union);
  return raiz ? texto : `(${texto})`;
}

function hojasDe(red: Red): number[] {
  return 'op' in red ? red.hijos.flatMap(hojasDe) : [red.hoja];
}

// "usa 3 × 10 pF", "usa 2 × 10 pF y 2 × 22 pF".
function repetidos(red: Red, valores: readonly number[], magnitud: MagnitudArreglo): string | null {
  const cuenta = new Map<number, number>();
  for (const h of hojasDe(red)) cuenta.set(h, (cuenta.get(h) ?? 0) + 1);
  const repetidas = [...cuenta]
    .filter(([, n]) => n > 1)
    .sort(([a], [b]) => valores[a] - valores[b])
    .map(([h, n]) => `${n} × ${formatearValor(valores[h], magnitud)}`);
  return repetidas.length ? `usa ${repetidas.join(' y ')}` : null;
}

// --- Fórmulas y pasos intermedios -------------------------------------------------------------------

function formulasDe({ simbolo: s, serie }: Convencion): string[] {
  const suma = `${s}_1 + ${s}_2 + \\dots`;
  const reciproca = `\\left(\\dfrac{1}{${s}_1} + \\dfrac{1}{${s}_2} + \\dots\\right)^{-1}`;
  return [
    `${s}_{\\mathrm{serie}} = ${serie === 'suma' ? suma : reciproca}`,
    `${s}_{\\mathrm{paralelo}} = ${serie === 'suma' ? reciproca : suma}`,
    `E_{\\mathrm{arreglo}} = \\dfrac{${s}_{\\mathrm{arreglo}} - ${s}_{\\mathrm{buscada}}}{${s}_{\\mathrm{buscada}}}`,
  ];
}

function pasosComunes(
  c: Convencion,
  formulas: string[],
  cantidad: number,
  evaluadas: number,
  umbral: number,
): Paso[] {
  const posibles = redesPosibles(cantidad);
  const total = posibles.reduce((a, b) => a + b, 0);
  const tipo = c.simbolo === 'C' ? 'capacitores' : 'resistencias';
  return [
    { texto: `Serie de ${tipo}`, latex: formulas[0] },
    { texto: `Paralelo de ${tipo}`, latex: formulas[1] },
    {
      texto:
        `Redes distintas de 1 a ${MAXIMO_DE_COMPONENTES} componentes con los ${cantidad} valores, ` +
        'repitiendo valores',
      latex: `${posibles.map(enteroLatex).join(' + ')} = ${enteroLatex(total)}`,
      fuente:
        'Formas de conexión: 1, 2, 4 y 10 (OEIS A000084; Riordan y Shannon, 1942). Fórmula cerrada ' +
        'de research/busqueda-arreglos-equivalentes.md §2.',
    },
    {
      texto:
        'Combinaciones evaluadas: el meet-in-the-middle busca con una binaria sobre tablas ' +
        'ordenadas de pares y descarta el resto sin calcularlo',
      latex: `n_{\\mathrm{evaluadas}} = ${enteroLatex(evaluadas)}`,
    },
    {
      texto:
        'Regla de orden: los de igual valor se agrupan y queda el de menos componentes. Primero los ' +
        'que quedan debajo del umbral, por cantidad de componentes y después por error; detrás, los ' +
        `demás, por error. Se muestran los ${ARREGLOS_A_MOSTRAR} mejores`,
      latex: `\\left|E_{\\mathrm{arreglo}}\\right| < ${porcentajeLatex(umbral)}`,
    },
  ];
}

// La red escrita como cuenta, con el valor de cada componente: la suma con "+" y la suma recíproca
// como la inversa de la suma de inversas.
function latexDeRed(red: Red, valorDe: (hoja: number) => string): string {
  if (!('op' in red)) return valorDe(red.hoja);
  const hijos = red.hijos.map((h) => latexDeRed(h, valorDe));
  if (red.op === 'suma') return hijos.join(' + ');
  return `\\left(${hijos.map((h) => `\\dfrac{1}{${h}}`).join(' + ')}\\right)^{-1}`;
}

const FUENTE_PEOR_CASO =
  'Peor caso exacto: serie y paralelo crecen con cada componente, así que el mínimo es la red con ' +
  'todos al mínimo y el máximo, con todos al máximo.';
const FUENTE_TOLERANCIAS =
  'Tolerancias por defecto (spec §8.1): ±5 % (J) y, en capacitores C0G de menos de 10 pF, ' +
  '±0,25 pF absolutos (C), de KEMET C1003_C0G, tabla 1A.';

function pasosDeFila(
  red: Red,
  valor: number,
  error: number,
  tolerancia: { minimo: number; maximo: number },
  buscado: number,
  inventario: readonly ValorInventario[],
  c: Convencion,
): Paso[] {
  const { magnitud, simbolo: s } = c;
  const v = (x: number) => valorLatex(x, magnitud);
  const sub = (texto: string) => `${s}_{\\mathrm{${texto}}}`;

  // Una vez cada valor distinto, de menor a mayor: "39 pF ± 5 %", "8,2 pF ± 0,25 pF".
  const distintos = [...new Set(hojasDe(red))].sort(
    (a, b) => inventario[a].valor - inventario[b].valor,
  );
  const conTolerancia = distintos
    .map((h) => {
      const { valor: x, tolerancia: t } = inventario[h];
      const mas =
        t.tipo === 'relativa'
          ? formatearValor(t.fraccion * 100, 'porcentaje')
          : formatearValor(t.valor, magnitud, 'paso');
      return `${formatearValor(x, magnitud, 'paso')} ± ${mas}`;
    })
    .join(', ');

  const enExtremo = (signo: -1 | 1) => latexDeRed(red, (h) => v(extremo(inventario[h], signo)));
  return [
    {
      texto: 'Error del arreglo',
      latex:
        `E_{\\mathrm{arreglo}} = \\dfrac{${sub('arreglo')} - ${sub('buscada')}}{${sub('buscada')}} = ` +
        `\\dfrac{${v(valor)} - ${v(buscado)}}{${v(buscado)}} = ${errorLatex(error)}`,
    },
    {
      texto: `Tolerancia del arreglo: mínimo, con todos al mínimo (${conTolerancia})`,
      latex: `${sub('min')} = ${enExtremo(-1)} = ${v(tolerancia.minimo)}`,
      fuente: distintos.some((h) => inventario[h].propia)
        ? `${FUENTE_TOLERANCIAS} Los valores del Inventario con tolerancia propia usan la que se escribió.`
        : FUENTE_TOLERANCIAS,
    },
    {
      texto: 'Tolerancia del arreglo: máximo, con todos al máximo',
      latex: `${sub('max')} = ${enExtremo(+1)} = ${v(tolerancia.maximo)}`,
      fuente: FUENTE_PEOR_CASO,
    },
    {
      texto: 'Tolerancia del arreglo respecto de su valor, hacia abajo y hacia arriba',
      latex:
        `\\dfrac{${sub('min')} - ${s}}{${s}} = ${errorLatex((tolerancia.minimo - valor) / valor)}, \\quad ` +
        `\\dfrac{${sub('max')} - ${s}}{${s}} = ${errorLatex((tolerancia.maximo - valor) / valor)}`,
    },
  ];
}
