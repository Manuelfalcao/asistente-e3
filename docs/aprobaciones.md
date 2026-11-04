# Aprobaciones de la Cátedra

Cada Versión del Asistente que aprueba la Cátedra queda asentada acá (spec §13.7). El Ayudante de cátedra la asienta cuando llega el "apruebo la vX.Y.Z" y recién después crea la etiqueta: el workflow de la etiqueta no publica si falta la entrada de esa Versión con ese hash. El paso a paso está en [publicar-version.md](publicar-version.md).

Cada entrada lleva:

- **Hash**: el commit del Informe de casos que miró la Cátedra (el que figura en su encabezado), corto o entero.
- **Fecha**: el día de la aprobación, AAAA-MM-DD.
- **Aprobó**: quién y por qué canal.
- **Deducciones propias aprobadas**: los ids de las Deducciones propias del registro común (`src/calculo/comun/registro.ts`) que se aprobaron, cada una con su casilla en el Informe, separados por comas, o `ninguna`.

Junto a la entrada va `docs/aprobaciones/vX.Y.Z.json`, la huella de ese Informe (`huella.json` en el artefacto del CI): el Informe de la Versión siguiente arma su sección de Cambios contra ella.

Una entrada de ejemplo:

```md
## v0.2.0

- Hash: abc1234
- Fecha: 2026-11-05
- Aprobó: Ing. Nombre Apellido, por mail
- Deducciones propias aprobadas: maxwell-externo-dos-capas, divisor-capacitivo
```

Las Versiones van de la más vieja a la más nueva, cada una con su título `## vX.Y.Z`.

## v0.1.0

- Hash: dbe8dfb
- Fecha: 2026-11-03
- Aprobó: Cátedra, en persona
- Deducciones propias aprobadas: diametro-rf-una-capa, maxwell-externo-dos-capas, chebyshev-par-resonadores, divisor-capacitivo
