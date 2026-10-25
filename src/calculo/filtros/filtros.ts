import { formatearValor } from '../../entrada/formato';
import { numeroLatex as numero, valorLatex } from '../comun/latex';
import type { Aviso, Paso, Referencia } from '../comun/resultado';
import { type Revision, revisarValores } from '../comun/valor-impracticable';

// La Calculadora de filtros (spec §7): escaleras LC π y T con fuente y carga iguales. Por ahora
// pasa bajos y pasa altos, Butterworth y Chebyshev. Prototipo pasa bajos normalizado (g0 = 1, corte
// en 1 rad/s), transformación de frecuencia según el Tipo de filtro y escala de impedancia por R0.
// Puro: recibe Hz, ohms, dB y el Q de las bobinas.

export type TipoFiltro = 'pasa-bajos' | 'pasa-altos';
export type Aproximacion = 'butterworth' | 'chebyshev';
export type TopologiaFiltro = 'π' | 'T';

export interface EntradaFiltro {
  tipo: TipoFiltro;
  aproximacion: Aproximacion;
  // En dB; solo en Chebyshev.
  ripple: number | null;
  topologia: TopologiaFiltro;
  orden: number;
  // En Hz: −3 dB en Butterworth, el borde del ripple en Chebyshev.
  fc: number;
  rs: number;
  rl: number;
  // Qu, para la pérdida de Cohn.
  qBobina: number;
}

export interface Prototipo {
  aproximacion: Aproximacion;
  orden: number;
  ripple: number | null;
  // g1 … gn, de la fuente a la carga.
  g: readonly number[];
  // g(n+1): 1 salvo en Chebyshev par.
  carga: number;
  // Solo en Chebyshev.
  beta: number | null;
  gamma: number | null;
  pasos: readonly Paso[];
}

export type Posicion = 'serie' | 'derivacion';

export const DONDE: Record<Posicion, string> = { serie: 'en serie', derivacion: 'en derivación' };

// Un L o C de la escalera. Se nombra por su posición desde la fuente: "C1", "L2".
export interface ElementoFiltro {
  componente: 'L' | 'C';
  nombre: string;
  // En H o F.
  valor: number;
  posicion: Posicion;
  // Su lugar desde la fuente y el g del prototipo del que sale: g1 es el primero.
  k: number;
  g: number;
}

export type CodigoCorteFiltro = 'entrada-invalida' | 'terminaciones-distintas';

export type CodigoAvisoFiltro = 'chebyshev-par';

export type ResultadoFiltro =
  | { estado: 'corte'; codigo: CodigoCorteFiltro; texto: string }
  | {
      estado: 'calculado';
      tipo: TipoFiltro;
      aproximacion: Aproximacion;
      topologia: TopologiaFiltro;
      // El que escribió el Alumno y el que se usa: Chebyshev par sube al impar.
      ordenPedido: number;
      orden: number;
      prototipo: Prototipo;
      // De la fuente a la carga.
      elementos: readonly ElementoFiltro[];
      // Estimación de Cohn, en dB.
      perdidaCohn: number;
      // Las fórmulas del resultado principal, sin números.
      formulas: readonly string[];
      pasos: readonly Paso[];
      // Valor dudoso o impracticable de cada L y C en fc. Su cuenta está al final de pasos.
      revision: Revision;
      referencias: readonly Referencia[];
      avisos: readonly Aviso<CodigoAvisoFiltro>[];
      notas: readonly string[];
    };

export const REFERENCIAS_FILTROS: readonly Referencia[] = [
  {
    autor: 'G. L. Matthaei, L. Young y E. M. T. Jones',
    obra: 'Microwave Filters, Impedance-Matching Networks, and Coupling Structures',
    edicion: '1.ª',
    editor: 'McGraw-Hill',
    anio: 1964,
    ubicacion: 'ec. 4.04-2 a 4.04-4, 4.05-1, 4.05-2 y 4.13-11, tablas 4.05-1 y 4.05-2',
  },
  {
    autor: 'D. M. Pozar',
    obra: 'Microwave Engineering',
    edicion: '4.ª',
    editor: 'Wiley',
    anio: 2012,
    ubicacion: '§8.3 y §8.4, Tabla 8.6',
  },
  {
    autor: 'A. I. Zverev',
    obra: 'Handbook of Filter Synthesis',
    edicion: '1.ª',
    editor: 'Wiley',
    anio: 1967,
    ubicacion: 'tablas de prototipos LC',
  },
  {
    autor: 'A. B. Williams y F. J. Taylor',
    obra: 'Electronic Filter Design Handbook',
    edicion: '4.ª',
    editor: 'McGraw-Hill',
    anio: 2006,
    ubicacion: 'filtros pasa bajos y pasa altos LC',
  },
];

