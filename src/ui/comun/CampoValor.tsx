// Enter hace lo que el botón "Siguiente" del teclado del celular: en el último campo, cierra el
// teclado y, donde el resultado queda debajo de las entradas, lo muestra.
function alEnter(actual: HTMLInputElement) {
  const campos = [...document.querySelectorAll<HTMLInputElement>('.entradas .campo-valor input')];
  const i = campos.indexOf(actual);
  if (i < 0) return;
  const siguiente = campos[i + 1];
  if (siguiente) {
    siguiente.focus();
    siguiente.select();
    return;
  }
  actual.blur();
  const pestanas = document.querySelector('.pestanas');
  if (pestanas && getComputedStyle(pestanas).display !== 'none') {
    document.querySelector('.resultados')?.scrollIntoView();
  }
}

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
  ayuda,
  ejemplo,
}: {
  id: string;
  etiqueta: string;
  texto: string;
  onTexto: (texto: string) => void;
  selector?: SelectorDeUnidad;
  // Para los campos sin Selector de unidad, como los largos en mm.
  unidadFija?: string;
  lectura?: Lectura;
  // Una línea fija debajo de la lectura, como el mínimo de un campo: "Mínimo: 4,36".
  ayuda?: string;
  // Cómo se puede escribir el valor, mientras el campo está vacío.
  ejemplo?: string;
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
          enterKeyHint="next"
          placeholder={ejemplo && `ej. ${ejemplo}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter') alEnter(e.currentTarget);
          }}
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
      {ayuda && <div class="ayuda-campo">{ayuda}</div>}
    </div>
  );
}
