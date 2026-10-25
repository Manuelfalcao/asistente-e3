import { formatearErrorRelativo, formatearValor } from '../../entrada/formato';
import { numeroLatex as numero } from '../comun/latex';
import type { EntradaRegistro } from '../comun/registro';
import type { Aviso, Paso, Referencia } from '../comun/resultado';
import { type Componente, type Revision, revisarValores } from '../comun/valor-impracticable';
import { type DosCapas, PLAN_B_DOS_CAPAS, calcularDosCapas } from './dos-capas';
import {
  type DiametroRF,
  type Geometria,
  type LaminaUnaCapa,
  type Medidas,
  MU0,
  PULGADA,
  despejarVueltas,
  diametroRF,
  geometria,
  unaCapa as laminaUnaCapa,
  vueltasDeWheeler,
  wheeler1928,
} from './formulas';
import {
  type Autorresonancia,
  LUNDIN,
  MARGEN_SRF,
  MEDHURST,
  SRF_DE_KNIGHT,
  type Vecino,
  WHEELER_1928,
  autorresonancia,
  cuatroCifras,
  errorLatex,
  henrios,
  mm,
  pasoDelMargen,
  pasosDeLundin,
  porciento,
  pulgadas,
  vecinosDe,
} from './comun';

export type { Autorresonancia, Vecino } from './comun';

// La Calculadora de bobinas (spec §6): cuántas vueltas dar a una bobina solenoidal de aire para la
// inductancia buscada. Pura: recibe H, m y Hz, y devuelve los valores con sus fórmulas, sus pasos y
// su referencia.

export interface EntradaBobina extends Medidas {
  // La L buscada, en H.
  inductancia: number;
  // En Hz. Vacía: no se avisa por autorresonancia.
  frecuencia?: number | null;
}

// La bandera del plan B de la Deducción propia del diámetro de RF (spec §13.5): si la Cátedra no la
// aprueba, se pone en true y el resultado principal de una capa pasa a D0, con la corrección de RF
// como nota.
export const PLAN_B_DIAMETRO_RF = false;

export interface OpcionesBobina {
  // El plan B del diámetro de RF de una capa.
  planB?: boolean;
  // El plan B de dos capas: Rosa y Grover (91) sin la corrección de Maxwell.
  planBDosCapas?: boolean;
}

// Con qué diámetro se calcula la L: el de RF, D∞, o el de baja frecuencia, D0.
export type Diametro = 'rf' | 'd0';

export const DEDUCCION_DIAMETRO_RF: EntradaRegistro = {
  tipo: 'deduccion-propia',
  id: 'diametro-rf-una-capa',
  nombre: 'Diámetro efectivo de RF en una capa (Knight, ec. 4.2)',
  queEs:
    'El resultado principal de una capa se calcula con el diámetro efectivo de RF D∞ de Knight ' +
    '(Solenoid Inductance Calculation, ec. 4.2) en lugar del diámetro al centro del cable D0: en ' +
    'RF la corriente se corre hacia el interior de la bobina por efecto pelicular y de ' +
    'proximidad, y en VHF la L baja del 2 al 17 % respecto de la de baja frecuencia.',
  adaptacion:
    'Knight propone D∞ como una fórmula semiempírica, sin referato: un promedio ponderado entre D0 ' +
    'y su cota Dmin = D0 − d + 2d/N, con un peso que crece cuanto más juntas están las vueltas. ' +
    'Vale cuando el radio del cable supera tres profundidades peliculares, cosa que en VHF siempre ' +
    'pasa. La fórmula se usa tal cual; lo propio es tomarla como resultado principal. La L y el N ' +
    'con D0 quedan en los pasos intermedios. Con menos de dos vueltas Dmin queda por encima de D0 ' +
    'y la fórmula sube la L en lugar de bajarla; ese caso ya lleva el aviso de menos de dos ' +
    'vueltas. Con un cable más grueso que el carrete, D∞ tiende al carrete y la L de RF deja de ' +
    'crecer con las vueltas: el Asistente no calcula.',
  respaldo:
    'Las bobinas M31 y M32 de Medhurst, medidas en HF (casos de medición, de los dos lados de la ' +
    'bandera). Knight dice que predice la L de HF de bobinas típicas dentro de unas pocas partes ' +
    'en mil. Las MKG1 a MKG4 de Knight no sirven para respaldarla: están medidas a baja frecuencia ' +
    '(su Li es la inductancia interna de continua completa, μ0·D·N/8) y quedan como casos de ' +
    'referencia de la L con D0.',
  deduccion: [
    {
      texto: 'Cota inferior: la corriente pegada al lado interno del cable (Knight, ec. 4.1)',
      latex: 'D_{\\mathrm{min}} = D_0 - d + \\dfrac{2d}{N}',
    },
    {
      texto: 'Peso de la cota: con vueltas juntas (p = d) es infinito y D∞ = Dmin',
      latex: 'w = \\dfrac{1}{(p/d - 1)^2}',
    },
    {
      texto: 'Promedio ponderado (Knight, ec. 4.2): con vueltas muy separadas tiende a D0',
      latex: 'D_\\infty = \\dfrac{D_0 + D_{\\mathrm{min}} w}{1 + w}',
    },
    {
      texto: 'Se reemplaza D por D∞ en Rosa y Nagaoka (Knight, ec. 10.6)',
      latex:
        'L = \\dfrac{\\mu_0 \\pi D_\\infty^2 N^2 k_L(D_\\infty/\\ell)}{4\\ell} - ' +
        '\\dfrac{\\mu_0 D_\\infty N (k_s + k_m)}{2}',
    },
  ],
  planB:
    'El resultado principal de una capa se calcula con D0 (Rosa y Nagaoka de baja frecuencia) y ' +
    'la corrección de RF con D∞ queda como nota en la tarjeta.',
  bandera: 'PLAN_B_DIAMETRO_RF',
};

