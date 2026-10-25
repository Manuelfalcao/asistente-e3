// Búsqueda de Arreglos equivalentes (spec §8.3 y §8.4): los mejores Arreglos serie-paralelo de hasta
// 4 componentes que aproximan un valor buscado. Un solo motor con dos operaciones, la suma y la suma
// recíproca; cuál es "serie" lo decide quien la usa (en capacitores el paralelo suma, en
// resistencias la serie). La usan los Arreglos equivalentes y, con valores comerciales, los
// atenuadores. Pura: recibe los valores en SI y devuelve las redes con índices a esos valores.

export type Operacion = 'suma' | 'reciproca';

// Una forma de conexión: el árbol sin valores.
export type Forma = { hoja: true } | { op: Operacion; hijos: readonly Forma[] };

// Una red: la forma con el índice del valor de cada componente.
export type Red = { hoja: number } | { op: Operacion; hijos: readonly Red[] };

export interface Arreglo {
  red: Red;
  valor: number;
  componentes: number;
  // Fracción con signo: (valor − buscado)/buscado.
  error: number;
}

export interface Busqueda {
  // Ya ordenados con la regla de §8.4.
  arreglos: Arreglo[];
  // Cuántas veces se calculó el valor de una red: lo dicen los pasos intermedios.
  evaluadas: number;
}

export const MAXIMO_DE_COMPONENTES = 4;
export const ARREGLOS_A_MOSTRAR = 10;

const HOJA: Forma = { hoja: true };
const dual = (op: Operacion): Operacion => (op === 'suma' ? 'reciproca' : 'suma');

// --- Formas de conexión (OEIS A000084: 1, 2, 4, 10) ----------------------------------------------

// Las particiones de n en partes de a lo sumo `tope`, de mayor a menor.
function particiones(n: number, tope: number): number[][] {
  if (n === 0) return [[]];
  const res: number[][] = [];
  for (let parte = Math.min(n, tope); parte >= 1; parte--) {
    for (const resto of particiones(n - parte, parte)) res.push([parte, ...resto]);
  }
  return res;
}

// Las formas de n componentes con raíz `op`. Son árboles alternantes (un hijo nunca repite la
// operación del padre, porque S(a, S(b, c)) es S(a, b, c)) con los hijos ordenados: primero las
// hojas y después las subredes de menos a más componentes. Los hijos del mismo tamaño se eligen con
// índices no decrecientes, así que cada red aparece una sola vez.
function formasConRaiz(n: number, op: Operacion): Forma[] {
  const res: Forma[] = [];
  for (const partes of particiones(n, n - 1)) {
    const tamanos = [...partes].reverse();
    const elegir = (i: number, desde: number, hijos: Forma[]) => {
      if (i === tamanos.length) {
        res.push({ op, hijos });
        return;
      }
      const opciones = tamanos[i] === 1 ? [HOJA] : formasConRaiz(tamanos[i], dual(op));
      const inicio = i > 0 && tamanos[i] === tamanos[i - 1] ? desde : 0;
      for (let k = inicio; k < opciones.length; k++) elegir(i + 1, k, [...hijos, opciones[k]]);
    };
    elegir(0, 0, []);
  }
  return res;
}

export function formasDeConexion(n: number): Forma[] {
  return n === 1 ? [HOJA] : [...formasConRaiz(n, 'suma'), ...formasConRaiz(n, 'reciproca')];
}

// Cuántas redes distintas hay de 1 a 4 componentes con n valores, repitiendo valores: la fórmula
// cerrada de research/busqueda-arreglos-equivalentes.md §2, con M = n(n + 1)/2 pares.
export function redesPosibles(n: number): number[] {
  const comb = (a: number, b: number) => {
    let r = 1;
    for (let i = 0; i < b; i++) r = (r * (a - i)) / (i + 1);
    return r;
  };
  const m = comb(n + 1, 2);
  return [
    n,
    2 * m,
    2 * (comb(n + 2, 3) + n * m),
    2 * (comb(n + 3, 4) + m * m + comb(m + 1, 2) + n * comb(n + 2, 3) + n * n * m),
  ];
}

// --- Valor de una red -----------------------------------------------------------------------------

