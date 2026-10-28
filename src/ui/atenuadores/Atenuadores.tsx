import { useEffect } from 'preact/hooks';
import {
  type Atenuador,
  type EntradaAtenuador,
  type EntradaMinimaPerdida,
  type PadMinimaPerdida,
  type PotenciaRed,
  type Resistencia,
  type ResultadoAtenuadores,
  NOTAS_ATENUADORES,
  atenuacionMinima,
  calcularAtenuadores,
  calcularMinimaPerdida,
} from '../../calculo/atenuadores/atenuadores';
import type { Revision } from '../../calculo/comun/valor-impracticable';
import { mensajeDeResultados } from '../../entrada/campo';
import { formatearDbm, formatearValor, vatiosADbm } from '../../entrada/formato';
import type { Escalera } from '../esquema';
import {
  CampoEntradaValor,
  type CampoEntrada,
  intercambiar,
  useCampoEntrada,
} from '../comun/CampoEntrada';
import { BotonPaseDe } from '../comun/BotonPase';
import { Esquema } from '../comun/Esquema';
import { Formula } from '../comun/Formula';
import { Aviso } from '../comun/Franjas';
import { FormaResultado, FormulasYFuentes, Pasos } from '../comun/Resultado';
import { Rotulo } from '../comun/Rotulo';
import { useEstadoDeSesion } from '../comun/sesion';
import { TarjetaResultado, ValorResultado } from '../comun/Tarjeta';
import { type Pase, type PaseDeValor, paseDeComponente } from '../pases';
import { ATENUACION, FRECUENCIA, POTENCIA, Z1, Z2, Z_POR_DEFECTO } from './campos';

// La Calculadora de atenuadores (spec §10): el T y el π juntos, cada uno con su esquema, sus
// resistencias y, en desplegables, sus fórmulas con la referencia y los pasos intermedios. Los
// Valores comerciales salen de pasar cada resistencia a Arreglos equivalentes.
export function Atenuadores({ onPasar }: { onPasar?: (pase: Pase) => void }) {
  const guardado = (campo: string) => ({ calculadora: 'atenuadores', campo });
  const a = useCampoEntrada(ATENUACION, '', guardado('atenuacion'));
  const z1 = useCampoEntrada(Z1, Z_POR_DEFECTO, guardado('z1'));
  const z2 = useCampoEntrada(Z2, Z_POR_DEFECTO, guardado('z2'));
  const potencia = useCampoEntrada(POTENCIA, '', guardado('potencia'));
  const frecuencia = useCampoEntrada(FRECUENCIA, '', guardado('frecuencia'));
  // El botón "Mínima pérdida" (spec §10.1): fija la atenuación en A_min y muestra la red L.
  // Se recuerda en la sesión para que, al volver de un pase, siga el pad de mínima pérdida.
  const [minima, setMinima] = useEstadoDeSesion('atenuadores:minima', false);

  const impedancias =
    z1.estado.estado === 'valido' && z2.estado.estado === 'valido'
      ? { z1: z1.estado.valor, z2: z2.estado.valor }
      : null;
  // Con Z1 = Z2 no hay pad: la atenuación mínima es 0 dB.
  const hayPad = impedancias !== null && impedancias.z1 !== impedancias.z2;
  const modoMinima = minima && hayPad;
  const aMin = hayPad ? atenuacionMinima(impedancias.z1, impedancias.z2).aMin : null;
  const textoAMin = aMin === null ? null : formatearValor(aMin, 'decibeles');

  // Con la mínima pérdida activa, el campo de atenuación muestra A_min y sigue a Z1 y Z2.
  useEffect(() => {
    if (minima && impedancias && !hayPad) setMinima(false);
    else if (modoMinima && textoAMin !== null && a.texto !== textoAMin) a.setTexto(textoAMin);
  }, [minima, textoAMin, a.texto, hayPad]);

  const paraMensaje = (campos: CampoEntrada[]) =>
    mensajeDeResultados(
      campos.map((c) => ({
        nombre: c.spec.nombre,
        obligatorio: !!c.spec.obligatorio,
        estado: c.estado,
      })),
    );
  const mensaje = paraMensaje(
    [a, z1, z2, potencia, frecuencia].filter((c) => !(modoMinima && c === a)),
  );

  const comunes = {
    frecuencia: frecuencia.estado.estado === 'valido' ? frecuencia.estado.valor : null,
    potencia: potencia.estado.estado === 'valido' ? potencia.estado.valor : null,
  };
  const entrada: EntradaAtenuador | null =
    mensaje === null && a.estado.estado === 'valido' && impedancias
      ? { atenuacion: a.estado.valor, ...impedancias, ...comunes }
      : null;
  const entradaMinima: EntradaMinimaPerdida | null =
    mensaje === null && modoMinima && impedancias ? { ...impedancias, ...comunes } : null;
  // Si el Alumno escribe la atenuación, deja la mínima pérdida.
  const campoAtenuacion: CampoEntrada = {
    ...a,
    setTexto: (texto) => {
      setMinima(false);
      a.setTexto(texto);
    },
  };

  return (
    <div class="cuerpo-calculadora">
      <section class="entradas" aria-label="Entradas">
        <CampoEntradaValor
          id="atenuacion"
          etiqueta="Atenuación A"
          campo={campoAtenuacion}
          unidadFija="dB"
        />
        <CampoEntradaValor id="z1" etiqueta="Z1 (fuente)" campo={z1} />
        <div class="fila-intercambio">
          <button
            type="button"
            class="intercambiar"
            aria-label="Intercambiar Z1 y Z2"
            title="Intercambiar Z1 y Z2"
            onClick={() => intercambiar(z1, z2)}
          >
            <span aria-hidden="true">⇄</span>
          </button>
        </div>
        <CampoEntradaValor id="z2" etiqueta="Z2 (carga)" campo={z2} />
        {hayPad && (
          <div class="fila-minima">
            <button
              type="button"
              class="boton-minima"
              aria-pressed={modoMinima}
              onClick={() => setMinima(!modoMinima)}
            >
              Mínima pérdida
            </button>
          </div>
        )}
        <CampoEntradaValor
          id="potencia"
          etiqueta="Potencia de entrada (opcional)"
          campo={potencia}
        />
        <CampoEntradaValor id="frecuencia" etiqueta="Frecuencia (opcional)" campo={frecuencia} />
      </section>
      <section class="resultados" aria-label="Resultados" aria-live="polite">
        {entradaMinima ? (
          <ResultadoMinima entrada={entradaMinima} onPasar={onPasar} />
        ) : entrada ? (
          <Resultado
            resultado={calcularAtenuadores(entrada)}
            entrada={entrada}
            onMinima={() => setMinima(true)}
            onPasar={onPasar}
          />
        ) : (
          <p class="sin-resultado corregir">{mensaje}</p>
        )}
      </section>
    </div>
  );
}

