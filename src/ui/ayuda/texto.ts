import readme from '../../../README.md?raw';

// La Ayuda es el README, para no escribir lo mismo dos veces: va desde después del título hasta la
// marca, porque lo que sigue es para quien mantiene el Asistente. Se lee con un Markdown acotado:
// tests/ayuda/texto.test.ts falla si el texto usa algo que acá no se entiende.

export const MARCA_FIN = '<!-- fin de la ayuda -->';

export type Bloque =
  | { tipo: 'titulo'; nivel: 2 | 3; texto: string }
  | { tipo: 'parrafo'; texto: string }
  | { tipo: 'lista'; items: string[] };

export type Tramo = { tipo: 'texto' | 'negrita' | 'cursiva' | 'codigo'; texto: string };

export function leerBloques(markdown: string): Bloque[] {
  const bloques: Bloque[] = [];
  let parrafo: string[] = [];
  let lista: string[] = [];

  const cerrar = () => {
    if (parrafo.length > 0) bloques.push({ tipo: 'parrafo', texto: parrafo.join(' ') });
    if (lista.length > 0) bloques.push({ tipo: 'lista', items: lista });
    parrafo = [];
    lista = [];
  };

  for (const crudo of markdown.split(/\r?\n/)) {
    const linea = crudo.trim();
    const titulo = /^(##|###) (.+)$/.exec(linea);
    if (titulo) {
      cerrar();
      bloques.push({ tipo: 'titulo', nivel: titulo[1] === '##' ? 2 : 3, texto: titulo[2] });
    } else if (linea === '') {
      cerrar();
    } else if (linea.startsWith('- ')) {
      if (parrafo.length > 0) cerrar();
      lista.push(linea.slice(2));
    } else if (lista.length > 0) {
      // La continuación de un ítem que siguió en otra línea.
      lista[lista.length - 1] += ` ${linea}`;
    } else {
      parrafo.push(linea);
    }
  }
  cerrar();
  return bloques;
}

export function leerTramos(texto: string): Tramo[] {
  const tramos: Tramo[] = [];
  const marcas = /\*\*(.+?)\*\*|`(.+?)`|\*(.+?)\*/g;
  let desde = 0;
  for (const m of texto.matchAll(marcas)) {
    if (m.index > desde) tramos.push({ tipo: 'texto', texto: texto.slice(desde, m.index) });
    if (m[1] !== undefined) tramos.push({ tipo: 'negrita', texto: m[1] });
    else if (m[2] !== undefined) tramos.push({ tipo: 'codigo', texto: m[2] });
    else tramos.push({ tipo: 'cursiva', texto: m[3] });
    desde = m.index + m[0].length;
  }
  if (desde < texto.length) tramos.push({ tipo: 'texto', texto: texto.slice(desde) });
  return tramos;
}

// El texto de la Ayuda dentro de un README: sin el título, que la ventana tiene el suyo.
export function textoDeAyuda(markdown: string): string {
  const fin = markdown.indexOf(MARCA_FIN);
  const hastaLaMarca = fin === -1 ? markdown : markdown.slice(0, fin);
  return hastaLaMarca.replace(/^# .*$/m, '').trim();
}

export const TEXTO_AYUDA = textoDeAyuda(readme);
export const BLOQUES_AYUDA = leerBloques(TEXTO_AYUDA);
