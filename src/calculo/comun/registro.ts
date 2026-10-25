import { DEDUCCION_DIAMETRO_RF } from '../bobinas/bobinas';
import { DEDUCCION_DOS_CAPAS } from '../bobinas/dos-capas';
import type { Paso } from './resultado';
import { CRITERIO_UMBRALES } from './valor-impracticable';

// Registro común de Criterios prácticos y Deducciones propias (spec §13.5). Lo lee el Informe de
// casos, donde cada entrada se aprueba aparte: un Criterio práctico como criterio (si no se aprueba
// se ajustan sus números) y una Deducción propia como fórmula (si no se aprueba, su plan B).

export interface EntradaRegistro {
  tipo: 'criterio-practico' | 'deduccion-propia';
  // Corto y único: lo usa el Informe de casos.
  id: string;
  nombre: string;
  queEs: string;
  // Qué se adaptó de la bibliografía y por qué.
  adaptacion: string;
  // Lo que lo respalda: fuentes, casos o simulaciones.
  respaldo: string;
  // Solo en una Deducción propia: cómo se llega a la fórmula, paso a paso, en LaTeX. La comparación
  // contra el plan B y contra casos límite son los Casos de prueba con `bandera` de esta entrada.
  deduccion?: readonly Paso[];
  // Qué hace el Asistente si la Cátedra no lo aprueba.
  planB: string;
  // La bandera de src/calculo/ que activa el plan B. Null si el plan B es ajustar números.
  bandera: string | null;
}

export const REGISTRO: readonly EntradaRegistro[] = [
  DEDUCCION_DIAMETRO_RF,
  DEDUCCION_DOS_CAPAS,
  CRITERIO_UMBRALES,
];
