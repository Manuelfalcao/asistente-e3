import { formatearValor } from '../../entrada/formato';
import { type ElementoBarrido, type RedBarrido, atenuacionDb } from '../comun/barrido';
import { errorLatex, numeroLatex as numero, valorLatex } from '../comun/latex';
import { type SeccionL, componenteDeReactancia, seccionL } from '../comun/red-l';
import { pasosSeccionL } from '../comun/red-l';
import type { EntradaRegistro } from '../comun/registro';
import type { Aviso, Paso, Referencia } from '../comun/resultado';
import { valoresDeSerie } from '../comun/series-e';
import {
  type Componente,
  type Revision,
  revisarValores,
  umbrales,
} from '../comun/valor-impracticable';
import {
  type Aproximacion,
  type Banda,
  type BandaEntrada,
  type OrdenCalculado,
  type PedidoAtenuacion,
  type Prototipo,
  type Sintonia,
  FBW_MAXIMO_RESONADORES,
  FORMULA_COHN_BANDA,
  ORDEN_MAXIMO,
  RANGO_RIPPLE,
  TOLERANCIA_CUMPLE_DB,
  bandaDe,
  dbTexto,
  formulasDeOrden,
  formulasPrototipo,
  mapeoDeCohn,
  ordenDesdeAtenuacion,
  prototipo,
} from './filtros';

export { type Sintonia, mapeoDeCohn } from './filtros';

// La Topología de resonadores acoplados de la Calculadora de filtros (spec §7.7), solo en pasa
// banda: n resonadores LC paralelo en derivación, todos con la misma L, unidos por Capacitores de
// acople en serie, y un Capacitor de extremo en serie hacia Rs y hacia RL que hace la transformación
// de impedancia. Matthaei, Young y Jones, Fig. 8.11-1, despejado en L, con el mapeo de Cohn y los g
// del prototipo de terminaciones iguales. Puro: recibe Hz, ohms, dB y H.

export interface EntradaResonadores {
  aproximacion: Aproximacion;
  // En dB; solo en Chebyshev.
  ripple: number | null;
  // El que escribió el Alumno, de 1 a 10, o la atenuación de la que se calcula (spec §7.7).
  orden: number | PedidoAtenuacion;
  banda: BandaEntrada;
  rs: number;
  rl: number;
  // Qu, para la pérdida de Cohn.
  qBobina: number;
  // La L de los resonadores, en H. Null: la que propone el Asistente.
  inductancia: number | null;
}

// La bandera del plan B de la Deducción propia del Chebyshev par (spec §13.5): si la Cátedra no la
// aprueba, se pone en true y el Orden par sube al impar, como en π y T.
export const PLAN_B_CHEBYSHEV_PAR = false;

// La del divisor capacitivo (spec §13.5): con el plan B se saca de los pasos intermedios.
export const PLAN_B_DIVISOR_CAPACITIVO = false;

export interface OpcionesResonadores {
  planBChebyshevPar?: boolean;
  planBDivisor?: boolean;
}

// La alternativa al Capacitor de extremo (research/resonadores-acoplados.md §3.2): Ca del resonador
// a la toma y Cb de la toma a masa, con la R en la toma. Fijan a la vez la conductancia 1/Rp y toda
// la capacidad que le falta al nodo, así que el resonador de ese extremo no lleva C propio. En F.
export interface DivisorCapacitivo {
  ca: number;
  cb: number;
}

// Un capacitor del resultado. Lo revisa el criterio de valor impracticable.
export interface CapacitorResonadores extends Componente {
  componente: 'C';
}

// Un extremo del filtro: la R que se conecta, la que tiene que ver el resonador y el Capacitor de
// extremo que la transforma, con la red L serie-paralelo de la Calculadora de redes de adaptación.
export interface ExtremoResonadores {
  lado: Lado;
  // Rs o RL.
  r: number;
  // g0·g1 en la entrada, gn·g(n+1) en la salida.
  g: number;
  qExterno: number;
  rp: number;
  seccion: SeccionL;
  capacitor: CapacitorResonadores;
  // Lo que el Capacitor de extremo, con su R, le suma en derivación al resonador: C01e.
  enDerivacion: number;
  // Solo en los pasos intermedios. Null con el plan B, o si con estos valores no se arma.
  divisor: DivisorCapacitivo | null;
}

export interface AcopleResonadores {
  // k(k,k+1) = FBW/√(gk·g(k+1)): el coeficiente de acople de Cohn y Dishal.
  k: number;
  capacitor: CapacitorResonadores;
}

export interface SintoniaResonador {
  capacitor: CapacitorResonadores;
  // Lo que tiene que cubrir el trimmer, solo o con un fijo en paralelo, en F: ±20 % del calculado.
  trimmer: { min: number; max: number };
}

// El ±20 % del trimmer (spec §7.7), un Criterio práctico: compensa ±20 % de error en la L.
export const AJUSTE_TRIMMER = 0.2;

// Los avisos por FBW (spec §7.7): ninguno hasta 10 %, informativo hasta 20 %, fuerte de ahí en más.
export const FBW_INFORMATIVO = 0.1;
export const FBW_FUERTE = FBW_MAXIMO_RESONADORES;

// Los dos extremos del filtro: la entrada, hacia Rs, y la salida, hacia RL.
export type Lado = 'entrada' | 'salida';

// Rs o RL, como texto y en LaTeX.
export const R_DEL_LADO: Record<Lado, { texto: string; latex: string }> = {
  entrada: { texto: 'Rs', latex: 'R_s' },
  salida: { texto: 'RL', latex: 'R_L' },
};

// La Ventana de L (spec §7.7), un Criterio práctico: las L con las que el filtro se puede armar. Es
// abierta: en la L mínima de Valor impracticable el error ya es del 50 %, en la cota de un extremo
// Rp = R y el Capacitor de extremo es infinito, y en la del acople y la de la sintonía el capacitor
// más chico es de 1 pF.
export interface VentanaDeL {
  // En H.
  min: number;
  max: number;
  // min ≥ max: no hay L que cumpla todo.
  vacia: boolean;
  // Si alguna L arma el filtro, aunque sea con valores fuera de la ventana: Rp > R en los dos
  // extremos y todos los Capacitores de sintonía positivos.
  realizable: boolean;
  propuesta: number;
  // La L más grande de la E12 adentro, o el centro geométrico de una ventana sin valores de la E12.
  // Con la ventana vacía, una L que se arma aunque deje capacitores debajo de 1 pF.
  propuestaComo: 'mayor-e12' | 'centro' | 'vacia';
  cotas: {
    // La L mínima de Valor impracticable: 6 nH.
    lMinima: number;
    // La que pide cada extremo para Rp > R: R·FBW/(g·ω0).
    extremos: readonly [number, number];
    // La que deja el Capacitor de acople más chico en la C mínima de Valor impracticable. Con Orden
    // 1, que no tiene acoples, la del Capacitor de extremo más chico.
    acople: number;
    // El k de ese acople, C(k,k+1); null con Orden 1.
    acopleMasChico: number | null;
    // La que deja el Capacitor de sintonía más chico en la C mínima: Cr baja con la L, y en los
    // extremos el C01e además crece con ella.
    sintonia: number;
    // Las de C1 > 0 y Cn > 0, que no son de la ventana sino de la realizabilidad: más arriba el
    // filtro no se arma. Con Orden 1 las dos son la misma.
    sintoniaPositiva: readonly [number, number];
  };
}

export type CodigoCorteResonadores =
  | 'entrada-invalida'
  // Orden calculado (spec §7.6 y §7.7): fs en la banda pasante, más de 10 en el prototipo o en la
  // red simulada, o Bessel sin solución en el prototipo.
  | 'banda-pasante'
  | 'orden-excedido'
  | 'bessel-sin-solucion'
  // Rp ≤ R en algún extremo.
  | 'extremo-no-realizable'
  // Algún Capacitor de sintonía ≤ 0.
  | 'sintonia-negativa'
  // Ninguna L arma el filtro.
  | 'sin-l-realizable';

export type CodigoAvisoResonadores =
  | 'chebyshev-par'
  | 'orden-por-asimetria'
  | 'fbw-ancho'
  | 'fbw-fuera-de-rango'
  | 'trimmer'
  | 'f0-geometrica'
  | 'debajo-de-l-minima'
  | 'acople-debajo-del-minimo'
  | 'sintonia-debajo-del-minimo'
  | 'ventana-vacia';

// El Orden calculado desde una atenuación (spec §7.7): el del prototipo, y el que hace falta en la red
// simulada en fs, con componentes ideales.
export interface OrdenCalculadoResonadores {
  // Ωs, la fórmula, el Orden del prototipo y su atenuación en fs.
  prototipo: OrdenCalculado;
  // El que se usa: el del prototipo, o más si la red simulada no llega.
  orden: number;
  // La de la red simulada en fs con ese Orden, en dB.
  atenuacionSimulada: number;
  // Cada Orden probado en la red simulada, con su atenuación en fs.
  probados: readonly OrdenProbado[];
}

export interface OrdenProbado {
  orden: number;
  // En dB, en fs.
  atenuacion: number;
}

export type ResultadoResonadores =
  | {
      estado: 'corte';
      codigo: CodigoCorteResonadores;
      texto: string;
      // Salvo con la entrada inválida: la pantalla la muestra junto al campo de la L.
      ventana?: VentanaDeL;
    }
  | {
      estado: 'calculado';
      aproximacion: Aproximacion;
      // El que escribió el Alumno (null si lo pidió desde una atenuación) y el que se usa: con el plan
      // B, Chebyshev par sube al impar.
      ordenPedido: number | null;
      orden: number;
      // Solo si el Orden se calculó desde una atenuación.
      ordenCalculado: OrdenCalculadoResonadores | null;
      prototipo: Prototipo;
      // La banda que dio el Alumno: f1, f2, la central geométrica y BW.
      banda: Banda;
      sintonia: Sintonia;
      inductancia: Componente & { componente: 'L' };
      // Si la L es la que propuso el Asistente o la que escribió el Alumno.
      lPropuesta: boolean;
      ventana: VentanaDeL;
      // Cr = 1/(ω0²·L): la capacidad total de cada resonador.
      cr: number;
      extremos: readonly [ExtremoResonadores, ExtremoResonadores];
      acoples: readonly AcopleResonadores[];
      sintonias: readonly SintoniaResonador[];
      // Solo en Bessel con RL > Rs: el prototipo armado de gn a g1 desde la fuente.
      invertido: boolean;
      // Estimación de Cohn en la Frecuencia de sintonía, en dB, con Qk = FBW·Qu (spec §7.8).
      perdidaCohn: number;
      // Las fórmulas del resultado principal, sin números.
      formulas: readonly string[];
      pasos: readonly Paso[];
      // f2: el borde alto, donde el montaje pesa más (spec §7.10).
      frecuenciaRevision: number;
      // Valor dudoso o impracticable de la L y de cada capacitor. Su cuenta está al final de pasos.
      revision: Revision;
      referencias: readonly Referencia[];
      avisos: readonly Aviso<CodigoAvisoResonadores>[];
      notas: readonly string[];
    };

