import type { Magnitud } from '../../entrada/campos';
import { formatearValor } from '../../entrada/formato';
import { numeroLatex as numero, valorLatex } from './latex';
import type { EntradaRegistro } from './registro';
import type { Paso } from './resultado';

// Criterio común de valor impracticable (spec §5.6): cada L, C y R del resultado de una Calculadora
// se revisa contra el montaje Manhattan que usa la materia. Una sola medida, el error relativo de
// la impedancia, con dos niveles. Nunca se bloquea un valor: solo se marca.

// Un L, C o R de un resultado. La revisión los busca por esta forma en todo el resultado, así que
// una Calculadora no la llama para cada valor.
export interface Componente {
  componente: 'L' | 'C' | 'R';
  // Como se ve en la tarjeta: "R1", "C2".
  nombre: string;
  // En H, F u Ω.
  valor: number;
}

// Ámbar para Valor dudoso, rojo para Valor impracticable.
export type Nivel = 'dudoso' | 'impracticable';

export interface ValorMarcado {
  nombre: string;
  componente: Componente['componente'];
  valor: number;
  nivel: Nivel;
  // Fracción: 0,6 es 60 %.
  error: number;
  // Con el nombre y los números: "L1: suponiendo montaje Manhattan, ±3 nH → 60 % de error".
  motivo: string;
}

export interface Revision {
  marcados: readonly ValorMarcado[];
  // La cuenta de cada valor marcado, con su fuente.
  pasos: readonly Paso[];
  // La de la Calculadora, para el pie de la tarjeta: "Probá otra variante o bajá el Q de diseño."
  sugerencia: string | null;
}

// El montaje supuesto, sin preguntarle al Alumno: Manhattan con terminales cortos. Si la Cátedra
// mide un montaje, se cambia acá.
export const MONTAJE = {
  // Incertidumbre de L por nodo: terminales de 0,4 nH/mm cerca del plano, ±5 a 7 mm de incierto.
  deltaL: 3e-9,
  // Incertidumbre de C por nodo: islas de FR-4 de 3×3 a 5×5 mm, de 0,2 a 0,8 pF a masa.
  deltaC: 0.5e-12,
  // ESL de un capacitor radial de paso 2,54 mm con terminales de 3 mm.
  esl: 2.8e-9,
  // Resistencia axial de película: Ls en serie y Cp en paralelo (Brinson, ajuste a medición).
  resistencia: { ls: 4.5e-9, cp: 0.43e-12 },
} as const;

const DUDOSO = 0.2;
const IMPRACTICABLE = 0.5;

function nivelDe(error: number): Nivel | null {
  if (error >= IMPRACTICABLE) return 'impracticable';
  if (error >= DUDOSO) return 'dudoso';
  return null;
}

// Una fracción como porcentaje: 0,6 es "60 %".
const porcentaje = (fraccion: number) => formatearValor(fraccion * 100, 'porcentaje');

// Los parámetros del montaje, escritos para los motivos, los pasos y el registro.
const DELTA_L = formatearValor(MONTAJE.deltaL, 'inductancia');
const DELTA_C = formatearValor(MONTAJE.deltaC, 'capacidad');
const ESL = formatearValor(MONTAJE.esl, 'inductancia');
const LS = formatearValor(MONTAJE.resistencia.ls, 'inductancia');
const CP = formatearValor(MONTAJE.resistencia.cp, 'capacidad');

// Los umbrales son un Criterio práctico: la Cátedra los aprueba como criterio (spec §13.5).
export const CRITERIO_UMBRALES: EntradaRegistro = {
  tipo: 'criterio-practico',
  id: 'umbrales-valor-impracticable',
  nombre: 'Umbrales de Valor dudoso y Valor impracticable',
  queEs:
    `Cada L, C y R calculado se revisa con el error relativo de su impedancia armado en Manhattan ` +
    `con terminales cortos: ±${DELTA_L} y ±${DELTA_C} por nodo, ${ESL} de ESL en los ` +
    `capacitores y resistencias axiales de película con ${LS} en serie y ${CP} en paralelo. Con ` +
    `${porcentaje(DUDOSO)} o más es Valor dudoso; con ${porcentaje(IMPRACTICABLE)} o más, ` +
    'Valor impracticable. El valor se muestra siempre, marcado.',
  adaptacion:
    'La bibliografía da parásitas de componentes y fórmulas de terminales, no un corte. El ' +
    'montaje se supone sin preguntarle al Alumno porque en la materia se arma en Manhattan, y se ' +
    'usa una sola medida para L, C y R para que los dos niveles digan lo mismo en los tres. Los ' +
    'mínimos de L y C son fijos porque la incertidumbre del montaje no depende de f; la C máxima ' +
    'y el rango de R dependen de f y solo se evalúan cuando la Calculadora la conoce.',
  respaldo:
    'research/valor-impracticable.md: terminales con la NBS Circular 74, ESL de KYOCERA AVX, ' +
    'modelo de resistencia de KOA y parásitas del axial de Brinson (ajuste a medición). No se ' +
    'contrastó con el ARRL Handbook ni con Experimental Methods in RF Design, ni se midió un ' +
    'montaje con un analizador.',
  planB:
    'Se ajustan los niveles o los parámetros del montaje, que están en un solo lugar ' +
    '(MONTAJE en src/calculo/comun/valor-impracticable.ts).',
  bandera: null,
};

