import {
  type EntradaArreglos,
  type FilaArreglo,
  type ResultadoArreglos,
  MAGNITUD,
  type MagnitudArreglo,
  calcularArreglos,
  valoresSinInventario,
} from '../../../src/calculo/arreglos/arreglos';
import { formasDeConexion } from '../../../src/calculo/comun/arreglos';
import { formatearValor } from '../../../src/entrada/formato';
import {
  type AporteInforme,
  type CasoInforme,
  type GrupoPasos,
  type Medida,
  enCaso,
  medidaImpresa,
  medidaNumerica,
} from '../../casos-informe';
import { mejoresArreglos } from '../../oraculos/arreglos';
import {
  CASOS_COMPORTAMIENTO,
  CASOS_SERIES,
  CASOS_TOP10,
  CASO_EXCEPCIONES_E24,
  CASO_FORMAS,
  CASO_TOLERANCIA_47,
  TOLERANCIA_ORACULO,
  excepcionesE24,
  serieGuardada,
} from './casos';

// El adaptador de los Casos de prueba de Arreglos equivalentes para el Informe de casos (spec
// §13.6): corre el cálculo con las entradas de cada caso y deja el obtenido y los pasos como texto.

function entradasTexto(e: EntradaArreglos): string {
  const partes = [
    `${e.componente === 'capacitor' ? 'Capacitor' : 'Resistencia'} de ${formatearValor(e.buscado, MAGNITUD[e.componente])}`,
    `serie ${e.serie} completa`,
    `umbral ${formatearValor(e.umbral * 100, 'porcentaje')}`,
  ];
  return partes.join(' · ');
}

// La medida exacta de una lista o un texto: coincide o no.
function exacta(nombre: string, esperado: string, obtenido: string, motivo: string): Medida {
  return {
    nombre,
    esperado,
    obtenido,
    errorRelativo: null,
    tolerancia: 'exacto',
    motivo,
    dentro: esperado === obtenido,
  };
}

const TRANSCRIPCION = 'Es una tabla de valores: tiene que coincidir cifra por cifra.';

const series = (): CasoInforme[] => [
  ...CASOS_SERIES.map((caso) =>
    enCaso(caso, () => ({
      clase: 'referencia',
      id: caso.id,
      entradas: `Década de 1 a 10 de ${caso.serie}`,
      referencia: caso.referencia,
      medidas: [
        exacta(
          `${caso.serie} (${caso.esperado.length} valores)`,
          caso.esperado.join(' · '),
          serieGuardada(caso.serie).join(' · '),
          TRANSCRIPCION,
        ),
      ],
      pasos: [],
    })),
  ),
  enCaso(CASO_EXCEPCIONES_E24, () => {
    const escribir = (pares: readonly (readonly string[])[]) =>
      pares.map(([tabla, formula]) => `${tabla} (fórmula ${formula})`).join(' · ');
    return {
      clase: 'referencia',
      id: CASO_EXCEPCIONES_E24.id,
      entradas: 'E24 guardada contra 10^(i/24) redondeado a 2 cifras',
      referencia: CASO_EXCEPCIONES_E24.referencia,
      medidas: [
        exacta(
          'Valores históricos',
          escribir(CASO_EXCEPCIONES_E24.esperado),
          escribir(excepcionesE24()),
          'Por eso la serie se guarda como tabla y no se genera por fórmula.',
        ),
      ],
      pasos: [],
    };
  }),
  enCaso(CASO_FORMAS, () => ({
    clase: 'referencia',
    id: CASO_FORMAS.id,
    entradas: 'Árboles alternantes serie/paralelo con los hijos ordenados',
    referencia: CASO_FORMAS.referencia,
    medidas: [1, 2, 3, 4].map((n) =>
      exacta(
        `${n} ${n === 1 ? 'componente' : 'componentes'}`,
        String(CASO_FORMAS.esperado[n - 1]),
        String(formasDeConexion(n).length),
        'Es una cuenta: tiene que coincidir.',
      ),
    ),
    pasos: [],
  })),
];

function pasosDe(r: ResultadoArreglos, fila: FilaArreglo | undefined): GrupoPasos[] {
  return [
    { titulo: 'Búsqueda', pasos: r.pasos },
    ...(fila ? [{ titulo: `Fila: ${fila.conexion}`, pasos: fila.pasos }] : []),
  ];
}