export type CodigoCorte = 'menos-de-una-vuelta' | 'fuera-del-modelo';
export type CodigoAviso = 'menos-de-dos-vueltas' | 'autorresonancia' | 'terminales';

// La L buscada, para el criterio común de valor impracticable: sin frecuencia de trabajo solo se le
// aplica la L mínima (spec §5.6).
export interface LBuscada extends Componente {
  componente: 'L';
  nombre: 'L buscada';
}

export interface UnaCapa {
  // Con qué diámetro está calculado el resultado principal.
  diametro: Diametro;
  // El N real que da la L buscada.
  vueltas: number;
  vecinos: readonly [Vecino, Vecino];
  srf: Autorresonancia;
  // Las fórmulas que se usaron, sin números: van a la vista en la tarjeta.
  formulas: readonly string[];
  // Al final, la cuenta del criterio de valor impracticable de la L buscada.
  pasos: readonly Paso[];
  // Con qué diámetro está la L: con D∞, que es una Deducción propia; en el plan B, la corrección
  // de RF como nota.
  notaDiametro: string;
  // Las demás notas de la tarjeta.
  notas: readonly string[];
  referencias: readonly Referencia[];
}

interface Comun {
  buscada: LBuscada;
  // Valor dudoso o impracticable de la L buscada, también cuando no se calcula. Su cuenta está al
  // final de los pasos.
  revision: Revision;
  notas: readonly string[];
}

export type ResultadoBobinas =
  | (Comun & { estado: 'corte'; codigo: CodigoCorte; texto: string; pasos: readonly Paso[] })
  | (Comun & {
      estado: 'calculado';
      unaCapa: UnaCapa;
      // Siempre junto a la de una capa (spec §6.1): calculada o fuera del rango de la fórmula.
      dosCapas: DosCapas;
      avisos: readonly Aviso<CodigoAviso>[];
    });

// §6.8, lo que corresponde a una capa.
export const REFERENCIAS_UNA_CAPA: readonly Referencia[] = [
  {
    autor: 'D. W. Knight',
    obra: 'Solenoid Inductance Calculation',
    volumen: 'v0.20',
    anio: 2016,
    ubicacion: 'ec. 10.6, 10.4 y 10.18, con el método de Rosa (1906) y de Rosa y Grover (1912)',
  },
  LUNDIN,
  {
    autor: 'D. W. Knight',
    obra: 'Solenoid Inductance Calculation',
    volumen: 'v0.20',
    anio: 2016,
    ubicacion: 'ec. 4.2 (diámetro efectivo de RF, semiempírica y sin referato)',
  },
  SRF_DE_KNIGHT,
  MEDHURST,
  WHEELER_1928,
];

