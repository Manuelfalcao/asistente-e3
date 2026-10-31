// npm run informe: genera el Informe de casos (spec §13.6) en dist-informe/informe.html, y su huella
// en dist-informe/huella.json. La sección de Cambios se arma contra la huella de la última Versión
// de docs/aprobaciones.md, guardada en docs/aprobaciones/vX.Y.Z.json.
//
//   npm run informe                          corre Vitest con el reporter JSON y arma el informe
//   npm run informe -- --resultados r.json   usa un resultado de Vitest ya corrido
//   npm run informe -- --salida otro.html    cambia dónde lo deja (la huella va al lado)
//
// Sale con código 1 si algún caso está en rojo o sin test, o si algún test de Vitest falló; el
// archivo se escribe igual, porque es lo que hay que mirar para saber qué pasó.

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// El mismo hash que usa vite.config.ts para la Versión del Asistente: el del commit en el que está
// el repo, que en el workflow de la etiqueta es el aprobado y no el de la etiqueta.
function hashCorto() {
  try {
    // Siempre 7 caracteres, como vite.config.ts.
    return execSync('git rev-parse HEAD', { cwd: raiz, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .slice(0, 7);
  } catch {
    return process.env.GITHUB_SHA?.slice(0, 7) ?? 'dev';
  }
}

function correrVitest() {
  const carpeta = mkdtempSync(join(tmpdir(), 'informe-'));
  const salida = join(carpeta, 'vitest.json');
  console.log('Corriendo Vitest…');
  // Con tests en rojo Vitest sale con error, pero el JSON queda escrito: es justo lo que se informa.
  spawnSync(
    process.execPath,
    [
      join(raiz, 'node_modules/vitest/vitest.mjs'),
      'run',
      '--reporter=json',
      `--outputFile=${salida}`,
    ],
    { cwd: raiz, stdio: ['ignore', 'ignore', 'inherit'] },
  );
  try {
    return JSON.parse(readFileSync(salida, 'utf-8'));
  } finally {
    rmSync(carpeta, { recursive: true, force: true });
  }
}

const rutaResultados = argumento('--resultados');
const json = rutaResultados
  ? JSON.parse(readFileSync(resolve(rutaResultados), 'utf-8'))
  : correrVitest();
const rutaSalida = resolve(argumento('--salida') ?? join(raiz, 'dist-informe/informe.html'));

// Los módulos del informe son TypeScript con imports sin extensión: los carga Vite, como a los tests.
const servidor = await createServer({
  root: raiz,
  configFile: false,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true },
});

try {
  const { leerResultadosVitest } = await servidor.ssrLoadModule('/scripts/informe/estado.ts');
  const { generarInforme } = await servidor.ssrLoadModule('/scripts/informe/generar.ts');
  const { leerAprobaciones, rutaDeHuella, ultimaAprobada } = await servidor.ssrLoadModule(
    '/scripts/informe/aprobaciones.ts',
  );
  const { version } = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf-8'));
  const pruebas = leerResultadosVitest(json);

  const ultima = ultimaAprobada(
    leerAprobaciones(readFileSync(join(raiz, 'docs/aprobaciones.md'), 'utf-8')),
  );
  let anterior = null;
  if (ultima) {
    const rutaHuella = join(raiz, rutaDeHuella(ultima.version));
    if (!existsSync(rutaHuella))
      throw new Error(
        `v${ultima.version} está aprobada pero falta ${rutaDeHuella(ultima.version)}.`,
      );
    anterior = JSON.parse(readFileSync(rutaHuella, 'utf-8'));
    console.log(`Cambios contra la v${ultima.version} (${ultima.hash}).`);
  }

  const { html, resumen, huella } = generarInforme({
    raiz,
    pruebas,
    encabezado: { version, commit: hashCorto(), fecha: new Date().toISOString().slice(0, 10) },
    anterior,
  });
  mkdirSync(dirname(rutaSalida), { recursive: true });
  writeFileSync(rutaSalida, html);
  writeFileSync(
    join(dirname(rutaSalida), 'huella.json'),
    `${JSON.stringify(huella, null, 1)}
`,
  );

  const fallan = pruebas.filter((p) => p.estado === 'failed').length;
  console.log(
    `${resumen.total} casos: ${resumen.ok} aprobados, ${resumen.falla} en rojo, ` +
      `${resumen.sinTest} sin test. Vitest: ${pruebas.length} tests, ${fallan} en rojo.`,
  );
  console.log(`Informe: ${rutaSalida}`);
  if (resumen.falla + resumen.sinTest + fallan > 0) process.exitCode = 1;
} finally {
  await servidor.close();
}
