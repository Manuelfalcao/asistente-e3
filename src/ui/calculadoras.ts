export type IdCalculadora = 'bobinas' | 'filtros' | 'arreglos' | 'redes' | 'atenuadores';

export interface Calculadora {
  id: IdCalculadora;
  nombre: string;
  nombreCorto: string;
  descripcion: string;
}

// El orden es el del menú; la primera es la que abre por defecto.
export const CALCULADORAS: readonly Calculadora[] = [
  {
    id: 'bobinas',
    nombre: 'Calculadora de bobinas',
    nombreCorto: 'Bobinas',
    descripcion: 'Inductancia de solenoides de aire de una y dos capas.',
  },
  {
    id: 'filtros',
    nombre: 'Calculadora de filtros',
    nombreCorto: 'Filtros',
    descripcion: 'Filtros LC escalera: pasa bajos, pasa altos, pasa banda y rechaza banda.',
  },
  {
    id: 'arreglos',
    nombre: 'Calculadora de Arreglos equivalentes',
    nombreCorto: 'Arreglos',
    descripcion: 'Combinaciones de valores comerciales para un valor buscado.',
  },
  {
    id: 'redes',
    nombre: 'Calculadora de redes de adaptación',
    nombreCorto: 'Redes',
    descripcion: 'Adaptación de impedancias con redes L, π y T.',
  },
  {
    id: 'atenuadores',
    nombre: 'Calculadora de atenuadores',
    nombreCorto: 'Atenuadores',
    descripcion: 'Atenuadores T y π con resistencias comerciales.',
  },
];

export const CALCULADORA_INICIAL = CALCULADORAS[0];

export function esIdCalculadora(id: string): id is IdCalculadora {
  return CALCULADORAS.some((c) => c.id === id);
}

export function calculadora(id: IdCalculadora): Calculadora {
  return CALCULADORAS.find((c) => c.id === id)!;
}
