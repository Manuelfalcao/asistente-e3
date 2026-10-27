import {
  type Atenuador,
  type EntradaAtenuador,
  type EntradaMinimaPerdida,
  calcularAtenuadores,
  calcularMinimaPerdida,
} from '../../../src/calculo/atenuadores/atenuadores';
import { formatearValor } from '../../../src/entrada/formato';
import { MEDIA_UNIDAD } from '../../casos';
import {
  type AporteInforme,
  type CasoInforme,
  type GrupoPasos,
  type Medida,
  enCaso,
  medidaImpresa,
  medidaNumerica,
} from '../../casos-informe';
import {
  CASOS_COMPORTAMIENTO,
  CASOS_REFERENCIA,
  CASOS_VALOR,
  type CasoComportamiento,
  type CasoValor,
} from './casos';
import {
  CASOS_POTENCIA,
  CASOS_REFERENCIA_PAD,
  CASOS_VERIFICACION,
  CASOS_VERIFICACION_PAD,
  GRILLA_ATENUACIONES,
  GRILLA_IMPEDANCIAS,
  TOLERANCIA_ORACULO,
} from './casos-pad';
import {
  CASOS_COMPORTAMIENTO_COMERCIAL,
  CASOS_VERIFICACION_COMERCIAL,
  TOLERANCIA_COMERCIAL,
} from './casos-comerciales';
import { valoresDelCaso } from './comerciales';
import { escaleraDeAtenuador, escaleraDePad, medir, medirOpcion, potencias } from './elementos';
import { recorrerGrilla, recorrerGrillaPad } from './grilla';

// El adaptador de las tablas de Casos de prueba de atenuadores para el Informe de casos (spec
// §13.6): corre el cálculo con las entradas de cada caso y deja el obtenido, el error y los pasos
// intermedios como texto. Las tablas son las mismas que corre Vitest.

const R = (ohms: number) => formatearValor(ohms, 'resistencia');
const DB = (db: number) => formatearValor(db, 'decibeles');

function entradasTexto(e: EntradaAtenuador | EntradaMinimaPerdida): string {
  const partes = [`Z₁ = ${R(e.z1)}`, `Z₂ = ${R(e.z2)}`];
  if ('atenuacion' in e) partes.push(`A = ${DB(e.atenuacion)}`);
  if (e.frecuencia) partes.push(`f = ${formatearValor(e.frecuencia, 'frecuencia')}`);
  if (e.potencia) partes.push(`P = ${formatearValor(e.potencia, 'potencia')}`);
  return partes.join(' · ');
}

function calculado(entradas: EntradaAtenuador) {
  const r = calcularAtenuadores(entradas);
  if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
  return r;
}

function pad(entradas: EntradaMinimaPerdida) {
  const r = calcularMinimaPerdida(entradas);
  if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
  return r;
}

const pasosT = (r: { t: Atenuador; pi: Atenuador }): GrupoPasos[] => [
  { titulo: 'Atenuador T', pasos: r.t.pasos },
];
const pasosTyPi = (r: { t: Atenuador; pi: Atenuador }): GrupoPasos[] => [
  { titulo: 'Atenuador T', pasos: r.t.pasos },
  { titulo: 'Atenuador π', pasos: r.pi.pasos },
];

const NOMBRES = ['r1', 'r2', 'r3'] as const;
const { impedancia, atenuacion: tolAtenuacion } = TOLERANCIA_ORACULO;

// Lo que da el oráculo ABCD con las resistencias calculadas, contra lo que se pidió.
function medidasDelOraculo(
  etiqueta: string,
  m: ReturnType<typeof medir>,
  z1: number,
  z2: number,
  atenuacion: number,
): Medida[] {
  return [
    medidaNumerica({
      nombre: `Z entrada (${etiqueta})`,
      esperado: z1,
      obtenido: m.zEntrada,
      tolerancia: impedancia,
      decimales: 9,
      unidad: 'Ω',
    }),
    medidaNumerica({
      nombre: `Z salida (${etiqueta})`,
      esperado: z2,
      obtenido: m.zSalida,
      tolerancia: impedancia,
      decimales: 9,
      unidad: 'Ω',
    }),
    medidaNumerica({
      nombre: `Atenuación (${etiqueta})`,
      esperado: atenuacion,
      obtenido: m.atenuacion,
      tolerancia: tolAtenuacion,
      decimales: 9,
      unidad: 'dB',
    }),
  ];
}

