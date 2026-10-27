import { type IdCalculadora, calculadora } from '../calculadoras';
import type { Pase } from '../pases';
import { type Nivel, Punto, textoNivel } from './Rotulo';

// "→ Bobinas" o "→ Arreglos" junto a un valor (spec §4.2). Con aviso, lleva el punto del nivel.
export function BotonPase({
  destino,
  nivel,
  onClick,
}: {
  // Las únicas Calculadoras que reciben valores (spec §5.5).
  destino: Extract<IdCalculadora, 'bobinas' | 'arreglos'>;
  nivel?: Nivel;
  onClick?: () => void;
}) {
  return (
    <button type="button" class="pase" onClick={onClick}>
      {nivel && <Punto nivel={nivel} />}
      <span aria-hidden="true">→ </span>
      {calculadora(destino).nombreCorto}
      {nivel && <span class="solo-lector"> ({textoNivel(nivel)})</span>}
    </button>
  );
}

// El botón de pase de un valor del resultado: al tocarlo, el armazón abre la otra Calculadora.
export function BotonPaseDe({ pase, onPasar }: { pase: Pase; onPasar?: (pase: Pase) => void }) {
  if (!onPasar || (pase.destino !== 'bobinas' && pase.destino !== 'arreglos')) return null;
  return <BotonPase destino={pase.destino} nivel={pase.nivel} onClick={() => onPasar(pase)} />;
}