// Debajo de esto la nota de terminales pasa a aviso destacado (spec §6.7).
const L_TERMINALES = 100e-9;
// Knight (part_1, B2): unos 20 nH por pulgada.
const TERMINALES_POR_CM = 8e-9;
// Un esmalte típico, para mostrar su efecto en ks: el 5 % del diámetro con esmalte.
const ESMALTE = 0.05;

const NOTA_TERMINALES =
  'Los terminales suman unos 8 nH por cm (Knight): dejalos cortos y contalos en la L.';
const NOTA_METAL =
  'El metal cercano (un blindaje, el plano de masa) baja la L: actúa como una espira en ' +
  'cortocircuito acoplada a la bobina.';
const NOTA_AJUSTE =
  'Estirar o comprimir la bobina ajusta la L: estirada baja y comprimida sube. El Asistente no ' +
  'calcula la Separación que da la L exacta.';
const NOTA_RF =
  'L de RF, con el diámetro efectivo de Knight (ec. 4.2): una fórmula semiempírica, sin referato.';

// La lámina con N vueltas y el diámetro de RF o el de baja frecuencia.
function laminaCon(g: Geometria, diametro: Diametro) {
  return (n: number) => laminaUnaCapa(g, n, diametro === 'd0' ? g.d0 : diametroRF(g, n).dInfinito);
}

// Una capa con N fijo, con el diámetro de RF o con D0, y sus pasos intermedios: lo que los Casos
// de prueba comparan de una bobina publicada, con los mismos pasos que ve el Alumno.
export function unaCapaConPasos(medidas: Medidas, n: number, diametro: Diametro) {
  const g = geometria(medidas);
  const rf = diametro === 'rf' ? diametroRF(g, n) : null;
  const lamina = laminaUnaCapa(g, n, rf ? rf.dInfinito : g.d0);
  return { lamina, pasos: [...pasosDeGeometria(medidas), ...pasosDeLaL(g, lamina, rf)] };
}

export function calcularBobinas(
  { inductancia: buscada, frecuencia = null, ...medidas }: EntradaBobina,
  { planB = PLAN_B_DIAMETRO_RF, planBDosCapas = PLAN_B_DOS_CAPAS }: OpcionesBobina = {},
): ResultadoBobinas {
  const g = geometria(medidas);
  const diametro: Diametro = planB ? 'd0' : 'rf';
  const lamina = laminaCon(g, diametro);
  const lBuscada: LBuscada = { componente: 'L', nombre: 'L buscada', valor: buscada };
  const revision = revisarValores({ lBuscada }, frecuencia);
  const comun = { buscada: lBuscada, revision };

  const deUnaVuelta = unaCapaConPasos(medidas, 1, diametro);
  if (deUnaVuelta.lamina.inductancia > buscada) {
    return {
      ...comun,
      estado: 'corte',
      codigo: 'menos-de-una-vuelta',
      texto:
        `Una sola vuelta sobre este carrete ya da ` +
        `${formatearValor(deUnaVuelta.lamina.inductancia, 'inductancia')}: para ` +
        `${formatearValor(buscada, 'inductancia')} hace falta menos de una vuelta. Usá un lazo o ` +
        'una pista.',
      pasos: [...deUnaVuelta.pasos, ...revision.pasos],
      notas: [NOTA_TERMINALES, NOTA_METAL],
    };
  }
  const vueltas = despejarVueltas((n) => lamina(n).inductancia, buscada);
  if (vueltas === null) {
    return {
      ...comun,
      estado: 'corte',
      codigo: 'fuera-del-modelo',
      texto:
        'Con esta geometría la L no crece con las vueltas: el cable es más grueso que el carrete y ' +
        'el modelo de solenoide no sirve.',
      pasos: revision.pasos,
      notas: [NOTA_METAL],
    };
  }

  const vecino = (n: number): Vecino => {
    const l = lamina(n).inductancia;
    return {
      vueltas: n,
      inductancia: l,
      error: l / buscada - 1,
      largoBobina: (n - 1) * g.entreCentros + g.cable,
      destacado: false,
    };
  };
  const { vecinos, cercano } = vecinosDe(vueltas, vecino);

  const real = lamina(vueltas);
  const srf = autorresonancia(
    {
      diametro: g.d0,
      simboloDiametro: 'D_0',
      vueltas: real.vueltas,
      avance: real.largo,
      simboloAvance: '\\ell',
      largo: real.largo,
      simboloLargo: '\\ell',
    },
    buscada,
  );
  const otro = otroDiametro(g, buscada, cercano.vueltas, diametro);
  // Wheeler se compara con Rosa y Nagaoka con D0, el mismo diámetro.
  const conD0 = diametro === 'd0' ? vueltas : otro.vueltas;

  const pasos: Paso[] = [
    ...pasosDeGeometria(medidas),
    {
      texto: 'N real: la bisección sobre N hasta que L(N) da la L buscada',
      latex: `L(N) = ${henrios(buscada)} \\;\\Rightarrow\\; N = ${numero(vueltas)}`,
    },
    ...pasosDeLaL(g, real, diametro === 'rf' ? diametroRF(g, vueltas) : null),
    ...pasosDelOtroDiametro(g, cercano, otro, diametro),
    ...srf.pasos,
    ...(frecuencia === null ? [] : [pasoDelMargen(frecuencia, srf.valores.estimada)]),
    ...(conD0 === null ? [] : pasosDeWheeler(g, buscada, conD0)),
    ...revision.pasos,
  ];

  const avisos = avisosDe(buscada, vueltas, frecuencia, srf.valores.estimada);
  return {
    ...comun,
    estado: 'calculado',
    unaCapa: {
      diametro,
      vueltas,
      vecinos,
      srf: srf.valores,
      formulas: formulasDe(diametro),
      pasos,
      notaDiametro: diametro === 'rf' ? NOTA_RF : notaDelPlanB(cercano, otro),
      notas: [NOTA_AJUSTE],
      referencias: REFERENCIAS_UNA_CAPA,
    },
    dosCapas: calcularDosCapas(medidas, buscada, frecuencia, planBDosCapas),
    avisos,
    notas: [
      ...(avisos.some((a) => a.codigo === 'terminales') ? [] : [NOTA_TERMINALES]),
      NOTA_METAL,
    ],
  };
}

