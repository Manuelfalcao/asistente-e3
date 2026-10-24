import { describe, expect, it } from 'vitest';
import type { EntradaRegistro } from '../../src/calculo/comun/registro';
import {
  type DatosInforme,
  type SeccionInforme,
  renderizarInforme,
} from '../../scripts/informe/html';
import type { CasoDeComportamiento, CasoDeRevision, CasoInforme } from '../casos-informe';

// El HTML del Informe de casos (spec §13.6), visto como texto: el orden de las secciones, qué lleva
// cada fila y que cada ítem a aprobar tenga su casilla.

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
      motivo: 'Tabla publicada: media unidad de la última cifra impresa.',
      dentro: true,
    },
  ],
  pasos: [
    {
      titulo: 'T',
      pasos: [
        { texto: 'Relación de tensiones', latex: 'K = 10^{A/20} = 3{,}162', fuente: 'Brinson' },
      ],
    },
  ],
  ...extra,
});

const comportamiento = (id: string): CasoDeComportamiento => ({
  clase: 'comportamiento',
  id,
  entradas: 'A = 0 dB',
  referencia: 'spec §10.5',
  esperado: 'corte: no-positiva',
  obtenido: 'corte: no-positiva',
  coincide: true,
});

const seccion = (
  calculadora: string,
  titulo: string,
  casos: readonly CasoInforme[],
): SeccionInforme => ({
  calculadora,
  titulo,
  casos: casos.map((caso) => ({ caso, estado: 'ok' as const })),
});

const criterio: EntradaRegistro = {
  tipo: 'criterio-practico',
  id: 'umbrales',
  nombre: 'Umbrales de Valor impracticable',
  queEs: 'Cada L, C y R se revisa.',
  adaptacion: 'Se supone el montaje.',
  respaldo: 'research/valor-impracticable.md',
  planB: 'Se ajustan los niveles.',
  bandera: null,
};

const deduccion: EntradaRegistro = {
  tipo: 'deduccion-propia',
  id: 'dos-capas',
  nombre: 'Dos capas: término de Maxwell',
  queEs: 'Corrección de la fórmula de dos capas.',
  adaptacion: 'Se usa D′ = √(p·d).',
  respaldo: '11 geometrías contra la suma de anillos.',
  planB: 'Rosa (91) sola.',
  bandera: 'ROSA_SOLA',
  deduccion: [{ texto: 'Término de Maxwell', latex: '\\ln(D/d) - 0{,}1119' }],
};

const base: DatosInforme = {
  encabezado: { version: '0.1.0', commit: 'abc1234', fecha: '2026-10-24' },
  vitest: { total: 120, fallan: 0 },
  secciones: [],
  registro: [],
  oraculos: [],
  cambios: null,
  fuente: { css: '', fuenteFormula: '' },
};

const datos = (extra: Partial<DatosInforme>): DatosInforme => ({ ...base, ...extra });
const html = (extra: Partial<DatosInforme> = {}) => renderizarInforme(datos(extra));

// La posición de un texto en el documento, para comprobar el orden.
const lugar = (documento: string, texto: string) => {
  const i = documento.indexOf(texto);
  expect(i, `falta «${texto}»`).toBeGreaterThanOrEqual(0);
  return i;
};

