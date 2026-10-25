import { describe, expect, it } from 'vitest';
import {
  contarRedes,
  mejoresArreglos,
  mejoresArreglosGuardandoTodo,
  recorrerRedes,
} from './arreglos';

// El oráculo de fuerza bruta contra lo que se sabe sin él: los conteos de redes de research/
// busqueda-arreglos-equivalentes.md §2 (fórmula cerrada y transformada de Euler) y redes armadas a
// mano. Los valores se escriben acá, sin la tabla de series de src/.

const E6 = [1.0, 1.5, 2.2, 3.3, 4.7, 6.8];
const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
// Las décadas de 1 a 1000 y el 10000 final: 1 pF a 10 nF, en pF.
const cuatroDecadas = (serie: number[]) => [
  ...[1, 10, 100, 1000].flatMap((d) => serie.map((m) => Number((m * d).toPrecision(4)))),
  10000,
];

describe('oráculo de fuerza bruta de Arreglos equivalentes', () => {
  it('con un solo valor hay 1, 2, 4 y 10 redes: las formas de OEIS A000084', () => {
    expect(contarRedes([1])).toEqual([1, 2, 4, 10]);
  });

  it('con 4 valores distintos hay 52 redes de 4 componentes que los usan a todos (OEIS A006351)', () => {
    // Con valores "genéricos" cada red da un valor distinto: se cuentan las de 4 componentes sin
    // repetir ningún valor, por los factores primos de un producto.
    const primos = [2, 3, 5, 7];
    const valores = primos.map((p) => Math.log(p));
    const vistos = new Set<string>();
    let conTodos = 0;
    // Una red usa los 4 valores si su valor cambia al mover cualquiera de ellos: se marca cada valor
    // con un desplazamiento distinto y se cuentan las redes cuyo valor depende de los 4.
    const base: number[] = [];
    recorrerRedes(valores, (v, k) => {
      if (k === 4) base.push(v);
    });
    const movidas = primos.map((_, i) => {
      const otros = valores.map((v, j) => (j === i ? v * 1.001 : v));
      const lista: number[] = [];
      recorrerRedes(otros, (v, k) => {
        if (k === 4) lista.push(v);
      });
      return lista;
    });
    base.forEach((v, r) => {
      if (movidas.every((m) => m[r] !== v)) {
        conTodos++;
        vistos.add(v.toPrecision(12));
      }
    });
    expect(conTodos).toBe(52);
    expect(vistos.size).toBe(52);
  });

  it('E6 de 1 pF a 10 nF (N = 25): 25, 650, 22 100 y 910 650 redes', () => {
    expect(contarRedes(cuatroDecadas(E6))).toEqual([25, 650, 22100, 910650]);
  });

  it('E12 de 1 pF a 10 nF (N = 49): 13 132 049 redes en total', () => {
    const cuenta = contarRedes(cuatroDecadas(E12));
    expect(cuenta).toEqual([49, 2450, 161700, 12967850]);
    expect(cuenta.reduce((a, b) => a + b)).toBe(13132049);
  });

  it('dos de 10 en serie y en paralelo dan 5 y 20; tres en paralelo, 30', () => {
    const valores: number[][] = [[], [], [], []];
    recorrerRedes([10], (v, k) => valores[k - 1].push(v));
    expect(valores[1].sort((a, b) => a - b)).toEqual([5, 20]);
    expect(valores[2]).toContain(30);
    expect(valores[2]).toContain(10 / 3);
  });

  it(
    'guardar solo lo que puede entrar da lo mismo que guardar todas las redes',
    { timeout: 60000 },
    () => {
      // E6 de 1 a 100 pF (13 valores) y E12 de 1 a 100 pF (25 valores, unas 930 000 redes).
      for (const [serie, buscados] of [
        [E6, [0.37, 3.73, 7.1, 13, 47, 61.7, 250]],
        [E12, [0.37, 13, 61.7]],
      ] as const) {
        const valores = cuatroDecadas([...serie]).filter((v) => v <= 100);
        for (const buscado of buscados) {
          for (const umbral of [0.01, 1e-4, 0]) {
            const donde = `${buscado} con ${umbral}`;
            const a = mejoresArreglos(valores, buscado, umbral);
            const b = mejoresArreglosGuardandoTodo(valores, buscado, umbral);
            // Los de igual valor pueden diferir en el último bit según cuál quedó en el grupo.
            expect(
              a.map((x) => x.componentes),
              donde,
            ).toEqual(b.map((x) => x.componentes));
            a.forEach((x, i) =>
              expect(Math.abs(x.valor / b[i].valor - 1), donde).toBeLessThan(1e-9),
            );
          }
        }
      }
    },
  );
});
