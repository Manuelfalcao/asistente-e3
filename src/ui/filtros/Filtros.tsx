import { useEffect } from 'preact/hooks';
import {
  type Banda,
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
  relacionDe,
  topologiaSugerida,
} from '../../calculo/filtros/filtros';
import { type EntradaResonadores, calcularResonadores } from '../../calculo/filtros/resonadores';
import { mensajeDeResultados } from '../../entrada/campo';
import { formatearValor } from '../../entrada/formato';
import type { Escalera } from '../esquema';
import { BotonesSegmentados } from '../comun/BotonesSegmentados';
import { BotonPaseDe } from '../comun/BotonPase';
import {
  CampoEntradaValor,
  intercambiar,
  useCampoEntrada,
  useOpcionGuardada,
} from '../comun/CampoEntrada';
import { Esquema } from '../comun/Esquema';
import { Aviso } from '../comun/Franjas';
import { FormaResultado, FormulasYFuentes, Pasos } from '../comun/Resultado';
import { Rotulo } from '../comun/Rotulo';
import { Desplegable, TarjetaResultado, ValorResultado } from '../comun/Tarjeta';
import type { Pase } from '../pases';
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
  L_RESONADORES,
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
  TOPOLOGIAS_PASA_BANDA,
} from './campos';
import { ResultadoAcoplados, ayudaDeL } from './Acoplados';
import { paseDePerdidaPlana, pasesDelFiltro } from './pases';

