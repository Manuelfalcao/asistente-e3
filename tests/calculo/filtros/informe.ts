import {
  type EntradaFiltro,
  type ResultadoFiltro,
  calcularFiltro,
  prototipo,
} from '../../../src/calculo/filtros/filtros';
import { formatearValor } from '../../../src/entrada/formato';
import {
  type AporteInforme,
  type GrupoPasos,
  enCaso,
  medidaImpresa,
  medidaNumerica,
} from '../../casos-informe';
import {
  CASOS_COHN,
  CASOS_COMPORTAMIENTO,
  CASOS_REFERENCIA_G,
  CASOS_VERIFICACION,
  type CasoComportamientoFiltro,
  TOLERANCIA_COHN,
  TOLERANCIA_DB,
  TOLERANCIA_ORACULO,
  TOLERANCIA_VALORES,
  bordesDe,
} from './casos';
import {
  atenuacionOraculo,
  atenuacionResonadores,
  atenuacionTeorica,
  perdidaSimulada,
  perdidaSimuladaBanda,
} from './elementos';

// El adaptador de las tablas de Casos de prueba de filtros para el Informe de casos (spec §13.6):
// corre el cálculo con las entradas de cada caso y deja el obtenido, el error y los pasos
// intermedios como texto. Las tablas son las mismas que corre Vitest.

const HZ = (f: number) => formatearValor(f, 'frecuencia');
const R = (ohms: number) => formatearValor(ohms, 'resistencia');

const TIPO = {
  'pasa-bajos': 'pasa bajos',
  'pasa-altos': 'pasa altos',
  'pasa-banda': 'pasa banda',
  'rechaza-banda': 'rechaza banda',
} as const;
const APROXIMACION = { butterworth: 'Butterworth', chebyshev: 'Chebyshev' } as const;
const ESCALA = { nH: 1e9, pF: 1e12 } as const;

function frecuenciasTexto(e: EntradaFiltro): string {
  if ('fc' in e) return `fc = ${HZ(e.fc)}`;
  return 'f1' in e.banda
    ? `f1 = ${HZ(e.banda.f1)} · f2 = ${HZ(e.banda.f2)}`
    : `f0 = ${HZ(e.banda.f0)} · BW = ${HZ(e.banda.bw)}`;
}

function entradasTexto(e: EntradaFiltro): string {
  return [
    TIPO[e.tipo],
    e.aproximacion === 'chebyshev'
      ? `Chebyshev ${formatearValor(e.ripple!, 'decibeles')}`
      : APROXIMACION[e.aproximacion],
    e.topologia,
    `Orden ${e.orden}`,
    frecuenciasTexto(e),
    `Rs = ${R(e.rs)}`,
    `RL = ${R(e.rl)}`,
    `Qu = ${formatearValor(e.qBobina, 'numero')}`,
  ].join(' · ');
}

function calculado(e: EntradaFiltro) {
  const r = calcularFiltro(e);
  if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
  return r;
}

const pasosDe = (e: EntradaFiltro, r: Extract<ResultadoFiltro, { estado: 'calculado' }>) =>
  [{ titulo: `Filtro ${TIPO[e.tipo]} ${e.topologia}`, pasos: r.pasos }] satisfies GrupoPasos[];

const referencia = () =>
  CASOS_REFERENCIA_G.map((caso) =>
    enCaso(caso, () => {
      const p = prototipo(caso.aproximacion, caso.orden, caso.ripple);
      const obtenidos = [...p.g, p.carga];
      return {
        clase: 'referencia',
        id: caso.id,
        entradas:
          `${APROXIMACION[caso.aproximacion]}` +
          (caso.ripple === null ? '' : ` ${formatearValor(caso.ripple, 'decibeles')}`) +
          `, n = ${caso.orden}`,
        referencia: caso.referencia,
        medidas: caso.impresos.map((impreso, i) =>
          medidaImpresa({
            nombre: `g${i + 1}`,
            impreso,
            obtenido: obtenidos[i],
            tolerancia: caso.tolerancia,
          }),
        ),
        pasos: [{ titulo: 'Prototipo', pasos: p.pasos }],
      };
    }),
  );