function Resultado({
  resultado,
  entrada,
  onMinima,
  onPasar,
}: {
  resultado: ResultadoAtenuadores;
  entrada: EntradaAtenuador;
  onMinima: () => void;
  onPasar?: (pase: Pase) => void;
}) {
  if (resultado.estado === 'corte') {
    return (
      <FormaResultado
        avisos={
          <Aviso fuerte>
            <p>{resultado.texto}</p>
            {resultado.pasos.map((p) => (
              <Formula key={p.latex} latex={p.latex} />
            ))}
            {resultado.codigo === 'debajo-de-a-min' && (
              <button type="button" class="boton-minima en-aviso" onClick={onMinima}>
                Usar el pad de mínima pérdida
              </button>
            )}
          </Aviso>
        }
        principal={null}
        notas={NOTAS_ATENUADORES}
      />
    );
  }
  // "10 dB, de 50 Ω a 75 Ω"
  const titulo =
    `${formatearValor(entrada.atenuacion, 'decibeles')}, ` +
    `de ${ohms(entrada.z1)} a ${ohms(entrada.z2)}`;
  return (
    <FormaResultado
      avisos={resultado.avisos.map((a) => (
        <Aviso key={a.codigo}>{a.texto}</Aviso>
      ))}
      principal={
        <div class="grilla-tarjetas">
          {[resultado.t, resultado.pi].map((red) => (
            <TarjetaAtenuador
              key={red.topologia}
              red={red}
              titulo={`Atenuador ${red.topologia} de ${titulo}`}
              resultado={resultado}
              onPasar={onPasar}
            />
          ))}
        </div>
      }
      notas={resultado.notas}
    />
  );
}

// Al pasar una resistencia a Arreglos equivalentes (spec §5.5).
const NOTA_POTENCIA = 'En un Arreglo equivalente la potencia se reparte entre los componentes.';

function paseDeResistencia(r: Resistencia, revision: Revision): PaseDeValor {
  return paseDeComponente('atenuadores', r, revision.marcados, { nota: NOTA_POTENCIA });
}

const ohms = (r: number) => formatearValor(r, 'resistencia');

function escalera(red: Atenuador): Escalera {
  const elementos = (['r1', 'r3', 'r2'] as const).map((clave) => ({
    tipo: 'R' as const,
    posicion: red[clave].posicion,
    nombre: red[clave].nombre,
  }));
  return { fuente: 'Z_1', carga: 'Z_2', elementos };
}

function donde(r: Resistencia): string {
  const posicion = r.posicion === 'serie' ? 'En serie' : 'En derivación';
  return r.lado ? `${posicion}, del lado de ${r.lado}` : posicion;
}

