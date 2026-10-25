import type { ComponentChildren } from 'preact';
import {
  type Autorresonancia,
  type EntradaBobina,
  type ResultadoBobinas,
  type Vecino,
  calcularBobinas,
} from '../../calculo/bobinas/bobinas';
import type { DosCapas, VecinoDosCapas } from '../../calculo/bobinas/dos-capas';
import { mensajeDeResultados } from '../../entrada/campo';
import { formatearErrorRelativo, formatearValor } from '../../entrada/formato';
import { CampoEntradaValor, type CampoEntrada, useCampoEntrada } from '../comun/CampoEntrada';
import { Formula } from '../comun/Formula';
import { Aviso } from '../comun/Franjas';
import { Cita, FormaResultado, Pasos } from '../comun/Resultado';
import { Rotulo } from '../comun/Rotulo';
import { TarjetaResultado, ValorResultado } from '../comun/Tarjeta';
import {
  CABLE,
  CARRETE,
  FRECUENCIA,
  INDUCTANCIA,
  SEPARACION,
  SEPARACION_POR_DEFECTO,
} from './campos';

// La Calculadora de bobinas (spec §6): las vueltas de una bobina solenoidal de aire de una y de dos
// capas, cada una en su tarjeta con los dos vecinos en pasos de media vuelta, la SRF estimada, la
// fórmula, la referencia y los pasos intermedios. Dos capas fuera de rango muestra solo el motivo.
export function Bobinas() {
  const guardado = (campo: string) => ({ calculadora: 'bobinas', campo });
  const inductancia = useCampoEntrada(INDUCTANCIA, '', guardado('inductancia'));
  const carrete = useCampoEntrada(CARRETE, '', guardado('carrete'));
  const cable = useCampoEntrada(CABLE, '', guardado('cable'));
  const separacion = useCampoEntrada(SEPARACION, SEPARACION_POR_DEFECTO, guardado('separacion'));
  const frecuencia = useCampoEntrada(FRECUENCIA, '', guardado('frecuencia'));

  const mensaje = mensajeDeResultados(
    [inductancia, carrete, cable, separacion, frecuencia].map((c) => ({
      nombre: c.spec.nombre,
      obligatorio: !!c.spec.obligatorio,
      estado: c.estado,
    })),
  );
  const valor = (c: CampoEntrada) => (c.estado.estado === 'valido' ? c.estado.valor : null);
  const l = valor(inductancia);
  const dc = valor(carrete);
  const d = valor(cable);
  const s = valor(separacion);
  const entrada: EntradaBobina | null =
    mensaje === null && l !== null && dc !== null && d !== null && s !== null
      ? { inductancia: l, carrete: dc, cable: d, separacion: s, frecuencia: valor(frecuencia) }
      : null;

  return (
    <div class="cuerpo-calculadora">
      <section class="entradas" aria-label="Entradas">
        <CampoEntradaValor id="inductancia" etiqueta="Inductancia buscada" campo={inductancia} />
        <CampoEntradaValor id="carrete" etiqueta="Diámetro del carrete" campo={carrete} />
        <CampoEntradaValor id="cable" etiqueta="Diámetro del cable (con esmalte)" campo={cable} />
        <CampoEntradaValor id="separacion" etiqueta="Separación entre vueltas" campo={separacion} />
        <CampoEntradaValor
          id="frecuencia-trabajo"
          etiqueta="Frecuencia de trabajo (opcional)"
          campo={frecuencia}
        />
      </section>
      <section class="resultados" aria-label="Resultados" aria-live="polite">
        {entrada ? (
          <Resultado resultado={calcularBobinas(entrada)} />
        ) : (
          <p class="sin-resultado corregir">{mensaje}</p>
        )}
      </section>
    </div>
  );
}

const henrios = (x: number) => formatearValor(x, 'inductancia');
const hz = (x: number) => formatearValor(x, 'frecuencia');

// La L buscada con su rótulo de Valor dudoso o impracticable, si lo tiene (spec §5.6).
function FilaBuscada({ resultado }: { resultado: ResultadoBobinas }) {
  const marca = resultado.revision.marcados[0]?.nivel;
  return (
    <ValorResultado
      nombre="L buscada"
      valor={henrios(resultado.buscada.valor)}
      rotulos={marca && <Rotulo tipo={marca} />}
    />
  );
}

const motivosDe = (resultado: ResultadoBobinas) =>
  resultado.revision.marcados.map((m) => ({ nivel: m.nivel, texto: m.motivo }));

function Resultado({ resultado }: { resultado: ResultadoBobinas }) {
  if (resultado.estado === 'corte') {
    return (
      <FormaResultado
        avisos={
          <Aviso fuerte>
            <p>{resultado.texto}</p>
          </Aviso>
        }
        principal={
          <TarjetaResultado
            titulo={resultado.codigo === 'menos-de-una-vuelta' ? 'Una sola vuelta' : 'Sin solución'}
            pasos={resultado.pasos.length > 0 && <Pasos pasos={resultado.pasos} />}
            motivos={motivosDe(resultado)}
          >
            <FilaBuscada resultado={resultado} />
          </TarjetaResultado>
        }
        notas={resultado.notas}
      />
    );
  }
  return (
    <FormaResultado
      avisos={resultado.avisos.map((a) => (
        <Aviso key={a.codigo} fuerte={a.codigo === 'terminales'}>
          {a.texto}
        </Aviso>
      ))}
      principal={
        <div class="grilla-tarjetas">
          <TarjetaUnaCapa resultado={resultado} />
          <TarjetaDosCapas dosCapas={resultado.dosCapas} buscada={resultado.buscada.valor} />
        </div>
      }
      notas={resultado.notas}
    />
  );
}

