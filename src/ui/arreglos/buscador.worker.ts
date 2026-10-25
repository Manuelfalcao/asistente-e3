import { type EntradaArreglos, calcularArreglos } from '../../calculo/arreglos/arreglos';

// La búsqueda de Arreglos equivalentes fuera del hilo de la interfaz (spec §8.3): con E24 tarda
// décimas de segundo en un celular de gama baja, y la pantalla no se tiene que trabar.

const ambito = self as unknown as {
  addEventListener(tipo: 'message', escuchar: (e: MessageEvent<EntradaArreglos>) => void): void;
  postMessage(mensaje: unknown): void;
};

ambito.addEventListener('message', (e) => ambito.postMessage(calcularArreglos(e.data)));
