import type { ComponentChildren } from 'preact';
import { type Nivel, Rotulo } from './Rotulo';

export interface Motivo {
  nivel: Nivel;
  // Con el nombre y los números: "C1: suponiendo montaje Manhattan, ±0,5 pF → 25 % de error".
  texto: string;
}

// Tarjeta de un resultado (spec §5.3): sus valores, los pasos intermedios en un desplegable
// cerrado y, al pie, el bloque de motivos de los valores con aviso.
export function TarjetaResultado({
  titulo,
  destacada = false,
  pasos,
  motivos = [],
  sugerencia,
  children,
}: {
  titulo?: ComponentChildren;
  destacada?: boolean;
  pasos?: ComponentChildren;
  motivos?: readonly Motivo[];
  sugerencia?: string;
  children?: ComponentChildren;
}) {
  return (
    <section class={destacada ? 'tarjeta destacada' : 'tarjeta'}>
      {titulo && <h3 class="tarjeta-titulo">{titulo}</h3>}
      {children}
      {pasos && (
        <details class="pasos">
          <summary>Pasos intermedios</summary>
          <div class="pasos-cuerpo">{pasos}</div>
        </details>
      )}
      {motivos.length > 0 && (
        <div class="motivos">
          <ul>
            {motivos.map((m, i) => (
              <li key={i} class={`motivo-${m.nivel}`}>
                {m.texto}
              </li>
            ))}
          </ul>
          {sugerencia && <p class="sugerencia">{sugerencia}</p>}
          <Rotulo tipo="criterio-practico" />
        </div>
      )}
    </section>
  );
}

// Una fila de valor dentro de una tarjeta: nombre, valor, rótulos y botón de pase.
export function ValorResultado({
  nombre,
  valor,
  rotulos,
  detalle,
  pase,
}: {
  nombre: ComponentChildren;
  valor: string;
  rotulos?: ComponentChildren;
  detalle?: ComponentChildren;
  pase?: ComponentChildren;
}) {
  return (
    <div class="valor-resultado">
      <span class="nombre">{nombre}</span>
      <span class="valor">{valor}</span>
      {(rotulos || detalle) && (
        <span class="extra">
          {rotulos}
          {detalle && <span class="detalle">{detalle}</span>}
        </span>
      )}
      {pase && <span class="accion">{pase}</span>}
    </div>
  );
}
