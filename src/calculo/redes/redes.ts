import { formatearValor } from '../../entrada/formato';
import {
  BARRIDO,
  type Complejo,
  type ElementoBarrido,
  type RedBarrido,
  atenuacionDb,
  bordesMenos3dB,
  respuesta,
} from '../comun/barrido';
import { numeroLatex as numero, valorLatex } from '../comun/latex';
import {
  type Filtrado,
  type SeccionL,
  componenteDeReactancia,
  pasosSeccionL,
  qDeSeccionL,
  seccionL,
} from '../comun/red-l';
import type { Paso, Referencia } from '../comun/resultado';
import { type Revision, revisarValores } from '../comun/valor-impracticable';

// Redes de adaptación entre una fuente y una carga resistivas (spec §9). Por ahora la red L: sus dos
// variantes, pasa bajos y pasa altos, cada una con lo que hace fuera de f₀ según el barrido común.
// Puro: recibe Hz, ohms y el Q de la bobina, y devuelve los valores con sus fórmulas y sus pasos.

export interface EntradaRedL {
  // En Hz.
  f0: number;
  rs: number;
  rl: number;
  // Para la pérdida estimada: una R de ω₀·L/Q en serie con cada L.
  qBobina: number;
}

export type CodigoCorte = 'entrada-invalida' | 'ya-adaptada';

export type Lado = 'R_s' | 'R_L';

export interface ComponenteRed {
  componente: 'L' | 'C';
  // "L1", "C1"
  nombre: string;
  // En H o F.
  valor: number;
  // En Ω, con signo: X > 0 es una L.
  reactancia: number;
  posicion: 'serie' | 'derivacion';
  lado: Lado;
}

// Lo que hace la variante fuera de f₀ (spec §9.5).
export interface BarridoVariante {
  // En Hz; null si no hay cruce en el rango barrido.
  fInf: number | null;
  fSup: number | null;
  // Solo con los dos bordes.
  bw: number | null;
  f0SobreBw: number | null;
  // Con el circuito ideal, en dB.
  atenuacion2f0: number;
  atenuacion3f0: number;
  // Estimación: con una R de ω₀·L/Q en serie con cada L y los capacitores ideales, en dB.
  perdidaInsercion: number;
}

export interface VarianteL {
  filtrado: Filtrado;
  q: number;
  // De la fuente a la carga.
  componentes: readonly ComponenteRed[];
  // Las de Bowick: "deja pasar la continua" o "bloquea la continua", y "atenúa armónicas".
  etiquetas: readonly string[];
  // Con R_L conectada, en f₀ y con el circuito ideal: tiene que dar R_s.
  zEntrada: Complejo;
  barrido: BarridoVariante;
  // Las fórmulas que se usaron, sin números: van a la vista en la tarjeta.
  formulas: readonly string[];
  pasos: readonly Paso[];
  // Valor dudoso o impracticable de cada L y C en f₀ (spec §5.6). Su cuenta está al final de pasos.
  revision: Revision;
}

export type ResultadoRedL =
  | { estado: 'corte'; codigo: CodigoCorte; texto: string }
  | {
      estado: 'calculado';
      q: number;
      // El resultado principal: la fórmula del Q, sin números y sustituida.
      formula: string;
      pasos: readonly Paso[];
      // Pasa bajos primero; ninguna se destaca.
      variantes: readonly VarianteL[];
      referencias: readonly Referencia[];
      notas: readonly string[];
    };

export const REFERENCIAS_RED_L: readonly Referencia[] = [
  {
    autor: 'C. Bowick',
    obra: 'RF Circuit Design',
    edicion: '1.ª',
    editor: 'Sams',
    anio: 1982,
    ubicacion: 'cap. 2, ec. 2-7 y 2-8, y cap. 4, ec. 4-1 a 4-3',
  },
  {
    autor: 'B. Becciolini',
    obra: 'Impedance Matching Networks Applied to RF Power Transistors',
    volumen: 'AN721',
    editor: 'Motorola',
    anio: 1974,
    ubicacion: 'sección 4.1.1 (fórmulas cerradas)',
  },
];

