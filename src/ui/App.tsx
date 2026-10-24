import { useState } from 'preact/hooks';
import { CALCULADORAS, CALCULADORA_INICIAL, calculadora } from './calculadoras';
import { IconoCalculadora } from './comun/Icono';
import { FranjaVersionNueva } from './FranjaVersionNueva';
import { svgIconoAsistente } from './iconos';
import { VERSION } from './version';

const LOGO = svgIconoAsistente({ redondeado: true });

const ES_ARCHIVO = import.meta.env.MODE === 'archivo';

export function App() {
  const [activaId, setActivaId] = useState(CALCULADORA_INICIAL.id);
  const activa = calculadora(activaId);

  return (
    <div class="armazon">
      <nav class="menu-lateral" aria-label="Calculadoras">
        <h1 class="marca">
          <span class="logo" aria-hidden="true" dangerouslySetInnerHTML={{ __html: LOGO }} />
          Asistente E3
        </h1>
        <ul>
          {CALCULADORAS.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                class={c.id === activaId ? 'activa' : ''}
                aria-current={c.id === activaId ? 'page' : undefined}
                onClick={() => setActivaId(c.id)}
              >
                <span class="icono">
                  <IconoCalculadora id={c.id} />
                </span>
                <span class="nombre">{c.nombreCorto}</span>
                <span class="descripcion">{c.descripcion}</span>
              </button>
            </li>
          ))}
        </ul>
        <footer class="pie-menu">
          <div>{VERSION}</div>
          {!ES_ARCHIVO && (
            <a href="asistente-e3.html" download>
              Descargar versión para PC
            </a>
          )}
        </footer>
      </nav>

      <div class="contenido">
        <header class="encabezado">
          <h2>{activa.nombre}</h2>
          <span class="version">{VERSION}</span>
        </header>
        <FranjaVersionNueva />
        <main class="calculadora">
          <p class="vacia">Esta Calculadora todavía está vacía.</p>
        </main>
      </div>

      <nav class="pestanas" aria-label="Calculadoras">
        {CALCULADORAS.map((c) => (
          <button
            key={c.id}
            type="button"
            class={c.id === activaId ? 'activa' : ''}
            aria-current={c.id === activaId ? 'page' : undefined}
            onClick={() => setActivaId(c.id)}
          >
            <span class="icono">
              <IconoCalculadora id={c.id} />
            </span>
            <span class="nombre">{c.nombreCorto}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
