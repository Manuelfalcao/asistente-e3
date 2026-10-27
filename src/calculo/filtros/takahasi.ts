import { numeroLatex as numero } from '../comun/latex';
import type { Paso } from '../comun/resultado';
import type { Prototipo } from './filtros';

// Las fórmulas de Takahasi (1951) en la parametrización de Green (Matthaei, Young y Jones, Sec. 4.10;
// Weinberg y Slepian, 1960; spec §7.4): el prototipo pasa bajos de Butterworth o Chebyshev entre una
// fuente y una carga distintas. Dan la escalera con g1 en serie, la fuente en la R menor (g0 = 1) y
// la carga g(n+1) = r ≥ 1. Con r = 1 se reducen a las de terminaciones iguales (ec. 4.05-1 y 4.05-2).

export interface ParametrosTakahasi {
  // R mayor sobre R menor: 1 o más.
  r: number;
  // La transmisión máxima de la banda pasante: 4r/(1+r)², y (1+ε²) veces eso en Chebyshev par.
  k: number;
  // El coeficiente de reflexión en continua, que da la carga: (r − 1)/(r + 1).
  rho0: number;
  // Solo en Chebyshev: Matthaei escribe d = senh a y e = senh â.
  a: number | null;
  aGorro: number | null;
  // Solo en Butterworth: α = (1 − K)^(1/(2n)).
  alfa: number | null;
}

const FUENTE =
  'Takahasi (1951) en la parametrización de Green: Matthaei, Young y Jones, Sec. 4.10, ec. 4.10-2 ' +
  'a 4.10-4, y Weinberg y Slepian (1960).';

const epsilon = (ripple: number) => Math.sqrt(10 ** (ripple / 10) - 1);

// r_min = (ε + √(1+ε²))² = coth²(β/4): la relación más chica con la que se arma Chebyshev par. Es la
// carga del Chebyshev par de terminaciones iguales y no depende del Orden.
export function relacionMinima(ripple: number): number {
  const e = epsilon(ripple);
  return (e + Math.sqrt(1 + e * e)) ** 2;
}

// Chebyshev par entre R distintas pide K ≤ 1, o sea r ≥ r_min (spec §7.4). El margen deja pasar el
// r_min mismo, que con el redondeo puede dar K apenas por encima de 1. Con r = 1 nunca.
export const admiteOrdenPar = (ripple: number, r: number) =>
  r >= relacionMinima(ripple) * (1 - 1e-12);

// 4r/(1+r)²: la transmisión de la fuente conectada directo a la carga. Es la de la escalera en
// continua, donde las L son cortos y los C abiertos.
export const desadaptacionDirecta = (r: number) => (4 * r) / (1 + r) ** 2;

// K: con r = 1 vale 1, salvo Chebyshev par, que entonces no se puede armar (K > 1).
export function transmisionMaxima(
  aproximacion: 'butterworth' | 'chebyshev',
  n: number,
  ripple: number | null,
  r: number,
): number {
  const directa = desadaptacionDirecta(r);
  return aproximacion === 'chebyshev' && n % 2 === 0
    ? (1 + epsilon(ripple!) ** 2) * directa
    : directa;
}

export const FORMULAS_TAKAHASI_BUTTERWORTH: readonly string[] = [
  'K = \\dfrac{4r}{(1 + r)^2},\\; \\alpha = (1 - K)^{1/(2n)},\\; \\gamma_m = \\dfrac{m\\pi}{2n}',
  'g_1 = \\dfrac{2 \\operatorname{sen}\\gamma_1}{1 - \\alpha},\\; ' +
    'g_m g_{m+1} = \\dfrac{4 \\operatorname{sen}\\gamma_{2m-1} \\operatorname{sen}\\gamma_{2m+1}}' +
    '{1 - 2\\alpha\\cos\\gamma_{2m} + \\alpha^2}',
  '\\rho_0 = \\alpha^n,\\; g_{n+1} = \\dfrac{1 + \\rho_0}{1 - \\rho_0}',
];

