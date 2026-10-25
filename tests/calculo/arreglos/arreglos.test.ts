import { describe, expect, it } from 'vitest';
import {
  RANGO_SIN_INVENTARIO,
  calcularArreglos,
  valoresDeBusqueda,
} from '../../../src/calculo/arreglos/arreglos';
import { formasDeConexion } from '../../../src/calculo/comun/arreglos';
import { leerEntrada } from '../../../src/entrada/leer';
import { dentroDeTolerancia, margen } from '../../casos';
import { mejoresArreglos } from '../../oraculos/arreglos';
import { CASOS_COMPORTAMIENTO, CASOS_TOP10, CASO_FORMAS, CASO_TOLERANCIA_47 } from './casos';

// La Calculadora de Arreglos equivalentes (spec §8): el top-10 contra la fuerza bruta, la
// Tolerancia del arreglo calculada a mano y los casos de comportamiento.

describe('Arreglos equivalentes: referencia', () => {
  it(CASO_FORMAS.id, () => {
    expect([1, 2, 3, 4].map((n) => formasDeConexion(n).length)).toEqual([...CASO_FORMAS.esperado]);
  });
});

describe('Arreglos equivalentes: el top-10 es el de la fuerza bruta', () => {
  for (const caso of CASOS_TOP10) {
    it(caso.id, { timeout: 30000 }, () => {
      const r = calcularArreglos(caso.entrada);
      const valores = valoresDeBusqueda(caso.entrada);
      const esperado = mejoresArreglos(valores, caso.entrada.buscado, caso.entrada.umbral);
      expect(r.filas).toHaveLength(10);
      expect(r.filas.map((f) => f.componentes)).toEqual(esperado.map((a) => a.componentes));
      r.filas.forEach((f, i) => {
        expect(Math.abs(f.valor / esperado[i].valor - 1), `fila ${i + 1}`).toBeLessThan(1e-9);
      });
    });
  }
});

describe('Arreglos equivalentes: Tolerancia del arreglo', () => {
  it(CASO_TOLERANCIA_47.id, () => {
    const r = calcularArreglos(CASO_TOLERANCIA_47.entrada);
    const fila = r.filas.find((f) => f.conexion === CASO_TOLERANCIA_47.conexion);
    expect(fila, r.filas.map((f) => f.conexion).join(' | ')).toBeDefined();
    const { minimo, maximo } = fila!.tolerancia;
    const { esperado, tolerancia } = CASO_TOLERANCIA_47;
    const medidas = [
      [minimo / 1e-12, esperado.minimo],
      [maximo / 1e-12, esperado.maximo],
      [((fila!.valor - minimo) / fila!.valor) * 100, esperado.abajo],
      [((maximo - fila!.valor) / fila!.valor) * 100, esperado.arriba],
    ] as const;
    for (const [obtenido, impreso] of medidas) {
      expect(
        dentroDeTolerancia(obtenido, impreso, tolerancia),
        `${obtenido} contra ${impreso} ± ${margen(tolerancia, impreso)}`,
      ).toBe(true);
    }
  });
});

describe('Arreglos equivalentes: comportamiento', () => {
  for (const caso of CASOS_COMPORTAMIENTO) {
    it(caso.id, () => {
      expect(caso.observar(calcularArreglos(caso.entrada))).toBe(caso.esperado);
    });
  }
});

