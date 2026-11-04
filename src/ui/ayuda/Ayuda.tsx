import { useEffect, useRef, useState } from 'preact/hooks';
import { BLOQUES_AYUDA, leerTramos } from './texto';
import './ayuda.css';

function Texto({ texto }: { texto: string }) {
  return (
    <>
      {leerTramos(texto).map((t, i) =>
        t.tipo === 'negrita' ? (
          <strong key={i}>{t.texto}</strong>
        ) : t.tipo === 'cursiva' ? (
          <em key={i}>{t.texto}</em>
        ) : t.tipo === 'codigo' ? (
          <code key={i}>{t.texto}</code>
        ) : (
          t.texto
        ),
      )}
    </>
  );
}

// El botón del encabezado y su ventana. La ventana va encima de la Calculadora, sin desmontarla: al
// cerrarla sigue todo como estaba. Un <dialog> modal ya resuelve el foco, Escape y el "atrás" de
// Android.
export function Ayuda() {
  const [abierta, setAbierta] = useState(false);
  const dialogo = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (abierta) dialogo.current?.showModal();
  }, [abierta]);

  return (
    <>
      <button
        type="button"
        class="boton-ayuda"
        aria-haspopup="dialog"
        onClick={() => setAbierta(true)}
      >
        Ayuda
      </button>
      {abierta && (
        <dialog
          ref={dialogo}
          class="ayuda"
          aria-labelledby="ayuda-titulo"
          onClose={() => setAbierta(false)}
          onClick={(e) => {
            // El contenido ocupa toda la ventana: un toque en el <dialog> mismo es afuera de ella.
            if (e.target === dialogo.current) dialogo.current?.close();
          }}
        >
          <div class="ayuda-contenido">
            <header class="ayuda-barra">
              <h2 id="ayuda-titulo">Ayuda</h2>
              <button type="button" class="boton-ayuda" onClick={() => dialogo.current?.close()}>
                Cerrar
              </button>
            </header>
            <div class="ayuda-texto">
              {BLOQUES_AYUDA.map((b, i) =>
                b.tipo === 'titulo' ? (
                  b.nivel === 2 ? (
                    <h3 key={i}>{b.texto}</h3>
                  ) : (
                    <h4 key={i}>{b.texto}</h4>
                  )
                ) : b.tipo === 'parrafo' ? (
                  <p key={i}>
                    <Texto texto={b.texto} />
                  </p>
                ) : (
                  <ul key={i}>
                    {b.items.map((item, j) => (
                      <li key={j}>
                        <Texto texto={item} />
                      </li>
                    ))}
                  </ul>
                ),
              )}
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