const ohms = (r: number) => valorLatex(r, 'resistencia');
// 10/ln 10: los dB de un logaritmo natural, que Matthaei escribe 4,343.
const DB_POR_NEPER = 10 / Math.LN10;

// Las cifras con que se muestran la Frecuencia de sintonía y la central geométrica: con 3 o 4, en una
// banda angosta las dos dan lo mismo ("146 MHz"), y un 1 % de error de sintonía corre la banda un
// 18 % del BW. Se muestran hasta una milésima del BW: 145,959 MHz contra 145,986 MHz.
export function cifrasDeSintonia(f0: number, bw: number): number {
  const cifras = Math.floor(Math.log10(f0)) - Math.floor(Math.log10(bw / 1000)) + 1;
  return Math.min(9, Math.max(3, cifras));
}

const CORTE_INVALIDA =
  `f1 y f2 (o f0 y BW), Rs, RL, el Q de las bobinas y la L de los resonadores tienen que ser ` +
  `mayores que cero y f2 mayor que f1; el Orden, un entero de 1 a ${ORDEN_MAXIMO}, o la atenuación ` +
  `pedida y su frecuencia fs, mayores que cero; y el ripple, de ${RANGO_RIPPLE.min} a ` +
  `${RANGO_RIPPLE.max} dB.`;

const esPositivoFinito = (x: number) => Number.isFinite(x) && x > 0;

function ordenValido(orden: EntradaResonadores['orden']): boolean {
  if (typeof orden !== 'number') return esPositivoFinito(orden.as) && esPositivoFinito(orden.fs);
  return Number.isInteger(orden) && orden >= 1 && orden <= ORDEN_MAXIMO;
}

function entradaValida(e: EntradaResonadores): boolean {
  const { banda } = e;
  const frecuencias =
    'f1' in banda ? banda.f1 > 0 && banda.f2 > banda.f1 : banda.f0 > 0 && banda.bw > 0;
  const ripple =
    e.aproximacion !== 'chebyshev' ||
    (e.ripple !== null && e.ripple >= RANGO_RIPPLE.min && e.ripple <= RANGO_RIPPLE.max);
  return (
    frecuencias &&
    ripple &&
    e.rs > 0 &&
    e.rl > 0 &&
    e.qBobina > 0 &&
    (e.inductancia === null || e.inductancia > 0) &&
    ordenValido(e.orden)
  );
}

// Los nombres de Matthaei: C01 y C(n,n+1) en los extremos, C(k,k+1) entre resonadores. Con un índice
// de dos cifras, separados por una coma: C9,10.
const nombreEntre = (k: number) => (k + 1 < 10 ? `C${k}${k + 1}` : `C${k},${k + 1}`);

export function calcularResonadores(
  entrada: EntradaResonadores,
  {
    planBChebyshevPar = PLAN_B_CHEBYSHEV_PAR,
    planBDivisor = PLAN_B_DIVISOR_CAPACITIVO,
  }: OpcionesResonadores = {},
): ResultadoResonadores {
  if (!entradaValida(entrada)) {
    return { estado: 'corte', codigo: 'entrada-invalida', texto: CORTE_INVALIDA };
  }
  const { orden } = entrada;
  if (typeof orden !== 'number') {
    return conOrdenCalculado(entrada, orden, planBChebyshevPar, planBDivisor);
  }
  // Chebyshev par se arma con terminaciones iguales: el g(n+1) ≠ 1 lo absorbe el Capacitor de
  // extremo de la salida (Deducción propia). Con el plan B sube al impar, como en π y T (spec §7.3).
  const chebyshevPar = entrada.aproximacion === 'chebyshev' && orden % 2 === 0;
  const n = chebyshevPar && planBChebyshevPar ? orden + 1 : orden;
  const r = disenarConOrden(entrada, n, planBDivisor);
  if (r.estado === 'corte' || n === orden) return r;
  return { ...r, ordenPedido: orden, avisos: [avisoChebyshevPar(orden, n), ...r.avisos] };
}

// El filtro con Orden n, el que se usa. ordenPedido queda en null: lo pone quien lo llama.
function disenarConOrden(
  entrada: EntradaResonadores,
  n: number,
  planBDivisor: boolean,
): ResultadoResonadores {
  const { aproximacion, ripple, rs, rl } = entrada;
  const banda = bandaDe(entrada.banda);
  const sintonia = mapeoDeCohn(banda.f1, banda.f2);
  const { fbw } = sintonia;
  const w0 = 2 * Math.PI * sintonia.f0;
  const p = prototipo(aproximacion, n, ripple);
  // Bessel no es simétrico: el g grande va del lado de la R mayor, que es el extremo que pide más
  // Rp. Como el prototipo es de terminaciones iguales, se puede dar vuelta.
  const invertido = aproximacion === 'bessel' && rl > rs;
  // g0 … g(n+1), de la fuente a la carga.
  const tabla = [1, ...p.g, p.carga];
  const modelo = modeloDe(invertido ? [...tabla].reverse() : tabla, sintonia, rs, rl);
  const { gs } = modelo;
  const ventana = ventanaDeL(modelo);
  if (!ventana.realizable) {
    return {
      estado: 'corte',
      codigo: 'sin-l-realizable',
      texto: corteSinL(modelo, ventana),
      ventana,
    };
  }
  const l = entrada.inductancia ?? ventana.propuesta;

  const cortos = LADOS.filter((lado) => modelo.rp(lado, l) <= modelo.r(lado));
  if (cortos.length > 0) {
    return {
      estado: 'corte',
      codigo: 'extremo-no-realizable',
      texto: corteExtremo(modelo, cortos, l, ventana),
      ventana,
    };
  }
  const diseno = disenar(modelo, l);
  const { cr, acoples, sintonias } = diseno;
  const negativos = sintonias.filter((s) => !(s.capacitor.valor > 0));
  if (negativos.length > 0) {
    return {
      estado: 'corte',
      codigo: 'sintonia-negativa',
      texto: corteSintonia(negativos, l, ventana),
      ventana,
    };
  }
  const conDivisor = (x: ExtremoResonadores, ck: SintoniaResonador): ExtremoResonadores => ({
    ...x,
    divisor: planBDivisor ? null : divisorDe(x, ck.capacitor.valor, w0),
  });
  const extremos = [
    conDivisor(diseno.extremos[0], sintonias[0]),
    conDivisor(diseno.extremos[1], sintonias[n - 1]),
  ] as const;
  // El índice en el prototipo del g de lugar k desde la fuente, para los pasos.
  const indiceG = (k: number) => (invertido ? n + 1 - k : k);
  const perdidaCohn = (DB_POR_NEPER * p.g.reduce((s, g) => s + g, 0)) / (fbw * entrada.qBobina);
  const contexto: Contexto = { gs, indiceG, banda, sintonia, l, cr, entrada };
  const inductancia = { componente: 'L', nombre: 'L', valor: l } as const;
  // Cada L y C del resultado, incluidos los de sintonía, en f2 (spec §5.6 y §7.10).
  const revision = revisarValores(
    [
      inductancia,
      extremos[0].capacitor,
      ...acoples.map((a) => a.capacitor),
      extremos[1].capacitor,
      ...sintonias.map((s) => s.capacitor),
    ],
    banda.f2,
    { sugerencia: SUGERENCIA_RESONADORES },
  );

  return {
    estado: 'calculado',
    aproximacion,
    ordenPedido: null,
    orden: n,
    ordenCalculado: null,
    prototipo: p,
    invertido,
    banda,
    sintonia,
    inductancia,
    lPropuesta: entrada.inductancia === null,
    ventana,
    cr,
    extremos,
    acoples,
    sintonias,
    perdidaCohn,
    formulas: [...formulasPrototipo(aproximacion, 1), ...FORMULAS_RESONADORES, FORMULA_COHN_BANDA],
    pasos: [
      ...p.pasos,
      ...(aproximacion === 'bessel' ? [pasoOrientacion(gs, invertido, rs, rl)] : []),
      ...pasosDeSintonia(contexto),
      ...pasosDeVentana(contexto, ventana, entrada.inductancia === null),
      ...pasosDelDiseno(contexto, extremos, acoples, sintonias),
      ...(planBDivisor
        ? []
        : extremos.flatMap((x, i) => pasosDivisor(contexto, x, sintonias[i === 0 ? 0 : n - 1]))),
      pasoCohn(contexto, p.g, perdidaCohn),
      ...revision.pasos,
    ],
    frecuenciaRevision: banda.f2,
    revision,
    referencias: REFERENCIAS_RESONADORES,
    avisos: [
      ...avisosDeFbw(fbw),
      ...avisosDeVentana(ventana, l, entrada.inductancia === null, acoples, extremos, sintonias),
      AVISO_TRIMMER,
      ...('f0' in entrada.banda ? [avisoF0(banda)] : []),
    ],
    notas: [
      ...(aproximacion === 'bessel' && rs !== rl ? [NOTA_BESSEL] : []),
      ...(aproximacion === 'chebyshev' && n % 2 === 0 ? [NOTA_CHEBYSHEV_PAR] : []),
      ...NOTAS,
    ],
  };
}

type Calculado = Extract<ResultadoResonadores, { estado: 'calculado' }>;

