import { formatearValor } from '../../entrada/formato';
import { type Complejo, type RedBarrido, respuesta } from '../comun/barrido';
import { numeroLatex as numero, valorLatex } from '../comun/latex';
import {
  type Filtrado,
  type SeccionL,
  componenteDeReactancia,
  pasosSeccionL,
  seccionL,
} from '../comun/red-l';
import type { Aviso, Paso, Referencia } from '../comun/resultado';
import { revisarValores } from '../comun/valor-impracticable';
import {
  type ComponenteRed,
  type Lado,
  type ResultadoRedL,
  type VarianteRed,
  ETIQUETA_ARMONICAS,
  ETIQUETA_CONTINUA,
  FORMULA_S21,
  NOTAS_REDES,
  SUGERENCIA_REDES,
  barrer,
  calcularRedL,
  complejoLatex,
  elementoDe,
  pasoComponente,
} from './redes';

// Las redes π y T de la Calculadora de redes de adaptación (spec §9): dos redes L espalda con
// espalda que pasan por una Resistencia virtual. El Alumno fija el Q de diseño, el de la sección de
// mayor Q, y salen todas las variantes con solución. Puro: recibe Hz, ohms y los Q.

export type TopologiaPiT = 'π' | 'T';

export interface EntradaRedPiT {
  topologia: TopologiaPiT;
  // En Hz.
  f0: number;
  rs: number;
  rl: number;
  // Para la pérdida estimada: una R de ω₀·L/Q en serie con cada L.
  qBobina: number;
  // El Q de diseño; null si el Alumno todavía no lo escribió.
  q: number | null;
}

// Cada sección L es pasa bajos o pasa altos. Las mixtas se nombran por la sección del lado de la
// fuente y la del lado de la carga.
export type TipoVariantePiT =
  'pasa-bajos' | 'pasa-altos' | 'mixta-bajos-altos' | 'mixta-altos-bajos';

export type CodigoCortePiT = 'entrada-invalida' | 'falta-q' | 'q-bajo';

export type CodigoAvisoPiT = 'q-alto' | 'rs-igual-rl';

export interface SeccionPiT {
  // La resistencia de la terminal que toca la sección.
  lado: Lado;
  q: number;
}

export interface VariantePiT extends VarianteRed {
  tipo: TipoVariantePiT;
  // Del lado de la fuente y del de la carga.
  secciones: readonly [SeccionPiT, SeccionPiT];
  // La estimación de Kaune: Q_BW ≈ (Q₁ + Q₂)/2 y BW ≈ f₀/Q_BW. No es el resultado: ese es el del
  // barrido.
  qBw: number;
  bwKaune: number;
}

type Calculado = {
  estado: 'calculado';
  topologia: TopologiaPiT;
  q: number;
  qMinimo: number;
  resistenciaVirtual: number;
  // Las fórmulas del resultado principal, sin números.
  formulas: readonly string[];
  pasos: readonly Paso[];
  // Pasa bajos, pasa altos y las mixtas; ninguna se destaca.
  variantes: readonly VariantePiT[];
  referencias: readonly Referencia[];
  avisos: readonly Aviso<CodigoAvisoPiT>[];
  notas: readonly string[];
};

export type ResultadoRedPiT =
  | { estado: 'corte'; codigo: CodigoCortePiT; texto: string; qMinimo: number | null }
  // Con Q igual al mínimo no hay Resistencia virtual: la red es una L, y es la que se muestra.
  | {
      estado: 'reducida-a-l';
      q: number;
      qMinimo: number;
      texto: string;
      redL: Extract<ResultadoRedL, { estado: 'calculado' }>;
    }
  | Calculado;

export const REFERENCIAS_RED_PI_T: readonly Referencia[] = [
  {
    autor: 'C. Bowick',
    obra: 'RF Circuit Design',
    edicion: '1.ª',
    editor: 'Sams',
    anio: 1982,
    ubicacion: 'cap. 2, ec. 2-7 y 2-8, y cap. 4, ec. 4-1 a 4-5',
  },
  {
    autor: 'B. Becciolini',
    obra: 'Impedance Matching Networks Applied to RF Power Transistors',
    volumen: 'AN721',
    editor: 'Motorola',
    anio: 1974,
    ubicacion: 'sección 4.1.2 (fórmulas cerradas de la π y la T)',
  },
  {
    autor: 'W. Kaune',
    obra: 'Quality Factor, Bandwidth, and Harmonic Attenuation of Pi Networks',
    volumen: 'QEX, sept./oct.',
    editor: 'ARRL',
    anio: 2015,
    ubicacion: 'estimación del ancho de banda',
  },
];

