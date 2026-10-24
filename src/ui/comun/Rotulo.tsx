import type { Nivel } from '../../calculo/comun/valor-impracticable';

// Nivel de aviso de un valor (spec §5.6): ámbar para Valor dudoso, rojo para Valor impracticable.
export type { Nivel };

export type TipoRotulo =
  Nivel | 'estimacion' | 'criterio-practico' | 'criterio-diseno' | 'deduccion-propia';

const TEXTO: Record<TipoRotulo, string> = {
  dudoso: 'Valor dudoso',
  impracticable: 'Valor impracticable',
  estimacion: 'estimación',
  'criterio-practico': 'criterio práctico',
  'criterio-diseno': 'criterio de diseño',
  'deduccion-propia': 'deducción propia',
};

// Los dos niveles van con color y forma (círculo o rombo), para que no dependan solo del color.
export function Rotulo({ tipo }: { tipo: TipoRotulo }) {
  return <span class={`rotulo rotulo-${tipo}`}>{TEXTO[tipo]}</span>;
}

export function Punto({ nivel }: { nivel: Nivel }) {
  return <span class={`punto punto-${nivel}`} aria-hidden="true" />;
}

export function textoNivel(nivel: Nivel): string {
  return TEXTO[nivel];
}
