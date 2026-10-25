import { readFileSync } from 'node:fs';
import temml from 'temml';
import { describe, expect, it } from 'vitest';
import { calcularArreglos } from '../../src/calculo/arreglos/arreglos';
import {
  calcularAtenuadores,
  calcularMinimaPerdida,
} from '../../src/calculo/atenuadores/atenuadores';
import { DEDUCCION_DIAMETRO_RF, calcularBobinas } from '../../src/calculo/bobinas/bobinas';
import {
  DEDUCCION_DOS_CAPAS,
  dosCapasConPasos,
  rosaGrover91ConPasos,
} from '../../src/calculo/bobinas/dos-capas';
import { revisarValores } from '../../src/calculo/comun/valor-impracticable';
import { calcularRedL } from '../../src/calculo/redes/redes';
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
    // Con potencia, para que entren las fórmulas de la disipación y de la nominal mínima.
    const r = calcularAtenuadores({ atenuacion, z1, z2, potencia: 0.75 });
    if (r.estado === 'corte') formulas.push(...r.pasos.map((p) => p.latex));
    else {
      for (const red of [r.t, r.pi])
        formulas.push(...red.formulas, ...red.pasos.map((p) => p.latex));
    }
  }
  // El pad de mínima pérdida, con la serie de cada lado.
  for (const [z1, z2] of [
    [50, 75],
    [300, 50],
  ]) {
    const r = calcularMinimaPerdida({ z1, z2, potencia: 0.75 });
    if (r.estado === 'calculado') {
      formulas.push(...r.pad.formulas, ...r.pad.pasos.map((p) => p.latex));
    }
  }
  return formulas;
}

// Bobinas de una y dos capas: las dos ramas de Lundin, vueltas juntas y separadas, con frecuencia
// de trabajo, los dos lados de las dos banderas de plan B, el corte de menos de una vuelta y dos
// capas fuera del rango (sus pasos con n fijo dicen "fuera del rango").
function formulasDeBobinas(): string[] {
  const formulas: string[] = [];
  for (const [l, carrete, cable, separacion, frecuencia] of [
    [100e-9, 5e-3, 0.8e-3, 0, null],
    [1e-6, 6e-3, 0.5e-3, 0, 145e6],
    [100e-9, 6e-3, 1e-3, 1e-3, 50e6],
    [5e-9, 5e-3, 0.8e-3, 0, null],
    [4.7e-6, 8e-3, 0.4e-3, 0, 50e6],
    [2e-6, 10e-3, 0.4e-3, 0.2e-3, null],
  ] as const) {
    for (const planB of [false, true]) {
      const r = calcularBobinas(
        { inductancia: l, carrete, cable, separacion, frecuencia },
        { planB, planBDosCapas: planB },
      );
      if (r.estado === 'corte') formulas.push(...r.pasos.map((p) => p.latex));
      else {
        formulas.push(...r.unaCapa.formulas, ...r.unaCapa.pasos.map((p) => p.latex));
        if (r.dosCapas.estado === 'calculado') {
          formulas.push(...r.dosCapas.formulas, ...r.dosCapas.pasos.map((p) => p.latex));
        }
      }
    }
  }
  const fueraDeRango = { carrete: 4e-3, cable: 0.5e-3, separacion: 0 };
  formulas.push(...dosCapasConPasos(fueraDeRango, 1, 'maxwell').pasos.map((p) => p.latex));
  formulas.push(...rosaGrover91ConPasos(0.1, 0.1, 0.01, 1000).pasos.map((p) => p.latex));
  formulas.push(...DEDUCCION_DIAMETRO_RF.deduccion!.map((p) => p.latex));
  formulas.push(...DEDUCCION_DOS_CAPAS.deduccion!.map((p) => p.latex));
  return formulas;
}