export const NOTAS_REDES: readonly string[] = [
  'Los valores no se redondean a una serie E: para el ajuste fino en f₀, armá cada capacitor con ' +
    'un fijo y un trimmer en paralelo.',
  'La pérdida de inserción es una estimación: una R de ω₀·L/Q en serie con cada L, con los ' +
    'capacitores ideales. El ancho de banda y la atenuación de armónicas son del circuito ideal.',
];

export const SUGERENCIA_REDES = 'Probá otra variante o bajá el Q de diseño.';

const ETIQUETA_CONTINUA: Record<Filtrado, string> = {
  'pasa-bajos': 'deja pasar la continua',
  'pasa-altos': 'bloquea la continua',
};
const ETIQUETA_ARMONICAS = 'atenúa armónicas';

const FORMULA_Q = 'Q = \\sqrt{\\dfrac{R_{\\mathrm{mayor}}}{R_{\\mathrm{menor}}} - 1}';
const FORMULA_S21 =
  '|S_{21}|^2 = \\dfrac{4 R_s R_L}{\\left|A R_L + B + C R_s R_L + D R_s\\right|^2}';

const ohms = (r: number) => valorLatex(r, 'resistencia');
const hz = (f: number) => valorLatex(f, 'frecuencia');
const db = (x: number) => valorLatex(x, 'decibeles');

export function calcularRedL({ f0, rs, rl, qBobina }: EntradaRedL): ResultadoRedL {
  if (!(rs > 0 && rl > 0 && f0 > 0 && qBobina > 0)) {
    return {
      estado: 'corte',
      codigo: 'entrada-invalida',
      texto: 'Rs, RL, f₀ y el Q de la bobina tienen que ser mayores que cero.',
    };
  }
  if (rs === rl) {
    return {
      estado: 'corte',
      codigo: 'ya-adaptada',
      texto: 'Ya está adaptada, no hace falta red.',
    };
  }

  const [rMenor, rMayor] = rs < rl ? [rs, rl] : [rl, rs];
  const simbolos = rs < rl ? { menor: 'R_s', mayor: 'R_L' } : { menor: 'R_L', mayor: 'R_s' };
  const q = qDeSeccionL(rMenor, rMayor);
  const pasoQ: Paso = {
    texto: 'Q de la red L: lo fijan las dos resistencias',
    latex:
      `${FORMULA_Q} = \\sqrt{\\dfrac{${simbolos.mayor}}{${simbolos.menor}} - 1} = ` +
      `\\sqrt{\\dfrac{${numero(rMayor)}}{${numero(rMenor)}} - 1} = ${numero(q)}`,
    fuente: 'Bowick, RF Circuit Design, ec. 4-1.',
  };
  const entrada = { f0, rs, rl, qBobina };
  return {
    estado: 'calculado',
    q,
    formula: FORMULA_Q,
    pasos: [pasoQ],
    variantes: (['pasa-bajos', 'pasa-altos'] as const).map((filtrado) =>
      variante(seccionL(rMenor, rMayor, filtrado), simbolos, entrada),
    ),
    referencias: REFERENCIAS_RED_L,
    notas: NOTAS_REDES,
  };
}