const verificacion = () =>
  CASOS_VERIFICACION.map((caso) =>
    enCaso(caso, () => {
      const r = calculado(caso.entradas);
      const { rs, aproximacion, ripple } = caso.entradas;
      const teorica = atenuacionTeorica(aproximacion, r.orden, 1, ripple);
      const atenuacion = (f: number) =>
        r.resonadores.length > 0
          ? atenuacionResonadores(r.resonadores, f, rs)
          : atenuacionOraculo(r.elementos, f, rs);
      return {
        clase: 'verificacion',
        id: caso.id,
        entradas: entradasTexto(caso.entradas),
        referencia: caso.referencia,
        oraculo: caso.oraculo,
        medidas: [
          ...caso.valores.map(({ nombre, impreso, unidad }) =>
            medidaImpresa({
              nombre,
              impreso,
              obtenido: r.elementos.find((e) => e.nombre === nombre)!.valor * ESCALA[unidad],
              tolerancia: TOLERANCIA_VALORES,
              unidad,
            }),
          ),
          ...caso.atenuaciones.map(({ f, impreso }) =>
            medidaImpresa({
              nombre: `Atenuación en ${HZ(f)}`,
              impreso,
              obtenido: atenuacion(f),
              tolerancia: TOLERANCIA_DB,
              unidad: 'dB',
            }),
          ),
          ...bordesDe(caso.entradas).map((borde) =>
            medidaNumerica({
              nombre: `Atenuación en ${HZ(borde)}, contra la de ${APROXIMACION[aproximacion]}`,
              esperado: teorica,
              obtenido: atenuacion(borde),
              tolerancia: TOLERANCIA_ORACULO,
              decimales: 9,
              unidad: 'dB',
            }),
          ),
        ],
        pasos: pasosDe(caso.entradas, r),
      };
    }),
  );

const cohn = () =>
  CASOS_COHN.map((caso) =>
    enCaso(caso, () => {
      const r = calculado(caso.entradas);
      const { rs, qBobina } = caso.entradas;
      const simulada =
        'fc' in caso.entradas
          ? perdidaSimulada(r.elementos, caso.entradas.tipo, caso.entradas.fc, rs, qBobina)
          : perdidaSimuladaBanda(r.resonadores, r.banda!.f0, rs, qBobina);
      return {
        clase: 'verificacion',
        id: caso.id,
        entradas: entradasTexto(caso.entradas),
        referencia: caso.referencia,
        oraculo: `${caso.oraculo}, con la pérdida de cada bobina de tests/calculo/filtros/elementos.ts`,
        medidas: [
          medidaNumerica({
            nombre: 'Pérdida de Cohn contra la simulada',
            esperado: simulada,
            obtenido: r.perdidaCohn!,
            tolerancia: TOLERANCIA_COHN,
            diferencia: caso.diferencia,
            decimales: 5,
            unidad: 'dB',
          }),
        ],
        pasos: pasosDe(caso.entradas, r),
      };
    }),
  );

const listaMarcados = (marcados: readonly (readonly [string, string])[]) =>
  [...marcados]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([nombre, nivel]) => `${nombre} ${nivel}`)
    .join(', ') || 'ninguno';

// Los marcados solo entran si el caso los fija.
function describir(r: ResultadoFiltro, conMarcados: boolean): string {
  if (r.estado === 'corte') return `corte: ${r.codigo}`;
  const marcados = listaMarcados(r.revision.marcados.map((m) => [m.nombre, m.nivel] as const));
  return (
    `Orden ${r.orden} · avisos: ${r.avisos.map((a) => a.codigo).join(', ') || 'ninguno'}` +
    (conMarcados ? ` · marcados: ${marcados}` : '')
  );
}

function textoEsperado({ esperado }: CasoComportamientoFiltro): string {
  if ('corte' in esperado) return `corte: ${esperado.corte}`;
  return (
    `Orden ${esperado.orden} · avisos: ${esperado.avisos.join(', ') || 'ninguno'}` +
    (esperado.marcados ? ` · marcados: ${listaMarcados(Object.entries(esperado.marcados))}` : '')
  );
}

const comportamiento = () =>
  CASOS_COMPORTAMIENTO.map((caso) =>
    enCaso(caso, () => {
      const esperado = textoEsperado(caso);
      const obtenido = describir(
        calcularFiltro(caso.entradas),
        'marcados' in caso.esperado && caso.esperado.marcados !== undefined,
      );
      return {
        clase: 'comportamiento',
        id: caso.id,
        entradas: entradasTexto(caso.entradas),
        referencia: caso.referencia,
        esperado,
        obtenido,
        coincide: esperado === obtenido,
      };
    }),
  );

export const INFORME: AporteInforme = {
  calculadora: 'filtros',
  casos: () => [...referencia(), ...verificacion(), ...cohn(), ...comportamiento()],
};
