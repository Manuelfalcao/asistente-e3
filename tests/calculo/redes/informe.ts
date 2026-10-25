import type { Filtrado } from '../../../src/calculo/comun/red-l';
import {
  type EntradaRedL,
  type ResultadoRedL,
  type VarianteL,
  calcularRedL,
} from '../../../src/calculo/redes/redes';
import { formatearValor } from '../../../src/entrada/formato';
import {
  type AporteInforme,
  type CasoInforme,
  type GrupoPasos,
  type Medida,
  enCaso,
  medidaImpresa,
  medidaNumerica,
} from '../../casos-informe';
import {
  CASOS_ANCHO_DE_BANDA,
  CASOS_COMPORTAMIENTO,
  CASOS_REFERENCIA,
  type CasoComportamiento,
  GRILLA_FRECUENCIAS,
  GRILLA_RESISTENCIAS,
  TOLERANCIA_ORACULO,
  VECES_F0,
} from './casos';
import { cruceDeGamma } from './elementos';
import { type Peor, recorrerBarrido, recorrerGrilla } from './grilla';

// El adaptador de las tablas de Casos de prueba de redes de adaptación para el Informe de casos
// (spec §13.6): corre el cálculo con las entradas de cada caso y deja el obtenido, el error y los
// pasos intermedios como texto. Las tablas son las mismas que corre Vitest.

const ORACULO = 'tests/oraculos/abcd.ts (ABCD con complejos)';
const R = (ohms: number) => formatearValor(ohms, 'resistencia');
const HZ = (f: number) => formatearValor(f, 'frecuencia');

const TITULO: Record<Filtrado, string> = { 'pasa-bajos': 'pasa bajos', 'pasa-altos': 'pasa altos' };

function entradasTexto(e: EntradaRedL): string {
  return [
    `f₀ = ${HZ(e.f0)}`,
    `Rs = ${R(e.rs)}`,
    `RL = ${R(e.rl)}`,
    `Q de la bobina = ${formatearValor(e.qBobina, 'numero')}`,
  ].join(' · ');
}

function calculado(e: EntradaRedL) {
  const r = calcularRedL(e);
  if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
  return r;
}

const pasosDe = (r: Extract<ResultadoRedL, { estado: 'calculado' }>): GrupoPasos[] => [
  { titulo: 'Q de la red L', pasos: r.pasos },
  ...r.variantes.map((v) => ({ titulo: `Red L ${TITULO[v.filtrado]}`, pasos: v.pasos })),
];

// --- Referencia ----------------------------------------------------------------------------------

const referencia = () =>
  CASOS_REFERENCIA.map((caso) =>
    enCaso(caso, () => {
      const r = calculado(caso.entradas);
      const v = r.variantes.find((x) => x.filtrado === caso.variante)!;
      const valor = (componente: 'L' | 'C') =>
        v.componentes.find((x) => x.componente === componente)!.valor;
      return {
        clase: 'referencia',
        id: caso.id,
        entradas: `${entradasTexto(caso.entradas)} · ${TITULO[caso.variante]}`,
        referencia: caso.referencia,
        medidas: [
          medidaImpresa({
            nombre: 'L1 (en serie)',
            impreso: caso.esperado.l,
            obtenido: valor('L') * 1e9,
            tolerancia: caso.tolerancia,
            unidad: 'nH',
          }),
          medidaImpresa({
            nombre: 'C1 (en derivación)',
            impreso: caso.esperado.c,
            obtenido: valor('C') * 1e12,
            tolerancia: caso.tolerancia,
            unidad: 'pF',
          }),
        ],
        pasos: pasosDe(r),
      };
    }),
  );

// --- Verificación --------------------------------------------------------------------------------

// Un borde del barrido contra el cruce de |Γ| = 1/√2. Si los dos faltan, coinciden.
function medidaBorde(nombre: string, barrido: number | null, gamma: number | null): Medida {
  if (barrido === null || gamma === null) {
    const texto = (f: number | null) => (f === null ? 'sin borde' : HZ(f));
    return {
      nombre,
      esperado: texto(gamma),
      obtenido: texto(barrido),
      errorRelativo: null,
      tolerancia: 'los dos sin borde',
      motivo: 'Si una vía no encuentra el cruce en f₀/50 a 50·f₀, la otra tampoco.',
      dentro: barrido === gamma,
    };
  }
  return medidaNumerica({
    nombre,
    esperado: gamma / 1e6,
    obtenido: barrido / 1e6,
    tolerancia: TOLERANCIA_ORACULO,
    decimales: 9,
    unidad: 'MHz',
  });
}

function medidasDeAnchoDeBanda(
  v: VarianteL,
  { f0, rs, rl }: EntradaRedL,
  impreso: string | undefined,
): Medida[] {
  const titulo = TITULO[v.filtrado];
  return [
    medidaBorde(`f inf (${titulo})`, v.barrido.fInf, cruceDeGamma(v, f0, rs, rl, 1 / 50)),
    medidaBorde(`f sup (${titulo})`, v.barrido.fSup, cruceDeGamma(v, f0, rs, rl, 50)),
    ...(impreso === undefined || v.barrido.f0SobreBw === null
      ? []
      : [
          medidaImpresa({
            nombre: `f₀/BW (${titulo}), de la investigación`,
            impreso,
            obtenido: v.barrido.f0SobreBw,
            tolerancia: {
              tipo: 'media-unidad',
              motivo: 'Barrido propio de la investigación: media unidad de la cifra impresa.',
            },
          }),
        ]),
  ];
}