export const SUGERENCIA_FILTROS = 'Cambiá de Topología π ↔ T.';

export const ORDEN_MAXIMO = 10;
export const RANGO_RIPPLE = { min: 0.01, max: 3 } as const;

// 10/ln 10: los dB de un logaritmo natural. Matthaei lo escribe 4,343 (y 40/ln 10 como 17,37).
const DB_POR_NEPER = 10 / Math.LN10;

const ohms = (r: number) => valorLatex(r, 'resistencia');
const hz = (f: number) => valorLatex(f, 'frecuencia');
const db = (x: number) => valorLatex(x, 'decibeles');
const numeroTexto = (x: number) => formatearValor(x, 'numero');

// Chebyshev de Orden par no se puede armar con R_s = R_L: se usa el impar siguiente (spec §7.3).
export const ordenEfectivo = (aproximacion: Aproximacion, n: number) =>
  aproximacion === 'chebyshev' && n % 2 === 0 ? n + 1 : n;

// En π g1 va en derivación junto a la fuente; en T, en serie. Después alternan.
const posicionDe = (topologia: TopologiaFiltro, k: number): Posicion =>
  (topologia === 'T') === (k % 2 === 1) ? 'serie' : 'derivacion';

// Matthaei ec. 4.04-2 a 4.04-4 y Pozar, Tabla 8.6, con ωc = 2π·fc: qué es cada g según el Tipo de
// filtro y su posición, y su fórmula sin números y con ellos.
interface Escala {
  componente: 'L' | 'C';
  valor: (g: number, r0: number, omega: number) => number;
  formula: (g: string) => string;
  sustituida: (g: string, fc: string, r0: string) => string;
}

const ESCALA: Record<TipoFiltro, Record<Posicion, Escala>> = {
  'pasa-bajos': {
    serie: {
      componente: 'L',
      valor: (g, r0, omega) => (g * r0) / omega,
      formula: (g) => `\\dfrac{${g} R_0}{2\\pi f_c}`,
      sustituida: (g, fc, r0) => `\\dfrac{${g} \\cdot ${r0}}{2\\pi \\cdot ${fc}}`,
    },
    derivacion: {
      componente: 'C',
      valor: (g, r0, omega) => g / (r0 * omega),
      formula: (g) => `\\dfrac{${g}}{2\\pi f_c R_0}`,
      sustituida: (g, fc, r0) => `\\dfrac{${g}}{2\\pi \\cdot ${fc} \\cdot ${r0}}`,
    },
  },
  'pasa-altos': {
    serie: {
      componente: 'C',
      valor: (g, r0, omega) => 1 / (g * r0 * omega),
      formula: (g) => `\\dfrac{1}{2\\pi f_c\\, ${g} R_0}`,
      sustituida: (g, fc, r0) => `\\dfrac{1}{2\\pi \\cdot ${fc} \\cdot ${g} \\cdot ${r0}}`,
    },
    derivacion: {
      componente: 'L',
      valor: (g, r0, omega) => r0 / (g * omega),
      formula: (g) => `\\dfrac{R_0}{2\\pi f_c\\, ${g}}`,
      sustituida: (g, fc, r0) => `\\dfrac{${r0}}{2\\pi \\cdot ${fc} \\cdot ${g}}`,
    },
  },
};

// Las bobinas son las series en pasa bajos y las derivaciones en pasa altos.
export function contarBobinas(tipo: TipoFiltro, topologia: TopologiaFiltro, n: number): number {
  let cuenta = 0;
  for (let k = 1; k <= n; k++) {
    if (ESCALA[tipo][posicionDe(topologia, k)].componente === 'L') cuenta++;
  }
  return cuenta;
}

// La Topología por defecto: la que usa menos bobinas, que en VHF son las de menor Q y más
// dispersión; π cuando las dos usan las mismas (spec §7.1 y §12.2). La nota lo explica en una
// línea junto al campo.
export function topologiaSugerida(
  tipo: TipoFiltro,
  aproximacion: Aproximacion,
  orden: number | null,
): { topologia: TopologiaFiltro; nota: string } {
  if (orden === null) {
    return { topologia: 'π', nota: 'Por defecto, la que usa menos bobinas según el Orden.' };
  }
  const n = ordenEfectivo(aproximacion, orden);
  const enPi = contarBobinas(tipo, 'π', n);
  const enT = contarBobinas(tipo, 'T', n);
  if (enPi === enT) {
    return {
      topologia: 'π',
      nota: `π y T llevan ${enPi} ${enPi === 1 ? 'bobina' : 'bobinas'} cada una: por defecto, π.`,
    };
  }
  const [mejor, menos, otra, mas] = enPi < enT ? ['π', enPi, 'T', enT] : ['T', enT, 'π', enPi];
  const lleva = menos === 0 ? 'no lleva ninguna' : `lleva ${menos}`;
  return {
    topologia: mejor as TopologiaFiltro,
    nota: `Por defecto, la que usa menos bobinas: ${mejor} ${lleva} y ${otra}, ${mas}.`,
  };
}

