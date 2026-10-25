import type { ComponentChildren } from 'preact';
import {
  type BarridoVariante,
  type ComponenteRed,
  type EntradaRedL,
  type ResultadoRedL,
  type VarianteL,
  type VarianteRed,
  NOTAS_REDES,
  calcularRedL,
} from '../../calculo/redes/redes';
import {
  type ResultadoRedPiT,
  type TipoVariantePiT,
  type VariantePiT,
  calcularRedPiT,
  qMinimoDe,
} from '../../calculo/redes/redes-pi-t';
import { mensajeDeResultados } from '../../entrada/campo';
import { formatearValor } from '../../entrada/formato';
import type { Escalera } from '../esquema';
import type { IdCalculadora } from '../calculadoras';
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
  F0,
  Q_BOBINA,
  Q_BOBINA_POR_DEFECTO,
  Q_DISENO,
  RL,
  RS,
  RS_POR_DEFECTO,
  TOPOLOGIAS,
} from './campos';

// La Calculadora de redes de adaptación (spec §9): la red L, con el Q que fijan las dos
// resistencias, y la π y la T, con el Q de diseño que elige el Alumno. De cada una salen todas las
// variantes con solución, cada una con su esquema, sus valores y lo que hace fuera de f₀.
export function Redes({ onIr }: { onIr?: (id: IdCalculadora) => void }) {
  const guardado = (campo: string) => ({ calculadora: 'redes', campo });
  const [topologia, setTopologia] = useOpcionGuardada(TOPOLOGIAS, 'L', guardado('topologia'));
  const f0 = useCampoEntrada(F0, '', guardado('f0'));
  const rs = useCampoEntrada(RS, RS_POR_DEFECTO, guardado('rs'));
  const rl = useCampoEntrada(RL, '', guardado('rl'));
  const qDiseno = useCampoEntrada(Q_DISENO, '', guardado('q-diseno'));
  const qBobina = useCampoEntrada(Q_BOBINA, Q_BOBINA_POR_DEFECTO, guardado('q-bobina'));

  const esL = topologia === 'L';
  const campos = [f0, rs, rl, ...(esL ? [] : [qDiseno]), qBobina];
  const mensaje = mensajeDeResultados(
    campos.map((c) => ({
      nombre: c.spec.nombre,
      obligatorio: !!c.spec.obligatorio,
      estado: c.estado,
    })),
  );
  const valor = (c: typeof f0) => (c.estado.estado === 'valido' ? c.estado.valor : null);
  const [vf0, vrs, vrl, vqBobina] = [f0, rs, rl, qBobina].map(valor);
  const entrada: EntradaRedL | null =
    mensaje === null && vf0 !== null && vrs !== null && vrl !== null && vqBobina !== null
      ? { f0: vf0, rs: vrs, rl: vrl, qBobina: vqBobina }
      : null;
  // Con la fuente y la carga leídas, el Q mínimo se ve en el campo mientras se escribe el Q.
  const qMinimo = vrs !== null && vrl !== null ? qMinimoDe(vrs, vrl) : null;

  return (
    <div class="cuerpo-calculadora">
      <section class="entradas" aria-label="Entradas">
        <BotonesSegmentados
          etiqueta="Topología"
          nombre="topologia-redes"
          opciones={TOPOLOGIAS}
          valor={topologia}
          onCambio={setTopologia}
        />
        <CampoEntradaValor id="f0" etiqueta="f₀" campo={f0} />
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
        {!esL && (
          <CampoEntradaValor
            id="q-diseno"
            etiqueta="Q de diseño"
            campo={qDiseno}
            ayuda={
              qMinimo === null
                ? undefined
                : qMinimo === 0
                  ? 'Sin mínimo: Rs = RL'
                  : `Mínimo: ${formatearValor(qMinimo, 'numero')}`
            }
          />
        )}
        <CampoEntradaValor id="q-bobina" etiqueta="Q de la bobina" campo={qBobina} />
      </section>
      <section class="resultados" aria-label="Resultados" aria-live="polite">
        {!entrada ? (
          <p class="sin-resultado corregir">{mensaje}</p>
        ) : esL ? (
          <Resultado resultado={calcularRedL(entrada)} entrada={entrada} />
        ) : (
          <ResultadoPiT
            resultado={calcularRedPiT({
              ...entrada,
              topologia,
              q: valor(qDiseno),
            })}
            entrada={entrada}
            topologia={topologia}
            onUsarL={() => setTopologia('L')}
            onIr={onIr}
          />
        )}
      </section>
    </div>
  );
}

const ohms = (r: number) => formatearValor(r, 'resistencia');
const hz = (f: number) => formatearValor(f, 'frecuencia');
const db = (x: number) => formatearValor(x, 'decibeles');

// "Rs" y "RL" con el subíndice.
function R({ lado }: { lado: 'R_s' | 'R_L' }) {
  return (
    <>
      R<sub>{lado === 'R_s' ? 's' : 'L'}</sub>
    </>
  );
}

