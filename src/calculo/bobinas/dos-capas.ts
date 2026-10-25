import { formatearErrorRelativo, formatearValor } from '../../entrada/formato';
import { numeroLatex as numero } from '../comun/latex';
import type { EntradaRegistro } from '../comun/registro';
import type { Aviso, Paso, Referencia } from '../comun/resultado';
import {
  type GeometriaDosCapas,
  type LaminaDosCapas,
  type Maxwell93,
  type Medidas,
  PULGADA,
  type RosaGrover91,
  despejarVueltas,
  dosCapas,
  geometriaDosCapas,
  hazeltine,
  rosaGrover91,
  vueltasDeHazeltine,
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
  mediaVueltaDebajo,
  mm,
  pasoDelMargen,
  pasosDeLundin,
  pulgadas,
  vecinosDe,
} from './comun';

// La variante de dos capas de la Calculadora de bobinas (spec §6.2 y §6.4 a §6.7): n vueltas por
// capa, la segunda apilada sobre la primera y bobinada en el mismo sentido. Siempre se calcula junto
// a la de una capa; fuera del rango de la fórmula muestra solo el motivo. Se calcula con D0.

// La bandera del plan B de la Deducción propia de dos capas (spec §13.5): si la Cátedra no la
// aprueba, se pone en true y la L de dos capas pasa a Rosa y Grover (91) sola, sin ΔL2.
export const PLAN_B_DOS_CAPAS = false;

// El rango de Rosa y Grover (spec §6.4): el bobinado al menos tan largo como profundo (n′ = b/c ≥ 1)
// y la profundidad hasta un cuarto del radio medio, hasta donde el NBS da unas pocas partes en mil.
const N_PRIMA_MINIMO = 1;
export const C_SOBRE_A_MAXIMO = 0.25;

const LATEX_BS =
  "B_s(n') \\approx 0{,}3522843 - \\dfrac{\\ln n'}{6n'} - \\dfrac{0{,}3471888}{n'} - " +
  "\\dfrac{0{,}0004105}{n'^2} - \\dfrac{0{,}004685}{n'^3}";