// Serie y paralelo crecen con cada componente, así que evaluando la red con todos al mínimo y con
// todos al máximo sale el peor caso exacto. La suma recíproca con un componente en 0 da 0.
export function valorDeRed(red: Red, valorDeHoja: (indice: number) => number): number {
  if (!('op' in red)) return valorDeHoja(red.hoja);
  let total = 0;
  for (const hijo of red.hijos) {
    const v = valorDeRed(hijo, valorDeHoja);
    total += red.op === 'suma' ? v : 1 / v;
  }
  return red.op === 'suma' ? total : 1 / total;
}

export function componentesDe(red: Red): number {
  return 'op' in red ? red.hijos.reduce((n, h) => n + componentesDe(h), 0) : 1;
}

// --- Meet-in-the-middle ---------------------------------------------------------------------------

// Una tabla ordenada por valor: los valores sueltos (b = −1) o los pares i ≤ j de una operación.
interface Tabla {
  valores: Float64Array;
  a: Int32Array;
  b: Int32Array;
}

function armarTabla(filas: { valor: number; a: number; b: number }[]): Tabla {
  filas.sort((x, y) => x.valor - y.valor);
  return {
    valores: Float64Array.from(filas, (f) => f.valor),
    a: Int32Array.from(filas, (f) => f.a),
    b: Int32Array.from(filas, (f) => f.b),
  };
}

const operar = (op: Operacion, x: number, y: number) =>
  op === 'suma' ? x + y : 1 / (1 / x + 1 / y);

function tablas(valores: readonly number[]): Record<'sueltos' | Operacion, Tabla> {
  const pares = (op: Operacion) => {
    const filas = [];
    for (let i = 0; i < valores.length; i++) {
      for (let j = i; j < valores.length; j++) {
        filas.push({ valor: operar(op, valores[i], valores[j]), a: i, b: j });
      }
    }
    return armarTabla(filas);
  };
  return {
    sueltos: armarTabla(valores.map((valor, a) => ({ valor, a, b: -1 }))),
    suma: pares('suma'),
    reciproca: pares('reciproca'),
  };
}

// Una hoja de la forma, en el plan: un componente externo (su posición) o uno de los dos del par Y.
type Ranura = { externo: number } | { y: 0 | 1 };
type NodoPlan = { ranura: Ranura } | { op: Operacion; hijos: NodoPlan[] };
type Funcion = (externos: Float64Array, y: number) => number;

// Una forma escrita como f(externos, Y), con Y un par de una tabla y f creciente en Y.
interface Plan {
  componentes: number;
  tabla: Tabla;
  externos: number;
  // Si los dos externos son hojas del mismo nodo, son intercambiables: basta con i ≤ j.
  hermanos: boolean;
  f: Funcion;
  armar: (externos: Int32Array, tabla: Tabla, fila: number) => Red;
}

// Y son dos hojas del nodo interno más profundo, que solo tiene hojas: con la misma operación del
// nodo forman un par de la tabla, porque S(a, b, c) es S(S(a, b), c). El resto son externos.
function planDe(forma: Forma, t: Record<'sueltos' | Operacion, Tabla>): Plan {
  if (!('op' in forma)) {
    return {
      componentes: 1,
      tabla: t.sueltos,
      externos: 0,
      hermanos: false,
      f: (_, y) => y,
      armar: (_, tabla, fila) => ({ hoja: tabla.a[fila] }),
    };
  }
  let profundo: { nodo: Forma; nivel: number } = { nodo: forma, nivel: 0 };
  const buscar = (nodo: Forma, nivel: number) => {
    if (!('op' in nodo)) return;
    if (nivel > profundo.nivel) profundo = { nodo, nivel };
    for (const h of nodo.hijos) buscar(h, nivel + 1);
  };
  buscar(forma, 0);
  const nodoY = profundo.nodo as Extract<Forma, { op: Operacion }>;

  let externos = 0;
  const padres: Forma[] = [];
  const convertir = (nodo: Forma): NodoPlan => {
    if (!('op' in nodo)) throw new Error('una hoja se convierte desde su padre');
    return {
      op: nodo.op,
      hijos: nodo.hijos.map((h, i): NodoPlan => {
        if ('op' in h) return convertir(h);
        if (nodo === nodoY && i < 2) return { ranura: { y: i as 0 | 1 } };
        padres.push(nodo);
        return { ranura: { externo: externos++ } };
      }),
    };
  };
  const arbol = convertir(forma);

  return {
    componentes: externos + 2,
    tabla: t[nodoY.op],
    externos,
    hermanos: externos === 2 && padres[0] === padres[1],
    f: compilar(arbol),
    armar: (ext, tabla, fila) => {
      const red = (nodo: NodoPlan): Red => {
        if ('op' in nodo) return { op: nodo.op, hijos: nodo.hijos.map(red) };
        const r = nodo.ranura;
        if ('externo' in r) return { hoja: ext[r.externo] };
        return { hoja: r.y === 0 ? tabla.a[fila] : tabla.b[fila] };
      };
      return red(arbol);
    },
  };
}

