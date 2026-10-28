import {
  type EntradaResonadores,
  type ResultadoResonadores,
  calcularResonadores,
} from '../../../src/calculo/filtros/resonadores';
import { formatearValor } from '../../../src/entrada/formato';
import {
  type CasoDeComportamiento,
  type CasoDeRevision,
  type CasoInforme,
  type GrupoPasos,
  enCaso,
  medidaImpresa,
  medidaNumerica,
} from '../../casos-informe';
import {
  CASOS_COHN_RESONADORES,
  CASOS_COMPORTAMIENTO_RESONADORES,
  CASOS_ORDEN_RESONADORES,
  CASOS_VERIFICACION_RESONADORES,
  type CasoCohnResonadores,
  type CasoComportamientoResonadores,
  type CasoOrdenResonadores,
  type CasoVerificacionResonadores,
  ESCALA_RESONADORES,
  TOLERANCIA_ADAPTA,
  TOLERANCIA_BORDES,
  TOLERANCIA_EXACTA_DB,
  TOLERANCIA_FUERA_DE_BANDA,
  toleranciaDeValores,
  valorDe,
} from './casos-resonadores';
import { atenuacionAcoplada, bordeSimulado, entradaAcoplada } from './elementos';

// El adaptador de los casos de resonadores acoplados para el Informe de casos (spec §13.6). Lo usan
// el informe.ts de filtros y los tests de casos-resonadores.test.ts: cada caso arma sus medidas una
// sola vez.

const HZ = (f: number) => formatearValor(f, 'frecuencia');
const R = (ohms: number) => formatearValor(ohms, 'resistencia');
const APROXIMACION = { butterworth: 'Butterworth', chebyshev: 'Chebyshev', bessel: 'Bessel' };

export function entradasTexto(e: EntradaResonadores): string {
  const banda =
    'f1' in e.banda
      ? `f1 = ${HZ(e.banda.f1)} · f2 = ${HZ(e.banda.f2)}`
      : `f0 = ${HZ(e.banda.f0)} · BW = ${HZ(e.banda.bw)}`;
  return [
    'pasa banda',
    e.aproximacion === 'chebyshev'
      ? `Chebyshev ${formatearValor(e.ripple!, 'decibeles')}`
      : APROXIMACION[e.aproximacion],
    'resonadores acoplados',
    typeof e.orden === 'number'
      ? `Orden ${e.orden}`
      : `Orden desde As = ${formatearValor(e.orden.as, 'decibeles')} a fs = ${HZ(e.orden.fs)}`,
    banda,
    `Rs = ${R(e.rs)}`,
    `RL = ${R(e.rl)}`,
    `Qu = ${formatearValor(e.qBobina, 'numero')}`,
    e.inductancia === null ? 'L propuesta' : `L = ${formatearValor(e.inductancia, 'inductancia')}`,
  ].join(' · ');
}

type Calculado = Extract<ResultadoResonadores, { estado: 'calculado' }>;

function calculado(r: ResultadoResonadores): Calculado {
  if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
  return r;
}

const pasosDe = (r: Calculado): GrupoPasos[] => [
  { titulo: 'Resonadores acoplados', pasos: r.pasos },
];

const ORDEN_ENTERO = {
  tipo: 'absoluta',
  valor: 0,
  motivo: 'El Orden es un entero: tiene que ser el que pide el caso.',
} as const;

// La frecuencia de Ω en el mapeo de pasa banda, con el f0 y el FBW de Cohn: f/f0 − f0/f = Ω·FBW.
function frecuenciaDeOmega(r: Calculado, omega: number): number {
  const x = (omega * r.sintonia.fbw) / 2;
  return r.sintonia.f0 * (x + Math.sqrt(x * x + 1));
}

