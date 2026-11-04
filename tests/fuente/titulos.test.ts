import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatearValor } from '../../src/entrada/formato';
import { BLOQUES_AYUDA } from '../../src/ui/ayuda/texto';
import { CALCULADORAS } from '../../src/ui/calculadoras';
import { caracteresDeLaFuente } from './woff2';

// Una letra que la fuente de los títulos no tiene saldría en otra fuente, sin avisar. Si este test
// falla, sumá el carácter a scripts/fuentes/rangos-titulos.txt y corré `npm run fuente`.

const FUENTE = new URL('../../src/ui/fuentes/titulos-recorte.woff2', import.meta.url);

const MAGNITUDES = ['inductancia', 'capacidad', 'resistencia', 'frecuencia', 'decibeles'] as const;
const VALORES = [1e-12, 4.7e-9, 2.2e-6, 1e-3, 50, 4700, 1e6, 145e6, 2.4e9];

// Los títulos arman su texto con el nombre de la Calculadora, palabras en castellano, valores
// formateados y la topología de la red.
const TEXTOS = [
  'Asistente E3',
  ...CALCULADORAS.map((c) => c.nombre),
  'ABCDEFGHIJKLMNÑOPQRSTUVWXYZÁÉÍÓÚÜ',
  'abcdefghijklmnñopqrstuvwxyzáéíóúü',
  '0123456789 ,.:;()/+-%=·',
  'Red π de 50 Ω a 300 Ω en 145 MHz',
  ...MAGNITUDES.flatMap((m) => VALORES.map((v) => formatearValor(v, m))),
  ...BLOQUES_AYUDA.flatMap((b) => (b.tipo === 'titulo' ? [b.texto] : [])),
];

describe('fuente de los títulos', () => {
  it('tiene todos los caracteres que puede llevar un título', () => {
    const enLaFuente = caracteresDeLaFuente(readFileSync(FUENTE));
    const usados = new Set(TEXTOS.join('').replace(/\s/g, ' '));
    const faltan = [...usados].filter((c) => !enLaFuente.has(c.codePointAt(0)!));
    expect(faltan).toEqual([]);
  });

  it('es un solo peso recortado, no la fuente entera', () => {
    expect(readFileSync(FUENTE).length).toBeLessThan(20 * 1024);
  });
});