// El valor de la forma como una función de los externos y de Y. Las dos hojas de Y se reemplazan
// por Y; si eran todo su nodo, el nodo es Y.
function compilar(nodo: NodoPlan): Funcion {
  if (!('op' in nodo)) {
    const r = nodo.ranura;
    if ('externo' in r) {
      const p = r.externo;
      return (e) => e[p];
    }
    throw new Error('Y se compila desde su nodo');
  }
  const conY = nodo.hijos.some((h) => !('op' in h) && 'y' in h.ranura);
  const resto = nodo.hijos.filter((h) => 'op' in h || !('y' in h.ranura)).map(compilar);
  const hijos: Funcion[] = conY ? [(_, y) => y, ...resto] : resto;
  if (hijos.length === 1) return hijos[0];
  if (nodo.op === 'suma') {
    if (hijos.length === 2) {
      const [f0, f1] = hijos;
      return (e, y) => f0(e, y) + f1(e, y);
    }
    return (e, y) => hijos.reduce((s, f) => s + f(e, y), 0);
  }
  if (hijos.length === 2) {
    const [f0, f1] = hijos;
    return (e, y) => 1 / (1 / f0(e, y) + 1 / f1(e, y));
  }
  return (e, y) => 1 / hijos.reduce((s, f) => s + 1 / f(e, y), 0);
}

// Los `cuantos` valores distintos de menor |error| de una cantidad de componentes.
class Mejores {
  readonly lista: Arreglo[] = [];

  constructor(
    private buscado: number,
    private cuantos: number,
  ) {}

  // El |error| que tiene que mejorar un valor para entrar: infinito mientras no esté llena.
  cota(): number {
    return this.lista.length === this.cuantos
      ? Math.abs(this.lista[this.cuantos - 1].error)
      : Infinity;
  }

  // Le ofrece un valor. 'cortar' si ya no puede entrar: como f es monótona, los que siguen hacia
  // ese lado tampoco.
  ofrecer(valor: number, componentes: number, armar: () => Red): 'seguir' | 'cortar' {
    const error = (valor - this.buscado) / this.buscado;
    const llena = this.lista.length === this.cuantos;
    if (llena && Math.abs(error) >= Math.abs(this.lista[this.cuantos - 1].error)) return 'cortar';
    if (this.lista.some((x) => mismoValor(x.valor, valor))) return 'seguir';
    const nuevo = { red: armar(), valor, componentes, error };
    let i = this.lista.length;
    while (i > 0 && Math.abs(this.lista[i - 1].error) > Math.abs(error)) i--;
    this.lista.splice(i, 0, nuevo);
    if (this.lista.length > this.cuantos) this.lista.pop();
    return 'seguir';
  }
}

// Dos Arreglos con valores que difieren en menos de 1e-9 relativo son el mismo (spec §8.4).
const mismoValor = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(a, b);

