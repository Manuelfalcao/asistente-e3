import { formatearValor } from '../../entrada/formato';
import { numeroLatex as numero, valorLatex } from '../comun/latex';
import type { Aviso, Paso, Referencia } from '../comun/resultado';
import { type Revision, revisarValores } from '../comun/valor-impracticable';

// Atenuadores resistivos T y π entre Z1 (fuente) y Z2 (carga), iguales o distintas (spec §10.2).
// Puro: recibe dB y ohms, y devuelve los valores con sus fórmulas, sus pasos y su referencia.

export interface EntradaAtenuador {
  // En dB.
  atenuacion: number;
  z1: number;
  z2: number;
  // En Hz, para el criterio de valor impracticable. Vacía: 300 MHz.
  frecuencia?: number | null;
  // En W, la que entra al atenuador. Vacía: no se calcula la disipación.
  potencia?: number | null;
}

// El pad de mínima pérdida: la atenuación se fija en A_min, así que no hay atenuación que ingresar.
export type EntradaMinimaPerdida = Omit<EntradaAtenuador, 'atenuacion'>;

export type CodigoCorte = 'no-positiva' | 'mas-de-60' | 'debajo-de-a-min';
export type CodigoAviso = 'menos-de-medio-db' | 'mas-de-40' | 'frecuencia-por-defecto';

export interface Resistencia {
  componente: 'R';
  // "R1"
  nombre: string;
  valor: number;
  posicion: 'serie' | 'derivacion';
  // De qué lado está; null la del medio.
  lado: 'Z1' | 'Z2' | null;
}

// La potencia que disipa una resistencia y la nominal mínima que conviene (spec §10.3).
export interface PotenciaResistencia {
  nombre: string;
  // En W.
  disipada: number;
  // En W: el margen de 2× sobre la disipada. Es un criterio de diseño, no un valor comercial.
  nominalMinima: number;
}

export interface PotenciaRed {
  // En W, la que entra al atenuador.
  entrada: number;
  margen: number;
  resistencias: readonly PotenciaResistencia[];
}

// Lo que tienen en común el T, el π y el pad de mínima pérdida.
interface RedResistiva {
  // Las fórmulas que se usaron, sin números: van a la vista en la tarjeta.
  formulas: readonly string[];
  pasos: readonly Paso[];
  // Con Z2 conectada: la impedancia que ve la fuente y la atenuación que resulta.
  verificacion: { zEntrada: number; atenuacion: number };
  // Valor dudoso o impracticable de cada resistencia (spec §5.6). Su cuenta está al final de pasos.
  revision: Revision;
  // Solo con potencia de entrada.
  potencia: PotenciaRed | null;
}

export interface Atenuador extends RedResistiva {
  topologia: 'T' | 'π';
  r1: Resistencia;
  r2: Resistencia;
  r3: Resistencia;
}

// La red L de dos resistencias: R1 en serie del lado de la impedancia mayor y R3 en derivación del
// lado de la menor, con los nombres de la Fig. 7 del libro.
export interface PadMinimaPerdida extends RedResistiva {
  topologia: 'L';
  serie: Resistencia;
  derivacion: Resistencia;
}

export type ResultadoAtenuadores =
  | {
      estado: 'corte';
      codigo: CodigoCorte;
      texto: string;
      // Solo debajo de A_min, con el paso que la calcula.
      aMin?: number;
      pasos: readonly Paso[];
    }
  | {
      estado: 'calculado';
      k: number;
      n: number;
      // null con Z1 = Z2.
      aMin: number | null;
      t: Atenuador;
      pi: Atenuador;
      avisos: readonly Aviso<CodigoAviso>[];
      referencias: readonly Referencia[];
      notas: readonly string[];
    };

// Las ecuaciones generales están en la pág. 253 de la 4.ª ed., en N = K² (spec §10.2).
export const REFERENCIAS_ATENUADORES: readonly Referencia[] = [
  {
    obra: 'Reference Data for Radio Engineers',
    edicion: '4.ª',
    editor: 'ITT',
    anio: 1956,
    ubicacion: 'cap. 9, págs. 252-254',
  },
  {
    obra: 'Reference Data for Radio Engineers',
    edicion: '1.ª',
    anio: 1943,
    ubicacion: 'págs. 65-67',
  },
];

// El pad de mínima pérdida está en la Fig. 7 (pág. 260); sus ecuaciones, en la pág. 253.
export const REFERENCIAS_MINIMA_PERDIDA: readonly Referencia[] = [
  {
    obra: 'Reference Data for Radio Engineers',
    edicion: '4.ª',
    editor: 'ITT',
    anio: 1956,
    ubicacion: 'cap. 9, pág. 253 (ecuaciones) y Fig. 7, pág. 260',
  },
  {
    obra: 'Reference Data for Radio Engineers',
    edicion: '1.ª',
    anio: 1943,
    ubicacion: 'págs. 65-67',
  },
];

