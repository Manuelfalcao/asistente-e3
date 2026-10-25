# Asistente E3

Calculadoras para dimensionar los componentes de circuitos de VHF. La especificación está en [`docs/spec.md`](docs/spec.md).

| Comando                 | Qué hace                                                            |
| ----------------------- | ------------------------------------------------------------------- |
| `npm run dev`           | Servidor de desarrollo                                              |
| `npm run build`         | PWA instalable en `dist/`                                           |
| `npm run build:archivo` | HTML único autocontenido en `dist-archivo/index.html`               |
| `npm run build:muestra` | Página de muestra del sistema visual en `dist-muestra/muestra.html` |
| `npm run informe`       | Informe de casos para la Cátedra en `dist-informe/informe.html`     |
| `npm run iconos`        | Arma los PNG del ícono del Asistente en `public/`                   |
| `npm run fuente`        | Recorta Latin Modern Math para las fórmulas (Python con fontTools)  |
| `npm run typecheck`     | `tsc --noEmit`                                                      |
| `npm test`              | Vitest                                                              |

Node 24 (ver `.nvmrc`). La Versión sale de `package.json` más el hash corto del commit.

## Sistema visual

- Colores, tipografía, tamaños y espaciado: `src/ui/tokens.css`. Las Calculadoras usan esas variables y nunca un color suelto; `tests/paleta.test.ts` verifica el contraste en el tema claro y en el oscuro ([ADR 1](docs/adr/0001-modo-oscuro-segun-el-sistema.md)).
- Componentes base (tarjeta de resultado, forma del resultado, fórmula, cita, pasos intermedios, campos, rótulos, botón de pase, franjas, esquema en escalera): `src/ui/comun/`.
- La página de muestra los presenta todos. No llega al Asistente: con `npm run dev` está en `/muestra.html`, y `npm run build:muestra` la arma como un HTML suelto para mirarla en el celular.

## Fórmulas

- El cálculo (`src/calculo/`) escribe las fórmulas como cadenas LaTeX con los números ya sustituidos; `src/ui/comun/Formula.tsx` las dibuja con Temml.
- La fuente es Latin Modern Math (licencia GUST) recortada a los caracteres de `scripts/fuentes/rangos.txt`. Si una fórmula nueva usa un carácter que no está, `tests/fuente/fuente.test.ts` falla: hay que sumarlo a la lista y correr `npm run fuente` (`pip install fonttools brotli`).

## Informe de casos

`npm run informe` corre Vitest con el reporter JSON y arma `dist-informe/informe.html`: un HTML autocontenido con todos los Casos de prueba, las Deducciones propias, los Criterios prácticos y los oráculos, que la Cátedra revisa para aprobar una Versión ([spec §13.6](docs/spec.md)). "Guardar como PDF" da el PDF. El CI lo deja como artefacto en cada push a `main`; no entra en el Asistente.

- **Una Calculadora nueva aparece sola**: sus tablas de casos van en `tests/calculo/<calculadora>/` y un `informe.ts` al lado las adapta (`AporteInforme`, en `tests/casos-informe.ts`): corre el cálculo con las entradas de cada caso y devuelve el obtenido, el error y los pasos. Se levanta con `import.meta.glob`, sin registrarlo en ningún lado del informe.
- **Pero el test del informe sí lleva la lista**: `tests/informe/generar.test.ts` fija qué Calculadoras aportan casos ("y nada más por ahora"), para que un `informe.ts` no aparezca ni desaparezca sin querer. En el mismo commit que suma el `informe.ts` de una Calculadora, agregá su id a ese `Set` y corré `npm test` completo, no solo los tests de la Calculadora: si no, CI queda en rojo en `main`.
- **La caché de módulos de Vitest está apagada** (`fsModuleCache: false` en `vite.config.ts`): no se entera de un archivo nuevo que entra en un `import.meta.glob`, así que en local el informe dejaba de ver el `informe.ts` nuevo mientras CI sí lo veía. No la vuelvas a prender; si alguna vez quedó una `node_modules/.vitest-cache` vieja, se puede borrar.
- **El estado de un caso sale de Vitest**: el test que lo corre se llama como el caso (`it(caso.id, …)`), o empieza con `"<id>:"`. Un caso sin test queda "sin test", y uno con algún número fuera de la tolerancia queda en rojo aunque su test haya pasado. `npm run informe` sale con error si hay alguno de los dos, o si falla cualquier test.
- **Los oráculos** de `tests/oraculos/` se describen solos con su comentario de cabecera y sus funciones exportadas.
- **Una Deducción propia** va en `REGISTRO` (`src/calculo/comun/registro.ts`) con su `deduccion` en pasos y su `bandera`; los casos que se corren con la fórmula propia o con el plan B llevan `bandera: { deduccion: id, lado }` y el informe los muestra de los dos lados.
- La sección de Cambios queda vacía hasta que la llene la publicación de la Versión (`cambios` de `generarInforme`).
- Con `npm run informe -- --resultados r.json` usa un resultado de Vitest ya corrido.
