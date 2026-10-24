import type { ComponentChildren } from 'preact';
import { citar } from '../../calculo/comun/referencia';
import type { Paso, Referencia } from '../../calculo/comun/resultado';
import { Formula } from './Formula';

// La forma del resultado de toda Calculadora (spec §5.3): los avisos arriba, el resultado
// principal, las tarjetas y al final las notas fijas de construcción.
export function FormaResultado({
  avisos,
  principal,
  tarjetas,
  notas = [],
}: {
  avisos?: ComponentChildren;
  principal: ComponentChildren;
  tarjetas?: ComponentChildren;
  notas?: readonly string[];
}) {
  return (
    <div class="forma-resultado">
      {avisos}
      {principal}
      {tarjetas}
      {notas.length > 0 && (
        <section class="notas-fijas" aria-label="Notas">
          <h3>Notas</h3>
          <ul>
            {notas.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// "Reference Data for Radio Engineers, 4.ª ed. (ITT, 1956), …", con el título en cursiva.
export function Cita({ referencias }: { referencias: readonly Referencia[] }) {
  return (
    <p class="referencia">
      {citar(referencias).map((p, i) => (
        <span key={i}>
          {p.obra && <em>{p.obra}</em>}
          {p.texto}
        </span>
      ))}
    </p>
  );
}

// El contenido del desplegable de pasos intermedios: qué se calcula, la fórmula sustituida y, si
// hay, de dónde salen sus números.
export function Pasos({ pasos }: { pasos: readonly Paso[] }) {
  return (
    <ol class="lista-pasos">
      {pasos.map((p, i) => (
        <li key={i}>
          <span class="paso-texto">{p.texto}</span>
          <Formula latex={p.latex} />
          {p.fuente && <span class="paso-fuente">{p.fuente}</span>}
        </li>
      ))}
    </ol>
  );
}
