import { revisarValores, umbrales } from '../../../src/calculo/comun/valor-impracticable';
import { formatearValor } from '../../../src/entrada/formato';
import { type AporteInforme, enCaso, medidaImpresa } from '../../casos-informe';
import { CASOS_CORTES, CASOS_UMBRALES, type CasoCorte } from './casos';

// El adaptador de los Casos de prueba del criterio común de valor impracticable para el Informe de
// casos (spec §13.3, Común): la tabla de umbrales y un valor a cada lado de cada corte.

const MAGNITUD = { L: 'inductancia', C: 'capacidad', R: 'resistencia' } as const;

const frecuenciaTexto = (f: number | null) =>
  f === null ? 'sin frecuencia' : `f = ${formatearValor(f, 'frecuencia')}`;

const umbralesDeLaTabla = () =>
  CASOS_UMBRALES.map((caso) =>
    enCaso(caso, () => {
      const corte = umbrales(caso.frecuencia)[caso.corte];
      if (!corte) throw new Error('sin frecuencia no hay corte');
      return {
        clase: 'verificacion',
        id: caso.id,
        entradas: frecuenciaTexto(caso.frecuencia),
        referencia: caso.referencia,
        oraculo: caso.oraculo,
        medidas: [
          medidaImpresa({
            nombre: `${caso.corte} (${caso.nivel})`,
            impreso: caso.esperado,
            obtenido: corte[caso.nivel] / caso.unidad.escala,
            tolerancia: caso.tolerancia,
            unidad: caso.unidad.nombre,
          }),
        ],
        pasos: [],
      };
    }),
  );

const nivelTexto = (nivel: CasoCorte['esperado']) => nivel ?? 'sin marca';

const ladosDeLosCortes = () =>
  CASOS_CORTES.map((caso) =>
    enCaso(caso, () => {
      const { componente } = caso;
      const r = revisarValores({ valor: componente }, caso.frecuencia);
      const obtenido = nivelTexto(r.marcados[0]?.nivel ?? null);
      const esperado = nivelTexto(caso.esperado);
      return {
        clase: 'verificacion',
        id: caso.id,
        entradas:
          `${componente.nombre} = ${formatearValor(componente.valor, MAGNITUD[componente.componente], 'paso')}` +
          ` · ${frecuenciaTexto(caso.frecuencia)}`,
        referencia: caso.referencia,
        oraculo: caso.oraculo,
        medidas: [
          {
            nombre: 'Nivel marcado',
            esperado,
            obtenido,
            errorRelativo: null,
            tolerancia: 'exacto',
            motivo: 'Es un nivel y no un número: tiene que coincidir.',
            dentro: esperado === obtenido,
          },
        ],
        pasos: r.pasos.length ? [{ titulo: 'Cuenta del criterio', pasos: r.pasos }] : [],
      };
    }),
  );

export const INFORME: AporteInforme = {
  calculadora: 'comun',
  casos: () => [...umbralesDeLaTabla(), ...ladosDeLosCortes()],
};
