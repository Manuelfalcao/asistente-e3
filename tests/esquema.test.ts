import { describe, expect, it } from 'vitest';
import { type Escalera, type Esquema, trazarEsquema } from '../src/ui/esquema';

// Ancho útil de una tarjeta en un celular de 375 px: 16 px de margen, 1 px de borde y 16 px de
// relleno por lado.
const ANCHO_CELULAR = 309;

const T_ATENUADOR: Escalera = {
  fuente: 'Z_1',
  carga: 'Z_2',
  elementos: [
    { tipo: 'R', posicion: 'serie', nombre: 'R1' },
    { tipo: 'R', posicion: 'derivacion', nombre: 'R3' },
    { tipo: 'R', posicion: 'serie', nombre: 'R2' },
  ],
};

// Los rótulos como se leen: fila por fila, de izquierda a derecha (y de arriba abajo si comparten x).
function rotulosEnOrden(esquema: Esquema): string[] {
  return esquema.filas.flatMap((fila) =>
    [...fila.rotulos]
      .sort((a, b) => a.x - b.x || a.y - b.y)
      .map((r) => (r.sub ? `${r.texto}_${r.sub}` : r.texto)),
  );
}

// Pasa bajos π de Orden 10: C1, L2, C3, … L10, alternando derivación y serie.
const PI_ORDEN_10: Escalera = {
  fuente: 'R_s',
  carga: 'R_L',
  elementos: Array.from({ length: 10 }, (_, i) =>
    i % 2 === 0
      ? { tipo: 'C', posicion: 'derivacion', nombre: `C${i + 1}` }
      : { tipo: 'L', posicion: 'serie', nombre: `L${i + 1}` },
  ),
};

function resonador(
  conexion: 'serie' | 'paralelo',
  posicion: 'serie' | 'derivacion',
  k: number,
): Escalera['elementos'][number] {
  return { tipo: 'LC', conexion, posicion, nombreL: `L${k}`, nombreC: `C${k}` };
}

const NOMBRES_ORDEN_10 = [
  'R_s',
  'C1',
  'L2',
  'C3',
  'L4',
  'C5',
  'L6',
  'C7',
  'L8',
  'C9',
  'L10',
  'R_L',
];