describe('encabezado', () => {
  it('lleva la Versión, el hash del commit y la fecha', () => {
    const h = html();
    expect(h).toContain('v0.1.0');
    expect(h).toContain('abc1234');
    expect(h).toContain('2026-10-24');
  });

  it('es un HTML autocontenido: ningún recurso externo', () => {
    const h = html({ secciones: [seccion('atenuadores', 'Atenuadores', [revision('c1')])] });
    expect(h).not.toMatch(/<link[^>]+href=/);
    expect(h).not.toMatch(/<script[^>]+src=/);
    expect(h).not.toMatch(/url\(\s*['"]?https?:/);
  });
});

describe('resumen', () => {
  it('cuenta los tests de Vitest y marca en rojo si alguno falla, aunque no sea de un caso', () => {
    const bien = html();
    expect(bien).toContain('Tests de Vitest: 120, 0 en rojo.');
    expect(bien).toContain('resumen-ok');
    const mal = html({ vitest: { total: 120, fallan: 2 } });
    expect(mal).toContain('2 en rojo');
    expect(mal).toContain('resumen-rojo');
  });
});

describe('orden', () => {
  it('Cambios, las Calculadoras, Común, Deducciones y Criterios, y el apéndice de oráculos', () => {
    const h = html({
      secciones: [
        seccion('atenuadores', 'Calculadora de atenuadores', [revision('c1')]),
        seccion('comun', 'Común', [comportamiento('c2')]),
      ],
      registro: [criterio, deduccion],
      oraculos: [{ archivo: 'tests/oraculos/abcd.ts', descripcion: 'ABCD', exportes: ['cascada'] }],
    });
    const orden = [
      'id="cambios"',
      'id="calculadora-atenuadores"',
      'id="comun"',
      'id="deducciones"',
      'id="criterios"',
      'id="oraculos"',
    ].map((id) => lugar(h, id));
    expect(orden).toEqual([...orden].sort((a, b) => a - b));
  });

  it('deja el lugar de la sección de Cambios, vacío hasta que lo llene la publicación', () => {
    expect(html()).toMatch(/id="cambios"[^>]*data-vacia/);
    const lleno = html({ cambios: '<p>Casos nuevos: 2</p>' });
    expect(lleno).toContain('<p>Casos nuevos: 2</p>');
    expect(lleno).not.toContain('data-vacia');
  });

  it('en cada Calculadora los casos van agrupados por clase, en el orden de la spec', () => {
    const h = html({
      secciones: [
        seccion('atenuadores', 'Atenuadores', [
          comportamiento('compo'),
          revision('verif', { clase: 'verificacion', oraculo: 'tests/oraculos/abcd.ts' }),
          revision('medi', { clase: 'medicion' }),
          revision('refe'),
        ]),
      ],
    });
    const orden = ['refe', 'medi', 'verif', 'compo'].map((id) => lugar(h, `data-caso="${id}"`));
    expect(orden).toEqual([...orden].sort((a, b) => a - b));
  });

  it('no muestra los grupos ni las Calculadoras sin casos', () => {
    const h = html({ secciones: [seccion('atenuadores', 'Atenuadores', [revision('refe')])] });
    expect(h).not.toContain('Casos de medición');
    expect(h).not.toContain('Casos de comportamiento');
    expect(h).not.toContain('id="comun"');
  });
});

describe('fila de un caso de referencia, de medición o de verificación', () => {
  const h = html({ secciones: [seccion('atenuadores', 'Atenuadores', [revision('Fig. 8: x')])] });

  it('tiene las entradas, el esperado, el obtenido, el error relativo y la tolerancia con su motivo', () => {
    expect(h).toContain('Z₁ = 5 kΩ, A = 10 dB');
    expect(h).toContain('3889 Ω');
    expect(h).toContain('3889,12 Ω');
    expect(h).toContain('+0,0031 %');
    expect(h).toContain('± 0,5');
    expect(h).toContain('Tabla publicada: media unidad de la última cifra impresa.');
  });

  it('tiene el estado y la referencia con edición y página', () => {
    expect(h).toContain('Libro, 4.ª ed. (1956), pág. 262');
    expect(h).toMatch(/class="estado estado-ok"/);
  });

  it('se despliega y muestra los pasos intermedios, con sus fórmulas en MathML', () => {
    expect(h).toMatch(/<details[^>]*class="pasos"/);
    expect(h).toContain('Relación de tensiones');
    expect(h).toContain('<math');
    expect(h).toContain('Brinson');
  });

  it('escapa el HTML de los textos', () => {
    const peligro = html({
      secciones: [seccion('atenuadores', 'A', [revision('<b>x</b>', { entradas: 'a < b & c' })])],
    });
    expect(peligro).not.toContain('<b>x</b>');
    expect(peligro).toContain('a &lt; b &amp; c');
  });

  it('muestra la Diferencia esperada si la hay', () => {
    const conDiferencia = revision('d', {
      medidas: [
        {
          ...revision('d').medidas[0],
          diferencia: { texto: '+4,5 %', motivo: 'La referencia usa otra aproximación' },
        },
      ],
    });
    const hd = html({ secciones: [seccion('atenuadores', 'A', [conDiferencia])] });
    expect(hd).toContain('Diferencia esperada');
    expect(hd).toContain('+4,5 %');
    expect(hd).toContain('La referencia usa otra aproximación');
    expect(h).not.toContain('Diferencia esperada');
  });

  it('el caso de verificación nombra su oráculo y lo enlaza al apéndice', () => {
    const hv = html({
      secciones: [
        seccion('atenuadores', 'A', [
          revision('A1', { clase: 'verificacion', oraculo: 'tests/oraculos/abcd.ts (ABCD)' }),
        ]),
      ],
      oraculos: [{ archivo: 'tests/oraculos/abcd.ts', descripcion: 'ABCD', exportes: [] }],
    });
    expect(hv).toContain('tests/oraculos/abcd.ts (ABCD)');
    expect(hv).toContain('href="#oraculo-abcd"');
    expect(hv).toContain('id="oraculo-abcd"');
  });

  it('un caso en rojo se ve en rojo y entra en el resumen', () => {
    const rojo = renderizarInforme(
      datos({
        secciones: [
          {
            calculadora: 'atenuadores',
            titulo: 'A',
            casos: [{ caso: revision('r'), estado: 'falla' }],
          },
        ],
      }),
    );
    expect(rojo).toMatch(/class="estado estado-falla"/);
    expect(rojo).toMatch(/1 en rojo/);
  });
});

describe('lista compacta de comportamiento', () => {
  it('muestra la entrada, el aviso esperado y el estado', () => {
    const h = html({
      secciones: [seccion('atenuadores', 'Atenuadores', [comportamiento('A = 0 dB es inválida')])],
    });
    expect(h).toContain('A = 0 dB es inválida');
    expect(h).toContain('A = 0 dB');
    expect(h).toContain('corte: no-positiva');
    expect(h).toMatch(/class="estado estado-ok"/);
    expect(h).not.toMatch(/<details[^>]*class="pasos"/);
  });
});

describe('Criterios prácticos y Deducciones propias', () => {
  it('cada Deducción propia tiene su ítem con adaptación, deducción, plan B y casilla propia', () => {
    const h = html({ registro: [deduccion] });
    expect(h).toContain('Dos capas: término de Maxwell');
    expect(h).toContain('Se usa D′ = √(p·d).');
    expect(h).toContain('Término de Maxwell');
    expect(h).toContain('<math');
    expect(h).toContain('Rosa (91) sola.');
    expect(h).toContain('ROSA_SOLA');
    expect(h).toMatch(/<input type="checkbox"[^>]*id="aprobar-dos-capas"/);
  });

  it('muestra los casos de los dos lados de la bandera', () => {
    const propia = revision('caso propio', { bandera: { deduccion: 'dos-capas', lado: 'propia' } });
    const planB = revision('caso plan B', { bandera: { deduccion: 'dos-capas', lado: 'plan-b' } });
    const h = html({
      secciones: [seccion('bobinas', 'Bobinas', [propia, planB, revision('otro')])],
      registro: [deduccion],
    });
    const item = h.slice(lugar(h, 'id="dos-capas"'), lugar(h, '</article>'));
    expect(item).toContain('Con la Deducción propia');
    expect(item).toContain('Con el plan B');
    expect(item).toContain('caso propio');
    expect(item).toContain('caso plan B');
    expect(item).not.toContain('data-caso="otro"');
  });

  it('en la sección de la Calculadora no entran los casos del plan B', () => {
    const planB = revision('caso plan B', { bandera: { deduccion: 'dos-capas', lado: 'plan-b' } });
    const h = html({
      secciones: [seccion('bobinas', 'Bobinas', [revision('propio'), planB])],
      registro: [deduccion],
    });
    const calculadora = h.slice(lugar(h, 'id="calculadora-bobinas"'), lugar(h, 'id="deducciones"'));
    expect(calculadora).toContain('data-caso="propio"');
    expect(calculadora).not.toContain('data-caso="caso plan B"');
  });

  it('el Criterio práctico se presenta para aprobarse como criterio, no como fórmula', () => {
    const h = html({ registro: [criterio] });
    expect(h).toContain('Umbrales de Valor impracticable');
    expect(h).toContain('Se ajustan los niveles.');
    expect(h).toMatch(/<input type="checkbox"[^>]*id="aprobar-umbrales"/);
    expect(h).toMatch(/Apruebo el criterio/);
    expect(h).not.toMatch(/Apruebo la fórmula/);
  });

  it('las secciones sin entradas no aparecen', () => {
    const h = html({ registro: [criterio] });
    expect(h).toContain('id="criterios"');
    expect(h).not.toContain('id="deducciones"');
  });
});

describe('apéndice de oráculos', () => {
  it('describe cada oráculo con su archivo y sus funciones', () => {
    const h = html({
      oraculos: [
        {
          archivo: 'tests/oraculos/abcd.ts',
          descripcion: 'Oráculo ABCD con números complejos.',
          exportes: ['cascada', 'zEntrada'],
        },
      ],
    });
    expect(h).toContain('tests/oraculos/abcd.ts');
    expect(h).toContain('Oráculo ABCD con números complejos.');
    expect(h).toContain('cascada');
    expect(h).toContain('zEntrada');
  });
});

describe('impresión', () => {
  it('tiene CSS de impresión y abre los desplegables antes de imprimir', () => {
    const h = html({ fuente: { css: '@media print { body { color: #000 } }', fuenteFormula: '' } });
    expect(h).toContain('@media print');
    expect(h).toContain('beforeprint');
    expect(h).toContain('afterprint');
  });
});