const anchoDeBanda = () =>
  CASOS_ANCHO_DE_BANDA.map((caso) =>
    enCaso(caso, () => {
      const r = calculado(caso.entradas);
      return {
        clase: 'verificacion',
        id: caso.id,
        entradas: entradasTexto(caso.entradas),
        referencia: caso.referencia,
        oraculo: `${caso.oraculo}, con el cruce de |Γ| = 1/√2 de tests/calculo/redes/elementos.ts`,
        medidas: r.variantes.flatMap((v) =>
          medidasDeAnchoDeBanda(v, caso.entradas, caso.investigacion?.[v.filtrado]),
        ),
        pasos: pasosDe(r),
      };
    }),
  );

// El peor error de una grilla, contra cero: el valor ya es el error.
function medidaPeor(nombre: string, peor: Peor): Medida {
  return {
    ...medidaNumerica({
      nombre,
      esperado: 0,
      obtenido: peor.valor,
      tolerancia: { tipo: 'absoluta', valor: TOLERANCIA_ORACULO.valor, motivo: '' },
      decimales: null,
    }),
    motivo: `${TOLERANCIA_ORACULO.motivo} El peor: ${peor.donde}.`,
  };
}

const lista = (xs: readonly number[], formato: (x: number) => string) => xs.map(formato).join(', ');

const grilla = (): CasoInforme =>
  enCaso({ id: 'Grilla de R_s y R_L', referencia: 'spec §13.3' }, () => {
    const g = recorrerGrilla();
    return {
      clase: 'verificacion',
      id: 'Grilla de R_s y R_L',
      entradas:
        `Rs y RL distintas en {${lista(GRILLA_RESISTENCIAS, R)}}; ` +
        `f₀ en {${lista(GRILLA_FRECUENCIAS, HZ)}}; pasa bajos y pasa altos`,
      referencia: 'spec §13.3 (Redes de adaptación, verificación)',
      oraculo: ORACULO,
      medidas: [medidaPeor(`Peor |Zin − Rs|/Rs en f₀, en ${g.redes} redes`, g.zEntrada)],
      pasos: [],
    };
  });

const barridoContraOraculo = (): CasoInforme =>
  enCaso({ id: 'Barrido común contra el oráculo ABCD', referencia: 'spec §5.7' }, () => {
    const b = recorrerBarrido();
    const veces = VECES_F0.map((x) => (x === 1 ? 'f₀' : `${Number(x.toFixed(3))}·f₀`)).join(', ');
    return {
      clase: 'verificacion',
      id: 'Barrido común contra el oráculo ABCD',
      entradas:
        `Las dos variantes de la red L de 100 → 1000, 300 → 50 y 12 → 75 Ω, ideales y con Q = 50, ` +
        `y un T y un π resistivos; en ${veces}`,
      referencia: 'spec §5.7 y §13.4',
      oraculo: ORACULO,
      medidas: [
        medidaPeor(`Peor |S21|² relativo, en ${b.puntos} puntos`, b.s21),
        medidaPeor(`Peor |Zin| relativo, en ${b.puntos} puntos`, b.zEntrada),
      ],
      pasos: [],
    };
  });

// --- Comportamiento ------------------------------------------------------------------------------

function describir(caso: CasoComportamiento, r: ResultadoRedL): string {
  const { esperado } = caso;
  if (r.estado === 'corte') return `corte: ${r.codigo}`;
  if ('corte' in esperado) return 'calculó';
  return r.variantes
    .map((v) => {
      if ('sinBorde' in esperado) {
        const faltan = [
          ...(v.barrido.fInf === null ? ['inferior'] : []),
          ...(v.barrido.fSup === null ? ['superior'] : []),
        ];
        return `${TITULO[v.filtrado]}: ${faltan.length ? `sin borde ${faltan.join(' ni ')}` : 'los dos bordes'}`;
      }
      const marcados = [...v.revision.marcados]
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
        .map((m) => `${m.nombre} ${m.nivel}`);
      return `${TITULO[v.filtrado]}: ${marcados.length ? marcados.join(', ') : 'nada marcado'}`;
    })
    .join(' · ');
}

function textoEsperado(caso: CasoComportamiento): string {
  const { esperado } = caso;
  if ('corte' in esperado) return `corte: ${esperado.corte}`;
  const filtrados = ['pasa-bajos', 'pasa-altos'] as const;
  if ('sinBorde' in esperado) {
    return filtrados
      .map((f) => {
        const faltan = esperado.sinBorde[f];
        return `${TITULO[f]}: ${faltan.length ? `sin borde ${faltan.join(' ni ')}` : 'los dos bordes'}`;
      })
      .join(' · ');
  }
  return filtrados
    .map((f) => {
      const marcados = Object.entries(esperado.marcados[f])
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([nombre, nivel]) => `${nombre} ${nivel}`);
      return `${TITULO[f]}: ${marcados.length ? marcados.join(', ') : 'nada marcado'}`;
    })
    .join(' · ');
}

const comportamiento = () =>
  CASOS_COMPORTAMIENTO.map((caso) =>
    enCaso(caso, () => {
      const esperado = textoEsperado(caso);
      const obtenido = describir(caso, calcularRedL(caso.entradas));
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
  calculadora: 'redes',
  casos: () => [
    ...referencia(),
    ...anchoDeBanda(),
    grilla(),
    barridoContraOraculo(),
    ...comportamiento(),
  ],
};
