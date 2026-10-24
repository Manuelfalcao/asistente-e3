import type { Referencia } from './resultado';

// La cita de una lista de referencias, en trozos: el título de cada obra va aparte para que la
// interfaz y el Informe de casos lo pongan en cursiva. Otra edición de la misma obra se suma con
// "junto con la …".
export interface ParteCita {
  obra: string | null;
  texto: string;
}

export function citar(referencias: readonly Referencia[]): ParteCita[] {
  return referencias.map((r, i) => {
    const siguiente = referencias[i + 1];
    const fin = !siguiente ? '.' : siguiente.obra === r.obra ? ',' : '; ';
    if (i > 0 && referencias[i - 1].obra === r.obra) {
      return {
        obra: null,
        texto: ` junto con la ${r.edicion} ed. (${r.anio}), ${r.ubicacion}${fin}`,
      };
    }
    const editor = r.editor ? `${r.editor}, ` : '';
    return { obra: r.obra, texto: `, ${r.edicion} ed. (${editor}${r.anio}), ${r.ubicacion}${fin}` };
  });
}