export function casoVerificacion(caso: CasoVerificacionResonadores): CasoDeRevision {
  const e = caso.entradas;
  const r = calculado(calcularResonadores(e, caso.opciones));
  const divisores = caso.conDivisor ? r.extremos.map((x) => x.divisor!) : null;
  const atenuacion = (f: number) => atenuacionAcoplada(r, f, e.rs, e.rl, { divisores });
  const f0 = r.sintonia.f0;
  const z = entradaAcoplada(r, f0, e.rl, divisores);
  const umbral = e.aproximacion === 'chebyshev' ? e.ripple! : 10 * Math.log10(2);
  const { f1, f2, bw } = r.banda;
  const bordes = caso.bordes && [
    bordeSimulado(atenuacion, f1 - bw / 2, f0, umbral),
    bordeSimulado(atenuacion, f2 + bw / 2, f0, umbral),
  ];
  return {
    clase: 'verificacion',
    id: caso.id,
    entradas: entradasTexto(e),
    referencia: caso.referencia,
    oraculo: caso.oraculo,
    ...(caso.bandera && { bandera: caso.bandera }),
    medidas: [
      ...(caso.orden === undefined
        ? []
        : [
            medidaNumerica({
              nombre: 'Orden',
              esperado: caso.orden,
              obtenido: r.orden,
              tolerancia: ORDEN_ENTERO,
              decimales: 0,
            }),
          ]),
      ...caso.valores.map(({ nombre, impreso, unidad }) =>
        medidaImpresa({
          nombre,
          impreso,
          obtenido: valorDe(r, nombre) * ESCALA_RESONADORES[unidad],
          tolerancia: toleranciaDeValores(e.aproximacion),
          unidad,
        }),
      ),
      medidaNumerica({
        nombre: `Pérdida simulada en la Frecuencia de sintonía, ${HZ(f0)}`,
        esperado: caso.enSintonia,
        obtenido: atenuacion(f0),
        tolerancia: TOLERANCIA_EXACTA_DB,
        decimales: 9,
        unidad: 'dB',
      }),
      // Adapta donde no pierde: en Chebyshev par la Frecuencia de sintonía es un pico del ripple.
      ...(caso.enSintonia === 0
        ? [
            medidaNumerica({
              nombre: 'Parte real de Zin en la Frecuencia de sintonía, contra Rs',
              esperado: e.rs,
              obtenido: z.re,
              tolerancia: TOLERANCIA_ADAPTA,
              decimales: 9,
              unidad: 'Ω',
            }),
            medidaNumerica({
              nombre: 'Parte imaginaria de Zin en la Frecuencia de sintonía',
              esperado: 0,
              obtenido: z.im,
              tolerancia: {
                ...TOLERANCIA_ADAPTA,
                tipo: 'absoluta',
                valor: TOLERANCIA_ADAPTA.valor * e.rs,
              },
              decimales: 9,
              unidad: 'Ω',
            }),
          ]
        : []),
      ...(bordes && caso.bordes
        ? (['bajo', 'alto'] as const).map((cual, i) =>
            medidaImpresa({
              nombre: `Borde ${cual} simulado`,
              impreso: caso.bordes![i],
              obtenido: bordes[i] * ESCALA_RESONADORES.MHz,
              tolerancia: TOLERANCIA_BORDES,
              unidad: 'MHz',
            }),
          )
        : []),
      ...caso.fueraDeBanda.map(({ omega, impreso }) => {
        const f = frecuenciaDeOmega(r, omega);
        return medidaImpresa({
          nombre: `Atenuación simulada en Ω = ${omega > 0 ? '+' : '−'}${Math.abs(omega)} (${HZ(f)})`,
          impreso,
          obtenido: atenuacion(f),
          tolerancia: TOLERANCIA_FUERA_DE_BANDA,
          unidad: 'dB',
        });
      }),
    ],
    pasos: pasosDe(r),
  };
}

export const TOLERANCIA_COHN_RESONADORES = {
  tipo: 'relativa',
  valor: 1e-3,
  motivo: 'Alrededor de la Diferencia esperada, que está escrita con 4 cifras: ±0,1 %.',
} as const;

export function casoCohn(caso: CasoCohnResonadores): CasoDeRevision {
  const e = caso.entradas;
  const r = calculado(calcularResonadores(e));
  const simulada = atenuacionAcoplada(r, r.sintonia.f0, e.rs, e.rl, { qu: e.qBobina });
  return {
    clase: 'verificacion',
    id: caso.id,
    entradas: entradasTexto(e),
    referencia: caso.referencia,
    oraculo: caso.oraculo,
    medidas: [
      medidaNumerica({
        nombre: 'Pérdida de Cohn contra la simulada con Qu',
        esperado: simulada,
        obtenido: r.perdidaCohn,
        tolerancia: TOLERANCIA_COHN_RESONADORES,
        diferencia: caso.diferencia,
        decimales: 5,
        unidad: 'dB',
      }),
    ],
    pasos: pasosDe(r),
  };
}

// La red del Asistente atenúa lo que dice: el barrido común y el oráculo son dos ABCD distintos.
export const TOLERANCIA_SIMULADA_DB = {
  tipo: 'absoluta',
  valor: 1e-9,
  motivo:
    'El Asistente simula la misma red con el barrido común (spec §5.7) y el oráculo con su propio ' +
    'ABCD: solo difieren en el redondeo.',
} as const;

// La misma del cálculo: el redondeo de las cuentas puede dejarla apenas debajo de As.
const SIN_FALTA = {
  tipo: 'absoluta',
  valor: 1e-9,
  motivo:
    'La red tiene que atenuar al menos As en fs: no puede faltarle nada, salvo el redondeo ' +
    '(1·10⁻⁹ dB, la tolerancia con que el cálculo da por cumplida la atenuación).',
} as const;