// La red completa entre Rs y RL para el barrido común (spec §5.7), con componentes ideales: el
// Capacitor de extremo en serie, cada resonador LC paralelo en derivación y los Capacitores de
// acople en serie.
function redDe(r: Calculado, rs: number, rl: number): RedBarrido {
  const enSerie = (valor: number): ElementoBarrido => ({
    componente: 'C',
    posicion: 'serie',
    valor,
  });
  const n = r.sintonias.length;
  return {
    rs,
    rl,
    elementos: [
      enSerie(r.extremos[0].capacitor.valor),
      ...r.sintonias.flatMap((s, i): ElementoBarrido[] => [
        { componente: 'L', posicion: 'derivacion', valor: r.inductancia.valor },
        { componente: 'C', posicion: 'derivacion', valor: s.capacitor.valor },
        ...(i < n - 1 ? [enSerie(r.acoples[i].capacitor.valor)] : []),
      ]),
      enSerie(r.extremos[1].capacitor.valor),
    ],
  };
}

// El Orden calculado (spec §7.7): el del prototipo, y después la red real simulada en fs. Si no llega,
// se sube n de a uno (de a dos en Chebyshev con el plan B, que sigue impar) hasta 10. La red se
// simula con la L que se va a usar, aunque con componentes ideales la atenuación casi no depende de
// ella.
function conOrdenCalculado(
  entrada: EntradaResonadores,
  pedido: PedidoAtenuacion,
  planBChebyshevPar: boolean,
  planBDivisor: boolean,
): ResultadoResonadores {
  const { aproximacion, ripple, rs, rl } = entrada;
  const datos = { tipo: 'pasa-banda', aproximacion, ripple, banda: entrada.banda } as const;
  const o = ordenDesdeAtenuacion(datos, pedido, 1, { parLibre: !planBChebyshevPar });
  if (o.estado === 'corte') return { estado: 'corte', codigo: o.codigo, texto: o.texto };
  const { as, fs } = pedido;
  const flanco = flancoDe(fs, entrada.banda);
  const salto = aproximacion === 'chebyshev' && planBChebyshevPar ? 2 : 1;
  const probados: OrdenProbado[] = [];
  for (let n = o.orden; n <= ORDEN_MAXIMO; n += salto) {
    const r = disenarConOrden(entrada, n, planBDivisor);
    if (r.estado === 'corte') {
      if (n === o.orden) return r;
      return {
        ...r,
        texto: `Por la asimetría del flanco ${flanco} hace falta Orden ${n}, y con él: ${r.texto}`,
      };
    }
    const atenuacion = atenuacionDb(redDe(r, rs, rl), fs);
    probados.push({ orden: n, atenuacion });
    if (!cumple(atenuacion, as)) continue;
    const ordenCalculado = { prototipo: o, orden: n, atenuacionSimulada: atenuacion, probados };
    return {
      ...r,
      ordenCalculado,
      formulas: [...formulasDeOrden('pasa-banda', aproximacion), ...r.formulas],
      pasos: [...o.pasos, ...pasosDeSimulacion(pedido, probados), ...r.pasos],
      avisos: [
        ...(n !== o.orden ? [avisoAsimetria(o.orden, n, flanco, atenuacion, fs)] : []),
        ...r.avisos,
      ],
      notas: [NOTA_ORDEN_SIMULADO, ...r.notas],
    };
  }
  const ultimo = probados[probados.length - 1];
  return {
    estado: 'corte',
    codigo: 'orden-excedido',
    texto:
      `El prototipo pedía n = ${o.orden}, pero por la asimetría del flanco ${flanco} la red ` +
      `simulada no llega a ${dbTexto(as)} a ${formatearValor(fs, 'frecuencia')} ni con Orden ` +
      `${ultimo.orden}, el máximo: da ${dbTexto(ultimo.atenuacion)}. Con esos datos no se ` +
      'calcula: probá con una atenuación menor, con fs más lejos de la banda o con otra Aproximación.',
  };
}

// Arriba de la banda la red atenúa menos que el prototipo, y abajo más (research/resonadores-
// acoplados.md §4): los capacitores en serie son ceros de transmisión en continua.
type Flanco = 'alto' | 'bajo';
const flancoDe = (fs: number, banda: BandaEntrada): Flanco =>
  fs > bandaDe(banda).f0 ? 'alto' : 'bajo';

const cumple = (atenuacion: number, as: number) => atenuacion >= as - TOLERANCIA_CUMPLE_DB;

const avisoAsimetria = (
  prototipoPide: number,
  n: number,
  flanco: Flanco,
  atenuacion: number,
  fs: number,
): Aviso<CodigoAvisoResonadores> => ({
  codigo: 'orden-por-asimetria',
  texto:
    `El prototipo pedía n = ${prototipoPide}, pero por la asimetría del flanco ${flanco} hace ` +
    `falta n = ${n}: con él, la red simulada atenúa ${dbTexto(atenuacion)} a ` +
    `${formatearValor(fs, 'frecuencia')}.`,
});

const NOTA_ORDEN_SIMULADO =
  'La atenuación en fs es la de la red simulada, con componentes ideales: esta Topología atenúa ' +
  'menos que el prototipo arriba de la banda y más abajo.';

function pasosDeSimulacion(
  { as, fs }: PedidoAtenuacion,
  probados: readonly OrdenProbado[],
): Paso[] {
  return probados.map(({ orden, atenuacion }) => {
    const llega = cumple(atenuacion, as);
    return {
      texto: `Red simulada con Orden ${orden}, en fs: ${llega ? 'cumple' : 'no llega'}`,
      latex:
        `A(${hz(fs)}) = ${valorLatex(atenuacion, 'decibeles')} ` +
        `${llega ? '\\ge' : '<'} A_s = ${valorLatex(as, 'decibeles')}`,
      fuente:
        'Análisis ABCD de la red completa entre Rs y RL, con componentes ideales (spec §5.7).',
    };
  });
}

// La de la spec §5.6 para esta Topología.
export const SUGERENCIA_RESONADORES = 'Bajá el Orden.';

const NOTAS = [
  'Los acoples son sensibles: en 144–148 MHz con Butterworth de Orden 3, un −4,5 % en el ' +
    'Capacitor de acople sube el peor punto de la banda de 3,0 a 4,5 dB.',
  'La pérdida es la estimación de Cohn en la Frecuencia de sintonía: cada resonador con Qk = ' +
    'FBW·Qu, solo pierden las bobinas con el Q que ingresaste y los capacitores se toman ideales. No ' +
    'depende de la L.',
  'Los valores no se redondean a una serie E.',
  'Los valores se revisan en f2, el borde alto de la banda: ahí el desvío por el montaje y las ' +
    'parásitas es el mayor.',
];

const avisoF0 = (banda: Banda): Aviso<CodigoAvisoResonadores> => ({
  codigo: 'f0-geometrica',
  texto:
    `Con f0 y BW, f0 se toma como la central geométrica √(f1·f2): la banda va de ` +
    `${formatearValor(banda.f1, 'frecuencia')} a ${formatearValor(banda.f2, 'frecuencia')}. Los ` +
    'resonadores no se ajustan a esa f0 sino a la Frecuencia de sintonía, que sale del mapeo de Cohn.',
});

const LADOS: readonly Lado[] = ['entrada', 'salida'];

// El prototipo ya orientado (g0 … g(n+1)) con la banda y las terminaciones: lo que el diseño, la
// Ventana de L y los cortes calculan en función de la L.
interface Modelo {
  gs: readonly number[];
  n: number;
  sintonia: Sintonia;
  w0: number;
  r: (lado: Lado) => number;
  // g0·g1 en la entrada, gn·g(n+1) en la salida.
  g: (lado: Lado) => number;
  // k(k,k+1) = FBW/√(gk·g(k+1)): el coeficiente de acople de Cohn y Dishal.
  coeficiente: (k: number) => number;
  // Rp = g·ω0·L/FBW: la R que tiene que ver el resonador del extremo.
  rp: (lado: Lado, l: number) => number;
  // La L con Rp = R: por debajo el Capacitor de extremo no transforma.
  lDelExtremo: (lado: Lado) => number;
  // Ck/Cr = 1 − lo que le quitan sus dos vecinos: k·Cr por cada acople, o C01e = FBW·Q/g·Cr por el
  // Capacitor de extremo, con Q = √(Rp/R − 1), que crece con la L.
  sintoniaRelativa: (k: number, l: number) => number;
}

function modeloDe(gs: readonly number[], sintonia: Sintonia, rs: number, rl: number): Modelo {
  const n = gs.length - 2;
  const { fbw } = sintonia;
  const w0 = 2 * Math.PI * sintonia.f0;
  const r = (lado: Lado) => (lado === 'entrada' ? rs : rl);
  const g = (lado: Lado) => (lado === 'entrada' ? gs[0] * gs[1] : gs[n] * gs[n + 1]);
  const coeficiente = (k: number) => fbw / Math.sqrt(gs[k] * gs[k + 1]);
  const rp = (lado: Lado, l: number) => (g(lado) * w0 * l) / fbw;
  const delExtremo = (lado: Lado, l: number) =>
    (fbw * Math.sqrt(Math.max(0, rp(lado, l) / r(lado) - 1))) / g(lado);
  return {
    gs,
    n,
    sintonia,
    w0,
    r,
    g,
    coeficiente,
    rp,
    lDelExtremo: (lado) => (r(lado) * fbw) / (g(lado) * w0),
    sintoniaRelativa: (k, l) =>
      1 -
      (k === 1 ? delExtremo('entrada', l) : coeficiente(k - 1)) -
      (k === n ? delExtremo('salida', l) : coeficiente(k)),
  };
}

