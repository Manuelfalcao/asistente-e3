import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { leerOraculos } from '../../scripts/informe/oraculos';

// El apéndice del Informe de casos describe cada oráculo de tests/oraculos/ (spec §13.4) con lo que
// el propio archivo dice de sí mismo: su comentario de cabecera y sus funciones.

let carpeta: string;
beforeEach(() => {
  carpeta = mkdtempSync(join(tmpdir(), 'oraculos-'));
});
afterEach(() => {
  rmSync(carpeta, { recursive: true, force: true });
});

const escribir = (nombre: string, texto: string) => writeFileSync(join(carpeta, nombre), texto);

describe('leer los oráculos', () => {
  it('toma el comentario de cabecera como descripción y las funciones exportadas', () => {
    escribir(
      'abcd.ts',
      [
        '// Oráculo ABCD con números complejos (spec §13.4).',
        '// Se escribe aparte y no importa nada de src/.',
        '',
        'export interface Complejo { re: number }',
        'export const c = (re: number) => re;',
        'export function cascada(x: number) { return x; }',
        'function interna() {}',
      ].join('\n'),
    );
    expect(leerOraculos(carpeta, 'tests/oraculos')).toEqual([
      {
        archivo: 'tests/oraculos/abcd.ts',
        descripcion:
          'Oráculo ABCD con números complejos (spec §13.4). Se escribe aparte y no importa nada de src/.',
        exportes: ['c', 'cascada'],
      },
    ]);
  });

  it('cada archivo nuevo aparece solo, en orden alfabético, sin contar los tests', () => {
    escribir('suma-de-anillos.ts', '// Suma de anillos.\nexport const f = 1;');
    escribir('abcd.ts', '// ABCD.\nexport const g = 1;');
    escribir('abcd.test.ts', "import { g } from './abcd';");
    expect(leerOraculos(carpeta, 'tests/oraculos').map((o) => o.archivo)).toEqual([
      'tests/oraculos/abcd.ts',
      'tests/oraculos/suma-de-anillos.ts',
    ]);
  });

  it('un oráculo sin comentario de cabecera tiene la descripción vacía, para que se note', () => {
    escribir('fuerza-bruta.ts', 'export const f = 1;');
    expect(leerOraculos(carpeta, 'tests/oraculos')[0].descripcion).toBe('');
  });

  it('una carpeta que no existe no tiene oráculos', () => {
    mkdirSync(join(carpeta, 'vacia'));
    expect(leerOraculos(join(carpeta, 'vacia'), 'x')).toEqual([]);
    expect(leerOraculos(join(carpeta, 'no-existe'), 'x')).toEqual([]);
  });
});
