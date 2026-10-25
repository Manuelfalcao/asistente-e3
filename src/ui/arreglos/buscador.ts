import { useEffect, useState } from 'preact/hooks';
import {
  type EntradaArreglos,
  type ResultadoArreglos,
  calcularArreglos,
} from '../../calculo/arreglos/arreglos';
// Embebido como blob (o data: si el navegador no deja), así también anda en el HTML único.
import Buscador from './buscador.worker?worker&inline';

// La búsqueda corre en un Web Worker. Si llega una nueva mientras otra sigue, la vieja se corta: no
// tiene sentido terminarla. Si el navegador no puede crear el worker, se busca en el hilo de la
// interfaz, después de dejar que se dibuje el "calculando".

let trabajador: Worker | null = null;
let ocupado = false;
let sinWorker = false;

function crear(): Worker | null {
  if (sinWorker) return null;
  try {
    return new Buscador();
  } catch {
    sinWorker = true;
    return null;
  }
}

function buscar(entrada: EntradaArreglos): Promise<ResultadoArreglos> {
  return new Promise((resolver) => {
    if (ocupado) {
      trabajador?.terminate();
      trabajador = null;
    }
    trabajador ??= crear();
    const w = trabajador;
    if (!w) {
      setTimeout(() => resolver(calcularArreglos(entrada)), 0);
      return;
    }
    ocupado = true;
    w.onmessage = (e: MessageEvent<ResultadoArreglos>) => {
      ocupado = false;
      resolver(e.data);
    };
    w.onerror = () => {
      w.terminate();
      if (trabajador === w) trabajador = null;
      ocupado = false;
      sinWorker = true;
      resolver(calcularArreglos(entrada));
    };
    w.postMessage(entrada);
  });
}

// El resultado de la última entrada y si todavía se está calculando. Mientras calcula se conserva
// el resultado anterior, para que la lista no salte con cada tecla.
export function useBusquedaArreglos(entrada: EntradaArreglos | null): {
  resultado: ResultadoArreglos | null;
  calculando: boolean;
} {
  const clave = entrada && JSON.stringify(entrada);
  const [ultimo, setUltimo] = useState<{ clave: string; resultado: ResultadoArreglos } | null>(
    null,
  );
  useEffect(() => {
    if (!entrada || !clave) return;
    let vigente = true;
    void buscar(entrada).then((resultado) => {
      if (vigente) setUltimo({ clave, resultado });
    });
    return () => {
      vigente = false;
    };
  }, [clave]);
  return {
    resultado: entrada ? (ultimo?.resultado ?? null) : null,
    calculando: entrada !== null && ultimo?.clave !== clave,
  };
}