export const FORMULAS_TAKAHASI_CHEBYSHEV: readonly string[] = [
  '\\varepsilon = \\sqrt{10^{r_{\\mathrm{dB}}/10} - 1},\\; K = \\dfrac{4r}{(1 + r)^2}\\;' +
    '\\text{(por } 1 + \\varepsilon^2 \\text{ si } n \\text{ es par)}',
  'a = \\dfrac{1}{n}\\operatorname{arcsenh}\\dfrac{1}{\\varepsilon},\\; ' +
    '\\hat{a} = \\dfrac{1}{n}\\operatorname{arcsenh}\\dfrac{\\sqrt{1 - K}}{\\varepsilon},\\; ' +
    '\\gamma_m = \\dfrac{m\\pi}{2n}',
  'g_1 = \\dfrac{2 \\operatorname{sen}\\gamma_1}{\\operatorname{senh} a - \\operatorname{senh}\\hat{a}}',
  'g_m g_{m+1} = \\dfrac{4 \\operatorname{sen}\\gamma_{2m-1} \\operatorname{sen}\\gamma_{2m+1}}' +
    '{\\operatorname{senh}^2 a + \\operatorname{senh}^2 \\hat{a} + \\operatorname{sen}^2\\gamma_{2m} - ' +
    '2 \\operatorname{senh} a \\operatorname{senh}\\hat{a} \\cos\\gamma_{2m}}',
  '\\rho_0 = \\dfrac{\\operatorname{senh} n\\hat{a}}{\\operatorname{senh} na}\\;\\text{(impar)},\\; ' +
    '\\dfrac{\\cosh n\\hat{a}}{\\cosh na}\\;\\text{(par)},\\; g_{n+1} = \\dfrac{1 + \\rho_0}{1 - \\rho_0}',
];

