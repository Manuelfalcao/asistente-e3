// Lo que devuelve un cálculo además de sus valores (spec §3.2 y §5.3): la interfaz y el Informe de
// casos solo lo muestran.

// Un paso intermedio: la fórmula con los números ya sustituidos, como cadena LaTeX (spec §5.4).
export interface Paso {
  // Qué se calcula, en una línea: "Relación de tensiones".
  texto: string;
  latex: string;
  // De dónde salen los números que no son del Alumno: "Brinson, ajuste a medición".
  fuente?: string;
}

// Una obra de la bibliografía. Si hay varias ediciones, una entrada por edición.
export interface Referencia {
  obra: string;
  // "4.ª"
  edicion: string;
  editor?: string;
  anio: number;
  // Capítulo, ecuación o páginas: "cap. 9, págs. 252-254".
  ubicacion: string;
}

// Un aviso que afecta a todo el resultado. El código es para los Casos de prueba.
export interface Aviso<Codigo extends string = string> {
  codigo: Codigo;
  texto: string;
}