export const DEDUCCION_DOS_CAPAS: EntradaRegistro = {
  tipo: 'deduccion-propia',
  id: 'maxwell-externo-dos-capas',
  nombre: 'Dos capas: Maxwell externo, D′ = √(p·d) y ajuste de Bs',
  queEs:
    'La L de dos capas se calcula con Rosa y Grover (91) más la corrección de Maxwell (93) por el ' +
    'cable redondo (Rosa y Grover 1912; NBS Circular 74, ec. 156 y 159), adaptada a VHF y a la ' +
    'Separación entre vueltas, con Bs de un ajuste cerrado propio.',
  adaptacion:
    'Tres adaptaciones propias. La versión externa de Maxwell: ln(D/d) − 0,1119 + E en lugar de ' +
    'ln(D/d) + 0,13806 + E, porque el 0,13806 lleva la inductancia interna de continua (1/4), que ' +
    'en VHF el efecto pelicular anula, como con ks en una capa. D′ = √(p·d) para la Separación: ' +
    'con s > 0 las celdas de cada vuelta son rectángulos de p × d y no cuadrados. Bs con un ajuste ' +
    'cerrado en lugar de la Tabla X, con error menor a 10⁻⁵ para n′ ≥ 1. El término E = 0,017 de ' +
    'la Circular 74 se mantiene: corrige la mutua entre vueltas vecinas, que no depende de la ' +
    'inductancia interna (pendiente P2 de la spec, decidido con la suma de anillos). La L se ' +
    'calcula con D0: no hay un diámetro de RF publicado para dos capas, y un aviso dice que en RF ' +
    'la L real queda algo por debajo.',
  respaldo:
    'Las 7 geometrías de dos capas de la investigación (research/formulas-bobinas.md, §5.4) ' +
    'contra la suma de anillos, de los dos lados de la bandera: de −0,51 a +0,05 % con la ' +
    'adaptación, y de −0,60 a −0,09 % si se saca E. La investigación da de −0,53 a +0,16 % en 11 ' +
    'geometrías. Ojo: con vueltas juntas Rosa y Grover (91) sola queda más cerca (de −0,03 a ' +
    '+0,19 %) que la adaptación (de −0,51 a −0,09 %); la adaptación gana con vueltas separadas ' +
    '(+0,05 % y −0,13 % contra −0,83 % y −2,8 %). La Tabla X de Rosa y Grover respalda el ajuste ' +
    'de Bs, y el ejemplo de varias capas de la Circular 74 (ec. 156, pág. 260), Rosa y Grover (91).',
  deduccion: [
    {
      texto:
        'Maxwell (93): la corrección por el cable redondo, con la inductancia interna de continua',
      latex: '\\Delta L_2 = \\mu_0 a N \\left(\\ln\\dfrac{D}{d} + 0{,}13806 + E\\right)',
    },
    {
      texto:
        'El 0,13806 pasa de la celda cuadrada (distancia media geométrica propia 0,447049·D) al ' +
        'cable redondo (d/2), más la inductancia interna de continua, 1/4',
      latex: '0{,}13806 = \\ln(2 \\cdot 0{,}447049) + \\dfrac{1}{4}',
    },
    {
      texto: 'Sin la interna, como ks en una capa: en VHF el efecto pelicular la anula',
      latex: '\\ln(2 \\cdot 0{,}447049) = -0{,}1119',
    },
    {
      texto: 'Con Separación las celdas son rectángulos de p × d: el lado del cuadrado equivalente',
      latex: "D' = \\sqrt{p d}",
    },
    {
      texto:
        'E de la Circular 74 se mantiene: corrige la mutua entre vueltas vecinas, que no depende ' +
        'de la inductancia interna',
      latex: 'E = 0{,}017',
    },
    {
      texto:
        'Bs de la Tabla X con un ajuste cerrado de la forma de la serie de km: error menor a ' +
        '10⁻⁵ para n′ ≥ 1, con Bs(1) = 0 exacto',
      latex: LATEX_BS,
    },
    {
      texto: 'La L de dos capas',
      latex: "L = L_s - \\Delta L_1 + \\mu_0 a N \\left(\\ln\\dfrac{D'}{d} - 0{,}1119 + E\\right)",
    },
  ],
  planB:
    'La L de dos capas se calcula con Rosa y Grover (91) sola, L = Ls − ΔL1, que tiene cita ' +
    'directa (Circular 74, ec. 156). Contra la suma de anillos da de −0,03 a +0,19 % con vueltas ' +
    'juntas, pero con vueltas separadas queda por debajo: −0,83 % con s = d/2 y −2,8 % con s = d. ' +
    'Bs sigue con el ajuste, que reproduce la Tabla X dentro de su redondeo.',
  bandera: 'PLAN_B_DOS_CAPAS',
};

// Con qué se corrige el cable redondo: Maxwell (93) adaptado, o nada en el plan B.
export type CorreccionDosCapas = 'maxwell' | 'plan-b';

export type CodigoFueraDeRango =
  'cable-grueso' | 'mas-corta-que-profunda' | 'menos-de-una-vuelta-por-capa';

export type CodigoAvisoDosCapas = 'rf' | 'autorresonancia';

// Un vecino de dos capas: las `vueltas` son el total, N = 2n, que puede ser impar.
export interface VecinoDosCapas extends Vecino {
  vueltasPorCapa: number;
}

export type DosCapas =
  | { estado: 'fuera-de-rango'; codigo: CodigoFueraDeRango; texto: string }
  | {
      estado: 'calculado';
      correccion: CorreccionDosCapas;
      // El n real que da la L buscada.
      vueltasPorCapa: number;
      vecinos: readonly [VecinoDosCapas, VecinoDosCapas];
      // Diámetro del carrete + 4d, en m.
      diametroExterior: number;
      srf: Autorresonancia;
      // Las fórmulas que se usaron, sin números: van a la vista en la tarjeta.
      formulas: readonly string[];
      pasos: readonly Paso[];
      // Rosa y Grover con su adaptación propia, o el plan B con lo que daría la adaptación.
      notaFormula: string;
      avisos: readonly Aviso<CodigoAvisoDosCapas>[];
      notas: readonly string[];
      referencias: readonly Referencia[];
    };