function Resultado({ resultado, entrada }: { resultado: ResultadoRedL; entrada: EntradaRedL }) {
  if (resultado.estado === 'corte') {
    return (
      <FormaResultado
        avisos={<Aviso fuerte={resultado.codigo === 'entrada-invalida'}>{resultado.texto}</Aviso>}
        principal={null}
        notas={NOTAS_REDES}
      />
    );
  }
  const titulo = `Red L de ${ohms(entrada.rs)} a ${ohms(entrada.rl)} en ${hz(entrada.f0)}`;
  // Las variantes van primero, por encima del Q: son lo que el Alumno vino a buscar.
  return (
    <FormaResultado
      principal={
        <div class="grilla-tarjetas">
          {resultado.variantes.map((v) => (
            <TarjetaVariante
              key={v.filtrado}
              titulo={TITULO_L[v.filtrado]}
              variante={v}
              q={<ValorResultado nombre="Q" valor={formatearValor(v.q, 'numero')} />}
            />
          ))}
        </div>
      }
      tarjetas={
        <TarjetaResultado titulo={titulo} destacada pasos={<Pasos pasos={resultado.pasos} />}>
          <ValorResultado
            nombre="Q"
            valor={formatearValor(resultado.q, 'numero')}
            detalle="Lo fijan Rs y RL: la red L no tiene otro"
          />
          <div class="formulas">
            <Formula latex={resultado.formula} />
          </div>
          <Cita referencias={resultado.referencias} />
        </TarjetaResultado>
      }
      notas={resultado.notas}
    />
  );
}

// "Calculadora de filtros" del texto, como enlace que abre esa Calculadora.
function TextoConEnlace({ texto, onIr }: { texto: string; onIr?: (id: IdCalculadora) => void }) {
  const enlace = 'Calculadora de filtros';
  const i = texto.indexOf(enlace);
  if (i < 0 || !onIr) return <>{texto}</>;
  return (
    <>
      {texto.slice(0, i)}
      <button type="button" class="enlace" onClick={() => onIr('filtros')}>
        {enlace}
      </button>
      {texto.slice(i + enlace.length)}
    </>
  );
}

function ResultadoPiT({
  resultado,
  entrada,
  topologia,
  onUsarL,
  onIr,
}: {
  resultado: ResultadoRedPiT;
  entrada: EntradaRedL;
  topologia: 'π' | 'T';
  onUsarL: () => void;
  onIr?: (id: IdCalculadora) => void;
}) {
  switch (resultado.estado) {
    case 'corte':
      // Sin Q, lo pide con el mínimo a la vista, como cualquier campo que falta.
      if (resultado.codigo === 'falta-q') {
        return <p class="sin-resultado corregir">{resultado.texto}</p>;
      }
      return (
        <FormaResultado
          avisos={
            <Aviso fuerte>
              {resultado.texto}
              {resultado.codigo === 'q-bajo' && (
                <>
                  {' '}
                  <button type="button" class="boton-minima en-aviso" onClick={onUsarL}>
                    Usar red L
                  </button>
                </>
              )}
            </Aviso>
          }
          principal={null}
          notas={NOTAS_REDES}
        />
      );
    case 'reducida-a-l':
      return (
        <>
          <Aviso>{resultado.texto}</Aviso>
          <Resultado resultado={resultado.redL} entrada={entrada} />
        </>
      );
    case 'calculado': {
      const titulo = `Red ${topologia} de ${ohms(entrada.rs)} a ${ohms(entrada.rl)} en ${hz(entrada.f0)}`;
      return (
        <FormaResultado
          avisos={resultado.avisos.map((a) => (
            <Aviso key={a.codigo}>
              <TextoConEnlace texto={a.texto} onIr={onIr} />
            </Aviso>
          ))}
          principal={
            <div class="grilla-tarjetas">
              {resultado.variantes.map((v) => (
                <TarjetaVariante
                  key={v.tipo}
                  titulo={TITULO_PI_T[v.tipo]}
                  variante={v}
                  q={
                    <>
                      {v.secciones.map((s, i) => (
                        <ValorResultado
                          key={s.lado}
                          nombre={
                            <>
                              Q<sub>{i + 1}</sub>
                            </>
                          }
                          valor={formatearValor(s.q, 'numero')}
                          detalle={
                            <>
                              sección del lado de <R lado={s.lado} />
                            </>
                          }
                        />
                      ))}
                      <ValorResultado
                        nombre={
                          <>
                            R<sub>v</sub>
                          </>
                        }
                        valor={ohms(resultado.resistenciaVirtual)}
                        detalle="Resistencia virtual"
                      />
                    </>
                  }
                />
              ))}
            </div>
          }
          tarjetas={
            <TarjetaResultado titulo={titulo} destacada pasos={<Pasos pasos={resultado.pasos} />}>
              <ValorResultado
                nombre="Q de diseño"
                valor={formatearValor(resultado.q, 'numero')}
                detalle={`Q mínimo: ${formatearValor(resultado.qMinimo, 'numero')}`}
              />
              <ValorResultado
                nombre={
                  <>
                    R<sub>v</sub>
                  </>
                }
                valor={ohms(resultado.resistenciaVirtual)}
                detalle="Resistencia virtual"
              />
              <div class="formulas">
                {resultado.formulas.map((f) => (
                  <Formula key={f} latex={f} />
                ))}
              </div>
              <Cita referencias={resultado.referencias} />
            </TarjetaResultado>
          }
          notas={resultado.notas}
        />
      );
    }
  }
}

