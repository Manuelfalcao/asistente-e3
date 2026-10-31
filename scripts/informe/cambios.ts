import type { EntradaRegistro } from '../../src/calculo/comun/registro';
import { type SeccionInforme, esc, formula } from './html';

// La sección de Cambios del Informe de casos (spec §13.6): lo que cambió desde la última Versión
// aprobada. Cada informe deja una huella (dist-informe/huella.json) con lo que se compara; al aprobar
// una Versión, su huella se guarda en docs/aprobaciones/vX.Y.Z.json y el informe siguiente se mide
// contra ella.

export interface PasoHuella {
  // "T · Relación de tensiones": el título del grupo y el del paso.
  texto: string;
  latex: string;
}

export interface ValorHuella {
  nombre: string;
  esperado: string;
  obtenido: string;
  tolerancia: string;
}

export interface CasoHuella {
  // El id de la Calculadora, o 'comun'. Un caso es el par sección e id.
  seccion: string;
  id: string;
  clase: string;
  entradas: string;
  referencia: string;
  valores: ValorHuella[];
  formulas: PasoHuella[];
}

export interface RegistroHuella {
  id: string;
  tipo: EntradaRegistro['tipo'];
  nombre: string;
  // Lo que se lee del ítem, junto: si cambia, la Cátedra lo vuelve a mirar.
  texto: string;
  deduccion: PasoHuella[];
}

export interface Huella {
  version: string;
  commit: string;
  casos: CasoHuella[];
  registro: RegistroHuella[];
}

export function huellaDelInforme({
  encabezado,
  secciones,
  registro,
}: {
  encabezado: { version: string; commit: string };
  secciones: readonly SeccionInforme[];
  registro: readonly EntradaRegistro[];
}): Huella {
  const casos = secciones.flatMap((s) =>
    s.casos.map(({ caso }): CasoHuella => {
      const base = {
        seccion: s.calculadora,
        id: caso.id,
        clase: caso.clase,
        entradas: caso.entradas,
        referencia: caso.referencia,
      };
      if (caso.clase === 'comportamiento') {
        const aviso = { nombre: 'Aviso', esperado: caso.esperado, obtenido: caso.obtenido };
        return { ...base, valores: [{ ...aviso, tolerancia: '' }], formulas: [] };
      }
      return {
        ...base,
        valores: caso.medidas.map((m) => ({
          nombre: m.nombre,
          esperado: m.esperado,
          obtenido: m.obtenido,
          tolerancia: m.diferencia ? `${m.tolerancia}, ${m.diferencia.texto}` : m.tolerancia,
        })),
        formulas: caso.pasos.flatMap((g) =>
          g.pasos.map((p) => ({ texto: `${g.titulo} · ${p.texto}`, latex: p.latex })),
        ),
      };
    }),
  );
  return {
    version: encabezado.version,
    commit: encabezado.commit,
    casos,
    registro: registro.map((e) => ({
      id: e.id,
      tipo: e.tipo,
      nombre: e.nombre,
      texto: [e.queEs, e.adaptacion, e.respaldo, e.planB, e.bandera ?? ''].join('\n'),
      deduccion: (e.deduccion ?? []).map((p) => ({ texto: p.texto, latex: p.latex })),
    })),
  };
}

// --- Comparación ---------------------------------------------------------------------------------

export interface Diferencia {
  que: string;
  // Null: no estaba (o ya no está).
  anterior: string | null;
  nuevo: string | null;
}

export interface CasoModificado {
  seccion: string;
  id: string;
  diferencias: Diferencia[];
}

export interface FormulasCambiadas {
  seccion: string;
  id: string;
  pasos: { texto: string; anterior: string | null; nuevo: string | null }[];
}

export interface Cambios {
  // La última Versión aprobada; null si no hay ninguna y todo es nuevo.
  contra: { version: string; commit: string } | null;
  nuevos: CasoHuella[];
  eliminados: CasoHuella[];
  modificados: CasoModificado[];
  formulas: FormulasCambiadas[];
  referencias: { seccion: string; id: string; anterior: string; nuevo: string }[];
  registroNuevo: RegistroHuella[];
  registroCambiado: RegistroHuella[];
  registroEliminado: RegistroHuella[];
  sinCambiosDeCalculo: boolean;
}

const clave = (c: CasoHuella) => `${c.seccion}\u0000${c.id}`;

