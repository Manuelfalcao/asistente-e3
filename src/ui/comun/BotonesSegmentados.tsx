export interface Opcion<V extends string> {
  valor: V;
  texto: string;
}

// Campo de opciones (spec §4.3): la etiqueta arriba y los botones a todo el ancho.
// Son radios nativos: el teclado y el lector de pantalla los manejan como un grupo.
export function BotonesSegmentados<V extends string>({
  etiqueta,
  nombre,
  opciones,
  valor,
  onCambio,
}: {
  etiqueta: string;
  nombre: string;
  opciones: readonly Opcion<V>[];
  valor: V;
  onCambio: (valor: V) => void;
}) {
  return (
    <fieldset class="segmentado">
      <legend>{etiqueta}</legend>
      <div class="segmentos">
        {opciones.map((o) => (
          <label key={o.valor} class="segmento">
            <input
              type="radio"
              name={nombre}
              value={o.valor}
              checked={o.valor === valor}
              onChange={() => onCambio(o.valor)}
            />
            <span>{o.texto}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
