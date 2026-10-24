import { leerEntrada } from '../../src/entrada/leer';
import { type AporteInforme, enCaso } from '../casos-informe';
import { CASOS_ENTRADA, type CasoEntrada, TOLERANCIA_RELATIVA, nombreDeCasoEntrada } from './casos';

// El adaptador de los Casos de prueba de la Entrada flexible para el Informe de casos (spec §13.3,
// Común). Son de comportamiento: la lista compacta. Las mismas reglas que leer.test.ts.

// Un valor leído, con sus dBm y su aviso si los hay.
function valorTexto(valor: number, dbm?: number, aviso?: string): string {
  return [`valor ${valor}`, dbm !== undefined && `${dbm} dBm`, aviso && `aviso «${aviso}»`]
    .filter(Boolean)
    .join(', ');
}

function esperadoTexto(caso: CasoEntrada): string {
  const e = caso.esperado;
  if ('vacio' in e) return 'campo vacío';
  if ('error' in e) return `error que dice «${e.error}»`;
  return valorTexto(e.valor, e.dbm, e.aviso);
}

function evaluar(caso: CasoEntrada): { obtenido: string; coincide: boolean } {
  const lectura = leerEntrada(caso.texto, caso.campo);
  const e = caso.esperado;
  switch (lectura.tipo) {
    case 'vacio':
      return { obtenido: 'campo vacío', coincide: 'vacio' in e };
    case 'error':
      return {
        obtenido: `error «${lectura.mensaje}»`,
        coincide: 'error' in e && lectura.mensaje.includes(e.error),
      };
    case 'valor': {
      const obtenido = valorTexto(lectura.valor, lectura.dbm, lectura.aviso);
      if (!('valor' in e)) return { obtenido, coincide: false };
      const cercano = Math.abs(lectura.valor - e.valor) <= Math.abs(e.valor) * TOLERANCIA_RELATIVA;
      const mismoDbm =
        e.dbm === undefined
          ? lectura.dbm === undefined
          : Math.abs((lectura.dbm ?? NaN) - e.dbm) < 1e-12;
      return { obtenido, coincide: cercano && lectura.aviso === e.aviso && mismoDbm };
    }
  }
}

export const INFORME: AporteInforme = {
  calculadora: 'comun',
  casos: () =>
    CASOS_ENTRADA.map((caso) => {
      const base = {
        id: nombreDeCasoEntrada(caso),
        entradas: `«${caso.texto}» · campo de ${caso.campo.magnitud}${caso.campo.unidad ? `, Selector en ${caso.campo.unidad}` : ''}`,
        referencia: `spec ${caso.respalda}`,
      };
      return enCaso(base, () => ({
        clase: 'comportamiento' as const,
        ...base,
        esperado: esperadoTexto(caso),
        ...evaluar(caso),
      }));
    }),
};
