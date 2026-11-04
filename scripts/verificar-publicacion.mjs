// npm run verificar-publicacion -- --etiqueta vX.Y.Z: lo corre el workflow de la etiqueta antes de
// publicar (spec §3.4, §13.7), sobre el commit de la etiqueta y con la historia entera de git.
//
// Con una entrada de esa Versión en docs/aprobaciones.md, revisa que la etiqueta coincida con
// package.json, que del commit aprobado al de la etiqueta solo haya cambiado el asiento y que la huella
// guardada sea la de ese commit. Sin entrada propia, revisa que sea posterior a la última aprobada y
// que desde ella no haya cambiado src/calculo/ ni src/entrada/: el workflow después compara las huellas.
//
// Si está todo en regla escribe en $GITHUB_OUTPUT el commit desde el que construir (commit=...), si se
// publica con aprobación propia o sin cambios (modo=aprobada|sin-cambios) y la Versión cuya aprobación
// vale (base=X.Y.Z). Si no, sale con código 1 y dice por qué.

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
  const {
    leerAprobaciones,
    problemasDePublicacion,
    problemasSinCambios,
    rutaDeHuella,
    ultimaAprobada,
    versionDeEtiqueta,
  } = await servidor.ssrLoadModule('/scripts/informe/aprobaciones.ts');
  const { REGISTRO } = await servidor.ssrLoadModule('/src/calculo/comun/registro.ts');

  const { version: versionPaquete } = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf-8'));
  const aprobaciones = leerAprobaciones(readFileSync(join(raiz, 'docs/aprobaciones.md'), 'utf-8'));
  // Con una etiqueta que no es vX.Y.Z, problemasDePublicacion lo dice y no se busca nada más.
  const version = versionDeEtiqueta(etiqueta) ?? etiqueta;
  const aprobacion = aprobaciones.find((a) => a.version === version);
  const ultima = ultimaAprobada(aprobaciones);
  // Sin entrada propia, la Versión se mide contra la última aprobada y se construye desde la etiqueta.
  const conEntrada = aprobacion || !ultima;
  const base = conEntrada ? aprobacion : ultima;
  const entero = base ? commitAprobado(base.hash) : null;
  // Las rutas de git son relativas a la raíz del repositorio, que es la de este proyecto.
  const cambiadosDesdeAprobado = entero
    ? git('diff', '--name-only', entero, 'HEAD').split('\n').filter(Boolean)
    : null;
  const rutaHuella = join(raiz, rutaDeHuella(version));
  const huella = existsSync(rutaHuella) ? JSON.parse(readFileSync(rutaHuella, 'utf-8')) : null;

  const problemas = conEntrada
    ? problemasDePublicacion({
        etiqueta,
        versionPaquete,
        aprobaciones,
        idsDeducciones: REGISTRO.filter((e) => e.tipo === 'deduccion-propia').map((e) => e.id),
        cambiadosDesdeAprobado,
        huellaAprobada: huella && { version: huella.version, commit: huella.commit },
      })
    : problemasSinCambios({ etiqueta, versionPaquete, ultima, cambiadosDesdeAprobado });

  if (problemas.length) {
    console.error(`No se publica ${etiqueta}:`);
    for (const p of problemas) console.error(`- ${p}`);
    process.exitCode = 1;
  } else {
    const commit = conEntrada ? entero : git('rev-parse', 'HEAD');
    console.log(
      conEntrada
        ? `${etiqueta} aprobada el ${aprobacion.fecha} por ${aprobacion.aprobo}: commit ${commit}.`
        : `${etiqueta} sin entrada propia: se revisa que no cambie el cálculo desde ` +
            `v${ultima.version}, aprobada el ${ultima.fecha}. Commit ${commit}.`,
    );
    if (process.env.GITHUB_OUTPUT) {
      const modo = conEntrada ? 'aprobada' : 'sin-cambios';
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        `commit=${commit}\nmodo=${modo}\nbase=${base.version}\n`,
      );
    }
  }
} finally {
  await servidor.close();
}