function variante(
  seccion: SeccionL,
  simbolos: { menor: string; mayor: string },
  { f0, rs, rl, qBobina }: EntradaRedL,
): VarianteL {
  const omega = 2 * Math.PI * f0;
  // La serie va del lado de la R menor: con R_s < R_L, la fuente la ve primero.
  const serieEnFuente = rs < rl;
  const armar = (x: number, posicion: ComponenteRed['posicion']): ComponenteRed => {
    const c = componenteDeReactancia(x, omega);
    const lado: Lado = (posicion === 'serie') === serieEnFuente ? 'R_s' : 'R_L';
    return { ...c, nombre: `${c.componente}1`, reactancia: x, posicion, lado };
  };
  const serie = armar(seccion.xSerie, 'serie');
  const derivacion = armar(seccion.xDerivacion, 'derivacion');
  const componentes = serieEnFuente ? [serie, derivacion] : [derivacion, serie];

  const ideal: RedBarrido = { rs, rl, elementos: componentes.map((c) => elementoDe(c)) };
  const zEntrada = respuesta(ideal, f0).zEntrada;
  const { barrido, pasos: pasosBarrido } = barrer(ideal, componentes, f0, qBobina);
  const revision = revisarValores(componentes, f0, { sugerencia: SUGERENCIA_REDES });

  const pasos: Paso[] = [
    ...pasosSeccionL(seccion, simbolos),
    ...componentes.map((c) => pasoComponente(c, f0)),
    pasoZEntrada(serie, derivacion, serieEnFuente, rl, zEntrada),
    ...pasosBarrido,
    ...revision.pasos,
  ];
  const { menor, mayor } = simbolos;
  const filtra = seccion.filtrado === 'pasa-bajos';
  return {
    filtrado: seccion.filtrado,
    q: seccion.q,
    componentes,
    etiquetas: [ETIQUETA_CONTINUA[seccion.filtrado], ...(filtra ? [ETIQUETA_ARMONICAS] : [])],
    zEntrada,
    barrido,
    formulas: [
      filtra ? `X_s = Q\\,${menor}` : `X_s = -Q\\,${menor}`,
      filtra ? `X_p = -\\dfrac{${mayor}}{Q}` : `X_p = \\dfrac{${mayor}}{Q}`,
      'L = \\dfrac{X}{\\omega_0}',
      'C = -\\dfrac{1}{\\omega_0 X}',
      FORMULA_S21,
    ],
    pasos,
    revision,
  };
}

function elementoDe(c: ComponenteRed, rSerie?: number): ElementoBarrido {
  return {
    componente: c.componente,
    posicion: c.posicion,
    valor: c.valor,
    ...(rSerie !== undefined && { rSerie }),
  };
}

function pasoComponente(c: ComponenteRed, f0: number): Paso {
  const donde = c.posicion === 'serie' ? 'en serie' : 'en derivación';
  const x = numero(c.reactancia);
  return c.componente === 'L'
    ? {
        texto: `${c.nombre}, ${donde}`,
        latex:
          `L = \\dfrac{X}{2\\pi f_0} = \\dfrac{${x}}{2\\pi \\cdot ${hz(f0)}} = ` +
          valorLatex(c.valor, 'inductancia'),
      }
    : {
        texto: `${c.nombre}, ${donde}`,
        latex:
          `C = -\\dfrac{1}{2\\pi f_0 X} = -\\dfrac{1}{2\\pi \\cdot ${hz(f0)} \\cdot (${x})}` +
          ` = ${valorLatex(c.valor, 'capacidad')}`,
      };
}

// "1000 + j0 Ω": la parte imaginaria que queda es redondeo de la aritmética.
function complejoLatex(z: Complejo): string {
  const im = Math.abs(z.im) < 1e-9 * Math.abs(z.re) ? 0 : z.im;
  return `${numero(z.re)} ${im < 0 ? '-' : '+'} j${numero(Math.abs(im))}\\,\\mathrm{\\Omega}`;
}

function pasoZEntrada(
  serie: ComponenteRed,
  derivacion: ComponenteRed,
  serieEnFuente: boolean,
  rl: number,
  z: Complejo,
): Paso {
  const [xs, xp, carga] = [numero(serie.reactancia), numero(derivacion.reactancia), numero(rl)];
  const latex = serieEnFuente
    ? `Z_{\\mathrm{ent}} = jX_s + \\dfrac{R_L \\cdot jX_p}{R_L + jX_p} = ` +
      `j(${xs}) + \\dfrac{${carga} \\cdot j(${xp})}{${carga} + j(${xp})} = ${complejoLatex(z)}`
    : `Z_{\\mathrm{ent}} = \\dfrac{jX_p \\left(R_L + jX_s\\right)}{jX_p + R_L + jX_s} = ` +
      `\\dfrac{j(${xp}) \\cdot \\left(${carga} + j(${xs})\\right)}{j(${xp}) + ${carga} + j(${xs})} = ` +
      complejoLatex(z);
  return { texto: 'Verificación: impedancia de entrada con RL conectada, en f₀', latex };
}