describe('esquema en escalera', () => {
  it('parte una escalera de Orden 10 en filas que entran en el celular', () => {
    const esquema = trazarEsquema(PI_ORDEN_10, ANCHO_CELULAR);
    expect(esquema.filas.length).toBeGreaterThan(1);
    for (const fila of esquema.filas) expect(fila.ancho).toBeLessThanOrEqual(ANCHO_CELULAR);
    expect(rotulosEnOrden(esquema)).toEqual(NOMBRES_ORDEN_10);
  });

  it('una escalera de Orden 5 entra entera en el celular, sin partirse', () => {
    const orden5 = { ...PI_ORDEN_10, elementos: PI_ORDEN_10.elementos.slice(0, 5) };
    const esquema = trazarEsquema(orden5, ANCHO_CELULAR);
    expect(esquema.filas).toHaveLength(1);
    expect(esquema.filas[0].ancho).toBeLessThanOrEqual(ANCHO_CELULAR);
  });

  it('marca cada corte con el mismo conector al final de una fila y al principio de la otra', () => {
    const { filas } = trazarEsquema(PI_ORDEN_10, ANCHO_CELULAR);
    const numeros: number[] = [];
    filas.forEach((fila, i) => {
      const xs = fila.conectores.map((c) => c.x);
      const alPrincipio = fila.conectores.filter((c) => c.x === Math.min(...xs));
      const alFinal = fila.conectores.filter((c) => c.x === Math.max(...xs));
      if (i > 0) expect(alPrincipio.map((c) => c.numero)).toEqual([numeros.at(-1)]);
      if (i < filas.length - 1) numeros.push(alFinal[0].numero);
      expect(fila.conectores).toHaveLength(i === 0 || i === filas.length - 1 ? 1 : 2);
    });
    expect(numeros).toEqual(filas.slice(1).map((_, i) => i + 1));
  });

  it('describe el circuito en texto para el lector de pantalla', () => {
    expect(trazarEsquema(T_ATENUADOR, ANCHO_CELULAR).descripcion).toBe(
      'De Z1 a Z2: R1 en serie, R3 en derivación y R2 en serie.',
    );
  });

  it('dibuja resonadores LC serie y paralelo, en serie y en derivación, con sus dos rótulos', () => {
    const pasaBanda: Escalera = {
      fuente: 'R_s',
      carga: 'R_L',
      elementos: [
        resonador('paralelo', 'derivacion', 1),
        resonador('serie', 'serie', 2),
        resonador('paralelo', 'derivacion', 3),
      ],
    };
    const rechazaBanda: Escalera = {
      ...pasaBanda,
      elementos: [
        resonador('paralelo', 'serie', 1),
        resonador('serie', 'derivacion', 2),
        resonador('paralelo', 'serie', 3),
      ],
    };
    for (const escalera of [pasaBanda, rechazaBanda]) {
      const esquema = trazarEsquema(escalera, ANCHO_CELULAR);
      for (const fila of esquema.filas) expect(fila.ancho).toBeLessThanOrEqual(ANCHO_CELULAR);
      expect(rotulosEnOrden(esquema)).toEqual(['R_s', 'L1', 'C1', 'L2', 'C2', 'L3', 'C3', 'R_L']);
    }
    expect(trazarEsquema(pasaBanda, ANCHO_CELULAR).descripcion).toBe(
      'De Rs a RL: L1 y C1 (resonador paralelo) en derivación, ' +
        'L2 y C2 (resonador serie) en serie y L3 y C3 (resonador paralelo) en derivación.',
    );
  });

  it('una escalera pasa banda de Orden 10 también entra en el celular', () => {
    const elementos = Array.from({ length: 10 }, (_, i) =>
      i % 2 === 0 ? resonador('paralelo', 'derivacion', i + 1) : resonador('serie', 'serie', i + 1),
    );
    const esquema = trazarEsquema({ fuente: 'R_s', carga: 'R_L', elementos }, ANCHO_CELULAR);
    for (const fila of esquema.filas) expect(fila.ancho).toBeLessThanOrEqual(ANCHO_CELULAR);
    expect(rotulosEnOrden(esquema)).toHaveLength(22);
  });

  it('resonadores acoplados de Orden 10 (21 elementos) entran en el celular', () => {
    const elementos: Escalera['elementos'][number][] = [
      { tipo: 'C', posicion: 'serie', nombre: 'C01' },
    ];
    for (let k = 1; k <= 10; k++) {
      elementos.push({
        tipo: 'LC',
        conexion: 'paralelo',
        posicion: 'derivacion',
        nombreL: 'L',
        nombreC: `C${k}`,
      });
      elementos.push({ tipo: 'C', posicion: 'serie', nombre: `C${k},${k + 1}` });
    }
    const esquema = trazarEsquema({ fuente: 'R_s', carga: 'R_L', elementos }, ANCHO_CELULAR);
    for (const fila of esquema.filas) expect(fila.ancho).toBeLessThanOrEqual(ANCHO_CELULAR);
    expect(rotulosEnOrden(esquema).slice(0, 5)).toEqual(['R_s', 'C01', 'L', 'C1', 'C1,2']);
    expect(rotulosEnOrden(esquema).at(-1)).toBe('R_L');
  });

  it('si ni un elemento por fila entra, pone uno por fila y no pierde ninguno', () => {
    const esquema = trazarEsquema(PI_ORDEN_10, 60);
    expect(esquema.filas).toHaveLength(10);
    expect(rotulosEnOrden(esquema)).toEqual(NOMBRES_ORDEN_10);
  });

  it('en PC la misma escalera entra en una sola fila, sin conectores', () => {
    const { filas } = trazarEsquema(PI_ORDEN_10, 900);
    expect(filas).toHaveLength(1);
    expect(filas[0].conectores).toEqual([]);
    expect(filas[0].ancho).toBeLessThanOrEqual(900);
  });

  it('dibuja un atenuador T en una sola fila, de la fuente a la carga', () => {
    const esquema = trazarEsquema(T_ATENUADOR, ANCHO_CELULAR);
    expect(esquema.filas).toHaveLength(1);
    expect(esquema.filas[0].ancho).toBeLessThanOrEqual(ANCHO_CELULAR);
    expect(rotulosEnOrden(esquema)).toEqual(['Z_1', 'R1', 'R3', 'R2', 'Z_2']);
  });
});
