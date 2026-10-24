// Lo común a las tablas de Casos de prueba de todas las Calculadoras (spec §13.1 y §13.2). Las
// tablas son datos: las corre Vitest y las va a leer el Informe de casos.

export type ClaseCaso = 'referencia' | 'medicion' | 'verificacion' | 'comportamiento';

// Por caso, obligatoria y con motivo escrito: no hay tolerancia por Calculadora.
export type Tolerancia =
  // Tabla publicada: media unidad de la última cifra impresa del esperado.
  | { tipo: 'media-unidad'; motivo: string }
  | { tipo: 'relativa'; valor: number; motivo: string }
  | { tipo: 'absoluta'; valor: number; motivo: string };

// Si la referencia usó otra aproximación: la diferencia relativa (obtenido / esperado − 1) que se
// espera, con su signo. La tolerancia se aplica alrededor de ella.
export interface DiferenciaEsperada {
  relativa: number;
  motivo: string;
}

export const MEDIA_UNIDAD: Tolerancia = {
  tipo: 'media-unidad',
  motivo: 'Tabla publicada: media unidad de la última cifra impresa.',
};

// Un valor como está impreso en la tabla, con coma decimal: "190,7", "3889".
export function leerImpreso(impreso: string): number {
  return Number(impreso.replace(',', '.'));
}

// El margen absoluto alrededor del esperado.
export function margen(tolerancia: Tolerancia, impreso: string): number {
  switch (tolerancia.tipo) {
    case 'media-unidad': {
      const decimales = impreso.split(',')[1]?.length ?? 0;
      return 0.5 * 10 ** -decimales;
    }
    case 'relativa':
      return tolerancia.valor * Math.abs(leerImpreso(impreso));
    case 'absoluta':
      return tolerancia.valor;
  }
}

// Si el obtenido entra en la tolerancia alrededor del esperado (corrido por la Diferencia esperada).
export function dentroDeTolerancia(
  obtenido: number,
  impreso: string,
  tolerancia: Tolerancia,
  diferencia?: DiferenciaEsperada,
): boolean {
  const esperado = leerImpreso(impreso) * (1 + (diferencia?.relativa ?? 0));
  return Math.abs(obtenido - esperado) <= margen(tolerancia, impreso);
}
