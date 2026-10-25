import {
  type EntradaBobina,
  type ResultadoBobinas,
  calcularBobinas,
  unaCapaConPasos,
} from '../../../src/calculo/bobinas/bobinas';
import {
  C_SOBRE_A_MAXIMO,
  dosCapasConPasos,
  rosaGrover91ConPasos,
} from '../../../src/calculo/bobinas/dos-capas';
import {
  type Medidas,
  bsAjuste,
  geometria,
  geometriaDosCapas,
  hazeltine,
  kLundin,
  wheeler1928,
} from '../../../src/calculo/bobinas/formulas';
import { formatearValor } from '../../../src/entrada/formato';
import {
  type AporteInforme,
  type CasoInforme,
  type GrupoPasos,
  enCaso,
  medidaImpresa,
  medidaNumerica,
} from '../../casos-informe';
import { laminaExacta, sumaDeAnillos } from '../../oraculos/anillos';
import {
  type CasoComportamiento,
  type CasoConD0,
  CASOS_ANILLOS,
  CASOS_COMPORTAMIENTO,
  CASOS_KL,
  CASOS_KNIGHT,
  CASOS_MEDICION,
  CASOS_WHEELER,
  CASO_C74,
  LADOS,
  obtenidoDe,
} from './casos';
import {
  type CasoComportamientoDosCapas,
  CASOS_ANILLOS_DOS_CAPAS,
  CASOS_BS,
  CASOS_COMPORTAMIENTO_DOS_CAPAS,
  CASOS_HAZELTINE,
  CASO_C74_VARIAS_CAPAS,
  type BobinaDosCapas,
  LADOS_DOS_CAPAS,
  obtenidoDeRosa,
  sumaDosCapas,
} from './casos-dos-capas';

// El adaptador de las tablas de Casos de prueba de bobinas para el Informe de casos (spec §13.6):
// corre el cálculo con las entradas de cada caso y deja el obtenido, el error y los pasos
// intermedios como texto. Las tablas son las mismas que corre Vitest.

const largo = (x: number) => formatearValor(x, 'largo', 'paso');
const cuatroCifras = (n: number) => formatearValor(n, 'numero', 'paso');

function geometriaTexto(m: Medidas): string {
  return `carrete ${largo(m.carrete)} · cable ${largo(m.cable)} · Separación ${largo(m.separacion)}`;
}

function entradasTexto(e: EntradaBobina): string {
  const partes = [`L = ${formatearValor(e.inductancia, 'inductancia', 'paso')}`, geometriaTexto(e)];
  if (e.frecuencia) partes.push(`f = ${formatearValor(e.frecuencia, 'frecuencia')}`);
  return partes.join(' · ');
}

const conVueltas = (m: Medidas, n: number) => `${geometriaTexto(m)} · N = ${cuatroCifras(n)}`;

function pasosDelCalculo(e: EntradaBobina, planB: boolean): GrupoPasos[] {
  const r = calcularBobinas(e, { planB });
  if (r.estado !== 'calculado') return [];
  return [{ titulo: `Una capa, ${entradasTexto(e)}`, pasos: r.unaCapa.pasos }];
}

// --- Referencia ------------------------------------------------------------------------------------

const referenciaKL = (): CasoInforme[] =>
  CASOS_KL.map((caso) =>
    enCaso(caso, () => ({
      clase: 'referencia',
      id: caso.id,
      entradas: `x = D/ℓ = ${cuatroCifras(caso.x)}`,
      referencia: caso.referencia,
      medidas: [
        medidaImpresa({
          nombre: 'kL de Lundin',
          impreso: caso.esperado,
          obtenido: kLundin(caso.x),
          tolerancia: caso.tolerancia,
        }),
      ],
      pasos: [],
    })),
  );