// --- Referencia: Fig. 8 y Fig. 7 -----------------------------------------------------------------

const referenciaT = () =>
  CASOS_REFERENCIA.map((caso) =>
    enCaso(caso, () => {
      const r = calculado(caso.entradas);
      return {
        clase: 'referencia',
        id: caso.id,
        entradas: entradasTexto(caso.entradas),
        referencia: caso.referencia,
        medidas: NOMBRES.map((n) =>
          medidaImpresa({
            nombre: `${n.toUpperCase()} (T)`,
            impreso: caso.esperado[n],
            obtenido: r.t[n].valor,
            tolerancia: caso.tolerancia,
            diferencia: caso.diferencia,
            unidad: 'Ω',
          }),
        ),
        pasos: pasosT(r),
      };
    }),
  );

const referenciaPad = () =>
  CASOS_REFERENCIA_PAD.map((caso) =>
    enCaso(caso, () => {
      const r = pad(caso.entradas);
      const { perdida, serie, derivacion } = caso.esperado;
      return {
        clase: 'referencia',
        id: caso.id,
        entradas: entradasTexto(caso.entradas),
        referencia: caso.referencia,
        medidas: [
          medidaImpresa({
            nombre: 'Pérdida',
            impreso: perdida,
            obtenido: r.aMin,
            tolerancia: caso.tolerancia,
            unidad: 'dB',
          }),
          medidaImpresa({
            nombre: 'R1 (serie)',
            impreso: serie,
            obtenido: r.pad.serie.valor,
            tolerancia: caso.tolerancia,
            unidad: 'Ω',
          }),
          medidaImpresa({
            nombre: 'R3 (derivación)',
            impreso: derivacion,
            obtenido: r.pad.derivacion.valor,
            tolerancia: caso.tolerancia,
            unidad: 'Ω',
          }),
        ],
        pasos: [{ titulo: 'Pad de mínima pérdida', pasos: r.pad.pasos }],
      };
    }),
  );

// --- Verificación: A1 a A15 y las grillas --------------------------------------------------------

const verificacionTyPi = () =>
  CASOS_VERIFICACION.map((caso) =>
    enCaso(caso, () => {
      const { atenuacion, z1, z2 } = caso.entradas;
      const r = calculado(caso.entradas);
      const impresas = (['t', 'pi'] as const).flatMap((clave) =>
        NOMBRES.flatMap((n) => {
          const impreso = caso.esperado[clave]?.[n];
          return impreso === undefined
            ? []
            : [
                medidaImpresa({
                  nombre: `${n.toUpperCase()} (${r[clave].topologia})`,
                  impreso,
                  obtenido: r[clave][n].valor,
                  tolerancia: MEDIA_UNIDAD,
                  unidad: 'Ω',
                }),
              ];
        }),
      );
      const oraculo = (['t', 'pi'] as const).flatMap((clave) =>
        medidasDelOraculo(
          r[clave].topologia,
          medir(escaleraDeAtenuador(r[clave]), z1, z2),
          z1,
          z2,
          atenuacion,
        ),
      );
      return {
        clase: 'verificacion',
        id: caso.id,
        entradas: entradasTexto(caso.entradas),
        referencia: caso.referencia,
        oraculo: caso.oraculo,
        medidas: [...impresas, ...oraculo],
        pasos: pasosTyPi(r),
      };
    }),
  );

