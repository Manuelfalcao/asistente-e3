// Barrido en frecuencia común (spec §5.7): análisis ABCD con complejos de una red en escalera entre
// R_s y R_L, con la ganancia de transductor. Lo usan las redes de adaptación (ancho de banda,
// armónicas y pérdida), y después los resonadores acoplados y los atenuadores.

export interface Complejo {
  re: number;
  im: number;
}

const c = (re: number, im = 0): Complejo => ({ re, im });
const suma = (a: Complejo, b: Complejo) => c(a.re + b.re, a.im + b.im);
const producto = (a: Complejo, b: Complejo) =>
  c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const escalar = (a: Complejo, k: number) => c(a.re * k, a.im * k);
const modulo2 = (a: Complejo) => a.re * a.re + a.im * a.im;
const inverso = (a: Complejo) => {
  const d = modulo2(a);
  return c(a.re / d, -a.im / d);
};
const cociente = (a: Complejo, b: Complejo) => producto(a, inverso(b));

// Un componente de la escalera, de la fuente a la carga. Ideal, salvo la R de pérdida en serie con
// una L (ω₀·L/Q en redes de adaptación).
export interface ElementoBarrido {
  componente: 'L' | 'C' | 'R';
  posicion: 'serie' | 'derivacion';
  // En H, F u Ω.
  valor: number;
  // En Ω, solo en una L.
  rSerie?: number;
}

export interface RedBarrido {
  rs: number;
  rl: number;
  elementos: readonly ElementoBarrido[];
}

export interface Respuesta {
  // La ganancia de transductor: la potencia en R_L sobre la disponible de la fuente.
  s21Cuadrado: number;
  // Con R_L conectada.
  zEntrada: Complejo;
}

function impedancia(e: ElementoBarrido, omega: number): Complejo {
  switch (e.componente) {
    case 'L':
      return c(e.rSerie ?? 0, omega * e.valor);
    case 'C':
      return c(0, -1 / (omega * e.valor));
    case 'R':
      return c(e.valor);
  }
}

// [[A, B], [C, D]] de la cascada: serie [[1, Z], [0, 1]] y derivación [[1, 0], [Y, 1]].
export function respuesta(red: RedBarrido, f: number): Respuesta {
  const omega = 2 * Math.PI * f;
  let [a, b, cc, d] = [c(1), c(0), c(0), c(1)];
  for (const e of red.elementos) {
    const z = impedancia(e, omega);
    if (e.posicion === 'serie') {
      b = suma(producto(a, z), b);
      d = suma(producto(cc, z), d);
    } else {
      const y = inverso(z);
      a = suma(a, producto(b, y));
      cc = suma(cc, producto(d, y));
    }
  }
  const { rs, rl } = red;
  // |S21|² = 4·R_s·R_L / |A·R_L + B + C·R_s·R_L + D·R_s|²
  const denominador = suma(suma(escalar(a, rl), b), suma(escalar(cc, rs * rl), escalar(d, rs)));
  return {
    s21Cuadrado: (4 * rs * rl) / modulo2(denominador),
    // Zin = (A·R_L + B) / (C·R_L + D)
    zEntrada: cociente(suma(escalar(a, rl), b), suma(escalar(cc, rl), d)),
  };
}

// La atenuación de transductor en dB.
export function atenuacionDb(red: RedBarrido, f: number): number {
  return -10 * Math.log10(respuesta(red, f).s21Cuadrado);
}

// El rango y la densidad del barrido (spec §12.2), en veces f₀.
export const BARRIDO = { desde: 1 / 50, hasta: 50, puntosPorDecada: 200 } as const;

// Dónde cae la ganancia a la mitad de la de f₀. Null: no hay cruce en el rango barrido.
export interface Bordes {
  fInf: number | null;
  fSup: number | null;
}

// Los bordes a −3 dB se buscan desde f₀ hacia cada lado, punto por punto en escala logarítmica, y
// el primer cruce se refina por bisección.
export function bordesMenos3dB(red: RedBarrido, f0: number): Bordes {
  const umbral = respuesta(red, f0).s21Cuadrado / 2;
  const pasa = (f: number) => respuesta(red, f).s21Cuadrado >= umbral;
  const buscar = (hasta: number): number | null => {
    const paso = 10 ** (Math.sign(Math.log10(hasta)) / BARRIDO.puntosPorDecada);
    const n = Math.ceil(Math.abs(Math.log10(hasta)) * BARRIDO.puntosPorDecada);
    let adentro = f0;
    for (let i = 1; i <= n; i++) {
      const f = i === n ? f0 * hasta : f0 * paso ** i;
      if (!pasa(f)) return biseccion(adentro, f, pasa);
      adentro = f;
    }
    return null;
  };
  return { fInf: buscar(BARRIDO.desde), fSup: buscar(BARRIDO.hasta) };
}

// Entre una f que pasa y una que no, hasta que las dos son el mismo número en doble precisión.
function biseccion(adentro: number, afuera: number, pasa: (f: number) => boolean): number {
  for (let i = 0; i < 200; i++) {
    const medio = (adentro + afuera) / 2;
    if (medio === adentro || medio === afuera) break;
    if (pasa(medio)) adentro = medio;
    else afuera = medio;
  }
  return (adentro + afuera) / 2;
}