export const NOTAS_ATENUADORES: readonly string[] = [
  'En VHF usá resistencias de película o SMD, no de alambre, y dejá los terminales cortos.',
  'El cálculo de potencia es para potencia continua: con señales moduladas hay que mirar la ' +
    'potencia de pico.',
];

// El margen sobre la potencia disipada, en veces: una práctica habitual (criterio de diseño).
export const MARGEN_DE_POTENCIA = 2;

const TOPE = 60;

// El peor caso de la banda, para revisar las resistencias sin frecuencia.
export const FRECUENCIA_POR_DEFECTO = 300e6;

export const SUGERENCIA_ATENUADORES =
  'Mirá la otra Topología (el π de 40 dB aguanta mucho mejor que el T).';

const ohmsLatex = (r: number) => valorLatex(r, 'resistencia');

export function calcularAtenuadores({
  atenuacion: a,
  z1,
  z2,
  frecuencia = null,
  potencia = null,
}: EntradaAtenuador): ResultadoAtenuadores {
  if (!(a > 0)) {
    return {
      estado: 'corte',
      codigo: 'no-positiva',
      texto: 'La atenuación tiene que ser mayor que 0 dB.',
      pasos: [],
    };
  }
  if (a > TOPE) {
    return {
      estado: 'corte',
      codigo: 'mas-de-60',
      texto:
        'Con más de 60 dB no se calcula: en VHF una sola sección no llega a esa atenuación. ' +
        'Armá secciones de 10 a 20 dB en cascada.',
      pasos: [],
    };
  }

  const k = 10 ** (a / 20);
  const n = 10 ** (a / 10);
  const iguales = z1 === z2;
  const minima = iguales ? null : atenuacionMinima(z1, z2);
  const t = atenuadorT(k, n, z1, z2);
  const pi = atenuadorPi(k, n, z1, z2);

  // Justo en A_min la resistencia que se anula o se abre puede salir apenas negativa o infinita
  // por redondeo: también es un corte.
  const fisicos = [t, pi].every((red) =>
    [red.r1, red.r2, red.r3].every((r) => Number.isFinite(r.valor) && r.valor >= 0),
  );
  if (minima && (a < minima.aMin || !fisicos)) {
    return {
      estado: 'corte',
      codigo: 'debajo-de-a-min',
      texto:
        `Entre ${formatearValor(z1, 'resistencia')} y ${formatearValor(z2, 'resistencia')} la ` +
        `atenuación mínima es A_min = ${formatearValor(minima.aMin, 'decibeles')}: con menos, ` +
        'una de las resistencias sale negativa.',
      aMin: minima.aMin,
      pasos: minima.pasos,
    };
  }

  const avisos = avisosDe(a, frecuencia);
  const entrada = potenciaValida(potencia);
  const comunes = [...pasosDeK(a, k, n), ...(minima?.pasos ?? [])];
  const completar = (
    red: Omit<Atenuador, 'revision' | 'potencia'>,
    calcularPotencia: (p: number) => ResultadoPotencia,
  ): Atenuador => {
    const conPotencia = entrada === null ? null : calcularPotencia(entrada);
    const revision = revisarValores(red, frecuencia ?? FRECUENCIA_POR_DEFECTO, {
      sugerencia: SUGERENCIA_ATENUADORES,
    });
    return {
      ...red,
      formulas: [...red.formulas, ...(conPotencia?.formulas ?? [])],
      pasos: [...comunes, ...red.pasos, ...(conPotencia?.pasos ?? []), ...revision.pasos],
      revision,
      potencia: conPotencia?.potencia ?? null,
    };
  };
  return {
    estado: 'calculado',
    k,
    n,
    aMin: minima?.aMin ?? null,
    t: completar(t, (p) => potenciaDeT(t, n, z1, z2, p)),
    pi: completar(pi, (p) => potenciaDePi(pi, k, n, z1, z2, p)),
    avisos,
    referencias: REFERENCIAS_ATENUADORES,
    notas: NOTAS_ATENUADORES,
  };
}