// Un corte, en H, F u Ω, para cada nivel.
export interface Limite {
  dudoso: number;
  impracticable: number;
}

// Los umbrales que resultan de la medida (§5.6). No es una tabla aparte: sirven para verificarla y
// para quien necesite el corte de antemano, como la Ventana de L. Null lo que necesita f.
export interface Umbrales {
  lMin: Limite;
  cMin: Limite;
  cMax: Limite | null;
  rMin: Limite | null;
  rMax: Limite | null;
}

export function umbrales(frecuencia: number | null): Umbrales {
  const limite = (de: (k: number) => number): Limite => ({
    dudoso: de(DUDOSO),
    impracticable: de(IMPRACTICABLE),
  });
  const omega = frecuencia === null ? null : 2 * Math.PI * frecuencia;
  const { ls, cp } = MONTAJE.resistencia;
  return {
    lMin: limite((k) => MONTAJE.deltaL / k),
    cMin: limite((k) => MONTAJE.deltaC / k),
    // (f/f_SRF)²/(1 − (f/f_SRF)²) = k da (f/f_SRF)² = k/(1 + k): 1/6 o 1/3.
    cMax: omega === null ? null : limite((k) => k / (1 + k) / (omega ** 2 * MONTAJE.esl)),
    rMin: omega === null ? null : limite((k) => (omega * ls) / k),
    rMax: omega === null ? null : limite((k) => k / (omega * cp)),
  };
}

// Una de las cuentas de §5.6 sobre un valor: el error, el motivo y la cuenta con su fuente.
interface Chequeo {
  error: number;
  // Sin el nombre: "suponiendo montaje Manhattan, ±3 nH → 60 % de error".
  motivo: string;
  pasos: Paso[];
}

const FUENTE_L =
  `±${DELTA_L} por nodo: terminales de 0,4 nH/mm cerca del plano (NBS, Circular 74, §67) con ` +
  '±5 a 7 mm de incierto. Criterio práctico.';
const FUENTE_C =
  `±${DELTA_C} por nodo: islas de FR-4 de 3×3 a 5×5 mm, que suman de 0,2 a 0,8 pF a masa ` +
  '(cálculo propio). Criterio práctico.';
const FUENTE_ESL =
  `ESL de ${ESL}: radial de paso 2,54 mm con terminales de 3 mm, sobre la ESL medida por ` +
  'KYOCERA AVX (Cain, Parasitic Inductance of Multilayer Ceramic Capacitors).';
const FUENTE_R =
  `Modelo (R + jωLs) ∥ Cp de KOA (KDST_TN-010); Ls = ${LS} y Cp = ${CP} del axial de ` +
  'película de Brinson (documentación de Qucs, ajuste a medición).';

function incertidumbre(c: Componente, delta: number, magnitud: Magnitud): Chequeo {
  const error = delta / c.valor;
  const [simbolo, fuente] = c.componente === 'L' ? ['L', FUENTE_L] : ['C', FUENTE_C];
  return {
    error,
    motivo:
      `suponiendo montaje Manhattan, ±${formatearValor(delta, magnitud)} → ` +
      `${porcentaje(error)} de error`,
    pasos: [
      {
        texto: `${c.nombre}: incertidumbre del montaje sobre ${simbolo}`,
        latex:
          `\\dfrac{\\Delta ${simbolo}}{${simbolo}} = ` +
          `\\dfrac{${valorLatex(delta, magnitud)}}{${valorLatex(c.valor, magnitud)}} = ${numero(error)}`,
        fuente,
      },
    ],
  };
}

const aFrecuencia = (f: number) => ` a ${formatearValor(f, 'frecuencia')}`;
const hz = (f: number) => valorLatex(f, 'frecuencia');

