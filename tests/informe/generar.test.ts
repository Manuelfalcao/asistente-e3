import { describe, expect, it } from 'vitest';
import { aportesDeTests, seccionesDeCasos } from '../../scripts/informe/casos';
import { generarInforme } from '../../scripts/informe/generar';
import type { AporteInforme, CasoDeComportamiento } from '../casos-informe';

// El Informe de casos armado de verdad, con las tablas de este repo (spec §13.6).

const aportes = aportesDeTests();
const encabezado = { version: '0.1.0', commit: 'abc1234', fecha: '2026-10-24' };

// Un Vitest en el que pasaron todos los casos.
const todosPasan = () =>
  aportes.flatMap((a) => a.casos().map((c) => ({ titulo: c.id, estado: 'passed' })));

describe('las tablas de casos, vistas desde el informe', () => {
  const todos = aportes.flatMap((a) =>
    a.casos().map((caso) => ({ calculadora: a.calculadora, caso })),
  );

  it('hay casos de arreglos, atenuadores, bobinas y Común, y nada más por ahora', () => {
    expect(new Set(aportes.map((a) => a.calculadora))).toEqual(
      new Set(['arreglos', 'atenuadores', 'bobinas', 'comun']),
    );
  });

  it('cada caso tiene id y referencia, y los ids no se repiten dentro de la sección', () => {
    for (const { caso } of todos) {
      expect(caso.id.trim(), caso.id).not.toBe('');
      expect(caso.referencia.trim(), caso.id).not.toBe('');
    }
    for (const s of seccionesDeCasos(aportes, [])) {
      const ids = s.casos.map((c) => c.caso.id);
      expect(new Set(ids).size, s.titulo).toBe(ids.length);
    }
  });

  it('todos los casos tienen lo obtenido dentro de lo esperado', () => {
    for (const { caso } of todos) {
      if (caso.clase === 'comportamiento') {
        expect(caso.coincide, `${caso.id}: ${caso.esperado} contra ${caso.obtenido}`).toBe(true);
      } else {
        for (const m of caso.medidas) {
          expect(m.dentro, `${caso.id}: ${m.nombre} ${m.obtenido} contra ${m.esperado}`).toBe(true);
          expect(m.motivo.trim(), `${caso.id}: ${m.nombre}`).not.toBe('');
        }
      }
    }
  });

  it('cada caso de verificación nombra su oráculo', () => {
    for (const { caso } of todos) {
      if (caso.clase === 'verificacion') expect(caso.oraculo?.trim(), caso.id).toBeTruthy();
    }
  });

  it('atenuadores trae las 13 filas de la Fig. 8 y las 26 de la Fig. 7', () => {
    const ids = todos.map(({ caso }) => caso.id);
    expect(ids.filter((id) => id.startsWith('Fig. 8:'))).toHaveLength(13);
    expect(ids.filter((id) => id.startsWith('Fig. 7:'))).toHaveLength(26);
  });

  it('los de referencia llevan los pasos que ve el Alumno', () => {
    const fig8 = todos.find(({ caso }) => caso.id.startsWith('Fig. 8:'))!.caso;
    expect(fig8.clase === 'referencia' && fig8.pasos[0].pasos.length).toBeGreaterThan(0);
  });
});

describe('secciones', () => {
  const nuevo = (calculadora: AporteInforme['calculadora'], id: string): AporteInforme => ({
    calculadora,
    casos: () => [
      {
        clase: 'comportamiento',
        id,
        entradas: '',
        referencia: 'spec',
        esperado: '',
        obtenido: '',
        coincide: true,
      } satisfies CasoDeComportamiento,
    ],
  });

  it('una Calculadora nueva aparece sola en el orden del menú, y Común al final', () => {
    const secciones = seccionesDeCasos(
      [nuevo('comun', 'c'), nuevo('atenuadores', 'a'), nuevo('bobinas', 'b')],
      [],
    );
    expect(secciones.map((s) => s.calculadora)).toEqual(['bobinas', 'atenuadores', 'comun']);
    expect(secciones[0].titulo).toBe('Calculadora de bobinas');
  });

  it('dos tablas de la misma Calculadora van en la misma sección', () => {
    const secciones = seccionesDeCasos([nuevo('comun', 'x'), nuevo('comun', 'y')], []);
    expect(secciones).toHaveLength(1);
    expect(secciones[0].casos.map((c) => c.caso.id)).toEqual(['x', 'y']);
  });

  it('un caso con bandera de una Deducción que no está en el registro es un error, no un caso perdido', () => {
    const conBandera: AporteInforme = {
      calculadora: 'atenuadores',
      casos: () => [
        {
          clase: 'comportamiento',
          id: 'x',
          entradas: '',
          referencia: 'spec',
          esperado: '',
          obtenido: '',
          coincide: true,
          bandera: { deduccion: 'no-existe', lado: 'plan-b' },
        },
      ],
    };
    expect(() =>
      generarInforme({ raiz: process.cwd(), pruebas: [], encabezado, aportes: [conBandera] }),
    ).toThrow(/no-existe/);
  });

  it('una Calculadora que no existe es un error, no un caso perdido', () => {
    expect(() => seccionesDeCasos([nuevo('inventada' as 'comun', 'x')], [])).toThrow(/inventada/);
  });
});

describe('el informe completo', () => {
  const { html, resumen } = generarInforme({
    raiz: process.cwd(),
    pruebas: todosPasan(),
    encabezado,
  });

  it('con todos los tests en verde no hay nada en rojo ni sin test', () => {
    expect(resumen.falla).toBe(0);
    expect(resumen.sinTest).toBe(0);
    expect(resumen.ok).toBe(resumen.total);
    expect(html).toContain(
      `${resumen.total} casos: ${resumen.total} aprobados · 0 en rojo · 0 sin test`,
    );
  });

  it('sin el resultado de Vitest ningún caso está aprobado', () => {
    const vacio = generarInforme({ raiz: process.cwd(), pruebas: [], encabezado });
    expect(vacio.resumen.ok).toBe(0);
    expect(vacio.resumen.sinTest).toBe(vacio.resumen.total);
  });

  it('lleva las secciones en orden, el registro común y los oráculos', () => {
    const lugares = [
      'id="cambios"',
      'id="calculadora-atenuadores"',
      'id="comun"',
      'id="criterios"',
      'id="oraculos"',
    ].map((id) => html.indexOf(id));
    expect(lugares.every((l) => l >= 0)).toBe(true);
    expect(lugares).toEqual([...lugares].sort((a, b) => a - b));
    expect(html).toContain('Umbrales de Valor dudoso y Valor impracticable');
    expect(html).toContain('tests/oraculos/abcd.ts');
  });

  it('es autocontenido: la fuente y el CSS van adentro, sin recursos externos', () => {
    expect(html).toContain('data:font/woff2;base64,');
    expect(html).toContain('@media print');
    expect(html).not.toMatch(/<link[^>]+href=/);
    expect(html).not.toMatch(/(src|href)="https?:/);
    expect(html).not.toMatch(/url\(\s*['"]?(?!data:)[a-z]/i);
  });

  it('tiene las fórmulas de los pasos en MathML', () => {
    expect(html).toContain('<math');
  });
});