// --- Prototipo -----------------------------------------------------------------------------------

const FORMULA_BUTTERWORTH = 'g_k = 2 \\operatorname{sen}\\left[\\dfrac{(2k - 1)\\pi}{2n}\\right]';
const FORMULAS_CHEBYSHEV = [
  '\\beta = \\ln\\left[\\coth\\left(\\dfrac{r}{17{,}37}\\right)\\right],\\; ' +
    '\\gamma = \\operatorname{senh}\\left(\\dfrac{\\beta}{2n}\\right)',
  'a_k = \\operatorname{sen}\\left[\\dfrac{(2k - 1)\\pi}{2n}\\right],\\; ' +
    'b_k = \\gamma^2 + \\operatorname{sen}^2\\left(\\dfrac{k\\pi}{n}\\right)',
  'g_1 = \\dfrac{2 a_1}{\\gamma},\\; g_k = \\dfrac{4 a_{k-1} a_k}{b_{k-1} g_{k-1}}',
];

const FUENTE_BUTTERWORTH = 'Matthaei, Young y Jones, ec. 4.05-1.';
const FUENTE_CHEBYSHEV = 'Matthaei, Young y Jones, ec. 4.05-2.';

export function prototipo(aproximacion: Aproximacion, n: number, ripple: number | null): Prototipo {
  return aproximacion === 'butterworth' ? butterworth(n) : chebyshev(n, ripple!);
}

function butterworth(n: number): Prototipo {
  const g = Array.from({ length: n }, (_, i) => 2 * Math.sin(((2 * i + 1) * Math.PI) / (2 * n)));
  const pasos: Paso[] = g.map((gk, i) => ({
    texto: `g${i + 1}`,
    latex:
      `g_{${i + 1}} = 2 \\operatorname{sen}\\left[\\dfrac{(2 \\cdot ${i + 1} - 1)\\pi}{2 \\cdot ${n}}\\right] = ` +
      numero(gk),
    ...(i === 0 && { fuente: FUENTE_BUTTERWORTH }),
  }));
  pasos.push({ texto: 'Carga del prototipo: igual a la fuente', latex: `g_{${n + 1}} = 1` });
  return {
    aproximacion: 'butterworth',
    orden: n,
    ripple: null,
    g,
    carga: 1,
    beta: null,
    gamma: null,
    pasos,
  };
}