// Matthaei Fig. 8.11-1, con todas las L iguales: los Capacitores de extremo, de acople y de sintonía
// para una L. Supone Rp > R en los dos extremos.
function disenar(modelo: Modelo, l: number) {
  const { n, w0, sintonia } = modelo;
  const cr = 1 / (w0 * w0 * l);
  const extremo = (lado: Lado): ExtremoResonadores => {
    const r = modelo.r(lado);
    const g = modelo.g(lado);
    const rp = modelo.rp(lado, l);
    // La red L pasa altos desde R: el capacitor en serie y, del lado del resonador, la reactancia
    // que anula la que deja la rama serie pasada a paralelo. Esa la pone el resonador.
    const seccion = seccionL(r, rp, 'pasa-altos');
    const { valor } = componenteDeReactancia(seccion.xSerie, w0);
    return {
      lado,
      r,
      g,
      qExterno: g / sintonia.fbw,
      rp,
      seccion,
      capacitor: { componente: 'C', nombre: lado === 'entrada' ? 'C01' : nombreEntre(n), valor },
      enDerivacion: 1 / (w0 * seccion.xDerivacion),
      divisor: null,
    };
  };
  const extremos = [extremo('entrada'), extremo('salida')] as const;
  const acoples: AcopleResonadores[] = [];
  for (let k = 1; k < n; k++) {
    const coeficiente = modelo.coeficiente(k);
    acoples.push({
      k: coeficiente,
      capacitor: { componente: 'C', nombre: nombreEntre(k), valor: coeficiente * cr },
    });
  }
  // Ck = Cr − lo que se conecta al nodo k: los acoples vecinos, o lo que suma el Capacitor de extremo.
  const sintonias = Array.from({ length: n }, (_, i): SintoniaResonador => {
    const k = i + 1;
    const izquierda = k === 1 ? extremos[0].enDerivacion : acoples[k - 2].capacitor.valor;
    const derecha = k === n ? extremos[1].enDerivacion : acoples[k - 1].capacitor.valor;
    const valor = cr - izquierda - derecha;
    return {
      capacitor: { componente: 'C', nombre: `C${k}`, valor },
      trimmer: { min: valor * (1 - AJUSTE_TRIMMER), max: valor * (1 + AJUSTE_TRIMMER) },
    };
  });
  return { cr, extremos, acoples, sintonias };
}

// El divisor de un extremo (research/resonadores-acoplados.md §3.2, cálculo propio verificado por
// simulación). Desde el nodo, Ca en serie con Cb ∥ R tiene que dar la admitancia que daban el
// Capacitor de extremo con su R y el de sintonía: Gp + jB, con Gp = 1/Rp y B = ω0·(Ck + C01e).
// Igualando partes reales sale Cb, y con las imaginarias, Ca. Null si no se arma.
function divisorDe(x: ExtremoResonadores, ck: number, w0: number): DivisorCapacitivo | null {
  const { cb, inversaCa } = cuentasDivisor(x, ck, w0);
  return Number.isFinite(cb) && cb > 0 && inversaCa > 0 ? { ca: 1 / (w0 * inversaCa), cb } : null;
}

// Las cuentas del divisor, que también muestran los pasos.
function cuentasDivisor(x: ExtremoResonadores, ck: number, w0: number) {
  const gp = 1 / x.rp;
  const b = w0 * (ck + x.enDerivacion);
  const g = 1 / x.r;
  const reZ = gp / (gp * gp + b * b);
  const cb = Math.sqrt(g / reZ - g * g) / w0;
  const inversaCa = b / (gp * gp + b * b) - (w0 * cb) / (g * g + w0 * w0 * cb * cb);
  return { gp, b, g, reZ, cb, inversaCa };
}

const henriosTexto = (l: number) => formatearValor(l, 'inductancia');
const L_MINIMA = henriosTexto(umbrales(null).lMin.impracticable);
const C_MINIMA = formatearValor(umbrales(null).cMin.impracticable, 'capacidad');
const ventanaTexto = (v: VentanaDeL) =>
  v.vacia
    ? `la Ventana de L está vacía: pide más de ${henriosTexto(v.min)} y menos de ${henriosTexto(v.max)}`
    : `la Ventana de L va de ${henriosTexto(v.min)} a ${henriosTexto(v.max)}`;

// Rp ≤ R: el Capacitor de extremo no puede bajar R hasta la que tiene que ver el resonador.
function corteExtremo(
  modelo: Modelo,
  cortos: readonly Lado[],
  l: number,
  ventana: VentanaDeL,
): string {
  const partes = cortos.map((lado) => {
    const i = lado === 'entrada' ? 0 : 1;
    return (
      `el resonador de ${lado} tendría que ver Rp = ` +
      `${formatearValor(modelo.rp(lado, l), 'resistencia')}, que no supera ` +
      `${R_DEL_LADO[lado].texto} = ${formatearValor(modelo.r(lado), 'resistencia')} (hace falta ` +
      `L > ${henriosTexto(ventana.cotas.extremos[i])})`
    );
  });
  return (
    `Con L = ${henriosTexto(l)}, ${partes.join(', y ')}: el Capacitor de extremo solo puede ` +
    `transformar una R hacia arriba. Subí la L; ${ventanaTexto(ventana)}.`
  );
}

// Ck ≤ 0 con una L que el Alumno escribió: lo que el nodo de un extremo recibe del Capacitor de
// extremo, que crece con la L, pasa de Cr. Los del medio no llegan acá: si uno es negativo, no
// depende de la L y corta antes (corteSinL).
function corteSintonia(
  negativos: readonly SintoniaResonador[],
  l: number,
  ventana: VentanaDeL,
): string {
  const partes = negativos.map(({ capacitor }) => {
    const k = Number(capacitor.nombre.slice(1));
    const maxima = ventana.cotas.sintoniaPositiva[k === 1 ? 0 : 1];
    return (
      `${capacitor.nombre} queda en ${formatearValor(capacitor.valor, 'capacidad')}: el ` +
      `Capacitor de extremo le suma demasiado en derivación; hace falta L < ${henriosTexto(maxima)}`
    );
  });
  return (
    `Con L = ${henriosTexto(l)}, ${partes.join('; ')}. Un Capacitor de sintonía no puede ser ` +
    `negativo: bajá la L; ${ventanaTexto(ventana)}.`
  );
}

// Ninguna L arma el filtro: un Capacitor de sintonía del medio es negativo con cualquier L, o lo que
// piden los extremos (Rp > R, desde abajo) choca con C1 > 0 o Cn > 0 (desde arriba).
function corteSinL(modelo: Modelo, ventana: VentanaDeL): string {
  const { n } = modelo;
  const delMedio = Array.from({ length: Math.max(0, n - 2) }, (_, i) => i + 2).filter(
    (k) => !(modelo.sintoniaRelativa(k, 1) > 0),
  );
  const motivo =
    delMedio.length > 0
      ? delMedio
          .map(
            (k) =>
              `C${k} queda negativo: sus dos acoples suman más que Cr, y eso no depende de la L`,
          )
          .join('; ')
      : (() => {
          const [entrada, salida] = ventana.cotas.extremos;
          const lado: Lado = entrada >= salida ? 'entrada' : 'salida';
          const [c1, cn] = ventana.cotas.sintoniaPositiva;
          const [cual, maxima] = c1 <= cn ? ['C1', c1] : [`C${n}`, cn];
          return (
            `el extremo de ${lado} pide L > ${henriosTexto(Math.max(entrada, salida))} para que ` +
            `el resonador vea más que ${R_DEL_LADO[lado].texto}, y ${cual} > 0 pide L < ` +
            `${henriosTexto(maxima)}`
          );
        })();
  return (
    `Ninguna L arma este filtro: ${motivo}. Con FBW = ${porcentaje(modelo.sintonia.fbw)} la banda ` +
    'es demasiado ancha para esta Topología con estas Rs y RL: probá con una banda más angosta, ' +
    'otro Orden o terminaciones más parecidas.'
  );
}

// La L elegida contra la Ventana de L (spec §7.7): qué cotas viola. Con la ventana vacía, el aviso
// lo dice y nombra qué se acepta para armarlo; la L del Alumno, además, avisa cada cota que viola.
function avisosDeVentana(
  ventana: VentanaDeL,
  l: number,
  lPropuesta: boolean,
  acoples: readonly AcopleResonadores[],
  extremos: readonly ExtremoResonadores[],
  sintonias: readonly SintoniaResonador[],
): Aviso<CodigoAvisoResonadores>[] {
  const { lMinima, acople, sintonia } = ventana.cotas;
  const porAcople = ventana.cotas.acopleMasChico !== null;
  const debajoDeLMinima = l <= lMinima;
  const acopleChico = l >= acople;
  const sintoniaChica = l >= sintonia;
  const vacia: Aviso<CodigoAvisoResonadores>[] = ventana.vacia
    ? [
        {
          codigo: 'ventana-vacia',
          texto:
            `No hay una L que deje todo construible: ${ventanaTexto(ventana)}. Bajá el Orden, o ` +
            `aceptá ${[
              ...(debajoDeLMinima ? [`una L por debajo de la L mínima (${L_MINIMA})`] : []),
              ...(acopleChico
                ? [`${porAcople ? 'acoples' : 'Capacitores de extremo'} por debajo de ${C_MINIMA}`]
                : []),
              ...(sintoniaChica ? [`Capacitores de sintonía por debajo de ${C_MINIMA}`] : []),
            ].join(' y ')} (Valor impracticable): se calcula con L = ${henriosTexto(l)}.`,
        },
      ]
    : [];
  if (ventana.vacia && lPropuesta) return vacia;
  const elMasChico = (capacitores: readonly CapacitorResonadores[]) =>
    capacitores.reduce((a, b) => (b.valor < a.valor ? b : a));
  const cotaViolada = (texto: string) =>
    `${texto} ${ventana.vacia ? 'La Ventana de L está vacía.' : `Bajá la L; ${ventanaTexto(ventana)}.`}`;
  const avisos = [...vacia];
  if (debajoDeLMinima) {
    avisos.push({
      codigo: 'debajo-de-l-minima',
      texto:
        `L = ${henriosTexto(l)} está por debajo de la L mínima de Valor impracticable ` +
        `(${L_MINIMA}): con el montaje, los terminales pesan tanto como la bobina. ` +
        (ventana.vacia
          ? 'La Ventana de L está vacía.'
          : `${ventanaTexto(ventana)[0].toUpperCase()}${ventanaTexto(ventana).slice(1)}.`),
    });
  }
  if (acopleChico) {
    const menor = elMasChico(
      porAcople ? acoples.map((a) => a.capacitor) : extremos.map((x) => x.capacitor),
    );
    avisos.push({
      codigo: 'acople-debajo-del-minimo',
      texto: cotaViolada(
        `Con L = ${henriosTexto(l)} el ${porAcople ? 'Capacitor de acople' : 'Capacitor de extremo'} ` +
          `más chico, ${menor.nombre}, queda en ${formatearValor(menor.valor, 'capacidad')}, por ` +
          `debajo de la C mínima de Valor impracticable (${C_MINIMA}).`,
      ),
    });
  }
  if (sintoniaChica) {
    const menor = elMasChico(sintonias.map((s) => s.capacitor));
    avisos.push({
      codigo: 'sintonia-debajo-del-minimo',
      texto: cotaViolada(
        `Con L = ${henriosTexto(l)} el Capacitor de sintonía más chico, ${menor.nombre}, queda en ` +
          `${formatearValor(menor.valor, 'capacidad')}, por debajo de la C mínima de Valor ` +
          `impracticable (${C_MINIMA}).`,
      ),
    });
  }
  return avisos;
}

