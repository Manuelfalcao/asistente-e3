import { useEffect } from 'preact/hooks';
import {
  type DatosDeOrden,
  type ElementoFiltro,
  type EntradaFiltro,
  type OrdenCalculado,
  type ResonadorFiltro,
  type ResultadoFiltro,
  DONDE,
  calcularFiltro,
  esDeBanda,
  ordenDesdeAtenuacion,
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
import { Desplegable, TarjetaResultado, ValorResultado } from '../comun/Tarjeta';
import {
  APROXIMACIONES,
  AS,
  ATAJOS_RIPPLE,
  BW,
  F0,
  F1,
  F2,
  FC,
  FS,
  MODOS_BANDA,
  MODOS_ORDEN,
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

// La Calculadora de filtros (spec §7): por ahora escaleras π y T de los cuatro Tipos de filtro,
// Butterworth, Chebyshev y Bessel, con fuente y carga iguales y el Orden escrito o calculado desde
// una atenuación. El resultado es el esquema con los valores en orden desde la fuente y la pérdida de
// Cohn.
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
  const [modoOrden, setModoOrden] = useOpcionGuardada(
    MODOS_ORDEN,
    'ingresar',
    guardado('modo-orden'),
  );
  const orden = useCampoEntrada(ORDEN, '', guardado('orden'));
  const atenuacion = useCampoEntrada(AS, '', guardado('as'));
  const fs = useCampoEntrada(FS, '', guardado('fs'));
  const fc = useCampoEntrada(FC, '', guardado('fc'));
  const [modoBanda, setModoBanda] = useOpcionGuardada(MODOS_BANDA, 'f1-f2', guardado('modo-banda'));
  const f1 = useCampoEntrada(F1, '', guardado('f1'));
  const f2 = useCampoEntrada(F2, '', guardado('f2'));
  const f0 = useCampoEntrada(F0, '', guardado('f0'));
  const bw = useCampoEntrada(BW, '', guardado('bw'));
  const rs = useCampoEntrada(RS, R_POR_DEFECTO, guardado('rs'));
  const rl = useCampoEntrada(RL, R_POR_DEFECTO, guardado('rl'));
  const qBobina = useCampoEntrada(Q_BOBINA, Q_BOBINA_POR_DEFECTO, guardado('q-bobina'));

  const esChebyshev = aproximacion === 'chebyshev';
  const deBanda = esDeBanda(tipo);
  // fc en pasa bajos y pasa altos; en pasa banda y rechaza banda, f1 y f2 o f0 y BW.
  const frecuencias = !deBanda ? [fc] : modoBanda === 'f1-f2' ? [f1, f2] : [f0, bw];
  const camposOrden = modoOrden === 'ingresar' ? [orden] : [atenuacion, fs];
  const campos = [
    ...(esChebyshev ? [ripple] : []),
    ...camposOrden,
    ...frecuencias,
    rs,
    rl,
    qBobina,
  ];
  const mensaje = mensajeDeResultados(
    campos.map((c) => ({
      nombre: c.spec.nombre,
      obligatorio: !!c.spec.obligatorio,
      estado: c.estado,
    })),
  );
  const valor = (c: typeof fc) => (c.estado.estado === 'valido' ? c.estado.valor : null);
  const [vRipple, vOrden, vFc, vRs, vRl, vQ, vAs, vFs] = [
    ripple,
    orden,
    fc,
    rs,
    rl,
    qBobina,
    atenuacion,
    fs,
  ].map(valor);
  const [vF1, vF2, vF0, vBw] = [f1, f2, f0, bw].map(valor);
  const banda =
    modoBanda === 'f1-f2'
      ? vF1 !== null && vF2 !== null
        ? { f1: vF1, f2: vF2 }
        : null
      : vF0 !== null && vBw !== null
        ? { f0: vF0, bw: vBw }
        : null;

  // El Orden pedido: el escrito, o la atenuación As a fs de la que se calcula.
  const pedidoOrden =
    modoOrden === 'ingresar' ? vOrden : vAs !== null && vFs !== null ? { as: vAs, fs: vFs } : null;

  // Con el Orden calculado, la Topología por defecto se elige con el que salió (si salió uno).
  const datosOrden: DatosDeOrden | null =
    mensaje !== null || (esChebyshev && vRipple === null)
      ? null
      : deBanda
        ? banda && { tipo, aproximacion, ripple: esChebyshev ? vRipple : null, banda }
        : vFc !== null
          ? { tipo, aproximacion, ripple: esChebyshev ? vRipple : null, fc: vFc }
          : null;
  const ordenCalculado =
    typeof pedidoOrden === 'object' && pedidoOrden !== null && datosOrden
      ? ordenDesdeAtenuacion(datosOrden, pedidoOrden)
      : null;
  const ordenParaTopologia =
    typeof pedidoOrden === 'number'
      ? pedidoOrden
      : ordenCalculado?.estado === 'calculado'
        ? ordenCalculado.orden
        : null;

  // Mientras el Alumno no elija, la Topología es la que usa menos bobinas con el Orden elegido.
  const sugerida = topologiaSugerida(tipo, aproximacion, ordenParaTopologia);
  const topologia = elegida === 'sugerida' ? sugerida.topologia : elegida;
  // Una elegida que coincide con la que usa menos bobinas vuelve a seguirla.
  useEffect(() => {
    if (elegida === sugerida.topologia) setElegida('sugerida');
  }, [elegida, sugerida.topologia]);

  const comun =
    mensaje === null && pedidoOrden !== null && vRs !== null && vRl !== null && vQ !== null
      ? {
          aproximacion,
          ripple: esChebyshev ? vRipple : null,
          topologia,
          orden: pedidoOrden,
          rs: vRs,
          rl: vRl,
          qBobina: vQ,
        }
      : null;
  let entrada: EntradaFiltro | null = null;
  if (comun) {
    if (esDeBanda(tipo)) {
      if (banda) entrada = { ...comun, tipo, banda };
    } else if (vFc !== null) {
      entrada = { ...comun, tipo, fc: vFc };
    }
  }

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
        <BotonesSegmentados
          etiqueta="Orden"
          nombre="modo-orden-filtro"
          opciones={MODOS_ORDEN}
          valor={modoOrden}
          onCambio={setModoOrden}
        />
        {modoOrden === 'ingresar' ? (
          <CampoEntradaValor id="orden" etiqueta="Orden" campo={orden} />
        ) : (
          <>
            <CampoEntradaValor id="as" etiqueta="As (atenuación mínima)" campo={atenuacion} />
            <CampoEntradaValor id="fs" etiqueta="fs (donde se pide)" campo={fs} />
          </>
        )}
        {!deBanda ? (
          <CampoEntradaValor id="fc" etiqueta="fc" campo={fc} />
        ) : (
          <>
            <BotonesSegmentados
              etiqueta="Frecuencias de la banda"
              nombre="modo-banda-filtro"
              opciones={MODOS_BANDA}
              valor={modoBanda}
              onCambio={setModoBanda}
            />
            {modoBanda === 'f1-f2' ? (
              <>
                <CampoEntradaValor id="f1" etiqueta="f1 (borde bajo)" campo={f1} />
                <CampoEntradaValor id="f2" etiqueta="f2 (borde alto)" campo={f2} />
              </>
            ) : (
              <>
                <CampoEntradaValor id="f0" etiqueta="f0 (central)" campo={f0} />
                <CampoEntradaValor id="bw" etiqueta="BW (ancho de banda)" campo={bw} />
              </>
            )}
          </>
        )}
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

// En pasa banda y rechaza banda cada g es un resonador LC, con los nombres de su L y su C.
function escalera(
  elementos: readonly ElementoFiltro[],
  resonadores: readonly ResonadorFiltro[],
): Escalera {
  return {
    fuente: 'R_s',
    carga: 'R_L',
    elementos:
      resonadores.length > 0
        ? resonadores.map((r) => ({
            tipo: 'LC',
            conexion: r.conexion,
            posicion: r.posicion,
            nombreL: r.l.nombre,
            nombreC: r.c.nombre,
          }))
        : elementos.map((e) => ({
            tipo: e.componente,
            posicion: e.posicion,
            nombre: e.nombre,
          })),
  };
}

const frecuencia = (f: number) => formatearValor(f, 'frecuencia');

// El final del título: "fc = 100 MHz" o "de 88 MHz a 108 MHz"
function bandaTexto(entrada: EntradaFiltro, r: ResultadoCalculado): string {
  if ('fc' in entrada) return `fc = ${frecuencia(entrada.fc)}`;
  return `de ${frecuencia(r.banda!.f1)} a ${frecuencia(r.banda!.f2)}`;
}

// El Orden calculado: la atenuación que da el Orden elegido en fs, contra la pedida (spec §7.9).
function AtenuacionReal({ orden }: { orden: OrdenCalculado }) {
  const real =
    orden.atenuacionReal === Infinity ? '∞' : formatearValor(orden.atenuacionReal, 'decibeles');
  return (
    <ValorResultado
      nombre={`A(${frecuencia(orden.fs)})`}
      valor={real}
      detalle={
        <>
          atenuación real en fs con Orden {orden.orden}; pediste al menos{' '}
          {formatearValor(orden.as, 'decibeles')}. Ω<sub>s</sub> = {omegaTexto(orden.omegaS)}
          {orden.nExacto !== null && <>, n ≥ {formatearValor(orden.nExacto, 'numero')}</>}
        </>
      }
    />
  );
}

const omegaTexto = (x: number) => (x === Infinity ? '∞' : formatearValor(x, 'numero'));

type ResultadoCalculado = Extract<ResultadoFiltro, { estado: 'calculado' }>;

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
    r.aproximacion === 'chebyshev'
      ? `Chebyshev de ${formatearValor(entrada.ripple!, 'decibeles')}`
      : r.aproximacion === 'bessel'
        ? 'Bessel'
        : 'Butterworth';
  // "Pasa bajos Butterworth de Orden 5 en π, fc = 100 MHz"
  const titulo =
    `${TIPOS.find((t) => t.valor === r.tipo)!.texto} ${aproximacion} de Orden ${r.orden} en ${r.topologia}, ` +
    bandaTexto(entrada, r);
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
          <Esquema escalera={escalera(r.elementos, r.resonadores)} />
          {r.banda && (
            <>
              <ValorResultado nombre="f1" valor={frecuencia(r.banda.f1)} detalle="borde bajo" />
              <ValorResultado nombre="f2" valor={frecuencia(r.banda.f2)} detalle="borde alto" />
              <ValorResultado
                nombre="f0"
                valor={frecuencia(r.banda.f0)}
                detalle={
                  <>
                    central geométrica √(f<sub>1</sub>·f<sub>2</sub>)
                  </>
                }
              />
              <ValorResultado
                nombre="BW"
                valor={frecuencia(r.banda.bw)}
                detalle={`ancho de banda; FBW = ${formatearValor(r.banda.fbw * 100, 'porcentaje')}`}
              />
            </>
          )}
          {r.ordenCalculado && <AtenuacionReal orden={r.ordenCalculado} />}
          {r.elementos.map((e) => {
            const marca = nivel(e);
            const resonador = r.resonadores.find((x) => x.l === e || x.c === e);
            return (
              <ValorResultado
                key={e.nombre}
                nombre={e.nombre}
                valor={formatearValor(e.valor, e.componente === 'L' ? 'inductancia' : 'capacidad')}
                rotulos={marca && <Rotulo tipo={marca} />}
                detalle={
                  <>
                    {resonador && (
                      <>
                        resonador {resonador.nombre}, LC {resonador.conexion},{' '}
                      </>
                    )}
                    g<sub>{e.k}</sub> = {formatearValor(e.g, 'numero', 'paso')}, {DONDE[e.posicion]}
                  </>
                }
              />
            );
          })}
          {r.retardoContinua !== null && (
            <ValorResultado
              nombre="τ0"
              valor={`${formatearValor(r.retardoContinua * 1e9, 'numero')} ns`}
              detalle="retardo de grupo en continua; sin curva de retardo"
            />
          )}
          {r.perdidaCohn !== null && (
            <ValorResultado
              nombre="Pérdida"
              valor={formatearValor(r.perdidaCohn, 'decibeles')}
              rotulos={<Rotulo tipo="estimacion" />}
              detalle={`de Cohn en la banda pasante, con Qu = ${formatearValor(entrada.qBobina, 'numero')}`}
            />
          )}
          {/* Cerradas, como los pasos: para no cargar la primera vista. */}
          <Desplegable titulo="Fórmulas">
            <div class="formulas">
              {r.formulas.map((f) => (
                <Formula key={f} latex={f} />
              ))}
            </div>
          </Desplegable>
          <Cita referencias={r.referencias} />
        </TarjetaResultado>
      }
      notas={r.notas}
    />
  );
}