// Los avisos de la atenuación y de la frecuencia (spec §10.5), los mismos para el T, el π y el pad.
function avisosDe(a: number, frecuencia: number | null): Aviso<CodigoAviso>[] {
  const avisos: Aviso<CodigoAviso>[] = [];
  if (a < 0.5) {
    avisos.push({
      codigo: 'menos-de-medio-db',
      texto:
        'Con menos de 0,5 dB las resistencias en serie quedan del orden de la resistencia de los ' +
        'terminales.',
    });
  }
  if (a > 40) {
    avisos.push({
      codigo: 'mas-de-40',
      texto:
        'En VHF una sola sección no llega a más de 40 dB de atenuación real: conviene armar ' +
        'secciones de 10 a 20 dB en cascada. La cascada no se calcula; podés usar la Calculadora ' +
        'dos veces.',
    });
  }

  if (frecuencia === null) {
    avisos.push({
      codigo: 'frecuencia-por-defecto',
      texto:
        `Sin frecuencia, las resistencias se revisan a ` +
        `${formatearValor(FRECUENCIA_POR_DEFECTO, 'frecuencia')}, el peor caso de la banda. ` +
        'Escribí la tuya en Frecuencia para revisarlas ahí.',
    });
  }
  return avisos;
}

// La potencia de entrada, si hay una que tenga sentido.
const potenciaValida = (p: number | null | undefined): number | null =>
  p !== null && p !== undefined && p > 0 && Number.isFinite(p) ? p : null;

function pasosDeK(a: number, k: number, n: number): Paso[] {
  return [
    {
      texto: 'Relación de tensiones con el atenuador adaptado',
      latex: `K = 10^{A/20} = 10^{${numero(a)}/20} = ${numero(k)}`,
    },
    {
      texto: 'Relación de potencias: la N del Reference Data',
      latex: `N = K^2 = 10^{A/10} = ${numero(n)}`,
    },
  ];
}

// Con Z1 ≠ Z2, la atenuación debajo de la cual alguna resistencia sale negativa.
// K_min es la relación de tensiones que le corresponde (el Reference Data: cosh θ = √r).
export function atenuacionMinima(
  z1: number,
  z2: number,
): { aMin: number; kMin: number; pasos: Paso[] } {
  const mayor = Math.max(z1, z2);
  const menor = Math.min(z1, z2);
  const r = mayor / menor;
  const kMin = Math.sqrt(r) + Math.sqrt(r - 1);
  const aMin = 20 * Math.log10(kMin);
  return {
    aMin,
    kMin,
    pasos: [
      {
        texto: 'Relación de impedancias',
        latex:
          `r = \\dfrac{Z_{\\mathrm{mayor}}}{Z_{\\mathrm{menor}}} = ` +
          `\\dfrac{${numero(mayor)}}{${numero(menor)}} = ${numero(r)}`,
      },
      {
        texto: 'Atenuación mínima entre Z1 y Z2',
        latex:
          `A_{\\mathrm{min}} = 20 \\log_{10}\\left(\\sqrt{r} + \\sqrt{r - 1}\\right) = ` +
          `20 \\log_{10}\\left(\\sqrt{${numero(r)}} + \\sqrt{${numero(r)} - 1}\\right) = ` +
          valorLatex(aMin, 'decibeles'),
      },
    ],
  };
}

// La atenuación con la carga conectada: P_entrada / P_carga = (V1/V2)² · Z2 / Z_ent.
function atenuacionDe(zEntrada: number, z2: number, v2SobreV1: number): number {
  return 10 * Math.log10(z2 / zEntrada / (v2SobreV1 * v2SobreV1));
}

function pasoAtenuacion(zEntrada: number, z2: number, v2SobreV1: number, atenuacion: number): Paso {
  return {
    texto: 'Atenuación recalculada',
    latex:
      `A = 10 \\log_{10}\\left[\\dfrac{Z_2}{Z_{\\mathrm{ent}}} \\left(\\dfrac{V_1}{V_2}\\right)^2\\right] = ` +
      `10 \\log_{10}\\left[\\dfrac{${numero(z2)}}{${numero(zEntrada)}} \\cdot ` +
      `\\left(\\dfrac{1}{${numero(v2SobreV1)}}\\right)^2\\right] = ${valorLatex(atenuacion, 'decibeles')}`,
  };
}

// T: R1 en serie del lado de Z1, R3 en derivación y R2 en serie del lado de Z2.
const resistencia = (
  nombre: string,
  valor: number,
  posicion: Resistencia['posicion'],
  lado: Resistencia['lado'],
): Resistencia => ({ componente: 'R', nombre, valor, posicion, lado });

type SinCompletar = Omit<Atenuador, 'revision' | 'potencia'>;