function TarjetaAtenuador({
  red,
  titulo,
  resultado,
  onPasar,
}: {
  red: Atenuador;
  titulo: string;
  resultado: Extract<ResultadoAtenuadores, { estado: 'calculado' }>;
  onPasar?: (pase: Pase) => void;
}) {
  const { revision } = red;
  const nivel = (clave: 'r1' | 'r2' | 'r3') =>
    revision.marcados.find((m) => m.nombre === red[clave].nombre)?.nivel;
  return (
    <TarjetaResultado
      titulo={titulo}
      destacada
      formulas={<FormulasYFuentes formulas={red.formulas} referencias={resultado.referencias} />}
      pasos={<Pasos pasos={red.pasos} />}
      motivos={revision.marcados.map((m) => ({ nivel: m.nivel, texto: m.motivo }))}
      sugerencia={revision.sugerencia ?? undefined}
    >
      <Esquema escalera={escalera(red)} />
      {(['r1', 'r2', 'r3'] as const).map((clave) => {
        const marca = nivel(clave);
        return (
          <ValorResultado
            key={clave}
            nombre={red[clave].nombre}
            valor={ohms(red[clave].valor)}
            rotulos={marca && <Rotulo tipo={marca} />}
            detalle={donde(red[clave])}
            pase={<BotonPaseDe pase={paseDeResistencia(red[clave], revision)} onPasar={onPasar} />}
          />
        );
      })}
      {red.potencia && <Potencia potencia={red.potencia} />}
    </TarjetaResultado>
  );
}

// La potencia que disipa cada resistencia y la nominal mínima que conviene (spec §10.3).
function Potencia({ potencia }: { potencia: PotenciaRed }) {
  const w = (x: number) => formatearValor(x, 'potencia');
  return (
    <div class="potencia">
      <h4 class="potencia-titulo">
        Potencia con {w(potencia.entrada)} ({formatearDbm(vatiosADbm(potencia.entrada))}) de entrada
      </h4>
      {potencia.resistencias.map((x) => (
        <ValorResultado
          key={x.nombre}
          nombre={x.nombre}
          valor={w(x.disipada)}
          rotulos={<Rotulo tipo="criterio-diseno" />}
          detalle={`Disipa ${w(x.disipada)}. Nominal mínima sugerida: ${w(x.nominalMinima)} (margen de ${potencia.margen}×)`}
        />
      ))}
    </div>
  );
}

// El pad de mínima pérdida, en el orden de la fuente a la carga.
function escaleraPad(pad: PadMinimaPerdida): Escalera {
  const elemento = (r: Resistencia) => ({
    tipo: 'R' as const,
    posicion: r.posicion,
    nombre: r.nombre,
  });
  const orden = pad.serie.lado === 'Z1' ? [pad.serie, pad.derivacion] : [pad.derivacion, pad.serie];
  return { fuente: 'Z_1', carga: 'Z_2', elementos: orden.map(elemento) };
}

function ResultadoMinima({
  entrada,
  onPasar,
}: {
  entrada: EntradaMinimaPerdida;
  onPasar?: (pase: Pase) => void;
}) {
  const resultado = calcularMinimaPerdida(entrada);
  if (resultado.estado === 'corte') {
    return (
      <FormaResultado
        avisos={
          <Aviso fuerte>
            <p>{resultado.texto}</p>
          </Aviso>
        }
        principal={null}
        notas={NOTAS_ATENUADORES}
      />
    );
  }
  const { pad, aMin } = resultado;
  const titulo =
    `Pad de mínima pérdida de ${ohms(entrada.z1)} a ${ohms(entrada.z2)}: ` +
    `${formatearValor(aMin, 'decibeles')}`;
  const nivel = (r: Resistencia) => pad.revision.marcados.find((m) => m.nombre === r.nombre)?.nivel;
  return (
    <FormaResultado
      avisos={resultado.avisos.map((a) => (
        <Aviso key={a.codigo}>{a.texto}</Aviso>
      ))}
      principal={
        <TarjetaResultado
          titulo={titulo}
          destacada
          formulas={
            <FormulasYFuentes formulas={pad.formulas} referencias={resultado.referencias} />
          }
          pasos={<Pasos pasos={pad.pasos} />}
          motivos={pad.revision.marcados.map((m) => ({ nivel: m.nivel, texto: m.motivo }))}
        >
          <Esquema escalera={escaleraPad(pad)} />
          {[pad.serie, pad.derivacion].map((r) => {
            const marca = nivel(r);
            return (
              <ValorResultado
                key={r.nombre}
                nombre={r.nombre}
                valor={ohms(r.valor)}
                rotulos={marca && <Rotulo tipo={marca} />}
                detalle={donde(r)}
                pase={<BotonPaseDe pase={paseDeResistencia(r, pad.revision)} onPasar={onPasar} />}
              />
            );
          })}
          {pad.potencia && <Potencia potencia={pad.potencia} />}
        </TarjetaResultado>
      }
      notas={resultado.notas}
    />
  );
}