const porcentaje = (fraccion: number) => formatearValor(fraccion * 100, 'porcentaje');

// research/resonadores-acoplados.md §4: el acople capacitivo crece con la frecuencia y la respuesta
// queda asimétrica, con el flanco alto más suave. El mapeo de Cohn mantiene la banda pasante hasta
// FBW ≈ 20 %, pero no corrige los flancos.
function avisosDeFbw(fbw: number): Aviso<CodigoAvisoResonadores>[] {
  if (fbw > FBW_FUERTE) {
    return [
      {
        codigo: 'fbw-fuera-de-rango',
        texto:
          `Con FBW = ${porcentaje(fbw)}, el filtro queda fuera del rango de validez del método ` +
          `(Matthaei, Young y Jones: alrededor de ${porcentaje(FBW_FUERTE)}): los bordes de la banda ` +
          'pueden correrse, y por encima de f2 atenúa bastante menos que el prototipo.',
      },
    ];
  }
  if (fbw > FBW_INFORMATIVO) {
    return [
      {
        codigo: 'fbw-ancho',
        texto:
          `Con FBW = ${porcentaje(fbw)}, la atenuación por encima de f2 es menor que la del ` +
          'prototipo: el acople capacitivo hace la respuesta asimétrica, con el flanco bajo más ' +
          'empinado y el alto más suave.',
      },
    ];
  }
  return [];
}

const AVISO_TRIMMER: Aviso<CodigoAvisoResonadores> = {
  codigo: 'trimmer',
  texto:
    'Los Capacitores de sintonía se arman con trimmer, y el valor calculado es el punto medio del ' +
    'ajuste: un 1 % de error en uno corre la banda un 18 % del BW. Cada uno trae el rango que tiene ' +
    `que cubrir el trimmer, solo o con un fijo en paralelo: ±${porcentaje(AJUSTE_TRIMMER)}.`,
};

const NOTA_CHEBYSHEV_PAR =
  'En Chebyshev de Orden par, en la Frecuencia de sintonía la pérdida es igual al ripple: cae en ' +
  'un máximo del ripple, como en el prototipo. El Capacitor de extremo de la salida absorbe la carga g(n+1) ≠ 1 ' +
  'del prototipo, así que el Orden par se arma con Rs y RL cualesquiera (Deducción propia).';

const avisoChebyshevPar = (pedido: number, n: number): Aviso<CodigoAvisoResonadores> => ({
  codigo: 'chebyshev-par',
  texto:
    `Chebyshev de Orden ${pedido} se calcula con Orden ${n}: el Orden par en resonadores ` +
    'acoplados es una Deducción propia que todavía no está aprobada.',
});

// El k del Capacitor de acople más chico: el del producto √(gk·g(k+1)) más grande. Null con Orden 1.
function acopleMasChico({ gs, n }: Modelo): number | null {
  let donde: number | null = null;
  for (let k = 1; k < n; k++) {
    if (donde === null || gs[k] * gs[k + 1] > gs[donde] * gs[donde + 1]) donde = k;
  }
  return donde;
}

// La L más grande, desde `desde` para arriba, con la que `cumple` sigue valiendo; `cumple` vale hasta
// una L y después ya no. Si no vale ni en `desde`, devuelve `desde`.
function ultimaL(desde: number, cumple: (l: number) => boolean): number {
  if (!cumple(desde)) return desde;
  let [bien, mal] = [desde, desde * 2];
  for (let i = 0; i < 200 && cumple(mal); i++) [bien, mal] = [mal, mal * 2];
  for (let i = 0; i < 200; i++) {
    const medio = (bien + mal) / 2;
    if (medio === bien || medio === mal) break;
    if (cumple(medio)) bien = medio;
    else mal = medio;
  }
  return bien;
}

// La Ventana de L. No depende de la L: las cotas de la L mínima, de los extremos y del acople salen
// en forma cerrada, y las de la sintonía, por bisección.
function ventanaDeL(modelo: Modelo): VentanaDeL {
  const { n, w0, sintonia } = modelo;
  const { lMin, cMin } = umbrales(null);
  const lMinima = lMin.impracticable;
  const c = cMin.impracticable;
  const extremos = [modelo.lDelExtremo('entrada'), modelo.lDelExtremo('salida')] as const;
  const masChico = acopleMasChico(modelo);
  // C(k,k+1) = FBW/(ω0²·L·√(gk·g(k+1))) = C. Con Orden 1, el Capacitor de extremo:
  // C01 = 1/(ω0·√(R·(Rp − R))) = C da Rp = R + 1/(R·(ω0·C)²), y de ahí la L.
  const acople =
    masChico !== null
      ? sintonia.fbw / (w0 * w0 * c * Math.sqrt(modelo.gs[masChico] * modelo.gs[masChico + 1]))
      : Math.min(
          ...LADOS.map((lado) => {
            const r = modelo.r(lado);
            return ((r + 1 / (r * (w0 * c) ** 2)) * sintonia.fbw) / (modelo.g(lado) * w0);
          }),
        );
  // Arriba de la cota de cada extremo (Rp > R), Ck = Cr·Ck/Cr baja con la L.
  const desde = Math.max(...extremos);
  const cr = (l: number) => 1 / (w0 * w0 * l);
  // La de C1 > 0 arranca de la cota de la entrada, y la de Cn > 0, de la de la salida: con Rp = R el
  // Capacitor de extremo no le quita nada al resonador.
  const positiva = (k: number) =>
    ultimaL(n === 1 ? desde : extremos[k === 1 ? 0 : 1], (l) => modelo.sintoniaRelativa(k, l) > 0);
  const sintoniaPositiva = [positiva(1), positiva(n)] as const;
  const todas = Array.from({ length: n }, (_, i) => i + 1);
  const cotaSintonia = ultimaL(desde, (l) =>
    todas.every((k) => cr(l) * modelo.sintoniaRelativa(k, l) > c),
  );
  // Los del medio no dependen de la L: si uno es negativo, ninguna L sirve.
  const realizable =
    todas.slice(1, -1).every((k) => modelo.sintoniaRelativa(k, desde) > 0) &&
    desde < Math.min(...sintoniaPositiva);

  const min = Math.max(lMinima, ...extremos);
  const max = Math.min(acople, cotaSintonia);
  const vacia = min >= max;
  // Con la ventana vacía se aceptan capacitores por debajo del mínimo (spec §7.7): la L más chica
  // que todavía se arma con la L mínima. Si ni eso, la más grande que se arma, debajo de la L mínima.
  // Sin ninguna L que se arme, el cálculo corta antes de usarla.
  const hasta = Math.min(...sintoniaPositiva);
  const elegida = vacia
    ? (elegirL(Math.max(lMinima, desde), hasta, 'menor') ?? elegirL(desde, hasta, 'mayor'))
    : elegirL(min, max, 'mayor');
  return {
    min,
    max,
    vacia,
    realizable,
    propuesta: elegida?.l ?? min,
    propuestaComo: vacia ? 'vacia' : elegida!.e12 ? 'mayor-e12' : 'centro',
    cotas: {
      lMinima,
      extremos,
      acople,
      acopleMasChico: masChico,
      sintonia: cotaSintonia,
      sintoniaPositiva,
    },
  };
}

// La L de la E12 más grande o más chica entre dos cotas abiertas, o el centro geométrico si no hay
// ninguna. Null si el intervalo está vacío.
function elegirL(
  desde: number,
  hasta: number,
  cual: 'mayor' | 'menor',
): { l: number; e12: boolean } | null {
  if (!(desde < hasta)) return null;
  const adentro = valoresDeSerie('E12', desde, hasta).filter((v) => v > desde && v < hasta);
  if (adentro.length === 0) return { l: Math.sqrt(desde * hasta), e12: false };
  return { l: cual === 'mayor' ? adentro[adentro.length - 1] : adentro[0], e12: true };
}

// --- Pasos intermedios, fórmulas y referencias ----------------------------------------------------

const hz = (f: number) => valorLatex(f, 'frecuencia');
const faradios = (c: number) => valorLatex(c, 'capacidad');
const henriosLatex = (l: number) => valorLatex(l, 'inductancia');
// "C01" → "C_{01}"; "C9,10" → "C_{9,10}".
const conIndice = (nombre: string) => `${nombre[0]}_{${nombre.slice(1)}}`;
const omega0 = (f0: number) => `2\\pi \\cdot ${hz(f0)}`;

// Lo que comparten los pasos: los g orientados con su índice en el prototipo, la banda y la L.
interface Contexto {
  gs: readonly number[];
  indiceG: (k: number) => number;
  banda: Banda;
  sintonia: Sintonia;
  l: number;
  cr: number;
  entrada: EntradaResonadores;
}

// g0·g1 o gn·g(n+1) con los índices del prototipo: con Bessel invertido, g_{n+1}·g_n en la entrada.
function productoExtremo({ gs, indiceG }: Contexto, lado: Lado) {
  const n = gs.length - 2;
  const [a, b] = lado === 'entrada' ? [0, 1] : [n, n + 1];
  return { simbolo: `g_{${indiceG(a)}} g_{${indiceG(b)}}`, valor: gs[a] * gs[b] };
}

const FUENTE_FIG = 'Matthaei, Young y Jones, Fig. 8.11-1';

// La Frecuencia de sintonía en las fórmulas: f0 a secas es la central geométrica (spec §7.1).
const F_SINTONIA = 'f_{\\mathrm{sint}}';