function atenuadorT(k: number, n: number, z1: number, z2: number): SinCompletar {
  const r3 = (2 * k * Math.sqrt(z1 * z2)) / (n - 1);
  const r1 = (z1 * (n + 1)) / (n - 1) - r3;
  const r2 = (z2 * (n + 1)) / (n - 1) - r3;

  let formulas: string[];
  let pasos: Paso[];
  if (z1 === z2) {
    // Las formas conocidas para Z1 = Z2 = Z0, que son las mismas que las generales.
    const z0 = numero(z1);
    formulas = ['R_1 = R_2 = Z_0 \\dfrac{K - 1}{K + 1}', 'R_3 = \\dfrac{2 K Z_0}{K^2 - 1}'];
    pasos = [
      {
        texto: 'R1 y R2, en serie',
        latex: `${formulas[0]} = ${z0} \\cdot \\dfrac{${numero(k)} - 1}{${numero(k)} + 1} = ${ohmsLatex(r1)}`,
      },
      {
        texto: 'R3, en derivación',
        latex: `${formulas[1]} = \\dfrac{2 \\cdot ${numero(k)} \\cdot ${z0}}{${numero(n)} - 1} = ${ohmsLatex(r3)}`,
      },
    ];
  } else {
    formulas = [
      'R_3 = \\dfrac{2K\\sqrt{Z_1 Z_2}}{K^2 - 1}',
      'R_1 = Z_1 \\dfrac{K^2 + 1}{K^2 - 1} - R_3',
      'R_2 = Z_2 \\dfrac{K^2 + 1}{K^2 - 1} - R_3',
    ];
    const serie = (z: number) =>
      `${numero(z)} \\cdot \\dfrac{${numero(n)} + 1}{${numero(n)} - 1} - ${numero(r3)}`;
    pasos = [
      {
        texto: 'R3, en derivación',
        latex:
          `${formulas[0]} = ` +
          `\\dfrac{2 \\cdot ${numero(k)} \\cdot \\sqrt{${numero(z1)} \\cdot ${numero(z2)}}}{${numero(n)} - 1} = ${ohmsLatex(r3)}`,
      },
      {
        texto: 'R1, en serie del lado de Z1',
        latex: `${formulas[1]} = ${serie(z1)} = ${ohmsLatex(r1)}`,
      },
      {
        texto: 'R2, en serie del lado de Z2',
        latex: `${formulas[2]} = ${serie(z2)} = ${ohmsLatex(r2)}`,
      },
    ];
  }

  const zEntrada = r1 + (r3 * (r2 + z2)) / (r3 + r2 + z2);
  const v2SobreV1 = ((zEntrada - r1) / zEntrada) * (z2 / (r2 + z2));
  const atenuacion = atenuacionDe(zEntrada, z2, v2SobreV1);
  pasos.push(
    {
      texto: 'Impedancia de entrada con Z2 conectada',
      latex:
        `Z_{\\mathrm{ent}} = R_1 + \\dfrac{R_3 (R_2 + Z_2)}{R_3 + R_2 + Z_2} = ` +
        `${numero(r1)} + \\dfrac{${numero(r3)} \\cdot (${numero(r2)} + ${numero(z2)})}` +
        `{${numero(r3)} + ${numero(r2)} + ${numero(z2)}} = ${ohmsLatex(zEntrada)}`,
    },
    {
      texto: 'Tensión en la carga sobre tensión de entrada',
      latex:
        `\\dfrac{V_2}{V_1} = \\dfrac{Z_{\\mathrm{ent}} - R_1}{Z_{\\mathrm{ent}}} \\cdot \\dfrac{Z_2}{R_2 + Z_2} = ` +
        `\\dfrac{${numero(zEntrada)} - ${numero(r1)}}{${numero(zEntrada)}} \\cdot ` +
        `\\dfrac{${numero(z2)}}{${numero(r2)} + ${numero(z2)}} = ${numero(v2SobreV1)}`,
    },
    pasoAtenuacion(zEntrada, z2, v2SobreV1, atenuacion),
  );

  return {
    topologia: 'T',
    r1: resistencia('R1', r1, 'serie', 'Z1'),
    r2: resistencia('R2', r2, 'serie', 'Z2'),
    r3: resistencia('R3', r3, 'derivacion', null),
    formulas: ['K = 10^{A/20}', ...formulas],
    pasos,
    verificacion: { zEntrada, atenuacion },
  };
}

