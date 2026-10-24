import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REGISTRO } from '../../src/calculo/comun/registro';
import type { AporteInforme } from '../../tests/casos-informe';
import { aportesDeTests, seccionesDeCasos } from './casos';
import { type PruebaVitest, type ResumenEstados, resumenDeEstados } from './estado';
import { type DatosInforme, renderizarInforme } from './html';
import { leerOraculos } from './oraculos';

// Arma el Informe de casos (spec §13.6) a partir de las tablas de Casos de prueba, el resultado de
// Vitest y los registros comunes. Lo llama scripts/informe.mjs.

export interface OpcionesInforme {
  // La raíz del repo, para leer la fuente de las fórmulas, el CSS de Temml y tests/oraculos/.
  raiz: string;
  pruebas: readonly PruebaVitest[];
  encabezado: DatosInforme['encabezado'];
  // Para los tests; por defecto, todos los informe.ts de tests/.
  aportes?: readonly AporteInforme[];
  // El HTML de la sección de Cambios; lo arma la publicación de la Versión.
  cambios?: string | null;
}

function dataUri(ruta: string, tipo: string): string {
  return `data:${tipo};base64,${readFileSync(ruta).toString('base64')}`;
}

// El CSS de Temml es el de la interfaz; su única fuente suelta va embebida.
function cssDeTemml(raiz: string): string {
  const dist = join(raiz, 'node_modules/temml/dist');
  return readFileSync(join(dist, 'Temml-Local.css'), 'utf-8').replace(
    /url\((['"]?)Temml\.woff2\1\)/g,
    `url(${dataUri(join(dist, 'Temml.woff2'), 'font/woff2')})`,
  );
}

export function generarInforme(opciones: OpcionesInforme): {
  html: string;
  resumen: ResumenEstados;
} {
  const { raiz, pruebas, encabezado, cambios = null } = opciones;
  const secciones = seccionesDeCasos(opciones.aportes ?? aportesDeTests(), pruebas);
  // Un caso con bandera de una Deducción que no está en el registro no tendría dónde mostrarse.
  const ids = new Set(REGISTRO.map((e) => e.id));
  for (const { caso } of secciones.flatMap((s) => s.casos)) {
    if (caso.bandera && !ids.has(caso.bandera.deduccion)) {
      throw new Error(
        `El caso «${caso.id}» usa la bandera de «${caso.bandera.deduccion}», que no está en REGISTRO.`,
      );
    }
  }
  const datos: DatosInforme = {
    encabezado,
    vitest: { total: pruebas.length, fallan: pruebas.filter((p) => p.estado === 'failed').length },
    secciones,
    registro: REGISTRO,
    oraculos: leerOraculos(join(raiz, 'tests/oraculos'), 'tests/oraculos'),
    cambios,
    fuente: {
      css: `${cssDeTemml(raiz)}\n${readFileSync(join(raiz, 'scripts/informe/informe.css'), 'utf-8')}`,
      fuenteFormula: dataUri(
        join(raiz, 'src/ui/fuentes/latinmodern-math-recorte.woff2'),
        'font/woff2',
      ),
    },
  };
  return {
    html: renderizarInforme(datos),
    resumen: resumenDeEstados(secciones.flatMap((s) => s.casos.map((c) => c.estado))),
  };
}