// Arriba de este Q el aviso de más pérdida, más tensión y corriente, y ajuste crítico (spec §9.4).
const Q_ALTO = 20;
// Para decidir que el Q de diseño es el mínimo: lo que escribe el Alumno no es el de la raíz.
const TOLERANCIA_Q = 1e-9;
// Una rama neta que se anula contra sus sumandos no existe.
const TOLERANCIA_RAMA = 1e-9;

const FILTRADOS: Record<TipoVariantePiT, readonly [Filtrado, Filtrado]> = {
  'pasa-bajos': ['pasa-bajos', 'pasa-bajos'],
  'pasa-altos': ['pasa-altos', 'pasa-altos'],
  'mixta-bajos-altos': ['pasa-bajos', 'pasa-altos'],
  'mixta-altos-bajos': ['pasa-altos', 'pasa-bajos'],
};
const ORDEN: readonly TipoVariantePiT[] = [
  'pasa-bajos',
  'pasa-altos',
  'mixta-bajos-altos',
  'mixta-altos-bajos',
];

const FORMULA_Q_MINIMO =
  'Q_{\\min} = \\sqrt{\\dfrac{R_{\\mathrm{mayor}}}{R_{\\mathrm{menor}}} - 1}';
const FORMULA_RV: Record<TopologiaPiT, string> = {
  π: 'R_v = \\dfrac{R_{\\mathrm{mayor}}}{Q^2 + 1}',
  T: 'R_v = R_{\\mathrm{menor}}\\left(Q^2 + 1\\right)',
};

const numeroTexto = (x: number) => formatearValor(x, 'numero');
const ohms = (r: number) => valorLatex(r, 'resistencia');
const hz = (f: number) => valorLatex(f, 'frecuencia');
// Un número negativo entre paréntesis, para sumarlo o multiplicarlo en una fórmula.
const conSigno = (x: number) => (x < 0 ? `\\left(${numero(x)}\\right)` : numero(x));

// El de la red L entre las mismas dos resistencias; 0 si son iguales.
export const qMinimoDe = (rs: number, rl: number) =>
  rs === rl ? 0 : Math.sqrt(Math.max(rs, rl) / Math.min(rs, rl) - 1);

