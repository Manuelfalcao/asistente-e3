import { useEffect, useState } from 'preact/hooks';
import {
  type Inventario,
  type ModoInventario,
  type TipoComponente,
  type ValorCargado,
  MAGNITUD,
  TIPOS,
  decadasDeSerie,
  alternarExcluido,
  escribirTolerancia,
  estaExcluido,
  leerTolerancia,
  mismoValor,
} from '../../calculo/arreglos/inventario';
import type { SerieE } from '../../calculo/comun/series-e';
import { formatearValor } from '../../entrada/formato';
import { BotonesSegmentados, type Opcion } from '../comun/BotonesSegmentados';
import { CampoEntradaValor, useCampoEntrada } from '../comun/CampoEntrada';
import { RANGO_DESDE, RANGO_HASTA, VALOR_DEL_INVENTARIO } from './campos';

const MODOS: readonly Opcion<ModoInventario>[] = [
  { valor: 'ninguno', texto: 'Sin Inventario' },
  { valor: 'inclusion', texto: 'Por inclusión' },
  { valor: 'exclusion', texto: 'Por exclusión' },
];

// El editor del Inventario de un tipo de componente (spec §8.2): sin Inventario, por inclusión (la
// lista de valores que tiene) o por exclusión (la serie en un rango, menos los Valores excluidos y
// más unos extras). Cambiar de modo no borra la lista del otro. La serie es la que se eligió en las
// entradas.
export function EditorInventario({
  componente,
  serie,
  inventario,
  onCambio,
}: {
  componente: TipoComponente;
  serie: SerieE;
  inventario: Inventario;
  // Cada cambio se escribe sobre el Inventario más nuevo, no sobre el de este dibujo: dos toques
  // seguidos no se pisan.
  onCambio: (cambio: (previo: Inventario) => Inventario) => void;
}) {
  const { exclusion } = inventario;
  const ponerExclusion = (
    parcial: (previa: Inventario['exclusion']) => Partial<Inventario['exclusion']>,
  ) =>
    onCambio((previo) => ({
      ...previo,
      exclusion: { ...previo.exclusion, ...parcial(previo.exclusion) },
    }));

  return (
    <div class="editor-inventario" id={`editor-inventario-${componente}`}>
      <BotonesSegmentados
        etiqueta={`Cómo cargar los ${TIPOS[componente]}`}
        nombre="modo-inventario"
        opciones={MODOS}
        valor={inventario.modo}
        onCambio={(modo) => onCambio((previo) => ({ ...previo, modo }))}
      />

      {inventario.modo === 'ninguno' && (
        <p class="ayuda-inventario">
          Se busca en la serie E completa que se elige en las entradas, en el rango fijo del tipo.
        </p>
      )}

      {inventario.modo === 'inclusion' && (
        <ListaValores
          id="inclusion"
          componente={componente}
          titulo="Valores que tengo"
          ayuda="Cualquier valor, sea o no de la serie. No hay cantidades: un valor se puede repetir dentro de un Arreglo."
          valores={inventario.inclusion}
          onCambio={(cambio) =>
            onCambio((previo) => ({ ...previo, inclusion: cambio(previo.inclusion) }))
          }
        />
      )}

      {inventario.modo === 'exclusion' && (
        <>
          <RangoDeLaSerie
            key={`rango-${componente}`}
            componente={componente}
            min={exclusion.min}
            max={exclusion.max}
            onRango={(min, max) => ponerExclusion(() => ({ min, max }))}
          />
          <GrillaSerie
            componente={componente}
            serie={serie}
            min={exclusion.min}
            max={exclusion.max}
            excluidos={exclusion.excluidos}
            onAlternar={(valor) =>
              ponerExclusion((previa) => ({ excluidos: alternarExcluido(previa.excluidos, valor) }))
            }
          />
          <ListaValores
            id="extras"
            componente={componente}
            titulo="Valores extra"
            ayuda="Valores fuera de la serie que también tenés."
            valores={exclusion.extras}
            onCambio={(cambio) => ponerExclusion((previa) => ({ extras: cambio(previa.extras) }))}
          />
        </>
      )}
    </div>
  );
}

function RangoDeLaSerie({
  componente,
  min,
  max,
  onRango,
}: {
  componente: TipoComponente;
  min: number;
  max: number;
  onRango: (min: number, max: number) => void;
}) {
  const magnitud = MAGNITUD[componente];
  const desde = useCampoEntrada(RANGO_DESDE[componente], formatearValor(min, magnitud, 'paso'));
  const hasta = useCampoEntrada(RANGO_HASTA[componente], formatearValor(max, magnitud, 'paso'));
  const a = desde.estado;
  const b = hasta.estado;
  const ordenado = a.estado === 'valido' && b.estado === 'valido' ? a.valor < b.valor : true;
  useEffect(() => {
    if (a.estado !== 'valido' || b.estado !== 'valido' || a.valor >= b.valor) return;
    if (!mismoValor(a.valor, min) || !mismoValor(b.valor, max)) onRango(a.valor, b.valor);
  }, [a, b]);
  return (
    <fieldset class="rango-serie">
      <legend>Rango de la serie</legend>
      <CampoEntradaValor id={`rango-desde-${componente}`} etiqueta="Desde" campo={desde} />
      <CampoEntradaValor id={`rango-hasta-${componente}`} etiqueta="Hasta" campo={hasta} />
      {!ordenado && <p class="error-inventario">«Desde» tiene que ser menor que «Hasta».</p>}
    </fieldset>
  );
}

