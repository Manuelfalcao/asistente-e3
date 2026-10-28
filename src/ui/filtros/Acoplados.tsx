import {
  type ResultadoResonadores,
  type VentanaDeL,
  COMO_SE_PROPUSO,
  R_DEL_LADO,
  cifrasDeSintonia,
} from '../../calculo/filtros/resonadores';
import { formatearValor } from '../../entrada/formato';
import type { Escalera } from '../esquema';
import { BotonPaseDe } from '../comun/BotonPase';
import { Esquema } from '../comun/Esquema';
import { Aviso } from '../comun/Franjas';
import { FormaResultado, FormulasYFuentes, Pasos } from '../comun/Resultado';
import { Rotulo } from '../comun/Rotulo';
import { Desplegable, TarjetaResultado, ValorResultado } from '../comun/Tarjeta';
import type { Pase } from '../pases';
import { APROXIMACIONES } from './campos';
import { pasesDeResonadores } from './pases';

// El resultado de la Topología de resonadores acoplados (spec §7.7): la Frecuencia de sintonía, la
// L de los resonadores y los Capacitores de extremo, de acople y de sintonía, con el esquema. Los
// Capacitores de sintonía no tienen botón de pase: van con trimmer (spec §5.5).

type Calculado = Extract<ResultadoResonadores, { estado: 'calculado' }>;

const capacidad = (c: number) => formatearValor(c, 'capacidad');
const inductancia = (l: number) => formatearValor(l, 'inductancia');
const frecuencia = (f: number) => formatearValor(f, 'frecuencia');

// "6 – 23 nH": la Ventana de L como la ve el Alumno, con la unidad una sola vez si es la misma.
export function rangoDeLaVentana({ min, max }: VentanaDeL): string {
  const [desde, hasta] = [inductancia(min), inductancia(max)];
  const unidad = (t: string) => t.slice(t.lastIndexOf(' '));
  return unidad(desde) === unidad(hasta)
    ? `${desde.slice(0, desde.lastIndexOf(' '))} – ${hasta}`
    : `${desde} – ${hasta}`;
}

// La línea debajo del campo de la L: la propuesta y la ventana.
export function ayudaDeL(ventana: VentanaDeL): string {
  return (
    `Vacío: la propuesta, ${inductancia(ventana.propuesta)}` +
    (ventana.vacia
      ? `. La Ventana de L está vacía (pide más de ${inductancia(ventana.min)} y menos de ` +
        `${inductancia(ventana.max)}).`
      : ` (válida: ${rangoDeLaVentana(ventana)}).`)
  );
}

// "C01" → "C_01" para el subíndice del esquema.
const rotulo = (nombre: string) => `${nombre[0]}_${nombre.slice(1)}`;

function escalera(r: Calculado): Escalera {
  const n = r.sintonias.length;
  return {
    fuente: 'R_s',
    carga: 'R_L',
    elementos: [
      { tipo: 'C', posicion: 'serie', nombre: rotulo(r.extremos[0].capacitor.nombre) },
      ...r.sintonias.flatMap((s, i) => [
        {
          tipo: 'LC' as const,
          conexion: 'paralelo' as const,
          posicion: 'derivacion' as const,
          nombreL: 'L',
          nombreC: rotulo(s.capacitor.nombre),
        },
        ...(i < n - 1
          ? [
              {
                tipo: 'C' as const,
                posicion: 'serie' as const,
                nombre: rotulo(r.acoples[i].capacitor.nombre),
              },
            ]
          : []),
      ]),
      { tipo: 'C', posicion: 'serie', nombre: rotulo(r.extremos[1].capacitor.nombre) },
    ],
  };
}

