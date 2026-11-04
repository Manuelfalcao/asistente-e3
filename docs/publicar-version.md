# Publicar una Versión

Paso a paso para el Ayudante de cátedra (spec §2.2, §3.4, §13.7). Los Alumnos reciben la Versión solos: el sitio se actualiza y les aparece la franja "Hay una versión nueva". No se les reenvía nada.

## Una sola vez: preparar el repo

Esto puede necesitar la cuenta del dueño del repo `asistente-e3`.

1. **Settings › Pages › Build and deployment › Source: GitHub Actions.**
2. **Settings › Environments › github-pages › Deployment branches and tags:** agregar la regla de etiqueta `v*.*.*`. Sin ella GitHub no deja publicar desde una etiqueta, solo desde `main`.
3. Opcional, en **Settings › Rules › Rulesets**: una regla para las etiquetas `v*` que solo deje crearlas al Ayudante de cátedra.

## Cada Versión

### 1. Subir la Versión en `package.json`

Con todo lo que va en la Versión ya en `main`, cambiá `"version"` en `package.json` (versión semántica: `0.2.0`, `0.2.1`, `1.0.0`) y empujá ese commit a `main`.

### 2. Bajar el Informe del CI

En **Actions › CI**, abrí la corrida de ese commit y bajá el artefacto **informe-de-casos**. Es un zip con dos archivos:

- `informe.html`: el Informe de casos. Fijate en su encabezado la Versión y el hash del commit, y que arriba diga 0 en rojo y 0 sin test. Si hay algo en rojo no se pide la aprobación: un caso en rojo bloquea la Versión.
- `huella.json`: lo que se guarda al aprobar, para que el Informe de la Versión siguiente arme su sección de Cambios. No se manda a la Cátedra.

Si el CI falló en algún paso, no sigas: el Informe igual está, y dice qué falló.

**Si la sección Cambios dice "Sin cambios de cálculo"**, no hace falta pedir la aprobación ni asentar nada (spec §13.7). Saltá al paso 5 y creá la etiqueta sobre ese commit.

### 3. Pedir la aprobación

Mandale `informe.html` a la Cátedra ("Guardar como PDF" da el PDF, si lo prefieren). Lo primero del Informe es la sección **Cambios desde la última Versión aprobada**. Cada Deducción propia y cada Criterio práctico tiene su casilla aparte.

La Cátedra contesta "apruebo la vX.Y.Z" por el canal que use (mail o WhatsApp), y dice qué Deducciones propias aprueba.

### 4. Asentarla en `docs/aprobaciones.md`

En un commit nuevo **sobre el aprobado**, sin ningún otro cambio:

1. Agregá la entrada al final de [`docs/aprobaciones.md`](aprobaciones.md), con el formato que está ahí: la Versión, el **hash del encabezado del Informe**, la fecha, quién aprobó y por qué canal, y los ids de las Deducciones propias aprobadas.
2. Copiá el `huella.json` del zip a `docs/aprobaciones/vX.Y.Z.json`, sin tocarlo.
3. Hacé el commit.

Entre el commit aprobado y el de la etiqueta solo pueden cambiar esos dos archivos. Si se coló otro cambio, el workflow no publica: hay que volver al paso 1 con una Versión nueva.

- **Si `main` sigue en el commit aprobado**, empujá el commit a `main`.
- **Si a `main` ya llegaron otros commits**, hacé el asiento en una rama que sale del commit aprobado (`git switch -c aprobacion-v0.2.0 <hash>`), empujala, y después de crear la etiqueta (paso 5) fusionala en `main` con un merge, no con rebase. El asiento tiene que llegar a `main`: sin él, el Informe de la Versión siguiente se compara contra una Versión vieja.

### 5. Crear y empujar la etiqueta

Sobre el commit del asiento (paso 4) o, sin cambios de cálculo, sobre el commit del paso 1:

```bash
git tag v0.2.0
git push origin v0.2.0
```

El workflow **Publicar una Versión** (Actions) revisa que la etiqueta coincida con `package.json`, y después una de dos:

- **Con entrada en `docs/aprobaciones.md`:** que tenga ese hash y que la huella sea la de ese Informe. Vuelve a correr `tsc --noEmit`, los tests y el Informe sobre el commit aprobado.
- **Sin entrada:** que desde la última Versión aprobada no hayan cambiado `src/calculo/` ni `src/entrada/`. Corre `tsc --noEmit`, los tests y el Informe sobre el commit de la etiqueta, y que la sección de Cambios esté vacía. Si hay cambios de cálculo no publica: hace falta pedir la aprobación.

Si todo está en verde:

- crea la Release `vX.Y.Z` en borrador, con el HTML único y el Informe de casos adjuntos;
- publica el sitio en GitHub Pages, con el link "Descargar versión para PC" apuntando al HTML único de esa Versión;
- saca la Release de borrador.

Si falla la publicación en Pages, la Release queda en borrador: borrala antes de reintentar.

Si falla alguna revisión, no se publica nada; el workflow dice qué. Para reintentar, borrá la etiqueta (`git push --delete origin v0.2.0` y `git tag -d v0.2.0`), corregí lo que faltaba en el asiento y volvé a crearla.