// En el plan B, la corrección de RF como nota. Con menos de dos vueltas la cota de Knight queda
// por encima de D0 y no baja la L: la nota no dice que baja.
function notaDelPlanB(cercano: Vecino, otro: OtroDiametro): string {
  const cambio = otro.inductancia / cercano.inductancia - 1;
  return (
    `L con el diámetro al centro del cable, D0. Con el diámetro efectivo de RF de Knight ` +
    `(ec. 4.2, semiempírica) las ${formatearValor(cercano.vueltas, 'numero')} vueltas darían ` +
    `${formatearValor(otro.inductancia, 'inductancia')} (${formatearErrorRelativo(cambio * 100)})` +
    (cambio < 0
      ? ': en RF la corriente se corre hacia el interior de la bobina y la L real queda por debajo.'
      : '. Con menos de dos vueltas esa fórmula no corrige hacia abajo.')
  );
}

function avisosDe(
  buscada: number,
  vueltas: number,
  frecuencia: number | null,
  srf: number,
): Aviso<CodigoAviso>[] {
  const avisos: Aviso<CodigoAviso>[] = [];
  if (vueltas < 2) {
    avisos.push({
      codigo: 'menos-de-dos-vueltas',
      texto:
        'Con menos de dos vueltas el modelo de solenoide pierde precisión y los terminales dominan: ' +
        'la L armada puede quedar lejos de la calculada.',
    });
  }
  if (frecuencia !== null && frecuencia > srf / MARGEN_SRF) {
    avisos.push({
      codigo: 'autorresonancia',
      texto:
        `La frecuencia de trabajo (${formatearValor(frecuencia, 'frecuencia')}) supera un tercio de ` +
        `la autorresonancia estimada (${formatearValor(srf, 'frecuencia')}): la bobina queda cerca ` +
        'de su autorresonancia y no se va a comportar como una L pura.',
    });
  }
  if (buscada < L_TERMINALES) {
    avisos.push({
      codigo: 'terminales',
      texto:
        `Con ${formatearValor(buscada, 'inductancia')} los terminales pesan: suman unos 8 nH por cm ` +
        `(Knight), así que 1 cm de terminales le agrega un ` +
        `${formatearValor((TERMINALES_POR_CM / buscada) * 100, 'porcentaje')}. Dejalos lo más ` +
        'cortos que puedas y contalos en la L.',
    });
  }
  return avisos;
}

