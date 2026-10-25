// Las fórmulas de la bobina solenoidal de aire (spec §6.2 a §6.6), en SI y sin texto: los números
// que arman la Calculadora de bobinas y que los Casos de prueba comparan contra sus referencias.

export const MU0 = 4 * Math.PI * 1e-7;

// Las entradas de largo de la Calculadora, en m.
export interface Medidas {
  carrete: number;
  cable: number;
  separacion: number;
}

export interface Geometria {
  // d: el Diámetro del cable, con esmalte.
  cable: number;
  // p = d + s: la distancia entre centros de vueltas vecinas.
  entreCentros: number;
  // D0 = Diámetro del carrete + d: el diámetro al centro del cable, el de baja frecuencia.
  d0: number;
}

export function geometria({ carrete, cable, separacion }: Medidas): Geometria {
  return { cable, entreCentros: cable + separacion, d0: carrete + cable };
}

// Coeficiente de Nagaoka por la fórmula de Lundin (Proc. IEEE 73(9), 1985), con x = D/ℓ: dos
// ramas, la de bobina larga (x < 1) y la de bobina corta, con error menor a 3 ppm.
export function kLundin(x: number): number {
  if (x < 1) return lundinLarga(x).f - (4 * x) / (3 * Math.PI);
  const { f, g } = lundinCorta(x);
  return (2 / (Math.PI * x)) * ((Math.log(4 * x) - 0.5) * f + g);
}

// Las partes de cada rama, que los pasos muestran por separado para que entren en el celular. En
// la larga, kL = F − 4x/(3π); en la corta, kL = 2/(πx)·[(ln 4x − 1/2)·F + G]. F es Fn sobre su
// denominador.
export function lundinLarga(x: number): { fn: number; f: number } {
  const x2 = x * x;
  const fn = 1 + 0.383901 * x2 + 0.017108 * x2 * x2;
  return { fn, f: fn / (1 + 0.258952 * x2) };
}

export function lundinCorta(x: number): { fn: number; f: number; g: number } {
  const u = 1 / (x * x);
  const fn = 1 + 0.383901 * u + 0.017108 * u * u;
  return {
    fn,
    f: fn / (1 + 0.258952 * u),
    g: 0.093842 * u + 0.002029 * u * u - 0.000801 * u * u * u,
  };
}

// Corrección de Rosa por la autoinducción del cable redondo, solo la parte externa: en VHF el
// efecto pelicular anula la inductancia interna (Knight, ec. 10.4).
export function ksExterna(entreCentros: number, cable: number): number {
  return 1.5 - Math.log((2 * entreCentros) / cable);
}

// Corrección de Rosa por la inductancia mutua, en la serie de Grover extendida por Knight
// (ec. 10.18). Vale para N no entero.
export function km(n: number): number {
  return (
    Math.log(2 * Math.PI) -
    1.5 -
    Math.log(n) / (6 * n) -
    0.33084236 / n -
    1 / (120 * n ** 3) +
    1 / (504 * n ** 5) -
    0.0011925 / n ** 7 +
    0.000507 / n ** 9
  );
}

export interface DiametroRF {
  // La cota de Knight (ec. 4.1): la corriente pegada al lado interno del cable.
  dMin: number;
  // El peso de Dmin; Infinity con vueltas juntas.
  w: number;
  dInfinito: number;
}

// El diámetro efectivo de RF de Knight (ec. 4.2), semiempírico: en RF la corriente se corre hacia el
// interior de la bobina, y más cuanto más juntas están las vueltas.
export function diametroRF({ cable, entreCentros, d0 }: Geometria, n: number): DiametroRF {
  const dMin = d0 - cable + (2 * cable) / n;
  if (entreCentros <= cable) return { dMin, w: Infinity, dInfinito: dMin };
  const w = 1 / (entreCentros / cable - 1) ** 2;
  return { dMin, w, dInfinito: (d0 + dMin * w) / (1 + w) };
}

// Rosa y Nagaoka (Knight, ec. 10.6) con un diámetro D, en H, con lo que va en los pasos.
export interface LaminaUnaCapa {
  diametro: number;
  vueltas: number;
  // ℓ = N·p: el largo de la lámina de corriente, no el Largo de la bobina.
  largo: number;
  x: number;
  kL: number;
  ks: number;
  km: number;
  // La lámina de corriente.
  ls: number;
  // μ0·D·N·(ks + km)/2
  correccion: number;
  inductancia: number;
}

export function unaCapa(g: Geometria, n: number, diametro: number): LaminaUnaCapa {
  const largo = n * g.entreCentros;
  const x = diametro / largo;
  const kL = kLundin(x);
  const ks = ksExterna(g.entreCentros, g.cable);
  const kmN = km(n);
  const ls = (MU0 * Math.PI * diametro * diametro * n * n * kL) / (4 * largo);
  const correccion = (MU0 * diametro * n * (ks + kmN)) / 2;
  return {
    diametro,
    vueltas: n,
    largo,
    x,
    kL,
    ks,
    km: kmN,
    ls,
    correccion,
    inductancia: ls - correccion,
  };
}