function diferenciasDeValores(antes: CasoHuella, ahora: CasoHuella): Diferencia[] {
  const diferencias: Diferencia[] =
    antes.entradas === ahora.entradas
      ? []
      : [{ que: 'Entradas', anterior: antes.entradas, nuevo: ahora.entradas }];
  const nombres = [...new Set([...antes.valores, ...ahora.valores].map((v) => v.nombre))];
  for (const nombre of nombres) {
    const a = antes.valores.find((v) => v.nombre === nombre);
    const b = ahora.valores.find((v) => v.nombre === nombre);
    for (const campo of ['esperado', 'obtenido', 'tolerancia'] as const) {
      const anterior = a ? a[campo] : null;
      const nuevo = b ? b[campo] : null;
      if (anterior !== nuevo) diferencias.push({ que: `${nombre}: ${campo}`, anterior, nuevo });
    }
  }
  return diferencias;
}

// Las fórmulas se comparan por posición dentro del caso: un paso que se suma corre los demás, y eso
// también es un cambio que la Cátedra tiene que ver.
function pasosCambiados(antes: readonly PasoHuella[], ahora: readonly PasoHuella[]) {
  const pasos: FormulasCambiadas['pasos'] = [];
  for (let i = 0; i < Math.max(antes.length, ahora.length); i++) {
    const a = antes[i];
    const b = ahora[i];
    if (a?.texto === b?.texto && a?.latex === b?.latex) continue;
    pasos.push({ texto: (b ?? a).texto, anterior: a?.latex ?? null, nuevo: b?.latex ?? null });
  }
  return pasos;
}

const mismoRegistro = (a: RegistroHuella, b: RegistroHuella) =>
  JSON.stringify(a) === JSON.stringify(b);

export function compararHuellas(anterior: Huella | null, actual: Huella): Cambios {
  const antes = new Map((anterior?.casos ?? []).map((c) => [clave(c), c]));
  const ahora = new Set(actual.casos.map(clave));
  const nuevos = actual.casos.filter((c) => !antes.has(clave(c)));
  const eliminados = (anterior?.casos ?? []).filter((c) => !ahora.has(clave(c)));
  const modificados: CasoModificado[] = [];
  const formulas: FormulasCambiadas[] = [];
  const referencias: Cambios['referencias'] = [];
  for (const caso of actual.casos) {
    const previo = antes.get(clave(caso));
    if (!previo) continue;
    const { seccion, id } = caso;
    const diferencias = diferenciasDeValores(previo, caso);
    if (diferencias.length) modificados.push({ seccion, id, diferencias });
    const pasos = pasosCambiados(previo.formulas, caso.formulas);
    if (pasos.length) formulas.push({ seccion, id, pasos });
    if (previo.referencia !== caso.referencia)
      referencias.push({ seccion, id, anterior: previo.referencia, nuevo: caso.referencia });
  }

  const registroAntes = new Map((anterior?.registro ?? []).map((e) => [e.id, e]));
  const registroAhora = new Set(actual.registro.map((e) => e.id));
  const registroNuevo = actual.registro.filter((e) => !registroAntes.has(e.id));
  const registroEliminado = (anterior?.registro ?? []).filter((e) => !registroAhora.has(e.id));
  const registroCambiado = actual.registro.filter((e) => {
    const previa = registroAntes.get(e.id);
    return previa !== undefined && !mismoRegistro(previa, e);
  });

  const listas = [
    nuevos,
    eliminados,
    modificados,
    formulas,
    referencias,
    registroNuevo,
    registroCambiado,
    registroEliminado,
  ];
  return {
    contra: anterior && { version: anterior.version, commit: anterior.commit },
    nuevos,
    eliminados,
    modificados,
    formulas,
    referencias,
    registroNuevo,
    registroCambiado,
    registroEliminado,
    sinCambiosDeCalculo: listas.every((l) => l.length === 0),
  };
}

// --- HTML ----------------------------------------------------------------------------------------

function subseccion(titulo: string, cantidad: number, cuerpo: string): string {
  if (!cantidad) return '';
  return `<h3>${titulo} <span class="cuenta">(${cantidad})</span></h3>${cuerpo}`;
}

const nombreDeCaso = (c: { seccion: string; id: string }) =>
  `<span class="seccion-caso">${esc(c.seccion)}</span> <span class="id">${esc(c.id)}</span>`;

function listaDeCasos(casos: readonly CasoHuella[]): string {
  const items = casos.map(
    (c) => `<li>${nombreDeCaso(c)} <span class="entradas">${esc(c.entradas)}</span></li>`,
  );
  return `<ul class="lista-cambios">${items.join('')}</ul>`;
}

const valor = (texto: string | null) =>
  texto === null ? '<span class="nota">no estaba</span>' : esc(texto);

function tablaDeModificados(modificados: readonly CasoModificado[]): string {
  const filas = modificados.flatMap((c) =>
    c.diferencias.map(
      (d, i) =>
        '<tr>' +
        (i === 0
          ? `<th scope="rowgroup" rowspan="${c.diferencias.length}">${nombreDeCaso(c)}</th>`
          : '') +
        `<td>${esc(d.que)}</td><td class="num">${valor(d.anterior)}</td>` +
        `<td class="num">${valor(d.nuevo)}</td></tr>`,
    ),
  );
  return (
    '<table class="compacta cambios-valores"><thead><tr><th>Caso</th><th>Qué</th><th>Antes</th>' +
    `<th>Ahora</th></tr></thead><tbody>${filas.join('')}</tbody></table>`
  );
}