// Cada forma se resuelve por separado: para cada combinación de externos, una búsqueda binaria
// sobre f(Y) da la posición más cercana al buscado, y desde ahí se avanza hacia los dos lados
// mientras el error pueda entrar entre los mejores de su cantidad de componentes. Costo
// O(N²·log N): a lo sumo N² combinaciones externas por una binaria sobre N(N + 1)/2 pares. Como f
// también crece con cada externo, los externos se recorren de menor a mayor y se cortan cuando ni
// el Y más chico deja a f debajo de lo que todavía puede entrar.
export function buscarArreglos(
  valores: readonly number[],
  buscado: number,
  { umbral, cuantos = ARREGLOS_A_MOSTRAR }: { umbral: number; cuantos?: number },
): Busqueda {
  if (valores.length === 0) return { arreglos: [], evaluadas: 0 };
  const t = tablas(valores);
  // Los externos, de menor a mayor, con su índice en `valores`.
  const orden = valores.map((_, i) => i).sort((a, b) => valores[a] - valores[b]);
  let evaluadas = 0;
  const porCantidad: Mejores[] = [];
  for (let k = 1; k <= MAXIMO_DE_COMPONENTES; k++) {
    const mejores = new Mejores(buscado, cuantos);
    porCantidad.push(mejores);
    for (const forma of formasDeConexion(k)) {
      const plan = planDe(forma, t);
      const { tabla, f } = plan;
      const filas = tabla.valores.length;
      const ext = new Float64Array(plan.externos);
      const indices = new Int32Array(plan.externos);
      const evaluar = (fila: number) => {
        evaluadas++;
        return f(ext, tabla.valores[fila]);
      };
      // 'encima' si ni con el Y más chico f puede entrar: con externos más grandes, tampoco.
      const recorrer = (): 'encima' | undefined => {
        const cota = mejores.cota();
        if (cota !== Infinity) {
          if (evaluar(0) >= buscado * (1 + cota)) return 'encima';
          if (evaluar(filas - 1) <= buscado * (1 - cota)) return undefined;
        }
        let lo = 0;
        let hi = filas;
        while (lo < hi) {
          const medio = (lo + hi) >>> 1;
          if (evaluar(medio) < buscado) lo = medio + 1;
          else hi = medio;
        }
        const armar = (fila: number) => () => plan.armar(indices, tabla, fila);
        for (let fila = lo - 1; fila >= 0; fila--) {
          if (mejores.ofrecer(evaluar(fila), k, armar(fila)) === 'cortar') break;
        }
        for (let fila = lo; fila < filas; fila++) {
          if (mejores.ofrecer(evaluar(fila), k, armar(fila)) === 'cortar') break;
        }
      };
      const n = valores.length;
      if (plan.externos === 0) recorrer();
      for (let i = 0; plan.externos > 0 && i < n; i++) {
        indices[0] = orden[i];
        ext[0] = valores[orden[i]];
        if (plan.externos === 1) {
          if (recorrer() === 'encima') break;
          continue;
        }
        const desde = plan.hermanos ? i : 0;
        for (let j = desde; j < n; j++) {
          indices[1] = orden[j];
          ext[1] = valores[orden[j]];
          if (recorrer() !== 'encima') continue;
          // Con el primer j ya está encima: con un i más grande el primer j también lo estará.
          if (j === desde) i = n;
          break;
        }
      }
    }
  }
  return {
    arreglos: ordenarArreglos(
      porCantidad.flatMap((m) => m.lista),
      umbral,
      cuantos,
    ),
    evaluadas,
  };
}

// La regla de §8.4: de cada valor queda el Arreglo de menos componentes; los que tienen |error|
// debajo del umbral van primero, por cantidad de componentes y después por |error|; los demás
// detrás, por |error|. Con los mejores de cada cantidad alcanza: un Arreglo que no está entre los
// mejores de su cantidad tiene delante a otros tantos que lo superan en las dos partes de la regla.
function ordenarArreglos(
  candidatos: readonly Arreglo[],
  umbral: number,
  cuantos = ARREGLOS_A_MOSTRAR,
): Arreglo[] {
  const porComponentes = [...candidatos].sort(
    (a, b) => a.componentes - b.componentes || Math.abs(a.error) - Math.abs(b.error),
  );
  const unicos: Arreglo[] = [];
  for (const x of porComponentes) {
    if (!unicos.some((u) => mismoValor(u.valor, x.valor))) unicos.push(x);
  }
  const debajo = unicos.filter((x) => Math.abs(x.error) < umbral);
  const resto = unicos
    .filter((x) => Math.abs(x.error) >= umbral)
    .sort((a, b) => Math.abs(a.error) - Math.abs(b.error));
  return [...debajo, ...resto].slice(0, cuantos);
}