// π: R1 en derivación del lado de Z1, R3 en serie y R2 en derivación del lado de Z2.
function atenuadorPi(k: number, n: number, z1: number, z2: number): SinCompletar {
  const r3 = ((n - 1) * Math.sqrt(z1 * z2)) / (2 * k);
  const r1 = ((n - 1) * z1) / (n + 1 - 2 * k * Math.sqrt(z1 / z2));
  const r2 = ((n - 1) * z2) / (n + 1 - 2 * k * Math.sqrt(z2 / z1));

  let formulas: string[];
  let pasos: Paso[];
  if (z1 === z2) {
    const z0 = numero(z1);
    formulas = ['R_1 = R_2 = Z_0 \\dfrac{K + 1}{K - 1}', 'R_3 = Z_0 \\dfrac{K^2 - 1}{2K}'];
    pasos = [
      {
        texto: 'R1 y R2, en derivación',
        latex: `${formulas[0]} = ${z0} \\cdot \\dfrac{${numero(k)} + 1}{${numero(k)} - 1} = ${ohmsLatex(r1)}`,
      },
      {
        texto: 'R3, en serie',
        latex: `${formulas[1]} = ${z0} \\cdot \\dfrac{${numero(n)} - 1}{2 \\cdot ${numero(k)}} = ${ohmsLatex(r3)}`,
      },
    ];
  } else {
    formulas = [
      'R_3 = \\dfrac{(K^2 - 1)\\sqrt{Z_1 Z_2}}{2K}',
      'R_1 = \\dfrac{(K^2 - 1) Z_1}{K^2 + 1 - 2K\\sqrt{Z_1/Z_2}}',
      'R_2 = \\dfrac{(K^2 - 1) Z_2}{K^2 + 1 - 2K\\sqrt{Z_2/Z_1}}',
    ];
    const derivacion = (z: number, otra: number) =>
      `\\dfrac{(${numero(n)} - 1) \\cdot ${numero(z)}}` +
      `{${numero(n)} + 1 - 2 \\cdot ${numero(k)} \\cdot \\sqrt{${numero(z)}/${numero(otra)}}}`;
    pasos = [
      {
        texto: 'R3, en serie',
        latex:
          `${formulas[0]} = ` +
          `\\dfrac{(${numero(n)} - 1) \\cdot \\sqrt{${numero(z1)} \\cdot ${numero(z2)}}}{2 \\cdot ${numero(k)}} = ${ohmsLatex(r3)}`,
      },
      {
        texto: 'R1, en derivación del lado de Z1',
        latex: `${formulas[1]} = ${derivacion(z1, z2)} = ${ohmsLatex(r1)}`,
      },
      {
        texto: 'R2, en derivación del lado de Z2',
        latex: `${formulas[2]} = ${derivacion(z2, z1)} = ${ohmsLatex(r2)}`,
      },
    ];
  }

  const zp = (r2 * z2) / (r2 + z2);
  const zEntrada = (r1 * (r3 + zp)) / (r1 + r3 + zp);
  const v2SobreV1 = zp / (r3 + zp);
  const atenuacion = atenuacionDe(zEntrada, z2, v2SobreV1);
  pasos.push(
    {
      texto: 'R2 en paralelo con la carga',
      latex:
        `Z_{\\mathrm{p}} = \\dfrac{R_2 Z_2}{R_2 + Z_2} = ` +
        `\\dfrac{${numero(r2)} \\cdot ${numero(z2)}}{${numero(r2)} + ${numero(z2)}} = ${ohmsLatex(zp)}`,
    },
    {
      texto: 'Impedancia de entrada con Z2 conectada',
      latex:
        `Z_{\\mathrm{ent}} = \\dfrac{R_1 (R_3 + Z_{\\mathrm{p}})}{R_1 + R_3 + Z_{\\mathrm{p}}} = ` +
        `\\dfrac{${numero(r1)} \\cdot (${numero(r3)} + ${numero(zp)})}{${numero(r1)} + ${numero(r3)} + ${numero(zp)}} = ` +
        ohmsLatex(zEntrada),
    },
    {
      texto: 'Tensión en la carga sobre tensión de entrada',
      latex:
        `\\dfrac{V_2}{V_1} = \\dfrac{Z_{\\mathrm{p}}}{R_3 + Z_{\\mathrm{p}}} = ` +
        `\\dfrac{${numero(zp)}}{${numero(r3)} + ${numero(zp)}} = ${numero(v2SobreV1)}`,
    },
    pasoAtenuacion(zEntrada, z2, v2SobreV1, atenuacion),
  );

  return {
    topologia: 'π',
    r1: resistencia('R1', r1, 'derivacion', 'Z1'),
    r2: resistencia('R2', r2, 'derivacion', 'Z2'),
    r3: resistencia('R3', r3, 'serie', null),
    formulas: ['K = 10^{A/20}', ...formulas],
    pasos,
    verificacion: { zEntrada, atenuacion },
  };
}

// --- Potencia (spec §10.3) -------------------------------------------------------------------------

const FUENTE_MARGEN =
  'Criterio de diseño: margen de 2×. No se asume ninguna lista de potencias comerciales.';

interface ResultadoPotencia {
  potencia: PotenciaRed;
  // Las fórmulas de la tarjeta, sin números.
  formulas: string[];
  pasos: Paso[];
}