// Arreglos equivalentes: capacitores con tolerancia relativa y absoluta (debajo de 10 pF), C mínima,
// resistencias y Arreglos de 1 a 4 componentes.
function formulasDeArreglos(): string[] {
  const formulas: string[] = [];
  const base = {
    serie: 'E12',
    umbral: 0.01,
    tolerancia: 0.05,
    toleranciaChicos: 0.25e-12,
  } as const;
  for (const [componente, buscado, umbral] of [
    ['capacitor', 47e-12, 0.01],
    ['capacitor', 2e-12, 0.01],
    ['capacitor', 37.3e-12, 0],
    ['resistencia', 66.9, 0.01],
  ] as const) {
    const r = calcularArreglos({ ...base, componente, buscado, umbral });
    formulas.push(...r.formulas, ...r.pasos.map((p) => p.latex));
    for (const f of r.filas) formulas.push(...f.pasos.map((p) => p.latex));
  }
  return formulas;
}

// Redes de adaptación: la red L con R_s menor y mayor que R_L (las dos fórmulas de Zin), con y sin
// borde inferior y con valores marcados.
function formulasDeRedes(): string[] {
  const formulas: string[] = [];
  for (const [rs, rl, f0] of [
    [100, 1000, 100e6],
    [200, 50, 145e6],
    [5, 50, 300e6],
  ]) {
    const r = calcularRedL({ f0, rs, rl, qBobina: 100 });
    if (r.estado !== 'calculado') continue;
    formulas.push(r.formula, ...r.pasos.map((p) => p.latex));
    for (const v of r.variantes) formulas.push(...v.formulas, ...v.pasos.map((p) => p.latex));
  }
  return formulas;
}

// Las cuentas del criterio de valor impracticable, con un valor por cada rama.
function formulasDelCriterio(): string[] {
  const resultado = {
    l: { componente: 'L', nombre: 'L1', valor: 5e-9 },
    c: { componente: 'C', nombre: 'C1', valor: 2e-12 },
    cSrf: { componente: 'C', nombre: 'C2', valor: 100e-12 },
    cInductiva: { componente: 'C', nombre: 'C3', valor: 1e-9 },
    rChica: { componente: 'R', nombre: 'R1', valor: 1 },
    rGrande: { componente: 'R', nombre: 'R2', valor: 10e3 },
  };
  return revisarValores(resultado, 300e6).pasos.map((p) => p.latex);
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

  // Los caracteres de las fórmulas que no están en la fuente, como "U+2113".
  const faltantes = (formulas: readonly string[]) => {
    const faltan = new Set<string>();
    for (const latex of formulas) {
      for (const c of caracteresDelMathml(temml.renderToString(latex, { wrap: 'tex' }))) {
        if (!enLaFuente.has(c)) faltan.add(`U+${c.toString(16).toUpperCase().padStart(4, '0')}`);
      }
    }
    return [...faltan];
  };

  it('tiene cada carácter de las fórmulas de atenuadores', () => {
    expect(faltantes(formulasDeAtenuadores())).toEqual([]);
  });

  it('tiene cada carácter de las fórmulas de bobinas', () => {
    const formulas = formulasDeBobinas();
    expect(formulas.length).toBeGreaterThan(50);
    expect(faltantes(formulas)).toEqual([]);
  });

  it('tiene cada carácter de las fórmulas de redes de adaptación', () => {
    const formulas = formulasDeRedes();
    expect(formulas.length).toBeGreaterThan(50);
    expect(faltantes(formulas)).toEqual([]);
  });

  it('tiene cada carácter de las fórmulas de Arreglos equivalentes', () => {
    const formulas = formulasDeArreglos();
    expect(formulas.length).toBeGreaterThan(50);
    expect(faltantes(formulas)).toEqual([]);
  });

  it('tiene cada carácter de las cuentas del criterio de valor impracticable', () => {
    const formulas = formulasDelCriterio();
    expect(formulas.length).toBeGreaterThanOrEqual(6);
    expect(faltantes(formulas)).toEqual([]);
  });
});
