import { describe, expect, it } from 'vitest';
import type { EntradaRegistro } from '../../src/calculo/comun/registro';
import {
  compararHuellas,
  huellaDelInforme,
  renderizarCambios,
} from '../../scripts/informe/cambios';
import type { SeccionInforme } from '../../scripts/informe/html';
import type { CasoDeComportamiento, CasoDeRevision, CasoInforme } from '../casos-informe';

// La sección de Cambios del Informe de casos (spec §13.6, §13.7): lo que cambió desde la última
// Versión aprobada, contra la huella que quedó guardada al aprobarla.

const revision = (id: string, extra: Partial<CasoDeRevision> = {}): CasoDeRevision => ({
  clase: 'referencia',
  id,
  entradas: 'Z₁ = 5 kΩ, A = 10 dB',
  referencia: 'Libro, 4.ª ed. (1956), pág. 262',
  medidas: [
    {
      nombre: 'R1',
      esperado: '3889 Ω',
      obtenido: '3889,12 Ω',
      errorRelativo: 3.1e-5,
      tolerancia: '± 0,5',
      motivo: 'Tabla publicada.',
      dentro: true,
    },
  ],
  pasos: [{ titulo: 'T', pasos: [{ texto: 'Relación de tensiones', latex: 'K = 3{,}162' }] }],
  ...extra,
});

const comportamiento = (id: string, extra: Partial<CasoDeComportamiento> = {}) =>
  ({
    clase: 'comportamiento',
    id,
    entradas: 'A = 0 dB',
    referencia: 'spec §10.5',
    esperado: 'corte: no-positiva',
    obtenido: 'corte: no-positiva',
    coincide: true,
    ...extra,
  }) satisfies CasoDeComportamiento;

const seccion = (calculadora: string, casos: readonly CasoInforme[]): SeccionInforme => ({
  calculadora,
  titulo: calculadora,
  casos: casos.map((caso) => ({ caso, estado: 'ok' as const })),
});

const deduccion: EntradaRegistro = {
  tipo: 'deduccion-propia',
  id: 'dos-capas',
  nombre: 'Dos capas: término de Maxwell',
  queEs: 'Corrección de la fórmula de dos capas.',
  adaptacion: 'Se usa D′ = √(p·d).',
  respaldo: '11 geometrías.',
  planB: 'Rosa (91) sola.',
  bandera: 'ROSA_SOLA',
  deduccion: [{ texto: 'Término de Maxwell', latex: '\\ln(D/d) - 0{,}1119' }],
};

const criterio: EntradaRegistro = {
  tipo: 'criterio-practico',
  id: 'umbrales',
  nombre: 'Umbrales',
  queEs: 'Cada L, C y R se revisa.',
  adaptacion: 'Se supone el montaje.',
  respaldo: 'research.',
  planB: 'Se ajustan los niveles.',
  bandera: null,
};

const v1 = { version: '0.1.0', commit: 'aaaaaaa' };
const v2 = { version: '0.2.0', commit: 'bbbbbbb' };

const huella = (
  encabezado: { version: string; commit: string },
  secciones: SeccionInforme[],
  registro: readonly EntradaRegistro[] = [],
) => huellaDelInforme({ encabezado, secciones, registro });

describe('huella', () => {
  it('guarda la Versión, el commit y lo que se compara de cada caso, y se puede escribir como JSON', () => {
    const h = huella(
      v1,
      [seccion('atenuadores', [revision('c1'), comportamiento('c2')])],
      [deduccion],
    );
    expect(h.version).toBe('0.1.0');
    expect(h.commit).toBe('aaaaaaa');
    expect(h.casos.map((c) => `${c.seccion}/${c.id}`)).toEqual([
      'atenuadores/c1',
      'atenuadores/c2',
    ]);
    expect(JSON.parse(JSON.stringify(h))).toEqual(h);
  });
});