// §6.8, lo que corresponde a dos capas: la fórmula principal marca sus adaptaciones.
function referenciasDe(correccion: CorreccionDosCapas): readonly Referencia[] {
  const maxwell = correccion === 'maxwell';
  return [
    {
      autor: 'E. B. Rosa y F. W. Grover',
      obra: 'Bulletin of the Bureau of Standards',
      volumen: '8(1)',
      anio: 1912,
      ubicacion: maxwell
        ? '(91) y (93), con adaptación propia para RF y Separación, verificada contra suma de ' +
          'anillos, y Tabla X'
        : '(91) y Tabla X',
    },
    {
      autor: 'NBS',
      obra: 'Circular 74, Radio Instruments and Measurements',
      anio: 1918,
      ubicacion: maxwell ? 'ec. 156 y 159' : 'ec. 156',
    },
    LUNDIN,
    SRF_DE_KNIGHT,
    MEDHURST,
    { ...WHEELER_1928, ubicacion: `${WHEELER_1928.ubicacion} (la fórmula de Hazeltine)` },
  ];
}

export const REFERENCIAS_DOS_CAPAS = referenciasDe('maxwell');
export const REFERENCIAS_DOS_CAPAS_PLAN_B = referenciasDe('plan-b');

const NOTA_MAXWELL =
  'Rosa y Grover (91) y (93), con adaptación propia para RF y Separación, verificada contra suma ' +
  'de anillos.';
const NOTA_RANURAS =
  'Se supone la segunda capa apilada sobre la primera y bobinada en el mismo sentido. Si las ' +
  'vueltas se acomodan en las ranuras de la primera capa, la L baja cerca de un 1 %.';
const NOTA_SRF =
  'La SRF sale de estimaciones de una capa: en dos capas la capacidad entre capas es mayor y la ' +
  'SRF real puede quedar bastante más abajo.';
const AVISO_RF =
  'La L de dos capas está calculada con el diámetro al centro del cable, el de baja frecuencia: ' +
  'en RF la corriente se corre hacia el interior de la bobina y la L real va a quedar algo por ' +
  'debajo.';

const MOTIVOS: Record<CodigoFueraDeRango, string> = {
  'cable-grueso':
    'Dos capas queda fuera del rango de la fórmula de Rosa y Grover: con este cable la ' +
    'profundidad de las dos capas (c = 2d) pasa de un cuarto del radio medio (c/a > 0,25). Para ' +
    'dos capas hace falta un cable más fino o un carrete más grueso.',
  'mas-corta-que-profunda':
    'Dos capas queda fuera del rango de la fórmula de Rosa y Grover: con tan pocas vueltas por ' +
    'capa el bobinado sería más corto que profundo (n′ = b/c < 1). Con esta L conviene una capa.',
  'menos-de-una-vuelta-por-capa':
    'Con dos capas haría falta menos de una vuelta por capa: con esta L alcanza una capa.',
};

const fueraDeRango = (codigo: CodigoFueraDeRango): DosCapas => ({
  estado: 'fuera-de-rango',
  codigo,
  texto: MOTIVOS[codigo],
});

// Dos capas con n fijo y sus pasos intermedios: lo que los Casos de prueba comparan contra la suma
// de anillos, con los mismos pasos que ve el Alumno.
export function dosCapasConPasos(medidas: Medidas, n: number, correccion: CorreccionDosCapas) {
  const g = geometriaDosCapas(medidas);
  const lamina = dosCapas(g, n, correccion === 'maxwell');
  return { lamina, pasos: [...pasosDeGeometria(medidas, g), ...pasosDeLaL(g, lamina)] };
}