function formulasDe(diametro: Diametro): string[] {
  // Una fórmula corta por línea, para que cada una entre en el celular.
  return [
    'L = L_s - \\dfrac{\\mu_0 D N (k_s + k_m)}{2}',
    'L_s = \\dfrac{\\mu_0 \\pi D^2 N^2 k_L(x)}{4\\ell}',
    'x = \\dfrac{D}{\\ell}, \\quad \\ell = N p',
    ...(diametro === 'd0'
      ? ['D = D_0 = D_{\\mathrm{c}} + d']
      : [
          'D = D_\\infty = \\dfrac{D_0 + D_{\\mathrm{min}} w}{1 + w}',
          'D_{\\mathrm{min}} = D_0 - d + \\dfrac{2d}{N}',
          'w = \\dfrac{1}{(p/d - 1)^2}',
        ]),
  ];
}

// --- Pasos intermedios (spec §6.6) ----------------------------------------------------------------
// Cada fórmula va con sus números sustituidos, con 4 cifras (spec §5.3). La que no entra en 375 px
// se parte en pasos más cortos (spec §5.4).

function pasosDeGeometria(medidas: Medidas): Paso[] {
  const g = geometria(medidas);
  return [
    {
      texto: 'Distancia entre centros de vueltas vecinas',
      latex: `p = d + s = ${mm(g.cable)} + ${mm(medidas.separacion)} = ${mm(g.entreCentros)}`,
    },
    {
      texto: 'Diámetro al centro del cable, el de baja frecuencia',
      latex: `D_0 = D_{\\mathrm{c}} + d = ${mm(medidas.carrete)} + ${mm(g.cable)} = ${mm(g.d0)}`,
    },
  ];
}

// D∞ con el N de la lámina (Knight, ec. 4.1 y 4.2).
function pasosDeD(g: Geometria, n: number, rf: DiametroRF): Paso[] {
  const juntas = rf.w === Infinity;
  const arriba = rf.dMin > g.d0 ? '. Con menos de dos vueltas queda por encima de D0' : '';
  return [
    {
      texto: `Cota del diámetro de RF: la corriente pegada al lado interno del cable (Knight, ec. 4.1)${arriba}`,
      latex:
        `D_{\\mathrm{min}} = D_0 - d + \\dfrac{2d}{N} = ` +
        `${mm(g.d0)} - ${mm(g.cable)} + \\dfrac{2 \\cdot ${mm(g.cable)}}{${numero(n)}} = ${mm(rf.dMin)}`,
    },
    juntas
      ? {
          texto: 'Peso de Dmin: con vueltas juntas es infinito y D∞ = Dmin',
          latex: `w = \\dfrac{1}{(p/d - 1)^2} \\to \\infty`,
        }
      : {
          texto: 'Peso de Dmin según la separación',
          latex:
            `w = \\dfrac{1}{(p/d - 1)^2} = ` +
            `\\dfrac{1}{(${numero(g.entreCentros / g.cable)} - 1)^2} = ${numero(rf.w)}`,
        },
    {
      texto: 'Diámetro efectivo de RF (Knight, ec. 4.2): semiempírico, sin referato',
      latex: juntas
        ? `D_\\infty = D_{\\mathrm{min}} = ${mm(rf.dInfinito)}`
        : `D_\\infty = \\dfrac{D_0 + D_{\\mathrm{min}} w}{1 + w} = ` +
          `\\dfrac{${mm(g.d0)} + ${mm(rf.dMin)} \\cdot ${numero(rf.w)}}{1 + ${numero(rf.w)}} = ` +
          mm(rf.dInfinito),
    },
  ];
}

