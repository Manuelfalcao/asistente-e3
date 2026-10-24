import { describe, expect, it } from 'vitest';
import { DEFINICIONES, type Campo, type Magnitud } from '../../src/entrada/campos';
import {
  formatearDbm,
  formatearValor,
  redondearCifras,
  type Nivel,
} from '../../src/entrada/formato';
import { leerEntrada } from '../../src/entrada/leer';

// Ida y vuelta (spec §5.2): todo texto del formateador vuelve a leerse con la Entrada flexible y da
// el mismo valor redondeado. Es una propiedad, así que se prueba con muchos valores: una barrida
// por todos los órdenes de magnitud y otra con números al azar (semilla fija, para que un fallo se
// pueda repetir).

function mulberry32(semilla: number) {
  return () => {
    semilla = (semilla + 0x6d2b79f5) | 0;
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// El rango en que cada magnitud se usa de verdad, en potencias de diez de su unidad SI.
const RANGO: Record<Magnitud, [min: number, max: number]> = {
  inductancia: [-10, 1],
  capacidad: [-13, -2],
  resistencia: [-2, 9],
  frecuencia: [0, 11],
  potencia: [-9, 3],
  largo: [-4, 0],
  decibeles: [-1, 2],
  porcentaje: [-3, 2],
  numero: [-2, 3],
  entero: [0, 3],
};

const MANTISAS = [1, 1.5, 2.2, 4.7, 9.99, 99.9, 100, 999, 999.4, 999.5, 999.6, 999.9];

function valores(magnitud: Magnitud): number[] {
  const [min, max] = RANGO[magnitud];
  const barrida = [];
  for (let e = min; e <= max; e++) for (const m of MANTISAS) barrida.push(Number(`${m}e${e}`));
  const azar = mulberry32(magnitud.length * 7919);
  const alAzar = Array.from({ length: 500 }, () => 10 ** (min + azar() * (max - min + 1)));
  return [...barrida, ...alAzar];
}

// Un campo con el Selector de unidad en el valor por defecto, que es el que menos ayuda: si el texto
// no llevara su propio prefijo y unidad, el valor leído saldría mal.
function campoDe(magnitud: Magnitud): Campo {
  return { magnitud, unidad: DEFINICIONES[magnitud].selector[0] };
}

const MAGNITUDES_CON_UNIDAD: Magnitud[] = [
  'inductancia',
  'capacidad',
  'resistencia',
  'frecuencia',
  'potencia',
  'largo',
];

function cercanos(leido: number, esperado: number) {
  expect(Math.abs(leido - esperado)).toBeLessThanOrEqual(Math.abs(esperado) * 1e-12);
}

describe('ida y vuelta del formato de salida', () => {
  for (const nivel of ['resultado', 'paso'] as Nivel[]) {
    const cifras = nivel === 'resultado' ? 3 : 4;
    for (const magnitud of MAGNITUDES_CON_UNIDAD) {
      it(`${magnitud}, ${nivel} (${cifras} cifras)`, () => {
        for (const valor of valores(magnitud)) {
          const texto = formatearValor(valor, magnitud, nivel);
          const lectura = leerEntrada(texto, campoDe(magnitud));
          expect(lectura.tipo, `«${texto}» de ${valor}`).toBe('valor');
          if (lectura.tipo === 'valor') {
            cercanos(lectura.valor, redondearCifras(valor, cifras));
            expect(lectura.aviso, `«${texto}»`).toBeUndefined();
          }
        }
      });
    }
  }

  it('número (Q), con 3 y 4 cifras', () => {
    for (const nivel of ['resultado', 'paso'] as Nivel[]) {
      for (const valor of valores('numero')) {
        const texto = formatearValor(valor, 'numero', nivel);
        const lectura = leerEntrada(texto, campoDe('numero'));
        expect(lectura.tipo, `«${texto}»`).toBe('valor');
        if (lectura.tipo === 'valor') {
          cercanos(lectura.valor, redondearCifras(valor, nivel === 'resultado' ? 3 : 4));
        }
      }
    }
  });

  it('dB, con 2 decimales', () => {
    for (const valor of valores('decibeles')) {
      const texto = formatearValor(valor, 'decibeles');
      const lectura = leerEntrada(texto, campoDe('decibeles'));
      expect(lectura.tipo, `«${texto}»`).toBe('valor');
      if (lectura.tipo === 'valor') expect(lectura.valor).toBe(Number(valor.toFixed(2)));
    }
  });

  it('%, con 2 cifras significativas', () => {
    for (const valor of valores('porcentaje')) {
      const texto = formatearValor(valor, 'porcentaje');
      const lectura = leerEntrada(texto, campoDe('porcentaje'));
      expect(lectura.tipo, `«${texto}»`).toBe('valor');
      if (lectura.tipo === 'valor') cercanos(lectura.valor, redondearCifras(valor, 2));
    }
  });

  it('Orden, entero', () => {
    for (const valor of [1, 2, 7, 10, 99]) {
      const lectura = leerEntrada(formatearValor(valor, 'entero'), campoDe('entero'));
      expect(lectura).toEqual({ tipo: 'valor', valor });
    }
  });

  it('dBm, con signo y con el menos tipográfico', () => {
    const campo: Campo = { magnitud: 'potencia', unidad: 'W', dbm: true };
    const azar = mulberry32(42);
    for (let i = 0; i < 500; i++) {
      const dbm = -60 + azar() * 110;
      const texto = formatearDbm(dbm);
      const lectura = leerEntrada(texto, campo);
      expect(lectura.tipo, `«${texto}»`).toBe('valor');
      if (lectura.tipo === 'valor') expect(lectura.dbm).toBeCloseTo(Number(dbm.toFixed(2)), 12);
    }
  });

  it('la ida y vuelta no depende de lo que marque el Selector de unidad', () => {
    for (const unidad of ['nH', 'µH']) {
      const texto = formatearValor(4.7e-9, 'inductancia');
      const lectura = leerEntrada(texto, { magnitud: 'inductancia', unidad });
      expect(lectura).toEqual({ tipo: 'valor', valor: 4.7e-9 });
    }
  });
});
