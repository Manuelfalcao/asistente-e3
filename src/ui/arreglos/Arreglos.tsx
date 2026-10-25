import { useEffect, useState } from 'preact/hooks';
import {
  type EntradaArreglos,
  type FilaArreglo,
  type MagnitudArreglo,
  type ResultadoArreglos,
  type TipoComponente,
  MAGNITUD,
  POR_DEFECTO,
  describirInventario,
} from '../../calculo/arreglos/arreglos';
import { ARREGLOS_A_MOSTRAR } from '../../calculo/comun/arreglos';
import type { SerieE } from '../../calculo/comun/series-e';
import { mensajeDeResultados } from '../../entrada/campo';
import { formatearErrorRelativo, formatearValor } from '../../entrada/formato';
import { BotonesSegmentados, type Opcion } from '../comun/BotonesSegmentados';
import {
  CampoEntradaValor,
  type CampoEntrada,
  useCampoEntrada,
  useOpcionGuardada,
} from '../comun/CampoEntrada';
import { Formula } from '../comun/Formula';
import { Cita, FormaResultado, Pasos } from '../comun/Resultado';
import { Rotulo } from '../comun/Rotulo';
import { TarjetaResultado, ValorResultado } from '../comun/Tarjeta';
import { useBusquedaArreglos } from './buscador';
import {
  CAPACIDAD_BUSCADA,
  RESISTENCIA_BUSCADA,
  TOLERANCIA,
  TOLERANCIA_CAPACITORES,
  TOLERANCIA_CHICOS,
  TOLERANCIA_CHICOS_POR_DEFECTO,
  TOLERANCIA_POR_DEFECTO,
  UMBRAL,
  UMBRAL_POR_DEFECTO,
} from './campos';

const COMPONENTES: readonly Opcion<TipoComponente>[] = [
  { valor: 'capacitor', texto: 'Capacitor' },
  { valor: 'resistencia', texto: 'Resistencia' },
];

const SERIES: readonly Opcion<SerieE>[] = [
  { valor: 'E6', texto: 'E6' },
  { valor: 'E12', texto: 'E12' },
  { valor: 'E24', texto: 'E24' },
];

