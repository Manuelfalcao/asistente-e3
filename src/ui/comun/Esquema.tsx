import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  type Escalera,
  RADIO_CONECTOR,
  RADIO_TERMINAL,
  TAM_CONECTOR,
  TAM_ROTULO,
  TAM_SUBINDICE,
  trazarEsquema,
} from '../esquema';

// Esquema de una red en escalera. Mide el ancho disponible y, si no entra, la parte en filas.
export function Esquema({ escalera }: { escalera: Escalera }) {
  const ref = useRef<HTMLElement>(null);
  const [ancho, setAncho] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current!;
    const medir = () => setAncho(Math.floor(el.clientWidth));
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const esquema = useMemo(
    () => (ancho === null ? null : trazarEsquema(escalera, ancho)),
    [escalera, ancho],
  );

  return (
    <figure class="esquema" ref={ref} role="img" aria-label={esquema?.descripcion}>
      {esquema?.filas.map((fila, i) => (
        <svg
          key={i}
          width={fila.ancho}
          height={fila.alto}
          viewBox={`0 0 ${fila.ancho} ${fila.alto}`}
          aria-hidden="true"
        >
          <path class="trazo" d={fila.trazo} />
          {fila.nodos.map((p, j) => (
            <circle key={`n${j}`} class="nodo" cx={p.x} cy={p.y} r={2.5} />
          ))}
          {fila.terminales.map((p, j) => (
            <circle key={`t${j}`} class="terminal" cx={p.x} cy={p.y} r={RADIO_TERMINAL} />
          ))}
          {fila.conectores.map((c) => (
            <g key={`c${c.x}`} class="conector">
              <circle cx={c.x} cy={c.y} r={RADIO_CONECTOR} />
              <text x={c.x} y={c.y + 4} text-anchor="middle" font-size={TAM_CONECTOR}>
                {c.numero}
              </text>
            </g>
          ))}
          {fila.rotulos.map((r, j) => (
            <text key={`r${j}`} x={r.x} y={r.y} text-anchor={r.ancla} font-size={TAM_ROTULO}>
              {r.texto}
              {r.sub && (
                <tspan dy={3} font-size={TAM_SUBINDICE}>
                  {r.sub}
                </tspan>
              )}
            </text>
          ))}
        </svg>
      ))}
    </figure>
  );
}
