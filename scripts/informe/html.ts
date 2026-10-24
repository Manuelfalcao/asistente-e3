import temml from 'temml';
import type { Paso } from '../../src/calculo/comun/resultado';
import type { EntradaRegistro } from '../../src/calculo/comun/registro';
import { formatearErrorRelativo } from '../../src/entrada/formato';
import type {
  CasoDeComportamiento,
  CasoDeRevision,
  CasoInforme,
  GrupoPasos,
  Medida,
} from '../../tests/casos-informe';
import { type EstadoCaso, resumenDeEstados } from './estado';

// El HTML del Informe de casos (spec §13.6): un solo archivo, con el CSS, la fuente de las fórmulas
// y el script de impresión adentro. Las fórmulas son las mismas cadenas LaTeX que la interfaz.

export interface CasoEvaluado {
  caso: CasoInforme;
  estado: EstadoCaso;
}

export interface SeccionInforme {
  // El id de la Calculadora, o 'comun'.
  calculadora: string;
  titulo: string;
  casos: readonly CasoEvaluado[];
}

export interface Oraculo {
  // "tests/oraculos/abcd.ts"
  archivo: string;
  descripcion: string;
  exportes: readonly string[];
}

export interface DatosInforme {
  encabezado: { version: string; commit: string; fecha: string };
  // Todos los tests de Vitest, no solo los que corren un caso: uno en rojo cualquiera bloquea.
  vitest: { total: number; fallan: number };
  // En el orden en que se muestran: las Calculadoras y al final Común.
  secciones: readonly SeccionInforme[];
  registro: readonly EntradaRegistro[];
  oraculos: readonly Oraculo[];
  // El HTML de la sección de Cambios, que arma la publicación de la Versión (ticket 49). Null: el
  // lugar queda vacío.
  cambios: string | null;
  fuente: {
    css: string;
    // Una data URI (o una URL) del woff2 de Latin Modern Math, o vacío.
    fuenteFormula: string;
  };
}

// --- Texto ---------------------------------------------------------------------------------------