function chebyshev(n: number, ripple: number): Prototipo {
  const beta = Math.log(1 / Math.tanh(ripple / (4 * DB_POR_NEPER)));
  const gamma = Math.sinh(beta / (2 * n));
  const a = (k: number) => Math.sin(((2 * k - 1) * Math.PI) / (2 * n));
  const b = (k: number) => gamma * gamma + Math.sin((k * Math.PI) / n) ** 2;
  const g = [(2 * a(1)) / gamma];
  for (let k = 2; k <= n; k++) g.push((4 * a(k - 1) * a(k)) / (b(k - 1) * g[k - 2]));
  const par = n % 2 === 0;
  const carga = par ? 1 / Math.tanh(beta / 4) ** 2 : 1;

  const lista = (f: (k: number) => number, hasta: number) =>
    Array.from({ length: hasta }, (_, i) => numero(f(i + 1))).join(',\\; ');
  const pasos: Paso[] = [
    {
      texto: 'β, del ripple',
      latex:
        `\\beta = \\ln\\left[\\coth\\left(\\dfrac{r}{17{,}37}\\right)\\right] = ` +
        `\\ln\\left[\\coth\\left(\\dfrac{${numero(ripple)}}{17{,}37}\\right)\\right] = ${numero(beta)}`,
      fuente: `${FUENTE_CHEBYSHEV} 17,37 es 40/ln 10; la cuenta usa el valor exacto.`,
    },
    {
      texto: 'γ',
      latex:
        `\\gamma = \\operatorname{senh}\\left(\\dfrac{\\beta}{2n}\\right) = ` +
        `\\operatorname{senh}\\left(\\dfrac{${numero(beta)}}{2 \\cdot ${n}}\\right) = ${numero(gamma)}`,
    },
    {
      texto: `a1 … a${n}`,
      latex: `a_k = \\operatorname{sen}\\left[\\dfrac{(2k - 1)\\pi}{2 \\cdot ${n}}\\right]:\\; ${lista(a, n)}`,
    },
    ...(n > 1
      ? [
          {
            texto: `b1 … b${n - 1}`,
            latex:
              `b_k = \\gamma^2 + \\operatorname{sen}^2\\left(\\dfrac{k\\pi}{${n}}\\right):\\; ` +
              lista(b, n - 1),
          },
        ]
      : []),
    {
      texto: 'g1',
      latex:
        `g_{1} = \\dfrac{2 a_{1}}{\\gamma} = \\dfrac{2 \\cdot ${numero(a(1))}}{${numero(gamma)}} = ` +
        numero(g[0]),
    },
    ...g.slice(1).map((gk, i) => {
      const k = i + 2;
      return {
        texto: `g${k}`,
        latex:
          `g_{${k}} = \\dfrac{4 a_{${k - 1}} a_{${k}}}{b_{${k - 1}} g_{${k - 1}}} = ` +
          `\\dfrac{4 \\cdot ${numero(a(k - 1))} \\cdot ${numero(a(k))}}` +
          `{${numero(b(k - 1))} \\cdot ${numero(g[k - 2])}} = ${numero(gk)}`,
      };
    }),
    par
      ? {
          texto: 'Carga del prototipo: Orden par, distinta de la fuente',
          latex:
            `g_{${n + 1}} = \\coth^2\\left(\\dfrac{\\beta}{4}\\right) = ` +
            `\\coth^2\\left(\\dfrac{${numero(beta)}}{4}\\right) = ${numero(carga)}`,
        }
      : { texto: 'Carga del prototipo: Orden impar, igual a la fuente', latex: `g_{${n + 1}} = 1` },
  ];
  return { aproximacion: 'chebyshev', orden: n, ripple, g, carga, beta, gamma, pasos };
}

// --- Escalera ------------------------------------------------------------------------------------

const formulasEscala = (tipo: TipoFiltro) =>
  (['serie', 'derivacion'] as const).map((posicion) => {
    const { componente, formula } = ESCALA[tipo][posicion];
    return `${componente}_k = ${formula('g_k')}\\;\\text{(${DONDE[posicion]})}`;
  });

const FORMULA_COHN = '\\Delta L_0 \\approx 4{,}343 \\sum \\dfrac{g_k}{Q_u}\\;\\text{(bobinas)}';

function elementoDe(
  tipo: TipoFiltro,
  topologia: TopologiaFiltro,
  k: number,
  g: number,
  fc: number,
  r0: number,
): { elemento: ElementoFiltro; paso: Paso } {
  const posicion = posicionDe(topologia, k);
  const escala = ESCALA[tipo][posicion];
  const { componente } = escala;
  const nombre = `${componente}${k}`;
  const valor = escala.valor(g, r0, 2 * Math.PI * fc);
  const magnitud = componente === 'L' ? 'inductancia' : 'capacidad';
  return {
    elemento: { componente, nombre, valor, posicion, k, g },
    paso: {
      texto: `${nombre}, ${DONDE[posicion]}`,
      latex:
        `${componente}_{${k}} = ${escala.formula(`g_{${k}}`)} = ` +
        `${escala.sustituida(numero(g), hz(fc), ohms(r0))} = ${valorLatex(valor, magnitud)}`,
    },
  };
}

// --- Cálculo -------------------------------------------------------------------------------------

const CORTE_INVALIDA =
  `fc, Rs, RL y el Q de las bobinas tienen que ser mayores que cero; el Orden, un entero de 1 a ` +
  `${ORDEN_MAXIMO}; y el ripple, de ${numeroTexto(RANGO_RIPPLE.min)} a ${numeroTexto(RANGO_RIPPLE.max)} dB.`;

