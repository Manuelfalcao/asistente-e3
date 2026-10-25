import { formatearValor } from '../../entrada/formato';
import { numeroLatex as numero, valorLatex } from '../comun/latex';
import type { Paso, Referencia } from '../comun/resultado';
import { lundinCorta, lundinLarga, srfLargoDeHilo, srfMedhurst } from './formulas';

// Lo que comparten las tarjetas de una y de dos capas (spec §6.6): los vecinos, las referencias de
// las fórmulas que usan las dos y, para los pasos intermedios, los números escritos para Temml, el
// coeficiente de Nagaoka por partes y la SRF estimada. Cada fórmula va con sus números sustituidos,
// con 4 cifras (spec §5.3); la que no entra en 375 px se parte en pasos más cortos (spec §5.4).

// Un vecino del N real, en pasos de media vuelta (spec §6.6).
export interface Vecino {
  // En dos capas, el total: N = 2n, que puede ser impar.
  vueltas: number;
  // La del resultado principal. En H.
  inductancia: number;
  // Fracción con signo: L / L buscada − 1.
  error: number;
  // (n − 1)·p + d, en m: el Largo de la bobina, medido por fuera, con n por capa en dos capas.
  largoBobina: number;
  destacado: boolean;
}

// El vecino de abajo del n real: los vecinos van en pasos de media vuelta (por capa, en dos capas).
export const mediaVueltaDebajo = (n: number) => Math.floor(n * 2) / 2;

// Los dos vecinos del n real, armados con `crear`, con el más cercano a la L buscada destacado.
export function vecinosDe<V extends Vecino>(n: number, crear: (m: number) => V) {
  const abajo = crear(mediaVueltaDebajo(n));
  const arriba = crear(mediaVueltaDebajo(n) + 0.5);
  const cercano = Math.abs(abajo.error) <= Math.abs(arriba.error) ? abajo : arriba;
  cercano.destacado = true;
  return { vecinos: [abajo, arriba] as const, cercano };
}

// §6.8: las referencias que citan las dos tarjetas.
export const LUNDIN: Referencia = {
  autor: 'R. Lundin',
  obra: 'Proc. IEEE',
  volumen: '73(9)',
  anio: 1985,
  ubicacion: 'págs. 1428-1429',
};

export const SRF_DE_KNIGHT: Referencia = {
  autor: 'D. W. Knight',
  obra: 'The self-resonance and self-capacitance of solenoid coils',
  volumen: 'v1.00',
  anio: 2016,
  ubicacion: 'sec. 1.2 y 3',
};

export const MEDHURST: Referencia = {
  autor: 'R. G. Medhurst',
  obra: 'Wireless Engineer',
  anio: 1947,
  ubicacion: 'febrero y marzo',
};

export const WHEELER_1928: Referencia = {
  autor: 'H. A. Wheeler',
  obra: 'Proc. IRE',
  volumen: '16(10)',
  anio: 1928,
  ubicacion: 'págs. 1398-1400',
};

export const mm = (x: number) => valorLatex(x, 'largo');
export const henrios = (x: number) => valorLatex(x, 'inductancia');
export const hz = (x: number) => valorLatex(x, 'frecuencia');
export const pulgadas = (x: number) => `${numero(x)}\\,\\mathrm{in}`;
export { porcentajeLatex as porciento, errorLatex } from '../comun/latex';
export const cuatroCifras = (x: number) => formatearValor(x, 'numero', 'paso');

// El aviso de autorresonancia salta con la frecuencia de trabajo por encima de SRF/3.
export const MARGEN_SRF = 3;

