# Asistente E3

El Asistente E3 calcula los componentes de los circuitos que se arman en la materia, sobre todo en VHF (30 a 300 MHz) y montados en Manhattan con componentes con terminales. Tiene cinco Calculadoras: bobinas, filtros, Arreglos equivalentes, redes de adaptación y atenuadores.

Funciona en Android, iPhone y PC, también sin conexión. Cada resultado trae la fórmula que usa y de dónde sale, y la Cátedra aprueba todo cambio de cálculo antes de que llegue a los Alumnos.

## Cómo abrirlo

- **Desde el link:** abrí en el navegador el link que recibiste. Con eso ya podés usarlo.
- **Instalado en Android:** en Chrome, abrí el menú ⋮ y elegí "Instalar app" o "Agregar a la pantalla principal".
- **Instalado en iPhone:** en Safari, tocá Compartir y elegí "Agregar a inicio".
- **Instalado en PC:** en Chrome o Edge, usá el ícono de instalar de la barra de direcciones.
- **Como archivo en PC:** el link "Descargar versión para PC", al pie del menú, baja el Asistente en un solo archivo HTML. Sirve de respaldo si no podés instalarlo, pero puede no guardar tus datos: si es así, el Asistente te avisa.

Cuando hay una Versión nueva aparece la franja "Hay una versión nueva". Al recargar, conservás tus entradas y tu Inventario.

## Cómo se usa

Elegí una Calculadora en las pestañas de abajo (celular) o en el menú de la izquierda (PC) y completá sus campos. El resultado se calcula solo mientras escribís: no hay botón de calcular.

Si falta un dato, el resultado dice "Completá: …". Si un valor no se puede leer, el campo se marca en rojo con el motivo, el resultado dice "Corregí: …" y no se calcula hasta que lo arregles.

En el celular, un botón flotante te lleva de las entradas al resultado y de vuelta ("Ver resultado", "Volver a las entradas"). Enter pasa al campo siguiente.

### Cómo escribir un valor

Los campos aceptan el número con su prefijo y su unidad, de varias formas. Debajo del campo, un eco te muestra cómo se leyó: "= 4,7 nH".

- **Con coma o con punto:** 4,7 y 4.7 son lo mismo. No hay separador de miles: "1.000" se lee como 1. Para mil, escribí 1000 o 1k.
- **Con prefijo y unidad:** 4,7 nH, 4,7n, 0.0047u, 145M, 1,2 kΩ.
- **En notación RKM (solo L, C y R):** 4n7, 2p2, 4k7, 1M5. En resistencias también R47 y 47R.
- **En notación científica:** 4.7e-9, sin prefijo.
- **Mayúsculas:** importan solo en m y M, y en p y P. 100m es 100 mili y 100M es 100 mega.
- **Sin prefijo ni unidad:** el número se lee en la unidad del Selector de unidad, el desplegable junto al campo.
- **Lo que escribís manda sobre el selector:** 4,7n con el selector en pF da 4,7 nF.
- **Largos:** van siempre en mm, solo con el número.

### Cómo leer un resultado

Arriba van los avisos que afectan a todo el resultado y el resultado principal. Después, las tarjetas con cada variante, y al pie las notas de construcción.

Cada tarjeta muestra primero los valores. Los desplegables, cerrados al abrir, tienen el resto:

- **Fórmulas y fuentes:** las fórmulas y su referencia bibliográfica.
- **Pasos intermedios:** cada fórmula con los números sustituidos, para seguir la cuenta.

Algunos valores llevan un rótulo que aclara de dónde salen:

- **estimación:** un valor aproximado, como la autorresonancia de una bobina o una pérdida.
- **criterio práctico:** una regla de montaje que no sale de la bibliografía.
- **criterio de diseño:** una práctica habitual sin una fuente primaria, como el margen de potencia de 2× en atenuadores.
- **deducción propia:** una fórmula o adaptación que no está publicada y que la Cátedra aprobó aparte.

### Valor dudoso y Valor impracticable

El Asistente revisa cada L, C y R calculada, suponiendo un montaje Manhattan con terminales cortos, y estima cuánto se apartaría del cálculo una vez armada:

- **Valor dudoso (en ámbar):** se aparta un 20 % o más. Se puede construir con cuidado.
- **Valor impracticable (en rojo):** se aparta un 50 % o más. No se va a comportar como se calculó.

El valor se muestra igual, nunca se bloquea. Al pie de la tarjeta está el motivo con sus números y, si la Calculadora tiene una, la sugerencia para evitarlo.

### Pasar un valor a otra Calculadora

Junto a los valores del resultado hay botones de pase: "→ Bobinas" en una L y "→ Arreglos" en una C o una R. Te llevan a esa Calculadora con el valor ya cargado, con todos sus decimales, y una franja arriba te recuerda de dónde vino.

- **Volver:** el botón de la franja te devuelve a la Calculadora anterior tal como estaba. Si encadenaste varios pases, deshace de a uno.
- **Cambiar desde las pestañas o el menú:** se olvidan los pases hechos y ya no hay a dónde volver.
- **El aviso viaja con el valor:** si era un Valor dudoso o impracticable, la franja lo repite con su motivo.
- **Lo que no se pasa:** los Capacitores de sintonía de los resonadores acoplados, porque van con trimmer.

### Qué se guarda

El Asistente recuerda en ese dispositivo y en ese navegador lo que escribiste en cada Calculadora, tu Inventario y la última Calculadora abierta. No hace falta guardar nada a mano.

El Inventario no se puede exportar: se pierde si cambiás de celular o si el navegador borra sus datos. En iPhone, la pestaña de Safari y el Asistente instalado no comparten los datos.

