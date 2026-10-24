import type { Campo } from '../../src/entrada/campos';

// Casos de prueba de comportamiento de la Entrada flexible (spec §13.3, Común). Son datos: los
// corre Vitest y los va a leer el Informe de casos.
//
// Tolerancia de todos los casos: 1e-12 relativo. Motivo: el valor esperado y el leído salen del
// mismo número decimal; solo difiere el redondeo binario de multiplicar por la potencia de diez.
export const TOLERANCIA_RELATIVA = 1e-12;

export type Esperado =
  | { valor: number; aviso?: string; dbm?: number }
  // `error` es un trozo del motivo: el caso falla si el motivo no lo contiene.
  | { error: string }
  | { vacio: true };

export interface CasoEntrada {
  texto: string;
  campo: Campo;
  esperado: Esperado;
  // Qué regla de la spec respalda al caso.
  respalda: string;
}

// El nombre del caso: el título de su test en Vitest y su id en el Informe de casos.
export function nombreDeCasoEntrada(caso: CasoEntrada): string {
  return `«${caso.texto}» en ${caso.campo.magnitud} (${caso.campo.unidad ?? 'sin selector'})`;
}

const L: Campo = { magnitud: 'inductancia', unidad: 'nH' };
const C: Campo = { magnitud: 'capacidad', unidad: 'pF' };
const R: Campo = { magnitud: 'resistencia', unidad: 'Ω' };
const F: Campo = { magnitud: 'frecuencia', unidad: 'MHz' };
const P: Campo = { magnitud: 'potencia', unidad: 'W' };
const P_DBM: Campo = { magnitud: 'potencia', unidad: 'dBm', dbm: true };
const LARGO: Campo = { magnitud: 'largo', unidad: 'mm' };
const DB: Campo = { magnitud: 'decibeles' };
const PORCENTAJE: Campo = { magnitud: 'porcentaje' };
const Q: Campo = { magnitud: 'numero' };
const ORDEN: Campo = { magnitud: 'entero' };

