// npm run verificar-publicacion -- --etiqueta vX.Y.Z: lo corre el workflow de la etiqueta antes de
// publicar (spec §3.4, §13.7), sobre el commit de la etiqueta y con la historia entera de git.
//
// Revisa que la etiqueta coincida con la Versión de package.json, que docs/aprobaciones.md tenga la
// entrada de esa Versión, que del commit aprobado al de la etiqueta solo haya cambiado el asiento de
// la aprobación y que la huella guardada sea la de ese commit. Si está todo en regla escribe el hash
// entero del commit aprobado en $GITHUB_OUTPUT (commit=...), para construir y publicar desde ahí; si
// no, sale con código 1 y dice por qué.

import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function git(...args) {
  return execFileSync('git', args, { cwd: raiz, stdio: ['ignore', 'pipe', 'pipe'] })
    .toString()
    .trim();
}

// El hash entero del commit aprobado, o null si no está en la historia del commit de la etiqueta.
function commitAprobado(hash) {
  try {
    const entero = git('rev-parse', '--verify', `${hash}^{commit}`);
    git('merge-base', '--is-ancestor', entero, 'HEAD');
    return entero;
  } catch {
    return null;
  }
}

const etiqueta = argumento('--etiqueta') ?? process.env.GITHUB_REF_NAME;
if (!etiqueta) {
  console.error('Falta la etiqueta: --etiqueta vX.Y.Z.');
  process.exit(1);
}

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
  const { leerAprobaciones, problemasDePublicacion, rutaDeHuella, versionDeEtiqueta } =
    await servidor.ssrLoadModule('/scripts/informe/aprobaciones.ts');
  const { REGISTRO } = await servidor.ssrLoadModule('/src/calculo/comun/registro.ts');

  const { version: versionPaquete } = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf-8'));
  const aprobaciones = leerAprobaciones(readFileSync(join(raiz, 'docs/aprobaciones.md'), 'utf-8'));
  // Con una etiqueta que no es vX.Y.Z, problemasDePublicacion lo dice y no se busca nada más.
  const version = versionDeEtiqueta(etiqueta) ?? etiqueta;
  const aprobacion = aprobaciones.find((a) => a.version === version);
  const entero = aprobacion ? commitAprobado(aprobacion.hash) : null;
  const rutaHuella = join(raiz, rutaDeHuella(version));
  const huella = existsSync(rutaHuella) ? JSON.parse(readFileSync(rutaHuella, 'utf-8')) : null;

  const problemas = problemasDePublicacion({
    etiqueta,
    versionPaquete,
    aprobaciones,
    idsDeducciones: REGISTRO.filter((e) => e.tipo === 'deduccion-propia').map((e) => e.id),
    // Las rutas de git son relativas a la raíz del repositorio, que es la de este proyecto.
    cambiadosDesdeAprobado: entero
      ? git('diff', '--name-only', entero, 'HEAD').split('\n').filter(Boolean)
      : null,
    huellaAprobada: huella && { version: huella.version, commit: huella.commit },
  });

  if (problemas.length) {
    console.error(`No se publica ${etiqueta}:`);
    for (const p of problemas) console.error(`- ${p}`);
    process.exitCode = 1;
  } else {
    console.log(
      `${etiqueta} aprobada el ${aprobacion.fecha} por ${aprobacion.aprobo}: commit ${entero}.`,
    );
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `commit=${entero}\n`);
  }
} finally {
  await servidor.close();
}