// Cómo se eligió la L propuesta, para los pasos y la pantalla.
export const COMO_SE_PROPUSO: Record<VentanaDeL['propuestaComo'], string> = {
  'mayor-e12': 'la más grande de la serie E12 en la Ventana de L',
  centro: 'el centro geométrico de la Ventana de L, que no tiene valores de la serie E12',
  vacia:
    'la Ventana de L está vacía: una L que se arma, aunque deje valores debajo de los mínimos ' +
    'de Valor impracticable',
};

function pasosDeSintonia({ banda, sintonia }: Contexto): Paso[] {
  const { f1, f2 } = banda;
  const { f0, fbw } = sintonia;
  const diferencia = f0 - banda.f0;
  const cifras = Math.max(4, cifrasDeSintonia(f0, banda.bw));
  const preciso = (f: number) => valorLatex(f, 'frecuencia', 'paso', cifras);
  return [
    {
      texto: 'Frecuencia de sintonía, con el mapeo de Cohn: la de cada resonador',
      latex:
        `${F_SINTONIA} = f_1 + f_2 - \\sqrt{(f_2 - f_1)^2 + f_1 f_2} = ${hz(f1)} + ${hz(f2)} - ` +
        `\\sqrt{(${hz(f2 - f1)})^2 + ${hz(f1)} \\cdot ${hz(f2)}} = ${preciso(f0)}`,
      fuente:
        'Matthaei, Young y Jones, ec. 8.11-2 (de Cohn), escrita con f en lugar de ω: su ω0 es ' +
        '2π por la Frecuencia de sintonía. Mantiene los bordes y el ripple hasta FBW ≈ 20 %.',
    },
    {
      texto: 'Ancho de banda relativo del diseño',
      latex:
        `\\mathrm{FBW} = \\dfrac{${F_SINTONIA}}{f_1} - \\dfrac{${F_SINTONIA}}{f_2} = ` +
        `\\dfrac{${preciso(f0)}}{${hz(f1)}} - \\dfrac{${preciso(f0)}}{${hz(f2)}} = ${numero(fbw)}`,
      fuente: 'Matthaei, Young y Jones, ec. 8.11-3.',
    },
    {
      texto:
        'Frecuencia de sintonía contra la central geométrica √(f1·f2): los resonadores se ajustan ' +
        'a la primera',
      latex:
        `${F_SINTONIA} - \\sqrt{f_1 f_2} = ${preciso(f0)} - ${preciso(banda.f0)} = ` +
        `${hz(diferencia)} \\;(${errorLatex(diferencia / banda.f0)})`,
    },
  ];
}

function pasosDeVentana(contexto: Contexto, v: VentanaDeL, propuesta: boolean): Paso[] {
  const { sintonia, entrada, gs, indiceG } = contexto;
  const n = gs.length - 2;
  const fuente = 'Spec §7.7: Ventana de L, criterio práctico.';
  const { lMinima, extremos, acople, acopleMasChico, sintoniaPositiva } = v.cotas;
  const cMin = umbrales(null).cMin.impracticable;
  const extremo = (lado: Lado, i: 0 | 1): Paso => {
    const { simbolo, valor } = productoExtremo(contexto, lado);
    const r = i === 0 ? entrada.rs : entrada.rl;
    const { texto, latex } = R_DEL_LADO[lado];
    return {
      texto: `Ventana de L, por la ${lado}: el resonador tiene que ver Rp > ${texto}`,
      latex:
        `L > \\dfrac{${latex} \\, \\mathrm{FBW}}{${simbolo} \\, \\omega_0} = ` +
        `\\dfrac{${ohms(r)} \\cdot ${numero(sintonia.fbw)}}{${numero(valor)} \\cdot ${omega0(sintonia.f0)}} = ` +
        henriosLatex(extremos[i]),
      fuente: 'Matthaei, Young y Jones, Fig. 8.11-1, ec. 5: con Rp ≤ R la raíz de C01 se anula.',
    };
  };
  const k = acopleMasChico;
  const superior: Paso =
    k !== null
      ? {
          texto:
            `Ventana de L, por arriba: el acople más chico, ${nombreEntre(k)}, no baja de la C ` +
            'mínima de Valor impracticable',
          latex:
            `L < \\dfrac{\\mathrm{FBW}}{\\omega_0^2 \\sqrt{g_{${indiceG(k)}} g_{${indiceG(k + 1)}}} \\, C_{\\min}} = ` +
            `\\dfrac{${numero(sintonia.fbw)}}{(${omega0(sintonia.f0)})^2 \\cdot ` +
            `${numero(Math.sqrt(gs[k] * gs[k + 1]))} \\cdot ${faradios(cMin)}} = ${henriosLatex(acople)}`,
          fuente,
        }
      : {
          texto:
            'Ventana de L, por arriba: con Orden 1 no hay acoples, así que el Capacitor de extremo ' +
            'más chico no baja de la C mínima de Valor impracticable',
          latex:
            `C_{\\mathrm{ext}} = \\dfrac{1}{\\omega_0 \\sqrt{R (R_p - R)}} > C_{\\min} = ${faradios(cMin)} ` +
            `\\Rightarrow L < ${henriosLatex(acople)}`,
          fuente,
        };
  return [
    {
      texto: 'Ventana de L, por abajo: la L mínima de Valor impracticable',
      latex: `L > L_{\\min} = ${henriosLatex(lMinima)}`,
      fuente,
    },
    extremo('entrada', 0),
    extremo('salida', 1),
    superior,
    {
      texto:
        'Ventana de L, por arriba: el Capacitor de sintonía más chico no baja de la C mínima de ' +
        'Valor impracticable. Cr baja con la L, y en los extremos el Capacitor de extremo además ' +
        'le quita más (bisección)',
      latex: `\\min C_k > C_{\\min} = ${faradios(cMin)} \\Rightarrow L < ${henriosLatex(v.cotas.sintonia)}`,
      fuente: `${FUENTE_FIG}, ec. 8 a 10, con C01e/Cr = FBW·Q/g0g1. Spec §12.1, P5.`,
    },
    {
      texto:
        'Realizabilidad, no de la ventana: por encima de estas L el Capacitor de sintonía de un ' +
        'extremo queda negativo y el filtro no se arma',
      latex:
        `C_1 > 0 \\Rightarrow L < ${henriosLatex(sintoniaPositiva[0])},\\; ` +
        `C_{${n}} > 0 \\Rightarrow L < ${henriosLatex(sintoniaPositiva[1])}`,
      fuente: `${FUENTE_FIG}, ec. 8 y 10. Spec §12.1, P5 y P7.`,
    },
    {
      texto: propuesta
        ? `Ventana de L y la L propuesta: ${COMO_SE_PROPUSO[v.propuestaComo]}`
        : v.vacia
          ? 'Ventana de L vacía: ninguna L cumple todas las cotas; la L es la que ingresaste'
          : 'Ventana de L; la L es la que ingresaste',
      latex:
        `${henriosLatex(v.min)} < L < ${henriosLatex(v.max)}` +
        `,\\; L = ${henriosLatex(propuesta ? v.propuesta : contexto.l)}`,
      fuente,
    },
  ];
}

function pasosDelDiseno(
  contexto: Contexto,
  extremos: readonly ExtremoResonadores[],
  acoples: readonly AcopleResonadores[],
  sintonias: readonly SintoniaResonador[],
): Paso[] {
  const { sintonia, l, cr, gs, indiceG } = contexto;
  const { f0, fbw } = sintonia;
  const n = sintonias.length;
  const pasoCr: Paso = {
    texto:
      'Capacidad total de cada resonador: con los vecinos a masa, sintoniza en la Frecuencia de ' +
      'sintonía',
    latex:
      `C_r = \\dfrac{1}{\\omega_0^2 L} = \\dfrac{1}{(${omega0(f0)})^2 \\cdot ${henriosLatex(l)}} = ` +
      faradios(cr),
    fuente: `${FUENTE_FIG}; Zverev, Handbook of Filter Synthesis, p. 299.`,
  };
  const pasosAcople = acoples.flatMap((a, i): Paso[] => {
    const k = i + 1;
    const indice = a.capacitor.nombre.slice(1);
    return [
      {
        texto: `Coeficiente de acople entre el resonador ${k} y el ${k + 1}`,
        latex:
          `k_{${indice}} = \\dfrac{\\mathrm{FBW}}{\\sqrt{g_{${indiceG(k)}} g_{${indiceG(k + 1)}}}} = ` +
          `\\dfrac{${numero(fbw)}}{\\sqrt{${numero(gs[k])} \\cdot ${numero(gs[k + 1])}}} = ${numero(a.k)}`,
        ...(i === 0 && { fuente: 'Matthaei, Young y Jones, Fig. 8.02-4, ec. 8 (Cohn y Dishal).' }),
      },
      {
        texto: `Capacitor de acople ${a.capacitor.nombre}`,
        latex:
          `${conIndice(a.capacitor.nombre)} = k_{${indice}} C_r = ${numero(a.k)} \\cdot ${faradios(cr)} = ` +
          faradios(a.capacitor.valor),
        ...(i === 0 && { fuente: `${FUENTE_FIG}, ec. 6; Zverev, p. 299: C_ik = K_ik·√(C_i·C_k).` }),
      },
    ];
  });
  const pasosExtremo = extremos.flatMap((x): Paso[] => {
    const { simbolo } = productoExtremo(contexto, x.lado);
    const lado = `\\mathrm{${x.lado}}`;
    const nombreR = R_DEL_LADO[x.lado].latex;
    const nombre = conIndice(x.capacitor.nombre);
    return [
      {
        texto: `Q externo de la ${x.lado}`,
        latex: `Q_{e,${lado}} = \\dfrac{${simbolo}}{\\mathrm{FBW}} = \\dfrac{${numero(x.g)}}{${numero(fbw)}} = ${numero(x.qExterno)}`,
        fuente: 'Matthaei, Young y Jones, Fig. 8.02-4, ec. 6 y 7.',
      },
      {
        texto: `La R que tiene que ver el resonador de la ${x.lado}`,
        latex:
          `R_{p,${lado}} = Q_{e,${lado}} \\, \\omega_0 L = ${numero(x.qExterno)} \\cdot ${omega0(f0)} \\cdot ` +
          `${henriosLatex(l)} = ${ohms(x.rp)}`,
      },
      ...pasosSeccionL(x.seccion, { menor: nombreR, mayor: 'R_p' }),
      {
        texto: `Capacitor de extremo ${x.capacitor.nombre}: la reactancia en serie de la red L`,
        latex:
          `${nombre} = \\dfrac{1}{\\omega_0 \\sqrt{${nombreR} (R_p - ${nombreR})}} = ` +
          `\\dfrac{1}{${omega0(f0)} \\cdot ${ohms(-x.seccion.xSerie)}} = ${faradios(x.capacitor.valor)}`,
        fuente: `${FUENTE_FIG}, ec. 5 y 7, que es la red L serie-paralelo exacta en la Frecuencia de sintonía.`,
      },
      {
        texto:
          `Lo que ${x.capacitor.nombre} le suma en derivación al resonador: la reactancia en ` +
          'derivación de la red L la pone el resonador',
        latex:
          `${nombre}^{e} = \\dfrac{1}{\\omega_0 X_p} = \\dfrac{1}{${omega0(f0)} \\cdot ${ohms(x.seccion.xDerivacion)}} = ` +
          faradios(x.enDerivacion),
        fuente: `${FUENTE_FIG}, ec. 11 y 12.`,
      },
    ];
  });
  const pasosSintonia = sintonias.map(({ capacitor, trimmer }, i): Paso => {
    const k = i + 1;
    const vecino = (lado: 'izquierda' | 'derecha') => {
      if (lado === 'izquierda') {
        return k === 1
          ? {
              simbolo: `${conIndice(extremos[0].capacitor.nombre)}^{e}`,
              valor: extremos[0].enDerivacion,
            }
          : {
              simbolo: conIndice(acoples[k - 2].capacitor.nombre),
              valor: acoples[k - 2].capacitor.valor,
            };
      }
      return k === n
        ? {
            simbolo: `${conIndice(extremos[1].capacitor.nombre)}^{e}`,
            valor: extremos[1].enDerivacion,
          }
        : {
            simbolo: conIndice(acoples[k - 1].capacitor.nombre),
            valor: acoples[k - 1].capacitor.valor,
          };
    };
    const [a, b] = [vecino('izquierda'), vecino('derecha')];
    return {
      texto:
        `Capacitor de sintonía ${capacitor.nombre}: lo que le falta al resonador para llegar a Cr. ` +
        `El trimmer tiene que cubrir de ${formatearValor(trimmer.min, 'capacidad', 'paso')} a ` +
        `${formatearValor(trimmer.max, 'capacidad', 'paso')} (±${porcentaje(AJUSTE_TRIMMER)}, criterio práctico)`,
      latex:
        `${conIndice(capacitor.nombre)} = C_r - ${a.simbolo} - ${b.simbolo} = ${faradios(cr)} - ` +
        `${faradios(a.valor)} - ${faradios(b.valor)} = ${faradios(capacitor.valor)}`,
      ...(i === 0 && { fuente: `${FUENTE_FIG}, ec. 8 a 10.` }),
    };
  });
  return [pasoCr, ...pasosAcople, ...pasosExtremo, ...pasosSintonia];
}

