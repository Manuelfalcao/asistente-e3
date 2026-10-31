// docs/aprobaciones.md (spec §13.7): cada Versión que aprueba la Cátedra, asentada por el Ayudante de
// cátedra. El Informe de casos mide sus Cambios contra la última, y el workflow de la etiqueta no
// publica sin la entrada de esa Versión con ese hash (spec §3.4).
//
// Cada entrada es un título "## vX.Y.Z" con cuatro renglones:
//
//   - Hash: abc1234
//   - Fecha: 2026-11-05
//   - Aprobó: Ing. Nombre Apellido, por mail
//   - Deducciones propias aprobadas: maxwell-externo-dos-capas, divisor-capacitivo   (o "ninguna")

// "v0.2.0" → "0.2.0"; null si no es una etiqueta vX.Y.Z.
export function versionDeEtiqueta(etiqueta: string): string | null {
  return /^v(\d+\.\d+\.\d+)$/.exec(etiqueta)?.[1] ?? null;
}

export interface Aprobacion {
  version: string;
  hash: string;
  fecha: string;
  aprobo: string;
  // Los ids de las Deducciones propias del registro común (src/calculo/comun/registro.ts).
  deducciones: string[];
}

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const CAMPOS = {
  hash: 'Hash',
  fecha: 'Fecha',
  aprobo: 'Aprobó',
  deducciones: 'Deducciones propias aprobadas',
} as const;

// Los renglones fuera de los bloques de código: el archivo puede mostrar una entrada de ejemplo.
function renglonesSinCodigo(md: string): string[] {
  let enCodigo = false;
  return md.split(/\r?\n/).filter((r) => {
    if (r.trimStart().startsWith('```')) {
      enCodigo = !enCodigo;
      return false;
    }
    return !enCodigo;
  });
}

function aprobacionDeRenglones(version: string, renglones: readonly string[]): Aprobacion {
  const campos = new Map<string, string>();
  for (const r of renglones) {
    const m = /^\s*[-*]\s*([^:]+):\s*(.*?)\s*$/.exec(r);
    if (m) campos.set(m[1].trim(), m[2]);
  }
  const campo = (nombre: string) => {
    const valor = campos.get(nombre);
    if (!valor)
      throw new Error(`La entrada de v${version} en docs/aprobaciones.md no tiene «${nombre}».`);
    return valor;
  };
  const hash = campo(CAMPOS.hash).replace(/`/g, '');
  if (!/^[0-9a-f]{7,40}$/.test(hash))
    throw new Error(`La entrada de v${version}: el hash «${hash}» no es el de un commit.`);
  const fecha = campo(CAMPOS.fecha);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha))
    throw new Error(`La entrada de v${version}: la fecha «${fecha}» no es AAAA-MM-DD.`);
  const deducciones = campo(CAMPOS.deducciones);
  return {
    version,
    hash,
    fecha,
    aprobo: campo(CAMPOS.aprobo),
    deducciones: /^ningun[ao]$/i.test(deducciones)
      ? []
      : deducciones
          .split(',')
          .map((d) => d.replace(/`/g, '').trim())
          .filter(Boolean),
  };
}

export function leerAprobaciones(md: string): Aprobacion[] {
  const aprobaciones: Aprobacion[] = [];
  let actual: { version: string; renglones: string[] } | null = null;
  const cerrar = () => {
    if (!actual) return;
    if (aprobaciones.some((a) => a.version === actual!.version))
      throw new Error(`v${actual.version} está asentada dos veces en docs/aprobaciones.md.`);
    aprobaciones.push(aprobacionDeRenglones(actual.version, actual.renglones));
  };
  for (const r of renglonesSinCodigo(md)) {
    const titulo = /^##\s+(.*?)\s*$/.exec(r);
    if (titulo) {
      cerrar();
      const version = versionDeEtiqueta(titulo[1]);
      if (!version)
        throw new Error(`«## ${titulo[1]}» en docs/aprobaciones.md no es una Versión vX.Y.Z.`);
      actual = { version, renglones: [] };
    } else {
      actual?.renglones.push(r);
    }
  }
  cerrar();
  return aprobaciones;
}

