import { describe, expect, it } from 'vitest';
import {
  type Forma,
  buscarArreglos,
  componentesDe,
  formasDeConexion,
  redesPosibles,
  valorDeRed,
} from '../../../src/calculo/comun/arreglos';
import { valoresDeSerie } from '../../../src/calculo/comun/series-e';
import { mejoresArreglos } from '../../oraculos/arreglos';

// La búsqueda común de Arreglos equivalentes (spec §8.3): las formas de conexión sin duplicados y
// el meet-in-the-middle contra el oráculo de fuerza bruta de tests/oraculos/.

// S y P como en research/busqueda-arreglos-equivalentes.md §1: la suma es S, la suma recíproca es P
// (la convención de las resistencias; por dualidad el conjunto de formas es el mismo).
function escribir(forma: Forma, letras = ['a', 'b', 'c', 'd']): string {
  if (!('op' in forma)) return letras.shift()!;
  const hijos = forma.hijos.map((h) => escribir(h, letras));
  return `${forma.op === 'suma' ? 'S' : 'P'}(${hijos.join(',')})`;
}

describe('formas de conexión', () => {
  it('las 10 de 4 componentes son las 5 esencialmente serie de la spec y sus duales', () => {
    const escritas = formasDeConexion(4).map((f) => escribir(f));
    const serie = [
      'S(a,b,c,d)',
      'S(a,b,P(c,d))',
      'S(P(a,b),P(c,d))',
      'S(a,P(b,c,d))',
      'S(a,P(b,S(c,d)))',
    ];
    const dual = (s: string) => s.replace(/[SP]/g, (x) => (x === 'S' ? 'P' : 'S'));
    expect(escritas.sort()).toEqual([...serie, ...serie.map(dual)].sort());
  });

  it('redes distintas con N valores: las de research §2 (E6 y E12 de 1 pF a 10 nF)', () => {
    expect(redesPosibles(25)).toEqual([25, 650, 22100, 910650]);
    expect(redesPosibles(49)).toEqual([49, 2450, 161700, 12967850]);
    expect(redesPosibles(97).reduce((a, b) => a + b)).toBe(97 + 9506 + 1235780 + 195490890);
  });

  it('las de 3 son S(a,b,c), S(a,P(b,c)) y sus duales', () => {
    expect(
      formasDeConexion(3)
        .map((f) => escribir(f))
        .sort(),
    ).toEqual(['P(a,b,c)', 'P(a,S(b,c))', 'S(a,b,c)', 'S(a,P(b,c))'].sort());
  });
});

describe('valor de una red', () => {
  it('suma y suma recíproca: 39 ∥ 8,2 con capacitores es la suma', () => {
    const red = { op: 'suma' as const, hijos: [{ hoja: 0 }, { hoja: 1 }] };
    expect(valorDeRed(red, (i) => [39, 8.2][i])).toBeCloseTo(47.2, 12);
  });

  it('la suma recíproca con un componente en 0 da 0', () => {
    const red = { op: 'reciproca' as const, hijos: [{ hoja: 0 }, { hoja: 1 }] };
    expect(valorDeRed(red, (i) => [0, 10][i])).toBe(0);
    expect(valorDeRed(red, () => 10)).toBeCloseTo(5, 12);
  });
});

describe('meet-in-the-middle contra la fuerza bruta', () => {
  const comparar = (valores: number[], buscado: number, umbral: number) => {
    const { arreglos } = buscarArreglos(valores, buscado, { umbral });
    const esperado = mejoresArreglos(valores, buscado, umbral);
    expect(arreglos.map((a) => a.componentes)).toEqual(esperado.map((a) => a.componentes));
    arreglos.forEach((a, i) => {
      expect(Math.abs(a.valor / esperado[i].valor - 1)).toBeLessThan(1e-9);
      expect(Math.abs(a.error - esperado[i].error)).toBeLessThan(1e-9);
      // el valor sale de la red que se muestra
      expect(Math.abs(valorDeRed(a.red, (h) => valores[h]) / a.valor - 1)).toBeLessThan(1e-12);
      expect(a.componentes).toBe(componentesDe(a.red));
    });
  };

  it('E6 de 1 pF a 10 nF, varios valores buscados y umbrales', () => {
    const valores = valoresDeSerie('E6', 1e-12, 10e-9);
    for (const buscado of [0.43e-12, 2.9e-12, 37.3e-12, 50e-12, 123.4e-12, 7.77e-9, 60e-9]) {
      for (const umbral of [0.01, 0.001, 0]) comparar(valores, buscado, umbral);
    }
  });

  it('un Inventario corto y con valores fuera de la serie', () => {
    comparar([0.5e-12, 4.3e-12, 10e-12, 33e-12], 17e-12, 0.01);
    comparar([47], 100, 0.01);
  });

  it('cuenta las combinaciones que evaluó, muchas menos que las redes posibles', () => {
    const valores = valoresDeSerie('E12', 1e-12, 10e-9);
    const { evaluadas } = buscarArreglos(valores, 37.3e-12, { umbral: 0.01 });
    expect(evaluadas).toBeGreaterThan(1000);
    expect(evaluadas).toBeLessThan(13132049 / 10);
  });
});
