import { useEffect } from 'preact/hooks';
import {
  type ElementoFiltro,
  type EntradaFiltro,
  type ResultadoFiltro,
  DONDE,
  calcularFiltro,
  topologiaSugerida,
} from '../../calculo/filtros/filtros';
import { mensajeDeResultados } from '../../entrada/campo';
import { formatearValor } from '../../entrada/formato';
import type { Escalera } from '../esquema';
import { BotonesSegmentados } from '../comun/BotonesSegmentados';
import {
  CampoEntradaValor,
  intercambiar,
  useCampoEntrada,
  useOpcionGuardada,
} from '../comun/CampoEntrada';
import { Esquema } from '../comun/Esquema';
import { Formula } from '../comun/Formula';
import { Aviso } from '../comun/Franjas';
import { Cita, FormaResultado, Pasos } from '../comun/Resultado';
import { Rotulo } from '../comun/Rotulo';
import { TarjetaResultado, ValorResultado } from '../comun/Tarjeta';
import {
  APROXIMACIONES,
  ATAJOS_RIPPLE,
  FC,
  ORDEN,
  Q_BOBINA,
  Q_BOBINA_POR_DEFECTO,
  RIPPLE,
  RIPPLE_POR_DEFECTO,
  RL,
  RS,
  R_POR_DEFECTO,
  TIPOS,
  TOPOLOGIAS,
  TOPOLOGIAS_GUARDADAS,
} from './campos';