export function ResultadoAcoplados({
  resultado,
  ripple,
  qBobina,
  onPasar,
}: {
  resultado: ResultadoResonadores;
  ripple: number | null;
  qBobina: number;
  onPasar?: (pase: Pase) => void;
}) {
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
      ? `Chebyshev de ${formatearValor(ripple!, 'decibeles')}`
      : APROXIMACIONES.find((a) => a.valor === r.aproximacion)!.texto;
  const titulo =
    `Pasa banda ${aproximacion} de Orden ${r.orden} en resonadores acoplados, de ` +
    `${frecuencia(r.banda.f1)} a ${frecuencia(r.banda.f2)}`;
  const cifras = cifrasDeSintonia(r.sintonia.f0, r.banda.bw);
  const sintonia = (f: number) => formatearValor(f, 'frecuencia', 'resultado', cifras);
  const marca = (nombre: string) => {
    const nivel = r.revision.marcados.find((m) => m.nombre === nombre)?.nivel;
    return nivel && <Rotulo tipo={nivel} />;
  };
  const ohms = (x: number) => formatearValor(x, 'resistencia');
  const pases = pasesDeResonadores(r);
  const botonDe = (nombre: string) => {
    const pase = pases.capacitores.get(nombre);
    return pase && <BotonPaseDe pase={pase} onPasar={onPasar} />;
  };
  return (
    <FormaResultado
      avisos={r.avisos.map((a) => (
        <Aviso key={a.codigo} fuerte={a.codigo === 'fbw-fuera-de-rango'}>
          {a.texto}
        </Aviso>
      ))}
      principal={
        <TarjetaResultado
          titulo={titulo}
          destacada
          desplegables={
            <Desplegable titulo="Frecuencias de la banda">
              <ValorResultado nombre="f1" valor={frecuencia(r.banda.f1)} detalle="borde bajo" />
              <ValorResultado nombre="f2" valor={frecuencia(r.banda.f2)} detalle="borde alto" />
              <ValorResultado
                nombre="f0"
                valor={sintonia(r.banda.f0)}
                detalle={
                  <>
                    central geométrica √(f<sub>1</sub>·f<sub>2</sub>): no es la de sintonía
                  </>
                }
              />
              <ValorResultado
                nombre="BW"
                valor={frecuencia(r.banda.bw)}
                detalle={`ancho de banda; FBW = ${formatearValor(r.sintonia.fbw * 100, 'porcentaje')}`}
              />
            </Desplegable>
          }
          formulas={<FormulasYFuentes formulas={r.formulas} referencias={r.referencias} />}
          pasos={<Pasos pasos={r.pasos} />}
          motivos={r.revision.marcados.map((m) => ({ nivel: m.nivel, texto: m.motivo }))}
          sugerencia={r.revision.sugerencia ?? undefined}
        >
          <Esquema escalera={escalera(r)} />
          <ValorResultado
            nombre="Frecuencia de sintonía"
            valor={sintonia(r.sintonia.f0)}
            detalle="ajustá cada resonador a esta frecuencia (mapeo de Cohn)"
          />
          {r.ordenCalculado && (
            <ValorResultado
              nombre={`A(${frecuencia(r.ordenCalculado.prototipo.fs)})`}
              valor={formatearValor(r.ordenCalculado.atenuacionSimulada, 'decibeles')}
              detalle={
                `atenuación de la red simulada en fs con Orden ${r.orden}; pediste al menos ` +
                `${formatearValor(r.ordenCalculado.prototipo.as, 'decibeles')}. El prototipo ` +
                `pedía Orden ${r.ordenCalculado.prototipo.orden}`
              }
            />
          )}
          <ValorResultado
            nombre="L"
            valor={inductancia(r.inductancia.valor)}
            rotulos={
              <>
                {marca('L')}
                <Rotulo tipo="criterio-practico" />
              </>
            }
            pase={<BotonPaseDe pase={pases.l} onPasar={onPasar} />}
            detalle={
              `la de todos los resonadores; ` +
              (r.lPropuesta
                ? `la propone el Asistente: ${COMO_SE_PROPUSO[r.ventana.propuestaComo]}`
                : 'la que ingresaste') +
              (r.ventana.vacia ? '' : ` (${rangoDeLaVentana(r.ventana)})`)
            }
          />
          {r.extremos.map((x) => (
            <ValorResultado
              key={x.capacitor.nombre}
              nombre={x.capacitor.nombre}
              valor={capacidad(x.capacitor.valor)}
              rotulos={marca(x.capacitor.nombre)}
              pase={botonDe(x.capacitor.nombre)}
              detalle={
                `Capacitor de extremo: lleva ${R_DEL_LADO[x.lado].texto} = ${ohms(x.r)} ` +
                `a los ${ohms(x.rp)} que tiene que ver el resonador`
              }
            />
          ))}
          {r.acoples.map((a) => (
            <ValorResultado
              key={a.capacitor.nombre}
              nombre={a.capacitor.nombre}
              valor={capacidad(a.capacitor.valor)}
              rotulos={marca(a.capacitor.nombre)}
              pase={botonDe(a.capacitor.nombre)}
              detalle={`Capacitor de acople, k = ${formatearValor(a.k, 'numero')}`}
            />
          ))}
          {r.sintonias.map((s) => (
            <ValorResultado
              key={s.capacitor.nombre}
              nombre={s.capacitor.nombre}
              valor={capacidad(s.capacitor.valor)}
              rotulos={
                <>
                  {marca(s.capacitor.nombre)}
                  <Rotulo tipo="criterio-practico" />
                </>
              }
              detalle={
                `Capacitor de sintonía, con trimmer de ${capacidad(s.trimmer.min)} a ` +
                `${capacidad(s.trimmer.max)}`
              }
            />
          ))}
          <ValorResultado
            nombre="Pérdida"
            valor={formatearValor(r.perdidaCohn, 'decibeles')}
            rotulos={<Rotulo tipo="estimacion" />}
            detalle={`de Cohn en la Frecuencia de sintonía, con Qu = ${formatearValor(qBobina, 'numero')}`}
          />
        </TarjetaResultado>
      }
      notas={r.notas}
    />
  );
}
