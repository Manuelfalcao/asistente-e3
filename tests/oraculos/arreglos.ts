// Oráculo de fuerza bruta de Arreglos equivalentes (spec §8.3 y §13.4): recorre una por una todas
// las redes serie-paralelo distintas de hasta 4 componentes con lazos canónicos (índices no
// decrecientes entre componentes intercambiables), las 1 + 2 + 4 + 10 formas de research/
// busqueda-arreglos-equivalentes.md §1, y ordena con la regla de §8.4. Es la segunda vía con la que
// se verifica el meet-in-the-middle de la Calculadora. No importa nada de src/: recibe los valores ya
// en una lista y escribe a mano las dos operaciones, suma y suma recíproca (a·b/(a + b)).

type Operacion = (a: number, b: number) => number;

const suma: Operacion = (a, b) => a + b;
const reciproca: Operacion = (a, b) => (a * b) / (a + b);

// Llama a `visitar` una vez por cada red distinta, con su valor y su cantidad de componentes.
export function recorrerRedes(
  valores: readonly number[],
  visitar: (valor: number, componentes: number) => void,
): void {
  const n = valores.length;
  for (const v of valores) visitar(v, 1);
  for (const [A, B] of [
    [suma, reciproca],
    [reciproca, suma],
  ]) {
    // Los pares B(c, d), para la forma A(B(a, b), B(c, d)).
    const paresB: number[] = [];
    for (let i = 0; i < n; i++) for (let j = i; j < n; j++) paresB.push(B(valores[i], valores[j]));

    for (let i = 0; i < n; i++) {
      const a = valores[i];
      for (let j = i; j < n; j++) {
        const b = valores[j];
        const ab = A(a, b);
        // A(a, b)
        visitar(ab, 2);
        for (let k = j; k < n; k++) {
          const abc = A(ab, valores[k]);
          // A(a, b, c)
          visitar(abc, 3);
          // A(a, b, c, d)
          for (let l = k; l < n; l++) visitar(A(abc, valores[l]), 4);
        }
        // A(a, b, B(c, d))
        for (let k = 0; k < n; k++) {
          for (let l = k; l < n; l++) visitar(A(ab, B(valores[k], valores[l])), 4);
        }
      }
    }
    // A(B(a, b), B(c, d)), con el par (a, b) antes o igual que el (c, d)
    for (let p = 0; p < paresB.length; p++) {
      for (let q = p; q < paresB.length; q++) visitar(A(paresB[p], paresB[q]), 4);
    }
    for (let i = 0; i < n; i++) {
      const a = valores[i];
      for (let j = 0; j < n; j++) {
        for (let k = j; k < n; k++) {
          const bc = B(valores[j], valores[k]);
          // A(a, B(b, c))
          visitar(A(a, bc), 3);
          // A(a, B(b, c, d))
          for (let l = k; l < n; l++) visitar(A(a, B(bc, valores[l])), 4);
        }
        // A(a, B(b, A(c, d)))
        for (let k = 0; k < n; k++) {
          for (let l = k; l < n; l++) {
            visitar(A(a, B(valores[j], A(valores[k], valores[l]))), 4);
          }
        }
      }
    }
  }
}

// Cuántas redes distintas hay de 1, 2, 3 y 4 componentes.
export function contarRedes(valores: readonly number[]): number[] {
  const cuenta = [0, 0, 0, 0];
  recorrerRedes(valores, (_, componentes) => cuenta[componentes - 1]++);
  return cuenta;
}

export interface ArregloOraculo {
  valor: number;
  componentes: number;
  // Fracción con signo: (valor − buscado)/buscado.
  error: number;
}

// Dos valores son el mismo Arreglo si difieren en menos de 1e-9 relativo (redondeo).
const mismoValor = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(a, b);

// La regla de §8.4: de cada valor queda el de menos componentes; los que tienen |error| debajo del
// umbral van primero, por componentes y después por |error|; los demás detrás, por |error|.
function ordenar(arreglos: ArregloOraculo[], umbral: number, cuantos: number): ArregloOraculo[] {
  // Por valor: los iguales quedan juntos, y de cada grupo queda el de menos componentes.
  const porValor = [...arreglos].sort((a, b) => a.valor - b.valor);
  const unicos: ArregloOraculo[] = [];
  for (const x of porValor) {
    const ultimo = unicos[unicos.length - 1];
    if (!ultimo || !mismoValor(ultimo.valor, x.valor)) unicos.push(x);
    else if (x.componentes < ultimo.componentes) unicos[unicos.length - 1] = x;
  }
  unicos.sort((a, b) => a.componentes - b.componentes || Math.abs(a.error) - Math.abs(b.error));
  const debajo = unicos.filter((x) => Math.abs(x.error) < umbral);
  const resto = unicos
    .filter((x) => Math.abs(x.error) >= umbral)
    .sort((a, b) => Math.abs(a.error) - Math.abs(b.error));
  return [...debajo, ...resto].slice(0, cuantos);
}

// Los mejores Arreglos con la regla de §8.4, sin guardar millones de redes y sin suponer nada más:
// guarda todas las redes con |error| debajo del umbral, porque con la regla de §8.4 cualquiera de
// ellas puede quedar adelante, y de las demás los `cuantos` valores distintos de menor |error|, cada
// uno con su menor cantidad de componentes, que es lo único que pueden aportar detrás.
export function mejoresArreglos(
  valores: readonly number[],
  buscado: number,
  umbral: number,
  cuantos = 10,
): ArregloOraculo[] {
  const debajo: ArregloOraculo[] = [];
  // Ordenados por |error|, sin valores repetidos.
  const arriba: ArregloOraculo[] = [];
  recorrerRedes(valores, (valor, componentes) => {
    const error = (valor - buscado) / buscado;
    if (Math.abs(error) < umbral) {
      debajo.push({ valor, componentes, error });
      return;
    }
    const llena = arriba.length === cuantos;
    // Un valor que ya está tiene el mismo |error|, así que nunca supera al peor.
    if (llena && Math.abs(error) > Math.abs(arriba[cuantos - 1].error)) return;
    const igual = arriba.find((x) => mismoValor(x.valor, valor));
    if (igual) {
      igual.componentes = Math.min(igual.componentes, componentes);
      return;
    }
    if (llena && Math.abs(error) === Math.abs(arriba[cuantos - 1].error)) return;
    arriba.push({ valor, componentes, error });
    arriba.sort((a, b) => Math.abs(a.error) - Math.abs(b.error));
    if (arriba.length > cuantos) arriba.pop();
  });
  return ordenar([...debajo, ...arriba], umbral, cuantos);
}

// Lo mismo guardando todas las redes: solo para Inventarios chicos.
export function mejoresArreglosGuardandoTodo(
  valores: readonly number[],
  buscado: number,
  umbral: number,
  cuantos = 10,
): ArregloOraculo[] {
  const todas: ArregloOraculo[] = [];
  recorrerRedes(valores, (valor, componentes) =>
    todas.push({ valor, componentes, error: (valor - buscado) / buscado }),
  );
  return ordenar(todas, umbral, cuantos);
}