// Rosa y Nagaoka con el diámetro que corresponda: ℓ, x, kL, ks, km, la lámina, la corrección y la
// resta. Con `rf`, antes los pasos de D∞.
function pasosDeLaL(g: Geometria, l: LaminaUnaCapa, rf: DiametroRF | null): Paso[] {
  const D = rf ? 'D_\\infty' : 'D_0';
  const n = numero(l.vueltas);
  const esmalte = Math.log(1 / (1 - ESMALTE));
  const efectoEsmalte = (MU0 * l.diametro * l.vueltas * esmalte) / (2 * l.inductancia);
  const suma = l.ks + l.km;
  return [
    ...(rf ? pasosDeD(g, l.vueltas, rf) : []),
    {
      texto:
        'Largo de la lámina de corriente, el que va en las fórmulas. No es el Largo de la bobina, ' +
        'que se mide por fuera: (N − 1)·p + d',
      latex: `\\ell = N p = ${n} \\cdot ${mm(g.entreCentros)} = ${mm(l.largo)}`,
    },
    {
      texto: 'Relación diámetro/largo',
      latex: `x = \\dfrac{${D}}{\\ell} = \\dfrac{${mm(l.diametro)}}{${mm(l.largo)}} = ${numero(l.x)}`,
    },
    ...pasosDeLundin(l.x),
    {
      texto:
        'Corrección de Rosa por el cable redondo, solo la parte externa: en VHF el efecto ' +
        'pelicular anula la inductancia interna (Knight, ec. 10.4)',
      latex:
        `k_s = \\dfrac{3}{2} - \\ln\\dfrac{2p}{d} = ` +
        `\\dfrac{3}{2} - \\ln\\dfrac{2 \\cdot ${mm(g.entreCentros)}}{${mm(g.cable)}} = ${numero(l.ks)}`,
    },
    {
      texto:
        `Efecto del esmalte en ks: Rosa usa el diámetro del cobre desnudo. Con un esmalte del ` +
        `${formatearValor(ESMALTE * 100, 'porcentaje')} de d, ks baja ln(1/0,95) = ` +
        `${cuatroCifras(esmalte)} y la L sube`,
      latex:
        `\\dfrac{\\Delta L}{L} = \\dfrac{\\mu_0 ${D} N \\cdot ${numero(esmalte)}}{2L} = ` +
        `\\dfrac{\\mu_0 \\cdot ${mm(l.diametro)} \\cdot ${n} \\cdot ${numero(esmalte)}}` +
        `{2 \\cdot ${henrios(l.inductancia)}} = ${porciento(efectoEsmalte)}`,
    },
    {
      texto: `Corrección de Rosa por la inductancia mutua (Knight, ec. 10.18, vale para N no entero)`,
      latex:
        'k_m = \\ln 2\\pi - \\dfrac{3}{2} - \\dfrac{\\ln N}{6N} - \\dfrac{0{,}33084236}{N} - ' +
        '\\dfrac{1}{120N^3} + \\dfrac{1}{504N^5} - \\dfrac{0{,}0011925}{N^7} + ' +
        `\\dfrac{0{,}000507}{N^9} = \\ln 2\\pi - \\dfrac{3}{2} - \\dfrac{\\ln ${n}}{6 \\cdot ${n}} - ` +
        `\\dfrac{0{,}33084236}{${n}} - \\dfrac{1}{120 \\cdot ${n}^3} + \\dfrac{1}{504 \\cdot ${n}^5} - ` +
        `\\dfrac{0{,}0011925}{${n}^7} + \\dfrac{0{,}000507}{${n}^9} = ${numero(l.km)}`,
    },
    {
      texto: 'Inductancia de la lámina de corriente',
      latex:
        `L_s = \\dfrac{\\mu_0 \\pi ${D}^2 N^2 k_L}{4\\ell} = ` +
        `\\dfrac{\\mu_0 \\pi \\cdot (${mm(l.diametro)})^2 \\cdot ${n}^2 \\cdot ${numero(l.kL)}}` +
        `{4 \\cdot ${mm(l.largo)}} = ${henrios(l.ls)}`,
    },
    {
      texto: 'Las dos correcciones de Rosa juntas',
      latex: `k_s + k_m = ${numero(l.ks)} + ${numero(l.km)} = ${numero(suma)}`,
    },
    {
      texto: 'Corrección por el cable redondo',
      latex:
        `\\Delta L = \\dfrac{\\mu_0 ${D} N (k_s + k_m)}{2} = ` +
        `\\dfrac{\\mu_0 \\cdot ${mm(l.diametro)} \\cdot ${n} \\cdot ${numero(suma)}}{2} = ` +
        henrios(l.correccion),
    },
    {
      texto: rf ? 'L de RF' : 'L con D0',
      latex: `L = L_s - \\Delta L = ${henrios(l.ls)} - ${henrios(l.correccion)} = ${henrios(l.inductancia)}`,
    },
  ];
}

// El diámetro que no es el del resultado principal: D0 con D∞, o D∞ en el plan B.
interface OtroDiametro {
  // Las vueltas que harían falta con él para la L buscada; null si no la alcanza.
  vueltas: number | null;
  // La L del vecino destacado con él.
  inductancia: number;
  // Sus pasos de D∞, en el plan B.
  rf: DiametroRF | null;
}