const verificacionPad = () =>
  CASOS_VERIFICACION_PAD.map((caso) =>
    enCaso(caso, () => {
      const r = pad(caso.entradas);
      const { aMin, serie, derivacion } = caso.esperado;
      const { z1, z2 } = caso.entradas;
      return {
        clase: 'verificacion',
        id: caso.id,
        entradas: entradasTexto(caso.entradas),
        referencia: caso.referencia,
        oraculo: caso.oraculo,
        medidas: [
          medidaImpresa({
            nombre: 'A_min',
            impreso: aMin,
            obtenido: r.aMin,
            tolerancia: MEDIA_UNIDAD,
            unidad: 'dB',
          }),
          medidaImpresa({
            nombre: 'R1 (serie)',
            impreso: serie,
            obtenido: r.pad.serie.valor,
            tolerancia: MEDIA_UNIDAD,
            unidad: 'Ω',
          }),
          medidaImpresa({
            nombre: 'R3 (derivación)',
            impreso: derivacion,
            obtenido: r.pad.derivacion.valor,
            tolerancia: MEDIA_UNIDAD,
            unidad: 'Ω',
          }),
          ...medidasDelOraculo('pad', medir(escaleraDePad(r.pad), z1, z2), z1, z2, r.aMin),
        ],
        pasos: [{ titulo: 'Pad de mínima pérdida', pasos: r.pad.pasos }],
      };
    }),
  );

const verificacionPotencia = () =>
  CASOS_POTENCIA.map((caso) =>
    enCaso(caso, () => {
      const { z2, potencia } = caso.entradas;
      const r = calculado(caso.entradas);
      const medidas = (['t', 'pi'] as const).flatMap((clave) => {
        const red = r[clave];
        const delOraculo = potencias(escaleraDeAtenuador(red), z2, potencia!);
        return NOMBRES.flatMap((n) => {
          const disipada = red.potencia?.resistencias.find((x) => x.nombre === n.toUpperCase());
          if (!disipada) throw new Error(`sin potencia de ${n.toUpperCase()}`);
          const nombre = `${n.toUpperCase()} (${red.topologia})`;
          const impreso = caso.esperado[clave]?.[n];
          return [
            ...(impreso === undefined
              ? []
              : [
                  medidaImpresa({
                    nombre: `P ${nombre}`,
                    impreso,
                    obtenido: disipada.disipada,
                    tolerancia: MEDIA_UNIDAD,
                    unidad: 'W',
                  }),
                ]),
            medidaNumerica({
              nombre: `P ${nombre}, oráculo`,
              esperado: delOraculo.get(disipada.nombre)!,
              obtenido: disipada.disipada,
              tolerancia: { ...impedancia, tipo: 'absoluta', valor: 1e-9 * potencia! },
              decimales: 9,
              unidad: 'W',
            }),
          ];
        });
      });
      return {
        clase: 'verificacion',
        id: caso.id,
        entradas: entradasTexto(caso.entradas),
        referencia: caso.referencia,
        oraculo: caso.oraculo,
        medidas,
        pasos: pasosTyPi(r),
      };
    }),
  );

const lista = (xs: readonly number[], formato: (x: number) => string) => xs.map(formato).join(', ');

function medidasDeGrilla(g: ReturnType<typeof recorrerGrillaPad>): Medida[] {
  const casos: [
    string,
    { valor: number; donde: string },
    typeof impedancia | typeof tolAtenuacion,
  ][] = [
    ['Peor |Z entrada / Z₁ − 1|', g.zEntrada, impedancia],
    ['Peor |Z salida / Z₂ − 1|', g.zSalida, impedancia],
    ['Peor error de la atenuación (dB)', g.atenuacion, tolAtenuacion],
  ];
  return casos.map(([nombre, peor, tolerancia]) => ({
    ...medidaNumerica({
      nombre: `${nombre} en ${g.redes} redes`,
      esperado: 0,
      obtenido: peor.valor,
      // Contra cero no hay error relativo: el valor ya es el error.
      tolerancia: { tipo: 'absoluta', valor: tolerancia.valor, motivo: tolerancia.motivo },
      decimales: null,
    }),
    // Dónde estuvo el peor, para que quien revise pueda reproducirlo.
    motivo: `${tolerancia.motivo} El peor: ${peor.donde}.`,
  }));
}

