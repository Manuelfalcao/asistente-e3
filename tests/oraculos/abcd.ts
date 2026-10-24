// Oráculo ABCD con números complejos (spec §5.7 y §13.4): la red completa entre R_s y R_L, con la
// ganancia de transductor. Se escribe aparte y no importa nada de src/: es la segunda vía con la
// que se verifican los atenuadores, y después las redes de adaptación y los filtros.

export interface Complejo {
  re: number;
  im: number;
}

export const c = (re: number, im = 0): Complejo => ({ re, im });

const suma = (a: Complejo, b: Complejo): Complejo => c(a.re + b.re, a.im + b.im);
const resta = (a: Complejo, b: Complejo): Complejo => c(a.re - b.re, a.im - b.im);
const producto = (a: Complejo, b: Complejo): Complejo =>
  c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const modulo2 = (a: Complejo): number => a.re * a.re + a.im * a.im;
const conjugado = (a: Complejo): Complejo => c(a.re, -a.im);
const cociente = (a: Complejo, b: Complejo): Complejo => {
  const d = modulo2(b);
  const n = producto(a, conjugado(b));
  return c(n.re / d, n.im / d);
};

export const modulo = (a: Complejo): number => Math.sqrt(modulo2(a));

// [[A, B], [C, D]]
export interface Matriz {
  a: Complejo;
  b: Complejo;
  c: Complejo;
  d: Complejo;
}

const UNO = c(1);
const CERO = c(0);

// Un elemento de la escalera, de la fuente a la carga.
export type Elemento = { tipo: 'serie'; z: Complejo } | { tipo: 'derivacion'; y: Complejo };

// Elemento en serie: [[1, Z], [0, 1]].
export const serie = (z: Complejo | number): Elemento => ({
  tipo: 'serie',
  z: typeof z === 'number' ? c(z) : z,
});

// Elemento en derivación: [[1, 0], [Y, 1]].
export const derivacion = (y: Complejo | number): Elemento => ({
  tipo: 'derivacion',
  y: typeof y === 'number' ? c(y) : y,
});

// Una resistencia en derivación, dada en ohms.
export const derivacionR = (ohms: number): Elemento => derivacion(1 / ohms);

export function matrizDe(e: Elemento): Matriz {
  return e.tipo === 'serie'
    ? { a: UNO, b: e.z, c: CERO, d: UNO }
    : { a: UNO, b: CERO, c: e.y, d: UNO };
}

const por = (m: Matriz, n: Matriz): Matriz => ({
  a: suma(producto(m.a, n.a), producto(m.b, n.c)),
  b: suma(producto(m.a, n.b), producto(m.b, n.d)),
  c: suma(producto(m.c, n.a), producto(m.d, n.c)),
  d: suma(producto(m.c, n.b), producto(m.d, n.d)),
});

export function cascada(elementos: readonly Elemento[]): Matriz {
  return elementos.reduce((m, e) => por(m, matrizDe(e)), {
    a: UNO,
    b: CERO,
    c: CERO,
    d: UNO,
  });
}

// |S21|² = 4·R_s·R_L / |A·R_L + B + C·R_s·R_L + D·R_s|²
export function s21Cuadrado(m: Matriz, rs: number, rl: number): number {
  const denominador = suma(
    suma(producto(m.a, c(rl)), m.b),
    suma(producto(m.c, c(rs * rl)), producto(m.d, c(rs))),
  );
  return (4 * rs * rl) / modulo2(denominador);
}

// Zin = (A·R_L + B) / (C·R_L + D)
export function zEntrada(m: Matriz, rl: number): Complejo {
  return cociente(suma(producto(m.a, c(rl)), m.b), suma(producto(m.c, c(rl)), m.d));
}

// Lo que ve la carga hacia la fuente: Zout = (D·R_s + B) / (C·R_s + A)
export function zSalida(m: Matriz, rs: number): Complejo {
  return cociente(suma(producto(m.d, c(rs)), m.b), suma(producto(m.c, c(rs)), m.a));
}

// La atenuación de transductor en dB: la pérdida de la red entre R_s y R_L.
export function atenuacionDb(m: Matriz, rs: number, rl: number): number {
  return -10 * Math.log10(s21Cuadrado(m, rs, rl));
}

// La pérdida de retorno en dB de una impedancia contra una de referencia.
export function perdidaDeRetornoDb(z: Complejo, referencia: number): number {
  const gamma = cociente(resta(z, c(referencia)), suma(z, c(referencia)));
  return -20 * Math.log10(modulo(gamma));
}

// La potencia que disipa cada elemento con `potencia` W en la entrada, con la carga R_L. Va de la
// carga hacia la fuente, con V = 1 sobre la carga, y escala al final: el resultado es el de una red
// adaptada. Las potencias son las de la parte real de cada elemento (en W).
export function potenciaPorElemento(
  elementos: readonly Elemento[],
  rl: number,
  potencia: number,
): number[] {
  let v = UNO;
  let i = c(1 / rl);
  const disipada: number[] = Array<number>(elementos.length).fill(0);
  for (let k = elementos.length - 1; k >= 0; k--) {
    const e = elementos[k];
    if (e.tipo === 'serie') {
      disipada[k] = e.z.re * modulo2(i);
      v = suma(v, producto(e.z, i));
    } else {
      disipada[k] = e.y.re * modulo2(v);
      i = suma(i, producto(e.y, v));
    }
  }
  // Con V = 1 sobre la carga, la potencia que entra es Re(V_ent · conj(I_ent)).
  const entrada = producto(v, conjugado(i)).re;
  return disipada.map((p) => (p / entrada) * potencia);
}