// --- Dos capas (spec §6.2 y §6.4) -----------------------------------------------------------------

// n vueltas por capa y N = 2n en total. La segunda capa va apilada sobre la primera y bobinada en el
// mismo sentido, así que la sección del bobinado es un rectángulo de b × c con el centro en a.
export interface GeometriaDosCapas {
  cable: number;
  entreCentros: number;
  // a = Diámetro del carrete/2 + d: el radio medio, al centro de la sección.
  radioMedio: number;
  // c = 2d
  profundidad: number;
  // Diámetro del carrete + 4d
  diametroExterior: number;
}

export function geometriaDosCapas({ carrete, cable, separacion }: Medidas): GeometriaDosCapas {
  return {
    cable,
    entreCentros: cable + separacion,
    radioMedio: carrete / 2 + cable,
    profundidad: 2 * cable,
    diametroExterior: carrete + 4 * cable,
  };
}

// Bs de Rosa y Grover (Tabla X), con un ajuste cerrado propio de la misma forma que la serie de km:
// error menor a 10⁻⁵ para n′ = b/c ≥ 1, con Bs(1) = 0 exacto. Es parte de la Deducción propia de
// dos capas.
export function bsAjuste(nPrima: number): number {
  return (
    0.3522843 -
    Math.log(nPrima) / (6 * nPrima) -
    0.3471888 / nPrima -
    0.0004105 / nPrima ** 2 -
    0.004685 / nPrima ** 3
  );
}

// Rosa y Grover (91), la (156) de la Circular 74: la bobina de varias capas con la corriente
// repartida en su sección de b × c, como la lámina de Nagaoka con el radio medio menos ΔL1.
export interface RosaGrover91 {
  radioMedio: number;
  // b: el largo de la lámina, n·p en dos capas. No es el Largo de la bobina.
  largo: number;
  profundidad: number;
  // N, el total de las capas.
  vueltas: number;
  // 2a/b
  x: number;
  kL: number;
  ls: number;
  // n′ = b/c
  nPrima: number;
  bs: number;
  // μ0·a·N²·(c/b)·(0,693 + Bs)
  deltaL1: number;
}

export function rosaGrover91(
  radioMedio: number,
  largo: number,
  profundidad: number,
  vueltas: number,
): RosaGrover91 {
  const x = (2 * radioMedio) / largo;
  const kL = kLundin(x);
  const nPrima = largo / profundidad;
  const bs = bsAjuste(nPrima);
  return {
    radioMedio,
    largo,
    profundidad,
    vueltas,
    x,
    kL,
    ls: (MU0 * Math.PI * (2 * radioMedio) ** 2 * vueltas * vueltas * kL) / (4 * largo),
    nPrima,
    bs,
    deltaL1: MU0 * radioMedio * vueltas * vueltas * (profundidad / largo) * (0.693 + bs),
  };
}

// El término E de Maxwell (Circular 74): la diferencia entre la mutua de vueltas vecinas redondas y
// la de celdas cuadradas. No depende de la inductancia interna, así que se mantiene en la versión
// externa (pendiente P2 de la spec, decidido con la suma de anillos en el ticket 34).
export const E_MAXWELL = 0.017;
// 0,447049·D es la distancia media geométrica propia de un cuadrado de lado D.
const DMG_CUADRADO = 0.447049;
// La constante de Maxwell sin la inductancia interna de continua: ln(2·0,447049) = −0,1119 en lugar
// de +0,13806, que es esto más 1/4. Adaptación propia para RF, como ks en una capa.
export const MAXWELL_EXTERNO = Math.log(2 * DMG_CUADRADO);

// La corrección de Maxwell (93) por el cable redondo, versión externa y con D′ = √(p·d) para la
// Separación: con s > 0 las celdas son rectángulos de p × d. Las dos son adaptaciones propias.
export interface Maxwell93 {
  dPrima: number;
  // ln(D′/d) − 0,1119 + E
  termino: number;
  // μ0·a·N·[ln(D′/d) − 0,1119 + E]
  deltaL2: number;
}

export function maxwell93(
  radioMedio: number,
  vueltas: number,
  entreCentros: number,
  cable: number,
): Maxwell93 {
  const dPrima = Math.sqrt(entreCentros * cable);
  const termino = Math.log(dPrima / cable) + MAXWELL_EXTERNO + E_MAXWELL;
  return { dPrima, termino, deltaL2: MU0 * radioMedio * vueltas * termino };
}

export interface LaminaDosCapas extends RosaGrover91 {
  vueltasPorCapa: number;
  // Null en el plan B: Rosa y Grover (91) sola.
  maxwell: Maxwell93 | null;
  inductancia: number;
}