// Una fila por década: un toque marca el valor como Valor excluido (tachado) y otro lo vuelve a incluir.
function GrillaSerie({
  componente,
  serie,
  min,
  max,
  excluidos,
  onAlternar,
}: {
  componente: TipoComponente;
  serie: SerieE;
  min: number;
  max: number;
  excluidos: readonly number[];
  onAlternar: (valor: number) => void;
}) {
  const magnitud = MAGNITUD[componente];
  const decadas = decadasDeSerie(serie, min, max);
  return (
    <div class="grilla-serie" role="group" aria-label={`Serie ${serie}`}>
      <p class="ayuda-inventario">
        Serie {serie}. Tocá un valor que no tengas para marcarlo como Valor excluido; otro toque lo
        vuelve a incluir.
      </p>
      <div class="decadas">
        {decadas.map(({ decada, valores }) => (
          <div class="decada" key={decada}>
            <span class="decada-etiqueta">{formatearValor(Number(`1e${decada}`), magnitud)}</span>
            {valores.map((valor) => {
              const excluido = estaExcluido(excluidos, valor);
              const texto = formatearValor(valor, magnitud);
              return (
                <button
                  key={valor}
                  type="button"
                  class="celda-serie"
                  aria-pressed={excluido}
                  aria-label={`${texto}${excluido ? ', excluido' : ''}`}
                  onClick={() => onAlternar(valor)}
                >
                  {texto}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {decadas.length === 0 && (
        <p class="error-inventario">Ningún valor de la serie cae en ese rango.</p>
      )}
    </div>
  );
}

// Una lista de valores con su tolerancia propia, opcional (spec §8.2). Sin tolerancia propia vale la
// de por defecto.
function ListaValores({
  id,
  componente,
  titulo,
  ayuda,
  valores,
  onCambio,
}: {
  id: string;
  componente: TipoComponente;
  titulo: string;
  ayuda: string;
  valores: readonly ValorCargado[];
  onCambio: (cambio: (previos: ValorCargado[]) => ValorCargado[]) => void;
}) {
  const magnitud = MAGNITUD[componente];
  const nuevo = useCampoEntrada(VALOR_DEL_INVENTARIO[componente], '');
  const ordenados = [...valores].sort((a, b) => a.valor - b.valor);
  const agregar = (e: Event) => {
    e.preventDefault();
    if (nuevo.estado.estado !== 'valido') return;
    const { valor } = nuevo.estado;
    // Un valor que ya está se deja como está, con su tolerancia.
    onCambio((previos) =>
      previos.some((v) => mismoValor(v.valor, valor)) ? previos : [...previos, { valor }],
    );
    nuevo.setTexto('');
  };
  const cambiarTolerancia = (valor: number, tolerancia: ValorCargado['tolerancia']) =>
    onCambio((previos) =>
      previos.map((v) =>
        v.valor === valor ? (tolerancia ? { valor, tolerancia } : { valor }) : v,
      ),
    );

  return (
    <section class="lista-valores" aria-label={titulo}>
      <h4>{titulo}</h4>
      <p class="ayuda-inventario">{ayuda}</p>
      <form onSubmit={agregar}>
        <CampoEntradaValor id={`nuevo-valor-${id}`} etiqueta="Valor" campo={nuevo} />
        <button type="submit" class="boton-inventario" disabled={nuevo.estado.estado !== 'valido'}>
          Agregar
        </button>
      </form>
      {ordenados.length === 0 ? (
        <p class="ayuda-inventario">Todavía no hay valores.</p>
      ) : (
        <ul class="valores-cargados">
          {ordenados.map((v) => (
            <FilaValor
              key={v.valor}
              componente={componente}
              texto={formatearValor(v.valor, magnitud)}
              valor={v}
              onTolerancia={(t) => cambiarTolerancia(v.valor, t)}
              onQuitar={() => onCambio((previos) => previos.filter((x) => x.valor !== v.valor))}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function FilaValor({
  componente,
  texto,
  valor,
  onTolerancia,
  onQuitar,
}: {
  componente: TipoComponente;
  texto: string;
  valor: ValorCargado;
  onTolerancia: (t: ValorCargado['tolerancia']) => void;
  onQuitar: () => void;
}) {
  const [escrito, setEscrito] = useState(
    valor.tolerancia ? escribirTolerancia(valor.tolerancia, componente) : '',
  );
  const lectura = leerTolerancia(escrito, componente);
  const cambiar = (nuevo: string) => {
    setEscrito(nuevo);
    const l = leerTolerancia(nuevo, componente);
    if (l.tipo === 'vacio') onTolerancia(undefined);
    else if (l.tipo === 'valor') onTolerancia(l.tolerancia);
  };
  return (
    <li class={lectura.tipo === 'error' ? 'valor-cargado invalido' : 'valor-cargado'}>
      <span class="valor-texto">{texto}</span>
      <input
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="off"
        spellcheck={false}
        placeholder="tolerancia por defecto"
        aria-label={`Tolerancia propia de ${texto}`}
        aria-invalid={lectura.tipo === 'error' || undefined}
        value={escrito}
        onInput={(e) => cambiar(e.currentTarget.value)}
      />
      <button
        type="button"
        class="boton-inventario"
        aria-label={`Quitar ${texto}`}
        onClick={onQuitar}
      >
        Quitar
      </button>
      {lectura.tipo === 'error' && <p class="error-inventario">{lectura.motivo}</p>}
    </li>
  );
}