const top10 = (): CasoInforme[] =>
  CASOS_TOP10.map((caso) =>
    enCaso(caso, () => {
      const { entrada } = caso;
      const r = calcularArreglos(entrada);
      const valores = valoresSinInventario(entrada.componente, entrada.serie);
      const esperado = mejoresArreglos(valores, entrada.buscado, entrada.umbral);
      const magnitud = MAGNITUD[entrada.componente];
      const medidas = esperado.flatMap((e, i): Medida[] => {
        const f = r.filas[i];
        const nombre = `Fila ${i + 1}`;
        if (!f) return [exacta(nombre, formatearValor(e.valor, magnitud, 'paso'), 'falta', '')];
        return [
          medidaNumerica({
            nombre: `${nombre}: ${f.conexion}`,
            esperado: e.valor / escala(magnitud),
            obtenido: f.valor / escala(magnitud),
            tolerancia: TOLERANCIA_ORACULO,
            decimales: 6,
            unidad: magnitud === 'capacidad' ? 'pF' : 'Ω',
          }),
          exacta(
            `${nombre}: componentes`,
            String(e.componentes),
            String(f.componentes),
            'Es una cuenta: tiene que coincidir.',
          ),
          // En %: un Arreglo exacto deja un residuo de redondeo de 1e-14 % del lado del oráculo.
          medidaNumerica({
            nombre: `${nombre}: Error del arreglo`,
            esperado: e.error * 100,
            obtenido: f.error * 100,
            tolerancia: ERROR_DEL_ORACULO,
            decimales: 6,
            unidad: '%',
          }),
        ];
      });
      return {
        clase: 'verificacion',
        id: caso.id,
        entradas: entradasTexto(entrada),
        referencia: caso.referencia,
        oraculo: caso.oraculo,
        medidas,
        pasos: pasosDe(r, r.filas[0]),
      };
    }),
  );

const ERROR_DEL_ORACULO = {
  tipo: 'absoluta',
  valor: 1e-7,
  motivo: 'Verificación: 1e-9 de diferencia en la fracción, o sea 1e-7 en %.',
} as const;

const escala = (magnitud: MagnitudArreglo) => (magnitud === 'capacidad' ? 1e-12 : 1);

const tolerancia47 = (): CasoInforme =>
  enCaso(CASO_TOLERANCIA_47, () => {
    const caso = CASO_TOLERANCIA_47;
    const r = calcularArreglos(caso.entrada);
    const fila = r.filas.find((f) => f.conexion === caso.conexion);
    if (!fila) throw new Error(`no está la fila ${caso.conexion}`);
    const { minimo, maximo } = fila.tolerancia;
    const medida = (nombre: string, impreso: string, obtenido: number, unidad: string) =>
      medidaImpresa({ nombre, impreso, obtenido, tolerancia: caso.tolerancia, unidad });
    return {
      clase: 'verificacion',
      id: caso.id,
      entradas: entradasTexto(caso.entrada),
      referencia: caso.referencia,
      oraculo: caso.oraculo,
      medidas: [
        medida('Mínimo', caso.esperado.minimo, minimo / 1e-12, 'pF'),
        medida('Máximo', caso.esperado.maximo, maximo / 1e-12, 'pF'),
        medida('Hacia abajo', caso.esperado.abajo, ((fila.valor - minimo) / fila.valor) * 100, '%'),
        medida(
          'Hacia arriba',
          caso.esperado.arriba,
          ((maximo - fila.valor) / fila.valor) * 100,
          '%',
        ),
      ],
      pasos: [{ titulo: 'Cuenta a mano', pasos: caso.cuentaAMano }, ...pasosDe(r, fila)],
    };
  });

const comportamiento = (): CasoInforme[] =>
  CASOS_COMPORTAMIENTO.map((caso) =>
    enCaso(caso, () => {
      const obtenido = caso.observar(calcularArreglos(caso.entrada));
      return {
        clase: 'comportamiento',
        id: caso.id,
        entradas: entradasTexto(caso.entrada),
        referencia: caso.referencia,
        esperado: caso.esperado,
        obtenido,
        coincide: obtenido === caso.esperado,
      };
    }),
  );

export const INFORME: AporteInforme = {
  calculadora: 'arreglos',
  casos: () => [...series(), ...top10(), tolerancia47(), ...comportamiento()],
};