interface TramoPotencia {
  nombre: string;
  // "P_{R_1} = P \dfrac{R_1}{Z_1}"
  formula: string;
  // El segundo miembro con los números, después de "P = ": "\dfrac{R_1}{Z_1}" sustituido.
  sustituida: string;
  disipada: number;
}

const pLatex = (p: number) => valorLatex(p, 'potencia');

// Una potencia por resistencia: la disipada y la nominal mínima sugerida, con sus pasos.
function armarPotencia(entrada: number, tramos: TramoPotencia[]): ResultadoPotencia {
  const margen = numero(MARGEN_DE_POTENCIA);
  const pasos: Paso[] = [];
  const resistencias: PotenciaResistencia[] = [];
  for (const t of tramos) {
    const nominalMinima = MARGEN_DE_POTENCIA * t.disipada;
    resistencias.push({ nombre: t.nombre, disipada: t.disipada, nominalMinima });
    pasos.push(
      {
        texto: `${t.nombre}: potencia disipada con ${formatearValor(entrada, 'potencia')} de entrada`,
        latex: `${t.formula} = ${t.sustituida} = ${pLatex(t.disipada)}`,
      },
      {
        texto: `${t.nombre}: potencia nominal mínima sugerida`,
        latex:
          `P_{\\mathrm{nom}} = ${margen} \\cdot P_{${t.nombre.replace('R', 'R_')}} = ` +
          `${margen} \\cdot ${pLatex(t.disipada)} = ${pLatex(nominalMinima)}`,
        fuente: FUENTE_MARGEN,
      },
    );
  }
  return {
    potencia: { entrada, margen: MARGEN_DE_POTENCIA, resistencias },
    formulas: [...tramos.map((t) => t.formula), `P_{\\mathrm{nom}} = ${margen} \\cdot P_R`],
    pasos,
  };
}

function potenciaDeT(
  red: SinCompletar,
  n: number,
  z1: number,
  z2: number,
  p: number,
): ResultadoPotencia {
  const [r1, r2, r3] = [red.r1.valor, red.r2.valor, red.r3.valor];
  const P = pLatex(p);
  const [Z1, Z2, R1, R2, R3] = [z1, z2, r1, r2, r3].map(ohmsLatex);
  return armarPotencia(p, [
    {
      nombre: 'R1',
      formula: 'P_{R_1} = P \\dfrac{R_1}{Z_1}',
      sustituida: `${P} \\cdot \\dfrac{${R1}}{${Z1}}`,
      disipada: (p * r1) / z1,
    },
    {
      nombre: 'R2',
      formula: 'P_{R_2} = P \\dfrac{R_2}{K^2 Z_2}',
      sustituida: `${P} \\cdot \\dfrac{${R2}}{${numero(n)} \\cdot ${Z2}}`,
      disipada: (p * r2) / (n * z2),
    },
    {
      nombre: 'R3',
      formula: 'P_{R_3} = P \\dfrac{(Z_1 - R_1)^2}{Z_1 R_3}',
      sustituida: `${P} \\cdot \\dfrac{(${Z1} - ${R1})^2}{${Z1} \\cdot ${R3}}`,
      disipada: (p * (z1 - r1) ** 2) / (z1 * r3),
    },
  ]);
}

function potenciaDePi(
  red: SinCompletar,
  k: number,
  n: number,
  z1: number,
  z2: number,
  p: number,
): ResultadoPotencia {
  const [r1, r2, r3] = [red.r1.valor, red.r2.valor, red.r3.valor];
  const P = pLatex(p);
  const [Z1, Z2, R1, R2, R3] = [z1, z2, r1, r2, r3].map(ohmsLatex);
  return armarPotencia(p, [
    {
      nombre: 'R1',
      formula: 'P_{R_1} = P \\dfrac{Z_1}{R_1}',
      sustituida: `${P} \\cdot \\dfrac{${Z1}}{${R1}}`,
      disipada: (p * z1) / r1,
    },
    {
      nombre: 'R2',
      formula: 'P_{R_2} = P \\dfrac{Z_2}{K^2 R_2}',
      sustituida: `${P} \\cdot \\dfrac{${Z2}}{${numero(n)} \\cdot ${R2}}`,
      disipada: (p * z2) / (n * r2),
    },
    {
      nombre: 'R3',
      formula: 'P_{R_3} = P \\dfrac{\\left(\\sqrt{Z_1} - \\sqrt{Z_2}/K\\right)^2}{R_3}',
      sustituida: `${P} \\cdot \\dfrac{\\left(\\sqrt{${Z1}} - \\sqrt{${Z2}}/${numero(k)}\\right)^2}{${R3}}`,
      disipada: (p * (Math.sqrt(z1) - Math.sqrt(z2) / k) ** 2) / r3,
    },
  ]);
}