describe('comparar contra la última Versión aprobada', () => {
  const anterior = huella(v1, [
    seccion('atenuadores', [revision('c1'), revision('c2'), comportamiento('c3')]),
  ]);

  it('la misma Versión, otra vez: sin cambios de cálculo', () => {
    const actual = huella(v2, [
      seccion('atenuadores', [revision('c1'), revision('c2'), comportamiento('c3')]),
    ]);
    const cambios = compararHuellas(anterior, actual);
    expect(cambios.sinCambiosDeCalculo).toBe(true);
    expect(cambios.contra).toEqual(v1);
  });

  it('casos nuevos, eliminados y modificados, con el valor anterior y el nuevo', () => {
    const actual = huella(v2, [
      seccion('atenuadores', [
        revision('c1', {
          medidas: [{ ...revision('c1').medidas[0], esperado: '3890 Ω', obtenido: '3890,01 Ω' }],
        }),
        comportamiento('c3', { obtenido: 'corte: cero' }),
        revision('c4'),
      ]),
    ]);
    const cambios = compararHuellas(anterior, actual);
    expect(cambios.sinCambiosDeCalculo).toBe(false);
    expect(cambios.nuevos.map((c) => c.id)).toEqual(['c4']);
    expect(cambios.eliminados.map((c) => c.id)).toEqual(['c2']);
    expect(cambios.modificados.map((c) => c.id)).toEqual(['c1', 'c3']);
    expect(cambios.modificados[0].diferencias).toEqual([
      { que: 'R1: esperado', anterior: '3889 Ω', nuevo: '3890 Ω' },
      { que: 'R1: obtenido', anterior: '3889,12 Ω', nuevo: '3890,01 Ω' },
    ]);
    expect(cambios.modificados[1].diferencias).toEqual([
      { que: 'Aviso: obtenido', anterior: 'corte: no-positiva', nuevo: 'corte: cero' },
    ]);
  });

  it('un caso con el mismo id en otra Calculadora es otro caso', () => {
    const actual = huella(v2, [
      seccion('bobinas', [revision('c1')]),
      seccion('atenuadores', [revision('c2'), comportamiento('c3')]),
    ]);
    const cambios = compararHuellas(anterior, actual);
    expect(cambios.nuevos.map((c) => `${c.seccion}/${c.id}`)).toEqual(['bobinas/c1']);
    expect(cambios.eliminados.map((c) => `${c.seccion}/${c.id}`)).toEqual(['atenuadores/c1']);
  });

  it('fórmulas y referencias que cambiaron', () => {
    const actual = huella(v2, [
      seccion('atenuadores', [
        revision('c1', {
          pasos: [
            {
              titulo: 'T',
              pasos: [
                { texto: 'Relación de tensiones', latex: 'K = 3{,}1623' },
                { texto: 'R1', latex: 'R_1 = 3889' },
              ],
            },
          ],
        }),
        revision('c2', { referencia: 'Libro, 1.ª ed. (1943), pág. 10' }),
        comportamiento('c3'),
      ]),
    ]);
    const cambios = compararHuellas(anterior, actual);
    expect(cambios.modificados).toEqual([]);
    expect(cambios.formulas).toEqual([
      {
        seccion: 'atenuadores',
        id: 'c1',
        pasos: [
          { texto: 'T · Relación de tensiones', anterior: 'K = 3{,}162', nuevo: 'K = 3{,}1623' },
          { texto: 'T · R1', anterior: null, nuevo: 'R_1 = 3889' },
        ],
      },
    ]);
    expect(cambios.referencias).toEqual([
      {
        seccion: 'atenuadores',
        id: 'c2',
        anterior: 'Libro, 4.ª ed. (1956), pág. 262',
        nuevo: 'Libro, 1.ª ed. (1943), pág. 10',
      },
    ]);
    expect(cambios.sinCambiosDeCalculo).toBe(false);
  });

  it('Deducciones propias y Criterios prácticos nuevos, cambiados y eliminados', () => {
    const antes = huella(v1, [], [criterio]);
    const cambiada = { ...deduccion, deduccion: [{ texto: 'Maxwell', latex: '\\ln(D/d)' }] };
    const nueva = huella(v2, [], [deduccion]);
    const cambios = compararHuellas(antes, nueva);
    expect(cambios.registroNuevo.map((e) => e.id)).toEqual(['dos-capas']);
    expect(cambios.registroEliminado.map((e) => e.id)).toEqual(['umbrales']);
    expect(cambios.sinCambiosDeCalculo).toBe(false);
    const otra = compararHuellas(nueva, huella(v2, [], [cambiada]));
    expect(otra.registroCambiado.map((e) => e.id)).toEqual(['dos-capas']);
  });

  it('sin una Versión aprobada todo es nuevo', () => {
    const actual = huella(v1, [seccion('atenuadores', [revision('c1')])], [deduccion]);
    const cambios = compararHuellas(null, actual);
    expect(cambios.contra).toBeNull();
    expect(cambios.nuevos.map((c) => c.id)).toEqual(['c1']);
    expect(cambios.registroNuevo.map((e) => e.id)).toEqual(['dos-capas']);
  });
});

describe('la sección de Cambios en HTML', () => {
  const anterior = huella(v1, [seccion('atenuadores', [revision('c1'), revision('c2')])]);

  it('sin cambios de cálculo lo dice, para aprobar mirando solo esta sección', () => {
    const html = renderizarCambios(
      compararHuellas(
        anterior,
        huella(v2, [seccion('atenuadores', [revision('c1'), revision('c2')])]),
      ),
    );
    expect(html).toContain('v0.1.0');
    expect(html).toContain('aaaaaaa');
    expect(html).toContain('Sin cambios de cálculo');
    expect(html).toContain('mirando solo esta sección');
  });

  it('en la primera Versión dice que todo es nuevo', () => {
    const html = renderizarCambios(
      compararHuellas(null, huella(v1, [seccion('atenuadores', [revision('c1')])], [deduccion])),
    );
    expect(html).toContain('todo es nuevo');
    expect(html).not.toContain('Sin cambios de cálculo');
  });

  it('muestra cada cambio con el valor anterior y el nuevo, y las fórmulas dibujadas', () => {
    const actual = huella(
      v2,
      [
        seccion('atenuadores', [
          revision('c1', {
            medidas: [{ ...revision('c1').medidas[0], esperado: '3890 Ω' }],
            pasos: [{ titulo: 'T', pasos: [{ texto: 'Relación', latex: 'K = 3{,}1623' }] }],
          }),
          revision('c5'),
        ]),
      ],
      [deduccion],
    );
    const html = renderizarCambios(compararHuellas(anterior, actual));
    for (const texto of [
      'Casos nuevos',
      'c5',
      'Casos modificados',
      'R1: esperado',
      '3889 Ω',
      '3890 Ω',
      'Casos eliminados',
      'c2',
      'Fórmulas que cambiaron',
      '<math',
      'Deducciones propias nuevas',
      'Dos capas: término de Maxwell',
    ]) {
      expect(html, texto).toContain(texto);
    }
    expect(html).not.toContain('Sin cambios de cálculo');
  });

  it('escapa el texto de los casos', () => {
    const actual = huella(v2, [seccion('atenuadores', [revision('<b>c1</b>'), revision('c2')])]);
    expect(renderizarCambios(compararHuellas(anterior, actual))).toContain('&lt;b&gt;c1&lt;/b&gt;');
  });
});