const referenciaConD0 = (casos: readonly CasoConD0[]): CasoInforme[] =>
  casos.map((caso) =>
    enCaso(caso, () => {
      const { vueltas } = caso.bobina;
      const { lamina, pasos } = unaCapaConPasos(caso.bobina, vueltas, 'd0');
      return {
        clase: 'referencia',
        id: caso.id,
        entradas: conVueltas(caso.bobina, vueltas),
        referencia: caso.referencia,
        medidas: caso.medidas.map((m) =>
          medidaImpresa({
            nombre: m.nombre,
            impreso: m.impreso,
            obtenido: obtenidoDe(lamina, m.que),
            tolerancia: m.tolerancia,
            diferencia: m.diferencia,
            unidad: ['inductancia', 'ls', 'correccion'].includes(m.que) ? 'µH' : undefined,
          }),
        ),
        pasos: [{ titulo: `Con D0 y ${cuatroCifras(vueltas)} vueltas`, pasos }],
      };
    }),
  );

// Rosa y Grover (91) con el ejemplo de varias capas de la Circular 74.
const referenciaVariasCapas = (): CasoInforme[] => {
  const caso = CASO_C74_VARIAS_CAPAS;
  return [
    enCaso(caso, () => {
      const { rosa, pasos } = rosaGrover91ConPasos(
        caso.radioMedio,
        caso.largo,
        caso.profundidad,
        caso.vueltas,
      );
      return {
        clase: 'referencia',
        id: caso.id,
        entradas:
          `a = ${largo(caso.radioMedio)} · b = ${largo(caso.largo)} · ` +
          `c = ${largo(caso.profundidad)} · N = ${caso.vueltas}`,
        referencia: caso.referencia,
        medidas: caso.medidas.map((m) =>
          medidaImpresa({
            nombre: m.nombre,
            impreso: m.impreso,
            obtenido: obtenidoDeRosa(rosa, m.que),
            tolerancia: m.tolerancia,
            unidad: 'µH',
          }),
        ),
        pasos: [{ titulo: 'Rosa y Grover (91)', pasos }],
      };
    }),
  ];
};

const referenciaBs = (): CasoInforme[] =>
  CASOS_BS.map((caso) =>
    enCaso(caso, () => ({
      clase: 'referencia',
      id: caso.id,
      entradas: `n′ = b/c = ${cuatroCifras(caso.nPrima)}`,
      referencia: caso.referencia,
      medidas: [
        medidaImpresa({
          nombre: 'Bs con el ajuste',
          impreso: caso.esperado,
          obtenido: bsAjuste(caso.nPrima),
          tolerancia: caso.tolerancia,
        }),
      ],
      pasos: [],
    })),
  );

// --- Medición --------------------------------------------------------------------------------------

const medicion = (): CasoInforme[] =>
  CASOS_MEDICION.flatMap((caso) =>
    LADOS.map((lado) => {
      const id = `${caso.id}${lado.sufijo}`;
      return enCaso({ id, referencia: caso.referencia }, () => {
        const { vueltas } = caso.bobina;
        const { lamina, pasos } = unaCapaConPasos(caso.bobina, vueltas, lado.diametro);
        return {
          clase: 'medicion',
          id,
          entradas: conVueltas(caso.bobina, vueltas),
          referencia: caso.referencia,
          bandera: lado.bandera,
          medidas: [
            medidaImpresa({
              nombre: lado.planB ? 'L con D0 (plan B)' : 'L de RF, con D∞',
              impreso: caso.medida,
              obtenido: lamina.inductancia / 1e-6,
              tolerancia: lado.planB ? caso.toleranciaPlanB : caso.tolerancia,
              unidad: 'µH',
            }),
          ],
          pasos: [{ titulo: `${lado.planB ? 'Con D0' : 'Con D∞'} y ${vueltas} vueltas`, pasos }],
        };
      });
    }),
  );

// --- Verificación ----------------------------------------------------------------------------------