// Rosa y Grover (91) de una bobina de varias capas cualquiera, con sus pasos: el ejemplo de la
// Circular 74 (ec. 156), que no es de dos capas.
export function rosaGrover91ConPasos(
  radioMedio: number,
  largo: number,
  profundidad: number,
  vueltas: number,
) {
  const rosa = rosaGrover91(radioMedio, largo, profundidad, vueltas);
  return {
    rosa,
    inductancia: rosa.ls - rosa.deltaL1,
    pasos: [
      ...pasosDeRosa91(rosa),
      {
        texto: 'L de Rosa y Grover (91)',
        latex:
          `L = L_s - \\Delta L_1 = ${henrios(rosa.ls)} - ${henrios(rosa.deltaL1)} = ` +
          henrios(rosa.ls - rosa.deltaL1),
      },
    ],
  };
}

export function calcularDosCapas(
  medidas: Medidas,
  buscada: number,
  frecuencia: number | null,
  planB: boolean,
): DosCapas {
  const g = geometriaDosCapas(medidas);
  const correccion: CorreccionDosCapas = planB ? 'plan-b' : 'maxwell';
  // La otra corrección, para comparar: la de la Deducción propia contra su plan B.
  const otraCorreccion: CorreccionDosCapas = planB ? 'maxwell' : 'plan-b';
  if (g.profundidad / g.radioMedio > C_SOBRE_A_MAXIMO) return fueraDeRango('cable-grueso');

  // El n con n′ = 1: el bobinado tan largo como profundo. Con vueltas muy separadas queda debajo
  // de una vuelta por capa, y el mínimo pasa a ser esa vuelta.
  const nMinimo = (N_PRIMA_MINIMO * g.profundidad) / g.entreCentros;
  const desde = Math.max(1, nMinimo);
  const lamina = (n: number) => dosCapas(g, n, correccion === 'maxwell');
  if (lamina(desde).inductancia > buscada) {
    return fueraDeRango(
      desde > nMinimo ? 'menos-de-una-vuelta-por-capa' : 'mas-corta-que-profunda',
    );
  }
  const n = despejarVueltas((m) => lamina(m).inductancia, buscada, desde);
  // La de una capa ya llegó a la L buscada con menos de 2³⁰ vueltas, y con las mismas vueltas por
  // capa dos capas dan más del doble: la bisección siempre la alcanza.
  if (n === null) throw new Error('Dos capas no alcanzó la L buscada que sí alcanzó una capa.');

  const vecino = (m: number): VecinoDosCapas => {
    const l = lamina(m).inductancia;
    return {
      vueltasPorCapa: m,
      vueltas: 2 * m,
      inductancia: l,
      error: l / buscada - 1,
      largoBobina: (m - 1) * g.entreCentros + g.cable,
      destacado: false,
    };
  };
  // Los dos vecinos tienen que entrar en el rango, y el de abajo puede quedar con n′ < 1.
  if (mediaVueltaDebajo(n) < nMinimo) return fueraDeRango('mas-corta-que-profunda');
  const { vecinos, cercano } = vecinosDe(n, vecino);

  const real = lamina(n);
  const diametroMedio = 2 * g.radioMedio;
  const srf = autorresonancia(
    {
      diametro: diametroMedio,
      simboloDiametro: 'D_{\\mathrm{m}}',
      vueltas: real.vueltas,
      avance: 2 * real.largo,
      simboloAvance: '(2b)',
      largo: real.largo,
      simboloLargo: 'b',
    },
    buscada,
  );
  const otra = dosCapas(g, cercano.vueltasPorCapa, otraCorreccion === 'maxwell');

  const pasos: Paso[] = [
    ...pasosDeGeometria(medidas, g),
    {
      texto: 'n real, vueltas por capa: la bisección sobre n hasta que L(n) da la L buscada',
      latex:
        `L(n) = ${henrios(buscada)} \\;\\Rightarrow\\; n = ${numero(n)}, ` +
        `\\quad N = 2n = ${numero(2 * n)}`,
    },
    ...pasosDeLaL(g, real),
    ...pasosDeLaOtraCorreccion(cercano, otra),
    {
      texto:
        'Diámetro medio, para la SRF: el hilo de las dos capas da N vueltas de este diámetro, y a ' +
        'lo largo avanza b en la primera capa y vuelve b en la segunda. Las dos estimaciones son ' +
        'de una capa: la capacidad entre capas baja la SRF real',
      latex: `D_{\\mathrm{m}} = 2a = 2 \\cdot ${mm(g.radioMedio)} = ${mm(diametroMedio)}`,
    },
    ...srf.pasos,
    ...(frecuencia === null ? [] : [pasoDelMargen(frecuencia, srf.valores.estimada)]),
    ...pasosDeHazeltine(g, buscada, real.vueltas),
  ];

  const avisos: Aviso<CodigoAvisoDosCapas>[] = [{ codigo: 'rf', texto: AVISO_RF }];
  if (frecuencia !== null && frecuencia > srf.valores.estimada / MARGEN_SRF) {
    avisos.push({
      codigo: 'autorresonancia',
      texto:
        `La frecuencia de trabajo (${formatearValor(frecuencia, 'frecuencia')}) supera un tercio de ` +
        `la autorresonancia estimada de dos capas ` +
        `(${formatearValor(srf.valores.estimada, 'frecuencia')}): en dos capas la bobina queda ` +
        'cerca de su autorresonancia y no se va a comportar como una L pura.',
    });
  }

  return {
    estado: 'calculado',
    correccion,
    vueltasPorCapa: n,
    vecinos,
    diametroExterior: g.diametroExterior,
    srf: srf.valores,
    formulas: formulasDe(correccion),
    pasos,
    notaFormula: correccion === 'plan-b' ? notaDelPlanB(cercano, otra) : NOTA_MAXWELL,
    avisos,
    notas: [NOTA_RANURAS, NOTA_SRF],
    referencias: referenciasDe(correccion),
  };
}

