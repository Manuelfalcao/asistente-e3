// npm run verificar-sin-cambios: lo corre el workflow de la etiqueta después de `npm run informe`, para
// una Versión sin entrada propia en docs/aprobaciones.md (spec §13.7). Compara la huella recién armada
// con la de la última Versión aprobada y sale con código 1 si hay algún cambio de cálculo.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leerJson = (ruta) => JSON.parse(readFileSync(join(raiz, ruta), 'utf-8'));

// Los módulos son TypeScript con imports sin extensión: los carga Vite, como en scripts/informe.mjs.
const servidor = await createServer({
  root: raiz,
  configFile: false,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true },
});

try {
  const { leerAprobaciones, rutaDeHuella, ultimaAprobada } = await servidor.ssrLoadModule(
    '/scripts/informe/aprobaciones.ts',
  );
  const { compararHuellas } = await servidor.ssrLoadModule('/scripts/informe/cambios.ts');

  const ultima = ultimaAprobada(
    leerAprobaciones(readFileSync(join(raiz, 'docs/aprobaciones.md'), 'utf-8')),
  );
  if (!ultima) throw new Error('docs/aprobaciones.md no tiene ninguna Versión aprobada.');
  const cambios = compararHuellas(
    leerJson(rutaDeHuella(ultima.version)),
    leerJson('dist-informe/huella.json'),
  );

  if (cambios.sinCambiosDeCalculo) {
    console.log(`Sin cambios de cálculo desde v${ultima.version}: se publica con su aprobación.`);
  } else {
    console.error(
      `Hay cambios de cálculo desde v${ultima.version}: esta Versión necesita su entrada en ` +
        `docs/aprobaciones.md. Casos nuevos: ${cambios.nuevos.length}, modificados: ` +
        `${cambios.modificados.length}, eliminados: ${cambios.eliminados.length}, con otras ` +
        `fórmulas: ${cambios.formulas.length}, con otra referencia: ${cambios.referencias.length}, ` +
        `Deducciones y Criterios que cambiaron: ` +
        `${cambios.registroNuevo.length + cambios.registroCambiado.length + cambios.registroEliminado.length}.`,
    );
    process.exitCode = 1;
  }
} finally {
  await servidor.close();
}