// La Calculadora de Arreglos equivalentes (spec §8): los 10 mejores Arreglos de hasta 4 componentes
// para el valor buscado, con la conexión, el Error del arreglo y la Tolerancia del arreglo. La
// búsqueda corre en un Web Worker.
export function Arreglos() {
  const guardado = (campo: string) => ({ calculadora: 'arreglos', campo });
  const [componente, setComponente] = useOpcionGuardada(
    COMPONENTES,
    'capacitor',
    guardado('componente'),
  );
  const [serie, setSerie] = useOpcionGuardada(SERIES, POR_DEFECTO.serie, guardado('serie'));
  const capacidad = useCampoEntrada(CAPACIDAD_BUSCADA, '', guardado('capacidad'));
  const resistencia = useCampoEntrada(RESISTENCIA_BUSCADA, '', guardado('resistencia'));
  const umbral = useCampoEntrada(UMBRAL, UMBRAL_POR_DEFECTO, guardado('umbral'));
  const toleranciaR = useCampoEntrada(TOLERANCIA, TOLERANCIA_POR_DEFECTO, guardado('tolerancia-r'));
  const toleranciaC = useCampoEntrada(
    TOLERANCIA_CAPACITORES,
    TOLERANCIA_POR_DEFECTO,
    guardado('tolerancia-c'),
  );
  const toleranciaChicos = useCampoEntrada(
    TOLERANCIA_CHICOS,
    TOLERANCIA_CHICOS_POR_DEFECTO,
    guardado('tolerancia-chicos'),
  );

  const esCapacitor = componente === 'capacitor';
  const buscado = esCapacitor ? capacidad : resistencia;
  const tolerancia = esCapacitor ? toleranciaC : toleranciaR;
  const campos = esCapacitor
    ? [buscado, umbral, tolerancia, toleranciaChicos]
    : [buscado, umbral, tolerancia];
  const mensaje = mensajeDeResultados(
    campos.map((c) => ({
      nombre: c.spec.nombre,
      obligatorio: !!c.spec.obligatorio,
      estado: c.estado,
    })),
  );
  const valor = (c: CampoEntrada) => (c.estado.estado === 'valido' ? c.estado.valor : null);
  const valorBuscado = valor(buscado);
  const umbralPorcentaje = valor(umbral);
  const toleranciaPorcentaje = valor(tolerancia);
  const absolutaChicos = esCapacitor ? valor(toleranciaChicos) : POR_DEFECTO.toleranciaChicos;
  const entrada: EntradaArreglos | null =
    mensaje === null &&
    valorBuscado !== null &&
    umbralPorcentaje !== null &&
    toleranciaPorcentaje !== null &&
    absolutaChicos !== null
      ? {
          componente,
          buscado: valorBuscado,
          serie,
          umbral: umbralPorcentaje / 100,
          tolerancia: toleranciaPorcentaje / 100,
          toleranciaChicos: absolutaChicos,
        }
      : null;
  const { resultado, calculando } = useBusquedaArreglos(entrada);

  return (
    <div class="cuerpo-calculadora">
      <div class="columna-entradas">
        <section class="entradas" aria-label="Entradas">
          <BotonesSegmentados
            etiqueta="Componente"
            nombre="componente"
            opciones={COMPONENTES}
            valor={componente}
            onCambio={setComponente}
          />
          <CampoEntradaValor
            id={`buscado-${componente}`}
            etiqueta="Valor buscado"
            campo={buscado}
          />
          <BotonesSegmentados
            etiqueta="Serie"
            nombre="serie"
            opciones={SERIES}
            valor={serie}
            onCambio={setSerie}
          />
          <CampoEntradaValor id="umbral" etiqueta="Umbral de error" campo={umbral} unidadFija="%" />
          {esCapacitor ? (
            <>
              <CampoEntradaValor
                id="tolerancia-c"
                etiqueta="Tolerancia desde 10 pF"
                campo={toleranciaC}
                unidadFija="%"
              />
              <CampoEntradaValor
                id="tolerancia-chicos"
                etiqueta="Tolerancia debajo de 10 pF"
                campo={toleranciaChicos}
              />
            </>
          ) : (
            <CampoEntradaValor
              id="tolerancia-r"
              etiqueta="Tolerancia"
              campo={toleranciaR}
              unidadFija="%"
            />
          )}
        </section>
        <BloqueInventario componente={componente} serie={serie} />
      </div>
      <section class="resultados" aria-label="Resultados" aria-live="polite" aria-busy={calculando}>
        {mensaje !== null ? (
          <p class="sin-resultado corregir">{mensaje}</p>
        ) : resultado ? (
          <Resultado resultado={resultado} calculando={calculando} />
        ) : (
          <p class="sin-resultado calculando">Calculando…</p>
        )}
      </section>
    </div>
  );
}

// Qué se usa para buscar, en un bloque propio separado de las entradas (spec §8.2). El botón
// "Editar Inventario" llega con el Inventario.
function BloqueInventario({ componente, serie }: { componente: TipoComponente; serie: SerieE }) {
  const inventario = describirInventario(componente, serie);
  return (
    <section class="bloque-inventario" aria-label="Inventario">
      <h3>Inventario</h3>
      <p>{inventario.texto}</p>
      <p class="detalle">
        {inventario.rango} · {inventario.cantidad} valores
      </p>
    </section>
  );
}