// "5,5 vueltas", "1 vuelta"
const vueltasTexto = (n: number) =>
  `${formatearValor(n, 'numero')} ${n === 1 ? 'vuelta' : 'vueltas'}`;

// "5,5 por capa" y debajo el total, "11 vueltas": en dos renglones, para que la columna del nombre
// no le quite el ancho al detalle.
const vueltasDosCapas = (v: VecinoDosCapas) => (
  <>
    {formatearValor(v.vueltasPorCapa, 'numero')} por capa
    <span class="total">{vueltasTexto(v.vueltas)}</span>
  </>
);

function FilaVecino({
  vecino,
  nombre = vueltasTexto(vecino.vueltas),
  sufijoDetalle = '',
}: {
  vecino: Vecino;
  nombre?: ComponentChildren;
  // Lo que se agrega al final del detalle: el diámetro exterior en dos capas.
  sufijoDetalle?: string;
}) {
  return (
    <div class={vecino.destacado ? 'vecino destacado' : 'vecino'}>
      <ValorResultado
        nombre={nombre}
        valor={henrios(vecino.inductancia)}
        detalle={
          `${vecino.destacado ? 'La más cercana · ' : ''}` +
          `${formatearErrorRelativo(vecino.error * 100)} · Largo de la bobina ` +
          formatearValor(vecino.largoBobina, 'largo') +
          sufijoDetalle
        }
      />
    </div>
  );
}

function FilaSRF({ srf }: { srf: Autorresonancia }) {
  return (
    <ValorResultado
      nombre="SRF"
      valor={hz(srf.estimada)}
      rotulos={<Rotulo tipo="estimacion" />}
      detalle={
        `La menor entre el largo de hilo (${hz(srf.largoDeHilo)}) y Medhurst ` +
        `(${hz(srf.medhurst)})`
      }
    />
  );
}

function TarjetaUnaCapa({
  resultado,
}: {
  resultado: Extract<ResultadoBobinas, { estado: 'calculado' }>;
}) {
  const { unaCapa, buscada } = resultado;
  const { srf } = unaCapa;
  return (
    <TarjetaResultado
      titulo={`Una capa de ${henrios(buscada.valor)}`}
      destacada
      pasos={<Pasos pasos={unaCapa.pasos} />}
      motivos={motivosDe(resultado)}
    >
      <FilaBuscada resultado={resultado} />
      <div class="vecinos" aria-label="Vecinos en pasos de media vuelta">
        {unaCapa.vecinos.map((v) => (
          <FilaVecino key={v.vueltas} vecino={v} />
        ))}
      </div>
      <FilaSRF srf={srf} />
      <p class="nota-tarjeta">
        {unaCapa.diametro === 'rf' && (
          <>
            <Rotulo tipo="deduccion-propia" />{' '}
          </>
        )}
        {unaCapa.notaDiametro}
      </p>
      {unaCapa.notas.map((n) => (
        <p key={n} class="nota-tarjeta">
          {n}
        </p>
      ))}
      <div class="formulas">
        {unaCapa.formulas.map((f) => (
          <Formula key={f} latex={f} />
        ))}
      </div>
      <Cita referencias={unaCapa.referencias} />
    </TarjetaResultado>
  );
}

// Junto a la de una capa, siempre (spec §6.6). Fuera del rango de la fórmula, solo el motivo.
function TarjetaDosCapas({ dosCapas, buscada }: { dosCapas: DosCapas; buscada: number }) {
  const titulo = `Dos capas de ${henrios(buscada)}`;
  if (dosCapas.estado === 'fuera-de-rango') {
    return (
      <TarjetaResultado titulo={titulo}>
        <p class="nota-tarjeta">{dosCapas.texto}</p>
      </TarjetaResultado>
    );
  }
  const exterior = ` · diámetro exterior ${formatearValor(dosCapas.diametroExterior, 'largo')}`;
  return (
    <TarjetaResultado titulo={titulo} pasos={<Pasos pasos={dosCapas.pasos} />}>
      {dosCapas.avisos.map((a) => (
        <Aviso key={a.codigo}>{a.texto}</Aviso>
      ))}
      <div class="vecinos" aria-label="Vecinos en pasos de media vuelta por capa">
        {dosCapas.vecinos.map((v) => (
          <FilaVecino
            key={v.vueltasPorCapa}
            vecino={v}
            nombre={vueltasDosCapas(v)}
            sufijoDetalle={exterior}
          />
        ))}
      </div>
      <FilaSRF srf={dosCapas.srf} />
      <p class="nota-tarjeta">
        {dosCapas.correccion === 'maxwell' && (
          <>
            <Rotulo tipo="deduccion-propia" />{' '}
          </>
        )}
        {dosCapas.notaFormula}
      </p>
      {dosCapas.notas.map((n) => (
        <p key={n} class="nota-tarjeta">
          {n}
        </p>
      ))}
      <div class="formulas">
        {dosCapas.formulas.map((f) => (
          <Formula key={f} latex={f} />
        ))}
      </div>
      <Cita referencias={dosCapas.referencias} />
    </TarjetaResultado>
  );
}