export function calcularRedPiT(entrada: EntradaRedPiT): ResultadoRedPiT {
  const { topologia, f0, rs, rl, qBobina, q } = entrada;
  if (!(rs > 0 && rl > 0 && f0 > 0 && qBobina > 0) || (q !== null && !(q > 0))) {
    return {
      estado: 'corte',
      codigo: 'entrada-invalida',
      texto: 'Rs, RL, f₀, el Q de la bobina y el Q de diseño tienen que ser mayores que cero.',
      qMinimo: null,
    };
  }
  const qMinimo = qMinimoDe(rs, rl);
  if (q === null) {
    return {
      estado: 'corte',
      codigo: 'falta-q',
      texto: `Completá: Q de diseño (mínimo ${numeroTexto(qMinimo)})`,
      qMinimo,
    };
  }
  if (q < qMinimo * (1 - TOLERANCIA_Q)) {
    return {
      estado: 'corte',
      codigo: 'q-bajo',
      texto:
        `Con un Q de diseño menor que el mínimo, ${numeroTexto(qMinimo)}, no hay valores: ` +
        'la Resistencia virtual no queda del lado que pide la red.',
      qMinimo,
    };
  }
  if (q <= qMinimo * (1 + TOLERANCIA_Q)) {
    const redL = calcularRedL({ f0, rs, rl, qBobina });
    if (redL.estado !== 'calculado') throw new Error(`la red L no calculó: ${redL.codigo}`);
    return {
      estado: 'reducida-a-l',
      q,
      qMinimo,
      texto:
        `Con el Q de diseño igual al mínimo, ${numeroTexto(qMinimo)}, la red ${topologia} se ` +
        'reduce a una red L: esta es.',
      redL,
    };
  }

  const [rMenor, rMayor] = rs < rl ? [rs, rl] : [rl, rs];
  const resistenciaVirtual = topologia === 'π' ? rMayor / (q * q + 1) : rMenor * (q * q + 1);
  const contexto: Contexto = { ...entrada, q, resistenciaVirtual };
  const variantes = ORDEN.flatMap((tipo) => variante(tipo, contexto) ?? []);

  const avisos: Aviso<CodigoAvisoPiT>[] = [
    ...(q > Q_ALTO
      ? [
          {
            codigo: 'q-alto' as const,
            texto:
              'Con un Q de diseño mayor que 20 hay más pérdida en la bobina, más tensión y corriente ' +
              'en los componentes, y el ajuste en f₀ es crítico.',
          },
        ]
      : []),
    ...(rs === rl
      ? [
          {
            codigo: 'rs-igual-rl' as const,
            texto:
              'Con Rs = RL la red solo filtra, no adapta. Para una respuesta definida está la ' +
              'Calculadora de filtros.',
          },
        ]
      : []),
  ];
  return {
    estado: 'calculado',
    topologia,
    q,
    qMinimo,
    resistenciaVirtual,
    formulas: [FORMULA_Q_MINIMO, FORMULA_RV[topologia]],
    pasos: pasosPrincipales(contexto, qMinimo),
    variantes,
    referencias: REFERENCIAS_RED_PI_T,
    avisos,
    notas: NOTAS_REDES,
  };
}

interface Contexto extends EntradaRedPiT {
  q: number;
  resistenciaVirtual: number;
}

function pasosPrincipales(
  { topologia, rs, rl, q, resistenciaVirtual: rv }: Contexto,
  qMinimo: number,
) {
  const [menor, mayor] = rs < rl ? ['R_s', 'R_L'] : ['R_L', 'R_s'];
  const [rMenor, rMayor] = rs < rl ? [rs, rl] : [rl, rs];
  const pasoQ: Paso = {
    texto: 'Q mínimo: el de la red L entre las mismas dos resistencias',
    latex:
      `${FORMULA_Q_MINIMO} = \\sqrt{\\dfrac{${mayor}}{${menor}} - 1} = ` +
      `\\sqrt{\\dfrac{${numero(rMayor)}}{${numero(rMenor)}} - 1} = ${numero(qMinimo)}`,
    fuente: 'Bowick, RF Circuit Design, ec. 4-1. Con un Q menor no hay solución.',
  };
  const pasoRv: Paso =
    topologia === 'π'
      ? {
          texto: 'Resistencia virtual: menor que las dos terminaciones',
          latex: `${FORMULA_RV.π} = \\dfrac{${numero(rMayor)}}{${numero(q)}^2 + 1} = ${ohms(rv)}`,
          fuente: 'Bowick, RF Circuit Design, ec. 4-4.',
        }
      : {
          texto: 'Resistencia virtual: mayor que las dos terminaciones',
          latex:
            `${FORMULA_RV.T} = ${numero(rMenor)} \\cdot \\left(${numero(q)}^2 + 1\\right) = ` +
            ohms(rv),
          fuente: 'Bowick, RF Circuit Design, ec. 4-5.',
        };
  return [pasoQ, pasoRv];
}

// Reactancia neta de dos ramas. Null si se anulan.
function sumaEnSerie(a: number, b: number): number | null {
  const x = a + b;
  return Math.abs(x) <= TOLERANCIA_RAMA * (Math.abs(a) + Math.abs(b)) ? null : x;
}

// Dos ramas en derivación se combinan en paralelo, sumando las susceptancias. Null si se anulan.
function enParalelo(a: number, b: number): number | null {
  const ba = 1 / a;
  const bb = 1 / b;
  const suma = ba + bb;
  return Math.abs(suma) <= TOLERANCIA_RAMA * (Math.abs(ba) + Math.abs(bb)) ? null : 1 / suma;
}

