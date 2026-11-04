import { describe, expect, it } from 'vitest';
import readme from '../../README.md?raw';
import { CALCULADORAS } from '../../src/ui/calculadoras';
import {
  BLOQUES_AYUDA,
  MARCA_FIN,
  TEXTO_AYUDA,
  leerBloques,
  leerTramos,
  textoDeAyuda,
} from '../../src/ui/ayuda/texto';

describe('el Markdown de la Ayuda', () => {
  it('lee títulos, párrafos y listas', () => {
    const md = ['## Uno', '', 'Un párrafo', 'en dos líneas.', '', '### Dos', '- a', '- b'].join(
      '\n',
    );
    expect(leerBloques(md)).toEqual([
      { tipo: 'titulo', nivel: 2, texto: 'Uno' },
      { tipo: 'parrafo', texto: 'Un párrafo en dos líneas.' },
      { tipo: 'titulo', nivel: 3, texto: 'Dos' },
      { tipo: 'lista', items: ['a', 'b'] },
    ]);
  });

  it('entiende finales de línea de Windows', () => {
    expect(leerBloques('## Uno\r\n\r\nDos\r\n')).toEqual([
      { tipo: 'titulo', nivel: 2, texto: 'Uno' },
      { tipo: 'parrafo', texto: 'Dos' },
    ]);
  });

  it('une al ítem de la lista la línea que lo continúa', () => {
    expect(leerBloques('- uno\n  sigue\n- dos')).toEqual([
      { tipo: 'lista', items: ['uno sigue', 'dos'] },
    ]);
  });

  it('separa la negrita, la cursiva y el código del texto', () => {
    expect(leerTramos('a **b** c *d* e `f`')).toEqual([
      { tipo: 'texto', texto: 'a ' },
      { tipo: 'negrita', texto: 'b' },
      { tipo: 'texto', texto: ' c ' },
      { tipo: 'cursiva', texto: 'd' },
      { tipo: 'texto', texto: ' e ' },
      { tipo: 'codigo', texto: 'f' },
    ]);
  });

  it('corta en la marca y saca el título', () => {
    expect(textoDeAyuda(`# Título\n\nSe ve.\n\n${MARCA_FIN}\n\nNo se ve.`)).toBe('Se ve.');
  });
});

describe('el README como Ayuda', () => {
  it('tiene la marca, y lo que sigue a ella no llega a la Ayuda', () => {
    expect(readme).toContain(MARCA_FIN);
    expect(TEXTO_AYUDA).not.toContain('Para quien mantiene');
    expect(TEXTO_AYUDA).not.toContain('npm run');
  });

  it('explica cada Calculadora', () => {
    const titulos = BLOQUES_AYUDA.filter((b) => b.tipo === 'titulo').map((b) => b.texto);
    for (const c of CALCULADORAS) expect(titulos).toContain(c.nombreCorto);
  });

  // Lo que el lector de la Ayuda no entiende llegaría al Alumno como texto crudo.
  it('no usa Markdown que la Ayuda no sabe mostrar', () => {
    const lineas = TEXTO_AYUDA.split(/\r?\n/);
    const raras = lineas.filter(
      (l) =>
        /^\s*\|/.test(l) || // tablas
        /^\s*\d+\. /.test(l) || // listas numeradas
        /^\s*>/.test(l) || // citas
        /^\s*```/.test(l) || // bloques de código
        /^\s+- /.test(l) || // listas anidadas
        /^#{1}\s|^#{4,}\s/.test(l) || // títulos de otros niveles
        /\[[^\]]*\]\([^)]*\)/.test(l) || // links
        /<!--/.test(l), // comentarios
    );
    expect(raras).toEqual([]);
  });

  it('no deja marcas de formato sin leer', () => {
    const textos = BLOQUES_AYUDA.flatMap((b) =>
      b.tipo === 'lista' ? b.items : b.tipo === 'parrafo' ? [b.texto] : [],
    );
    const sobrantes = textos.filter((t) =>
      leerTramos(t).some((tramo) => tramo.tipo === 'texto' && /[*`]/.test(tramo.texto)),
    );
    expect(sobrantes).toEqual([]);
  });
});
