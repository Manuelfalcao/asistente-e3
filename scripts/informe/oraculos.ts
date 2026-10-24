import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Oraculo } from './html';

// Los oráculos de tests/oraculos/ (spec §13.4), para el apéndice del Informe de casos. Cada archivo
// se describe con su propio comentario de cabecera: el que escribe un oráculo nuevo lo documenta ahí
// y aparece solo.

// Las líneas `//` del principio del archivo, unidas en un párrafo.
function cabecera(texto: string): string {
  const lineas: string[] = [];
  for (const linea of texto.split(/\r?\n/)) {
    if (!linea.startsWith('//')) break;
    lineas.push(linea.replace(/^\/\/ ?/, '').trim());
  }
  return lineas.join(' ').trim();
}

// Las funciones y constantes que exporta; los tipos no.
function exportes(texto: string): string[] {
  const nombres = [...texto.matchAll(/^export (?:async )?(?:function|const) (\w+)/gm)];
  return nombres.map((m) => m[1]);
}

// `carpeta` es el directorio en disco; `prefijo`, cómo se escribe en el informe ("tests/oraculos").
export function leerOraculos(carpeta: string, prefijo: string): Oraculo[] {
  if (!existsSync(carpeta)) return [];
  return readdirSync(carpeta)
    .filter((nombre) => nombre.endsWith('.ts') && !nombre.endsWith('.test.ts'))
    .sort()
    .map((nombre) => {
      const texto = readFileSync(join(carpeta, nombre), 'utf-8');
      return {
        archivo: `${prefijo}/${nombre}`,
        descripcion: cabecera(texto),
        exportes: exportes(texto),
      };
    });
}
