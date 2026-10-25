import {
  type BarridoVariante,
  type ComponenteRed,
  type EntradaRedL,
  type ResultadoRedL,
  type VarianteL,
  NOTAS_REDES,
  calcularRedL,
} from '../../calculo/redes/redes';
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
import { F0, Q_BOBINA, Q_BOBINA_POR_DEFECTO, RL, RS, RS_POR_DEFECTO, TOPOLOGIAS } from './campos';

// La Calculadora de redes de adaptación (spec §9). Por ahora la red L: el Q que fijan las dos
// resistencias y las dos variantes, pasa bajos y pasa altos, cada una con su esquema, sus valores
// y lo que hace fuera de f₀.
export function Redes() {
  const guardado = (campo: string) => ({ calculadora: 'redes', campo });
  const [topologia, setTopologia] = useOpcionGuardada(TOPOLOGIAS, 'L', guardado('topologia'));
  const f0 = useCampoEntrada(F0, '', guardado('f0'));
  const rs = useCampoEntrada(RS, RS_POR_DEFECTO, guardado('rs'));
  const rl = useCampoEntrada(RL, '', guardado('rl'));
  const qBobina = useCampoEntrada(Q_BOBINA, Q_BOBINA_POR_DEFECTO, guardado('q-bobina'));

  const campos = [f0, rs, rl, qBobina];
  const mensaje = mensajeDeResultados(
    campos.map((c) => ({
      nombre: c.spec.nombre,
      obligatorio: !!c.spec.obligatorio,
      estado: c.estado,
    })),
  );
  const valores = campos.map((c) => (c.estado.estado === 'valido' ? c.estado.valor : null));
  const entrada: EntradaRedL | null =
    mensaje === null && valores.every((v) => v !== null)
      ? { f0: valores[0]!, rs: valores[1]!, rl: valores[2]!, qBobina: valores[3]! }
      : null;

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
        <CampoEntradaValor id="q-bobina" etiqueta="Q de la bobina" campo={qBobina} />
      </section>
      <section class="resultados" aria-label="Resultados" aria-live="polite">
        {topologia !== 'L' ? (
          <p class="sin-resultado">
            Las redes π y T todavía no están en esta Versión. Por ahora, usá la red L.
          </p>
        ) : entrada ? (
          <Resultado resultado={calcularRedL(entrada)} entrada={entrada} />
        ) : (
          <p class="sin-resultado corregir">{mensaje}</p>
        )}
      </section>
    </div>
  );
}

const ohms = (r: number) => formatearValor(r, 'resistencia');
const hz = (f: number) => formatearValor(f, 'frecuencia');
const db = (x: number) => formatearValor(x, 'decibeles');

// "Rs" y "RL" con el subíndice.
function R({ lado }: { lado: ComponenteRed['lado'] }) {
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
  return (
    <FormaResultado
      principal={
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
      tarjetas={
        <div class="grilla-tarjetas">
          {resultado.variantes.map((v) => (
            <TarjetaVariante key={v.filtrado} variante={v} />
          ))}
        </div>
      }
      notas={resultado.notas}
    />
  );
}

const TITULO: Record<VarianteL['filtrado'], string> = {
  'pasa-bajos': 'Pasa bajos',
  'pasa-altos': 'Pasa altos',
};

function escalera(v: VarianteL): Escalera {
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

function TarjetaVariante({ variante: v }: { variante: VarianteL }) {
  const { revision } = v;
  const nivel = (c: ComponenteRed) => revision.marcados.find((m) => m.nombre === c.nombre)?.nivel;
  return (
    <TarjetaResultado
      titulo={TITULO[v.filtrado]}
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
                {c.posicion === 'serie' ? 'en serie' : 'en derivación'}, del lado de{' '}
                <R lado={c.lado} />
              </>
            }
          />
        );
      })}
      <ValorResultado nombre="Q" valor={formatearValor(v.q, 'numero')} />
      <Barrido barrido={v.barrido} />
      <div class="formulas">
        {v.formulas.map((f) => (
          <Formula key={f} latex={f} />
        ))}
      </div>
    </TarjetaResultado>
  );
}

// Lo que hace la variante fuera de f₀ (spec §9.5), sin curva.
function Barrido({ barrido: b }: { barrido: BarridoVariante }) {
  return (
    <div class="barrido">
      <h4 class="barrido-titulo">Fuera de f₀</h4>
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
    </div>
  );
}