// El prototipo de Takahasi. Chebyshev par con r < r_min no tiene diseño: quien llama sube antes al
// impar siguiente.
export function takahasi(
  aproximacion: 'butterworth' | 'chebyshev',
  n: number,
  ripple: number | null,
  r: number,
): Prototipo {
  const kExacta = transmisionMaxima(aproximacion, n, ripple, r);
  if (kExacta > 1 + 1e-9) {
    throw new Error(`Chebyshev de Orden ${n} con r = ${r} < r_min: no hay diseño`);
  }
  // El r_min mismo puede dar K apenas por encima de 1 con el redondeo.
  const k = Math.min(kExacta, 1);
  const gamma = (m: number) => (m * Math.PI) / (2 * n);
  const sen = (m: number) => Math.sin(gamma(m));
  const par = n % 2 === 0;

  // Lo que cambia entre las dos: el denominador de g1 y el de cada producto gm·g(m+1), y ρ0.
  let denominadorG1: number;
  let denominador: (m: number) => number;
  let rho0: number;
  let parametros: Pick<ParametrosTakahasi, 'a' | 'aGorro' | 'alfa'>;
  // ε va antes de K, que en Chebyshev par lo usa; a, â o α, después.
  let antesDeK: Paso[] = [];
  let pasosDeParametros: Paso[];
  let pasoG1: (g1: number) => Paso;
  let pasoProducto: (m: number, g: number, anterior: number) => Paso;
  let pasoRho: Paso;

  const pasoK: Paso = {
    texto: 'K, la transmisión máxima de la banda pasante',
    latex:
      aproximacion === 'chebyshev' && par
        ? `K = (1 + \\varepsilon^2)\\dfrac{4r}{(1 + r)^2} = ` +
          `(1 + ${numero(epsilon(ripple!) ** 2)}) \\cdot \\dfrac{4 \\cdot ${numero(r)}}` +
          `{(1 + ${numero(r)})^2} = ${numero(k)}`
        : `K = \\dfrac{4r}{(1 + r)^2} = \\dfrac{4 \\cdot ${numero(r)}}{(1 + ${numero(r)})^2} = ` +
          numero(k),
    fuente:
      aproximacion === 'chebyshev' && par
        ? 'Chebyshev par: en continua T(0) = K/(1 + ε²), que tiene que ser la desadaptación directa ' +
          '4r/(1 + r)². Hace falta K ≤ 1, o sea r ≥ r_min.'
        : 'En continua las L son cortos y los C abiertos: T(0) = K es la desadaptación directa.',
  };
  // γm = m·π/(2n); los pasos lo escriben con su índice y sustituyen sus senos y cosenos.
  const gammaTexto = (m: number) => `\\gamma_{${m}}`;

  if (aproximacion === 'butterworth') {
    const alfa = (1 - k) ** (1 / (2 * n));
    denominadorG1 = 1 - alfa;
    denominador = (m) => 1 - 2 * alfa * Math.cos(gamma(2 * m)) + alfa * alfa;
    rho0 = alfa ** n;
    parametros = { a: null, aGorro: null, alfa };
    pasosDeParametros = [
      {
        texto: 'α',
        latex: `\\alpha = (1 - K)^{1/(2n)} = (1 - ${numero(k)})^{1/(2 \\cdot ${n})} = ${numero(alfa)}`,
        fuente: FUENTE,
      },
    ];
    pasoG1 = (g1) => ({
      texto: 'g1',
      latex:
        `g_{1} = \\dfrac{2 \\operatorname{sen}\\gamma_1}{1 - \\alpha} = ` +
        `\\dfrac{2 \\cdot ${numero(sen(1))}}{1 - ${numero(alfa)}} = ${numero(g1)}`,
    });
    pasoProducto = (m, g, anterior) => ({
      texto: `g${m + 1}`,
      latex:
        `g_{${m + 1}} = \\dfrac{4 \\operatorname{sen}${gammaTexto(2 * m - 1)} ` +
        `\\operatorname{sen}${gammaTexto(2 * m + 1)}}{(1 - 2\\alpha\\cos${gammaTexto(2 * m)} + ` +
        `\\alpha^2)\\, g_{${m}}} = \\dfrac{4 \\cdot ${numero(sen(2 * m - 1))} \\cdot ` +
        `${numero(sen(2 * m + 1))}}{${numero(denominador(m))} \\cdot ${numero(anterior)}} = ` +
        numero(g),
    });
    pasoRho = {
      texto: 'ρ0, el coeficiente de reflexión en continua',
      latex: `\\rho_0 = \\alpha^n = ${numero(alfa)}^{${n}} = ${numero(rho0)}`,
    };
  } else {
    const e = epsilon(ripple!);
    const a = Math.asinh(1 / e) / n;
    const aGorro = Math.asinh(Math.sqrt(1 - k) / e) / n;
    const senhA = Math.sinh(a);
    const senhAGorro = Math.sinh(aGorro);
    denominadorG1 = senhA - senhAGorro;
    denominador = (m) =>
      senhA ** 2 +
      senhAGorro ** 2 +
      sen(2 * m) ** 2 -
      2 * senhA * senhAGorro * Math.cos(gamma(2 * m));
    rho0 = par
      ? Math.cosh(n * aGorro) / Math.cosh(n * a)
      : Math.sinh(n * aGorro) / Math.sinh(n * a);
    parametros = { a, aGorro, alfa: null };
    antesDeK = [
      {
        texto: 'ε, del ripple',
        latex:
          `\\varepsilon = \\sqrt{10^{r_{\\mathrm{dB}}/10} - 1} = ` +
          `\\sqrt{10^{${numero(ripple!)}/10} - 1} = ${numero(e)}`,
        fuente: FUENTE,
      },
    ];
    pasosDeParametros = [
      {
        texto: 'a',
        latex:
          `a = \\dfrac{1}{n}\\operatorname{arcsenh}\\dfrac{1}{\\varepsilon} = ` +
          `\\dfrac{1}{${n}}\\operatorname{arcsenh}\\dfrac{1}{${numero(e)}} = ${numero(a)}`,
      },
      {
        texto: 'â',
        latex:
          `\\hat{a} = \\dfrac{1}{n}\\operatorname{arcsenh}\\dfrac{\\sqrt{1 - K}}{\\varepsilon} = ` +
          `\\dfrac{1}{${n}}\\operatorname{arcsenh}\\dfrac{\\sqrt{1 - ${numero(k)}}}{${numero(e)}} = ` +
          numero(aGorro),
      },
    ];
    pasoG1 = (g1) => ({
      texto: 'g1',
      latex:
        `g_{1} = \\dfrac{2 \\operatorname{sen}\\gamma_1}{\\operatorname{senh} a - ` +
        `\\operatorname{senh}\\hat{a}} = \\dfrac{2 \\cdot ${numero(sen(1))}}{${numero(senhA)} - ` +
        `${numero(senhAGorro)}} = ${numero(g1)}`,
    });
    pasoProducto = (m, g, anterior) => ({
      texto: `g${m + 1}`,
      latex:
        `g_{${m + 1}} = \\dfrac{4 \\operatorname{sen}${gammaTexto(2 * m - 1)} ` +
        `\\operatorname{sen}${gammaTexto(2 * m + 1)}}{\\left(\\operatorname{senh}^2 a + ` +
        `\\operatorname{senh}^2 \\hat{a} + \\operatorname{sen}^2${gammaTexto(2 * m)} - ` +
        `2 \\operatorname{senh} a \\operatorname{senh}\\hat{a} \\cos${gammaTexto(2 * m)}\\right) ` +
        `g_{${m}}} = \\dfrac{4 \\cdot ${numero(sen(2 * m - 1))} \\cdot ${numero(sen(2 * m + 1))}}` +
        `{${numero(denominador(m))} \\cdot ${numero(anterior)}} = ${numero(g)}`,
    });
    pasoRho = {
      texto: `ρ0, el coeficiente de reflexión en continua: Orden ${par ? 'par' : 'impar'}`,
      latex: par
        ? `\\rho_0 = \\dfrac{\\cosh n\\hat{a}}{\\cosh na} = ` +
          `\\dfrac{\\cosh(${n} \\cdot ${numero(aGorro)})}{\\cosh(${n} \\cdot ${numero(a)})} = ` +
          numero(rho0)
        : `\\rho_0 = \\dfrac{\\operatorname{senh} n\\hat{a}}{\\operatorname{senh} na} = ` +
          `\\dfrac{\\operatorname{senh}(${n} \\cdot ${numero(aGorro)})}` +
          `{\\operatorname{senh}(${n} \\cdot ${numero(a)})} = ${numero(rho0)}`,
    };
  }

  const g = [(2 * sen(1)) / denominadorG1];
  for (let m = 1; m < n; m++) {
    g.push((4 * sen(2 * m - 1) * sen(2 * m + 1)) / (denominador(m) * g[m - 1]));
  }
  const carga = (1 + rho0) / (1 - rho0);

  const pasos: Paso[] = [
    ...antesDeK,
    pasoK,
    ...pasosDeParametros,
    pasoG1(g[0]),
    ...g.slice(1).map((gm, i) => pasoProducto(i + 1, gm, g[i])),
    pasoRho,
    {
      texto: 'Carga del prototipo: tiene que dar r',
      latex:
        `g_{${n + 1}} = \\dfrac{1 + \\rho_0}{1 - \\rho_0} = ` +
        `\\dfrac{1 + ${numero(rho0)}}{1 - ${numero(rho0)}} = ${numero(carga)}`,
    },
  ];

  return {
    aproximacion,
    orden: n,
    ripple,
    g,
    carga,
    // β/(2n) = a, así que el γ de Matthaei es senh a.
    beta: parametros.a === null ? null : 2 * n * parametros.a,
    gamma: parametros.a === null ? null : Math.sinh(parametros.a),
    factorRetardo: null,
    takahasi: { r, k, rho0, ...parametros },
    pasos,
  };
}
