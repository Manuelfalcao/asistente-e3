import type { Atenuador, PadMinimaPerdida } from '../../../src/calculo/atenuadores/atenuadores';
import {
  type Elemento,
  atenuacionDb,
  cascada,
  derivacionR,
  modulo,
  potenciaPorElemento,
  serie,
  zEntrada,
  zSalida,
} from '../../oraculos/abcd';

// Lo que arma el cálculo, pasado al oráculo ABCD: la lista de elementos de la fuente a la carga y
// sus resistencias, en el mismo orden. Es el único lugar donde los tests conocen la forma del
// resultado; el oráculo no sabe nada de él.

interface EscaleraOraculo {
  elementos: Elemento[];
  // Los nombres en el mismo orden, para poner cada potencia en su resistencia.
  nombres: string[];
}

export function escaleraDeAtenuador(red: Atenuador): EscaleraOraculo {
  return red.topologia === 'T'
    ? {
        elementos: [serie(red.r1.valor), derivacionR(red.r3.valor), serie(red.r2.valor)],
        nombres: [red.r1.nombre, red.r3.nombre, red.r2.nombre],
      }
    : {
        elementos: [derivacionR(red.r1.valor), serie(red.r3.valor), derivacionR(red.r2.valor)],
        nombres: [red.r1.nombre, red.r3.nombre, red.r2.nombre],
      };
}

export function escaleraDePad(pad: PadMinimaPerdida): EscaleraOraculo {
  const s = serie(pad.serie.valor);
  const d = derivacionR(pad.derivacion.valor);
  // La serie va del lado de la impedancia mayor.
  return pad.serie.lado === 'Z1'
    ? { elementos: [s, d], nombres: [pad.serie.nombre, pad.derivacion.nombre] }
    : { elementos: [d, s], nombres: [pad.derivacion.nombre, pad.serie.nombre] };
}

// Con las resistencias calculadas, entre Z1 (fuente) y Z2 (carga).
export function medir(escalera: EscaleraOraculo, z1: number, z2: number) {
  const m = cascada(escalera.elementos);
  return {
    zEntrada: modulo(zEntrada(m, z2)),
    zSalida: modulo(zSalida(m, z1)),
    atenuacion: atenuacionDb(m, z1, z2),
  };
}

// La potencia que disipa cada resistencia (por nombre) con `potencia` W en la entrada.
export function potencias(
  escalera: EscaleraOraculo,
  z2: number,
  potencia: number,
): Map<string, number> {
  const p = potenciaPorElemento(escalera.elementos, z2, potencia);
  return new Map(escalera.nombres.map((nombre, i) => [nombre, p[i]]));
}