function variante(tipo: TipoVariantePiT, ctx: Contexto): VariantePiT | null {
  const { topologia, f0, rs, rl, qBobina, resistenciaVirtual: rv } = ctx;
  const omega = 2 * Math.PI * f0;
  const [filtradoFuente, filtradoCarga] = FILTRADOS[tipo];
  // Cada sección es una red L entre su terminal y la Resistencia virtual: en la π la virtual es la
  // menor, en la T la mayor.
  const seccion = (r: number, filtrado: Filtrado): SeccionL =>
    topologia === 'π' ? seccionL(rv, r, filtrado) : seccionL(r, rv, filtrado);
  const deFuente = seccion(rs, filtradoFuente);
  const deCarga = seccion(rl, filtradoCarga);

  // La π tiene las derivaciones en las terminales y las dos series juntas en el medio; la T, al
  // revés.
  const ramas = topologia === 'π' ? (s: SeccionL) => s.xDerivacion : (s: SeccionL) => s.xSerie;
  const juntas = topologia === 'π' ? (s: SeccionL) => s.xSerie : (s: SeccionL) => s.xDerivacion;
  const neta =
    topologia === 'π'
      ? sumaEnSerie(juntas(deFuente), juntas(deCarga))
      : enParalelo(juntas(deFuente), juntas(deCarga));
  // Una mixta cuya rama del medio se anula no tiene solución (spec §9.3).
  if (neta === null) return null;

  const posicionExtremos = topologia === 'π' ? 'derivacion' : 'serie';
  const posicionMedio = topologia === 'π' ? 'serie' : 'derivacion';
  const contador = { L: 0, C: 0 };
  const armar = (x: number, posicion: ComponenteRed['posicion'], lado: Lado | null) => {
    const c = componenteDeReactancia(x, omega);
    const nombre = `${c.componente}${++contador[c.componente]}`;
    return { ...c, nombre, reactancia: x, posicion, lado } satisfies ComponenteRed;
  };
  const componentes: ComponenteRed[] = [
    armar(ramas(deFuente), posicionExtremos, 'R_s'),
    armar(neta, posicionMedio, null),
    armar(ramas(deCarga), posicionExtremos, 'R_L'),
  ];

  const ideal: RedBarrido = { rs, rl, elementos: componentes.map((c) => elementoDe(c)) };
  const zEntrada = respuesta(ideal, f0).zEntrada;
  const { barrido, pasos: pasosBarrido } = barrer(ideal, componentes, f0, qBobina);
  const revision = revisarValores(componentes, f0, { sugerencia: SUGERENCIA_REDES });

  const secciones = [
    { lado: 'R_s', q: deFuente.q },
    { lado: 'R_L', q: deCarga.q },
  ] as const;
  const qBw = (deFuente.q + deCarga.q) / 2;
  const bwKaune = f0 / qBw;

  const pasos: Paso[] = [
    ...pasosDeSeccion(deFuente, topologia, 'R_s'),
    ...pasosDeSeccion(deCarga, topologia, 'R_L'),
    pasoCombinacion(topologia, juntas(deFuente), juntas(deCarga), neta),
    ...componentes.map((c) => pasoComponente(c, f0)),
    pasoKaune(secciones[0].q, secciones[1].q, qBw, f0, bwKaune),
    pasoZEntrada(zEntrada),
    ...pasosBarrido,
    ...revision.pasos,
  ];

  const todasLasSeriesSonL = componentes
    .filter((c) => c.posicion === 'serie')
    .every((c) => c.componente === 'L');
  return {
    tipo,
    secciones,
    qBw,
    bwKaune,
    componentes,
    etiquetas: [
      ETIQUETA_CONTINUA[todasLasSeriesSonL ? 'pasa-bajos' : 'pasa-altos'],
      ...(tipo === 'pasa-bajos' ? [ETIQUETA_ARMONICAS] : []),
    ],
    zEntrada,
    barrido,
    formulas: formulasDe(topologia, filtradoFuente, filtradoCarga),
    pasos,
    revision,
  };
}

// La primera letra en minúscula para seguir a un prefijo, salvo en una sigla como "Q".
const minuscula = (t: string) =>
  /^[A-ZÁÉÍÓÚ][a-záéíóúñ]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t;

