import { MENOS, type Magnitud } from '../../entrada/campos';
import { type Nivel, formatearNumero, formatearValor } from '../../entrada/formato';

// Números y unidades escritos para las fórmulas en Temml (spec §5.4): la coma decimal como `{,}`,
// el menos de LaTeX y la unidad como `\,\mathrm{…}`. Los mismos redondeos que el formato de salida,
// con 4 cifras por defecto porque casi todo número de una fórmula está en los pasos intermedios.

const LATEX_DE: Record<string, string> = { Ω: '\\Omega', µ: '\\mu ' };

function aLatex(texto: string): string {
  return texto.replace(',', '{,}').replace(MENOS, '-');
}

export function numeroLatex(x: number, cifras = 4): string {
  return aLatex(formatearNumero(x, cifras));
}

// Un porcentaje con 2 cifras, como el formato de salida (spec §5.2). Recibe la fracción.
export const porcentajeLatex = (fraccion: number) => `${numeroLatex(fraccion * 100, 2)}\\,\\%`;

// Un error relativo, con signo.
export const errorLatex = (fraccion: number) =>
  `${fraccion > 0 ? '+' : ''}${porcentajeLatex(fraccion)}`;

// Un entero con espacios finos cada tres cifras: 13\,132\,049.
export const enteroLatex = (n: number) =>
  String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,');

export function valorLatex(
  valor: number,
  magnitud: Magnitud,
  nivel: Nivel = 'paso',
  cifras?: number,
): string {
  const texto = formatearValor(valor, magnitud, nivel, cifras);
  const espacio = texto.lastIndexOf(' ');
  if (espacio < 0) return aLatex(texto);
  const unidad = texto
    .slice(espacio + 1)
    .replace(/[Ωµ]/g, (c) => LATEX_DE[c])
    .trimEnd();
  return `${aLatex(texto.slice(0, espacio))}\\,\\mathrm{${unidad}}`;
}