// En el plan B, lo que daría la corrección de Maxwell como nota.
function notaDelPlanB(cercano: VecinoDosCapas, conMaxwell: LaminaDosCapas): string {
  const cambio = conMaxwell.inductancia / cercano.inductancia - 1;
  return (
    'Rosa y Grover (91) sola, sin corrección por el cable redondo. Con la de Maxwell (93), ' +
    `adaptada para RF y Separación (deducción propia), las ` +
    `${formatearValor(cercano.vueltasPorCapa, 'numero')} vueltas por capa darían ` +
    `${formatearValor(conMaxwell.inductancia, 'inductancia')} ` +
    `(${formatearErrorRelativo(cambio * 100)}).`
  );
}

function formulasDe(correccion: CorreccionDosCapas): string[] {
  // Una fórmula corta por línea, para que cada una entre en el celular.
  return [
    correccion === 'maxwell' ? 'L = L_s - \\Delta L_1 + \\Delta L_2' : 'L = L_s - \\Delta L_1',
    'L_s = \\dfrac{\\mu_0 \\pi (2a)^2 N^2 k_L(2a/b)}{4b}',
    '\\Delta L_1 = \\mu_0 a N^2 \\dfrac{c}{b}\\,(0{,}693 + B_s)',
    ...(correccion === 'maxwell'
      ? [
          "\\Delta L_2 = \\mu_0 a N \\left(\\ln\\dfrac{D'}{d} - 0{,}1119 + E\\right)",
          "D' = \\sqrt{p d}, \\quad E = 0{,}017",
        ]
      : []),
    'N = 2n, \\quad b = n p, \\quad c = 2d',
    "a = \\dfrac{D_{\\mathrm{c}}}{2} + d, \\quad n' = \\dfrac{b}{c}",
  ];
}

// --- Pasos intermedios (spec §6.6) ----------------------------------------------------------------