## Las Calculadoras

### Bobinas

Calcula las vueltas y el largo de una bobina solenoidal de aire para la inductancia que buscás, siempre en una capa y en dos capas.

- **Qué pide:** Inductancia buscada, Diámetro del carrete, Diámetro del cable con esmalte (si es desnudo o plateado, el diámetro desnudo) y Separación entre vueltas (cero es vueltas juntas). La Frecuencia de trabajo es opcional.
- **Qué da:** por variante, las dos cantidades de vueltas más cercanas en pasos de media vuelta, con su L, su error y el Largo de la bobina. También la autorresonancia estimada.
- **La Frecuencia de trabajo:** con ella, avisa si trabajás demasiado cerca de la autorresonancia.
- **Al armarla:** los terminales suman inductancia y el metal cercano la baja. Estirar o comprimir la bobina ajusta la L.

### Filtros

Calcula filtros LC en escalera π o T para pasa bajos, pasa altos, pasa banda y rechaza banda y, solo en pasa banda, con la Topología de resonadores acoplados.

- **Qué pide:** Tipo de filtro, Aproximación (Butterworth, Chebyshev con su ripple o Bessel), Topología, Orden, frecuencias, Rs, RL y Q de las bobinas.
- **El Orden:** se escribe (de 1 a 10) o se calcula desde la atenuación As que querés a una frecuencia fs.
- **Las frecuencias:** fc en pasa bajos y pasa altos; f1 y f2, o f0 y BW, en pasa banda y rechaza banda.
- **Qué da:** el esquema con cada L y C en orden desde la fuente, y la pérdida estimada por el Q de las bobinas.
- **Rs y RL distintas (π y T):** el filtro tiene pérdida plana y el Asistente lo avisa, con un pase a la Calculadora de redes.
- **Resonadores acoplados:** todos usan la misma L, que el Asistente propone y podés cambiar. Este filtro sí adapta Rs y RL. La frecuencia a la que se ajusta cada resonador es la Frecuencia de sintonía, que no es la central de la banda.

### Arreglos

Busca las combinaciones en serie y en paralelo de hasta 4 Valores comerciales que mejor se acercan a un valor, en capacitores o en resistencias.

- **Qué pide:** Componente, Valor buscado, serie (E6, E12 o E24), Umbral de error y tolerancias. Vienen con valores por defecto, salvo el Valor buscado.
- **Qué da:** los 10 mejores Arreglos equivalentes, primero los que están por debajo del umbral y usan menos componentes. Cada uno con su valor, el Error del arreglo y la Tolerancia del arreglo, que es el rango de peor caso.
- **Cómo se leen:** "39 pF serie 270 pF" o "(27 pF serie 68 pF) || 15 pF", donde || es paralelo.
- **Sin Inventario propio:** usa la serie completa, de 1 pF a 10 nF o de 1 Ω a 10 MΩ.
- **Con Inventario propio:** tocá "Editar Inventario". Hay uno por tipo de componente, y se carga por inclusión (la lista de lo que tenés) o por exclusión (una serie en un rango, tocando en la grilla los valores que te faltan).
- **Cantidades:** el Inventario no las guarda. Si un Arreglo repite un valor, lo avisa ("usa 3 × 10 pF").
- **En VHF:** cada componente y cada soldadura agregan L y C parásitas, así que conviene el Arreglo con menos componentes que te alcance.

### Redes

Calcula redes de adaptación L, π y T entre una fuente y una carga resistivas, a una frecuencia. Las cargas complejas no entran en esta Versión.

- **Qué pide:** Topología, f₀, Rs, RL (el botón ⇄ las intercambia) y Q de la bobina. En π y T también el Q de diseño, y el campo te muestra el mínimo posible.
- **Qué da:** una tarjeta por variante, con su esquema, cada L y C con su reactancia y si deja pasar la continua o la bloquea. También el barrido y la pérdida estimada.
- **Valores exactos:** no se redondean a una serie. Para el ajuste fino, conviene un trimmer.
- **Rs igual a RL:** en L ya está adaptada y no hace falta red. En π y T se calcula igual, pero la red solo filtra.

### Atenuadores

Calcula atenuadores resistivos T y π con impedancias iguales o distintas. Muestra los dos juntos para que los compares.

- **Qué pide:** Atenuación A (hasta 60 dB), Z1 y Z2 (el botón ⇄ las intercambia). La Potencia de entrada, en W, mW o dBm, y la Frecuencia son opcionales.
- **Qué da:** las tres resistencias de cada Topología, con un pase a Arreglos para buscar sus Valores comerciales.
- **La Potencia de entrada:** con ella, muestra lo que disipa cada resistencia y la potencia nominal mínima sugerida, con un margen de 2×. La cuenta es para potencia continua: con señales moduladas, mirá la potencia de pico.
- **La Frecuencia:** se usa para revisar las resistencias. Si la dejás vacía, se revisan a 300 MHz.
- **Z1 y Z2 distintas:** hay una atenuación mínima posible. El botón "Mínima pérdida" la fija y muestra la red L de dos resistencias.
- **Más de 40 dB:** en VHF una sola sección no llega a esa atenuación real. Conviene armar secciones de 10 a 20 dB en cascada, usando la Calculadora una vez por sección.
- **Al armarlo:** usá resistencias de película o SMD, no de alambre, y terminales cortos.

<!-- fin de la ayuda -->

## Para quien mantiene el Asistente

Cómo construirlo, probarlo y publicarlo está en [`docs/desarrollo.md`](docs/desarrollo.md), y la especificación completa en [`docs/spec.md`](docs/spec.md). El botón "Ayuda" del Asistente muestra este README hasta la línea anterior a esta sección.
