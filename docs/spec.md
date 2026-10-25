# Especificación del Asistente E3, primera versión

Esta es la especificación del Asistente lista para construir. Reúne lo que se decidió en el [mapa](map.md): el formato y la distribución, las cinco Calculadoras con sus fórmulas y referencias, sus entradas, salidas y comportamiento, y los Casos de prueba para la aprobación de la Cátedra.

- **Vocabulario:** el de [`CONTEXT.md`](../../CONTEXT.md). Calculadora, Arreglo equivalente, Aproximación, Topología, Orden, Inventario, Valor dudoso, etc. se usan siempre en ese sentido.
- **Origen de cada decisión:** al final de cada sección hay un enlace a los tickets que la respaldan. El detalle de las fórmulas, las fuentes y los casos numéricos está en las investigaciones de [`research/`](research/). Cuando la spec pase al repo `asistente-e3` (`docs/`), esos enlaces quedan como referencia a esta carpeta de trabajo.
- **Qué no está:** la sección 11 lista lo que quedó fuera de la primera versión, y la sección 12 lo que todavía falta decidir o confirmar antes de construir.

## Índice

1. [Contexto y alcance](#1-contexto-y-alcance)
2. [Formato, distribución y Versiones](#2-formato-distribución-y-versiones)
3. [Stack técnico y estructura del código](#3-stack-técnico-y-estructura-del-código)
4. [Interfaz: navegación, pantallas y estado](#4-interfaz-navegación-pantallas-y-estado)
5. [Comportamiento común a todas las Calculadoras](#5-comportamiento-común-a-todas-las-calculadoras)
6. [Calculadora de bobinas](#6-calculadora-de-bobinas)
7. [Calculadora de filtros](#7-calculadora-de-filtros)
8. [Calculadora de Arreglos equivalentes](#8-calculadora-de-arreglos-equivalentes)
9. [Calculadora de redes de adaptación](#9-calculadora-de-redes-de-adaptación)
10. [Calculadora de atenuadores](#10-calculadora-de-atenuadores)
11. [Fuera de la primera versión](#11-fuera-de-la-primera-versión)
12. [Pendientes antes de construir](#12-pendientes-antes-de-construir)
13. [Casos de prueba y aprobación de la Cátedra](#13-casos-de-prueba-y-aprobación-de-la-cátedra)
14. [Referencias](#14-referencias)

---

## 1. Contexto y alcance

- **Para quién:** Alumnos de una materia de electrónica de comunicaciones que arman circuitos, sobre todo en VHF (30 a 300 MHz), y los montan en Manhattan con componentes con terminales.
- **Quién lo hace:** el Ayudante de cátedra lo diseña y lo mantiene con Claude Code y GitHub. La Cátedra aprueba cada Versión antes de que llegue a los Alumnos, que la reciben por WhatsApp como un link.
- **Plataformas:** Android, iPhone y PC. Funciona sin conexión.
- **Idioma:** interfaz en castellano, con voseo ("Corregí", "Completá").
- **Cinco Calculadoras:** bobinas, filtros, Arreglos equivalentes, redes de adaptación y atenuadores resistivos π y T.
- **Principios que valen para todas:**
  - Cada resultado muestra la fórmula que usa y su referencia bibliográfica. Los pasos intermedios van desplegables y ocultos por defecto.
  - El Asistente nunca bloquea un valor calculado por ser difícil de armar: lo muestra marcado como Valor dudoso o Valor impracticable (sección 5.6). Los únicos cortes son los que se listan en cada Calculadora (menos de una vuelta, 60 dB, Orden mayor que 10, etc.).
  - Un resultado se puede pasar a otra Calculadora: cada L va a la de bobinas y cada C o R a la de Arreglos equivalentes.
  - Lo que no sale de la bibliografía se marca: las Deducciones propias se aprueban aparte y tienen un plan B, y los Criterios prácticos van rotulados como tales.

Origen: [mapa](map.md) (Notes), [Qué Calculadoras entran en la primera versión](issues/08-calculadoras-v1.md).

## 2. Formato, distribución y Versiones

### 2.1 Dos productos desde la misma fuente

| Producto | Para qué | Cómo llega | Inventario y entradas |
|---|---|---|---|
| **PWA** en GitHub Pages | Canal principal, en las tres plataformas | Link por WhatsApp. Se instala en el inicio (en iPhone: Compartir › Agregar a inicio, a mano) | Se guardan (sección 4.4) |
| **HTML único** autocontenido | Respaldo para PC o para quien no pueda instalar | Link "Descargar versión para PC" en el sitio, y adjunto a cada Release de GitHub | Puede no guardarse: el Asistente lo detecta y lo avisa |

- La APK queda descartada.
- **Repositorio público** `asistente-e3`, con el código y la spec final en `docs/`. La Cátedra acepta distribuir un link en lugar de un archivo.
- **Sin conexión:** la PWA usa un service worker que guarda todo en caché. El HTML único lleva todo embebido, incluidas las fórmulas y la fuente.
- **Exportar o importar el Inventario no entra.** Consecuencia aceptada: el Inventario se pierde al cambiar de celular, si el navegador borra los datos, y en iPhone al pasar de la pestaña de Safari a la app instalada, porque no comparten almacenamiento.
- **Persistencia:** `localStorage`, con `navigator.storage.persist()` al abrir la PWA y todas las escrituras dentro de `try/catch`. El HTML único no pide `persist()` y avisa cuando no puede guardar (en Android, un `.html` abierto desde WhatsApp tiene un origen opaco y no guarda).
- El mensaje de WhatsApp con el link explica cómo instalar en iPhone.

### 2.2 Versiones y aviso de versión nueva

- **Versión semántica manual** en `package.json` más el hash corto del commit. Las dos se ven en el encabezado (y en PC también al pie del menú). La Cátedra aprueba una Versión concreta.
- Cuando el service worker nuevo queda en espera, aparece una **franja arriba**, debajo del encabezado: "Hay una versión nueva · Recargar". Al recargar se conservan el Inventario y las entradas.
- Se publica con `git push` de una etiqueta (sección 3.4). No se reenvía nada a los Alumnos.

### 2.3 Riesgos aceptados

- **iPhone:** la PWA no se probó en un iPhone real. Se confía en la documentación de WebKit (instalada en inicio, almacenamiento propio, service worker sin conexión).
- Lo que sí se probó: la PWA en Android real (instala, abre sin conexión, conserva el Inventario, aviso de versión nueva) y en PC; el HTML suelto abre y calcula en Android y en PC.

Origen: [Formatos de distribución](issues/06-formatos-distribucion.md), [Prototipo instalable para elegir el formato](issues/07-prototipo-formato.md), [Stack técnico y estructura del código](issues/15-stack-tecnico.md).

## 3. Stack técnico y estructura del código

### 3.1 Lenguaje y build

- **TypeScript + Preact**, con **Vite**.
- `npm run build` arma la PWA (manifest, service worker, íconos). `npm run build:archivo` arma el HTML único con `vite-plugin-singlefile`. El código distingue el modo con `import.meta.env.MODE`: en el HTML único no registra el service worker, no pide `persist()` y avisa que el Inventario puede no guardarse.
- **Service worker:** `vite-plugin-pwa` (Workbox) en modo `prompt`. La caché se versiona sola con los hashes del build. `useRegisterSW` de Preact maneja la franja de versión nueva.
- **Navegadores de destino:** Chrome en Android y Safari en iOS de los últimos ~3 años, con salida ES2020.
- **Formato y control:** Prettier y `tsc --noEmit`, sin ESLint al principio. Node 24 fijado en `.nvmrc` y en el workflow.

### 3.2 Carpetas

| Carpeta | Contenido |
|---|---|
| `src/calculo/<calculadora>/` | Funciones puras, sin DOM ni almacenamiento. Reciben números en SI y devuelven el resultado **con los pasos intermedios y la referencia bibliográfica como datos** (cadenas LaTeX, sección 5.4). La interfaz solo los muestra. Cada plan B de una Deducción propia queda detrás de una bandera acá. |
| `src/calculo/comun/` | Lo compartido: series E, barrido de frecuencia (ABCD con complejos), búsqueda de Arreglos equivalentes (la usan Arreglos y atenuadores), red L serie-paralelo (la usan redes y resonadores acoplados), criterio de valor impracticable y formateador de números para LaTeX. |
| `src/entrada/` | Parser puro de la Entrada flexible y formateador de salida. |
| `src/almacen/` | Inventario, entradas y última Calculadora en `localStorage`, con un JSON que lleva un campo `version` desde el primer día para poder migrar. |
| `src/ui/` | Componentes, uno por Calculadora, más el armazón (navegación, encabezado, franja de versión). Los colores, la tipografía, los tamaños y el espaciado están en `src/ui/tokens.css` ([ADR 1](adr/0001-modo-oscuro-segun-el-sistema.md)). |
| `src/ui/comun/` | Los componentes base que comparten las Calculadoras: tarjeta de resultado, forma del resultado (avisos, resultado principal, tarjetas y notas fijas), fórmula en Temml, cita de la referencia, pasos intermedios, campos, rótulos, botón de pase, franjas y el esquema en escalera. |
| `src/muestra/` | La página de muestra del sistema visual, para revisarlo en el celular. No entra en ninguno de los dos productos. |
| `scripts/` | Pasos de construcción que no hace Vite: los PNG del ícono del Asistente, el recorte de Latin Modern Math y la copia del HTML único dentro de la PWA. `scripts/informe/` arma el Informe de casos (sección 13.6) con las tablas de `tests/`; no entra en el Asistente. |
| `tests/` | Vitest. `tests/oraculos/` tiene los oráculos independientes (sección 13.4). |

### 3.3 Tests

- **Vitest** para `src/calculo/` y `src/entrada/`, y para las funciones puras de `src/ui/` (el trazado del esquema y el contraste de la paleta).
- Los Casos de prueba se escriben **como tablas de datos** (entradas, esperado, tolerancia con motivo, referencia). Las mismas tablas corren en Vitest y alimentan el Informe de casos (sección 13).
- En la primera versión no hay tests de interfaz. Si el pase entre Calculadoras resulta frágil, se suman tests de componentes con `@testing-library/preact`.

### 3.4 Publicación

- **GitHub Actions**, en cada push a `main`: `tsc --noEmit`, los tests, los dos productos y el Informe de casos, que quedan como artefactos descargables para revisar el candidato.
- **Solo una etiqueta `vX.Y.Z` publica en Pages** y crea una Release con el HTML único y el Informe adjuntos. El workflow no publica si fallan los tests o si `docs/aprobaciones.md` no tiene la entrada de esa Versión con ese hash (sección 13.7).

Origen: [Stack técnico y estructura del código](issues/15-stack-tecnico.md), [Casos de prueba e informe para la aprobación de la Cátedra](issues/24-casos-de-prueba-aprobacion.md).

## 4. Interfaz: navegación, pantallas y estado

### 4.1 Navegación según el ancho

| Ancho | Navegación | Disposición de la Calculadora |
|---|---|---|
| **Celular** (menos de ~900 px, también una tablet en vertical) | **Pestañas abajo** con las cinco Calculadoras (ícono y nombre corto) | Una columna: entradas arriba, resultados abajo |
| **PC** (desde ~900 px) | **Menú lateral fijo** a la izquierda, con el nombre y una descripción corta de cada Calculadora, y la Versión y el link "Descargar versión para PC" al pie | **Entradas y resultados lado a lado:** las entradas en una columna fija a la izquierda y los resultados a la derecha |

- Es el mismo código con un corte por ancho de pantalla. El valor exacto del corte se ajusta al construir.
- **No hay pantalla de inicio:** el Asistente abre directo en una Calculadora (sección 4.4).
- El encabezado muestra el nombre de la Calculadora y la Versión.

### 4.2 Pase de un valor a otra Calculadora

- Los botones de pase están junto a cada valor del resultado: "→ Bobinas" en cada L y "→ Arreglos" en cada C o R, salvo donde una Calculadora diga lo contrario.
- La otra Calculadora se abre **en la misma pantalla**. En el celular cambia la pestaña activa, y en PC el elemento activo del menú.
- Arriba de la Calculadora de destino aparece una **franja de llegada**: "Desde ‹Calculadora›: C1 = 87,4 pF", con el botón **"‹ Volver a ‹Calculadora›"** y una ✕ para quitarla.
- **Al volver, la Calculadora de origen conserva lo que tenía.** Los pases encadenados se apilan y "Volver" deshace de a uno. Si el Alumno cambia de Calculadora desde las pestañas o el menú, la pila se vacía.
- **Qué lleva el pase:**
  - el valor con **precisión completa**, no el texto redondeado. El campo de destino muestra el valor con 4 cifras, y mientras ese texto no se edite se usa el valor completo;
  - en el pase a bobinas, la frecuencia de evaluación del origen precargada como frecuencia de trabajo;
  - en el pase a Arreglos equivalentes, el tipo de componente (capacitor o resistencia) ya elegido;
  - el aviso del origen: si el valor era un Valor dudoso o impracticable, la franja de llegada repite el rótulo y su motivo.
- El botón de pase de un valor con aviso lleva un punto del color del nivel.

### 4.3 Campos

- **Campos de opciones** (Tipo de filtro, Aproximación, Topología, serie E, tipo de componente, etc.): **etiqueta arriba** y botones segmentados a todo el ancho.
- **Campos de valor:** **etiqueta al costado**, con el campo y el Selector de unidad en la misma fila, y el eco en vivo debajo del campo ("= 4,7 nH").
- Teclado de texto completo, sin autocorrección (sección 5.1).

### 4.4 Estado y persistencia

- **Se guardan** en `localStorage`, junto al Inventario:
  - las entradas de cada Calculadora (el texto de cada campo y su Selector de unidad);
  - la última Calculadora abierta.
- **No se guardan** la pila de pases ni las franjas de llegada.
- Al reabrir el Asistente, o al recargar por una versión nueva, abre en la última Calculadora con sus entradas.
- **La primera vez** abre en la Calculadora de bobinas, la primera del menú.

### 4.5 Resultados largos

- **Una tarjeta debajo de otra** (en PC, en grilla). No hay carrusel.
- Va primero la tarjeta con el resultado principal, la fórmula visible y los pasos intermedios desplegables. Después vienen las tarjetas de variantes, de vecinos o los 10 Arreglos.
- Una fórmula que no entra a lo ancho se corta en líneas y, si aún no entra, tiene scroll horizontal propio (sección 5.4). La página nunca tiene scroll horizontal.

Origen: [Prototipo de navegación entre Calculadoras](issues/22-prototipo-navegacion.md) (prototipo en [`prototipos/navegacion/`](prototipos/navegacion/LEEME.md)).

## 5. Comportamiento común a todas las Calculadoras

### 5.1 Entrada flexible

Un campo de valor acepta número, prefijo y unidad opcionales, en notación RKM o científica, con coma o punto decimal ("4n7", "4,7 nH", "0.0047u"). El parser es puro y está en `src/entrada/`; solo lee. Los rangos válidos de cada campo los fija su Calculadora.

**Prefijos**

- Mayúsculas y minúsculas se distinguen **solo en m/M** (mili/mega) **y p/P** (pico/peta), con la grafía oficial: "100m" es 100 mili, y "P" es peta.
- Las demás letras se aceptan en cualquier variante: n/N, u/U/µ (U+00B5)/μ (U+03BC), k/K, g/G, y "meg" (en cualquier mezcla de mayúsculas) para mega.
- Cada magnitud admite su propio juego:

| Magnitud | Prefijos | Selector de unidad (por defecto, en negrita) |
|---|---|---|
| Inductancia (H) | n, µ, m | **nH**, µH |
| Capacidad (F) | p, n, µ | **pF**, nF, µF |
| Resistencia (Ω) | k, M | **Ω**, kΩ, MΩ |
| Frecuencia (Hz) | k, M, G | **MHz**, kHz, GHz |
| Potencia (W) | µ, m | **W**, mW, dBm (solo en atenuadores) |
| Largos | ninguno | **mm** (fijo) |

- Un prefijo que existe pero queda fuera del juego da error con sugerencia: *"mHz no tiene sentido acá; para mega usá M mayúscula: 100M"*, *"Para pico usá p minúscula"*.

**Notación RKM**

- Solo en L, C y R: "4n7", "2p2", "4k7", "1M5".
- La "R" como coma o como final ("R47", "47R", también "r47") vale solo en resistencia.
- En otro campo da error con sugerencia: *"Escribí 145,5M"*.

**Números**

- La coma y el punto son los dos separadores decimales. **No hay separador de miles:** con más de un separador ("1.000,5") el valor no se puede leer.
- Aviso suave para un separador seguido de exactamente 3 dígitos con parte entera distinta de cero ("1.000", "4,700"): *"Se leyó 1 Ω. Para mil, escribí 1000 o 1k."* El valor se acepta igual.
- Notación científica ("4.7e-9", "4,7E-9"), pero sin combinarla con un prefijo.
- El signo menos solo vale en dBm. Si el cero vale o no lo decide cada Calculadora (la Separación entre vueltas lo admite).
- Los campos adimensionales (Q, dB, %, Orden) aceptan solo el número, con "%" opcional donde corresponde. El Orden acepta solo enteros.
- Los espacios se ignoran al principio, al final y entre el número y el prefijo o la unidad. Dentro del número ("1 000") no valen.

**Unidades y Selector de unidad**

- Se pueden escribir y no distinguen mayúsculas: H, F, Ω/ohm/ohms, Hz, W, dBm, mm, %. Como el prefijo es estricto, "100mhz" se lee 100 mHz y cae en el error de prefijo fuera del juego.
- Una unidad que no corresponde al campo da error con motivo (*"Este campo es de inductancia (H)"*). El valor no se redirige a otro campo.
- Los campos de largo (Diámetro del carrete, Diámetro del cable, Separación entre vueltas) aceptan solo el número y "mm" opcional, sin prefijos, para evitar la ambigüedad de "5m".
- Un número sin prefijo ni unidad se toma en la unidad del Selector de unidad. **Lo que se escribe manda sobre el selector** ("4,7n" con el selector en pF da 4,7 nF), y el selector no cambia.

**Eco y errores**

- Debajo del campo hay un **eco en vivo** con el valor normalizado en el formato de salida: "= 4,7 nH".
- Un valor que no se puede leer marca el campo en rojo con un motivo de una línea: *"No entiendo «4,7x»"*, *"Este campo es de capacidad (F)"*.
- **Con un campo inválido no se calcula.** El área de resultados muestra *"Corregí: Diámetro del cable"* y no deja el resultado viejo. Con un campo obligatorio vacío muestra *"Completá: …"*.

**Teclado del celular:** `inputmode="text"`, con `autocorrect`, `autocapitalize` y `spellcheck` apagados. El teclado numérico no tiene letras y no permite escribir "4n7".

Origen: [Reglas de la entrada flexible](issues/21-reglas-entrada-flexible.md).

### 5.2 Formato de salida

- Coma decimal, prefijo de ingeniería (exponente múltiplo de 3) con grafía oficial (p, n, µ, m, k, M, G) y espacio antes de la unidad: "4,7 nH", "145 MHz", "1,2 kΩ".
- **3 cifras significativas** en los resultados y **4 en los pasos intermedios**, sin ceros de relleno. dB con 2 decimales y % con 2 cifras significativas. Los errores relativos van con signo y con el signo menos tipográfico (−).
- **Ida y vuelta:** todo texto de salida vuelve a leerse con la Entrada flexible y da el mismo valor redondeado. Es una propiedad que se verifica con Vitest.

Origen: [Reglas de la entrada flexible](issues/21-reglas-entrada-flexible.md).

### 5.3 Forma del resultado

Cada Calculadora muestra, en este orden:

1. **Avisos** de la Calculadora que afectan a todo el resultado (por ejemplo, la pérdida plana de un filtro con R_s ≠ R_L).
2. **Resultado principal**, con la fórmula visible, su referencia bibliográfica (autor, obra, edición, ecuación o página) y los **pasos intermedios** en un desplegable cerrado por defecto. Los pasos muestran la fórmula de cada valor con los números sustituidos, con 4 cifras.
3. **Tarjetas** de variantes, vecinos o resultados, cada una con sus valores, sus botones de pase y su bloque de motivos (sección 5.6).
4. **Notas fijas** de construcción.

Rótulos que puede llevar un valor o una fórmula:

| Rótulo | Cuándo |
|---|---|
| *estimación* | Un valor aproximado por construcción: SRF, pérdida de Cohn, pérdida por Q de la bobina |
| *criterio práctico* | Una regla de montaje que no sale de la bibliografía: umbrales de Valor dudoso e impracticable, Ventana de L, ±20 % del trimmer |
| *criterio de diseño* | Una práctica habitual sin fuente primaria: el margen de potencia de 2× en atenuadores |
| *deducción propia* | Una fórmula o adaptación no publicada (sección 13.5) |

### 5.4 Fórmulas en pantalla

- **Temml** (0.14.0, salida MathML). Suma 61 KB gzip. Su CSS pone `math { display: inline-flex; flex-wrap: wrap }` en toda la página, cosa que no molesta mientras todo el MathML salga de Temml.
- **Fuente:** Latin Modern Math (licencia GUST, de CTAN), recortada con `fontTools` a los caracteres del Asistente (88 KB en woff2) y embebida. Temml y la fuente suman 147 KB gzip al HTML único; en la PWA la fuente es un archivo aparte que queda en la caché.
- **Las fórmulas se escriben en `src/calculo/` como cadenas LaTeX** con los valores ya interpolados, más el texto que las acompaña:
  - las fracciones con `\dfrac`, nunca con `\displaystyle` adelante (Temml solo corta líneas en modo en línea);
  - la coma decimal como `0{,}6475`, las unidades como `\,\mathrm{nH}` y "sen" con `\operatorname{sen}`;
  - un formateador de `src/calculo/comun/` devuelve el número y la unidad ya escritos así.
- **Corte de línea:** `temml.renderToString(src, { displayMode: false, wrap: "tex" })` corta después de cada `=` y de cada operador de primer nivel. Cada fórmula va en un contenedor con `overflow-x: auto` para lo que no se puede cortar. Si una fórmula sustituida no entra en 375 px, se parte en pasos más cortos (por ejemplo, la L de una capa sustituida se parte en Ls, la corrección y la resta).
- **Construcción:** el recorte de la fuente lo arma un script que guarda la lista de rangos Unicode, y un test verifica que todos los caracteres que generan las fórmulas estén en la fuente recortada.
- Las mismas cadenas LaTeX se usan en el Informe de casos.

Origen: [Prototipo de renderizado de fórmulas en el celular](issues/18-prototipo-formulas.md) (prototipo en [`prototipos/formulas/`](prototipos/formulas/LEEME.md)).

### 5.5 Pase entre Calculadoras: qué pasa a dónde

| Desde | Valor | Va a | Precarga |
|---|---|---|---|
| Filtros (π, T) | cada L | Bobinas | La L, y fc (pasa bajos y pasa altos) o f2 (pasa banda y rechaza banda) como frecuencia de trabajo |
| Filtros (π, T) | cada C | Arreglos equivalentes | La C, con tipo capacitor |
| Filtros, resonadores acoplados | la L de los resonadores | Bobinas | La L y la Frecuencia de sintonía |
| Filtros, resonadores acoplados | Capacitores de acople y de extremo | Arreglos equivalentes | La C, con tipo capacitor. Los Capacitores de sintonía **no** se pasan: van con trimmer |
| Filtros con R_s ≠ R_L (π, T) | el aviso de pérdida plana | Redes de adaptación | R_s y R_L; f₀ solo si el filtro es pasa banda |
| Redes de adaptación | cada L | Bobinas | La L y f₀ |
| Redes de adaptación | cada C | Arreglos equivalentes | La C, con tipo capacitor |
| Atenuadores | cada resistencia | Arreglos equivalentes | La R, con tipo resistencia. Nota: en un Arreglo equivalente la potencia se reparte entre los componentes |

Las Calculadoras de bobinas y de Arreglos equivalentes no pasan valores a otras.

### 5.6 Criterio común de valor impracticable

Una función de `src/calculo/comun/` revisa **automáticamente cada L, C y R** del resultado de cualquier Calculadora, incluidos los Capacitores de sintonía y las combinaciones redondeadas de atenuadores. No hay excepciones en la primera versión (una Calculadora podría declararlas, con su motivo).

**Montaje supuesto** (sin preguntarle al Alumno): Manhattan con terminales cortos. En la materia no se usa protoboard, así que no hay aviso por protoboard.

| Parámetro | Valor | De dónde sale |
|---|---|---|
| Incertidumbre de L por nodo | ±3 nH | Terminales de 0,4 nH/mm cerca del plano, con unos ±5 a 7 mm de incierto |
| Incertidumbre de C por nodo | ±0,5 pF | Islas de FR-4 de 3×3 a 5×5 mm, que suman de 0,2 a 0,8 pF a masa (cálculo propio) |
| ESL de un capacitor | 2,8 nH | Radial de paso 2,54 mm con terminales de 3 mm (`research/valor-impracticable.md` §4.2) |
| Resistencia | axial de película: 4,5 nH en serie y 0,43 pF en paralelo | Brinson, ajuste a medición |

Estos cuatro parámetros están en un solo lugar del código, para poder cambiarlos si la Cátedra mide un montaje.

**Una sola medida, dos niveles.** Todo se mide con el error relativo de la impedancia, |Z_real − Z_calculada| / |Z_calculada|:

| Componente | Error relativo |
|---|---|
| L chica | ΔL/L, con ΔL = 3 nH |
| C chica | ΔC/C, con ΔC = 0,5 pF |
| C cerca de su autorresonancia | (f/f_SRF)² / (1 − (f/f_SRF)²), con f_SRF = 1/(2π·√(ESL·C)) |
| R | La reactancia parásita sobre R: ω·Ls/R en el extremo bajo y ω·Cp·R en el alto |

- **Valor dudoso:** error ≥ 20 %. **Valor impracticable:** error ≥ 50 %.
- **Nunca se bloquea:** el valor se muestra siempre, marcado con su nivel.

**Umbrales que resultan** (no son una tabla aparte: salen de la medida, y sirven para verificarla):

| | Valor dudoso (≥ 20 %) | Valor impracticable (≥ 50 %) |
|---|---|---|
| L mínima | < 15 nH | < 6 nH |
| C mínima | < 2,5 pF | < 1 pF |
| C máxima a 30 / 100 / 150 / 300 MHz | > 1675 / 151 / 67 / 17 pF | > 3350 / 302 / 134 / 34 pF |
| R fuera de, a 30 MHz | 4,2 Ω – 2,5 kΩ | 1,7 Ω – 6,2 kΩ |
| R fuera de, a 100 MHz | 14 Ω – 740 Ω | 5,7 Ω – 1,85 kΩ |
| R fuera de, a 150 MHz | 21 Ω – 490 Ω | 8,5 Ω – 1,2 kΩ |
| R fuera de, a 300 MHz | 42 Ω – 250 Ω | 17 Ω – 620 Ω |

- **Criterio mixto:** los mínimos de L y C son fijos. El C máximo es `C_máx = x²/((2πf)²·ESL)`, con x² = 1/6 (20 %) o 1/3 (50 %). El rango de R es `R_mín = ω·Ls/k` y `R_máx = k/(ω·Cp)`, con k = 0,2 o 0,5. Estos dos solo se evalúan cuando la Calculadora conoce f.
- **No hay L máxima común:** toda L pasa a la Calculadora de bobinas, que avisa por autorresonancia con la geometría real.

**Frecuencia de evaluación**

| Calculadora | f |
|---|---|
| Filtros | fc en pasa bajos y pasa altos (en pasa altos, una nota aclara que el desvío crece por encima de fc); f2 en pasa banda y rechaza banda |
| Redes de adaptación | f₀ |
| Bobinas | La frecuencia de trabajo, si está. Sin ella, solo se aplica la L mínima a la L buscada |
| Atenuadores | La frecuencia opcional. Si está vacía, 300 MHz (el peor caso de la banda), y el aviso lo dice |
| Arreglos equivalentes | No pide frecuencia: solo aplica la C mínima al valor buscado |

**Cómo se muestra**

- **Rótulo junto al valor:** "Valor dudoso" en ámbar o "Valor impracticable" en rojo.
- **Bloque de motivos al pie de la tarjeta**, con:
  - el motivo de cada valor con números, por ejemplo *"C1: suponiendo montaje Manhattan, ±0,5 pF → 25 % de error"*;
  - la sugerencia de la Calculadora, si tiene una (tabla de abajo);
  - el rótulo *criterio práctico*.
- La cuenta (ΔL/L, f/f_SRF o X/R) va en los pasos intermedios con sus fuentes: KOA y Brinson para las resistencias, KYOCERA AVX para la ESL y la NBS Circular 74 para los terminales.

| Calculadora | Sugerencia |
|---|---|
| Filtros (π, T) | Cambiar de Topología π ↔ T; en rechaza banda, ensanchar la banda |
| Filtros, resonadores acoplados | Bajar el Orden |
| Redes de adaptación | Probar otra variante o bajar el Q de diseño |
| Atenuadores | Mirar la otra Topología (el π de 40 dB aguanta mucho mejor que el T) |

**Lo que no cubre:** los números no se contrastaron con el ARRL Handbook ni con *Experimental Methods in RF Design*, ni se midió un montaje Manhattan con un analizador. Por eso el criterio va rotulado como criterio práctico.

Origen: [Datos para los umbrales de valor impracticable en VHF](issues/19-datos-valor-impracticable.md), [Criterio común de valor impracticable](issues/20-criterio-valor-impracticable.md), [`research/valor-impracticable.md`](research/valor-impracticable.md).

### 5.7 Barrido en frecuencia

Lo usan las redes de adaptación (ancho de banda, armónicas y pérdida), los resonadores acoplados (verificación del Orden) y los atenuadores (atenuación y adaptación con valores redondeados). Es un análisis ABCD con complejos de la red completa, entre R_s y R_L, con la ganancia de transductor:

```
|S21|² = 4·R_s·R_L / |A·R_L + B + C·R_s·R_L + D·R_s|²
Zin    = (A·R_L + B) / (C·R_L + D)
```

- Elemento en serie: `[[1, Z], [0, 1]]`. Elemento en derivación: `[[1, 0], [Y, 1]]`.
- Componentes ideales, salvo cuando se estima una pérdida: una R en serie con cada L, de valor ω₀·L/Q (redes de adaptación), o una R en paralelo de Qu·ω₀·L (resonadores acoplados).
- Los bordes a −3 dB se buscan desde f₀ hacia cada lado y se refinan por bisección. Si no hay cruce en el rango barrido, se informa "sin borde inferior" o "sin borde superior".

## 6. Calculadora de bobinas

Calcula las vueltas y el largo de una bobina solenoidal de aire, de una y de dos capas, a partir de la inductancia y la geometría.

### 6.1 Entradas

| Campo | Unidad | Por defecto | Validación |
|---|---|---|---|
| Inductancia buscada | nH | vacío | > 0 |
| Diámetro del carrete | mm | vacío | > 0 |
| Diámetro del cable (con esmalte) | mm | vacío | > 0 |
| Separación entre vueltas | mm | 0 | ≥ 0 |
| Frecuencia de trabajo (opcional) | MHz | vacío | > 0. Viene precargada cuando la bobina llega desde otra Calculadora |

- Solo se pide el Diámetro del cable con esmalte, sin diámetro desnudo ni AWG. Para alambre desnudo o plateado se ingresa el diámetro desnudo. El efecto de usar el diámetro con esmalte en ks (menos del 0,5 %) se documenta en los pasos intermedios.
- No hay tope de N ni de L.
- Siempre se calculan las dos variantes, una capa y dos capas. No hay selector.

### 6.2 Geometría

Todo en SI, con μ0 = 4π·10⁻⁷ H/m.

| Magnitud | Definición |
|---|---|
| d | Diámetro del cable, con esmalte |
| s | Separación entre vueltas |
| p = d + s | Distancia entre centros de vueltas vecinas |
| D0 = Diámetro del carrete + d | Diámetro al centro del cable (el de baja frecuencia) |
| ℓ = N·p | Largo de la lámina de corriente: el que va en las fórmulas, **solo en los pasos intermedios**, con una aclaración |
| (N − 1)·p + d | **Largo de la bobina**, medido por fuera: el que se muestra en el resultado |

**Dos capas:** n vueltas por capa y N = 2n en total, con las mismas vueltas en las dos capas. La segunda capa va **apilada** sobre la primera, bobinada en el mismo sentido, sin selector. Una nota aclara que si las vueltas se acomodan en las ranuras la L baja cerca de un 1 %. Para las fórmulas: b = n·p (largo), c = 2d (profundidad) y a = Diámetro del carrete/2 + d (radio medio). Diámetro exterior: Diámetro del carrete + 4d.

### 6.3 Fórmulas: una capa

**Rosa y Nagaoka, con kL de Lundin** (Knight, *Solenoid Inductance Calculation*, ec. 10.6; Lundin 1985):

```
L  = Ls − μ0·D·N·(ks + km)/2
Ls = μ0·π·D²·N²·kL(x)/(4ℓ),   x = D/ℓ
```

- **kL (Lundin)**, error < 3 ppm para cualquier ℓ/D:
  - x < 1 (bobina larga): `kL = (1 + 0,383901x² + 0,017108x⁴)/(1 + 0,258952x²) − 4x/(3π)`
  - x ≥ 1 (bobina corta): `kL = 2/(πx)·[(ln(4x) − 0,5)·(1 + 0,383901/x² + 0,017108/x⁴)/(1 + 0,258952/x²) + 0,093842/x² + 0,002029/x⁴ − 0,000801/x⁶]`
- **ks, parte externa** (la que corresponde en VHF, donde el efecto pelicular anula la inductancia interna): `ks = 3/2 − ln(2p/d)`.
- **km** (Grover extendida por Knight, ec. 10.18, válida para N no entero):
  `km = ln(2π) − 3/2 − ln(N)/(6N) − 0,33084236/N − 1/(120N³) + 1/(504N⁵) − 0,0011925/N⁷ + 0,000507/N⁹`.
  Control: km(1) = 0, km(2) = 0,113706, km(40) = 0,314236.
- **Diámetro efectivo de RF** (Knight, ec. 4.2), con el que se calcula el **resultado principal** de una capa: se reemplaza D por D∞ en la fórmula de L.
  ```
  Dmin = D0 − d + 2d/N
  w    = 1/((p/d) − 1)²          (con s = 0, w → ∞ y D∞ = Dmin)
  D∞   = (D0 + Dmin·w)/(1 + w)
  ```
  Es semiempírica, sin referato, y va aclarado así. La L y el N con D0 van en los pasos intermedios. **Es una Deducción propia a aprobar** (sección 13.5); el plan B usa D0 en el resultado principal y deja la corrección de RF como nota.

### 6.4 Fórmulas: dos capas

**Rosa y Grover (91) con la corrección de Maxwell (93)** (Rosa y Grover 1912; NBS Circular 74, ec. 156 y 159), con D0:

```
L   = Ls − ΔL1 + ΔL2
Ls  = μ0·π·(2a)²·N²·kL(2a/b)/(4b)
ΔL1 = μ0·a·N²·(c/b)·(0,693 + Bs(b/c))
ΔL2 = μ0·a·N·[ln(D'/d) − 0,1119 + E],   D' = √(p·d)
```

- **Bs** (Rosa y Grover, Tabla X), con un ajuste cerrado propio de error < 10⁻⁵ para n' = b/c ≥ 1:
  `Bs(n') ≈ 0,3522843 − ln(n')/(6n') − 0,3471888/n' − 0,0004105/n'² − 0,0046850/n'³` (Bs(1) = 0 exacto).
- **Adaptaciones propias**, marcadas como tales en la referencia: "Rosa y Grover (91) y (93), con adaptación propia para RF y Separación, verificada contra suma de anillos":
  - versión externa de Maxwell para RF: `−0,1119 = ln(2·0,447049)` en lugar de `+0,13806`;
  - D' = √(p·d) para la Separación entre vueltas;
  - el ajuste de Bs.
- **E = 0,017** (Circular 74) se mantiene en la versión externa: corrige la mutua entre vueltas vecinas, que no depende de la inductancia interna. Contra la suma de anillos acerca las 7 geometrías de los casos: de −0,51 a +0,05 % con E, de −0,60 a −0,09 % sin E (ticket 34, pendiente P2).
- **Es una Deducción propia a aprobar** (sección 13.5). Plan B: Rosa (91) sin ΔL2, que tiene cita directa. Contra la suma de anillos da de −0,03 a +0,19 % con vueltas juntas, pero −0,83 % con s = d/2 y −2,8 % con s = d (ticket 34).
- Se calcula con D0. Un aviso dice que en RF la L real va a quedar algo por debajo, sin cuantificarlo.
- **Rango:** n' = b/c ≥ 1 y c/a ≤ 0,42. El NBS da unas pocas partes en mil hasta c/a = 0,25; de ahí a 0,42 el rango se amplió hasta donde está verificado contra la suma de anillos (−0,51 a +0,05 %), porque con 0,25 casi todas las bobinas de dos capas de VHF quedaban afuera (pide d ≤ Diámetro del carrete/14). La ampliación es parte de la Deducción propia (ticket 34). Fuera de ese rango no se muestran números de dos capas, solo el motivo. n' se mira en el vecino de abajo, porque sus números también se muestran (ticket 34).

### 6.5 Despeje de N

- L(N) es estrictamente creciente, así que se despeja **por bisección** sobre N real: `lo = 1`, `hi = 2` y se duplica `hi` hasta que L(hi) ≥ L buscada; después se itera hasta `(hi − lo)/hi < 10⁻⁹`. Converge siempre. En dos capas, lo mismo sobre n, desde el n con n' = 1 (o desde una vuelta por capa, si las vueltas están tan separadas que n' = 1 pide menos): si ahí L ya pasa la buscada, dos capas queda fuera de rango (ticket 34).
- **Con D∞, si el cable es más grueso que el carrete**, D∞ tiende al carrete y la corrección de Rosa supera a la lámina: la L de RF deja de crecer con N. Si `hi` pasa de 2³⁰ sin llegar a la L buscada, no se calcula y se avisa que el modelo de solenoide no sirve (ticket 33).
- **Si L(1) > L buscada** (menos de una vuelta), no se calcula: se avisa que hace falta un lazo o una pista.

### 6.6 Salidas

**Una tarjeta por variante** (una capa, dos capas):

- **Los dos vecinos en pasos de media vuelta** alrededor del N real, cada uno con:
  - las vueltas (en dos capas, las vueltas por capa y el total, que puede ser impar: 5,5 por capa son 11 vueltas);
  - su L (en una capa, la de RF);
  - su error respecto de la L buscada, con signo;
  - el Largo de la bobina.
  
  El más cercano se destaca.
- En dos capas, además, el diámetro exterior.
- **SRF estimada**, rotulada como estimación: la menor entre
  - el criterio del largo de hilo, `f ≈ c/(2·ℓw)` con `ℓw = √((π·D·N)² + ℓ²)`, y
  - la fórmula de Medhurst, `CL/D [pF/cm] = 0,1126·(ℓ/D) + 0,08 + 0,27/√(ℓ/D)` y `f ≈ 1/(2π·√(L·CL))`.

  En dos capas se usan las mismas con el diámetro medio D_m = 2a, N = 2n, el hilo que avanza b y vuelve b (`ℓw = √((π·D_m·N)² + (2b)²)`) y ℓ/D = b/D_m en Medhurst. Una nota aclara que son estimaciones de una capa y que la capacidad entre capas baja la SRF real (ticket 34).
- Una nota corta: estirar o comprimir la bobina ajusta la L. No se calcula la Separación que da la L exacta con N entero.

**Pasos intermedios:**

- El N real, D0, Dmin, D∞, ℓ (con la aclaración de que no es el Largo de la bobina), x, kL, ks, km, Ls, la corrección y la L sustituida, partida en pasos cortos para que entre en 375 px.
- La L y el N con D0 (una capa).
- **Wheeler 1928** (una capa, `L[µH] = a²n²/(9a + 10b)` en pulgadas) y **Hazeltine** (dos capas, `0,8a²n²/(6a + 9b + 10c)`), cada una con su N, su rango declarado y la diferencia en %, más una línea que explica por qué no son el cálculo principal (no tienen en cuenta el cable redondo, y Hazeltine queda fuera de su rango en dos capas).

### 6.7 Avisos y notas

| Caso | Tratamiento |
|---|---|
| Menos de una vuelta | No se calcula; hace falta un lazo o una pista. La L buscada se marca igual (sección 5.6) |
| Cable más grueso que el carrete, con D∞ | No se calcula: la L de RF no crece con las vueltas (sección 6.5) |
| N < 2 en una capa | Se calcula, con aviso: el modelo de solenoide pierde precisión y los terminales dominan |
| Dos capas fuera de rango (n' < 1 o c/a > 0,42) | Solo el motivo, sin números. Una capa se muestra siempre. Con vueltas muy separadas, el motivo puede ser que haría falta menos de una vuelta por capa |
| Frecuencia de trabajo > SRF/3 | Aviso de autorresonancia. En dos capas, con su propia SRF, dentro de su tarjeta |
| Dos capas, siempre | Aviso de que en RF la L real queda algo por debajo, sin cuantificarlo, y nota de las ranuras |
| L buscada < 100 nH | La nota de terminales (unos 8 nH/cm, Knight) pasa a aviso destacado. No hay campo para el largo de los terminales |
| L buscada debajo de la L mínima | Valor dudoso (< 15 nH) o impracticable (< 6 nH), sección 5.6 |
| Siempre | Nota de terminales y nota de que el metal cercano baja la L |

### 6.8 Referencias que se muestran

- Rosa (1906) y Rosa y Grover (1912), en la forma de Knight, *Solenoid Inductance Calculation* (2016), ec. 10.6, 10.4 y 10.18; Lundin, *Proc. IEEE* 73(9), 1985.
- Knight, ec. 4.2 (diámetro efectivo de RF), aclarado como semiempírico.
- NBS Circular 74 (1918), ec. 156 y 159; Rosa y Grover (1912), Tabla X.
- Knight, *The self-resonance and self-capacitance of solenoid coils* (2016); Medhurst, *Wireless Engineer*, 1947.
- Wheeler, *Proc. IRE* 16(10), 1928.

Origen: [Fórmulas para bobinas solenoidales de aire de una y dos capas](issues/01-formulas-bobinas.md), [Alcance de la Calculadora de bobinas](issues/11-alcance-calculadora-bobinas.md), [`research/formulas-bobinas.md`](research/formulas-bobinas.md).

## 7. Calculadora de filtros

Calcula filtros LC: escaleras π o T para los cuatro Tipos de filtro y, en pasa banda, la Topología de resonadores acoplados.

### 7.1 Entradas

| Campo | Opciones o unidad | Notas |
|---|---|---|
| Tipo de filtro | Pasa bajos · Pasa altos · Pasa banda · Rechaza banda | |
| Aproximación | Butterworth · Chebyshev · Bessel | La elíptica no entra |
| Ripple (solo Chebyshev) | dB | Libre entre 0,01 y 3 dB, con atajos para 0,1, 0,5 y 1 dB |
| Topología | π · T · Resonadores acoplados (solo pasa banda) | Por defecto, la que usa menos bobinas (π en pasa bajos de Orden impar, T en pasa altos de Orden impar), con una nota corta que lo explica. El Alumno la puede cambiar |
| Orden | Ingresar (1 a 10) · Calcular desde una atenuación | Para calcularlo se pide la atenuación mínima As (dB) a una frecuencia fs |
| Frecuencias, pasa bajos y pasa altos | fc (MHz) | Butterworth y Bessel: −3 dB. Chebyshev: borde del ripple |
| Frecuencias, pasa banda y rechaza banda | Selector: f1 y f2 · f0 y BW | Con f0 y BW, un aviso aclara que f0 se toma como central geométrica √(f1·f2) |
| R_s (fuente) y R_L (carga) | Ω | Pueden ser distintas (sección 7.4) |
| Q de las bobinas (Qu) | — | Editable, 100 por defecto, para la pérdida de Cohn (sección 7.8). Lo ingresa el Alumno |
| L de los resonadores (solo resonadores acoplados) | nH | Propuesta por el Asistente y editable (sección 7.7) |

- Con f0 y BW: `f1,2 = √(f0² + (BW/2)²) ∓ BW/2`. Con f1 y f2: `f0 = √(f1·f2)` y `BW = f2 − f1`. El resultado muestra siempre f1, f2, f0 y BW.
- El Orden va de 1 a 10 en todas las Aproximaciones.

### 7.2 Método

Prototipo pasa bajos normalizado (g0 = 1, corte en 1 rad/s, elementos g1…gn y carga g(n+1)), transformación de frecuencia según el Tipo de filtro y escala de impedancia por R0 (Matthaei, Young y Jones, cap. 4, 8 y 12; Pozar §8.4). En π el elemento g1 va en derivación junto a la fuente; en T va en serie. A partir de ahí alternan.

### 7.3 Coeficientes g del prototipo (terminaciones iguales)

- **Butterworth** (Matthaei ec. 4.05-1): `gk = 2·sen[(2k − 1)·π/(2n)]`, g(n+1) = 1.
- **Chebyshev** (Matthaei ec. 4.05-2), con ripple r en dB:
  ```
  β  = ln[coth(r/17,37)]
  γ  = senh[β/(2n)]
  ak = sen[(2k − 1)·π/(2n)],   bk = γ² + sen²(k·π/n)
  g1 = 2·a1/γ;   gk = 4·a(k−1)·ak / [b(k−1)·g(k−1)],  k = 2…n
  g(n+1) = 1 si n es impar;  coth²(β/4) si n es par
  ```
- **Bessel:** no tiene fórmula cerrada. Se **guarda la tabla** de Matthaei (Tabla 4.07-1, datos de Weinberg, normalizada a retardo de 1 s) y se **renormaliza a −3 dB** multiplicando cada g por el factor ω3dB de su Orden, así fc significa lo mismo en las tres Aproximaciones:

| n | g1 … gn (retardo 1 s) | factor ω3dB |
|---|---|---|
| 2 | 1,5774 0,4226 | 1,3617 |
| 3 | 1,2550 0,5528 0,1922 | 1,7557 |
| 4 | 1,0598 0,5116 0,3181 0,1104 | 2,1139 |
| 5 | 0,9303 0,4577 0,3312 0,2090 0,0718 | 2,4274 |
| 6 | 0,8377 0,4116 0,3158 0,2364 0,1480 0,0505 | 2,7034 |
| 7 | 0,7677 0,3744 0,2944 0,2378 0,1778 0,1104 0,0375 | 2,9517 |
| 8 | 0,7125 0,3446 0,2735 0,2297 0,1867 0,1387 0,0855 0,0289 | 3,1796 |
| 9 | 0,6678 0,3203 0,2547 0,2184 0,1859 0,1506 0,1112 0,0682 0,0230 | 3,3917 |
| 10 | 0,6305 0,3002 0,2384 0,2066 0,1808 0,1539 0,1240 0,0910 0,0556 0,0187 | 3,5910 |

  Con n = 1, Bessel coincide con Butterworth (g1 = 2). El retardo en continua τ0 = factor/ωc se muestra como dato del resultado, sin curva de retardo. El g grande va del lado de g1.

**Chebyshev de Orden par con terminaciones iguales** no es realizable: pide una carga de coth²(β/4)·R0.

- Si el Orden **se calcula**, sale directamente impar.
- Si el Alumno lo **ingresa** par, se sube a n + 1 y se avisa por qué.

### 7.4 Impedancias de fuente y carga distintas (π y T)

Se aceptan, con las fórmulas de **Takahasi** (1951) en la parametrización de Green (Matthaei Sec. 4.10), que tienen como caso particular el de terminaciones iguales. Valen para Butterworth y Chebyshev.

Con K = 4r/(1 + r)² (Butterworth y Chebyshev impar), r = R_mayor/R_menor y γm = m·π/(2n):

```
Chebyshev:
  a  = (1/n)·asinh(1/ε),   â = (1/n)·asinh(√(1−K)/ε),   ε = √(10^(r_dB/10) − 1)
  g1 = 2·sen γ1 / (sinh a − sinh â)
  gm·g(m+1) = 4·sen γ(2m−1)·sen γ(2m+1) / [sinh²a + sinh²â + sen²γ(2m) − 2·sinh a·sinh â·cos γ(2m)]
  ρ0 = sinh(n·â)/sinh(n·a) (n impar);  cosh(n·â)/cosh(n·a) (n par);   g(n+1) = (1+ρ0)/(1−ρ0)

Butterworth:
  α  = (1−K)^(1/(2n))
  g1 = 2·sen γ1/(1 − α)
  gm·g(m+1) = 4·sen γ(2m−1)·sen γ(2m+1) / (1 − 2α·cos γ(2m) + α²)
  g(n+1) = (1+αⁿ)/(1−αⁿ)
```

- Así escritas dan la escalera con g1 en serie, fuente en la R menor y carga r. Las otras disposiciones salen por dualidad e inversión (`research/filtros-terminaciones-desiguales.md` §3): variantes (a) a (d), con la misma respuesta.
- **Chebyshev par** solo admite r ≥ r_min = (ε + √(1+ε²))² = coth²(β/4) (1,3554 con 0,1 dB; 1,9841 con 0,5 dB, sin importar n), con K = (1+ε²)·4r/(1+r)².
  - Si r queda debajo de r_min, se sube al impar siguiente y se avisa.
  - Con Orden par la Topología queda fija: el elemento en serie va del lado de la R menor (desde 50 Ω hacia 300 Ω solo hay T). Si el Alumno pidió la otra, se usa la posible y se avisa por qué.
  - En ningún caso se bloquea.
- **Varias escaleras con la misma respuesta:** el resultado principal es la de **menor dispersión de valores** (el cociente máximo/mínimo entre las L y entre las C). La alternativa queda en los pasos intermedios.
- **Aviso obligatorio:** "Este filtro no adapta: tiene una pérdida plana de X dB, igual a la desadaptación directa, 4r/(1+r)²" (−3,10 dB de 50 a 300 Ω). Vale para los cuatro Tipos de filtro. El aviso:
  - sugiere la Calculadora de redes de adaptación, con un botón de pase (sección 5.5);
  - en pasa banda, sugiere la Topología de resonadores acoplados, que sí adapta;
  - recuerda que una carga balanceada (cinta de 300 Ω, dipolo plegado) necesita un balun aparte.
- **Bessel con R_s ≠ R_L en π o T:** no hay fórmula de Takahasi, así que **no se calcula**. Un aviso lo explica y ofrece tres salidas: pasar a Butterworth, diseñar con terminaciones iguales y usar la Calculadora de redes de adaptación, o, en pasa banda, la Topología de resonadores acoplados (que sí admite Bessel con R_s ≠ R_L).

### 7.5 Transformación al circuito real

Con ωc = 2π·fc, ω0 = √(ω1·ω2), BWω = ω2 − ω1 y R0 la R de normalización (Matthaei ec. 4.04-2 a 4.04-4 y Sec. 12.02; Pozar, Tabla 8.6):

| Tipo de filtro | Elemento g en serie | Elemento g en derivación |
|---|---|---|
| Pasa bajos | L = g·R0/ωc | C = g/(R0·ωc) |
| Pasa altos | C = 1/(g·R0·ωc) | L = R0/(g·ωc) |
| Pasa banda | LC serie: L = g·R0/BWω ; C = BWω/(ω0²·g·R0) | LC paralelo: L = R0·BWω/(ω0²·g) ; C = g/(R0·BWω) |
| Rechaza banda | LC paralelo: L = g·R0·BWω/ω0² ; C = 1/(g·R0·BWω) | LC serie: L = R0/(g·BWω) ; C = g·BWω/(ω0²·R0) |

Cada resonador de pasa banda y rechaza banda sintoniza en ω0 (L·C = 1/ω0²), que sirve como chequeo.

### 7.6 Orden calculado desde una atenuación

Frecuencia normalizada del prototipo (Matthaei ec. 8.04-1 y 12.02-1):

| Tipo de filtro | Ωs |
|---|---|
| Pasa bajos | fs/fc |
| Pasa altos | fc/fs |
| Pasa banda | \|fs/f0 − f0/fs\| / FBW, con FBW = (f2 − f1)/f0 |
| Rechaza banda | FBW / \|fs/f0 − f0/fs\| |

- Hace falta Ωs > 1: si no, fs cae en la banda pasante y no hay solución.
- **Butterworth:** `n ≥ log10(10^(As/10) − 1) / [2·log10(Ωs)]`.
- **Chebyshev:** `n ≥ arccosh√[(10^(As/10) − 1)/(10^(r/10) − 1)] / arccosh(Ωs)`; con terminaciones iguales, si sale par se pasa al impar siguiente.
- **Bessel:** se evalúa A(Ωs) con el polinomio de Bessel normalizado a −3 dB para n = 1…10 y se toma el primero que cumple. **Puede no haber solución** (a 2·fc nunca pasa de unos 14 dB): se avisa "no alcanzable con Bessel de Orden ≤ 10" y se sugiere Butterworth o Chebyshev.
- Siempre se redondea hacia arriba y se muestra la atenuación real que da el n elegido. Si el n pasa de 10, se avisa y no se calcula.
- En resonadores acoplados se agrega una verificación (sección 7.7).

### 7.7 Topología de resonadores acoplados (solo pasa banda)

n resonadores LC paralelo en derivación, todos con la misma L, unidos por **Capacitores de acople** en serie. Los resonadores de los extremos se conectan a R_s y R_L con un **Capacitor de extremo** en serie, que hace la transformación de impedancia: **este filtro sí adapta**, sin pérdida plana.

```
 Rs ──┤C01├──┬──┤C12├──┬──┤C23├──┬──┤C34├── RL
             │         │         │
          L ‖ C1    L ‖ C2    L ‖ C3
```

**Método:** Matthaei, Young y Jones, Fig. 8.11-1, despejado en L. Usa los g del prototipo de terminaciones iguales (sin Takahasi) y sirve para las tres Aproximaciones.

1. **Mapeo de Cohn** (Matthaei ec. 8.11-2 y 8.11-3):
   `ω0 = ω1 + ω2 − √((ω2 − ω1)² + ω1·ω2)` y `FBW = ω0/ω1 − ω0/ω2`. f0 es la **Frecuencia de sintonía**, distinta de la central geométrica.
2. Con G_A = 1/R_s, G_B = 1/R_L, Cr = 1/(ω0²·L) y b = ω0·Cr = 1/(ω0·L):
   ```
   J01      = √(G_A·b·FBW/(g0·g1))
   J(k,k+1) = FBW·b/√(gk·g(k+1)),   k = 1…n−1
   J(n,n+1) = √(G_B·b·FBW/(gn·g(n+1)))
   C01      = J01/(ω0·√(1 − (J01/G_A)²))           C(n,n+1) igual con J(n,n+1) y G_B
   C(k,k+1) = J(k,k+1)/ω0
   C01e     = C01/(1 + (ω0·C01·R_s)²)              C(n,n+1)e igual con R_L
   C1 = Cr − C01e − C12;   Ck = Cr − C(k−1,k) − C(k,k+1);   Cn = Cr − C(n−1,n) − C(n,n+1)e
   ```
   En términos que el Alumno reconoce: k(k,k+1) = FBW/√(gk·g(k+1)), C(k,k+1) = k·Cr, Q_ext = g0·g1/FBW, Rp = Q_ext·ω0·L y `C01 = 1/(ω0·√(R_s·(Rp1 − R_s)))`. El Capacitor de extremo es la red L serie-paralelo de la Calculadora de redes de adaptación, exacta en ω0, y comparte su código.
3. **Realizabilidad:** Rp > R en cada extremo (L > R·FBW/(g·ω0), con g = g0·g1 en la entrada y gn·g(n+1) en la salida) y todas las Ck > 0. Si falla, se dice cuál y cuál es la L mínima.

**La L de los resonadores**

- La pérdida por Qu no depende de la L: la L se elige por construcción.
- **Ventana de L** (criterio práctico):
  - cota inferior: la mayor entre la L mínima de Valor impracticable (6 nH) y la que pide cada extremo, R·FBW/(g·ω0);
  - cota superior: la que deja el Capacitor de acople más chico en 1 pF (C mínima de Valor impracticable), `L ≤ FBW/(ω0²·máx√(gk·g(k+1))·1 pF)`.
  - En 144–148 MHz con n = 3 (50 → 50 Ω) queda de 6 a 23 nH.
- **El Asistente propone la L más grande de la serie E12 dentro de la ventana** (22 nH en ese caso), como valor editable, con la ventana a la vista ("válida: 9,0 – 23,0 nH").
- Si el Alumno pone una L fuera de la ventana, se avisa qué cota viola: el Rp > R de qué extremo, la L mínima o el Capacitor de acople mínimo.
- Si la ventana queda vacía, se avisa y se sugiere bajar el Orden o aceptar acoples debajo del mínimo.
- Los Valores dudosos dentro de la ventana salen con su aviso. En el caso típico, el acople de ~1,05 pF es un Valor dudoso inevitable en esa banda.

**Reglas propias de esta Topología**

- **Orden par libre** en Chebyshev, ingresado o calculado (sale el mínimo, par o impar). El capacitor de salida absorbe el g(n+1) ≠ 1. Una nota indica que en la Frecuencia de sintonía la pérdida es igual al ripple. **Es una Deducción propia a aprobar** (sección 13.5); el plan B sube el par al impar, como en π y T.
- **Bessel con R_s ≠ R_L:** el prototipo se orienta siempre con el g grande del lado de la R mayor, sin preguntar (con R_s = R_L, la orientación de tabla). Una nota corta lo explica y el detalle va en los pasos intermedios.
- **Orden calculado desde una atenuación:** después de calcularlo con el prototipo, se simula la red real (ABCD, componentes ideales; no depende de la L) en fs. Si no llega, se sube n de a uno, y el resultado muestra la atenuación simulada con el aviso *"el prototipo pedía n = 3, pero por la asimetría del flanco alto hace falta n = 4"*. Si con n = 10 no llega, se avisa y no se calcula.
- **Avisos por FBW** (nunca bloquean):
  - hasta 10 %: ninguno;
  - entre 10 y 20 %: informativo, la atenuación por encima de f2 es menor que la del prototipo por la asimetría propia de la Topología;
  - más de 20 %: fuerte, fuera del rango de validez del método (Matthaei, ~20 %), y los bordes pueden correrse.
- **Sugerencia de Topología:** en pasa banda π o T con FBW < 20 %, la Calculadora sugiere resonadores acoplados con un botón para cambiar. Por encima de 20 % no la sugiere.

**Capacitores de sintonía**

- Aviso: se arman con trimmer, y el valor calculado es el punto medio del ajuste (un 1 % de error en un resonador corre la banda un 18 % del BW).
- Cada uno muestra el rango que tiene que cubrir el trimmer, solo o con un fijo en paralelo: **±20 %** del valor calculado, que compensa ±20 % de error en la L. Va rotulado como criterio práctico.
- No se pasan a Arreglos equivalentes.

**Salidas propias**

- **Resultado principal:** la **Frecuencia de sintonía** con la leyenda "ajustá cada resonador a esta frecuencia", la L, los Capacitores de extremo, los de acople y los de sintonía con su rango de trimmer. También se muestra la central geométrica √(f1·f2).
- Nota: los acoples son sensibles (en el caso CR1, un −4,5 % en el acople sube el peor punto de la banda de 3,0 a 4,5 dB).
- **Pasos intermedios:** FBW, Cr, los k(k,k+1), los Q_ext, el Rp de cada extremo, la red L de cada extremo, la diferencia entre Frecuencia de sintonía y central geométrica (mapeo de Cohn, Matthaei ec. 8.11-2) y el **divisor capacitivo** como alternativa equivalente al Capacitor de extremo en serie, marcado como cálculo propio verificado por simulación (Deducción propia; plan B: se saca de los pasos).
- No se redondea a serie E. La bobina con toma no entra.

### 7.8 Pérdida por Q finito

- Estimación de **Cohn** (Matthaei ec. 4.13-11), rotulada como estimación: `ΔL0 ≈ 4,343·Σ gk/Qk` dB.
- Solo las bobinas tienen pérdida (Qu editable, 100 por defecto); los capacitores se toman como ideales.
  - Pasa bajos y pasa altos: suman los elementos que son bobinas, con Qk = Qu.
  - Pasa banda (escalera o resonadores acoplados): cada elemento del prototipo es un resonador, con Qk = FBW·Qu (Matthaei ec. 4.13-2).
  - Rechaza banda: no se muestra (sección 12.1, P1).
- En resonadores acoplados la estimación sobreestima entre 2 y 7 % contra la simulación.

### 7.9 Salidas (π y T)

- **Resultado principal:** el esquema con R_s y R_L, los valores de L y C en orden desde la fuente, cada uno con su botón de pase (sección 5.5), y la pérdida de Cohn.
- Bessel: el retardo τ0.
- Orden calculado: la atenuación real en fs.
- **Pasos intermedios:** los g del prototipo, los parámetros de la Aproximación (β, γ en Chebyshev; a, â, K, ρ0 en Takahasi), cada elemento escalado con sus valores sustituidos, Ωs y la fórmula del Orden, y la escalera alternativa cuando hay varias.
- No se redondea a serie E.

### 7.10 Avisos y cortes

| Caso | Tratamiento |
|---|---|
| Orden calculado > 10, o Bessel sin solución | Aviso; no se calcula |
| Chebyshev par con terminaciones iguales (π, T) | Sube a n + 1 con aviso |
| Chebyshev par con r < r_min, o Topología imposible con Orden par | Sube al impar o cambia de Topología, con aviso |
| R_s ≠ R_L (π, T) | Aviso obligatorio de pérdida plana (sección 7.4) |
| Bessel con R_s ≠ R_L (π, T) | No se calcula; aviso con las tres salidas (sección 7.4) |
| Pasa banda π o T con FBW < 20 % | Sugiere resonadores acoplados |
| Resonadores: FBW > 10 % / > 20 % | Aviso informativo / fuerte |
| Resonadores: L fuera de la Ventana de L, ventana vacía, Rp ≤ R o algún Ck ≤ 0 | Aviso con la cota violada |
| Cualquier L o C | Valor dudoso o impracticable, evaluado en fc (pasa bajos, pasa altos) o f2 (pasa banda, rechaza banda), con la sugerencia de la sección 5.6. En el rechaza banda angosto ese aviso es la única respuesta en esta versión |

### 7.11 Referencias que se muestran

- Matthaei, Young y Jones, *Microwave Filters, Impedance-Matching Networks, and Coupling Structures* (1964): ec. 4.04-2 a 4.04-4, 4.05-1, 4.05-2, Tabla 4.07-1, Sec. 4.10, ec. 4.13-2 y 4.13-11, ec. 8.04-1, Fig. 8.11-1, ec. 8.11-2 y 8.11-3, Sec. 12.02.
- Takahasi (1951), a través de Matthaei Sec. 4.10 y Weinberg y Slepian (1960).
- Pozar, *Microwave Engineering*, 4.ª ed., §8.4, Tabla 8.6.
- Zverev, *Handbook of Filter Synthesis* (1967); Williams y Taylor, *Electronic Filter Design Handbook*, 4.ª ed. (2006).

Origen: [Síntesis de filtros LC escalera](issues/02-sintesis-filtros-lc.md), [Filtros con impedancias de fuente y carga distintas](issues/03-filtros-terminaciones-desiguales.md), [Alcance de la Calculadora de filtros](issues/09-alcance-calculadora-filtros.md), [Fórmulas de filtros pasa banda de resonadores acoplados](issues/16-resonadores-acoplados.md), [Alcance de la Topología de resonadores acoplados](issues/17-alcance-resonadores-acoplados.md), [`research/sintesis-filtros-lc.md`](research/sintesis-filtros-lc.md), [`research/filtros-terminaciones-desiguales.md`](research/filtros-terminaciones-desiguales.md), [`research/resonadores-acoplados.md`](research/resonadores-acoplados.md).

## 8. Calculadora de Arreglos equivalentes

Busca los Arreglos equivalentes serie-paralelo de hasta 4 componentes de Valor comercial que mejor aproximan un valor buscado.

### 8.1 Entradas

| Campo | Opciones o unidad | Notas |
|---|---|---|
| Componente | Capacitor · Resistencia | Los inductores quedan afuera: para eso está la Calculadora de bobinas |
| Valor buscado | pF o Ω | > 0. Llega precargado desde otras Calculadoras |
| Serie | E6 · **E12** · E24 | Sin E48 ni E96 |
| Umbral de error | % | Editable, 1 % por defecto (sección 8.4) |
| Tolerancia por defecto | % o pF | Editable por tipo: ±5 % para resistencias, ±5 % para capacitores de 10 pF o más y ±0,25 pF absolutos para los de menos de 10 pF |

### 8.2 Bloque de Inventario

El acceso al Inventario va en un **bloque propio y visible**, separado de las entradas. Muestra qué se está usando, por ejemplo:

- "Inventario de capacitores: E12 por exclusión, 1 pF – 10 nF, 3 Valores excluidos", o
- "Serie E12 completa, sin Inventario",

y tiene un botón **"Editar Inventario"**.

**Inventario** (uno por tipo de componente, guardado en `localStorage`):

- **Sin Inventario propio**, la búsqueda usa la serie completa en un rango fijo: 1 pF a 10 nF para capacitores y 1 Ω a 10 MΩ para resistencias.
- **Por inclusión:** la lista de valores que tiene el Alumno. Acepta cualquier valor escrito con la Entrada flexible, sea o no de la serie (0,5 pF, 4,3 pF).
- **Por exclusión:** la serie E elegida en un rango editable (por defecto, el rango fijo del tipo), menos los **Valores excluidos**, más una lista corta de valores extra fuera de la serie.
  - Los Valores excluidos se marcan tocando una grilla de la serie, una fila por década: tachado al excluir, otro toque lo vuelve a incluir.
  - Se guardan como valores, no como posiciones, así que siguen valiendo si se cambia de serie.
- Al cambiar de modo, la lista del otro modo no se borra.
- **No guarda cantidades:** un mismo valor se puede repetir dentro de un Arreglo. Cuando se repite, el resultado lo avisa ("usa 3 × 10 pF").
- **Tolerancia por valor:** en modo inclusión, y en los valores extra del modo exclusión, se puede pisar la tolerancia de un valor puntual. En el resto del modo exclusión vale la tolerancia por defecto.
- El Inventario de resistencias también lo usa la Calculadora de atenuadores (sección 10.4).

### 8.3 Búsqueda

- **Formas de conexión:** 1, 2, 4 y 10 para 1 a 4 componentes (OEIS A000084). Se enumeran sin duplicados como árboles alternantes serie/paralelo (un nodo serie no tiene hijos serie, y al revés) con los hijos ordenados. Las 10 de 4 componentes son `S(a,b,c,d)`, `S(a,b,P(c,d))`, `S(P(a,b),P(c,d))`, `S(a,P(b,c,d))`, `S(a,P(b,S(c,d)))` y sus duales.
- **Un solo motor con dos operaciones:** suma y suma recíproca. En capacitores, paralelo suma y serie es la inversa de la suma de inversas; en resistencias, al revés.
- **Meet-in-the-middle:**
  1. Se precalculan tablas ordenadas de pares en serie y en paralelo.
  2. Cada forma de 4 componentes se escribe como f(componentes externos, Y), con Y un par de la tabla y f creciente en Y.
  3. Para cada combinación externa, una búsqueda binaria sobre f(Y) encuentra la posición más cercana, y se avanza hacia los dos lados mientras el error siga siendo menor que el del décimo mejor.
  4. Las formas de 1 a 3 componentes se resuelven igual.
  
  Da los mismos 10 mejores que la fuerza bruta. Costo O(N²·log N).
- **Rendimiento:** 8 ms con E12 y 31 ms con E24 (4 décadas) en PC; se estiman 0,1 s y de 0,3 a 0,5 s en un celular de gama baja (extrapolado, no medido en un teléfono). La fuerza bruta (3 a 40 s) se descarta. La búsqueda corre en un **Web Worker** con un indicador de "calculando". Recortar las décadas que no aportan al valor buscado queda como optimización de construcción.
- Las series E6, E12 y E24 se guardan **como tablas** (IEC 60063, a través de Vishay 31001), no se generan por fórmula: en E24 hay 8 valores históricos que la fórmula no da (2,7, 3,0, 3,3, 3,6, 3,9, 4,3, 4,7 y 8,2).

### 8.4 Orden de los resultados

1. Se agrupan los Arreglos de igual valor (tolerancia relativa de redondeo ~1e-9) y se conserva el de menos componentes.
2. Los Arreglos con |Error del arreglo| por debajo del umbral (1 % por defecto) van primero, ordenados por cantidad de componentes y después por error. Los demás van detrás, ordenados por error.
3. Se muestran los **10 mejores**, con hasta 4 componentes.

### 8.5 Salidas

Una lista de 10 filas. Cada una muestra:

- el Arreglo, con la conexión escrita con la palabra **"serie"** y el símbolo **"∥"** para paralelo, y paréntesis para agrupar: "39 pF serie 270 pF", "(27 pF serie 68 pF) ∥ 15 pF". No se usa "+", que con capacitores se leería como una suma;
- su valor;
- el **Error del arreglo** con signo, `(V_arreglo − V_buscado)/V_buscado`;
- la cantidad de componentes y, si un valor se repite, "usa 3 × 10 pF";
- la **Tolerancia del arreglo**, el rango de peor caso [V(todos al mínimo), V(todos al máximo)], que es exacto porque cualquier red serie-paralelo crece con cada componente.

Notas:

- Los Arreglos de 3 o 4 componentes llevan una nota fija y breve: en VHF cada componente y cada soldadura agregan L y C parásitas. Los parásitos no penalizan el orden (el umbral ya favorece a los Arreglos de pocos componentes) y no se pide la frecuencia de trabajo.
- Cuando el valor llega desde atenuadores: en un Arreglo equivalente la potencia se reparte entre los componentes. La Calculadora no reparte potencia.
- **Valor impracticable:** solo se aplica la C mínima al valor buscado (sección 5.6).
- **Pasos intermedios:** la fórmula de serie y paralelo, cuántas combinaciones se evaluaron, la regla de orden y la cuenta de la Tolerancia del arreglo de la fila elegida.

### 8.6 Referencias que se muestran

- IEC 60063:2015 (valores tomados de Vishay Dale, documento 31001).
- Riordan y Shannon (1942), a través de OEIS A000084.
- Tolerancias de capacitores C0G: KEMET C1003_C0G.

Origen: [Búsqueda de Arreglos equivalentes](issues/04-busqueda-arreglos-equivalentes.md), [Alcance de la Calculadora de Arreglos equivalentes](issues/10-alcance-arreglos-equivalentes.md), [Prototipo de navegación entre Calculadoras](issues/22-prototipo-navegacion.md) (bloque de Inventario), [`research/busqueda-arreglos-equivalentes.md`](research/busqueda-arreglos-equivalentes.md).

## 9. Calculadora de redes de adaptación

Calcula redes L, π y T que adaptan una fuente y una carga **resistivas** a una frecuencia.

### 9.1 Entradas

| Campo | Unidad | Por defecto | Notas |
|---|---|---|---|
| Topología | L · π · T | L | |
| f₀ | MHz | vacío | > 0 |
| R_s (fuente) | Ω | 50 | > 0. Un botón ⇄ intercambia R_s y R_L |
| R_L (carga) | Ω | vacío | > 0 |
| Q de diseño (solo π y T) | — | vacío | El campo muestra en vivo el Q mínimo, √(R_mayor/R_menor − 1) |
| Q de la bobina | — | 100 | Para la pérdida estimada |

- No hay tope en la relación de impedancias: los extremos los cubren los avisos de valor impracticable.
- El Q de diseño es el de la sección de mayor Q (el de Bowick), **no f₀/BW**.

### 9.2 Fórmulas

Transformación serie a paralelo (Bowick ec. 2-7 y 2-8): `Q = |X_s|/R_s`, `R_p = R_s·(1 + Q²)`, `X_p = R_p/Q`. Reactancia con signo: X > 0 es una L (`L = X/ω`) y X < 0 es una C (`C = −1/(ω·X)`).

- **Red L** (Bowick ec. 4-1 a 4-3): `Q = √(R_mayor/R_menor − 1)`, `X_s = Q·R_menor` (elemento en serie, del lado de la R menor), `X_p = R_mayor/Q` (elemento en derivación, del lado de la R mayor). X_s y X_p son de tipo opuesto. El Q queda fijado por las resistencias.
- **Red π** (Bowick ec. 4-4): dos redes L espalda con espalda a una **Resistencia virtual** menor que las dos terminaciones, `R_v = R_mayor/(Q² + 1)`.
  - Del lado de R_mayor: `X_p = R_mayor/Q`, `X_s = Q·R_v`.
  - Del otro lado: `Q₂ = √(R_menor/R_v − 1)`, `X_p = R_menor/Q₂`, `X_s = Q₂·R_v`.
  - Las dos reactancias en serie se suman con su signo.
- **Red T** (Bowick ec. 4-5): Resistencia virtual mayor que las dos terminaciones, `R_v = R_menor·(Q² + 1)`. El Q lo fija la sección del lado de R_menor.
  - Cada sección tiene `X_s = Q_i·R_i` y `X_p = R_v/Q_i`.
  - Las dos reactancias en derivación se combinan en paralelo.
- Fórmulas cerradas equivalentes: Motorola AN721.

### 9.3 Variantes

Se calculan **todas las variantes con solución**, sin selector previo: 2 en la L, hasta 4 en π y T.

- Orden de las tarjetas: **pasa bajos, pasa altos, mixtas**. Ninguna se destaca como recomendada.
- En las mixtas, la rama neta puede salir L o C. Si se anula, esa variante no tiene solución. Si queda casi nula, el componente cae en el criterio de valor impracticable.

### 9.4 Q de diseño en π y T

| Caso | Tratamiento |
|---|---|
| Q vacío | "Completá: Q de diseño (mínimo X)" |
| Q < Q mínimo | No hay valores. Se informa el Q mínimo y se ofrece un botón "Usar red L" |
| Q = Q mínimo | Aviso: la red se reduce a una L, y se muestra esa L |
| Q > 20 | Aviso: más pérdida en la bobina, más tensión y corriente en los componentes y ajuste crítico. No hay tope duro |

### 9.5 Barrido y pérdida

Cada variante se barre con el circuito ideal (sección 5.7) y muestra:

- f_inf y f_sup a −3 dB, el **BW** y **f₀/BW**, con "sin borde inferior" o "sin borde superior" cuando corresponde (en la L pasa bajos de 50 a 200 Ω, la transferencia en continua es 4R_sR_L/(R_s+R_L)² y no hay borde inferior). También en la red L;
- la atenuación en **2f₀** y **3f₀**;
- la **pérdida de inserción en f₀** con el Q de la bobina (una R en serie con cada L; capacitores ideales), rotulada como estimación;
- sin curva en la primera versión.

La estimación de Kaune, `Q_BW ≈ (Q₁ + Q₂)/2` y `BW ≈ f₀/Q_BW`, va en los pasos intermedios como fórmula visible; el resultado es el del barrido.

### 9.6 Salidas

Arriba, el resultado principal: el Q de la red L, o el Q de diseño con el Q mínimo, con la fórmula visible y su referencia. Después, **una tarjeta por variante** con:

- el esquema con R_s y R_L en sus lados;
- los valores de L y C con sus reactancias, cada uno con su botón de pase (cada L a bobinas con f₀ precargada; cada C a Arreglos equivalentes);
- el Q de cada sección y la Resistencia virtual (en π y T);
- las etiquetas de Bowick: "deja pasar la continua" (L en serie) o "bloquea la continua" (C en serie), y "atenúa armónicas" en pasa bajos;
- el barrido y la pérdida de la sección 9.5;
- su bloque de motivos.

Además:

- **No se redondea a serie E.** Una nota sugiere un trimmer para el ajuste fino.
- **Pasos intermedios:** Q mínimo, Resistencia virtual, cada sección L con su transformación serie a paralelo, la combinación de las ramas, la estimación de Kaune y la verificación de Z_in con la carga conectada.

### 9.7 Casos especiales

| Caso | Tratamiento |
|---|---|
| R ≤ 0 o f₀ ≤ 0 | Entrada inválida |
| R_s = R_L en la L | "Ya está adaptada, no hace falta red" |
| R_s = R_L en π o T | Se calcula igual, con una nota: la red solo filtra, y para una respuesta definida está la Calculadora de filtros (con enlace) |
| Llega desde filtros con R_s ≠ R_L | R_s y R_L precargadas; f₀ solo si el filtro era pasa banda |

### 9.8 Referencias que se muestran

- Bowick, *RF Circuit Design*, ec. 2-7, 2-8 y 4-1 a 4-5.
- Motorola AN721 (fórmulas cerradas).
- Kaune, QEX, septiembre/octubre de 2015 (ancho de banda).

Origen: [Redes de adaptación L, π y T: fórmulas y alcance](issues/05-redes-adaptacion.md), [Qué Calculadoras entran en la primera versión](issues/08-calculadoras-v1.md), [Alcance de la Calculadora de redes de adaptación](issues/14-alcance-redes-adaptacion.md), [`research/redes-adaptacion.md`](research/redes-adaptacion.md).

## 10. Calculadora de atenuadores

Calcula atenuadores resistivos T y π, con impedancias iguales o distintas, la disipación de cada resistencia y el efecto de usar Valores comerciales.

### 10.1 Entradas

| Campo | Unidad | Por defecto | Notas |
|---|---|---|---|
| Atenuación A | dB | vacío | > 0. Tope duro: 60 dB |
| Z1 (fuente) | Ω | 50 | Un botón ⇄ intercambia Z1 y Z2 |
| Z2 (carga) | Ω | 50 | |
| Mínima pérdida (botón) | — | — | Aparece con Z1 ≠ Z2: fija la atenuación en A_min y muestra la red L de dos resistencias |
| Potencia de entrada (opcional) | W o dBm | vacío | dBm con el Selector de unidad. Aceptar dBm no es la Calculadora de conversión que quedó afuera |
| Frecuencia (opcional) | MHz | vacío | Para el criterio de valor impracticable. Vacía: 300 MHz |
| Redondeo | E6 · **E12** · E24 · Inventario de resistencias | | El Inventario se ofrece si hay uno guardado. Sin E96 |
| Tolerancia | % | ±5 % | Editable, como en Arreglos equivalentes |
| Ventana de atenuación | dB | ±0,1 dB | Editable, para las mejores combinaciones |

- **El T y el π se muestran juntos**, cada uno con su esquema (lado a lado en PC, apilados en el celular). No hay selector de Topología (el prototipo de navegación tenía uno; se confirmó lo del ticket 13).

### 10.2 Fórmulas

Con `K = 10^(A/20)` (raíz de la relación de potencias P_entrada/P_carga, con el atenuador adaptado). En el T: R1 en serie del lado de Z1, R3 en derivación y R2 en serie del lado de Z2. En el π: R1 (Ra) en derivación del lado de Z1, R3 (Rs) en serie y R2 (Rb) en derivación del lado de Z2.

```
T:  R3 = 2K·√(Z1·Z2)/(K² − 1)
    R1 = Z1·(K² + 1)/(K² − 1) − R3
    R2 = Z2·(K² + 1)/(K² − 1) − R3

π:  R3 = (K² − 1)·√(Z1·Z2)/(2K)
    R1 = (K² − 1)·Z1/(K² + 1 − 2K·√(Z1/Z2))
    R2 = (K² − 1)·Z2/(K² + 1 − 2K·√(Z2/Z1))
```

- Con Z1 = Z2 = Z0 se reducen a las formas conocidas: T, `R_serie = Z0·(K−1)/(K+1)` y `R_deriv = 2K·Z0/(K²−1)`; π, `R_deriv = Z0·(K+1)/(K−1)` y `R_serie = Z0·(K²−1)/(2K)`.
- **Atenuación mínima** con Z1 ≠ Z2: `A_min = 20·log10(√r + √(r − 1))`, con r = Z_mayor/Z_menor (5,72 dB de 50 a 75 Ω; 13,42 dB de 50 a 300 Ω). Por debajo, sale negativa la resistencia en serie del lado de la impedancia menor (T) o la de derivación del lado de la impedancia **mayor** (π).
- **Pad de mínima pérdida** (caso límite, K = K_min): resistencia en serie del lado de la impedancia mayor `= Z_mayor·√(1 − Z_menor/Z_mayor)` y en derivación del lado de la menor `= Z_menor/√(1 − Z_menor/Z_mayor)`.
- **Referencia:** coinciden término a término con el *Reference Data for Radio Engineers*, 4.ª ed. (ITT, 1956), cap. 9, págs. 252-254 (ecuaciones en la pág. 253; mínima pérdida en la Fig. 7, pág. 260), con N = K²; las mismas ecuaciones están en la 1.ª ed. (1943), págs. 65-67. La pág. 253 también sirve para Z1 = Z2. Los pasos intermedios muestran N = K² para cotejar con el libro.

### 10.3 Potencia (opcional)

Con P la potencia que entra al atenuador:

```
T:  P_R1 = P·R1/Z1        P_R3 = P·(Z1 − R1)²/(Z1·R3)        P_R2 = P·R2/(K²·Z2)
π:  P_R1 = P·Z1/R1        P_R3 = P·(√Z1 − √Z2/K)²/R3          P_R2 = P·Z2/(K²·R2)
```

- Para cada resistencia: la potencia disipada y una **potencia nominal mínima sugerida con margen de 2×**, rotulada como criterio de diseño. No se asume ninguna lista de potencias comerciales.
- Nota fija: el cálculo es para potencia continua; con señales moduladas hay que mirar la potencia de pico.

### 10.4 Valores comerciales

- Se muestran el **redondeo al más cercano** (en escala logarítmica) y las **3 mejores combinaciones entre vecinos**: los 7 valores más cercanos de cada resistencia, sin forzar la simetría (7³ = 343 evaluaciones).
  - Se ordenan por PR dentro de la ventana de atenuación (±0,1 dB por defecto).
  - Si ninguna entra en la ventana, se muestran las 3 de menor error de atenuación, con un aviso.
- Cada opción muestra, calculado con el barrido de la sección 5.7:
  - la atenuación real;
  - la PR de entrada y de salida en dB con la ROE equivalente ("30,5 dB (ROE 1,06)");
  - el **peor caso por tolerancia**: la atenuación [mín, máx] y la PR mínima, con las 8 combinaciones de extremos.
- El pad de mínima pérdida lleva el mismo tratamiento con 2 resistencias. Si el redondeo lo deja apenas debajo de A_min, la desadaptación se ve en las PR, sin aviso aparte.
- **Cada resistencia calculada** tiene un botón de pase a Arreglos equivalentes (tipo resistencia), con la nota de que la potencia se reparte entre los componentes.

### 10.5 Límites y avisos

| Caso | Tratamiento |
|---|---|
| A ≤ 0 dB | Entrada inválida |
| A > 60 dB | Corte: no se calcula |
| A < A_min con Z1 ≠ Z2 | No se muestran valores negativos: se informa A_min y se ofrece el pad de mínima pérdida |
| A < 0,5 dB | Aviso: las resistencias en serie quedan del orden de la resistencia de los terminales |
| A > 40 dB | Aviso: en VHF una sola sección no llega a esa atenuación real; conviene armar secciones de 10 a 20 dB en cascada. La cascada no se calcula: el Alumno puede usar la Calculadora dos veces |
| Frecuencia vacía | Las resistencias se revisan a 300 MHz, y el aviso lo dice |
| Cada resistencia ideal y redondeada | Valor dudoso o impracticable por el rango de R a esa frecuencia (sección 5.6). Con estos umbrales, el T de 20 dB (10 Ω en derivación) es dudoso a 150 MHz e impracticable a 300 MHz, y la resistencia de 1 Ω del T de 40 dB es impracticable en toda la banda |
| Siempre | Nota para VHF: resistencias de película o SMD, no de alambre, y terminales cortos |

### 10.6 Pasos intermedios

K = 10^(A/20) y N = K², la fórmula de cada resistencia con sus valores, A_min cuando Z1 ≠ Z2, y la verificación: la impedancia de entrada con la carga conectada y la atenuación recalculada.

Origen: [Fórmulas de atenuadores resistivos π y T](issues/12-formulas-atenuadores.md), [Alcance de la Calculadora de atenuadores](issues/13-alcance-atenuadores.md), [Contraste de las fórmulas de atenuadores con impedancias distintas](issues/23-contraste-atenuadores.md), [`research/formulas-atenuadores.md`](research/formulas-atenuadores.md), [`research/contraste-atenuadores.md`](research/contraste-atenuadores.md).

## 11. Fuera de la primera versión

| Qué | Por qué |
|---|---|
| Calculadoras de resonancia LC y reactancias, factor Q y ancho de banda, código de colores y códigos de capacitores, conversión dBm ↔ mW ↔ Vrms, largo de antenas y líneas | Cálculos triviales que sobrecargarían el Asistente, o temas de otras materias. Quedan como alternativas para versiones futuras |
| Cargas complejas en redes de adaptación; despejar el Q desde un ancho de banda buscado; red de banda ancha (dos L en cascada) y π-L; curva del barrido | Primera versión acotada a cargas resistivas |
| Aproximación elíptica; transformación de Norton en escaleras π/T; red transformadora de Matthaei (1964); balun o línea balanceada como parte del cálculo | Cuestan mucho para un uso marginal; adaptar ya lo cubren redes de adaptación y resonadores acoplados |
| Redondeo de los Capacitores de acople y de extremo a serie E con nueva simulación; bobina con toma en los resonadores de los extremos | Complejidad; la bobina con toma solo tiene fórmula aproximada |
| Curva de retardo de grupo | Solo se muestra τ0 en Bessel |
| E48 y E96 en Arreglos equivalentes y atenuadores | Los Alumnos no suelen tener esos valores |
| Cantidades en el Inventario; exportar o importar el Inventario | Decisión de alcance; se aceptan sus consecuencias (sección 2.1) |
| Cascada de atenuadores | Se usa la Calculadora dos veces |
| APK | Solo Android y con advertencias; la PWA cubre lo mismo |
| Fila propia de prefijos sobre el teclado numérico | Posibilidad para una versión futura |
| Tests de interfaz | Se revisa a mano, salvo que el pase entre Calculadoras resulte frágil |

Origen: [mapa](map.md) (Out of scope) y los tickets de alcance de cada Calculadora.

## 12. Pendientes antes de construir

### 12.1 Puntos que los tickets dejaron abiertos

Resueltos con el Ayudante de cátedra al redactar la spec (2026-10-24):

- **Bessel con R_s ≠ R_L en escaleras π y T:** no se calcula; se avisa y se ofrecen salidas (sección 7.4).
- **Topología en atenuadores:** T y π juntos, como decidió [Alcance de la Calculadora de atenuadores](issues/13-alcance-atenuadores.md), aunque el prototipo de navegación tenía un selector (sección 10.1).
- **Notación de los Arreglos:** "serie" y "∥", sin "+" (sección 8.5).

Quedan para la construcción:

| # | Punto | Propuesta |
|---|---|---|
| P1 | **Pérdida de Cohn en rechaza banda.** No se investigó cómo se aplica | No mostrarla en rechaza banda |
| P2 | **Término E de Maxwell** en la versión externa de dos capas (sección 6.4). La investigación da E ≈ 0,017 (Circular 74) para la fórmula original y no aclara si lo mantuvo en la versión externa | **Resuelto en el ticket 34:** E = 0,017 se mantiene. Con E la fórmula reproduce las cifras de la investigación y las 7 geometrías dan de −0,51 a +0,05 % contra la suma de anillos; sin E, de −0,60 a −0,09 % |

### 12.2 Valores por defecto que fijó la redacción

Ningún ticket los decidió. Se pueden cambiar sin tocar el resto de la spec.

| Dónde | Valor |
|---|---|
| Filtros | Tipo pasa bajos, Butterworth, ripple 0,5 dB al elegir Chebyshev, R_s = R_L = 50 Ω, Orden ingresado y vacío. Topología π cuando las dos usan las mismas bobinas (Orden par, pasa banda, rechaza banda) |
| Atenuadores | Las 3 mejores combinaciones se ordenan por la menor de las dos PR |
| Barrido | De f₀/50 a 50·f₀, con unos cientos de puntos por década |
| Pase de una L de un filtro π o T a bobinas | Se precarga como frecuencia de trabajo la de evaluación del criterio de valor impracticable: fc o f2 |
| Navegación | Corte entre celular y PC en ~900 px, el del prototipo |
| Primera apertura | Calculadora de bobinas (sección 4.4, ya decidido) |

### 12.3 Riesgos aceptados

- La PWA no se probó en un iPhone, ni la combinación de pestañas y menú lateral en un teléfono.
- La búsqueda de Arreglos de 4 componentes con E24 está estimada, no medida, en un celular de gama baja.
- El criterio de valor impracticable no se contrastó con el ARRL Handbook ni con una medición.
- Las fórmulas de Takahasi se respaldan en la parametrización de Matthaei, 10 filas de tablas publicadas y simulación; no se leyó el original.

## 13. Casos de prueba y aprobación de la Cátedra

### 13.1 Clases de Caso de prueba

| Clase | De dónde sale el valor esperado | En el Informe de casos |
|---|---|---|
| **De referencia** | Una tabla o un ejemplo publicado | Revisión a fondo |
| **De medición** | Una medición física publicada | Revisión a fondo |
| **De verificación** | Sin valor publicado: se comprueba por otra vía independiente (un oráculo) | Revisión a fondo, con el oráculo nombrado |
| **De comportamiento** | Avisos, cortes y Entrada flexible | Lista compacta: entrada, aviso esperado y estado |

Las cuatro corren en Vitest y aparecen en el informe, agrupadas por clase dentro de cada Calculadora.

### 13.2 Tolerancia

- **Por caso, obligatoria y con motivo escrito.** No hay tolerancia por Calculadora.
- Reglas por defecto, que un caso puede cambiar justificándolo:
  - tabla publicada: media unidad de la última cifra impresa;
  - medición: la incertidumbre que declara la fuente;
  - verificación: 1e-9 relativo; en dB, por simulación, ±0,01 dB.
- **Diferencia esperada:** si la referencia usó otra aproximación y no hay una que use la misma, el caso registra la diferencia esperada con su signo y su motivo, y la tolerancia se aplica alrededor de ella. Wheeler y Hazeltine, que van en los pasos intermedios, tienen sus propios casos con su diferencia esperada: Wheeler contra la lámina de corriente exacta y Hazeltine contra la suma de anillos de dos capas, que es contra la que la investigación da su diferencia (ticket 34).

### 13.3 Casos por Calculadora

Los valores numéricos de cada caso están en las investigaciones de [`research/`](research/), que se citan.

**Bobinas** (`research/formulas-bobinas.md`)

- *Referencia:* kL de la Circular 74, Tabla 10, con ℓ/D de 0,1 a 5; el ejemplo de una capa de la C74, pág. 253 (L = 12 909 µH); el de varias capas de la C74, ec. 156, pág. 260 (L = 195 200 µH); la Tabla X de Bs de Rosa y Grover; los L0 de Knight para M31, M32 y MKG1 a MKG4, como paso intermedio.
- *Medición:* M31 y M32 (Medhurst), medidas en HF, contra el resultado principal con D∞. Tolerancia ±1 %, motivo: "D∞ semiempírico; residuo de Knight ≤ 0,5 % más la incertidumbre de la medición". Del lado del plan B (D0), ±3 %: el L0 de Knight queda +2,1 % y +2,4 % sobre lo medido. MKG1 a MKG4 están medidas a baja frecuencia (su Li es la inductancia interna de continua completa, μ0·D·N/8), así que el D∞ de RF no corresponde: quedan solo como referencia, con el L0 de Knight (ticket 33).
- *Verificación:* las 7 geometrías de dos capas de §5.4, más 3 de VHF de una capa (22 nH, 100 nH y 1 µH), contra la suma de anillos. Tolerancia ±1 %. Del lado del plan B de dos capas, la de s = d va con ±3 %: Rosa (91) sola deja afuera ΔL2, que ahí suma un 2,7 % de la L (ticket 34). Hazeltine va con su Diferencia esperada contra la suma de anillos (§5.4), en las 6 geometrías que la tienen.
- *Comportamiento:* menos de una vuelta; f > SRF/3; nota de terminales debajo de 100 nH; dos capas fuera de rango; L mínima de Valor impracticable.

**Filtros** (`research/sintesis-filtros-lc.md`, `filtros-terminaciones-desiguales.md`, `resonadores-acoplados.md`)

- *Referencia:*
  - los g de Matthaei: Butterworth (Tabla 4.05-1, n = 1 a 7), Chebyshev (Tabla 4.05-2: 0,01, 0,1, 0,5 y 1 dB con n = 3, 4, 5 y 7) y Bessel (Tabla 4.07-1, n = 2 a 10, que controla la transcripción de la tabla guardada);
  - Takahasi R1 a R10 (Zverev y Williams), con los r_min;
  - el ejemplo de Orden de Matthaei 8.04, con ±0,5 dB por la lectura de un gráfico.
- *Verificación:* C1 a C8 y CR1 a CR14, simulados con la red armada: el Orden calculado alcanza la atenuación pedida, la atenuación en fc es la de la Aproximación y la pérdida plana es 4r/(1+r)². La pérdida de Cohn va con su diferencia esperada contra la simulación, de +2 a +7 %.
- *Comportamiento:* Chebyshev par que sube al impar; R10 rechazado; Bessel sin solución; Orden mayor que 10; avisos de FBW; Ventana de L vacía (CR9); Valor impracticable.

**Arreglos equivalentes** (`research/busqueda-arreglos-equivalentes.md`)

- *Referencia:* E6, E12 y E24 completas contra IEC 60063 (Vishay 31001), con las 8 excepciones de E24 a la vista; la cantidad de formas de conexión (OEIS A000084: 1, 2, 4, 10).
- *Verificación:* en 37,3 pF E12, 47 pF y dos búsquedas de resistencias, el top-10 del meet-in-the-middle es igual al de la fuerza bruta. La Tolerancia del arreglo de 47 pF = 39 pF J ∥ 8,2 pF C (±4,7 %) va calculada a mano en el informe.
- *Comportamiento:* Inventario por exclusión con Valores excluidos y valores extra; valores repetidos; umbral del 1 %; ±0,25 pF debajo de 10 pF; C mínima.

**Redes de adaptación** (`research/redes-adaptacion.md`)

- *Referencia:* Bowick 4-1 (L), 4-4 (π) y 4-5 (T), con media unidad de la cifra que imprime el libro, y Kaune P2 a P4. Bowick 4-2 y 4-3 y Pozar 5.1 tienen cargas complejas y quedan afuera.
- *Verificación:* el BW sale del barrido y de una segunda vía, el cruce de |Γ| = 0,707; en una grilla de R_s, R_L, Q y variantes, |Zin − R_s|/R_s < 1e-9. El f₀/BW de Kaune no entra como caso aprobado (da 10,20 contra 9,98, y su método de barrido no está publicado).
- *Comportamiento:* Q debajo del mínimo (no calcula y ofrece la red L); Q > 20; P7 y T3 sin solución.

**Atenuadores** (`research/formulas-atenuadores.md`, `contraste-atenuadores.md`)

- *Referencia:* todas las filas de la Fig. 7 (mínima pérdida, pág. 260) y las 13 de la Fig. 8 (pads T con Z1 ≠ Z2, pág. 262) del *Reference Data for Radio Engineers*. Se cita la 4.ª ed. (1956) junto con la 1.ª (1943); si la Cátedra tiene la 5.ª o la 6.ª, confirma la página y se agrega.
- *Verificación:* A1 a A17 y el π en una grilla de Z1, Z2 y dB: con ABCD dan Z1, Z2 y la atenuación exactas, con tolerancia de 1e-9. El π, que no tiene tabla, queda contrastado así.
- *Comportamiento:* debajo de A_min; 60 dB; menos de 0,5 dB; más de 40 dB; margen de potencia; el T de 40 dB como Valor impracticable (V13).

**Común**

- *Entrada flexible:* unas 40 cadenas que cubren las reglas de la sección 5.1 con su valor o su error esperado: "4n7", "4,7 nH", "0.0047u", "1.000", "1M" frente a "1m", un prefijo fuera del juego, etc. Más la ida y vuelta de la sección 5.2.
- *Valor impracticable:* la tabla de umbrales de la sección 5.6 recalculada como verificación, más un caso a cada lado de cada corte.

### 13.4 Oráculos

- En `tests/oraculos/`: suma de anillos, ABCD con complejos y fuerza bruta de Arreglos.
- Se escriben aparte, **sin importar nada de `src/calculo/`**, para no repetir el código que verifican.
- El informe nombra el oráculo de cada caso de verificación y los describe en un apéndice.

### 13.5 Deducciones propias y Criterios prácticos

Cada Deducción propia tiene en el informe un ítem con lo que se adaptó y por qué, la deducción, la comparación numérica contra el plan B y contra casos límite, y **una casilla de aprobación propia**. Cada plan B queda detrás de una bandera en `src/calculo/`, y el informe muestra los casos de los dos lados.

| Deducción propia | Respaldo | Plan B si no se aprueba |
|---|---|---|
| Dos capas: término de Maxwell ln(D/d) − 0,1119, D′ = √(p·d), ajuste de Bs y rango hasta c/a ≤ 0,42 | 11 geometrías contra la suma de anillos (−0,53 a +0,16 %), 7 de ellas en los casos (−0,51 a +0,05 %), y la Tabla X | Rosa (91) sola (−0,03 a +0,19 % con vueltas juntas, −2,8 % con s = d) |
| D∞ de RF de Knight en una capa (semiempírico) | M31 y M32 medidas en HF (MKG1 a MKG4 son de baja frecuencia y no lo respaldan) | Resultado principal con L0 de Rosa y Nagaoka, y la corrección de RF solo como nota |
| Chebyshev par con terminaciones iguales en resonadores acoplados | Simulación (CR5, CR6) | Chebyshev par sube al impar, como en π y T |
| Divisor capacitivo del Capacitor de extremo | −0,7 % contra la aproximación de Q alto | Se saca de los pasos intermedios |

Los **Criterios prácticos** se aprueban como criterio y no como fórmula; si no se aprueban, se ajustan sus números:

- los umbrales de Valor dudoso y Valor impracticable;
- la Ventana de L;
- el ±20 % del trimmer.

### 13.6 Informe de casos

- **Forma:** `npm run informe` genera un HTML autocontenido desde las tablas de Casos de prueba y el resultado de Vitest (reporter JSON), con las fórmulas en Temml y las mismas cadenas LaTeX de la interfaz. Tiene CSS de impresión, así que "Guardar como PDF" da el PDF. Va en el artefacto de CI de cada push y adjunto a la Release. No entra en el Asistente.
- **Encabezado:** Versión, hash del commit y fecha.
- **Orden:**
  1. Cambios desde la última Versión aprobada: casos nuevos, modificados (con el valor anterior y el nuevo) y eliminados; fórmulas o referencias que cambiaron; Deducciones propias nuevas.
  2. Una sección por Calculadora, agrupada por clase de caso.
  3. Común.
  4. Deducciones propias y Criterios prácticos.
  5. Apéndice de oráculos.
- **Cada caso** es una fila con las entradas, el esperado, el obtenido, el error relativo, la tolerancia y su motivo, la Diferencia esperada si hay, el estado y la referencia con edición y página. La fila se despliega y muestra los pasos intermedios del resultado, los mismos que ve el Alumno.

### 13.7 Aprobación

1. La Cátedra contesta "apruebo la vX.Y.Z" por el canal que use (mail o WhatsApp).
2. El Ayudante de cátedra lo asienta en `docs/aprobaciones.md` del repo `asistente-e3`, con la Versión, el hash, la fecha, quién aprobó y qué Deducciones propias se aprobaron. Recién ahí crea la etiqueta.
3. El workflow de la etiqueta no publica si falta la entrada con ese hash.

- **Toda Versión necesita aprobación.** Una Versión sin cambios de cálculo se aprueba mirando solo la sección de Cambios.
- **Un caso en rojo bloquea la Versión:** no existe la "falla aceptada". Si el que estaba mal era el caso (una referencia mal leída, una tolerancia mal puesta), se corrige en un commit con el motivo, y aparece en la sección de Cambios.

Origen: [Casos de prueba e informe para la aprobación de la Cátedra](issues/24-casos-de-prueba-aprobacion.md).

## 14. Referencias

| Obra | Dónde se usa |
|---|---|
| G. L. Matthaei, L. Young, E. M. T. Jones, *Microwave Filters, Impedance-Matching Networks, and Coupling Structures*, McGraw-Hill, 1964 (informe SRI/DTIC AD0402852 y AD0402930, 1963) | Filtros, resonadores acoplados, atenuadores con Z1 = Z2 |
| D. M. Pozar, *Microwave Engineering*, 4.ª ed., Wiley, 2012 | Filtros |
| A. I. Zverev, *Handbook of Filter Synthesis*, Wiley, 1967 | Filtros, resonadores acoplados |
| A. B. Williams, F. J. Taylor, *Electronic Filter Design Handbook*, 4.ª ed., McGraw-Hill, 2006 | Filtros |
| H. Takahasi, *J. IECE Japan* 34(2), 1951; L. Weinberg, P. Slepian, *IRE Trans. Circuit Theory* CT-7(2), 1960 | Filtros con R_s ≠ R_L |
| S. B. Cohn, *Proc. IRE* 45(2), 1957 | Mapeo de resonadores acoplados, pérdida por Q |
| R. Bowick, *RF Circuit Design* | Redes de adaptación |
| Motorola, AN721, *Impedance Matching Networks Applied to RF Power Transistors* | Redes de adaptación |
| R. Kaune, QEX, septiembre/octubre de 2015 | Ancho de banda de redes π y T |
| *Reference Data for Radio Engineers*, 4.ª ed., ITT, 1956 (y 1.ª ed., 1943) | Atenuadores |
| E. B. Rosa, *Bull. Bureau of Standards* 2(2), 1906; E. B. Rosa, F. W. Grover, *Bull. BS* 8(1), 1912 | Bobinas |
| NBS Circular 74, *Radio Instruments and Measurements*, 1918 | Bobinas, terminales |
| D. W. Knight, *Solenoid Inductance Calculation*, v0.20, 2016, y *The self-resonance and self-capacitance of solenoid coils*, 2016 | Bobinas |
| R. Lundin, *Proc. IEEE* 73(9), 1985 | Bobinas (kL) |
| H. A. Wheeler, *Proc. IRE* 16(10), 1928 | Bobinas (pasos intermedios) |
| R. G. Medhurst, *Wireless Engineer*, 1947 | Bobinas (SRF) |
| IEC 60063:2015 (Vishay Dale, doc. 31001) | Series E |
| KEMET C1003_C0G; KYOCERA AVX; KOA; Brinson | Tolerancias de capacitores, ESL, parásitas de resistencias |
| Temml 0.14.0; Latin Modern Math (GUST) | Fórmulas en pantalla |