// El coeficiente de Nagaoka de Lundin, por partes: Fn, F y la suma.
export function pasosDeLundin(x: number): Paso[] {
  const X = numero(x);
  if (x < 1) {
    const { fn, f } = lundinLarga(x);
    return [
      {
        texto: `Coeficiente de Nagaoka, fórmula de Lundin para bobina larga (x = ${cuatroCifras(x)} < 1), por partes`,
        latex:
          'F_n = 1 + 0{,}383901x^2 + 0{,}017108x^4 = ' +
          `1 + 0{,}383901 \\cdot ${X}^2 + 0{,}017108 \\cdot ${X}^4 = ${numero(fn)}`,
      },
      {
        texto: 'F, con su denominador',
        latex:
          `F = \\dfrac{F_n}{1 + 0{,}258952x^2} = ` +
          `\\dfrac{${numero(fn)}}{1 + 0{,}258952 \\cdot ${X}^2} = ${numero(f)}`,
      },
      {
        texto: 'Coeficiente de Nagaoka',
        latex:
          `k_L = F - \\dfrac{4x}{3\\pi} = ${numero(f)} - \\dfrac{4 \\cdot ${X}}{3\\pi} = ` +
          numero(f - (4 * x) / (3 * Math.PI)),
      },
    ];
  }
  const { fn, f, g } = lundinCorta(x);
  const logaritmo = Math.log(4 * x) - 0.5;
  return [
    {
      texto: `Coeficiente de Nagaoka, fórmula de Lundin para bobina corta (x = ${cuatroCifras(x)} ≥ 1), por partes`,
      latex:
        'F_n = 1 + \\dfrac{0{,}383901}{x^2} + \\dfrac{0{,}017108}{x^4} = ' +
        `1 + \\dfrac{0{,}383901}{${X}^2} + \\dfrac{0{,}017108}{${X}^4} = ${numero(fn)}`,
    },
    {
      texto: 'F, con su denominador',
      latex:
        `F = \\dfrac{F_n}{1 + 0{,}258952/x^2} = ` +
        `\\dfrac{${numero(fn)}}{1 + 0{,}258952/${X}^2} = ${numero(f)}`,
    },
    {
      texto: 'G, los términos de cierre',
      latex:
        'G = \\dfrac{0{,}093842}{x^2} + \\dfrac{0{,}002029}{x^4} - \\dfrac{0{,}000801}{x^6} = ' +
        `\\dfrac{0{,}093842}{${X}^2} + \\dfrac{0{,}002029}{${X}^4} - \\dfrac{0{,}000801}{${X}^6} = ` +
        numero(g),
    },
    {
      texto: 'El logaritmo',
      latex: `\\ln 4x - \\dfrac{1}{2} = \\ln(4 \\cdot ${X}) - \\dfrac{1}{2} = ${numero(logaritmo)}`,
    },
    {
      texto: 'Coeficiente de Nagaoka',
      latex:
        'k_L = \\dfrac{2}{\\pi x}\\left[\\left(\\ln 4x - \\dfrac{1}{2}\\right) F + G\\right] = ' +
        `\\dfrac{2}{\\pi \\cdot ${X}}\\,(${numero(logaritmo)} \\cdot ${numero(f)} + ${numero(g)}) = ` +
        numero((2 / (Math.PI * x)) * (logaritmo * f + g)),
    },
  ];
}

// En Hz. La que se muestra es la estimada, rotulada como estimación.
export interface Autorresonancia {
  estimada: number;
  largoDeHilo: number;
  medhurst: number;
}

// El hilo de una bobina para estimar su SRF, con los símbolos de sus pasos: N vueltas de un
// diámetro, lo que el hilo avanza a lo largo (ℓ en una capa; 2b en dos, que va y vuelve) y el largo
// del bobinado para Medhurst (ℓ en una capa, b en dos).
export interface Hilo {
  diametro: number;
  simboloDiametro: string;
  vueltas: number;
  avance: number;
  // Tal como se eleva al cuadrado: "\ell" o "(2b)".
  simboloAvance: string;
  largo: number;
  simboloLargo: string;
}

