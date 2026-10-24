# Asistente E3

Calculadoras para dimensionar los componentes de circuitos de VHF. La especificación está en [`docs/spec.md`](docs/spec.md).

| Comando                 | Qué hace                                                            |
| ----------------------- | ------------------------------------------------------------------- |
| `npm run dev`           | Servidor de desarrollo                                              |
| `npm run build`         | PWA instalable en `dist/`                                           |
| `npm run build:archivo` | HTML único autocontenido en `dist-archivo/index.html`               |
| `npm run build:muestra` | Página de muestra del sistema visual en `dist-muestra/muestra.html` |
| `npm run iconos`        | Arma los PNG del ícono del Asistente en `public/`                   |
| `npm run typecheck`     | `tsc --noEmit`                                                      |
| `npm test`              | Vitest                                                              |

Node 24 (ver `.nvmrc`). La Versión sale de `package.json` más el hash corto del commit.

## Sistema visual

- Colores, tipografía, tamaños y espaciado: `src/ui/tokens.css`. Las Calculadoras usan esas variables y nunca un color suelto; `tests/paleta.test.ts` verifica el contraste en el tema claro y en el oscuro ([ADR 1](docs/adr/0001-modo-oscuro-segun-el-sistema.md)).
- Componentes base (tarjeta de resultado, campos, rótulos, botón de pase, franjas, esquema en escalera): `src/ui/comun/`.
- La página de muestra los presenta todos. No llega al Asistente: con `npm run dev` está en `/muestra.html`, y `npm run build:muestra` la arma como un HTML suelto para mirarla en el celular.