// Los pasos de una sección L, con el lado al que pertenece delante.
function pasosDeSeccion(s: SeccionL, topologia: TopologiaPiT, lado: Lado): Paso[] {
  const simbolos =
    topologia === 'π' ? { menor: 'R_v', mayor: lado } : { menor: lado, mayor: 'R_v' };
  const nombre = lado === 'R_s' ? 'Rs' : 'RL';
  return pasosSeccionL(s, simbolos).map((p) => ({
    ...p,
    texto: `Sección del lado de ${nombre}: ${minuscula(p.texto)}`,
  }));
}

function pasoCombinacion(topologia: TopologiaPiT, a: number, b: number, neta: number): Paso {
  const tipo = neta > 0 ? 'una L' : 'una C';
  return topologia === 'π'
    ? {
        texto: `Combinación de las dos reactancias en serie: se suman con su signo y queda ${tipo}`,
        latex: `X_s = X_{s1} + X_{s2} = ${conSigno(a)} + ${conSigno(b)} = ${ohms(neta)}`,
      }
    : {
        texto: `Combinación de las dos reactancias en derivación: en paralelo, y queda ${tipo}`,
        latex:
          `X_p = \\dfrac{X_{p1} X_{p2}}{X_{p1} + X_{p2}} = ` +
          `\\dfrac{${conSigno(a)} \\cdot ${conSigno(b)}}{${conSigno(a)} + ${conSigno(b)}} = ${ohms(neta)}`,
      };
}

function pasoKaune(q1: number, q2: number, qBw: number, f0: number, bw: number): Paso {
  return {
    texto: 'Estimación del ancho de banda de Kaune (el resultado es el del barrido)',
    latex:
      `Q_{BW} \\approx \\dfrac{Q_1 + Q_2}{2} = \\dfrac{${numero(q1)} + ${numero(q2)}}{2} = ` +
      `${numero(qBw)},\\; BW \\approx \\dfrac{f_0}{Q_{BW}} = \\dfrac{${hz(f0)}}{${numero(qBw)}} = ` +
      hz(bw),
    fuente: 'Kaune, QEX, sept./oct. de 2015: estimación; la exacta es la del barrido.',
  };
}

function pasoZEntrada(z: Complejo): Paso {
  return {
    texto: 'Verificación: impedancia de entrada con RL conectada, en f₀',
    latex: 'Z_{\\mathrm{ent}} = \\dfrac{A\\,R_L + B}{C\\,R_L + D} = ' + complejoLatex(z),
    fuente: 'Matriz ABCD de la escalera con los valores calculados; tiene que dar Rs.',
  };
}

// Las fórmulas de la tarjeta, con el signo de cada sección según sea pasa bajos o pasa altos.
function formulasDe(topologia: TopologiaPiT, fuente: Filtrado, carga: Filtrado): string[] {
  const signo = (f: Filtrado) => (f === 'pasa-bajos' ? '' : '-');
  const opuesto = (f: Filtrado) => (f === 'pasa-bajos' ? '-' : '');
  const seccion = (i: 1 | 2, f: Filtrado, terminal: string) =>
    topologia === 'π'
      ? `X_{s${i}} = ${signo(f)}Q_${i}\\,R_v,\\; X_{p${i}} = ${opuesto(f)}\\dfrac{${terminal}}{Q_${i}}`
      : `X_{s${i}} = ${signo(f)}Q_${i}\\,${terminal},\\; X_{p${i}} = ${opuesto(f)}\\dfrac{R_v}{Q_${i}}`;
  return [
    seccion(1, fuente, 'R_s'),
    seccion(2, carga, 'R_L'),
    topologia === 'π' ? 'X_s = X_{s1} + X_{s2}' : 'X_p = \\dfrac{X_{p1} X_{p2}}{X_{p1} + X_{p2}}',
    'L = \\dfrac{X}{\\omega_0}',
    'C = -\\dfrac{1}{\\omega_0 X}',
    'Q_{BW} \\approx \\dfrac{Q_1 + Q_2}{2}',
    FORMULA_S21,
  ];
}