// La SRF estimada con la L buscada: la menor entre el largo de hilo y Medhurst.
export function autorresonancia(
  hilo: Hilo,
  buscada: number,
): { valores: Autorresonancia; pasos: Paso[] } {
  const largoDeHilo = srfLargoDeHilo(hilo.diametro, hilo.vueltas, hilo.avance);
  const medhurst = srfMedhurst(hilo.diametro, hilo.largo, buscada);
  const estimada = Math.min(largoDeHilo.frecuencia, medhurst.frecuencia);
  const D = hilo.simboloDiametro;
  const relacion = hilo.largo / hilo.diametro;
  const vuelta = Math.PI * hilo.diametro * hilo.vueltas;
  const pasos: Paso[] = [
    {
      texto: 'Largo del hilo en las vueltas',
      latex: `\\pi ${D} N = \\pi \\cdot ${mm(hilo.diametro)} \\cdot ${numero(hilo.vueltas)} = ${mm(vuelta)}`,
    },
    {
      texto: 'Largo del hilo',
      latex:
        `\\ell_w = \\sqrt{(\\pi ${D} N)^2 + ${hilo.simboloAvance}^2} = ` +
        `\\sqrt{(${mm(vuelta)})^2 + (${mm(hilo.avance)})^2} = ${mm(largoDeHilo.hilo)}`,
    },
    {
      texto:
        'Autorresonancia con el largo de hilo cerca de media longitud de onda (Knight, The ' +
        'self-resonance and self-capacitance of solenoid coils, sec. 1.2). Estimación',
      latex:
        `f_{\\mathrm{hilo}} = \\dfrac{c}{2\\ell_w} = \\dfrac{c}{2 \\cdot ${mm(largoDeHilo.hilo)}} = ` +
        hz(largoDeHilo.frecuencia),
    },
    {
      texto: 'Capacidad propia de Medhurst (1947), en pF por cm de diámetro',
      latex:
        `\\dfrac{C_L}{${D}} = 0{,}1126 \\dfrac{${hilo.simboloLargo}}{${D}} + 0{,}08 + ` +
        `\\dfrac{0{,}27}{\\sqrt{${hilo.simboloLargo}/${D}}} = ` +
        `0{,}1126 \\cdot ${numero(relacion)} + 0{,}08 + \\dfrac{0{,}27}{\\sqrt{${numero(relacion)}}} = ` +
        `${numero(medhurst.porCm)}\\,\\mathrm{pF/cm}`,
    },
    {
      texto: 'Capacidad propia de esta bobina',
      latex:
        `C_L = ${numero(medhurst.porCm)}\\,\\mathrm{pF/cm} \\cdot ${numero(hilo.diametro * 100)}\\,\\mathrm{cm} = ` +
        valorLatex(medhurst.capacidad, 'capacidad'),
    },
    {
      texto: 'Autorresonancia de Medhurst, con la L buscada. Estimación',
      latex:
        `f_{\\mathrm{M}} = \\dfrac{1}{2\\pi\\sqrt{L C_L}} = ` +
        `\\dfrac{1}{2\\pi\\sqrt{${henrios(buscada)} \\cdot ${valorLatex(medhurst.capacidad, 'capacidad')}}} = ` +
        hz(medhurst.frecuencia),
    },
    {
      texto: 'SRF estimada: la menor de las dos',
      latex: `f_{\\mathrm{SRF}} \\approx \\min(f_{\\mathrm{hilo}}, f_{\\mathrm{M}}) = ${hz(estimada)}`,
    },
  ];
  return {
    valores: { estimada, largoDeHilo: largoDeHilo.frecuencia, medhurst: medhurst.frecuencia },
    pasos,
  };
}

export function pasoDelMargen(frecuencia: number, srf: number): Paso {
  const cerca = frecuencia > srf / MARGEN_SRF;
  return {
    texto: cerca
      ? 'La frecuencia de trabajo supera SRF/3: aviso de autorresonancia'
      : 'La frecuencia de trabajo queda debajo de SRF/3',
    latex: `f = ${hz(frecuencia)} ${cerca ? '>' : '\\leq'} \\dfrac{f_{\\mathrm{SRF}}}{3} = ${hz(srf / MARGEN_SRF)}`,
  };
}