const formulaOVacio = (latex: string | null) =>
  latex === null ? '<span class="nota">no estaba</span>' : formula(latex);

function listaDeFormulas(cambiadas: readonly FormulasCambiadas[]): string {
  return cambiadas
    .map(
      (c) =>
        `<details class="pasos"><summary>${nombreDeCaso(c)} (${c.pasos.length})</summary>` +
        '<table class="compacta cambios-formulas"><thead><tr><th>Paso</th><th>Antes</th>' +
        '<th>Ahora</th></tr></thead><tbody>' +
        c.pasos
          .map(
            (p) =>
              `<tr><td>${esc(p.texto)}</td><td>${formulaOVacio(p.anterior)}</td>` +
              `<td>${formulaOVacio(p.nuevo)}</td></tr>`,
          )
          .join('') +
        '</tbody></table></details>',
    )
    .join('');
}

function tablaDeReferencias(referencias: Cambios['referencias']): string {
  const filas = referencias.map(
    (r) =>
      `<tr><th scope="row">${nombreDeCaso(r)}</th><td>${esc(r.anterior)}</td><td>${esc(r.nuevo)}</td></tr>`,
  );
  return (
    '<table class="compacta"><thead><tr><th>Caso</th><th>Antes</th><th>Ahora</th></tr></thead>' +
    `<tbody>${filas.join('')}</tbody></table>`
  );
}

// Las que siguen en el registro llevan al ítem del informe; las eliminadas ya no tienen ítem.
function listaDeRegistro(entradas: readonly RegistroHuella[], enlazar: boolean): string {
  const items = entradas.map((e) =>
    enlazar ? `<li><a href="#${esc(e.id)}">${esc(e.nombre)}</a></li>` : `<li>${esc(e.nombre)}</li>`,
  );
  return `<ul class="lista-cambios">${items.join('')}</ul>`;
}

const deTipo = (entradas: readonly RegistroHuella[], tipo: RegistroHuella['tipo']) =>
  entradas.filter((e) => e.tipo === tipo);

export function renderizarCambios(c: Cambios): string {
  if (c.contra === null) {
    return (
      '<p class="contra">No hay ninguna Versión aprobada en <code>docs/aprobaciones.md</code>: ' +
      `es la primera, así que todo es nuevo: ${c.nuevos.length} casos, ` +
      `${deTipo(c.registroNuevo, 'deduccion-propia').length} Deducciones propias y ` +
      `${deTipo(c.registroNuevo, 'criterio-practico').length} Criterios prácticos.</p>`
    );
  }
  const contra =
    `<p class="contra">Contra la <strong>v${esc(c.contra.version)}</strong> (commit ` +
    `<code>${esc(c.contra.commit)}</code>), la última aprobada en <code>docs/aprobaciones.md</code>.</p>`;
  if (c.sinCambiosDeCalculo) {
    return (
      `${contra}<p class="sin-cambios"><strong>Sin cambios de cálculo.</strong> Los casos, sus ` +
      'entradas, esperados, obtenidos y tolerancias, las fórmulas de los pasos, las referencias y ' +
      'las Deducciones propias y los Criterios prácticos son los mismos que en la Versión aprobada. ' +
      'Esta Versión se puede aprobar mirando solo esta sección.</p>'
    );
  }
  return [
    contra,
    subseccion('Casos nuevos', c.nuevos.length, listaDeCasos(c.nuevos)),
    subseccion('Casos modificados', c.modificados.length, tablaDeModificados(c.modificados)),
    subseccion('Casos eliminados', c.eliminados.length, listaDeCasos(c.eliminados)),
    subseccion('Fórmulas que cambiaron', c.formulas.length, listaDeFormulas(c.formulas)),
    subseccion(
      'Referencias que cambiaron',
      c.referencias.length,
      tablaDeReferencias(c.referencias),
    ),
    ...(
      [
        ['Deducciones propias nuevas', deTipo(c.registroNuevo, 'deduccion-propia'), true],
        ['Criterios prácticos nuevos', deTipo(c.registroNuevo, 'criterio-practico'), true],
        ['Deducciones propias y Criterios prácticos que cambiaron', c.registroCambiado, true],
        ['Deducciones propias y Criterios prácticos eliminados', c.registroEliminado, false],
      ] as const
    ).map(([titulo, entradas, enlazar]) =>
      subseccion(titulo, entradas.length, listaDeRegistro(entradas, enlazar)),
    ),
  ].join('');
}