// La Calculadora de filtros (spec §7): por ahora escaleras π y T pasa bajos y pasa altos,
// Butterworth y Chebyshev, con fuente y carga iguales. El resultado es el esquema con los valores en
// orden desde la fuente y la pérdida de Cohn.
export function Filtros() {
  const guardado = (campo: string) => ({ calculadora: 'filtros', campo });
  const [tipo, setTipo] = useOpcionGuardada(TIPOS, 'pasa-bajos', guardado('tipo'));
  const [aproximacion, setAproximacion] = useOpcionGuardada(
    APROXIMACIONES,
    'butterworth',
    guardado('aproximacion'),
  );
  const [elegida, setElegida] = useOpcionGuardada(
    TOPOLOGIAS_GUARDADAS,
    'sugerida',
    guardado('topologia'),
  );
  const ripple = useCampoEntrada(RIPPLE, RIPPLE_POR_DEFECTO, guardado('ripple'));
  const orden = useCampoEntrada(ORDEN, '', guardado('orden'));
  const fc = useCampoEntrada(FC, '', guardado('fc'));
  const rs = useCampoEntrada(RS, R_POR_DEFECTO, guardado('rs'));
  const rl = useCampoEntrada(RL, R_POR_DEFECTO, guardado('rl'));
  const qBobina = useCampoEntrada(Q_BOBINA, Q_BOBINA_POR_DEFECTO, guardado('q-bobina'));

  const esChebyshev = aproximacion === 'chebyshev';
  const campos = [...(esChebyshev ? [ripple] : []), orden, fc, rs, rl, qBobina];
  const mensaje = mensajeDeResultados(
    campos.map((c) => ({
      nombre: c.spec.nombre,
      obligatorio: !!c.spec.obligatorio,
      estado: c.estado,
    })),
  );
  const valor = (c: typeof fc) => (c.estado.estado === 'valido' ? c.estado.valor : null);
  const [vRipple, vOrden, vFc, vRs, vRl, vQ] = [ripple, orden, fc, rs, rl, qBobina].map(valor);

  // Mientras el Alumno no elija, la Topología es la que usa menos bobinas con el Orden escrito.
  const sugerida = topologiaSugerida(tipo, aproximacion, vOrden);
  const topologia = elegida === 'sugerida' ? sugerida.topologia : elegida;
  // Una elegida que coincide con la que usa menos bobinas vuelve a seguirla.
  useEffect(() => {
    if (elegida === sugerida.topologia) setElegida('sugerida');
  }, [elegida, sugerida.topologia]);

  const entrada: EntradaFiltro | null =
    mensaje === null &&
    vOrden !== null &&
    vFc !== null &&
    vRs !== null &&
    vRl !== null &&
    vQ !== null
      ? {
          tipo,
          aproximacion,
          ripple: esChebyshev ? vRipple : null,
          topologia,
          orden: vOrden,
          fc: vFc,
          rs: vRs,
          rl: vRl,
          qBobina: vQ,
        }
      : null;

  return (
    <div class="cuerpo-calculadora">
      <section class="entradas" aria-label="Entradas">
        <BotonesSegmentados
          etiqueta="Tipo de filtro"
          nombre="tipo-filtro"
          opciones={TIPOS}
          valor={tipo}
          onCambio={setTipo}
        />
        <BotonesSegmentados
          etiqueta="Aproximación"
          nombre="aproximacion-filtro"
          opciones={APROXIMACIONES}
          valor={aproximacion}
          onCambio={setAproximacion}
        />
        {esChebyshev && (
          <>
            <CampoEntradaValor id="ripple" etiqueta="Ripple" campo={ripple} unidadFija="dB" />
            <div class="fila-minima">
              <div class="atajos" role="group" aria-label="Ripple habitual">
                {ATAJOS_RIPPLE.map((r) => (
                  <button
                    key={r}
                    type="button"
                    class="boton-minima"
                    aria-pressed={ripple.texto === r}
                    onClick={() => ripple.setTexto(r)}
                  >
                    {r} dB
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <BotonesSegmentados
          etiqueta="Topología"
          nombre="topologia-filtro"
          opciones={TOPOLOGIAS}
          valor={topologia}
          onCambio={setElegida}
        />
        <p class="nota-campo">{sugerida.nota}</p>
        <CampoEntradaValor id="orden" etiqueta="Orden" campo={orden} />
        <CampoEntradaValor id="fc" etiqueta="fc" campo={fc} />
        <CampoEntradaValor id="rs" etiqueta="Rs (fuente)" campo={rs} />
        <div class="fila-intercambio">
          <button
            type="button"
            class="intercambiar"
            aria-label="Intercambiar Rs y RL"
            title="Intercambiar Rs y RL"
            onClick={() => intercambiar(rs, rl)}
          >
            <span aria-hidden="true">⇄</span>
          </button>
        </div>
        <CampoEntradaValor id="rl" etiqueta="RL (carga)" campo={rl} />
        <CampoEntradaValor id="q-bobina" etiqueta="Q de las bobinas (Qu)" campo={qBobina} />
      </section>
      <section class="resultados" aria-label="Resultados" aria-live="polite">
        {entrada ? (
          <Resultado resultado={calcularFiltro(entrada)} entrada={entrada} />
        ) : (
          <p class="sin-resultado corregir">{mensaje}</p>
        )}
      </section>
    </div>
  );
}

function escalera(elementos: readonly ElementoFiltro[]): Escalera {
  return {
    fuente: 'R_s',
    carga: 'R_L',
    elementos: elementos.map((e) => ({
      tipo: e.componente,
      posicion: e.posicion,
      nombre: e.nombre,
    })),
  };
}

function Resultado({ resultado, entrada }: { resultado: ResultadoFiltro; entrada: EntradaFiltro }) {
  if (resultado.estado === 'corte') {
    return (
      <FormaResultado
        avisos={<Aviso fuerte={resultado.codigo === 'entrada-invalida'}>{resultado.texto}</Aviso>}
        principal={null}
      />
    );
  }
  const r = resultado;
  const aproximacion =
    r.aproximacion === 'butterworth'
      ? 'Butterworth'
      : `Chebyshev de ${formatearValor(entrada.ripple!, 'decibeles')}`;
  // "Pasa bajos Butterworth de Orden 5 en π, fc = 100 MHz"
  const titulo =
    `${TIPOS.find((t) => t.valor === r.tipo)!.texto} ${aproximacion} de Orden ${r.orden} en ${r.topologia}, ` +
    `fc = ${formatearValor(entrada.fc, 'frecuencia')}`;
  const nivel = (e: ElementoFiltro) =>
    r.revision.marcados.find((m) => m.nombre === e.nombre)?.nivel;
  return (
    <FormaResultado
      avisos={r.avisos.map((a) => (
        <Aviso key={a.codigo}>{a.texto}</Aviso>
      ))}
      principal={
        <TarjetaResultado
          titulo={titulo}
          destacada
          pasos={<Pasos pasos={r.pasos} />}
          motivos={r.revision.marcados.map((m) => ({ nivel: m.nivel, texto: m.motivo }))}
          sugerencia={r.revision.sugerencia ?? undefined}
        >
          <Esquema escalera={escalera(r.elementos)} />
          {r.elementos.map((e) => {
            const marca = nivel(e);
            return (
              <ValorResultado
                key={e.nombre}
                nombre={e.nombre}
                valor={formatearValor(e.valor, e.componente === 'L' ? 'inductancia' : 'capacidad')}
                rotulos={marca && <Rotulo tipo={marca} />}
                detalle={
                  <>
                    g<sub>{e.k}</sub> = {formatearValor(e.g, 'numero', 'paso')}, {DONDE[e.posicion]}
                  </>
                }
              />
            );
          })}
          <ValorResultado
            nombre="Pérdida"
            valor={formatearValor(r.perdidaCohn, 'decibeles')}
            rotulos={<Rotulo tipo="estimacion" />}
            detalle={`de Cohn en la banda pasante, con Qu = ${formatearValor(entrada.qBobina, 'numero')}`}
          />
          <div class="formulas">
            {r.formulas.map((f) => (
              <Formula key={f} latex={f} />
            ))}
          </div>
          <Cita referencias={r.referencias} />
        </TarjetaResultado>
      }
      notas={r.notas}
    />
  );
}