const grillaTyPi = (): CasoInforme =>
  enCaso({ id: 'Grilla de Z1, Z2 y dB', referencia: 'spec §13.3' }, () => {
    const g = recorrerGrilla();
    return {
      clase: 'verificacion',
      id: 'Grilla de Z1, Z2 y dB',
      entradas:
        `Z₁ y Z₂ en {${lista(GRILLA_IMPEDANCIAS, R)}}; A en {${lista(GRILLA_ATENUACIONES, DB)}}; ` +
        'T y π; las de debajo de A_min son un corte',
      referencia: 'spec §13.3 (Atenuadores, verificación)',
      oraculo: 'tests/oraculos/abcd.ts (ABCD con complejos)',
      medidas: [
        ...medidasDeGrilla(g),
        {
          nombre: 'Cortes fuera de lugar',
          esperado: '0',
          obtenido: String(g.fueraDeLugar.length),
          errorRelativo: null,
          tolerancia: '= 0',
          motivo: 'A ≤ A_min debe cortar y A > A_min debe calcular.',
          dentro: g.fueraDeLugar.length === 0,
        },
      ],
      pasos: [],
    };
  });

const grillaPad = (): CasoInforme =>
  enCaso({ id: 'Grilla del pad', referencia: 'spec §13.3' }, () => {
    const g = recorrerGrillaPad();
    return {
      clase: 'verificacion',
      id: 'Grilla del pad',
      entradas: `Z₁ y Z₂ distintas en {${lista(GRILLA_IMPEDANCIAS, R)}}`,
      referencia: 'spec §13.3 (Atenuadores, verificación)',
      oraculo: 'tests/oraculos/abcd.ts (ABCD con complejos)',
      medidas: medidasDeGrilla(g),
      pasos: [],
    };
  });

// --- Comportamiento ------------------------------------------------------------------------------

function describirResultado(r: ReturnType<typeof calcularAtenuadores>): string {
  return r.estado === 'corte'
    ? `corte: ${r.codigo}`
    : `avisos: ${r.avisos.length ? r.avisos.map((a) => a.codigo).join(', ') : 'ninguno'}`;
}

const comportamiento = () =>
  CASOS_COMPORTAMIENTO.map((caso: CasoComportamiento) =>
    enCaso(caso, () => {
      const esperado =
        'corte' in caso.esperado
          ? `corte: ${caso.esperado.corte}`
          : `avisos: ${caso.esperado.avisos.length ? caso.esperado.avisos.join(', ') : 'ninguno'}`;
      const obtenido = describirResultado(calcularAtenuadores(caso.entradas));
      return {
        clase: 'comportamiento',
        id: caso.id,
        entradas: entradasTexto(caso.entradas),
        referencia: caso.referencia,
        esperado,
        obtenido,
        coincide: esperado === obtenido,
      };
    }),
  );

const niveles = (red: Atenuador) =>
  red.revision.marcados.length
    ? [...red.revision.marcados]
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
        .map((m) => `${m.nombre} ${m.nivel}`)
        .join(', ')
    : 'nada marcado';

const esperadoDeValor = (e: CasoValor['esperado']['t']) =>
  Object.keys(e).length
    ? Object.entries(e)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([nombre, nivel]) => `${nombre} ${nivel}`)
        .join(', ')
    : 'nada marcado';

const valorImpracticable = () =>
  CASOS_VALOR.map((caso) =>
    enCaso(caso, () => {
      const r = calculado(caso.entradas);
      const esperado = `T: ${esperadoDeValor(caso.esperado.t)} · π: ${esperadoDeValor(caso.esperado.pi)}`;
      const obtenido = `T: ${niveles(r.t)} · π: ${niveles(r.pi)}`;
      return {
        clase: 'comportamiento',
        id: caso.id,
        entradas: entradasTexto(caso.entradas),
        referencia: caso.referencia,
        esperado,
        obtenido,
        coincide: esperado === obtenido,
      };
    }),
  );

