import { useState } from 'preact/hooks';

// Lo que una Calculadora recuerda mientras el Asistente está abierto y que no se guarda en el
// almacén: así, al volver de un pase, la Calculadora de origen conserva su estado (spec §4.2).
const sesion = new Map<string, unknown>();

// Cambiar de Calculadora desde las pestañas o el menú empieza de cero, como la pila de pases.
export function vaciarSesion() {
  sesion.clear();
}

export function useEstadoDeSesion<T>(clave: string, inicial: T): [T, (valor: T) => void] {
  const [valor, setValor] = useState<T>(() =>
    sesion.has(clave) ? (sesion.get(clave) as T) : inicial,
  );
  return [
    valor,
    (nuevo) => {
      sesion.set(clave, nuevo);
      setValor(nuevo);
    },
  ];
}
