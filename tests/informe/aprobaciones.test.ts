import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REGISTRO } from '../../src/calculo/comun/registro';
import {
  leerAprobaciones,
  problemasDePublicacion,
  ultimaAprobada,
} from '../../scripts/informe/aprobaciones';

// docs/aprobaciones.md (spec §13.7) y lo que el workflow de la etiqueta revisa antes de publicar
// (spec §3.4).

const md = `# Aprobaciones

Texto de la cabecera.

\`\`\`md
## v9.9.9

- Hash: 0000000
\`\`\`

## v0.1.0

- Hash: aaaaaaa
- Fecha: 2026-11-02
- Aprobó: Ing. Pérez, por mail
- Deducciones propias aprobadas: ninguna

## v0.10.0

- Hash: cccccccccccc
- Fecha: 2026-12-01
- Aprobó: Ing. Pérez, por WhatsApp
- Deducciones propias aprobadas: \`dos-capas\`, knight
`;

describe('leer docs/aprobaciones.md', () => {
  it('lee cada entrada, sin los ejemplos en bloques de código', () => {
    expect(leerAprobaciones(md)).toEqual([
      {
        version: '0.1.0',
        hash: 'aaaaaaa',
        fecha: '2026-11-02',
        aprobo: 'Ing. Pérez, por mail',
        deducciones: [],
      },
      {
        version: '0.10.0',
        hash: 'cccccccccccc',
        fecha: '2026-12-01',
        aprobo: 'Ing. Pérez, por WhatsApp',
        deducciones: ['dos-capas', 'knight'],
      },
    ]);
  });

  it('una entrada incompleta o mal escrita es un error, con la Versión', () => {
    const sinQuien =
      '## v0.1.0\n\n- Hash: aaaaaaa\n- Fecha: 2026-11-02\n- Deducciones propias aprobadas: ninguna\n';
    expect(() => leerAprobaciones(sinQuien)).toThrow(/v0\.1\.0.*Aprobó/);
    const malHash =
      '## v0.1.0\n\n- Hash: xyz\n- Fecha: 2026-11-02\n- Aprobó: A\n- Deducciones propias aprobadas: ninguna\n';
    expect(() => leerAprobaciones(malHash)).toThrow(/v0\.1\.0.*[Hh]ash/);
    const malFecha =
      '## v0.1.0\n\n- Hash: aaaaaaa\n- Fecha: 2/11/2026\n- Aprobó: A\n- Deducciones propias aprobadas: ninguna\n';
    expect(() => leerAprobaciones(malFecha)).toThrow(/v0\.1\.0.*[Ff]echa/);
    expect(() => leerAprobaciones('## 0.1.0\n')).toThrow(/0\.1\.0/);
  });

  it('una Versión asentada dos veces es un error', () => {
    const una =
      '## v0.1.0\n\n- Hash: aaaaaaa\n- Fecha: 2026-11-02\n- Aprobó: A\n- Deducciones propias aprobadas: ninguna\n';
    expect(() => leerAprobaciones(una + una)).toThrow(/dos veces/);
  });

  it('la última aprobada es la Versión más alta, comparando como números', () => {
    expect(ultimaAprobada(leerAprobaciones(md))?.version).toBe('0.10.0');
    expect(ultimaAprobada([])).toBeNull();
  });

  it('el docs/aprobaciones.md del repo se lee y sus Deducciones están en el registro', () => {
    const aprobaciones = leerAprobaciones(readFileSync('docs/aprobaciones.md', 'utf-8'));
    const ids = new Set(REGISTRO.filter((e) => e.tipo === 'deduccion-propia').map((e) => e.id));
    for (const a of aprobaciones)
      for (const d of a.deducciones) expect(ids, `v${a.version}`).toContain(d);
  });
});

describe('antes de publicar una etiqueta', () => {
  const aprobaciones = leerAprobaciones(md);
  const bien = {
    etiqueta: 'v0.1.0',
    versionPaquete: '0.1.0',
    aprobaciones,
    idsDeducciones: ['dos-capas', 'knight'],
    // Lo que cambió entre el commit aprobado y el de la etiqueta.
    cambiadosDesdeAprobado: ['docs/aprobaciones.md', 'docs/aprobaciones/v0.1.0.json'],
    huellaAprobada: { version: '0.1.0', commit: 'aaaaaaa' },
  };

  it('con todo en regla no hay problemas', () => {
    expect(problemasDePublicacion(bien)).toEqual([]);
  });

  it('la etiqueta tiene que ser vX.Y.Z y coincidir con la Versión de package.json', () => {
    expect(problemasDePublicacion({ ...bien, versionPaquete: '0.2.0' }).join()).toMatch(
      /package\.json/,
    );
    expect(problemasDePublicacion({ ...bien, etiqueta: 'v0.1' }).join()).toMatch(/vX\.Y\.Z/);
  });

  it('sin la entrada de esa Versión no se publica', () => {
    expect(problemasDePublicacion({ ...bien, aprobaciones: [] }).join()).toMatch(
      /docs\/aprobaciones\.md.*v0\.1\.0/,
    );
  });

  it('el commit de la etiqueta tiene que ser el aprobado: después solo puede venir el asiento', () => {
    expect(problemasDePublicacion({ ...bien, cambiadosDesdeAprobado: null }).join()).toMatch(
      /aaaaaaa/,
    );
    const conCodigo = [...bien.cambiadosDesdeAprobado, 'src/calculo/bobinas/bobinas.ts'];
    expect(problemasDePublicacion({ ...bien, cambiadosDesdeAprobado: conCodigo }).join()).toMatch(
      /src\/calculo\/bobinas\/bobinas\.ts/,
    );
  });

  it('la huella guardada tiene que ser la de esa Versión y ese commit', () => {
    expect(problemasDePublicacion({ ...bien, huellaAprobada: null }).join()).toMatch(
      /docs\/aprobaciones\/v0\.1\.0\.json/,
    );
    expect(
      problemasDePublicacion({
        ...bien,
        huellaAprobada: { version: '0.1.0', commit: 'bbbbbbb' },
      }).join(),
    ).toMatch(/bbbbbbb/);
    // Un hash más largo o más corto del mismo commit sirve.
    expect(
      problemasDePublicacion({ ...bien, huellaAprobada: { version: '0.1.0', commit: 'aaaaaaa1' } }),
    ).toEqual([]);
  });

  it('las Deducciones aprobadas tienen que estar en el registro', () => {
    expect(
      problemasDePublicacion({
        ...bien,
        etiqueta: 'v0.10.0',
        versionPaquete: '0.10.0',
        idsDeducciones: ['knight'],
        huellaAprobada: { version: '0.10.0', commit: 'cccccccccccc' },
        cambiadosDesdeAprobado: ['docs/aprobaciones.md', 'docs/aprobaciones/v0.10.0.json'],
      }).join(),
    ).toMatch(/dos-capas/);
  });
});