// Primero la tarjeta del valor buscado con las fórmulas, la referencia y los pasos; después, la de
// los 10 Arreglos (spec §4.5).
function Resultado({
  resultado,
  calculando,
}: {
  resultado: ResultadoArreglos;
  calculando: boolean;
}) {
  const [elegida, setElegida] = useState(0);
  // Cada búsqueda nueva arranca con la primera fila elegida.
  useEffect(() => setElegida(0), [resultado]);
  const magnitud = MAGNITUD[resultado.componente];
  const { buscado, filas, revision } = resultado;
  const fila = filas[Math.min(elegida, filas.length - 1)];
  const marca = revision.marcados[0]?.nivel;
  const titulo =
    filas.length === ARREGLOS_A_MOSTRAR ? `Los ${ARREGLOS_A_MOSTRAR} mejores` : 'Arreglos';

  return (
    <FormaResultado
      principal={
        <TarjetaResultado
          titulo={`Arreglos equivalentes para ${formatearValor(buscado.valor, magnitud)}`}
          destacada
          pasos={
            <>
              <Pasos pasos={resultado.pasos} />
              {fila && (
                <>
                  <h4 class="pasos-subtitulo">Fila elegida: {fila.conexion}</h4>
                  <Pasos pasos={fila.pasos} />
                </>
              )}
            </>
          }
          motivos={revision.marcados.map((m) => ({ nivel: m.nivel, texto: m.motivo }))}
        >
          <ValorResultado
            nombre={buscado.nombre}
            valor={formatearValor(buscado.valor, magnitud)}
            rotulos={marca && <Rotulo tipo={marca} />}
          />
          <div class="formulas">
            {resultado.formulas.map((f) => (
              <Formula key={f} latex={f} />
            ))}
          </div>
          <Cita referencias={resultado.referencias} />
        </TarjetaResultado>
      }
      tarjetas={
        <TarjetaResultado titulo={titulo}>
          {calculando && (
            <p class="calculando" role="status">
              Calculando…
            </p>
          )}
          <ol class={calculando ? 'lista-arreglos desactualizada' : 'lista-arreglos'}>
            {filas.map((f, i) => (
              <FilaResultado
                key={`${f.conexion}-${f.valor}`}
                fila={f}
                magnitud={magnitud}
                elegida={i === elegida}
                onElegir={() => setElegida(i)}
              />
            ))}
          </ol>
          <p class="nota-tarjeta">
            Tocá una fila para ver la cuenta de su Tolerancia del arreglo en los pasos intermedios.
          </p>
        </TarjetaResultado>
      }
    />
  );
}

// Una fila de §8.5: la conexión, el valor, el Error del arreglo con signo, la cantidad de
// componentes, los valores repetidos y la Tolerancia del arreglo.
function FilaResultado({
  fila,
  magnitud,
  elegida,
  onElegir,
}: {
  fila: FilaArreglo;
  magnitud: MagnitudArreglo;
  elegida: boolean;
  onElegir: () => void;
}) {
  const v = (x: number) => formatearValor(x, magnitud);
  const { minimo, maximo } = fila.tolerancia;
  const relativa = (x: number) => formatearErrorRelativo(((x - fila.valor) / fila.valor) * 100);
  return (
    <li class={elegida ? 'fila-arreglo elegida' : 'fila-arreglo'}>
      <label>
        <input type="radio" name="fila-arreglo" checked={elegida} onChange={onElegir} />
        <span class="conexion">{fila.conexion}</span>
        <span class="datos">
          <span class="valor">{v(fila.valor)}</span>
          <span class="valor error">{formatearErrorRelativo(fila.error * 100)}</span>
          <span>
            {fila.componentes} {fila.componentes === 1 ? 'componente' : 'componentes'}
          </span>
          {fila.repetidos && <span>{fila.repetidos}</span>}
        </span>
        <span class="tolerancia">
          Tolerancia del arreglo: [{v(minimo)}; {v(maximo)}] ({relativa(minimo)} /{' '}
          {relativa(maximo)})
        </span>
        {fila.nota && <span class="nota">{fila.nota}</span>}
      </label>
    </li>
  );
}