// La C efectiva con su ESL es C/(1 − (f/f_SRF)²): el error es (f/f_SRF)²/(1 − (f/f_SRF)²). Por
// encima de la autorresonancia el capacitor ya es inductivo.
function autorresonancia(c: Componente, f: number): Chequeo {
  const srf = 1 / (2 * Math.PI * Math.sqrt(MONTAJE.esl * c.valor));
  const x2 = (f / srf) ** 2;
  const esl = `(ESL de ${ESL})`;
  const pasoSrf: Paso = {
    texto: `${c.nombre}: autorresonancia con la ESL`,
    latex:
      `f_{\\mathrm{SRF}} = \\dfrac{1}{2\\pi\\sqrt{\\mathrm{ESL} \\cdot C}} = ` +
      `\\dfrac{1}{2\\pi\\sqrt{${valorLatex(MONTAJE.esl, 'inductancia')} \\cdot ` +
      `${valorLatex(c.valor, 'capacidad')}}} = ${hz(srf)}`,
    fuente: FUENTE_ESL,
  };
  if (x2 >= 1) {
    return {
      error: Infinity,
      motivo: `por encima de su autorresonancia ${esl}${aFrecuencia(f)}`,
      pasos: [
        pasoSrf,
        {
          texto: `${c.nombre}: por encima de su autorresonancia, ya es inductiva`,
          latex: `f = ${hz(f)} \\geq f_{\\mathrm{SRF}}`,
        },
      ],
    };
  }
  const error = x2 / (1 - x2);
  const cociente = `\\left(\\dfrac{${hz(f)}}{${hz(srf)}}\\right)^2`;
  return {
    error,
    motivo: `cerca de su autorresonancia ${esl} → ${porcentaje(error)} de error${aFrecuencia(f)}`,
    pasos: [
      pasoSrf,
      {
        texto: `${c.nombre}: corrimiento de la C efectiva`,
        latex:
          `\\dfrac{(f/f_{\\mathrm{SRF}})^2}{1 - (f/f_{\\mathrm{SRF}})^2} = ` +
          `\\dfrac{${cociente}}{1 - ${cociente}} = ${numero(error)}`,
      },
    ],
  };
}

// La reactancia parásita del axial sobre R: ω·Ls/R en el extremo bajo y ω·Cp·R en el alto.
function parasitasDeR(c: Componente, f: number): Chequeo {
  const omega = 2 * Math.PI * f;
  const { ls, cp } = MONTAJE.resistencia;
  const inductiva = (omega * ls) / c.valor;
  const capacitiva = omega * cp * c.valor;
  const r = valorLatex(c.valor, 'resistencia');
  const [error, parasita, latex] =
    inductiva >= capacitiva
      ? [
          inductiva,
          `${LS} en serie`,
          `\\dfrac{\\omega L_s}{R} = ` +
            `\\dfrac{2\\pi \\cdot ${hz(f)} \\cdot ${valorLatex(ls, 'inductancia')}}{${r}}`,
        ]
      : [
          capacitiva,
          `${CP} en paralelo`,
          `\\omega C_p R = 2\\pi \\cdot ${hz(f)} \\cdot ${valorLatex(cp, 'capacidad')} \\cdot ${r}`,
        ];
  return {
    error,
    motivo:
      `suponiendo resistencia axial de película, ${parasita} → ${porcentaje(error)} de error` +
      aFrecuencia(f),
    pasos: [
      {
        texto: `${c.nombre}: reactancia parásita sobre R${aFrecuencia(f)}`,
        latex: `${latex} = ${numero(error)}`,
        fuente: FUENTE_R,
      },
    ],
  };
}

// Criterio mixto: los mínimos de L y C son fijos; la C máxima y el rango de R solo con f.
function chequeos(c: Componente, f: number | null): Chequeo[] {
  switch (c.componente) {
    case 'L':
      return [incertidumbre(c, MONTAJE.deltaL, 'inductancia')];
    case 'C':
      return [
        incertidumbre(c, MONTAJE.deltaC, 'capacidad'),
        ...(f === null ? [] : [autorresonancia(c, f)]),
      ];
    case 'R':
      return f === null ? [] : [parasitasDeR(c, f)];
  }
}

// Revisa cada L, C y R del resultado, a la frecuencia de evaluación que declara la Calculadora
// (null si no la conoce: solo quedan los mínimos de L y C).
export function revisarValores(
  resultado: unknown,
  frecuencia: number | null,
  { sugerencia }: { sugerencia?: string } = {},
): Revision {
  const marcados: ValorMarcado[] = [];
  const pasos: Paso[] = [];
  for (const c of componentesDe(resultado)) {
    // El peor de los chequeos del valor.
    const peor = chequeos(c, frecuencia).reduce<Chequeo | null>(
      (p, ch) => (!p || ch.error > p.error ? ch : p),
      null,
    );
    const nivel = peor && nivelDe(peor.error);
    if (!peor || !nivel) continue;
    marcados.push({
      nombre: c.nombre,
      componente: c.componente,
      valor: c.valor,
      nivel,
      error: peor.error,
      motivo: `${c.nombre}: ${peor.motivo}`,
    });
    pasos.push(...peor.pasos);
  }
  return { marcados, pasos, sugerencia: sugerencia ?? null };
}

function esComponente(x: object): x is Componente {
  const c = x as Partial<Componente>;
  return (
    (c.componente === 'L' || c.componente === 'C' || c.componente === 'R') &&
    typeof c.nombre === 'string' &&
    typeof c.valor === 'number'
  );
}

// Cada Componente del resultado, a cualquier profundidad y una sola vez.
function componentesDe(raiz: unknown): Componente[] {
  const encontrados: Componente[] = [];
  const vistos = new Set<object>();
  const visitar = (x: unknown) => {
    if (typeof x !== 'object' || x === null || vistos.has(x)) return;
    vistos.add(x);
    if (esComponente(x)) encontrados.push(x);
    for (const hijo of Object.values(x)) visitar(hijo);
  };
  visitar(raiz);
  return encontrados;
}