// La Calculadora de filtros (spec §7): escaleras π y T de los cuatro Tipos de filtro y, en pasa
// banda, resonadores acoplados. Butterworth, Chebyshev y Bessel, con el Orden escrito o calculado
// desde una atenuación, y con Rs ≠ RL por Takahasi (Bessel no). El resultado es el esquema con los
// valores en orden desde la fuente y la pérdida de Cohn. Cada L y C se pasa a Bobinas o a Arreglos
// equivalentes, y el aviso de pérdida plana a redes de adaptación (spec §5.5).
export function Filtros({ onPasar }: { onPasar?: (pase: Pase) => void }) {
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
  const lResonadores = useCampoEntrada(L_RESONADORES, '', guardado('l-resonadores'));

  const esChebyshev = aproximacion === 'chebyshev';
  const deBanda = esDeBanda(tipo);
  // Los resonadores acoplados solo existen en pasa banda (spec §7.7); en los otros Tipos de filtro
  // la elección guardada no cuenta y vale la sugerida.
  const acoplados = tipo === 'pasa-banda' && elegida === 'resonadores';
  // fc en pasa bajos y pasa altos; en pasa banda y rechaza banda, f1 y f2 o f0 y BW.
  const frecuencias = !deBanda ? [fc] : modoBanda === 'f1-f2' ? [f1, f2] : [f0, bw];
  const ingresaOrden = modoOrden === 'ingresar';
  const camposOrden = ingresaOrden ? [orden] : [atenuacion, fs];
  const campos = [
    ...(esChebyshev ? [ripple] : []),
    ...camposOrden,
    ...frecuencias,
    rs,
    rl,
    qBobina,
    ...(acoplados ? [lResonadores] : []),
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
  const pedidoOrden = ingresaOrden
    ? vOrden
    : vAs !== null && vFs !== null
      ? { as: vAs, fs: vFs }
      : null;

  // Con el Orden calculado, la Topología por defecto se elige con el que salió (si salió uno).
  const datosOrden: DatosDeOrden | null =
    mensaje !== null || (esChebyshev && vRipple === null)
      ? null
      : deBanda
        ? banda && { tipo, aproximacion, ripple: esChebyshev ? vRipple : null, banda }
        : vFc !== null
          ? { tipo, aproximacion, ripple: esChebyshev ? vRipple : null, fc: vFc }
          : null;
  // Con Rs ≠ RL, Chebyshev par se arma si r ≥ r_min: el Orden y la Topología dependen de r.
  const terminaciones =
    vRs !== null && vRl !== null
      ? { ripple: esChebyshev ? vRipple : null, rs: vRs, rl: vRl }
      : undefined;
  const ordenCalculado =
    typeof pedidoOrden === 'object' && pedidoOrden !== null && datosOrden && terminaciones
      ? ordenDesdeAtenuacion(
          datosOrden,
          pedidoOrden,
          relacionDe(terminaciones.rs, terminaciones.rl),
        )
      : null;
  const ordenParaTopologia =
    typeof pedidoOrden === 'number'
      ? pedidoOrden
      : ordenCalculado?.estado === 'calculado'
        ? ordenCalculado.orden
        : null;

  // Mientras el Alumno no elija, la Topología es la que usa menos bobinas con el Orden elegido.
  const sugerida = topologiaSugerida(tipo, aproximacion, ordenParaTopologia, terminaciones);
  const topologia =
    elegida === 'sugerida' || elegida === 'resonadores' ? sugerida.topologia : elegida;
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
  const entradaAcoplada: EntradaResonadores | null =
    acoplados && comun && banda
      ? {
          aproximacion,
          ripple: comun.ripple,
          orden: comun.orden,
          banda,
          rs: comun.rs,
          rl: comun.rl,
          qBobina: comun.qBobina,
          inductancia: valor(lResonadores),
        }
      : null;
  const acoplado = entradaAcoplada && calcularResonadores(entradaAcoplada);
  const ventana = acoplado && 'ventana' in acoplado ? acoplado.ventana : undefined;

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
          opciones={tipo === 'pasa-banda' ? TOPOLOGIAS_PASA_BANDA : TOPOLOGIAS}
          valor={acoplados ? 'resonadores' : topologia}
          onCambio={setElegida}
        />
        <p class="nota-campo">{acoplados ? NOTA_ACOPLADOS : sugerida.nota}</p>
        <BotonesSegmentados
          etiqueta="Orden"
          nombre="modo-orden-filtro"
          opciones={MODOS_ORDEN}
          valor={modoOrden}
          onCambio={setModoOrden}
        />
        {ingresaOrden ? (
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
        {acoplados && (
          <CampoEntradaValor
            id="l-resonadores"
            etiqueta="L de los resonadores"
            campo={lResonadores}
            ayuda={ventana ? ayudaDeL(ventana) : 'Vacío: la que propone el Asistente.'}
          />
        )}
      </section>
      <section class="resultados" aria-label="Resultados" aria-live="polite">
        {acoplados ? (
          acoplado ? (
            <ResultadoAcoplados
              resultado={acoplado}
              ripple={esChebyshev ? vRipple : null}
              qBobina={vQ!}
              onPasar={onPasar}
            />
          ) : (
            <p class="sin-resultado corregir">{mensaje}</p>
          )
        ) : entrada ? (
          <Resultado
            resultado={calcularFiltro(entrada)}
            entrada={entrada}
            onButterworth={() => setAproximacion('butterworth')}
            onResonadores={() => setElegida('resonadores')}
            onPasar={onPasar}
          />
        ) : (
          <p class="sin-resultado corregir">{mensaje}</p>
        )}
      </section>
    </div>
  );
}

const NOTA_ACOPLADOS =
  'Resonadores LC en derivación, todos con la misma L, unidos por Capacitores de acople: este ' +
  'filtro sí adapta Rs y RL.';

// El botón de las sugerencias de resonadores acoplados (spec §7.4 y §7.7).
function BotonResonadores({ onClick }: { onClick: () => void }) {
  return (
    <>
      {' '}
      <button type="button" class="boton-minima en-aviso" onClick={onClick}>
        Pasar a resonadores acoplados
      </button>
    </>
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

// f1, f2, f0 y BW de pasa banda y rechaza banda, cerradas debajo de los componentes: se ingresaron
// o salen de lo ingresado.
function FrecuenciasDeLaBanda({ banda }: { banda: Banda }) {
  return (
    <>
      <ValorResultado nombre="f1" valor={frecuencia(banda.f1)} detalle="borde bajo" />
      <ValorResultado nombre="f2" valor={frecuencia(banda.f2)} detalle="borde alto" />
      <ValorResultado
        nombre="f0"
        valor={frecuencia(banda.f0)}
        detalle={
          <>
            central geométrica √(f<sub>1</sub>·f<sub>2</sub>)
          </>
        }
      />
      <ValorResultado
        nombre="BW"
        valor={frecuencia(banda.bw)}
        detalle={`ancho de banda; FBW = ${formatearValor(banda.fbw * 100, 'porcentaje')}`}
      />
    </>
  );
}

const omegaTexto = (x: number) => (x === Infinity ? '∞' : formatearValor(x, 'numero'));

type ResultadoCalculado = Extract<ResultadoFiltro, { estado: 'calculado' }>;

function Resultado({
  resultado,
  entrada,
  onButterworth,
  onResonadores,
  onPasar,
}: {
  resultado: ResultadoFiltro;
  entrada: EntradaFiltro;
  // Bessel con Rs ≠ RL ofrece pasar a Butterworth (spec §7.4).
  onButterworth: () => void;
  // En pasa banda, a resonadores acoplados (spec §7.4 y §7.7).
  onResonadores: () => void;
  onPasar?: (pase: Pase) => void;
}) {
  if (resultado.estado === 'corte') {
    return (
      <FormaResultado
        avisos={
          <Aviso fuerte={resultado.codigo === 'entrada-invalida'}>
            {resultado.texto}
            {resultado.codigo === 'bessel-terminaciones-distintas' && (
              <>
                {' '}
                <button type="button" class="boton-minima en-aviso" onClick={onButterworth}>
                  Pasar a Butterworth
                </button>
              </>
            )}
            {resultado.sugerenciaResonadores && <BotonResonadores onClick={onResonadores} />}
          </Aviso>
        }
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
  const pases = pasesDelFiltro(r);
  return (
    <FormaResultado
      avisos={[
        ...r.avisos.map((a) => (
          <Aviso key={a.codigo}>
            {a.texto}
            {a.codigo === 'perdida-plana' && onPasar && (
              <>
                {' '}
                <button
                  type="button"
                  class="boton-minima en-aviso"
                  onClick={() => onPasar(paseDePerdidaPlana(entrada, r))}
                >
                  Pasar a redes de adaptación
                </button>
              </>
            )}
            {a.codigo === 'perdida-plana' &&
              r.sugerenciaResonadores?.motivo === 'perdida-plana' && (
                <BotonResonadores onClick={onResonadores} />
              )}
          </Aviso>
        )),
        ...(r.sugerenciaResonadores?.motivo === 'banda-angosta'
          ? [
              <Aviso key="resonadores">
                {r.sugerenciaResonadores.texto}
                <BotonResonadores onClick={onResonadores} />
              </Aviso>,
            ]
          : []),
      ]}
      principal={
        <TarjetaResultado
          titulo={titulo}
          destacada
          desplegables={
            r.banda && (
              <Desplegable titulo="Frecuencias de la banda">
                <FrecuenciasDeLaBanda banda={r.banda} />
              </Desplegable>
            )
          }
          formulas={<FormulasYFuentes formulas={r.formulas} referencias={r.referencias} />}
          pasos={<Pasos pasos={r.pasos} />}
          motivos={r.revision.marcados.map((m) => ({ nivel: m.nivel, texto: m.motivo }))}
          sugerencia={r.revision.sugerencia ?? undefined}
        >
          <Esquema escalera={escalera(r.elementos, r.resonadores)} />
          {r.ordenCalculado && <AtenuacionReal orden={r.ordenCalculado} />}
          {r.elementos.map((e, i) => {
            const marca = nivel(e);
            const resonador = r.resonadores.find((x) => x.l === e || x.c === e);
            return (
              <ValorResultado
                key={e.nombre}
                nombre={e.nombre}
                valor={formatearValor(e.valor, e.componente === 'L' ? 'inductancia' : 'capacidad')}
                rotulos={marca && <Rotulo tipo={marca} />}
                pase={<BotonPaseDe pase={pases[i]} onPasar={onPasar} />}
                detalle={
                  <>
                    {resonador && (
                      <>
                        resonador {resonador.nombre}, LC {resonador.conexion},{' '}
                      </>
                    )}
                    g<sub>{e.indiceG}</sub> = {formatearValor(e.g, 'numero', 'paso')},{' '}
                    {DONDE[e.posicion]}
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
        </TarjetaResultado>
      }
      notas={r.notas}
    />
  );
}