const TITULO_L: Record<VarianteL['filtrado'], string> = {
  'pasa-bajos': 'Pasa bajos',
  'pasa-altos': 'Pasa altos',
};

const TITULO_PI_T: Record<TipoVariantePiT, string> = {
  'pasa-bajos': 'Pasa bajos',
  'pasa-altos': 'Pasa altos',
  'mixta-bajos-altos': 'Mixta: pasa bajos del lado de Rs, pasa altos del de RL',
  'mixta-altos-bajos': 'Mixta: pasa altos del lado de Rs, pasa bajos del de RL',
};

function escalera(v: VarianteRed): Escalera {
  return {
    fuente: 'R_s',
    carga: 'R_L',
    elementos: v.componentes.map((c) => ({
      tipo: c.componente,
      posicion: c.posicion,
      nombre: c.nombre,
    })),
  };
}

// La tarjeta de una variante, igual para la L, la π y la T: cambian el título y las filas de Q.
function TarjetaVariante({
  titulo,
  variante: v,
  q,
}: {
  titulo: string;
  variante: VarianteL | VariantePiT;
  q: ComponentChildren;
}) {
  const { revision } = v;
  const nivel = (c: ComponenteRed) => revision.marcados.find((m) => m.nombre === c.nombre)?.nivel;
  return (
    <TarjetaResultado
      titulo={titulo}
      pasos={<Pasos pasos={v.pasos} />}
      motivos={revision.marcados.map((m) => ({ nivel: m.nivel, texto: m.motivo }))}
      sugerencia={revision.sugerencia ?? undefined}
    >
      <Esquema escalera={escalera(v)} />
      <ul class="etiquetas-bowick" aria-label="Para qué sirve">
        {v.etiquetas.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
      {v.componentes.map((c) => {
        const marca = nivel(c);
        return (
          <ValorResultado
            key={c.nombre}
            nombre={c.nombre}
            valor={formatearValor(c.valor, c.componente === 'L' ? 'inductancia' : 'capacidad')}
            rotulos={marca && <Rotulo tipo={marca} />}
            detalle={
              <>
                X = {formatearValor(c.reactancia, 'resistencia')},{' '}
                {c.posicion === 'serie' ? 'en serie' : 'en derivación'},{' '}
                {c.lado ? (
                  <>
                    del lado de <R lado={c.lado} />
                  </>
                ) : (
                  'entre las dos secciones'
                )}
              </>
            }
          />
        );
      })}
      {q}
      {/* Cerrados, como los pasos: para no cargar la primera vista. */}
      <Desplegable titulo="Fuera de f₀">
        <Barrido barrido={v.barrido} />
      </Desplegable>
      <Desplegable titulo="Fórmulas">
        <div class="formulas">
          {v.formulas.map((f) => (
            <Formula key={f} latex={f} />
          ))}
        </div>
      </Desplegable>
    </TarjetaResultado>
  );
}

// Lo que hace la variante fuera de f₀ (spec §9.5), sin curva.
function Barrido({ barrido: b }: { barrido: BarridoVariante }) {
  return (
    <>
      <ValorResultado
        nombre={
          <>
            f<sub>inf</sub>
          </>
        }
        valor={b.fInf === null ? 'sin borde inferior' : hz(b.fInf)}
        detalle="a −3 dB"
      />
      <ValorResultado
        nombre={
          <>
            f<sub>sup</sub>
          </>
        }
        valor={b.fSup === null ? 'sin borde superior' : hz(b.fSup)}
        detalle="a −3 dB"
      />
      {b.bw !== null && b.f0SobreBw !== null && (
        <>
          <ValorResultado nombre="BW" valor={hz(b.bw)} />
          <ValorResultado nombre="f₀/BW" valor={formatearValor(b.f0SobreBw, 'numero')} />
        </>
      )}
      <ValorResultado nombre="2f₀" valor={db(b.atenuacion2f0)} detalle="de atenuación" />
      <ValorResultado nombre="3f₀" valor={db(b.atenuacion3f0)} detalle="de atenuación" />
      <ValorResultado
        nombre="IL"
        valor={db(b.perdidaInsercion)}
        rotulos={<Rotulo tipo="estimacion" />}
        detalle="pérdida de inserción en f₀, con el Q de la bobina"
      />
    </>
  );
}
