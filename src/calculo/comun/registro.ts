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
  // Qué hace el Asistente si la Cátedra no lo aprueba.
  planB: string;
  // La bandera de src/calculo/ que activa el plan B. Null si el plan B es ajustar números.
  bandera: string | null;
}

export const REGISTRO: readonly EntradaRegistro[] = [CRITERIO_UMBRALES];