// --- Pad de mínima pérdida (spec §10.2) ----------------------------------------------------------

export type CodigoCorteMinima = 'impedancias-iguales';

export type ResultadoMinimaPerdida =
  | { estado: 'corte'; codigo: CodigoCorteMinima; texto: string }
  | {
      estado: 'calculado';
      // K_min, la relación de tensiones del pad.
      k: number;
      aMin: number;
      pad: PadMinimaPerdida;
      avisos: readonly Aviso<CodigoAviso>[];
      referencias: readonly Referencia[];
      notas: readonly string[];
    };

// La red L de dos resistencias con la atenuación mínima que permite Z1 ≠ Z2: la serie del lado de
// la impedancia mayor y la de derivación del lado de la menor.
export function calcularMinimaPerdida({
  z1,
  z2,
  frecuencia = null,
  potencia = null,
}: EntradaMinimaPerdida): ResultadoMinimaPerdida {
  if (z1 === z2) {
    return {
      estado: 'corte',
      codigo: 'impedancias-iguales',
      texto: 'Con Z1 = Z2 no hay pad de mínima pérdida: la atenuación mínima es 0 dB.',
    };
  }
  const { aMin, kMin: k, pasos: pasosDeA } = atenuacionMinima(z1, z2);
  const mayor = Math.max(z1, z2);
  const menor = Math.min(z1, z2);
  const raiz = Math.sqrt(1 - menor / mayor);
  const rSerie = mayor * raiz;
  const rDerivacion = menor / raiz;
  // La serie va del lado de la impedancia mayor; si es Z1, la fuente ve primero la serie.
  const serieEnZ1 = z1 > z2;
  const serie = resistencia('R1', rSerie, 'serie', serieEnZ1 ? 'Z1' : 'Z2');
  const derivacion = resistencia('R3', rDerivacion, 'derivacion', serieEnZ1 ? 'Z2' : 'Z1');

  const formulas = [
    'A_{\\mathrm{min}} = 20 \\log_{10}\\left(\\sqrt{r} + \\sqrt{r - 1}\\right)',
    'R_1 = Z_{\\mathrm{mayor}} \\sqrt{1 - \\dfrac{Z_{\\mathrm{menor}}}{Z_{\\mathrm{mayor}}}}',
    'R_3 = \\dfrac{Z_{\\mathrm{menor}}}{\\sqrt{1 - \\dfrac{Z_{\\mathrm{menor}}}{Z_{\\mathrm{mayor}}}}}',
  ];
  const raizLatex = `\\sqrt{1 - \\dfrac{${numero(menor)}}{${numero(mayor)}}}`;
  const pasos: Paso[] = [
    ...pasosDeA,
    {
      texto: 'Relación de tensiones del pad de mínima pérdida',
      latex:
        `K_{\\mathrm{min}} = \\sqrt{r} + \\sqrt{r - 1} = 10^{A_{\\mathrm{min}}/20} = ` +
        `10^{${numero(aMin)}/20} = ${numero(k)}`,
    },
    {
      texto: `R1, en serie del lado de ${serie.lado} (la impedancia mayor)`,
      latex: `${formulas[1]} = ${numero(mayor)} \\cdot ${raizLatex} = ${ohmsLatex(rSerie)}`,
    },
    {
      texto: `R3, en derivación del lado de ${derivacion.lado} (la impedancia menor)`,
      latex: `${formulas[2]} = \\dfrac{${numero(menor)}}{${raizLatex}} = ${ohmsLatex(rDerivacion)}`,
    },
  ];

  // Con Z2 conectada: si la serie está del lado de Z1 la fuente la ve primero; si no, ve primero
  // la derivación y la serie queda entre ella y la carga.
  let zEntrada: number;
  let v2SobreV1: number;
  if (serieEnZ1) {
    zEntrada = rSerie + (rDerivacion * z2) / (rDerivacion + z2);
    v2SobreV1 = (zEntrada - rSerie) / zEntrada;
    pasos.push(
      {
        texto: 'Impedancia de entrada con Z2 conectada',
        latex:
          `Z_{\\mathrm{ent}} = R_1 + \\dfrac{R_3 Z_2}{R_3 + Z_2} = ` +
          `${numero(rSerie)} + \\dfrac{${numero(rDerivacion)} \\cdot ${numero(z2)}}` +
          `{${numero(rDerivacion)} + ${numero(z2)}} = ${ohmsLatex(zEntrada)}`,
      },
      {
        texto: 'Tensión en la carga sobre tensión de entrada',
        latex:
          `\\dfrac{V_2}{V_1} = \\dfrac{Z_{\\mathrm{ent}} - R_1}{Z_{\\mathrm{ent}}} = ` +
          `\\dfrac{${numero(zEntrada)} - ${numero(rSerie)}}{${numero(zEntrada)}} = ${numero(v2SobreV1)}`,
      },
    );
  } else {
    const hacia = rSerie + z2;
    zEntrada = (rDerivacion * hacia) / (rDerivacion + hacia);
    v2SobreV1 = z2 / hacia;
    pasos.push(
      {
        texto: 'Impedancia de entrada con Z2 conectada',
        latex:
          `Z_{\\mathrm{ent}} = \\dfrac{R_3 (R_1 + Z_2)}{R_3 + R_1 + Z_2} = ` +
          `\\dfrac{${numero(rDerivacion)} \\cdot (${numero(rSerie)} + ${numero(z2)})}` +
          `{${numero(rDerivacion)} + ${numero(rSerie)} + ${numero(z2)}} = ${ohmsLatex(zEntrada)}`,
      },
      {
        texto: 'Tensión en la carga sobre tensión de entrada',
        latex:
          `\\dfrac{V_2}{V_1} = \\dfrac{Z_2}{R_1 + Z_2} = ` +
          `\\dfrac{${numero(z2)}}{${numero(rSerie)} + ${numero(z2)}} = ${numero(v2SobreV1)}`,
      },
    );
  }
  const atenuacion = atenuacionDe(zEntrada, z2, v2SobreV1);
  pasos.push(pasoAtenuacion(zEntrada, z2, v2SobreV1, atenuacion));

  const entrada = potenciaValida(potencia);
  const conPotencia =
    entrada === null ? null : potenciaDePad(serie, derivacion, serieEnZ1, k, z1, z2, entrada);
  const revision = revisarValores({ serie, derivacion }, frecuencia ?? FRECUENCIA_POR_DEFECTO);

  return {
    estado: 'calculado',
    k,
    aMin,
    pad: {
      topologia: 'L',
      serie,
      derivacion,
      formulas: [...formulas, ...(conPotencia?.formulas ?? [])],
      pasos: [...pasos, ...(conPotencia?.pasos ?? []), ...revision.pasos],
      verificacion: { zEntrada, atenuacion },
      revision,
      potencia: conPotencia?.potencia ?? null,
    },
    avisos: avisosDe(aMin, frecuencia),
    referencias: REFERENCIAS_MINIMA_PERDIDA,
    notas: NOTAS_ATENUADORES,
  };
}

