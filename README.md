# Asistente E3

Calculadoras para dimensionar los componentes de circuitos de VHF. La especificación está en [`docs/spec.md`](docs/spec.md).

| Comando                 | Qué hace                                              |
| ----------------------- | ----------------------------------------------------- |
| `npm run dev`           | Servidor de desarrollo                                |
| `npm run build`         | PWA instalable en `dist/`                             |
| `npm run build:archivo` | HTML único autocontenido en `dist-archivo/index.html` |
| `npm run typecheck`     | `tsc --noEmit`                                        |
| `npm test`              | Vitest                                                |

Node 24 (ver `.nvmrc`). La Versión sale de `package.json` más el hash corto del commit.
