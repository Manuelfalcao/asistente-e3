export interface Calculadora {
  id: string;
  nombre: string;
  nombreCorto: string;
  descripcion: string;
  icono: string;
}

// El orden es el del menú; la primera es la que abre por defecto.
export const CALCULADORAS: readonly Calculadora[] = [
  {
    id: 'bobinas',
    nombre: 'Calculadora de bobinas',
    nombreCorto: 'Bobinas',
    descripcion: 'Inductancia de solenoides de aire de una y dos capas.',
    icono: '🌀',
  },
  {
    id: 'filtros',
    nombre: 'Calculadora de filtros',
    nombreCorto: 'Filtros',
    descripcion: 'Filtros LC escalera: pasa bajos, pasa altos y pasa banda.',
    icono: '〰️',
  },
  {
    id: 'arreglos',
    nombre: 'Calculadora de Arreglos equivalentes',
    nombreCorto: 'Arreglos',
    descripcion: 'Combinaciones de valores comerciales para un valor buscado.',
    icono: '🧩',
  },
  {
    id: 'redes',
    nombre: 'Calculadora de redes de adaptación',
    nombreCorto: 'Redes',
    descripcion: 'Adaptación de impedancias con redes L, π y T.',
    icono: '🔀',
  },
  {
    id: 'atenuadores',
    nombre: 'Calculadora de atenuadores',
    nombreCorto: 'Atenuadores',
    descripcion: 'Atenuadores T y π con resistores comerciales.',
    icono: '📉',
  },
];

export const CALCULADORA_INICIAL = CALCULADORAS[0];
