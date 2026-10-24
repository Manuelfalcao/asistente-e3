import {
  type Atenuador,
  type EntradaAtenuador,
  type ResultadoAtenuadores,
  NOTAS_ATENUADORES,
  calcularAtenuadores,
} from '../../calculo/atenuadores/atenuadores';
import { mensajeDeResultados } from '../../entrada/campo';
import { formatearValor } from '../../entrada/formato';
import type { Escalera } from '../esquema';
import { CampoEntradaValor, type CampoEntrada, useCampoEntrada } from '../comun/CampoEntrada';
import { Esquema } from '../comun/Esquema';
import { Formula } from '../comun/Formula';
import { Aviso } from '../comun/Franjas';
import { Cita, FormaResultado, Pasos } from '../comun/Resultado';
import { TarjetaResultado, ValorResultado } from '../comun/Tarjeta';
import { ATENUACION, FRECUENCIA, POTENCIA, Z1, Z2, Z_POR_DEFECTO } from './campos';

// La Calculadora de atenuadores (spec §10): el T y el π juntos, cada uno con su esquema, sus
// resistencias, sus fórmulas, la referencia y los pasos intermedios.
export function Atenuadores() {
  const a = useCampoEntrada(ATENUACION);
  const z1 = useCampoEntrada(Z1, Z_POR_DEFECTO);
  const z2 = useCampoEntrada(Z2, Z_POR_DEFECTO);
  const potencia = useCampoEntrada(POTENCIA);
  const frecuencia = useCampoEntrada(FRECUENCIA);

  const mensaje = mensajeDeResultados(
    [a, z1, z2, potencia, frecuencia].map((c) => ({
      nombre: c.spec.nombre,
      obligatorio: !!c.spec.obligatorio,
      estado: c.estado,
    })),
  );

  const entrada: EntradaAtenuador | null =
    mensaje === null &&
    a.estado.estado === 'valido' &&
    z1.estado.estado === 'valido' &&
    z2.estado.estado === 'valido'
      ? { atenuacion: a.estado.valor, z1: z1.estado.valor, z2: z2.estado.valor }
      : null;

  return (
    <div class="cuerpo-calculadora">
      <section class="entradas" aria-label="Entradas">
        <CampoEntradaValor id="atenuacion" etiqueta="Atenuación A" campo={a} unidadFija="dB" />
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
        <CampoEntradaValor
          id="potencia"
          etiqueta="Potencia de entrada (opcional)"
          campo={potencia}
        />
        <CampoEntradaValor id="frecuencia" etiqueta="Frecuencia (opcional)" campo={frecuencia} />
      </section>
      <section class="resultados" aria-label="Resultados" aria-live="polite">
        {entrada ? (
          <Resultado resultado={calcularAtenuadores(entrada)} entrada={entrada} />
        ) : (
          <p class="sin-resultado corregir">{mensaje}</p>
        )}
      </section>
    </div>
  );
}

function intercambiar(z1: CampoEntrada, z2: CampoEntrada) {
  const [texto1, unidad1] = [z1.texto, z1.unidad];
  z1.setTexto(z2.texto);
  z2.setTexto(texto1);
  if (z2.unidad !== undefined) z1.setUnidad(z2.unidad);
  if (unidad1 !== undefined) z2.setUnidad(unidad1);
}

function Resultado({
  resultado,
  entrada,
}: {
  resultado: ResultadoAtenuadores;
  entrada: EntradaAtenuador;
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
            />
          ))}
        </div>
      }
      notas={resultado.notas}
    />
  );
}

const ohms = (r: number) => formatearValor(r, 'resistencia');

function escalera(red: Atenuador): Escalera {
  const elementos = (['r1', 'r3', 'r2'] as const).map((clave) => ({
    tipo: 'R' as const,
    posicion: red[clave].posicion,
    nombre: clave.toUpperCase(),
  }));
  return { fuente: 'Z_1', carga: 'Z_2', elementos };
}

function donde(red: Atenuador, clave: 'r1' | 'r2' | 'r3'): string {
  const r = red[clave];
  const posicion = r.posicion === 'serie' ? 'En serie' : 'En derivación';
  return r.lado ? `${posicion}, del lado de ${r.lado}` : posicion;
}

function TarjetaAtenuador({
  red,
  titulo,
  resultado,
}: {
  red: Atenuador;
  titulo: string;
  resultado: Extract<ResultadoAtenuadores, { estado: 'calculado' }>;
}) {
  return (
    <TarjetaResultado titulo={titulo} destacada pasos={<Pasos pasos={red.pasos} />}>
      <Esquema escalera={escalera(red)} />
      {(['r1', 'r2', 'r3'] as const).map((clave) => (
        <ValorResultado
          key={clave}
          nombre={clave.toUpperCase()}
          valor={ohms(red[clave].valor)}
          detalle={donde(red, clave)}
        />
      ))}
      <div class="formulas">
        {red.formulas.map((f) => (
          <Formula key={f} latex={f} />
        ))}
      </div>
      <Cita referencias={resultado.referencias} />
    </TarjetaResultado>
  );
}