function pasosDeGeometria(medidas: Medidas, g: GeometriaDosCapas): Paso[] {
  const cSobreA = g.profundidad / g.radioMedio;
  const dentro = cSobreA <= C_SOBRE_A_MAXIMO;
  return [
    {
      texto: 'Distancia entre centros de vueltas vecinas',
      latex: `p = d + s = ${mm(g.cable)} + ${mm(medidas.separacion)} = ${mm(g.entreCentros)}`,
    },
    {
      texto: 'Radio medio, al centro de la sección de las dos capas',
      latex:
        `a = \\dfrac{D_{\\mathrm{c}}}{2} + d = \\dfrac{${mm(medidas.carrete)}}{2} + ${mm(g.cable)} = ` +
        mm(g.radioMedio),
    },
    {
      texto: 'Profundidad del bobinado: dos capas apiladas',
      latex: `c = 2d = 2 \\cdot ${mm(g.cable)} = ${mm(g.profundidad)}`,
    },
    {
      texto: `Rango de Rosa y Grover: la profundidad hasta un cuarto del radio medio. ${dentro ? 'Dentro' : 'Fuera'} del rango`,
      latex:
        `\\dfrac{c}{a} = \\dfrac{${mm(g.profundidad)}}{${mm(g.radioMedio)}} = ${numero(cSobreA)} ` +
        `${dentro ? '\\leq' : '>'} 0{,}25`,
    },
    {
      texto: 'Diámetro exterior',
      latex:
        `D_{\\mathrm{ext}} = D_{\\mathrm{c}} + 4d = ${mm(medidas.carrete)} + 4 \\cdot ${mm(g.cable)} = ` +
        mm(g.diametroExterior),
    },
  ];
}

// Rosa y Grover (91): n′, x, kL, la lámina con el radio medio, Bs y ΔL1.
function pasosDeRosa91(r: RosaGrover91): Paso[] {
  const N = numero(r.vueltas);
  const np = numero(r.nPrima);
  const dentro = r.nPrima >= N_PRIMA_MINIMO;
  return [
    {
      texto:
        'Conductores cuadrados que caben a lo largo: el rango de Rosa y Grover pide n′ ≥ 1. ' +
        `${dentro ? 'Dentro' : 'Fuera'} del rango`,
      latex:
        `n' = \\dfrac{b}{c} = \\dfrac{${mm(r.largo)}}{${mm(r.profundidad)}} = ${np} ` +
        `${dentro ? '\\geq' : '<'} 1`,
    },
    {
      texto: 'Relación diámetro medio/largo',
      latex: `x = \\dfrac{2a}{b} = \\dfrac{2 \\cdot ${mm(r.radioMedio)}}{${mm(r.largo)}} = ${numero(r.x)}`,
    },
    ...pasosDeLundin(r.x),
    {
      texto: 'Inductancia de la lámina de corriente, con el radio medio',
      latex:
        `L_s = \\dfrac{\\mu_0 \\pi (2a)^2 N^2 k_L}{4b} = ` +
        `\\dfrac{\\mu_0 \\pi \\cdot (2 \\cdot ${mm(r.radioMedio)})^2 \\cdot ${N}^2 \\cdot ${numero(r.kL)}}` +
        `{4 \\cdot ${mm(r.largo)}} = ${henrios(r.ls)}`,
    },
    {
      texto:
        'Bs de Rosa y Grover (Tabla X), con el ajuste cerrado propio: error menor a 10⁻⁵ para ' +
        'n′ ≥ 1',
      latex:
        `${LATEX_BS} = 0{,}3522843 - \\dfrac{\\ln ${np}}{6 \\cdot ${np}} - ` +
        `\\dfrac{0{,}3471888}{${np}} - \\dfrac{0{,}0004105}{${np}^2} - ` +
        `\\dfrac{0{,}004685}{${np}^3} = ${numero(r.bs)}`,
    },
    {
      texto:
        'Corrección por la profundidad del bobinado (Rosa y Grover (91); Circular 74, ec. 156)',
      latex:
        `\\Delta L_1 = \\mu_0 a N^2 \\dfrac{c}{b}\\,(0{,}693 + B_s) = ` +
        `\\mu_0 \\cdot ${mm(r.radioMedio)} \\cdot ${N}^2 \\cdot ` +
        `\\dfrac{${mm(r.profundidad)}}{${mm(r.largo)}}\\,(0{,}693 + ${numero(r.bs)}) = ` +
        henrios(r.deltaL1),
    },
  ];
}

const FUENTE_E =
  'E = 0,017 (Circular 74) corrige la mutua entre vueltas vecinas, que no depende de la ' +
  'inductancia interna: se mantiene en la versión externa. Contra la suma de anillos, las 7 ' +
  'geometrías de dos capas de la investigación dan de −0,51 a +0,05 % con E y de −0,60 a ' +
  '−0,09 % sin E.';

