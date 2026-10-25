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
  // "R. Lundin". Las obras sin autor, como el Reference Data, no lo llevan.
  autor?: string;
  // El libro, el informe o la revista: va en cursiva.
  obra: string;
  // "4.ª". Un artículo o un informe no lleva edición.
  edicion?: string;
  editor?: string;
  // El volumen y número de una revista, o la versión de un informe: "73(9)", "v0.20".
  volumen?: string;
  anio: number;
  // Capítulo, ecuación o páginas: "cap. 9, págs. 252-254".
  ubicacion: string;
}

// Un aviso que afecta a todo el resultado. El código es para los Casos de prueba.
export interface Aviso<Codigo extends string = string> {
  codigo: Codigo;
  texto: string;
}