// --- Valores comerciales -------------------------------------------------------------------------

const valores = (xs: readonly number[]) => xs.map(R).join(' · ');

const verificacionComercial = () =>
  CASOS_VERIFICACION_COMERCIAL.map((caso) =>
    enCaso(caso, () => {
      const v = valoresDelCaso(caso);
      const opciones = [
        ['redondeo', v.redondeo],
        ...v.mejores.map((o, i) => [`mejor ${i + 1}`, o] as const),
      ] as const;
      const medidas = opciones.flatMap(([nombre, o]) => {
        const m = medirOpcion(o, caso.z1, caso.z2);
        const etiqueta = `${nombre}: ${valores(o.resistencias.map((r) => r.valor))}`;
        return [
          medidaNumerica({
            nombre: `Atenuación (${etiqueta})`,
            esperado: m.atenuacion,
            obtenido: o.atenuacion,
            tolerancia: TOLERANCIA_COMERCIAL.atenuacion,
            decimales: 9,
            unidad: 'dB',
          }),
          medidaNumerica({
            nombre: `PR de entrada (${etiqueta})`,
            esperado: m.prEntrada,
            obtenido: o.prEntrada,
            tolerancia: TOLERANCIA_COMERCIAL.perdidaDeRetorno,
            decimales: 6,
            unidad: 'dB',
          }),
          medidaNumerica({
            nombre: `PR de salida (${etiqueta})`,
            esperado: m.prSalida,
            obtenido: o.prSalida,
            tolerancia: TOLERANCIA_COMERCIAL.perdidaDeRetorno,
            decimales: 6,
            unidad: 'dB',
          }),
        ];
      });
      return {
        clase: 'verificacion',
        id: caso.id,
        entradas:
          `${caso.topologia === 'pad' ? 'pad de mínima pérdida' : `${caso.topologia} de ${DB(caso.atenuacion!)}`}` +
          ` · Z₁ = ${R(caso.z1)} · Z₂ = ${R(caso.z2)} · ${caso.redondeo}`,
        referencia: caso.referencia,
        oraculo: caso.oraculo,
        medidas,
        pasos: [],
      };
    }),
  );

const comportamientoComercial = () =>
  CASOS_COMPORTAMIENTO_COMERCIAL.map((caso) =>
    enCaso(caso, () => {
      const v = valoresDelCaso(caso);
      const describir = (r: readonly number[], evaluadas: number, adentro: boolean) =>
        `redondeo ${valores(r)} · ${evaluadas} combinaciones · ` +
        (adentro ? 'hay en la ventana' : 'ninguna en la ventana, con aviso');
      const esperado = describir(
        caso.esperado.redondeo,
        caso.esperado.evaluadas,
        caso.esperado.dentroDeLaVentana,
      );
      const obtenido = describir(
        v.redondeo.resistencias.map((r) => r.valor),
        v.evaluadas,
        v.dentroDeLaVentana,
      );
      return {
        clase: 'comportamiento',
        id: caso.id,
        entradas:
          `${caso.topologia} de ${DB(caso.atenuacion!)} · Z₁ = ${R(caso.z1)} · Z₂ = ${R(caso.z2)} · ` +
          `${caso.redondeo}` +
          (caso.inventario ? ` (${valores(caso.inventario)})` : '') +
          (caso.ventana ? ` · ventana ±${DB(caso.ventana)}` : ''),
        referencia: caso.referencia,
        esperado,
        obtenido,
        coincide: esperado === obtenido,
      };
    }),
  );

export const INFORME: AporteInforme = {
  calculadora: 'atenuadores',
  casos: () => [
    ...referenciaT(),
    ...referenciaPad(),
    ...verificacionTyPi(),
    ...verificacionPad(),
    ...verificacionPotencia(),
    grillaTyPi(),
    grillaPad(),
    ...comportamiento(),
    ...valorImpracticable(),
    ...verificacionComercial(),
    ...comportamientoComercial(),
  ],
};