export function casoOrden(caso: CasoOrdenResonadores): CasoDeRevision {
  const e = caso.entradas;
  const pedido = e.orden as Exclude<EntradaResonadores['orden'], number>;
  const r = calculado(calcularResonadores(e));
  const atenuacion = (x: Calculado) => atenuacionAcoplada(x, pedido.fs, e.rs, e.rl);
  const orden = (nombre: string, esperado: number, obtenido: number) =>
    medidaNumerica({ nombre, esperado, obtenido, tolerancia: ORDEN_ENTERO, decimales: 0 });
  // Si la red subió el Orden del prototipo, con uno menos no llega. Nunca lo baja: abajo de la banda
  // la red atenúa más que el prototipo, pero el Orden sale del prototipo (spec §7.7).
  const anterior =
    r.orden > r.ordenCalculado!.prototipo.orden
      ? calculado(calcularResonadores({ ...e, orden: r.orden - 1 }))
      : null;
  const db = (x: number) => formatearValor(x, 'decibeles');
  return {
    clase: 'verificacion',
    id: caso.id,
    entradas: entradasTexto(e),
    referencia: caso.referencia,
    oraculo: caso.oraculo,
    medidas: [
      orden('Orden del prototipo', caso.ordenPrototipo, r.ordenCalculado!.prototipo.orden),
      orden('Orden calculado', caso.ordenEsperado, r.orden),
      medidaNumerica({
        nombre: `Atenuación de la red en ${HZ(pedido.fs)}, contra la que informa el Asistente`,
        esperado: atenuacion(r),
        obtenido: r.ordenCalculado!.atenuacionSimulada,
        tolerancia: TOLERANCIA_SIMULADA_DB,
        decimales: 4,
        unidad: 'dB',
      }),
      medidaNumerica({
        nombre: `Lo que le falta a la red para As = ${db(pedido.as)}`,
        esperado: 0,
        obtenido: Math.max(0, pedido.as - atenuacion(r)),
        tolerancia: SIN_FALTA,
        decimales: 4,
        unidad: 'dB',
      }),
      ...(anterior
        ? [
            medidaNumerica({
              nombre: `Lo que le sobra a la red de Orden ${anterior.orden} sobre As (no llega)`,
              esperado: 0,
              obtenido: Math.max(0, atenuacion(anterior) - pedido.as),
              tolerancia: {
                ...SIN_FALTA,
                motivo:
                  'Si la red subió el Orden, con uno menos no tiene que alcanzar As: es el mínimo.',
              },
              decimales: 4,
              unidad: 'dB',
            }),
          ]
        : []),
    ],
    pasos: pasosDe(r),
  };
}

const listaMarcados = (marcados: readonly (readonly [string, string])[]) =>
  [...marcados]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([nombre, nivel]) => `${nombre} ${nivel}`)
    .join(', ') || 'ninguno';

const conDivisor = (r: Calculado) => r.pasos.some((p) => /^Divisor capacitivo/.test(p.texto));

function describir(r: ResultadoResonadores, esperado: CasoComportamientoResonadores['esperado']) {
  if (r.estado === 'corte') return `corte: ${r.codigo}`;
  const fija = (campo: string) => !('corte' in esperado) && campo in esperado;
  return (
    `Orden ${r.orden} · avisos: ${r.avisos.map((a) => a.codigo).join(', ') || 'ninguno'}` +
    (fija('marcados')
      ? ` · marcados: ${listaMarcados(r.revision.marcados.map((m) => [m.nombre, m.nivel] as const))}`
      : '') +
    (fija('divisor') ? ` · divisor en los pasos: ${conDivisor(r) ? 'sí' : 'no'}` : '')
  );
}

function textoEsperado({ esperado }: CasoComportamientoResonadores): string {
  if ('corte' in esperado) return `corte: ${esperado.corte}`;
  return (
    `Orden ${esperado.orden} · avisos: ${esperado.avisos.join(', ') || 'ninguno'}` +
    (esperado.marcados ? ` · marcados: ${listaMarcados(Object.entries(esperado.marcados))}` : '') +
    (esperado.divisor === undefined
      ? ''
      : ` · divisor en los pasos: ${esperado.divisor ? 'sí' : 'no'}`)
  );
}

export function casoComportamiento(caso: CasoComportamientoResonadores): CasoDeComportamiento {
  const esperado = textoEsperado(caso);
  const obtenido = describir(calcularResonadores(caso.entradas, caso.opciones), caso.esperado);
  return {
    clase: 'comportamiento',
    id: caso.id,
    entradas: entradasTexto(caso.entradas),
    referencia: caso.referencia,
    ...(caso.bandera && { bandera: caso.bandera }),
    esperado,
    obtenido,
    coincide: esperado === obtenido,
  };
}

export const casosResonadores = (): CasoInforme[] => [
  ...CASOS_VERIFICACION_RESONADORES.map((c) => enCaso(c, () => casoVerificacion(c))),
  ...CASOS_COHN_RESONADORES.map((c) => enCaso(c, () => casoCohn(c))),
  ...CASOS_ORDEN_RESONADORES.map((c) => enCaso(c, () => casoOrden(c))),
  ...CASOS_COMPORTAMIENTO_RESONADORES.map((c) => enCaso(c, () => casoComportamiento(c))),
];
