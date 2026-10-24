import type { ComponentChildren } from 'preact';
import { type IdCalculadora, calculadora } from '../calculadoras';
import { type Nivel, Rotulo } from './Rotulo';

// Arriba de la Calculadora de destino de un pase (spec §4.2).
export function FranjaLlegada({
  origen,
  valor,
  nivel,
  motivo,
  onVolver,
  onQuitar,
}: {
  origen: IdCalculadora;
  // "C1 = 87,4 pF"
  valor: string;
  nivel?: Nivel;
  motivo?: string;
  onVolver?: () => void;
  onQuitar?: () => void;
}) {
  const nombre = calculadora(origen).nombreCorto;
  return (
    <div class="franja-llegada" role="status">
      <p class="desde">
        Desde {nombre}: <strong class="valor">{valor}</strong>
        {nivel && (
          <>
            {' '}
            <Rotulo tipo={nivel} />
          </>
        )}
      </p>
      {motivo && <p class="motivo">{motivo}</p>}
      <div class="acciones">
        <button type="button" class="volver" onClick={onVolver}>
          ‹ Volver a {nombre}
        </button>
        <button type="button" class="quitar" aria-label="Quitar la franja" onClick={onQuitar}>
          ✕
        </button>
      </div>
    </div>
  );
}

// Debajo del encabezado, cuando hay un service worker nuevo en espera (spec §2.2).
export function FranjaVersion({ onRecargar }: { onRecargar?: () => void }) {
  return (
    <div class="franja-version" role="status">
      <span>Hay una versión nueva</span>
      <span aria-hidden="true"> · </span>
      <button type="button" onClick={onRecargar}>
        Recargar
      </button>
    </div>
  );
}

// Aviso de la Calculadora que afecta a todo el resultado (spec §5.3).
export function Aviso({
  fuerte = false,
  children,
}: {
  fuerte?: boolean;
  children: ComponentChildren;
}) {
  return <div class={fuerte ? 'aviso fuerte' : 'aviso'}>{children}</div>;
}