function esc(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Las opciones de la interfaz (src/ui/comun/Formula.tsx): en línea y cortando después de cada =.
function formula(latex: string): string {
  const mathml = temml.renderToString(latex, { displayMode: false, wrap: 'tex' });
  return `<div class="formula">${mathml}</div>`;
}

function pasos(lista: readonly Paso[]): string {
  const items = lista.map(
    (p) =>
      `<li><span class="paso-texto">${esc(p.texto)}</span>${formula(p.latex)}` +
      (p.fuente ? `<span class="paso-fuente">${esc(p.fuente)}</span>` : '') +
      '</li>',
  );
  return `<ol class="lista-pasos">${items.join('')}</ol>`;
}

function gruposDePasos(grupos: readonly GrupoPasos[]): string {
  return grupos
    .map((g) => `<div class="grupo-pasos"><h5>${esc(g.titulo)}</h5>${pasos(g.pasos)}</div>`)
    .join('');
}

const NOMBRE_ESTADO: Record<EstadoCaso, string> = {
  ok: 'Aprobado',
  falla: 'En rojo',
  'sin-test': 'Sin test',
};

function estado(e: EstadoCaso): string {
  return `<span class="estado estado-${e}">${NOMBRE_ESTADO[e]}</span>`;
}

// --- Casos ---------------------------------------------------------------------------------------

function idDelOraculo(archivo: string): string {
  return `oraculo-${archivo.replace(/^.*\//, '').replace(/\.ts$/, '')}`;
}

function oraculo(nombre: string, oraculos: readonly Oraculo[]): string {
  const conocido = oraculos.find((o) => nombre.includes(o.archivo));
  return conocido ? `<a href="#${idDelOraculo(conocido.archivo)}">${esc(nombre)}</a>` : esc(nombre);
}

function celdasDeMedida(m: Medida): string {
  const dif = m.diferencia
    ? `<span class="dif"><strong>Diferencia esperada</strong> ${esc(m.diferencia.texto)}: ` +
      `${esc(m.diferencia.motivo)}</span>`
    : '';
  const error = m.errorRelativo === null ? '—' : formatearErrorRelativo(m.errorRelativo * 100);
  return (
    `<td>${esc(m.nombre)}</td>` +
    `<td class="num">${esc(m.esperado)}</td>` +
    `<td class="num">${esc(m.obtenido)}</td>` +
    `<td class="num${m.dentro ? '' : ' fuera'}">${esc(error)}</td>` +
    `<td><span class="tol">${esc(m.tolerancia)}</span> <span class="motivo">${esc(m.motivo)}</span>${dif}</td>`
  );
}

function casoDeRevision(
  { caso, estado: e }: { caso: CasoDeRevision; estado: EstadoCaso },
  oraculos: readonly Oraculo[],
): string {
  const n = Math.max(caso.medidas.length, 1);
  const filas = caso.medidas.map((m, i) => {
    const propias =
      i === 0
        ? `<th scope="rowgroup" rowspan="${n}" class="caso-id"><span class="id">${esc(caso.id)}</span>` +
          `<span class="entradas">${esc(caso.entradas)}</span>` +
          (caso.oraculo
            ? `<span class="oraculo">Oráculo: ${oraculo(caso.oraculo, oraculos)}</span>`
            : '') +
          '</th>'
        : '';
    const finales =
      i === 0
        ? `<td rowspan="${n}">${estado(e)}</td><td rowspan="${n}" class="referencia">${esc(caso.referencia)}</td>`
        : '';
    return `<tr>${propias}${celdasDeMedida(m)}${finales}</tr>`;
  });
  const despliegue = caso.pasos.length
    ? `<tr class="fila-pasos"><td colspan="8"><details class="pasos"><summary>Pasos intermedios</summary>` +
      `${gruposDePasos(caso.pasos)}</details></td></tr>`
    : '';
  return `<tbody class="caso" data-caso="${esc(caso.id)}">${filas.join('')}${despliegue}</tbody>`;
}

function tablaDeRevision(
  casos: readonly { caso: CasoDeRevision; estado: EstadoCaso }[],
  oraculos: readonly Oraculo[],
): string {
  return (
    '<table class="casos"><thead><tr><th>Caso</th><th>Magnitud</th><th>Esperado</th>' +
    '<th>Obtenido</th><th>Error relativo</th><th>Tolerancia y motivo</th><th>Estado</th>' +
    `<th>Referencia</th></tr></thead>${casos.map((c) => casoDeRevision(c, oraculos)).join('')}</table>`
  );
}

function listaDeComportamiento(
  casos: readonly { caso: CasoDeComportamiento; estado: EstadoCaso }[],
): string {
  const filas = casos.map(
    ({ caso, estado: e }) =>
      `<tr data-caso="${esc(caso.id)}"><th scope="row">${esc(caso.id)}</th>` +
      `<td>${esc(caso.entradas)}</td><td>${esc(caso.esperado)}</td>` +
      `<td class="${caso.coincide ? '' : 'fuera'}">${esc(caso.obtenido)}</td>` +
      `<td>${estado(e)}</td></tr>`,
  );
  return (
    '<table class="compacta"><thead><tr><th>Caso</th><th>Entrada</th><th>Aviso esperado</th>' +
    `<th>Obtenido</th><th>Estado</th></tr></thead><tbody>${filas.join('')}</tbody></table>`
  );
}

const CLASES: { clase: CasoInforme['clase']; titulo: string }[] = [
  { clase: 'referencia', titulo: 'Casos de referencia' },
  { clase: 'medicion', titulo: 'Casos de medición' },
  { clase: 'verificacion', titulo: 'Casos de verificación' },
  { clase: 'comportamiento', titulo: 'Casos de comportamiento' },
];

// Los casos agrupados por clase, cada grupo con su forma: fila para los tres primeros y lista
// compacta para los de comportamiento.
function casosPorClase(
  casos: readonly CasoEvaluado[],
  oraculos: readonly Oraculo[],
  nivel: 'h3' | 'h4',
): string {
  return CLASES.map(({ clase, titulo }) => {
    const delGrupo = casos.filter((c) => c.caso.clase === clase);
    if (!delGrupo.length) return '';
    const cuerpo =
      clase === 'comportamiento'
        ? listaDeComportamiento(delGrupo as { caso: CasoDeComportamiento; estado: EstadoCaso }[])
        : tablaDeRevision(delGrupo as { caso: CasoDeRevision; estado: EstadoCaso }[], oraculos);
    return `<${nivel}>${titulo} <span class="cuenta">(${delGrupo.length})</span></${nivel}>${cuerpo}`;
  }).join('');
}

// --- Secciones -----------------------------------------------------------------------------------

function idDeSeccion(calculadora: string): string {
  return calculadora === 'comun' ? 'comun' : `calculadora-${calculadora}`;
}

function seccionDeCasos(s: SeccionInforme, oraculos: readonly Oraculo[]): string {
  // Los casos que corren el plan B de una Deducción propia se ven en el ítem de esa Deducción.
  const propios = s.casos.filter((c) => c.caso.bandera?.lado !== 'plan-b');
  return (
    `<section id="${idDeSeccion(s.calculadora)}" class="calculadora"><h2>${esc(s.titulo)}</h2>` +
    `${casosPorClase(propios, oraculos, 'h3')}</section>`
  );
}

function seccionDeCambios(cambios: string | null): string {
  const titulo = '<h2>Cambios desde la última Versión aprobada</h2>';
  return cambios === null
    ? `<section id="cambios" data-vacia>${titulo}<p class="nota">Esta sección la llena la ` +
        'publicación de la Versión. En este informe no hay una Versión aprobada con la que comparar.</p></section>'
    : `<section id="cambios">${titulo}${cambios}</section>`;
}

function aprobacion(id: string, texto: string): string {
  return (
    `<label class="aprobacion"><input type="checkbox" id="aprobar-${esc(id)}"> ` +
    `<span>${texto}</span></label>`
  );
}

function definicion(termino: string, texto: string): string {
  return `<dt>${termino}</dt><dd>${esc(texto)}</dd>`;
}

function itemDeRegistro(
  e: EntradaRegistro,
  casos: readonly CasoEvaluado[],
  oraculos: readonly Oraculo[],
): string {
  const esDeduccion = e.tipo === 'deduccion-propia';
  const campos = [
    definicion('Qué es', e.queEs),
    definicion('Qué se adaptó y por qué', e.adaptacion),
    definicion('Respaldo', e.respaldo),
    definicion(
      esDeduccion ? 'Plan B si no se aprueba' : 'Si no se aprueba',
      e.bandera ? `${e.planB} (bandera ${e.bandera})` : e.planB,
    ),
  ].join('');
  const deduccion = e.deduccion?.length
    ? `<div class="deduccion"><h4>Deducción</h4>${pasos(e.deduccion)}</div>`
    : '';
  const suyos = casos.filter((c) => c.caso.bandera?.deduccion === e.id);
  const lado = (l: 'propia' | 'plan-b', titulo: string) => {
    const delLado = suyos.filter((c) => c.caso.bandera?.lado === l);
    return delLado.length ? `<h5>${titulo}</h5>${casosPorClase(delLado, oraculos, 'h4')}` : '';
  };
  const comparacion = suyos.length
    ? '<div class="comparacion"><h4>Comparación: los casos con la bandera de los dos lados</h4>' +
      `${lado('propia', 'Con la Deducción propia')}${lado('plan-b', 'Con el plan B')}</div>`
    : '';
  const aprueba = esDeduccion
    ? aprobacion(
        e.id,
        '<strong>Apruebo la fórmula.</strong> Si no la apruebo, el Asistente usa el plan B.',
      )
    : aprobacion(
        e.id,
        '<strong>Apruebo el criterio.</strong> Si no lo apruebo, se ajustan sus números.',
      );
  return (
    `<article class="item" id="${esc(e.id)}"><h3>${esc(e.nombre)}</h3><dl>${campos}</dl>` +
    `${deduccion}${comparacion}${aprueba}</article>`
  );
}

function seccionDeRegistro(
  id: 'deducciones' | 'criterios',
  titulo: string,
  nota: string,
  entradas: readonly EntradaRegistro[],
  casos: readonly CasoEvaluado[],
  oraculos: readonly Oraculo[],
): string {
  if (!entradas.length) return '';
  return (
    `<section id="${id}"><h2>${titulo}</h2><p class="nota">${nota}</p>` +
    `${entradas.map((e) => itemDeRegistro(e, casos, oraculos)).join('')}</section>`
  );
}

function apendiceDeOraculos(oraculos: readonly Oraculo[], casos: readonly CasoEvaluado[]): string {
  if (!oraculos.length) return '';
  const items = oraculos.map((o) => {
    const usos = casos.filter(
      (c) => 'oraculo' in c.caso && c.caso.oraculo?.includes(o.archivo),
    ).length;
    const funciones = o.exportes.length
      ? `<p class="funciones">Funciones: ${o.exportes.map((x) => `<code>${esc(x)}</code>`).join(', ')}.</p>`
      : '';
    return (
      `<article class="item" id="${idDelOraculo(o.archivo)}"><h3><code>${esc(o.archivo)}</code></h3>` +
      `<p class="descripcion">${esc(o.descripcion)}</p>${funciones}` +
      `<p class="usos">Casos de verificación que lo nombran: ${usos}.</p></article>`
    );
  });
  return (
    '<section id="oraculos"><h2>Apéndice: oráculos</h2><p class="nota">Cada oráculo se escribe ' +
    'aparte, sin importar nada de <code>src/calculo/</code>, para no repetir el código que verifica.</p>' +
    `${items.join('')}</section>`
  );
}

// --- Documento -----------------------------------------------------------------------------------

// Antes de imprimir se abren todos los desplegables, y después se vuelven a cerrar los que se
// abrieron: así "Guardar como PDF" lleva los pasos intermedios.
const SCRIPT_DE_IMPRESION = `
const abiertos = [];
addEventListener('beforeprint', () => {
  document.querySelectorAll('details').forEach((d) => {
    if (!d.open) { d.open = true; abiertos.push(d); }
  });
});
addEventListener('afterprint', () => {
  abiertos.splice(0).forEach((d) => { d.open = false; });
});
`;

function indice(datos: DatosInforme): string {
  const enlaces = [
    ['cambios', 'Cambios'],
    ...datos.secciones.map((s) => [idDeSeccion(s.calculadora), s.titulo]),
    ...(datos.registro.some((e) => e.tipo === 'deduccion-propia')
      ? [['deducciones', 'Deducciones propias']]
      : []),
    ...(datos.registro.some((e) => e.tipo === 'criterio-practico')
      ? [['criterios', 'Criterios prácticos']]
      : []),
    ...(datos.oraculos.length ? [['oraculos', 'Apéndice: oráculos']] : []),
  ];
  return (
    '<nav class="indice"><ol>' +
    enlaces.map(([id, texto]) => `<li><a href="#${id}">${esc(texto)}</a></li>`).join('') +
    '</ol></nav>'
  );
}

export function renderizarInforme(datos: DatosInforme): string {
  const { version, commit, fecha } = datos.encabezado;
  const todos = datos.secciones.flatMap((s) => s.casos);
  const r = resumenDeEstados(todos.map((c) => c.estado));
  const tipo = (t: EntradaRegistro['tipo']) => datos.registro.filter((e) => e.tipo === t);
  const fuente = datos.fuente.fuenteFormula
    ? `@font-face{font-family:'Latin Modern Math';src:url(${datos.fuente.fuenteFormula}) format('woff2');}`
    : '';
  const veredicto = r.falla + r.sinTest + datos.vitest.fallan === 0 ? 'resumen-ok' : 'resumen-rojo';
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Informe de casos · v${esc(version)} · ${esc(commit)}</title>
<style>${fuente}${datos.fuente.css}</style>
</head>
<body>
<header class="portada">
<h1>Informe de casos</h1>
<p class="version">Asistente E3 · <strong>v${esc(version)}</strong> · commit <code>${esc(commit)}</code> · ${esc(fecha)}</p>
<p class="resumen ${veredicto}">${r.total} casos: ${r.ok} aprobados · ${r.falla} en rojo · ${r.sinTest} sin test</p>
<p class="nota">Tests de Vitest: ${datos.vitest.total}, ${datos.vitest.fallan} en rojo.</p>
</header>
${indice(datos)}
<main>
${seccionDeCambios(datos.cambios)}
${datos.secciones.map((s) => seccionDeCasos(s, datos.oraculos)).join('\n')}
${seccionDeRegistro('deducciones', 'Deducciones propias', 'Cada una se aprueba como fórmula, aparte. Si la Cátedra no la aprueba, el Asistente usa su plan B.', tipo('deduccion-propia'), todos, datos.oraculos)}
${seccionDeRegistro('criterios', 'Criterios prácticos', 'Reglas de diseño que salen de la experiencia de montaje y no de la bibliografía. Se aprueban como criterio, no como fórmula.', tipo('criterio-practico'), todos, datos.oraculos)}
${apendiceDeOraculos(datos.oraculos, todos)}
</main>
<script>${SCRIPT_DE_IMPRESION}</script>
</body>
</html>
`;
}
