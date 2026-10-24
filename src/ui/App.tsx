import { useEffect, useState } from 'preact/hooks';
import { almacen } from '../almacen/almacen';
import { Atenuadores } from './atenuadores/Atenuadores';
import {
  CALCULADORAS,
  CALCULADORA_INICIAL,
  type IdCalculadora,
  calculadora,
  esIdCalculadora,
} from './calculadoras';
import { Aviso } from './comun/Franjas';
import { IconoCalculadora } from './comun/Icono';
import { FranjaVersionNueva } from './FranjaVersionNueva';
import { svgIconoAsistente } from './iconos';
import { VERSION } from './version';

const LOGO = svgIconoAsistente({ redondeado: true });

const ES_ARCHIVO = import.meta.env.MODE === 'archivo';

// La PWA pide que el navegador no borre lo guardado; el HTML único no lo pide.
if (!ES_ARCHIVO) {
  try {
    void navigator.storage?.persist?.().catch(() => {});
  } catch {
    // Sin la API: el Asistente sigue andando.
  }
}

// Se mide una vez al abrir: un `.html` con origen opaco no puede guardar (spec §2.1).
const AVISAR_SIN_GUARDADO = ES_ARCHIVO && !almacen.puedeGuardar();

function calculadoraInicial(): IdCalculadora {
  const id = almacen.ultima();
  return id !== undefined && esIdCalculadora(id) ? id : CALCULADORA_INICIAL.id;
}

export function App() {
  const [activaId, setActivaId] = useState(calculadoraInicial);
  useEffect(() => {
    almacen.guardarUltima(activaId);
  }, [activaId]);
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
        {AVISAR_SIN_GUARDADO && (
          <Aviso>
            Este navegador no deja guardar datos desde este archivo: lo que escribas y tu Inventario
            pueden no guardarse. Abrí el Asistente desde el link del sitio para que se guarden.
          </Aviso>
        )}
        <main class="calculadora">
          {activa.id === 'atenuadores' ? (
            <Atenuadores />
          ) : (
            <p class="vacia">Esta Calculadora todavía está vacía.</p>
          )}
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