// Maxwell (93) en su versión externa, con D′ = √(p·d): las adaptaciones propias.
function pasosDeMaxwell(g: GeometriaDosCapas, r: RosaGrover91, m: Maxwell93): Paso[] {
  return [
    {
      texto:
        'Lado de la celda de cada vuelta: con Separación las celdas son rectángulos de p × d ' +
        '(adaptación propia)',
      latex: `D' = \\sqrt{p d} = \\sqrt{${mm(g.entreCentros)} \\cdot ${mm(g.cable)}} = ${mm(m.dPrima)}`,
    },
    {
      texto:
        'Corrección de Maxwell (93) por el cable redondo, en su versión externa: −0,1119 = ' +
        'ln(2·0,447049) en lugar de +0,13806, porque en VHF no hay inductancia interna ' +
        '(adaptación propia)',
      latex:
        `\\ln\\dfrac{D'}{d} - 0{,}1119 + E = ` +
        `\\ln\\dfrac{${mm(m.dPrima)}}{${mm(g.cable)}} - 0{,}1119 + 0{,}017 = ${numero(m.termino)}`,
      fuente: FUENTE_E,
    },
    {
      texto: 'Corrección por el cable redondo',
      latex:
        `\\Delta L_2 = \\mu_0 a N \\left(\\ln\\dfrac{D'}{d} - 0{,}1119 + E\\right) = ` +
        `\\mu_0 \\cdot ${mm(r.radioMedio)} \\cdot ${numero(r.vueltas)} \\cdot ${numero(m.termino)} = ` +
        henrios(m.deltaL2),
    },
  ];
}

// b, Rosa y Grover (91) y, si va, Maxwell (93), hasta la L.
function pasosDeLaL(g: GeometriaDosCapas, l: LaminaDosCapas): Paso[] {
  return [
    {
      texto:
        'Largo de la lámina de corriente, el que va en las fórmulas. No es el Largo de la bobina, ' +
        'que se mide por fuera: (n − 1)·p + d',
      latex: `b = n p = ${numero(l.vueltasPorCapa)} \\cdot ${mm(g.entreCentros)} = ${mm(l.largo)}`,
    },
    ...pasosDeRosa91(l),
    ...(l.maxwell ? pasosDeMaxwell(g, l, l.maxwell) : []),
    l.maxwell
      ? {
          texto: 'L de dos capas, con D0',
          latex:
            `L = L_s - \\Delta L_1 + \\Delta L_2 = ${henrios(l.ls)} - ${henrios(l.deltaL1)} + ` +
            `${henrios(l.maxwell.deltaL2)} = ${henrios(l.inductancia)}`,
        }
      : {
          texto: 'L de dos capas, con D0 y sin corrección por el cable redondo (plan B)',
          latex:
            `L = L_s - \\Delta L_1 = ${henrios(l.ls)} - ${henrios(l.deltaL1)} = ` +
            henrios(l.inductancia),
        },
  ];
}

// La L del vecino destacado con la otra corrección: sin Maxwell (el plan B), o con Maxwell en el
// plan B. Es la comparación de la Deducción propia que ve el Alumno.
function pasosDeLaOtraCorreccion(cercano: VecinoDosCapas, otra: LaminaDosCapas): Paso[] {
  const n = numero(cercano.vueltasPorCapa);
  const simbolo = otra.maxwell ? 'L_{93}' : 'L_{91}';
  return [
    {
      texto: otra.maxwell
        ? `Con la corrección de Maxwell (93), la adaptación propia, el vecino destacado de ` +
          `${cuatroCifras(cercano.vueltasPorCapa)} vueltas por capa`
        : `Sin la corrección de Maxwell: Rosa y Grover (91) sola, el plan B, con el vecino ` +
          `destacado de ${cuatroCifras(cercano.vueltasPorCapa)} vueltas por capa`,
      latex: `${simbolo}(${n}) = ${henrios(otra.inductancia)}`,
    },
    {
      texto: 'La diferencia con la L del mismo vecino',
      latex:
        `\\dfrac{${simbolo}}{L} - 1 = ` +
        `\\dfrac{${henrios(otra.inductancia)}}{${henrios(cercano.inductancia)}} - 1 = ` +
        errorLatex(otra.inductancia / cercano.inductancia - 1),
    },
  ];
}

