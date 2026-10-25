import type { Referencia } from './resultado';

// La cita de una lista de referencias, en trozos: el título de cada obra va aparte para que la
// interfaz y el Informe de casos lo pongan en cursiva. Otra edición de la misma obra se suma con
// "junto con la …". Un artículo se cita con su autor, la revista y su volumen, sin edición.
export interface ParteCita {
  obra: string | null;
  texto: string;
}

const otraEdicion = (a: Referencia, b: Referencia | undefined) =>
  b !== undefined && a.obra === b.obra && !!a.edicion && !!b.edicion && a.edicion !== b.edicion;

export function citar(referencias: readonly Referencia[]): ParteCita[] {
  return referencias.flatMap((r, i) => {
    const siguiente = referencias[i + 1];
    const fin = !siguiente ? '.' : otraEdicion(r, siguiente) ? ',' : '; ';
    if (i > 0 && otraEdicion(referencias[i - 1], r)) {
      return [
        { obra: null, texto: ` junto con la ${r.edicion} ed. (${r.anio}), ${r.ubicacion}${fin}` },
      ];
    }
    const autor: ParteCita[] = r.autor ? [{ obra: null, texto: `${r.autor}, ` }] : [];
    const editor = r.editor ? `${r.editor}, ` : '';
    const texto = r.edicion
      ? `, ${r.edicion} ed. (${editor}${r.anio}), ${r.ubicacion}${fin}`
      : `${r.volumen ? ` ${r.volumen}` : ''}, ${editor}${r.anio}, ${r.ubicacion}${fin}`;
    return [...autor, { obra: r.obra, texto }];
  });
}