function pasosDivisor(contexto: Contexto, x: ExtremoResonadores, ck: SintoniaResonador): Paso[] {
  const w0 = 2 * Math.PI * contexto.sintonia.f0;
  const nombreR = R_DEL_LADO[x.lado].texto;
  const titulo =
    `Divisor capacitivo en la ${x.lado}, alternativa al Capacitor de extremo ${x.capacitor.nombre}: ` +
    `Ca del resonador a la toma y Cb de la toma a masa, con ${nombreR} en la toma. Fijan la ` +
    `conductancia 1/Rp y la capacidad del nodo, así que el resonador queda sin ${ck.capacitor.nombre}`;
  const fuente =
    'research/resonadores-acoplados.md, §3.2: cálculo propio, verificado por simulación ' +
    '(Deducción propia). Zverev, Handbook of Filter Synthesis, Tabla 10.5, da la forma con la ' +
    'aproximación de Q alto, Rp ≈ R·(1 + Cb/Ca)².';
  const { gp, b, reZ, cb } = cuentasDivisor(x, ck.capacitor.valor, w0);
  const siemens = (s: number) => `${numero(s * 1e3)}\\,\\mathrm{mS}`;
  const cuentas =
    `G_p = \\dfrac{1}{R_p} = ${siemens(gp)},\\; B = \\omega_0 (${conIndice(ck.capacitor.nombre)} + ` +
    `${conIndice(x.capacitor.nombre)}^{e}) = ${siemens(b)},\\; ` +
    `\\operatorname{Re} Z_t = \\dfrac{G_p}{G_p^2 + B^2} = ${ohms(reZ)}`;
  if (!x.divisor) {
    return [
      {
        texto: `${titulo}. Con estos valores no se arma`,
        latex: `${cuentas},\\; G = \\dfrac{1}{R} = ${siemens(1 / x.r)}`,
        fuente,
      },
    ];
  }
  return [
    { texto: titulo, latex: cuentas, fuente },
    {
      texto: `Cb y Ca del divisor de la ${x.lado}`,
      latex:
        `C_b = \\dfrac{\\sqrt{G/\\operatorname{Re} Z_t - G^2}}{\\omega_0} = ${faradios(cb)},\\; ` +
        `\\dfrac{1}{\\omega_0 C_a} = \\dfrac{B}{G_p^2 + B^2} - \\dfrac{\\omega_0 C_b}{G^2 + \\omega_0^2 C_b^2} ` +
        `\\Rightarrow C_a = ${faradios(x.divisor.ca)}`,
    },
  ];
}

function pasoCohn(
  { sintonia, entrada, indiceG }: Contexto,
  g: readonly number[],
  perdida: number,
): Paso {
  const indices = g.map((_, i) => `g_{${indiceG(i + 1)}}`).join(' + ');
  const valores = g.map((x) => numero(x)).join(' + ');
  return {
    texto: `Pérdida de Cohn en la Frecuencia de sintonía, con Qu = ${formatearValor(entrada.qBobina, 'numero')}`,
    latex:
      `\\Delta L_0 \\approx 4{,}343 \\cdot \\dfrac{${indices}}{\\mathrm{FBW} \\cdot Q_u} = ` +
      `4{,}343 \\cdot \\dfrac{${valores}}{${numero(sintonia.fbw)} \\cdot ${numero(entrada.qBobina)}} = ` +
      valorLatex(perdida, 'decibeles'),
    fuente:
      'Matthaei, Young y Jones, ec. 4.13-11 y 4.13-2, con el FBW de Cohn: cada resonador con Qk = ' +
      'FBW·Qu. No depende de la L. Estimación: en esta Topología queda unos puntos por encima de la ' +
      'pérdida simulada (research/resonadores-acoplados.md, §6.1).',
  };
}

const FORMULAS_RESONADORES: readonly string[] = [
  '\\omega_0 = \\omega_1 + \\omega_2 - \\sqrt{(\\omega_2 - \\omega_1)^2 + \\omega_1 \\omega_2},\\; ' +
    '\\mathrm{FBW} = \\dfrac{\\omega_0}{\\omega_1} - \\dfrac{\\omega_0}{\\omega_2}',
  'C_r = \\dfrac{1}{\\omega_0^2 L},\\; k_{k,k+1} = \\dfrac{\\mathrm{FBW}}{\\sqrt{g_k g_{k+1}}},\\; ' +
    'C_{k,k+1} = k_{k,k+1} C_r',
  'Q_e = \\dfrac{g_0 g_1}{\\mathrm{FBW}},\\; R_p = Q_e \\, \\omega_0 L',
  'C_{01} = \\dfrac{1}{\\omega_0 \\sqrt{R_s (R_p - R_s)}},\\; C_{01}^{e} = C_{01} \\dfrac{R_p - R_s}{R_p}',
  'C_k = C_r - C_{k-1,k} - C_{k,k+1}\\;\\text{(en los extremos, el }C^{e}\\text{ del Capacitor de extremo)}',
];

export const REFERENCIAS_RESONADORES: readonly Referencia[] = [
  {
    autor: 'G. L. Matthaei, L. Young y E. M. T. Jones',
    obra: 'Microwave Filters, Impedance-Matching Networks, and Coupling Structures',
    edicion: '1.ª',
    editor: 'McGraw-Hill',
    anio: 1964,
    ubicacion:
      'Fig. 8.11-1, ec. 8.11-2 y 8.11-3, Fig. 8.02-4, ec. 4.13-2 y 4.13-11, tablas 4.05-1, 4.05-2 y ' +
      '4.07-1',
  },
  {
    autor: 'S. B. Cohn',
    obra: 'Proceedings of the IRE',
    volumen: '45(2)',
    anio: 1957,
    ubicacion:
      '"Direct-coupled-resonator filters", págs. 187-196, a través de Matthaei, Young y Jones',
  },
  {
    autor: 'A. I. Zverev',
    obra: 'Handbook of Filter Synthesis',
    edicion: '1.ª',
    editor: 'Wiley',
    anio: 1967,
    ubicacion: 'págs. 296-305 y 565-568, Fig. 10.90 y Tabla 10.5',
  },
  {
    autor: 'A. B. Williams y F. J. Taylor',
    obra: 'Electronic Filter Design Handbook',
    edicion: '4.ª',
    editor: 'McGraw-Hill',
    anio: 2006,
    ubicacion: 'págs. 183-184 y Ejemplo 8-2',
  },
];

const NOTA_BESSEL =
  'El prototipo de Bessel no es simétrico: se armó con el g grande del lado de la R mayor, que es ' +
  'el extremo que pide más L. Los pasos intermedios lo detallan.';

// g0·g1 y gn·g(n+1), como se usan en cada extremo, y por qué quedaron así.
function pasoOrientacion(gs: readonly number[], invertido: boolean, rs: number, rl: number): Paso {
  const n = gs.length - 2;
  const productos =
    `g_0 g_1 = ${numero(gs[0] * gs[1])},\\; ` +
    `g_{${n}} g_{${n + 1}} = ${numero(gs[n] * gs[n + 1])}`;
  if (invertido) {
    return {
      texto:
        'Bessel con el prototipo invertido: de gn a g1 desde la fuente, para que el g grande quede ' +
        'del lado de RL, la R mayor',
      latex: `R_L = ${ohms(rl)} > R_s = ${ohms(rs)}:\\; ${productos}`,
      fuente:
        'research/resonadores-acoplados.md, §2.4: con terminaciones iguales el prototipo se puede ' +
        'dar vuelta, y el extremo con el g chico es el que más L pide para Rp > R.',
    };
  }
  return {
    texto:
      rs === rl
        ? 'Bessel con la orientación de la tabla: g1, el g grande, junto a la fuente'
        : 'Bessel con la orientación de la tabla: g1, el g grande, ya queda del lado de Rs, la R mayor',
    latex: productos,
  };
}