export const CASOS_ENTRADA: readonly CasoEntrada[] = [
  // Los tres ejemplos de la spec
  { texto: '4n7', campo: L, esperado: { valor: 4.7e-9 }, respalda: '§5.1 RKM' },
  {
    texto: '4,7 nH',
    campo: L,
    esperado: { valor: 4.7e-9 },
    respalda: '§5.1 número, prefijo y unidad',
  },
  {
    texto: '0.0047u',
    campo: L,
    esperado: { valor: 4.7e-9 },
    respalda: '§5.1 punto decimal, u por µ',
  },

  // Prefijos: m/M y p/P estrictos
  { texto: '1M', campo: R, esperado: { valor: 1e6 }, respalda: '§5.1 M es mega' },
  {
    texto: '1m',
    campo: R,
    esperado: { error: 'para mega usá M mayúscula: 1M' },
    respalda: '§5.1 m es mili, fuera del juego de R',
  },
  { texto: '5m', campo: L, esperado: { valor: 5e-3 }, respalda: '§5.1 m es mili' },
  {
    texto: '5M',
    campo: L,
    esperado: { error: 'para mili usá m minúscula: 5m' },
    respalda: '§5.1 M es mega, fuera del juego de L',
  },
  {
    texto: '100mhz',
    campo: F,
    esperado: { error: 'mHz no tiene sentido acá; para mega usá M mayúscula: 100M' },
    respalda: '§5.1 la unidad no distingue mayúsculas, el prefijo sí',
  },
  { texto: '100 MHz', campo: F, esperado: { valor: 1e8 }, respalda: '§5.1 prefijo y unidad' },
  {
    texto: '2P2',
    campo: C,
    esperado: { error: 'Para pico usá p minúscula' },
    respalda: '§5.1 P es peta',
  },
  { texto: '2p2', campo: C, esperado: { valor: 2.2e-12 }, respalda: '§5.1 RKM con p' },
  {
    texto: 'pH',
    campo: L,
    esperado: { error: 'No entiendo' },
    respalda: '§5.1 un prefijo solo, sin número, no es un valor',
  },
  {
    texto: '3k',
    campo: C,
    esperado: { error: 'en capacidad los prefijos son p, n y µ' },
    respalda: '§5.1 prefijo fuera del juego, con sugerencia',
  },
  { texto: '4,7 µH', campo: L, esperado: { valor: 4.7e-6 }, respalda: '§5.1 µ (U+00B5)' },
  { texto: '4,7 μH', campo: L, esperado: { valor: 4.7e-6 }, respalda: '§5.1 μ (U+03BC)' },
  {
    texto: '4,7 UH',
    campo: L,
    esperado: { valor: 4.7e-6 },
    respalda: '§5.1 U, en cualquier variante',
  },
  {
    texto: '4,7 N',
    campo: L,
    esperado: { valor: 4.7e-9 },
    respalda: '§5.1 N, en cualquier variante',
  },
  { texto: '1 Meg', campo: R, esperado: { valor: 1e6 }, respalda: '§5.1 meg mezclando mayúsculas' },
  { texto: '2,2 MEGOHM', campo: R, esperado: { valor: 2.2e6 }, respalda: '§5.1 meg con unidad' },
  {
    texto: '2,2 K',
    campo: R,
    esperado: { valor: 2200 },
    respalda: '§5.1 K, en cualquier variante',
  },
  { texto: '0,1G', campo: F, esperado: { valor: 1e8 }, respalda: '§5.1 g/G' },

  // RKM
  { texto: '4k7', campo: R, esperado: { valor: 4700 }, respalda: '§5.1 RKM en resistencia' },
  { texto: '1M5', campo: R, esperado: { valor: 1.5e6 }, respalda: '§5.1 RKM con M' },
  { texto: 'R47', campo: R, esperado: { valor: 0.47 }, respalda: '§5.1 R como coma' },
  { texto: 'r47', campo: R, esperado: { valor: 0.47 }, respalda: '§5.1 r minúscula' },
  { texto: '47R', campo: R, esperado: { valor: 47 }, respalda: '§5.1 R como final' },
  { texto: '4R7', campo: R, esperado: { valor: 4.7 }, respalda: '§5.1 R como coma' },
  {
    texto: '47R',
    campo: C,
    esperado: { error: 'No entiendo «47R»' },
    respalda: '§5.1 R solo en resistencia',
  },
  {
    texto: '145M5',
    campo: F,
    esperado: { error: 'Escribí 145,5M' },
    respalda: '§5.1 RKM fuera de L, C y R',
  },

  // Números
  {
    texto: '4,7',
    campo: C,
    esperado: { valor: 4.7e-12 },
    respalda: '§5.1 sin prefijo, manda el selector (pF)',
  },
  {
    texto: '4,7',
    campo: { ...L, unidad: 'µH' },
    esperado: { valor: 4.7e-6 },
    respalda: '§5.1 sin prefijo, manda el selector (µH)',
  },
  {
    texto: '4,7n',
    campo: C,
    esperado: { valor: 4.7e-9 },
    respalda: '§5.1 lo que se escribe manda sobre el selector',
  },
  {
    texto: '4,7 H',
    campo: { ...L, unidad: 'µH' },
    esperado: { valor: 4.7 },
    respalda: '§5.1 una unidad escrita manda sobre el selector',
  },
  { texto: '145', campo: F, esperado: { valor: 145e6 }, respalda: '§5.1 selector MHz' },
  {
    texto: '145',
    campo: { ...F, unidad: 'kHz' },
    esperado: { valor: 145e3 },
    respalda: '§5.1 selector kHz',
  },
  {
    texto: ',5',
    campo: R,
    esperado: { valor: 0.5 },
    respalda: '§5.1 coma decimal sin parte entera',
  },
  {
    texto: '1.000',
    campo: R,
    esperado: { valor: 1, aviso: 'Se leyó 1 Ω. Para mil, escribí 1000 o 1k.' },
    respalda: '§5.1 aviso suave de separador y 3 dígitos',
  },
  {
    texto: '4,700',
    campo: R,
    esperado: { valor: 4.7, aviso: 'Se leyó 4,7 Ω. Para 4700, escribí 4700 o 4,7k.' },
    respalda: '§5.1 aviso suave de separador y 3 dígitos',
  },
  {
    texto: '1.000',
    campo: L,
    esperado: { valor: 1e-9, aviso: 'Se leyó 1 nH. Para mil, escribí 1000.' },
    respalda: '§5.1 aviso suave, sin la alternativa con k donde L no la tiene',
  },
  {
    texto: '1,234 kΩ',
    campo: R,
    esperado: { valor: 1234 },
    respalda: '§5.2 el texto de los pasos intermedios (4 cifras) no dispara el aviso de miles',
  },
  {
    texto: '4R7 ohm',
    campo: R,
    esperado: { valor: 4.7 },
    respalda: '§5.1 R como coma, con unidad',
  },
  {
    texto: '47R ohm',
    campo: R,
    esperado: { valor: 47 },
    respalda: '§5.1 R como final, con unidad',
  },
  {
    texto: '4R7 kohm',
    campo: R,
    esperado: { error: 'No entiendo «4R7 kohm»' },
    respalda: '§5.1 la R como coma no se combina con un prefijo',
  },
  {
    texto: '1e999',
    campo: R,
    esperado: { error: 'demasiado grande' },
    respalda: '§5.1 un número que no cabe no se lee',
  },
  {
    texto: '-1.000',
    campo: P_DBM,
    esperado: {
      valor: 10 ** -0.1 / 1000,
      dbm: -1,
      aviso: 'Se leyó −1 dBm. Para -1000, escribí -1000.',
    },
    respalda: '§5.1 aviso de miles, sin perder el signo',
  },
  {
    texto: '0,500',
    campo: R,
    esperado: { valor: 0.5 },
    respalda: '§5.1 sin aviso con parte entera cero',
  },
  {
    texto: '1.000,5',
    campo: R,
    esperado: { error: 'separador de miles' },
    respalda: '§5.1 más de un separador no se lee',
  },
  {
    texto: '1 000',
    campo: R,
    esperado: { error: 'No entiendo «1 000»' },
    respalda: '§5.1 espacio dentro del número',
  },
  {
    texto: '  4,7   nH  ',
    campo: L,
    esperado: { valor: 4.7e-9 },
    respalda: '§5.1 espacios alrededor',
  },
  {
    texto: '4,7 n H',
    campo: L,
    esperado: { error: 'No entiendo «4,7 n H»' },
    respalda: '§5.1 espacio entre prefijo y unidad',
  },
  {
    texto: '4,7x',
    campo: L,
    esperado: { error: 'No entiendo «4,7x»' },
    respalda: '§5.1 ejemplo de error',
  },
  { texto: '', campo: L, esperado: { vacio: true }, respalda: '§5.1 campo vacío' },
  { texto: '   ', campo: L, esperado: { vacio: true }, respalda: '§5.1 solo espacios' },

  // Notación científica
  { texto: '4.7e-9 H', campo: L, esperado: { valor: 4.7e-9 }, respalda: '§5.1 científica, punto' },
  {
    texto: '4,7E-9 h',
    campo: L,
    esperado: { valor: 4.7e-9 },
    respalda: '§5.1 científica, coma y E',
  },
  {
    texto: '4e-9',
    campo: { ...L, unidad: 'nH' },
    esperado: { valor: 4e-18 },
    respalda: '§5.1 sin prefijo ni unidad manda el selector, también con científica',
  },
  {
    texto: '4.7e-9n',
    campo: L,
    esperado: { error: 'notación científica no se combina con un prefijo' },
    respalda: '§5.1 científica sin prefijo',
  },

  // Unidades
  {
    texto: '100 OHM',
    campo: R,
    esperado: { valor: 100 },
    respalda: '§5.1 unidades sin distinguir mayúsculas',
  },
  { texto: '100 ohms', campo: R, esperado: { valor: 100 }, respalda: '§5.1 ohms' },
  { texto: '2,2 kΩ', campo: R, esperado: { valor: 2200 }, respalda: '§5.1 Ω (U+03A9)' },
  {
    texto: '2,2 kΩ',
    campo: R,
    esperado: { valor: 2200 },
    respalda: '§5.1 Ω del signo ohm (U+2126)',
  },
  {
    texto: '4,7 pF',
    campo: L,
    esperado: { error: 'Este campo es de inductancia (H)' },
    respalda: '§5.1 unidad que no corresponde al campo',
  },
  {
    texto: '10 Hz',
    campo: R,
    esperado: { error: 'Este campo es de resistencia (Ω)' },
    respalda: '§5.1 unidad que no corresponde al campo',
  },
  {
    texto: '5 mm',
    campo: C,
    esperado: { error: 'Este campo es de capacidad (F)' },
    respalda: '§5.1 mm en un campo de C',
  },

  // Potencia y dBm
  { texto: '5 mW', campo: P, esperado: { valor: 5e-3 }, respalda: '§5.1 potencia' },
  { texto: '5m', campo: P, esperado: { valor: 5e-3 }, respalda: '§5.1 m es mili en potencia' },
  { texto: '5 uw', campo: P, esperado: { valor: 5e-6 }, respalda: '§5.1 u por µ' },
  {
    texto: '5 MW',
    campo: P,
    esperado: { error: 'para mili usá m minúscula: 5m' },
    respalda: '§5.1 prefijo fuera del juego',
  },
  {
    texto: '10 dBm',
    campo: P_DBM,
    esperado: { valor: 0.01, dbm: 10 },
    respalda: '§5.1 dBm escrito',
  },
  {
    texto: '10',
    campo: P_DBM,
    esperado: { valor: 0.01, dbm: 10 },
    respalda: '§5.1 dBm por el selector',
  },
  {
    texto: '−3 dBm',
    campo: P_DBM,
    esperado: { valor: 10 ** -0.3 / 1000, dbm: -3 },
    respalda: '§5.1 signo menos solo en dBm (U+2212)',
  },
  {
    texto: '-3',
    campo: P_DBM,
    esperado: { valor: 10 ** -0.3 / 1000, dbm: -3 },
    respalda: '§5.1 signo menos solo en dBm',
  },
  {
    texto: '0,5',
    campo: P_DBM,
    esperado: { valor: 10 ** 0.05 / 1000, dbm: 0.5 },
    respalda: '§5.1 dBm con decimales',
  },
  {
    texto: '5 mW',
    campo: P_DBM,
    esperado: { valor: 5e-3 },
    respalda: '§5.1 lo escrito manda sobre el selector dBm',
  },
  {
    texto: '10 dBm',
    campo: P,
    esperado: { error: 'Este campo es de potencia (W)' },
    respalda: '§5.1 dBm solo donde la Calculadora lo ofrece',
  },
  {
    texto: '-3 mW',
    campo: P_DBM,
    esperado: { error: 'El signo menos solo vale en dBm' },
    respalda: '§5.1 signo menos solo en dBm',
  },
  {
    texto: '-3',
    campo: P,
    esperado: { error: 'El signo menos solo vale en dBm' },
    respalda: '§5.1 signo menos solo en dBm',
  },
  {
    texto: '-5',
    campo: R,
    esperado: { error: 'El signo menos solo vale en dBm' },
    respalda: '§5.1 signo menos solo en dBm',
  },
  {
    texto: '5 mdBm',
    campo: P_DBM,
    esperado: { error: 'dBm no lleva prefijo' },
    respalda: '§5.1 dBm no combina con prefijo',
  },

  // Largos
  {
    texto: '0,8',
    campo: LARGO,
    esperado: { valor: 8e-4 },
    respalda: '§5.1 largos: solo el número',
  },
  { texto: '10 MM', campo: LARGO, esperado: { valor: 0.01 }, respalda: '§5.1 largos: mm opcional' },
  {
    texto: '5m',
    campo: LARGO,
    esperado: { error: 'sin prefijos' },
    respalda: '§5.1 largos sin prefijos, por la ambigüedad de «5m»',
  },
  {
    texto: '5 F',
    campo: LARGO,
    esperado: { error: 'Este campo es un largo en mm' },
    respalda: '§5.1 unidad que no corresponde',
  },

  // Adimensionales
  { texto: '20', campo: DB, esperado: { valor: 20 }, respalda: '§5.1 dB: el número' },
  {
    texto: '20,5 dB',
    campo: DB,
    esperado: { valor: 20.5 },
    respalda: '§5.2 el texto de salida se vuelve a leer',
  },
  {
    texto: '20 dBm',
    campo: DB,
    esperado: { error: 'Este campo es de decibeles (dB)' },
    respalda: '§5.1 unidad que no corresponde',
  },
  {
    texto: '-3',
    campo: DB,
    esperado: { error: 'El signo menos solo vale en dBm' },
    respalda: '§5.1 signo menos solo en dBm',
  },
  { texto: '5 %', campo: PORCENTAJE, esperado: { valor: 5 }, respalda: '§5.1 % opcional' },
  { texto: '5', campo: PORCENTAJE, esperado: { valor: 5 }, respalda: '§5.1 sin %' },
  { texto: '12,5', campo: Q, esperado: { valor: 12.5 }, respalda: '§5.1 Q: el número' },
  {
    texto: '12 k',
    campo: Q,
    esperado: { error: 'solo el número' },
    respalda: '§5.1 adimensional sin prefijo',
  },
  {
    texto: '5 %',
    campo: Q,
    esperado: { error: 'solo el número' },
    respalda: '§5.1 % solo donde corresponde',
  },
  { texto: '5', campo: ORDEN, esperado: { valor: 5 }, respalda: '§5.1 Orden entero' },
  {
    texto: '4,5',
    campo: ORDEN,
    esperado: { error: 'número entero' },
    respalda: '§5.1 Orden solo enteros',
  },
  {
    texto: '4,0',
    campo: ORDEN,
    esperado: { error: 'número entero' },
    respalda: '§5.1 Orden solo enteros',
  },
  {
    texto: '4k',
    campo: ORDEN,
    esperado: { error: 'No entiendo «4k»' },
    respalda: '§5.1 Orden sin prefijo',
  },
];