// El barrido del circuito ideal y la pérdida con el Q de la bobina (spec §9.5).
function barrer(
  ideal: RedBarrido,
  componentes: readonly ComponenteRed[],
  f0: number,
  qBobina: number,
): { barrido: BarridoVariante; pasos: Paso[] } {
  const { fInf, fSup } = bordesMenos3dB(ideal, f0);
  const bw = fInf !== null && fSup !== null ? fSup - fInf : null;
  const atenuacion2f0 = atenuacionDb(ideal, 2 * f0);
  const atenuacion3f0 = atenuacionDb(ideal, 3 * f0);

  const rPerdida = (l: ComponenteRed) => (2 * Math.PI * f0 * l.valor) / qBobina;
  const conPerdida: RedBarrido = {
    ...ideal,
    elementos: componentes.map((c) =>
      elementoDe(c, c.componente === 'L' ? rPerdida(c) : undefined),
    ),
  };
  const perdidaInsercion = atenuacionDb(conPerdida, f0);

  const desde = formatearValor(BARRIDO.desde * f0, 'frecuencia', 'paso');
  const hasta = formatearValor(BARRIDO.hasta * f0, 'frecuencia', 'paso');
  const fuenteBarrido =
    `Barrido del circuito ideal de ${desde} a ${hasta} (f₀/50 a 50·f₀), con ` +
    `${BARRIDO.puntosPorDecada} puntos por década desde f₀ hacia cada lado y el cruce refinado por ` +
    'bisección.';
  const borde = (nombre: string, f: number | null, falta: string) =>
    f === null ? `\\text{${falta}}` : `${nombre} = ${hz(f)}`;
  const pasos: Paso[] = [
    {
      texto: 'Bordes a −3 dB de la ganancia en f₀',
      latex:
        `${borde('f_{\\mathrm{inf}}', fInf, 'sin borde inferior')},\\; ` +
        borde('f_{\\mathrm{sup}}', fSup, 'sin borde superior'),
      fuente: fuenteBarrido,
    },
    ...(bw === null
      ? []
      : [
          {
            texto: 'Ancho de banda',
            latex:
              `BW = f_{\\mathrm{sup}} - f_{\\mathrm{inf}} = ${hz(fSup!)} - ${hz(fInf!)} = ${hz(bw)},\\; ` +
              `\\dfrac{f_0}{BW} = ${numero(f0 / bw)}`,
          },
        ]),
    {
      texto: 'Atenuación en la segunda y la tercera armónica',
      latex:
        `A(2f_0) = -10 \\log_{10}\\left|S_{21}(2f_0)\\right|^2 = ${db(atenuacion2f0)},\\; ` +
        `A(3f_0) = ${db(atenuacion3f0)}`,
    },
    ...componentes
      .filter((c) => c.componente === 'L')
      .map((c) => ({
        texto: `${c.nombre}: resistencia de pérdida con Q = ${formatearValor(qBobina, 'numero', 'paso')}`,
        latex:
          `r = \\dfrac{2\\pi f_0 L}{Q} = \\dfrac{2\\pi \\cdot ${hz(f0)} \\cdot ` +
          `${valorLatex(c.valor, 'inductancia')}}{${numero(qBobina)}} = ` +
          ohms(rPerdida(c)),
      })),
    {
      texto: 'Pérdida de inserción en f₀ (estimación)',
      latex: `IL = -10 \\log_{10}\\left|S_{21}(f_0)\\right|^2 = ${db(perdidaInsercion)}`,
      fuente: 'Una R de ω₀·L/Q en serie con cada L; capacitores ideales (spec §9.5).',
    },
  ];
  return {
    barrido: {
      fInf,
      fSup,
      bw,
      f0SobreBw: bw === null ? null : f0 / bw,
      atenuacion2f0,
      atenuacion3f0,
      perdidaInsercion,
    },
    pasos,
  };
}