// Con la serie del lado de Z1 el pad es un T con R2 = 0 y valen las de R1 y R3 del T; con la
// derivación del lado de Z1, es un π con Rb abierta y valen las de Ra y Rs del π.
function potenciaDePad(
  serie: Resistencia,
  derivacion: Resistencia,
  serieEnZ1: boolean,
  k: number,
  z1: number,
  z2: number,
  p: number,
): ResultadoPotencia {
  const P = pLatex(p);
  const [Z1, Z2, R1, R3] = [z1, z2, serie.valor, derivacion.valor].map(ohmsLatex);
  if (serieEnZ1) {
    return armarPotencia(p, [
      {
        nombre: 'R1',
        formula: 'P_{R_1} = P \\dfrac{R_1}{Z_1}',
        sustituida: `${P} \\cdot \\dfrac{${R1}}{${Z1}}`,
        disipada: (p * serie.valor) / z1,
      },
      {
        nombre: 'R3',
        formula: 'P_{R_3} = P \\dfrac{(Z_1 - R_1)^2}{Z_1 R_3}',
        sustituida: `${P} \\cdot \\dfrac{(${Z1} - ${R1})^2}{${Z1} \\cdot ${R3}}`,
        disipada: (p * (z1 - serie.valor) ** 2) / (z1 * derivacion.valor),
      },
    ]);
  }
  return armarPotencia(p, [
    {
      nombre: 'R1',
      formula: 'P_{R_1} = P \\dfrac{\\left(\\sqrt{Z_1} - \\sqrt{Z_2}/K\\right)^2}{R_1}',
      sustituida: `${P} \\cdot \\dfrac{\\left(\\sqrt{${Z1}} - \\sqrt{${Z2}}/${numero(k)}\\right)^2}{${R1}}`,
      disipada: (p * (Math.sqrt(z1) - Math.sqrt(z2) / k) ** 2) / serie.valor,
    },
    {
      nombre: 'R3',
      formula: 'P_{R_3} = P \\dfrac{Z_1}{R_3}',
      sustituida: `${P} \\cdot \\dfrac{${Z1}}{${R3}}`,
      disipada: (p * z1) / derivacion.valor,
    },
  ]);
}