function otroDiametro(g: Geometria, buscada: number, n: number, principal: Diametro): OtroDiametro {
  const otro: Diametro = principal === 'rf' ? 'd0' : 'rf';
  const lamina = laminaCon(g, otro);
  return {
    vueltas: despejarVueltas((m) => lamina(m).inductancia, buscada),
    inductancia: lamina(n).inductancia,
    rf: otro === 'rf' ? diametroRF(g, n) : null,
  };
}

function pasosDelOtroDiametro(
  g: Geometria,
  cercano: Vecino,
  otro: OtroDiametro,
  principal: Diametro,
): Paso[] {
  const conRF = principal === 'd0';
  const n = numero(cercano.vueltas);
  const [simbolo, nombre] = conRF ? ['L_\\infty', 'de RF'] : ['L_0', 'con D0'];
  return [
    ...(otro.rf ? pasosDeD(g, cercano.vueltas, otro.rf) : []),
    ...(otro.vueltas === null
      ? []
      : [
          {
            texto: conRF
              ? 'Con el diámetro efectivo de RF (Knight, ec. 4.2), las vueltas que harían falta'
              : 'Con D0, el diámetro de baja frecuencia, las vueltas que harían falta',
            latex: `${conRF ? 'N_\\infty' : 'N_0'} = ${numero(otro.vueltas)}`,
          },
        ]),
    {
      texto: `La L ${nombre} del vecino destacado, ${cuatroCifras(cercano.vueltas)} vueltas`,
      latex: `${simbolo}(${n}) = ${henrios(otro.inductancia)}`,
    },
    {
      texto: `La diferencia con la L ${conRF ? 'con D0' : 'de RF'} del mismo vecino`,
      latex:
        `\\dfrac{${simbolo}}{L} - 1 = ` +
        `\\dfrac{${henrios(otro.inductancia)}}{${henrios(cercano.inductancia)}} - 1 = ` +
        errorLatex(otro.inductancia / cercano.inductancia - 1),
    },
  ];
}

// Wheeler 1928 contra Rosa y Nagaoka con D0, el mismo diámetro (spec §6.6).
function pasosDeWheeler(g: Geometria, buscada: number, conD0: number): Paso[] {
  const nW = vueltasDeWheeler(g, buscada);
  const a = g.d0 / 2 / PULGADA;
  const p = g.entreCentros / PULGADA;
  const largo = nW * g.entreCentros;
  const relacion = largo / g.d0;
  const N = numero(nW);
  const rango =
    `Wheeler la declara exacta al 1 % con b > 0,8a (ℓ/D > 0,4); esta bobina tiene ℓ/D = ` +
    `${cuatroCifras(relacion)}, ${relacion > 0.4 ? 'dentro' : 'fuera'} de su rango.`;
  return [
    {
      texto:
        'Wheeler 1928 va en pulgadas y µH: el radio al centro del cable y la distancia entre centros',
      latex: `a = \\dfrac{D_0}{2} = ${pulgadas(a)}, \\quad p = ${pulgadas(p)}`,
    },
    {
      texto:
        'Las vueltas de Wheeler para la L buscada, con el largo b = n·p: la raíz positiva de ' +
        'a²n² − 10·p·L·n − 9·a·L = 0',
      latex: `n_W = \\dfrac{10pL + \\sqrt{100p^2L^2 + 36a^3L}}{2a^2} = ${N}`,
    },
    {
      texto: 'Con esas vueltas, Wheeler da la L buscada',
      latex:
        `L = \\dfrac{a^2 n_W^2}{9a + 10 n_W p} = ` +
        `\\dfrac{${numero(a)}^2 \\cdot ${N}^2}{9 \\cdot ${numero(a)} + 10 \\cdot ${N} \\cdot ${numero(p)}} = ` +
        henrios(wheeler1928(g.d0, largo, nW)),
    },
    {
      texto:
        'Wheeler contra Rosa y Nagaoka con D0. No es el cálculo principal: es de lámina de ' +
        'corriente y no tiene en cuenta el cable redondo, que domina en las bobinas cortas de ' +
        'pocas vueltas de VHF',
      latex:
        `\\dfrac{n_W}{N_0} - 1 = \\dfrac{${N}}{${numero(conD0)}} - 1 = ` +
        errorLatex(nW / conD0 - 1),
      fuente: rango,
    },
  ];
}
