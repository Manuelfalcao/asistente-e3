import { readFileSync } from 'node:fs';
import temml from 'temml';
import { describe, expect, it } from 'vitest';
import { calcularAtenuadores } from '../../src/calculo/atenuadores/atenuadores';
import { caracteresDeLaFuente } from './woff2';

// Si una fórmula usa un carácter que la fuente recortada no tiene, el navegador lo dibuja con otra
// fuente sin avisar (spec §5.4). Este test lo atrapa: si falla, sumá el carácter a
// scripts/fuentes/rangos.txt y corré `npm run fuente`.

const FUENTE = new URL('../../src/ui/fuentes/latinmodern-math-recorte.woff2', import.meta.url);

// Todas las cadenas LaTeX que arma cada Calculadora, con entradas que pasan por todas sus ramas.
function formulasDeAtenuadores(): string[] {
  const formulas: string[] = [];
  for (const [atenuacion, z1, z2] of [
    [10, 50, 50],
    [0.3, 50, 50],
    [45, 50, 75],
    [20, 300, 50],
    [5, 50, 75],
  ]) {
    const r = calcularAtenuadores({ atenuacion, z1, z2 });
    if (r.estado === 'corte') formulas.push(...r.pasos.map((p) => p.latex));
    else {
      for (const red of [r.t, r.pi])
        formulas.push(...red.formulas, ...red.pasos.map((p) => p.latex));
    }
  }
  return formulas;
}

// Un <mi> de una sola letra sin mathvariant sale en itálica: el navegador lo pasa a las letras
// itálicas de matemática (text-transform: math-auto de MathML Core), y esas son las que pide.
function italica(c: number): number {
  if (c === 0x68) return 0x210e; // h
  if (c >= 0x41 && c <= 0x5a) return 0x1d434 + c - 0x41;
  if (c >= 0x61 && c <= 0x7a) return 0x1d44e + c - 0x61;
  if (c >= 0x391 && c <= 0x3a9) return 0x1d6e2 + c - 0x391;
  if (c >= 0x3b1 && c <= 0x3c9) return 0x1d6fc + c - 0x3b1;
  return c;
}

function decodificar(texto: string): string {
  return texto
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

// Los caracteres que el navegador va a buscar en la fuente para dibujar este MathML.
function caracteresDelMathml(mathml: string): Set<number> {
  const caracteres = new Set<number>();
  for (const [, etiqueta, atributos, contenido] of mathml.matchAll(
    /<(mi|mn|mo|mtext|ms)(\s[^>]*)?>([^<]*)<\/\1>/g,
  )) {
    const texto = [...decodificar(contenido).trim()];
    const auto = etiqueta === 'mi' && texto.length === 1 && !/mathvariant/.test(atributos ?? '');
    for (const c of texto) {
      const cp = c.codePointAt(0)!;
      caracteres.add(auto ? italica(cp) : cp);
    }
  }
  return caracteres;
}

describe('fuente recortada de las fórmulas', () => {
  const enLaFuente = caracteresDeLaFuente(readFileSync(FUENTE));

  it('se lee la tabla de caracteres', () => {
    expect(enLaFuente.has(0x30)).toBe(true); // 0
    expect(enLaFuente.has(0x1d445)).toBe(true); // R itálica
    expect(enLaFuente.has(0x4e00)).toBe(false); // 一
  });

  it('el lector de MathML ve la itálica automática', () => {
    const mathml = temml.renderToString('R_3 = 2\\,\\mathrm{k\\Omega}');
    expect([...caracteresDelMathml(mathml)].sort((a, b) => a - b)).toEqual(
      [0x32, 0x33, 0x3d, 0x6b, 0x3a9, 0x1d445].sort((a, b) => a - b),
    );
  });

  it('tiene cada carácter de las fórmulas de atenuadores', () => {
    const faltan = new Set<string>();
    for (const latex of formulasDeAtenuadores()) {
      for (const c of caracteresDelMathml(temml.renderToString(latex, { wrap: 'tex' }))) {
        if (!enLaFuente.has(c)) faltan.add(`U+${c.toString(16).toUpperCase().padStart(4, '0')}`);
      }
    }
    expect([...faltan]).toEqual([]);
  });
});
