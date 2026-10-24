import type { IdCalculadora } from '../calculadoras';
import { ICONOS } from '../iconos';

export function IconoCalculadora({ id, tam = 24 }: { id: IdCalculadora; tam?: number }) {
  return (
    <svg
      class="icono-calculadora"
      width={tam}
      height={tam}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={1.75}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {ICONOS[id].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