function numeros(version: string): number[] {
  return SEMVER.exec(version)!.slice(1).map(Number);
}

function compararVersiones(a: string, b: string): number {
  const [x, y] = [numeros(a), numeros(b)];
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

export function ultimaAprobada(aprobaciones: readonly Aprobacion[]): Aprobacion | null {
  return aprobaciones.reduce<Aprobacion | null>(
    (ultima, a) => (ultima && compararVersiones(ultima.version, a.version) >= 0 ? ultima : a),
    null,
  );
}

// Un hash corto y uno largo del mismo commit.
export function mismoCommit(a: string, b: string): boolean {
  return a.length >= 7 && b.length >= 7 && (a.startsWith(b) || b.startsWith(a));
}

export function rutaDeHuella(version: string): string {
  return `docs/aprobaciones/v${version}.json`;
}

// Lo único que puede haber entre el commit aprobado y el de la etiqueta: el asiento de la aprobación.
function esDelAsiento(archivo: string): boolean {
  return archivo === 'docs/aprobaciones.md' || /^docs\/aprobaciones\/[^/]+\.json$/.test(archivo);
}

export interface DatosPublicacion {
  // "v0.2.0"
  etiqueta: string;
  versionPaquete: string;
  aprobaciones: readonly Aprobacion[];
  // Los ids de las Deducciones propias de REGISTRO.
  idsDeducciones: readonly string[];
  // Los archivos que cambian del commit aprobado al de la etiqueta; null si el commit aprobado no es
  // un antecesor del de la etiqueta.
  cambiadosDesdeAprobado: readonly string[] | null;
  // La Versión y el commit de docs/aprobaciones/vX.Y.Z.json; null si no está.
  huellaAprobada: { version: string; commit: string } | null;
}

// Lo que impide publicar la etiqueta; vacío si se puede. Los tests y el Informe sin rojos los revisa
// el workflow aparte, sobre el commit aprobado.
export function problemasDePublicacion(d: DatosPublicacion): string[] {
  const version = versionDeEtiqueta(d.etiqueta);
  if (!version) return [`La etiqueta «${d.etiqueta}» no es vX.Y.Z.`];
  const problemas: string[] = [];
  if (version !== d.versionPaquete)
    problemas.push(
      `La etiqueta ${d.etiqueta} no coincide con la Versión de package.json (${d.versionPaquete}).`,
    );
  const aprobacion = d.aprobaciones.find((a) => a.version === version);
  if (!aprobacion) {
    problemas.push(`docs/aprobaciones.md no tiene la entrada de ${d.etiqueta}.`);
    return problemas;
  }
  if (d.cambiadosDesdeAprobado === null) {
    problemas.push(
      `El commit aprobado ${aprobacion.hash} no es un antecesor del commit de la etiqueta.`,
    );
  } else {
    const ajenos = d.cambiadosDesdeAprobado.filter((a) => !esDelAsiento(a));
    if (ajenos.length)
      problemas.push(
        `Del commit aprobado ${aprobacion.hash} al de la etiqueta cambiaron archivos que no son el ` +
          `asiento de la aprobación: ${ajenos.join(', ')}. Se publicaría algo que la Cátedra no vio.`,
      );
  }
  const ruta = rutaDeHuella(version);
  if (!d.huellaAprobada) {
    problemas.push(`Falta ${ruta}, la huella del Informe aprobado.`);
  } else if (
    d.huellaAprobada.version !== version ||
    !mismoCommit(d.huellaAprobada.commit, aprobacion.hash)
  ) {
    problemas.push(
      `${ruta} es la huella de v${d.huellaAprobada.version} (${d.huellaAprobada.commit}), no la ` +
        `de ${d.etiqueta} (${aprobacion.hash}).`,
    );
  }
  const desconocidas = aprobacion.deducciones.filter((id) => !d.idsDeducciones.includes(id));
  if (desconocidas.length)
    problemas.push(
      `La entrada de ${d.etiqueta} aprueba Deducciones propias que no están en el registro: ` +
        `${desconocidas.join(', ')}.`,
    );
  return problemas;
}