const verificacionAnillos = (): CasoInforme[] =>
  CASOS_ANILLOS.flatMap((caso) =>
    LADOS.map((lado) => {
      const id = `${caso.id}${lado.sufijo}`;
      return enCaso({ id, referencia: caso.referencia }, () => {
        const { lamina, pasos } = unaCapaConPasos(caso.entrada, caso.vueltas, lado.diametro);
        const g = geometria(caso.entrada);
        const suma = sumaDeAnillos(lamina.diametro, caso.vueltas, g.entreCentros, g.cable);
        return {
          clase: 'verificacion',
          id,
          entradas:
            `${entradasTexto(caso.entrada)} · N = ${caso.vueltas} · ` +
            `D = ${lado.planB ? 'D0' : 'D∞'} = ${largo(lamina.diametro)}`,
          referencia: caso.referencia,
          oraculo: caso.oraculo,
          bandera: lado.bandera,
          medidas: [
            medidaNumerica({
              nombre: `L con ${caso.vueltas} vueltas`,
              esperado: suma / 1e-9,
              obtenido: lamina.inductancia / 1e-9,
              tolerancia: caso.tolerancia,
              decimales: 3,
              unidad: 'nH',
            }),
          ],
          pasos: [
            { titulo: `Con ${caso.vueltas} vueltas`, pasos },
            ...pasosDelCalculo(caso.entrada, lado.planB),
          ],
        };
      });
    }),
  );

const verificacionWheeler = (): CasoInforme[] => {
  const diametro = 10e-3;
  const vueltas = 10;
  return CASOS_WHEELER.map((caso) =>
    enCaso(caso, () => {
      const l = caso.largoSobreDiametro * diametro;
      return {
        clase: 'verificacion',
        id: caso.id,
        entradas: `D = ${largo(diametro)} · ℓ = ${largo(l)} · N = ${vueltas}`,
        referencia: caso.referencia,
        oraculo: caso.oraculo,
        medidas: [
          medidaNumerica({
            nombre: 'L de Wheeler contra la lámina exacta',
            esperado: laminaExacta(diametro, l, vueltas) / 1e-9,
            obtenido: wheeler1928(diametro, l, vueltas) / 1e-9,
            tolerancia: caso.tolerancia,
            diferencia: caso.diferencia,
            decimales: 3,
            unidad: 'nH',
          }),
        ],
        pasos: [],
      };
    }),
  );
};

// La geometría de dos capas, con c/a: la mayoría de las 7 de la investigación quedan fuera del rango
// que la Calculadora declara (c/a ≤ 0,25), y el caso lo dice.
function dosCapasTexto(b: BobinaDosCapas): string {
  const g = geometriaDosCapas(b);
  const cSobreA = g.profundidad / g.radioMedio;
  return (
    `${geometriaTexto(b)} · n = ${b.vueltasPorCapa} por capa · c/a = ${cuatroCifras(cSobreA)}` +
    (cSobreA > C_SOBRE_A_MAXIMO ? ' (fuera del rango de la Calculadora, c/a ≤ 0,25)' : '')
  );
}

const verificacionAnillosDosCapas = (): CasoInforme[] =>
  CASOS_ANILLOS_DOS_CAPAS.flatMap((caso) =>
    LADOS_DOS_CAPAS.map((lado) => {
      const id = `${caso.id}${lado.sufijo}`;
      return enCaso({ id, referencia: caso.referencia }, () => {
        const n = caso.bobina.vueltasPorCapa;
        const { lamina, pasos } = dosCapasConPasos(caso.bobina, n, lado.correccion);
        return {
          clase: 'verificacion',
          id,
          entradas: dosCapasTexto(caso.bobina),
          referencia: caso.referencia,
          oraculo: caso.oraculo,
          bandera: lado.bandera,
          medidas: [
            medidaNumerica({
              nombre: lado.planB ? 'L de Rosa y Grover (91) sola (plan B)' : 'L de dos capas',
              esperado: sumaDosCapas(caso.bobina) / 1e-9,
              obtenido: lamina.inductancia / 1e-9,
              tolerancia: lado.planB ? caso.toleranciaPlanB : caso.tolerancia,
              decimales: 2,
              unidad: 'nH',
            }),
          ],
          pasos: [{ titulo: `Dos capas, ${n} vueltas por capa`, pasos }],
        };
      });
    }),
  );

