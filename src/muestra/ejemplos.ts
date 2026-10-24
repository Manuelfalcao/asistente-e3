import type { Elemento, Escalera, Posicion } from '../ui/esquema';

// Un esquema de ejemplo de cada Calculadora que dibuja una red en escalera.

const serie = (tipo: 'R' | 'L' | 'C', nombre: string): Elemento => ({
  tipo,
  posicion: 'serie',
  nombre,
});
const derivacion = (tipo: 'R' | 'L' | 'C', nombre: string): Elemento => ({
  tipo,
  posicion: 'derivacion',
  nombre,
});
const lc = (conexion: 'serie' | 'paralelo', posicion: Posicion, k: number): Elemento => ({
  tipo: 'LC',
  conexion,
  posicion,
  nombreL: `L${k}`,
  nombreC: `C${k}`,
});

const RS = { fuente: 'R_s', carga: 'R_L' };

function pasaBajosPi(orden: number): Escalera {
  return {
    ...RS,
    elementos: Array.from({ length: orden }, (_, i) =>
      i % 2 === 0 ? derivacion('C', `C${i + 1}`) : serie('L', `L${i + 1}`),
    ),
  };
}

function acoplados(orden: number): Escalera {
  const elementos: Elemento[] = [serie('C', 'C01')];
  for (let k = 1; k <= orden; k++) {
    elementos.push({
      tipo: 'LC',
      conexion: 'paralelo',
      posicion: 'derivacion',
      nombreL: 'L',
      nombreC: `C${k}`,
    });
    elementos.push(serie('C', orden < 9 ? `C${k}${k + 1}` : `C${k},${k + 1}`));
  }
  return { ...RS, elementos };
}

// La red π de la tarjeta de resultado de ejemplo.
export const RED_PI: Escalera = {
  ...RS,
  elementos: [derivacion('C', 'C1'), serie('L', 'L1'), derivacion('C', 'C2')],
};

export interface Ejemplo {
  titulo: string;
  nota: string;
  escalera: Escalera;
}

export const EJEMPLOS: readonly { calculadora: string; ejemplos: readonly Ejemplo[] }[] = [
  {
    calculadora: 'Calculadora de atenuadores',
    ejemplos: [
      {
        titulo: 'Atenuador T',
        nota: 'R1 y R2 en serie, R3 en derivación (spec §10.2).',
        escalera: {
          fuente: 'Z_1',
          carga: 'Z_2',
          elementos: [serie('R', 'R1'), derivacion('R', 'R3'), serie('R', 'R2')],
        },
      },
      {
        titulo: 'Atenuador π',
        nota: 'R1 y R2 en derivación, R3 en serie.',
        escalera: {
          fuente: 'Z_1',
          carga: 'Z_2',
          elementos: [derivacion('R', 'R1'), serie('R', 'R3'), derivacion('R', 'R2')],
        },
      },
      {
        titulo: 'Pad de mínima pérdida, de 50 a 300 Ω',
        nota: 'En derivación del lado de la impedancia menor, en serie del lado de la mayor.',
        escalera: {
          fuente: 'Z_1',
          carga: 'Z_2',
          elementos: [derivacion('R', 'R1'), serie('R', 'R2')],
        },
      },
    ],
  },
  {
    calculadora: 'Calculadora de redes de adaptación',
    ejemplos: [
      {
        titulo: 'Red L pasa bajos',
        nota: 'El elemento en serie, del lado de la R menor (spec §9.2).',
        escalera: { ...RS, elementos: [serie('L', 'L1'), derivacion('C', 'C1')] },
      },
      {
        titulo: 'Red π pasa bajos',
        nota: 'Dos redes L espalda con espalda.',
        escalera: RED_PI,
      },
      {
        titulo: 'Red T pasa altos',
        nota: 'Las dos reactancias en derivación se combinan en una.',
        escalera: {
          ...RS,
          elementos: [serie('C', 'C1'), derivacion('L', 'L1'), serie('C', 'C2')],
        },
      },
    ],
  },
  {
    calculadora: 'Calculadora de filtros',
    ejemplos: [
      {
        titulo: 'Pasa bajos π, Orden 5',
        nota: 'g1 en derivación junto a la fuente (spec §7.2).',
        escalera: pasaBajosPi(5),
      },
      {
        titulo: 'Pasa altos T, Orden 3',
        nota: 'Los capacitores van en serie y la bobina en derivación.',
        escalera: {
          ...RS,
          elementos: [serie('C', 'C1'), derivacion('L', 'L2'), serie('C', 'C3')],
        },
      },
      {
        titulo: 'Pasa banda π, Orden 3',
        nota: 'LC paralelo en derivación y LC serie en serie (spec §7.5).',
        escalera: {
          ...RS,
          elementos: [
            lc('paralelo', 'derivacion', 1),
            lc('serie', 'serie', 2),
            lc('paralelo', 'derivacion', 3),
          ],
        },
      },
      {
        titulo: 'Rechaza banda T, Orden 3',
        nota: 'LC paralelo en serie y LC serie en derivación.',
        escalera: {
          ...RS,
          elementos: [
            lc('paralelo', 'serie', 1),
            lc('serie', 'derivacion', 2),
            lc('paralelo', 'serie', 3),
          ],
        },
      },
      {
        titulo: 'Pasa bajos π, Orden 10',
        nota: 'La escalera más larga de π y T: en el celular se parte en filas.',
        escalera: pasaBajosPi(10),
      },
      {
        titulo: 'Pasa banda π, Orden 10',
        nota: 'Diez resonadores.',
        escalera: {
          ...RS,
          elementos: Array.from({ length: 10 }, (_, i) =>
            i % 2 === 0 ? lc('paralelo', 'derivacion', i + 1) : lc('serie', 'serie', i + 1),
          ),
        },
      },
      {
        titulo: 'Resonadores acoplados, Orden 3',
        nota: 'Capacitores de extremo C01 y C34, de acople C12 y C23, y de sintonía C1 a C3 (spec §7.7).',
        escalera: acoplados(3),
      },
      {
        titulo: 'Resonadores acoplados, Orden 10',
        nota: 'Veintiún elementos.',
        escalera: acoplados(10),
      },
    ],
  },
];