describe('Arreglos equivalentes: salidas', () => {
  it('sin Inventario usa la serie completa en el rango fijo del tipo', () => {
    const c = calcularArreglos({ ...CASO_TOLERANCIA_47.entrada });
    expect(c.inventario).toMatchObject({
      texto: 'Serie E12 completa, sin Inventario',
      rango: '1 pF – 10 nF',
      cantidad: 49,
    });
    const r = calcularArreglos({
      ...CASO_TOLERANCIA_47.entrada,
      componente: 'resistencia',
      buscado: 75,
    });
    expect(r.inventario.rango).toBe('1 Ω – 10 MΩ');
    expect(r.inventario.cantidad).toBe(85);
    expect(RANGO_SIN_INVENTARIO.resistencia).toEqual({ min: 1, max: 10e6 });
  });

  it('la conexión se escribe con "serie", "∥" y paréntesis, nunca con "+"', () => {
    for (const componente of ['capacitor', 'resistencia'] as const) {
      const r = calcularArreglos({
        ...CASO_TOLERANCIA_47.entrada,
        componente,
        buscado: componente === 'capacitor' ? 37.3e-12 : 66.9,
        umbral: 0,
      });
      for (const f of r.filas) {
        expect(f.conexion).not.toContain('+');
        if (f.componentes >= 2) expect(f.conexion).toMatch(/ serie | ∥ /);
        // los paréntesis abren y cierran
        expect(f.conexion.split('(').length).toBe(f.conexion.split(')').length);
      }
      expect(r.filas.some((f) => f.conexion.includes('('))).toBe(true);
    }
  });

  it('una subred va entre paréntesis y primero: (27 pF serie 68 pF) ∥ 15 pF', () => {
    const r = calcularArreglos(CASO_TOLERANCIA_47.entrada);
    const tres = r.filas.filter((f) => f.componentes === 3).map((f) => f.conexion);
    expect(tres.length).toBeGreaterThan(0);
    for (const c of tres) expect(c).toMatch(/^\([^()]+\) (∥|serie) [^()]+$|^[^()]+$/);
  });

  it('en resistencias la serie suma y el paralelo es la suma recíproca', () => {
    const r = calcularArreglos({
      ...CASO_TOLERANCIA_47.entrada,
      componente: 'resistencia',
      buscado: 66,
    });
    const dos = r.filas.filter((f) => f.componentes === 2);
    expect(dos.length).toBeGreaterThan(1);
    for (const f of dos) {
      const [a, b] = f.conexion.split(/ serie | ∥ /).map(ohms);
      const esperado = f.conexion.includes(' serie ') ? a + b : (a * b) / (a + b);
      expect(f.valor, f.conexion).toBeCloseTo(esperado, 9);
    }
  });

  it('un Arreglo exacto tiene Error del arreglo 0, sin el residuo del redondeo', () => {
    const r = calcularArreglos({ ...CASO_TOLERANCIA_47.entrada, buscado: 37.3e-12 });
    expect(r.filas.find((f) => f.conexion === '(68 pF serie 68 pF) ∥ 3,3 pF')?.error).toBe(0);
  });

  it('el Error del arreglo tiene signo: 8,2 pF ∥ 39 pF queda +0,43 % sobre 47 pF', () => {
    const r = calcularArreglos(CASO_TOLERANCIA_47.entrada);
    const fila = r.filas.find((f) => f.conexion === '8,2 pF ∥ 39 pF')!;
    expect(fila.error).toBeCloseTo(0.2 / 47, 12);
    const bajo = r.filas.find((f) => f.error < 0);
    expect(bajo).toBeDefined();
  });

  it('los pasos dicen la fórmula, cuántas combinaciones se evaluaron y la regla de orden', () => {
    const r = calcularArreglos(CASO_TOLERANCIA_47.entrada);
    const textos = r.pasos.map((p) => p.texto).join(' | ');
    expect(textos).toMatch(/serie/i);
    expect(textos).toMatch(/paralelo/i);
    expect(textos).toMatch(/evalu/);
    expect(textos).toMatch(/orden/i);
    expect(r.pasos.some((p) => p.latex.includes('13\\,132\\,049'))).toBe(true);
    // cada fila trae la cuenta de su Tolerancia del arreglo
    for (const f of r.filas) expect(f.pasos.some((p) => /mínimo/.test(p.texto))).toBe(true);
  });

  it('cita IEC 60063, Riordan y Shannon por OEIS A000084 y KEMET', () => {
    const r = calcularArreglos(CASO_TOLERANCIA_47.entrada);
    const citas = JSON.stringify(r.referencias);
    expect(citas).toContain('IEC 60063');
    expect(citas).toContain('Vishay');
    expect(citas).toContain('A000084');
    expect(citas).toContain('KEMET');
  });
});

function ohms(texto: string): number {
  const l = leerEntrada(texto, { magnitud: 'resistencia' });
  if (l.tipo !== 'valor') throw new Error(`no se lee ${texto}`);
  return l.valor;
}
