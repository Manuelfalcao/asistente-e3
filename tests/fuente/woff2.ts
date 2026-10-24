import { brotliDecompressSync } from 'node:zlib';

// Los caracteres que tiene una fuente WOFF2, leídos de su tabla cmap (formatos 4 y 12). Alcanza
// para el test de la fuente recortada: no hace falta reconstruir el resto de las tablas.

const CMAP = 0; // índice de 'cmap' en la lista de tablas conocidas de WOFF2
const GLYF = 10;
const LOCA = 11;
const TAG_EXPLICITO = 63;

function leerBase128(datos: Buffer, pos: number): [number, number] {
  let valor = 0;
  for (let i = 0; i < 5; i++) {
    const byte = datos[pos + i];
    valor = valor * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return [valor, pos + i + 1];
  }
  throw new Error('UIntBase128 de más de 5 bytes');
}

function tablaCmap(woff2: Buffer): Buffer {
  if (woff2.toString('latin1', 0, 4) !== 'wOF2') throw new Error('No es un WOFF2');
  const cantidad = woff2.readUInt16BE(12);
  const comprimido = woff2.readUInt32BE(20);
  let pos = 48;
  let desde = 0;
  let cmap: { desde: number; largo: number } | null = null;
  for (let i = 0; i < cantidad; i++) {
    const banderas = woff2[pos++];
    const indice = banderas & 0x3f;
    const transformacion = banderas >> 6;
    if (indice === TAG_EXPLICITO) pos += 4;
    let largo: number;
    [largo, pos] = leerBase128(woff2, pos);
    // glyf y loca vienen transformadas con la versión 0; las demás, con cualquier otra.
    const transformada =
      indice === GLYF || indice === LOCA ? transformacion === 0 : transformacion !== 0;
    if (transformada) [largo, pos] = leerBase128(woff2, pos);
    if (indice === CMAP) cmap = { desde, largo };
    desde += largo;
  }
  if (!cmap) throw new Error('La fuente no tiene cmap');
  const tablas = brotliDecompressSync(woff2.subarray(pos, pos + comprimido));
  return tablas.subarray(cmap.desde, cmap.desde + cmap.largo);
}

export function caracteresDeLaFuente(woff2: Buffer): Set<number> {
  const cmap = tablaCmap(woff2);
  const caracteres = new Set<number>();
  const subtablas = cmap.readUInt16BE(2);
  for (let i = 0; i < subtablas; i++) {
    const base = cmap.readUInt32BE(4 + 8 * i + 4);
    const formato = cmap.readUInt16BE(base);
    if (formato === 4) leerFormato4(cmap, base, caracteres);
    else if (formato === 12) leerFormato12(cmap, base, caracteres);
  }
  return caracteres;
}

function leerFormato4(cmap: Buffer, base: number, caracteres: Set<number>) {
  const segmentos = cmap.readUInt16BE(base + 6) / 2;
  const fines = base + 14;
  const inicios = fines + 2 * segmentos + 2;
  const deltas = inicios + 2 * segmentos;
  const desplazamientos = deltas + 2 * segmentos;
  for (let s = 0; s < segmentos; s++) {
    const fin = cmap.readUInt16BE(fines + 2 * s);
    const inicio = cmap.readUInt16BE(inicios + 2 * s);
    const delta = cmap.readUInt16BE(deltas + 2 * s);
    const lugar = desplazamientos + 2 * s;
    const desplazamiento = cmap.readUInt16BE(lugar);
    for (let c = inicio; c <= fin && c !== 0xffff; c++) {
      let glifo: number;
      if (desplazamiento === 0) glifo = (c + delta) & 0xffff;
      else {
        glifo = cmap.readUInt16BE(lugar + desplazamiento + 2 * (c - inicio));
        if (glifo !== 0) glifo = (glifo + delta) & 0xffff;
      }
      if (glifo !== 0) caracteres.add(c);
    }
  }
}

function leerFormato12(cmap: Buffer, base: number, caracteres: Set<number>) {
  const grupos = cmap.readUInt32BE(base + 12);
  for (let g = 0; g < grupos; g++) {
    const inicio = cmap.readUInt32BE(base + 16 + 12 * g);
    const fin = cmap.readUInt32BE(base + 16 + 12 * g + 4);
    for (let c = inicio; c <= fin; c++) caracteres.add(c);
  }
}
