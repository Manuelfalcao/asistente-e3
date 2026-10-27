import type { ToleranciaValor } from '../../calculo/arreglos/inventario';
import {
  type OpcionComercial,
  type Redondeo,
  type ValoresComerciales as Calculo,
} from '../../calculo/atenuadores/valores-comerciales';
import { formatearValor } from '../../entrada/formato';
import { Aviso } from '../comun/Franjas';
import { Rotulo } from '../comun/Rotulo';
import { Pasos } from '../comun/Resultado';
import { Desplegable, ValorResultado } from '../comun/Tarjeta';

// Las resistencias con Valores comerciales de un atenuador (spec §10.4): el redondeo al más cercano
// y las 3 mejores combinaciones entre vecinos, cada una con la atenuación real, las pérdidas de
// retorno con su ROE y el peor caso por tolerancia.

const ohms = (r: number) => formatearValor(r, 'resistencia');
const db = (x: number) => formatearValor(x, 'decibeles');

// Por encima de este valor la PR es ruido de redondeo: la red está adaptada.
const PR_ADAPTADA = 100;

// "30,5 dB (ROE 1,06)"
function textoPr(pr: number, roe: number): string {
  return pr >= PR_ADAPTADA
    ? `más de ${PR_ADAPTADA} dB (ROE 1)`
    : `${db(pr)} (ROE ${roe.toFixed(2).replace('.', ',')})`;
}

function textoTolerancia(t: ToleranciaValor): string {
  return t.tipo === 'relativa'
    ? `±${formatearValor(t.fraccion * 100, 'porcentaje')}`
    : `±${ohms(t.valor)}`;
}

function textoRedondeo(redondeo: Redondeo): string {
  return redondeo === 'inventario' ? 'Inventario de resistencias' : redondeo;
}

export function ValoresComerciales({
  comercial,
  redondeo,
  ventana,
  objetivo,
}: {
  comercial: Calculo;
  redondeo: Redondeo;
  // En dB, el ± de la ventana.
  ventana: number;
  // En dB, la atenuación a la que apuntan las resistencias ideales.
  objetivo: number;
}) {
  const { mejores, dentroDeLaVentana } = comercial;
  return (
    <div class="valores-comerciales">
      <h4 class="potencia-titulo">Con valores comerciales ({textoRedondeo(redondeo)})</h4>
      <Opcion titulo="Redondeo al más cercano" opcion={comercial.redondeo} objetivo={objetivo} />
      <h4 class="potencia-titulo">
        {mejores.length === 1 ? 'Mejor combinación' : `Las ${mejores.length} mejores combinaciones`}
      </h4>
      {!dentroDeLaVentana && (
        <Aviso>
          Ninguna combinación entra en ±{db(ventana)} de {db(objetivo)}: se muestran las{' '}
          {mejores.length} de menor error de atenuación.
        </Aviso>
      )}
      <ol class="lista-comercial">
        {mejores.map((o, i) => (
          <li key={o.resistencias.map((r) => r.valor).join('-')}>
            <Opcion titulo={`Opción ${i + 1}`} opcion={o} objetivo={objetivo} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function Opcion({
  titulo,
  opcion,
  objetivo,
}: {
  titulo: string;
  opcion: OpcionComercial;
  objetivo: number;
}) {
  const { revision, peorCaso: p } = opcion;
  const marca = (nombre: string) => revision.marcados.find((m) => m.nombre === nombre)?.nivel;
  const error = opcion.atenuacion - objetivo;
  // La tolerancia de la que sale el peor caso: la misma en todas, salvo las propias del Inventario.
  const tolerancias = [...new Set(opcion.resistencias.map((r) => textoTolerancia(r.tolerancia)))];
  return (
    <div class="opcion-comercial">
      <h5 class="opcion-titulo">{titulo}</h5>
      {opcion.resistencias.map((r) => (
        <ValorResultado
          key={r.nombre}
          nombre={r.nombre}
          valor={ohms(r.valor)}
          rotulos={marca(r.nombre) && <Rotulo tipo={marca(r.nombre)!} />}
          detalle={`Ideal: ${ohms(r.ideal)}`}
        />
      ))}
      <ValorResultado
        nombre="Atenuación real"
        valor={db(opcion.atenuacion)}
        detalle={`${error >= 0 ? '+' : '−'}${db(Math.abs(error))} respecto de ${db(objetivo)}`}
      />
      <ValorResultado nombre="PR de entrada" valor={textoPr(opcion.prEntrada, opcion.roeEntrada)} />
      <ValorResultado nombre="PR de salida" valor={textoPr(opcion.prSalida, opcion.roeSalida)} />
      <ValorResultado
        nombre={`Peor caso (${tolerancias.join(', ')})`}
        valor={`${db(p.atenuacionMin)} a ${db(p.atenuacionMax)}`}
        detalle={`PR mínima ${textoPr(p.prMinima, p.roeMinima)}`}
      />
      {revision.marcados.length > 0 && (
        <div class="motivos">
          <ul>
            {revision.marcados.map((m) => (
              <li key={m.nombre} class={`motivo-${m.nivel}`}>
                {m.motivo}
              </li>
            ))}
          </ul>
          {revision.sugerencia && <p class="sugerencia">{revision.sugerencia}</p>}
          <Rotulo tipo="criterio-practico" />
          <Desplegable titulo="Cuenta del criterio">
            <Pasos pasos={revision.pasos} />
          </Desplegable>
        </div>
      )}
    </div>
  );
}