const RANGO_HAZELTINE =
  'Wheeler la declara correcta a cerca del 1 % cuando los tres términos del denominador son ' +
  'parecidos. En dos capas la profundidad c es mucho menor que a y que b: queda fuera de su rango.';

// Hazeltine contra Rosa y Grover (spec §6.6), con las vueltas totales de cada una.
function pasosDeHazeltine(g: GeometriaDosCapas, buscada: number, vueltas: number): Paso[] {
  const nH = vueltasDeHazeltine(g, buscada);
  const a = g.radioMedio / PULGADA;
  const c = g.profundidad / PULGADA;
  const p = g.entreCentros / PULGADA;
  const b = (nH / 2) * p;
  const N = numero(nH);
  const [seisA, nueveB, diezC] = [6 * a, 9 * b, 10 * c].map((t) => numero(t));
  // La cuadrática, por partes para que entre en el celular, con L en µH.
  const l = buscada * 1e6;
  const lineal = 4.5 * p * l;
  const constante = 3.2 * a * a * l * (6 * a + 10 * c);
  const raiz = Math.sqrt(lineal * lineal + constante);
  return [
    {
      texto:
        'Hazeltine (publicada por Wheeler, 1928) va en pulgadas y µH: el radio medio, la ' +
        'profundidad y la distancia entre centros',
      latex: `a = ${pulgadas(a)}, \\quad c = ${pulgadas(c)}, \\quad p = ${pulgadas(p)}`,
    },
    {
      texto:
        'Las vueltas totales de Hazeltine para la L buscada, con el largo b = (N/2)·p, son la raíz ' +
        'positiva de 0,8·a²N² − 4,5·p·L·N − (6a + 10c)·L = 0. Por partes, con L en µH: el término ' +
        'lineal',
      latex: `4{,}5pL = 4{,}5 \\cdot ${numero(p)} \\cdot ${numero(l)} = ${numero(lineal)}`,
    },
    {
      texto: 'El término constante',
      latex:
        `3{,}2a^2L(6a + 10c) = 3{,}2 \\cdot ${numero(a)}^2 \\cdot ${numero(l)} \\cdot ` +
        `(${seisA} + ${diezC}) = ${numero(constante)}`,
    },
    {
      texto: 'La raíz cuadrada',
      latex:
        `R = \\sqrt{(4{,}5pL)^2 + 3{,}2a^2L(6a + 10c)} = ` +
        `\\sqrt{${numero(lineal)}^2 + ${numero(constante)}} = ${numero(raiz)}`,
    },
    {
      texto: 'Las vueltas totales de Hazeltine',
      latex:
        `N_H = \\dfrac{4{,}5pL + R}{1{,}6a^2} = ` +
        `\\dfrac{${numero(lineal)} + ${numero(raiz)}}{1{,}6 \\cdot ${numero(a)}^2} = ${N}`,
    },
    {
      texto: 'Con esas vueltas, Hazeltine da la L buscada',
      latex:
        `L = \\dfrac{0{,}8a^2 N_H^2}{6a + 9b + 10c} = ` +
        `\\dfrac{0{,}8 \\cdot ${numero(a)}^2 \\cdot ${N}^2}{${seisA} + ${nueveB} + ${diezC}} = ` +
        henrios(hazeltine(g.radioMedio, b * PULGADA, g.profundidad, nH)),
    },
    {
      texto: 'Los tres términos del denominador',
      latex: `6a = ${seisA}, \\quad 9b = ${nueveB}, \\quad 10c = ${diezC}`,
      fuente: RANGO_HAZELTINE,
    },
    {
      texto:
        'Hazeltine contra Rosa y Grover. No es el cálculo principal: es de corriente repartida en ' +
        'la sección, no tiene en cuenta el cable redondo, y en dos capas queda fuera de su rango',
      latex: `\\dfrac{N_H}{N} - 1 = \\dfrac{${N}}{${numero(vueltas)}} - 1 = ${errorLatex(nH / vueltas - 1)}`,
    },
  ];
}
