import { useEffect, useState } from 'preact/hooks';

// En el celular las entradas y el resultado no entran juntos. Este atajo aparece solo cuando hace
// falta: con un resultado fuera de la vista lleva a él, y con las entradas fuera de la vista vuelve.
// En PC está todo a la vista y los estilos no lo dibujan.
type Destino = 'resultado' | 'entradas' | null;

export function SaltoEntradasResultado({ calculadora }: { calculadora: string }) {
  const [destino, setDestino] = useState<Destino>(null);
  useEffect(() => {
    const resultados = document.querySelector('.resultados');
    const entradas = document.querySelector('.cuerpo-calculadora > :first-child');
    if (!resultados || !entradas) return;
    const visible = new Map<Element, boolean>();
    const actualizar = () => {
      if (resultados.querySelector(':scope > .sin-resultado')) setDestino(null);
      else if (visible.get(resultados) === false) setDestino('resultado');
      else setDestino(visible.get(entradas) === false ? 'entradas' : null);
    };
    // Abajo se descuentan las pestañas y un poco más: que asome no alcanza para leerlo.
    const vista = new IntersectionObserver(
      (cambios) => {
        for (const c of cambios) visible.set(c.target, c.isIntersecting);
        actualizar();
      },
      { rootMargin: '0px 0px -130px 0px' },
    );
    vista.observe(resultados);
    vista.observe(entradas);
    const contenido = new MutationObserver(actualizar);
    contenido.observe(resultados, { childList: true });
    return () => {
      vista.disconnect();
      contenido.disconnect();
    };
  }, [calculadora]);
  if (!destino) return null;
  const ir = () => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    document
      .querySelector(destino === 'resultado' ? '.resultados' : '.calculadora')
      ?.scrollIntoView();
  };
  return (
    <button type="button" class="salto" onClick={ir}>
      {destino === 'resultado' ? 'Ver resultado' : 'Volver a las entradas'}
      <span aria-hidden="true">{destino === 'resultado' ? ' ↓' : ' ↑'}</span>
    </button>
  );
}