// L = Ls − ΔL1 + ΔL2 con n vueltas por capa, con D0 (la de baja frecuencia). Sin Maxwell, el plan B.
export function dosCapas(g: GeometriaDosCapas, n: number, conMaxwell: boolean): LaminaDosCapas {
  const vueltas = 2 * n;
  const rosa = rosaGrover91(g.radioMedio, n * g.entreCentros, g.profundidad, vueltas);
  const maxwell = conMaxwell ? maxwell93(g.radioMedio, vueltas, g.entreCentros, g.cable) : null;
  return {
    ...rosa,
    vueltasPorCapa: n,
    maxwell,
    inductancia: rosa.ls - rosa.deltaL1 + (maxwell?.deltaL2 ?? 0),
  };
}

export const PULGADA = 0.0254;

// Hazeltine, publicada por Wheeler 1928 (Proc. IRE 16(10), ec. 1): L[µH] = 0,8a²N²/(6a + 9b + 10c),
// con el radio medio a, el largo b y la profundidad c en pulgadas. Wheeler la declara correcta a
// cerca del 1 % cuando los tres términos del denominador son parecidos.
export function hazeltine(
  radioMedio: number,
  largo: number,
  profundidad: number,
  vueltas: number,
): number {
  const a = radioMedio / PULGADA;
  const b = largo / PULGADA;
  const c = profundidad / PULGADA;
  return ((0.8 * a * a * vueltas * vueltas) / (6 * a + 9 * b + 10 * c)) * 1e-6;
}

// Las vueltas de Hazeltine para la L buscada, con b = (N/2)·p:
// 0,8·a²·N² − 4,5·p·L·N − (6a + 10c)·L = 0.
export function vueltasDeHazeltine(
  { radioMedio, profundidad, entreCentros }: GeometriaDosCapas,
  buscada: number,
): number {
  const a = radioMedio / PULGADA;
  const c = profundidad / PULGADA;
  const p = entreCentros / PULGADA;
  const l = buscada * 1e6;
  return (
    (4.5 * p * l + Math.sqrt((4.5 * p * l) ** 2 + 3.2 * a * a * l * (6 * a + 10 * c))) /
    (1.6 * a * a)
  );
}

// Wheeler 1928 (Proc. IRE 16(10), ec. 2): L[µH] = a²n²/(9a + 10b), con el radio a y el largo b en
// pulgadas. Es de lámina de corriente; Wheeler la declara exacta al 1 % con b > 0,8a.
export function wheeler1928(diametro: number, largo: number, n: number): number {
  const a = diametro / 2 / PULGADA;
  const b = largo / PULGADA;
  return ((a * a * n * n) / (9 * a + 10 * b)) * 1e-6;
}

// Las vueltas de Wheeler para la L buscada, con b = n·p: a²n² − 10·p·L·n − 9·a·L = 0.
export function vueltasDeWheeler({ entreCentros, d0 }: Geometria, buscada: number): number {
  const a = d0 / 2 / PULGADA;
  const p = entreCentros / PULGADA;
  const l = buscada * 1e6;
  return (10 * p * l + Math.sqrt(100 * p * p * l * l + 36 * a ** 3 * l)) / (2 * a * a);
}

const LUZ = 299_792_458;

// La primera resonancia de una bobina libre, con el largo de hilo cerca de media longitud de onda
// (Knight, The self-resonance and self-capacitance of solenoid coils, sec. 1.2). En m y Hz.
export function srfLargoDeHilo(d0: number, n: number, largo: number) {
  const hilo = Math.sqrt((Math.PI * d0 * n) ** 2 + largo ** 2);
  return { hilo, frecuencia: LUZ / (2 * hilo) };
}

// La capacidad propia de Medhurst (Wireless Engineer, 1947), C_L/D en pF/cm, y la resonancia con la
// L de la bobina. En F y Hz.
export function srfMedhurst(d0: number, largo: number, inductancia: number) {
  const r = largo / d0;
  const porCm = 0.1126 * r + 0.08 + 0.27 / Math.sqrt(r);
  const capacidad = porCm * d0 * 100 * 1e-12;
  return {
    porCm,
    capacidad,
    frecuencia: 1 / (2 * Math.PI * Math.sqrt(inductancia * capacidad)),
  };
}

// La cota de la búsqueda: más vueltas que esto ya no es una bobina, es una L que no se alcanza.
const COTA = 2 ** 30;

// El N real que da la L buscada (spec §6.5): bisección sobre N desde 1, con la cota de arriba
// duplicándose hasta pasar la L buscada. Null si ninguna cota la alcanza. En dos capas arranca desde
// el n más chico que entra en el rango de la fórmula.
export function despejarVueltas(
  inductancia: (n: number) => number,
  buscada: number,
  desde = 1,
): number | null {
  let lo = desde;
  let hi = 2 * desde;
  while (inductancia(hi) < buscada) {
    lo = hi;
    hi *= 2;
    if (hi > COTA) return null;
  }
  while ((hi - lo) / hi >= 1e-9) {
    const medio = (lo + hi) / 2;
    if (inductancia(medio) < buscada) lo = medio;
    else hi = medio;
  }
  return (lo + hi) / 2;
}
