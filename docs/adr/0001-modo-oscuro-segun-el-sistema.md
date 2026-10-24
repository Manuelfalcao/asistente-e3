# 1. El Asistente tiene modo oscuro y sigue el del sistema

- **Fecha:** 2026-10-24
- **Estado:** propuesta. Se aprueba junto con la página de muestra del sistema visual (ticket 26, «Sistema visual y esquemas de circuito»).

## Contexto

La spec no dice nada del modo oscuro. Los Alumnos usan el Asistente sobre todo en el celular, y muchos tienen el tema oscuro del sistema encendido, también de noche mientras estudian. Una página blanca en un teléfono oscuro encandila.

Además, algunos navegadores de Android (Samsung Internet, y Chrome con el oscurecimiento automático de sitios) pueden oscurecer por su cuenta una página que no declara un tema oscuro. Lo hacen con un algoritmo: no saben que el ámbar y el rojo son los niveles de Valor dudoso y Valor impracticable, ni que los esquemas tienen que quedar legibles.

Lo que cuesta: cada color tiene dos valores, y todo hay que mirarlo en los dos temas.

## Decisión

**Sí, el Asistente tiene modo oscuro, y sigue el tema del sistema (`prefers-color-scheme`). No hay selector propio.**

- Todos los colores de la interfaz están en `src/ui/tokens.css`. El tema oscuro es un único bloque `@media (prefers-color-scheme: dark)` que solo redefine colores; tipografía, tamaños y espaciado son los mismos.
- La página declara `color-scheme: light dark`: los controles nativos (desplegables, barras de desplazamiento) siguen el tema, y el navegador sabe que no tiene que oscurecerla por su cuenta.
- `tests/paleta.test.ts` verifica el contraste WCAG AA de cada combinación de colores en los dos temas (4,5:1 para texto y rótulos, 3:1 para bordes de campos y marcas de nivel).
- Los esquemas y los íconos se dibujan con `currentColor`, y el MathML de Temml hereda el color del texto: no necesitan una versión oscura.
- El ícono del Asistente instalado es uno solo, azul, en los dos temas.

**Por qué sin selector:** un selector pide guardar una preferencia más y un lugar donde ponerlo, y el Asistente no tiene pantalla de ajustes (spec §4). Cambiar el tema del teléfono está a dos toques. La página de muestra sí tiene un selector, solo para revisar los dos temas sin tocar el teléfono.

## Consecuencias

- Un color nuevo se agrega en los dos bloques de `tokens.css` y, si es una combinación nueva de texto y fondo, en `PARES_DE_CONTRASTE` de `src/ui/paleta.ts`. Ninguna Calculadora usa un color suelto.
- Cada cambio visual se revisa en los dos temas.
- El `background_color` del manifest es uno solo (el claro): la pantalla de arranque de la PWA instalada es clara también en un teléfono oscuro. Se acepta.
- El Informe de casos (ticket 32) es un documento aparte para la Cátedra y no necesita modo oscuro.

## Alternativa descartada

**Solo tema claro**, declarando `color-scheme: light`. Es más simple y hay que aprobar un solo aspecto, pero deja la página blanca en los teléfonos oscuros y expuesta al oscurecimiento automático de algunos navegadores, que puede cambiar los colores de los niveles de aviso sin control.