// --- Registro común (spec §13.5) ------------------------------------------------------------------

export const DEDUCCION_CHEBYSHEV_PAR: EntradaRegistro = {
  tipo: 'deduccion-propia',
  id: 'chebyshev-par-resonadores',
  nombre: 'Chebyshev de Orden par con terminaciones iguales en resonadores acoplados',
  queEs:
    'En la Topología de resonadores acoplados, Chebyshev de Orden par se arma con Rs y RL ' +
    'cualesquiera, también iguales, con el prototipo de terminaciones iguales tal cual. En la ' +
    'Frecuencia de sintonía la pérdida es igual al ripple.',
  adaptacion:
    'En π y T, Chebyshev par con Rs = RL no se puede armar: el prototipo pide una carga de ' +
    'coth²(β/4)·R0, y el Orden sube al impar (spec §7.3). Matthaei (Fig. 8.11-1) calcula cada ' +
    'extremo con su propia conductancia, G_A y G_B libres: el g(n+1) ≠ 1 entra solo en el inversor ' +
    'J(n,n+1) de Matthaei, y el Capacitor de extremo de la salida transforma RL en el Rp que pide el prototipo. Lo propio es ' +
    'aplicarlo al Chebyshev par, que Matthaei no trata aparte.',
  respaldo:
    'Simulación ABCD de la red completa (research/resonadores-acoplados.md §5): CR5 (Chebyshev ' +
    '0,1 dB, n = 4) y CR6 (0,5 dB, n = 2) de 50 a 50 Ω y CR11 (0,5 dB, n = 4) de 50 a 300 Ω, con ' +
    'los bordes en el ripple y la pérdida en la Frecuencia de sintonía igual al ripple. Los casos corren de los dos lados ' +
    'de la bandera.',
  deduccion: [
    {
      texto: 'El prototipo de Orden par termina en una carga distinta de la fuente',
      latex: 'g_{n+1} = \\coth^2\\left(\\dfrac{\\beta}{4}\\right) \\neq 1',
    },
    {
      texto: 'Matthaei calcula el inversor J(n,n+1) con la conductancia de la carga, que es libre',
      latex: 'J_{n,n+1} = \\sqrt{\\dfrac{G_B \\, b \\, \\mathrm{FBW}}{g_n g_{n+1}}}',
    },
    {
      texto:
        'Despejado en L: el Capacitor de extremo de la salida lleva RL al Rp que pide el prototipo',
      latex: 'R_{p,n} = \\dfrac{g_n g_{n+1} \\, \\omega_0 L}{\\mathrm{FBW}} > R_L',
    },
    {
      texto:
        'En la Frecuencia de sintonía la red es el prototipo en Ω = 0, que en Chebyshev par está ' +
        'en un máximo del ripple',
      latex: 'A(f_{\\mathrm{sint}}) = A_{\\mathrm{prototipo}}(0) = r',
    },
  ],
  planB: 'Chebyshev de Orden par sube al impar siguiente, con aviso, como en π y T.',
  bandera: 'PLAN_B_CHEBYSHEV_PAR',
};

export const DEDUCCION_DIVISOR_CAPACITIVO: EntradaRegistro = {
  tipo: 'deduccion-propia',
  id: 'divisor-capacitivo',
  nombre: 'Divisor capacitivo como alternativa al Capacitor de extremo',
  queEs:
    'Los pasos intermedios muestran, como alternativa al Capacitor de extremo en serie, un divisor ' +
    'capacitivo en cada extremo: Ca del resonador a la toma y Cb de la toma a masa, con la R en la ' +
    'toma. Reemplaza al Capacitor de extremo y al de sintonía de ese resonador.',
  adaptacion:
    'Zverev (Handbook of Filter Synthesis, Tabla 10.5) da el divisor con la aproximación de Q alto, ' +
    'C1/C2 = √(Rx/R1) − 1. La forma exacta en ω0 es propia: Ca y Cb fijan a la vez la conductancia ' +
    '1/Rp y toda la capacidad que le falta al nodo, así que el resonador del extremo no lleva C ' +
    'propio. No se comparó número a número con el ejemplo de Zverev (pág. 568).',
  respaldo:
    'En CR10 (Butterworth n = 3 de 50 a 300 Ω, research/resonadores-acoplados.md §3.2) la ' +
    'aproximación de Q alto da Rp = 731,6 Ω contra 736,5 Ω (−0,7 %), y la red simulada con los dos ' +
    'divisores adapta en la Frecuencia de sintonía y tiene los bordes en 144,008 y 148,011 MHz, contra 143,989 y 148,002 ' +
    'MHz con el Capacitor de extremo.',
  deduccion: [
    {
      texto:
        'Desde el nodo, Ca en serie con Cb ∥ R tiene que dar lo que daban el Capacitor de extremo ' +
        'con su R y el de sintonía',
      latex:
        '\\dfrac{1}{j\\omega_0 C_a} + \\dfrac{1}{G + j\\omega_0 C_b} = \\dfrac{1}{G_p + jB},\\; ' +
        'G_p = \\dfrac{1}{R_p},\\; B = \\omega_0 (C_k + C^{e})',
    },
    {
      texto: 'Las partes reales dan Cb',
      latex:
        '\\dfrac{G}{G^2 + \\omega_0^2 C_b^2} = \\operatorname{Re} Z_t = \\dfrac{G_p}{G_p^2 + B^2} ' +
        '\\Rightarrow C_b = \\dfrac{\\sqrt{G/\\operatorname{Re} Z_t - G^2}}{\\omega_0}',
    },
    {
      texto: 'Las imaginarias, Ca',
      latex:
        '\\dfrac{1}{\\omega_0 C_a} = \\dfrac{B}{G_p^2 + B^2} - ' +
        '\\dfrac{\\omega_0 C_b}{G^2 + \\omega_0^2 C_b^2}',
    },
    {
      texto: 'Control con Q alto (Zverev, Tabla 10.5)',
      latex: 'R_p \\approx R \\left(1 + \\dfrac{C_b}{C_a}\\right)^2',
    },
  ],
  planB: 'El divisor se saca de los pasos intermedios; el resultado principal no cambia.',
  bandera: 'PLAN_B_DIVISOR_CAPACITIVO',
};

export const CRITERIO_VENTANA_DE_L: EntradaRegistro = {
  tipo: 'criterio-practico',
  id: 'ventana-de-l',
  nombre: 'Ventana de L de los resonadores acoplados',
  queEs:
    'La L de los resonadores se elige por construcción, porque la pérdida por Qu no depende de ' +
    `ella. La Ventana de L va de la mayor entre la L mínima de Valor impracticable (${L_MINIMA}) y ` +
    'la que pide cada extremo para que el resonador vea una R mayor que Rs o RL, a la que deja el ' +
    `Capacitor de acople más chico en la C mínima de Valor impracticable (${C_MINIMA}). El ` +
    'Asistente propone la L más grande de la serie E12 adentro, y el Alumno la puede cambiar.',
  adaptacion:
    'La investigación propone la ventana con 5 nH y 1 pF provisorios; se toman los mínimos de ' +
    'Valor impracticable. La construcción agregó tres cosas (spec §12.1, P5). Con Orden 1, que no ' +
    'tiene acoples, la cota del acople la pone el Capacitor de extremo más chico. La cota de ' +
    'arriba también incluye la L en la que el Capacitor de sintonía más chico llega a la C mínima: ' +
    'Cr baja con la L, y con banda ancha lo que suma el Capacitor de extremo crece con ella y se ' +
    'come el de sintonía de un extremo antes de que el acople baje del mínimo; sin esa cota se ' +
    'proponían Capacitores de sintonía de décimas de pF, o negativos. Y si la ventana no tiene ' +
    'ningún valor de la E12, se propone su centro geométrico. Con la ventana vacía se aceptan ' +
    'capacitores por debajo del mínimo: se propone la L más chica de la E12 que todavía se arma ' +
    '(Rp > R y todos los Capacitores de sintonía positivos). Si ninguna L la arma, no se calcula.',
  respaldo:
    'research/resonadores-acoplados.md §6: con Qu = 100 la pérdida da lo mismo con L de 10 a ' +
    '100 nH, y Zverev (págs. 300 y 305) y Hayward eligen todas las L iguales y de un valor ' +
    'conveniente. Las ventanas de §6.2 en 144–148 MHz están en los casos de Vitest.',
  planB:
    'Se ajustan las cotas: la L mínima y la C mínima salen de MONTAJE ' +
    '(src/calculo/comun/valor-impracticable.ts).',
  bandera: null,
};

export const CRITERIO_TRIMMER: EntradaRegistro = {
  tipo: 'criterio-practico',
  id: 'trimmer-20',
  nombre: `±${porcentaje(AJUSTE_TRIMMER)} del trimmer de los Capacitores de sintonía`,
  queEs:
    'Cada Capacitor de sintonía se arma con trimmer, y el valor calculado es el punto medio del ' +
    'ajuste: el trimmer, solo o con un fijo en paralelo, tiene que cubrir ' +
    `±${porcentaje(AJUSTE_TRIMMER)} del valor calculado.`,
  adaptacion:
    `El ±${porcentaje(AJUSTE_TRIMMER)} compensa un error parecido en la L de los resonadores ` +
    '(la bobina hecha a mano y sus terminales), que corre la C de sintonía lo mismo. La ' +
    'bibliografía dice que se ajustan con trimmer, pero no da un rango.',
  respaldo:
    'research/resonadores-acoplados.md §6.3: un 1 % de error en un resonador corre la banda un ' +
    '18 % del BW, así que cada uno tiene que poder ajustarse.',
  planB: 'Se ajusta el porcentaje: AJUSTE_TRIMMER en src/calculo/filtros/resonadores.ts.',
  bandera: null,
};
