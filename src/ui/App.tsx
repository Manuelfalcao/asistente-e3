import { useEffect, useRef, useState } from 'preact/hooks';
import { almacen } from '../almacen/almacen';
import { Arreglos } from './arreglos/Arreglos';
import { Atenuadores } from './atenuadores/Atenuadores';
import { Bobinas } from './bobinas/Bobinas';
import {
  CALCULADORAS,
  CALCULADORA_INICIAL,
  type IdCalculadora,
  calculadora,
  esIdCalculadora,
} from './calculadoras';
import { Aviso, FranjaLlegada } from './comun/Franjas';
import { vaciarSesion } from './comun/sesion';
import { Filtros } from './filtros/Filtros';
import { IconoCalculadora } from './comun/Icono';
import { FranjaVersionNueva } from './FranjaVersionNueva';
import { Redes } from './redes/Redes';
import { svgIconoAsistente } from './iconos';
import {
  type EstadoNavegacion,
  type Pase,
  franjaVisible,
  irA,
  pasar,
  quitar,
  textoDeFranja,
  volver,
} from './pases';
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
  const [navegacion, setNavegacion] = useState<EstadoNavegacion>(() => ({
    activa: calculadoraInicial(),
    pila: [],
  }));
  const activaId = navegacion.activa;
  useEffect(() => {
    almacen.guardarUltima(activaId);
  }, [activaId]);
  const activa = calculadora(activaId);
  const franja = franjaVisible(navegacion);

  // Cambiar de Calculadora desde las pestañas o el menú vacía la pila de pases y lo que las
  // Calculadoras recuerdan de la sesión (spec §4.2).
  const ir = (id: IdCalculadora) => {
    if (id !== activaId) vaciarSesion();
    setNavegacion((n) => irA(n, id));
  };
  // El destino carga el valor de un pase una sola vez, al abrirse por él. Si el Alumno vuelve a una
  // Calculadora intermedia de una cadena, esta recupera lo que él había editado.
  const entregados = useRef(new WeakSet<Pase>());
  useEffect(() => {
    if (franja) entregados.current.add(franja);
  }, [franja]);
  const llegada = franja && !entregados.current.has(franja) ? franja : undefined;
  // Un pase abre otra Calculadora desde un resultado: la franja de llegada tiene que verse.
  const onPasar = (pase: Pase) => {
    setNavegacion((n) => pasar(n, pase));
    window.scrollTo(0, 0);
  };

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
                onClick={() => ir(c.id)}
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
        {franja && (
          <FranjaLlegada
            origen={franja.origen}
            valor={textoDeFranja(franja)}
            nivel={franja.nivel}
            motivo={franja.motivo}
            nota={franja.nota}
            onVolver={() => setNavegacion(volver)}
            onQuitar={() => setNavegacion(quitar)}
          />
        )}
        <main class="calculadora">
          {activa.id === 'bobinas' ? (
            <Bobinas pase={llegada?.destino === 'bobinas' ? llegada : undefined} />
          ) : activa.id === 'filtros' ? (
            <Filtros onPasar={onPasar} />
          ) : activa.id === 'arreglos' ? (
            <Arreglos pase={llegada?.destino === 'arreglos' ? llegada : undefined} />
          ) : activa.id === 'redes' ? (
            <Redes
              onIr={ir}
              onPasar={onPasar}
              pase={llegada?.destino === 'redes' ? llegada : undefined}
            />
          ) : activa.id === 'atenuadores' ? (
            <Atenuadores onPasar={onPasar} />
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
            onClick={() => ir(c.id)}
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