export function calcularFiltro(entrada: EntradaFiltro): ResultadoFiltro {
  const { tipo, aproximacion, ripple, topologia, orden, fc, rs, rl, qBobina } = entrada;
  const rippleValido =
    aproximacion !== 'chebyshev' ||
    (ripple !== null && ripple >= RANGO_RIPPLE.min && ripple <= RANGO_RIPPLE.max);
  if (
    !(fc > 0 && rs > 0 && rl > 0 && qBobina > 0) ||
    !Number.isInteger(orden) ||
    orden < 1 ||
    orden > ORDEN_MAXIMO ||
    !rippleValido
  ) {
    return { estado: 'corte', codigo: 'entrada-invalida', texto: CORTE_INVALIDA };
  }
  if (rs !== rl) {
    return {
      estado: 'corte',
      codigo: 'terminaciones-distintas',
      texto:
        'Esta Versión todavía no calcula filtros con Rs ≠ RL: por ahora la fuente y la carga ' +
        'tienen que ser iguales. Para pasar de una a la otra está la Calculadora de redes de ' +
        'adaptación.',
    };
  }

  const n = ordenEfectivo(aproximacion, orden);
  const avisos: Aviso<CodigoAvisoFiltro>[] = [];
  if (n !== orden) {
    const { carga } = prototipo(aproximacion, orden, ripple);
    avisos.push({
      codigo: 'chebyshev-par',
      texto:
        `Chebyshev de Orden ${orden} no se puede armar con Rs = RL: pide una carga de ` +
        `${numeroTexto(carga)} veces la fuente. Se calcula con Orden ${n}.`,
    });
  }

  const p = prototipo(aproximacion, n, ripple);
  const r0 = rs;
  const armados = p.g.map((g, i) => elementoDe(tipo, topologia, i + 1, g, fc, r0));
  const elementos = armados.map((x) => x.elemento);

  const bobinasDelFiltro = elementos.filter((e) => e.componente === 'L');
  const perdidaCohn = (DB_POR_NEPER * bobinasDelFiltro.reduce((s, e) => s + e.g, 0)) / qBobina;
  const revision = revisarValores(elementos, fc, { sugerencia: SUGERENCIA_FILTROS });

  const pasos: Paso[] = [
    ...p.pasos,
    ...armados.map((x) => x.paso),
    pasoCohn(bobinasDelFiltro, qBobina, perdidaCohn),
    ...revision.pasos,
  ];

  return {
    estado: 'calculado',
    tipo,
    aproximacion,
    topologia,
    ordenPedido: orden,
    orden: n,
    prototipo: p,
    elementos,
    perdidaCohn,
    formulas: [
      ...(aproximacion === 'butterworth' ? [FORMULA_BUTTERWORTH] : FORMULAS_CHEBYSHEV),
      ...formulasEscala(tipo),
      FORMULA_COHN,
    ],
    pasos,
    revision,
    referencias: REFERENCIAS_FILTROS,
    avisos,
    notas: notasDe(tipo, aproximacion),
  };
}

function pasoCohn(bobinas: readonly ElementoFiltro[], qu: number, perdida: number): Paso {
  const fuente =
    'Matthaei, Young y Jones, ec. 4.13-11. Solo pierden las bobinas, con Qk = Qu; los ' +
    'capacitores se toman ideales. Estimación.';
  if (bobinas.length === 0) {
    return {
      texto: 'Pérdida de Cohn: sin bobinas no hay pérdida',
      latex: `\\Delta L_0 = ${db(0)}`,
      fuente,
    };
  }
  const indices = bobinas.map((e) => `g_{${e.k}}`).join(' + ');
  const valores = bobinas.map((e) => numero(e.g)).join(' + ');
  return {
    texto: `Pérdida de Cohn en el centro de la banda pasante, con Qu = ${numeroTexto(qu)}`,
    latex:
      `\\Delta L_0 \\approx 4{,}343 \\cdot \\dfrac{${indices}}{Q_u} = ` +
      `4{,}343 \\cdot \\dfrac{${valores}}{${numero(qu)}} = ${db(perdida)}`,
    fuente,
  };
}

function notasDe(tipo: TipoFiltro, aproximacion: Aproximacion): string[] {
  return [
    aproximacion === 'butterworth'
      ? 'En Butterworth, fc es el punto de −3 dB.'
      : 'En Chebyshev, fc es el borde del ripple: ahí la atenuación vale el ripple, no 3 dB.',
    'π y T dan la misma respuesta con los mismos g: la diferencia es cuántas bobinas llevan.',
    'Los valores no se redondean a una serie E.',
    'La pérdida es la estimación de Cohn en el centro de la banda pasante: solo pierden las ' +
      'bobinas, con el Q que ingresaste; los capacitores se toman ideales.',
    ...(tipo === 'pasa-altos'
      ? [
          'Los valores se revisan en fc, pero un pasa altos trabaja por encima de fc: ahí el ' +
            'desvío por el montaje y las parásitas crece.',
        ]
      : []),
  ];
}