const verificacionHazeltine = (): CasoInforme[] =>
  CASOS_HAZELTINE.map((caso) =>
    enCaso(caso, () => {
      const g = geometriaDosCapas(caso.bobina);
      const n = caso.bobina.vueltasPorCapa;
      return {
        clase: 'verificacion',
        id: caso.id,
        entradas: dosCapasTexto(caso.bobina),
        referencia: caso.referencia,
        oraculo: caso.oraculo,
        medidas: [
          medidaNumerica({
            nombre: 'L de Hazeltine contra la suma de anillos',
            esperado: sumaDosCapas(caso.bobina) / 1e-9,
            obtenido: hazeltine(g.radioMedio, n * g.entreCentros, g.profundidad, 2 * n) / 1e-9,
            tolerancia: caso.tolerancia,
            diferencia: caso.diferencia,
            decimales: 2,
            unidad: 'nH',
          }),
        ],
        pasos: [],
      };
    }),
  );

// --- Comportamiento --------------------------------------------------------------------------------

const nivelTexto = (nivel: string | null) => `L buscada: ${nivel ?? 'sin marca'}`;
const avisosTexto = (codigos: readonly string[]) =>
  `avisos: ${codigos.length ? codigos.join(', ') : 'ninguno'}`;

function describir(r: ResultadoBobinas): string {
  const que =
    r.estado === 'corte' ? `corte: ${r.codigo}` : avisosTexto(r.avisos.map((a) => a.codigo));
  return `${que} · ${nivelTexto(r.revision.marcados[0]?.nivel ?? null)}`;
}

function esperadoTexto(e: CasoComportamiento['esperado']): string {
  const que = 'corte' in e ? `corte: ${e.corte}` : avisosTexto(e.avisos);
  return `${que} · ${nivelTexto(e.buscada)}`;
}

const comportamiento = (): CasoInforme[] =>
  CASOS_COMPORTAMIENTO.flatMap((caso) =>
    LADOS.map((lado) => {
      const id = `${caso.id}${lado.sufijo}`;
      return enCaso({ id, referencia: caso.referencia }, () => {
        const esperado = esperadoTexto(caso.esperado);
        const obtenido = describir(calcularBobinas(caso.entrada, { planB: lado.planB }));
        return {
          clase: 'comportamiento',
          id,
          entradas: entradasTexto(caso.entrada),
          referencia: caso.referencia,
          bandera: lado.bandera,
          esperado,
          obtenido,
          coincide: esperado === obtenido,
        };
      });
    }),
  );

function describirDosCapas(r: ResultadoBobinas): string {
  if (r.estado !== 'calculado') return `una capa no calculó: ${r.codigo}`;
  const { dosCapas } = r;
  return dosCapas.estado === 'fuera-de-rango'
    ? `dos capas fuera de rango: ${dosCapas.codigo}`
    : `dos capas calculada · ${avisosTexto(dosCapas.avisos.map((a) => a.codigo))}`;
}

function esperadoDosCapasTexto(e: CasoComportamientoDosCapas['esperado']): string {
  return 'fueraDeRango' in e
    ? `dos capas fuera de rango: ${e.fueraDeRango}`
    : `dos capas calculada · ${avisosTexto(e.avisos)}`;
}

const comportamientoDosCapas = (): CasoInforme[] =>
  CASOS_COMPORTAMIENTO_DOS_CAPAS.flatMap((caso) =>
    LADOS_DOS_CAPAS.map((lado) => {
      const id = `${caso.id}${lado.sufijo}`;
      return enCaso({ id, referencia: caso.referencia }, () => {
        const esperado = esperadoDosCapasTexto(caso.esperado);
        const obtenido = describirDosCapas(
          calcularBobinas(caso.entrada, { planBDosCapas: lado.planB }),
        );
        return {
          clase: 'comportamiento',
          id,
          entradas: entradasTexto(caso.entrada),
          referencia: caso.referencia,
          bandera: lado.bandera,
          esperado,
          obtenido,
          coincide: esperado === obtenido,
        };
      });
    }),
  );

export const INFORME: AporteInforme = {
  calculadora: 'bobinas',
  casos: () => [
    ...referenciaKL(),
    ...referenciaConD0([CASO_C74, ...CASOS_KNIGHT]),
    ...referenciaVariasCapas(),
    ...referenciaBs(),
    ...medicion(),
    ...verificacionAnillos(),
    ...verificacionWheeler(),
    ...verificacionAnillosDosCapas(),
    ...verificacionHazeltine(),
    ...comportamiento(),
    ...comportamientoDosCapas(),
  ],
};
