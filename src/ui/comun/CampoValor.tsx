export interface SelectorDeUnidad {
  unidades: readonly string[];
  unidad: string;
  onUnidad: (unidad: string) => void;
}

// Cómo se leyó lo escrito, en la línea de abajo del campo: el eco ("= 4,7 nH"), una lectura
// aceptada con advertencia ("Se leyó 1 Ω. Para mil, escribí 1000 o 1k.") o el motivo de una línea
// cuando no se puede leer ("No entiendo «4,7x»").
export interface Lectura {
  tipo: 'eco' | 'aviso' | 'error';
  texto: string;
}

// Campo de valor (spec §4.3 y §5.1): la etiqueta al costado, el campo y el Selector de unidad en la
// misma fila, y la lectura debajo. Solo dibuja: leer el texto es de la Entrada flexible.
export function CampoValor({
  id,
  etiqueta,
  texto,
  onTexto,
  selector,
  unidadFija,
  lectura,
}: {
  id: string;
  etiqueta: string;
  texto: string;
  onTexto: (texto: string) => void;
  selector?: SelectorDeUnidad;
  // Para los campos sin Selector de unidad, como los largos en mm.
  unidadFija?: string;
  lectura?: Lectura;
}) {
  const idLectura = `${id}-lectura`;
  const invalido = lectura?.tipo === 'error';
  return (
    <div class={invalido ? 'campo-valor invalido' : 'campo-valor'}>
      <label for={id}>{etiqueta}</label>
      <div class="control">
        <input
          id={id}
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellcheck={false}
          value={texto}
          aria-invalid={invalido || undefined}
          aria-describedby={idLectura}
          onInput={(e) => onTexto(e.currentTarget.value)}
        />
        {selector && (
          <select
            aria-label={`Unidad de ${etiqueta}`}
            value={selector.unidad}
            onChange={(e) => selector.onUnidad(e.currentTarget.value)}
          >
            {selector.unidades.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        )}
        {unidadFija && <span class="unidad-fija">{unidadFija}</span>}
      </div>
      <div id={idLectura} class={`lectura lectura-${lectura?.tipo ?? 'eco'}`} aria-live="polite">
        {lectura?.texto}
      </div>
    </div>
  );
}
