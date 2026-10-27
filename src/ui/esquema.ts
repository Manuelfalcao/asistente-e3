// Trazado de una red en escalera entre la fuente y la carga: puro, sin DOM. Esquema.tsx solo dibuja
// lo que devuelve. Medidas en px de pantalla: el SVG se dibuja a escala 1:1.

export type Posicion = 'serie' | 'derivacion';

export type Elemento =
  | { tipo: 'R' | 'L' | 'C'; posicion: Posicion; nombre: string }
  // Resonador de pasa banda y rechaza banda, o de resonadores acoplados: L y C en serie o en paralelo.
  | {
      tipo: 'LC';
      conexion: 'serie' | 'paralelo';
      posicion: Posicion;
      nombreL: string;
      nombreC: string;
    };

type Simple = Extract<Elemento, { tipo: 'R' | 'L' | 'C' }>;
type Resonador = Extract<Elemento, { tipo: 'LC' }>;

export interface Escalera {
  // Rótulos de los extremos; "_" marca el subíndice: "R_s", "Z_1".
  fuente: string;
  carga: string;
  elementos: readonly Elemento[];
}

export interface Punto {
  x: number;
  y: number;
}

export interface Rotulo extends Punto {
  texto: string;
  sub?: string;
  ancla: 'start' | 'middle' | 'end';
}

export interface Conector extends Punto {
  numero: number;
}

export interface Fila {
  ancho: number;
  alto: number;
  // Cables y símbolos, como un único `d` de <path>.
  trazo: string;
  nodos: Punto[];
  terminales: Punto[];
  // Donde se corta la escalera: el mismo número al final de una fila y al principio de la otra.
  conectores: Conector[];
  rotulos: Rotulo[];
}

export interface Esquema {
  filas: Fila[];
  // El circuito en una oración, para el lector de pantalla.
  descripcion: string;
}

// Esquema.tsx dibuja los rótulos con estos tamaños: el trazado reparte el ancho con ellos.
export const TAM_ROTULO = 13;
export const TAM_SUBINDICE = 10;
export const TAM_CONECTOR = 11;
export const RADIO_TERMINAL = 3;
export const RADIO_CONECTOR = 8;

const LARGO = 36; // largo de un símbolo con sus patas, a lo largo del cable
const MARGEN = 2;
const SOBRE = 13; // de la línea de base de un rótulo encima del cable hasta el cable
const CENTRADO = 4.5; // cuánto baja la línea de base para centrar un rótulo en altura
const PATA = 8; // del cable al símbolo de una rama en derivación
const AL_LADO = 12; // del eje de una rama en derivación a su rótulo

interface Celda {
  ancho: number;
  arriba: number; // cuánto ocupa por encima del cable
  abajo: number; // y por debajo
  dibujar(x: number, y: number, fila: Fila): void;
}

// Con `anchoMax` chico la escalera se parte en la menor cantidad de filas que entran, lo más
// parejas posible. Si ni con un elemento por fila entra, cada fila lleva uno y se pasa del ancho.
export function trazarEsquema(escalera: Escalera, anchoMax: number): Esquema {
  const fuente = puertoFuente(escalera.fuente);
  const carga = puertoCarga(escalera.carga);
  const elementos = escalera.elementos.map(celdaDe);
  const grupos = repartir(elementos, fuente.ancho, carga.ancho, anchoMax);

  const celdasPorFila = grupos.map((grupo, i) => [
    i === 0 ? fuente : conector(i, 'entrada'),
    ...grupo,
    i === grupos.length - 1 ? carga : conector(i + 1, 'salida'),
  ]);
  const todas = celdasPorFila.flat();
  const y = Math.max(...todas.map((c) => c.arriba)) + MARGEN;
  const alto = y + Math.max(...todas.map((c) => c.abajo)) + MARGEN;

  const filas = celdasPorFila.map((celdas) => {
    const fila: Fila = {
      ancho: 0,
      alto,
      trazo: '',
      nodos: [],
      terminales: [],
      conectores: [],
      rotulos: [],
    };
    for (const celda of celdas) {
      celda.dibujar(fila.ancho, y, fila);
      fila.ancho += celda.ancho;
    }
    return fila;
  });
  return { filas, descripcion: describir(escalera) };
}

function describir({ fuente, carga, elementos }: Escalera): string {
  const plano = (nombre: string) => nombre.replace('_', '');
  const partes = elementos.map((e) => {
    const donde = e.posicion === 'serie' ? 'en serie' : 'en derivación';
    return e.tipo === 'LC'
      ? `${plano(e.nombreL)} y ${plano(e.nombreC)} (resonador ${e.conexion}) ${donde}`
      : `${plano(e.nombre)} ${donde}`;
  });
  const lista =
    partes.length > 1
      ? `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
      : partes.join('');
  return `De ${plano(fuente)} a ${plano(carga)}: ${lista}.`;
}

// Partición en grupos consecutivos que minimiza la fila más ancha, con la menor cantidad de filas
// que entra en `anchoMax`.
function repartir(celdas: Celda[], fuente: number, carga: number, anchoMax: number): Celda[][] {
  const n = celdas.length;
  if (n === 0) return [[]];
  const suma = [0];
  for (const c of celdas) suma.push(suma[suma.length - 1] + c.ancho);
  const anchoFila = (desde: number, hasta: number) =>
    (desde === 0 ? fuente : ANCHO_CONECTOR) +
    suma[hasta] -
    suma[desde] +
    (hasta === n ? carga : ANCHO_CONECTOR);

  // mejor[k][j]: la fila más ancha al repartir los primeros j elementos en k filas
  const mejor: number[][] = [[0, ...Array<number>(n).fill(Infinity)]];
  const corte: number[][] = [[]];
  for (let k = 1; k <= n; k++) {
    mejor.push(Array<number>(n + 1).fill(Infinity));
    corte.push(Array<number>(n + 1).fill(0));
    for (let j = k; j <= n; j++) {
      for (let i = k - 1; i < j; i++) {
        const m = Math.max(mejor[k - 1][i], anchoFila(i, j));
        if (m < mejor[k][j]) {
          mejor[k][j] = m;
          corte[k][j] = i;
        }
      }
    }
    if (mejor[k][n] <= anchoMax || k === n) {
      const grupos: Celda[][] = [];
      for (let fila = k, j = n; fila > 0; fila--) {
        const i = corte[fila][j];
        grupos.unshift(celdas.slice(i, j));
        j = i;
      }
      return grupos;
    }
  }
  throw new Error('inalcanzable');
}

const ANCHO_CONECTOR = 6 + 2 * RADIO_CONECTOR + 2;

// El conector numerado de un corte: al final de una fila (salida) y al principio de la otra.
function conector(numero: number, lado: 'entrada' | 'salida'): Celda {
  const salida = lado === 'salida';
  return {
    ancho: ANCHO_CONECTOR,
    arriba: RADIO_CONECTOR + 1,
    abajo: RADIO_CONECTOR + 1,
    dibujar(x, y, fila) {
      fila.trazo += `M${salida ? x : x + ANCHO_CONECTOR - 6} ${y}h6`;
      fila.conectores.push({ x: x + (salida ? 6 : 2) + RADIO_CONECTOR, y, numero });
    },
  };
}

function celdaDe(e: Elemento): Celda {
  if (e.tipo !== 'LC') return e.posicion === 'serie' ? enSerie(e) : enDerivacion(e);
  if (e.posicion === 'serie') return e.conexion === 'serie' ? serieEnSerie(e) : paraleloEnSerie(e);
  return e.conexion === 'serie' ? serieEnDerivacion(e) : paraleloEnDerivacion(e);
}

const ARRIBA_ROTULO = SOBRE + TAM_ROTULO * 0.75; // un rótulo encima del cable
const ABAJO_DERIVACION = PATA + LARGO + 15; // pata, símbolo y masa (con su pata)
const NODO = 12; // del borde de la celda al nodo de una rama en derivación

// Línea de base del rótulo del símbolo n (0, 1…) de una rama en derivación, centrado en él.
const junto = (y: number, n: number) => y + PATA + (n + 0.5) * LARGO + CENTRADO;

function enSerie(e: Simple): Celda {
  const ancho = Math.max(LARGO + 8, anchoRotulo(e.nombre) + 8);
  return {
    ancho,
    arriba: ARRIBA_ROTULO,
    abajo: 9,
    dibujar(x, y, fila) {
      const cx = x + ancho / 2;
      fila.trazo += `M${x} ${y}H${cx - LARGO / 2}` + simbolo(e.tipo, cx - LARGO / 2, y, 'h');
      fila.trazo += `M${cx + LARGO / 2} ${y}H${x + ancho}`;
      fila.rotulos.push({ ...partir(e.nombre), x: cx, y: y - SOBRE, ancla: 'middle' });
    },
  };
}

function enDerivacion(e: Simple): Celda {
  const ancho = Math.max(LARGO + 8, NODO + AL_LADO + anchoRotulo(e.nombre) + 4);
  return {
    ancho,
    arriba: RADIO_TERMINAL,
    abajo: ABAJO_DERIVACION,
    dibujar(x, y, fila) {
      const cx = x + NODO;
      fila.trazo += `M${x} ${y}H${x + ancho}M${cx} ${y}v${PATA}`;
      fila.trazo += simbolo(e.tipo, cx, y + PATA, 'v') + masa(cx, y + PATA + LARGO);
      fila.nodos.push({ x: cx, y });
      fila.rotulos.push({ ...partir(e.nombre), x: cx + AL_LADO, y: junto(y, 0), ancla: 'start' });
    },
  };
}

// Pasa banda, rama en serie: L y C uno detrás del otro, cada uno con su rótulo encima.
function serieEnSerie(e: Resonador): Celda {
  const tramo = Math.max(LARGO, Math.max(anchoRotulo(e.nombreL), anchoRotulo(e.nombreC)) + 6);
  const ancho = 8 + 2 * tramo;
  return {
    ancho,
    arriba: ARRIBA_ROTULO,
    abajo: 9,
    dibujar(x, y, fila) {
      const cL = x + 4 + tramo / 2;
      const cC = cL + tramo;
      fila.trazo += `M${x} ${y}H${cL - LARGO / 2}` + simbolo('L', cL - LARGO / 2, y, 'h');
      fila.trazo +=
        `M${cL + LARGO / 2} ${y}H${cC - LARGO / 2}` + simbolo('C', cC - LARGO / 2, y, 'h');
      fila.trazo += `M${cC + LARGO / 2} ${y}H${x + ancho}`;
      fila.rotulos.push({ ...partir(e.nombreL), x: cL, y: y - SOBRE, ancla: 'middle' });
      fila.rotulos.push({ ...partir(e.nombreC), x: cC, y: y - SOBRE, ancla: 'middle' });
    },
  };
}

// Rechaza banda, rama en serie: L arriba y C abajo, entre dos uniones sobre el cable.
function paraleloEnSerie(e: Resonador): Celda {
  const ancho = Math.max(LARGO + 24, Math.max(anchoRotulo(e.nombreL), anchoRotulo(e.nombreC)) + 12);
  const rama = 10; // distancia de cada rama al cable
  return {
    ancho,
    arriba: rama + 8 + TAM_ROTULO * 0.75,
    abajo: rama + 9 + 4 + TAM_ROTULO + 2,
    dibujar(x, y, fila) {
      const izq = x + 6;
      const der = x + ancho - 6;
      const cx = x + ancho / 2;
      fila.trazo += `M${x} ${y}H${izq}M${izq} ${y - rama}V${y + rama}`;
      fila.trazo += `M${der} ${y - rama}V${y + rama}M${der} ${y}H${x + ancho}`;
      for (const [tipo, yRama] of [
        ['L', y - rama],
        ['C', y + rama],
      ] as const) {
        fila.trazo +=
          `M${izq} ${yRama}H${cx - LARGO / 2}` + simbolo(tipo, cx - LARGO / 2, yRama, 'h');
        fila.trazo += `M${cx + LARGO / 2} ${yRama}H${der}`;
      }
      fila.nodos.push({ x: izq, y }, { x: der, y });
      // L encima de sus vueltas; C debajo de sus placas (9 px), con 4 px de aire
      fila.rotulos.push({ ...partir(e.nombreL), x: cx, y: y - rama - 8, ancla: 'middle' });
      fila.rotulos.push({
        ...partir(e.nombreC),
        x: cx,
        y: y + rama + 9 + 4 + TAM_ROTULO * 0.75,
        ancla: 'middle',
      });
    },
  };
}

// Pasa banda y resonadores acoplados, rama en derivación: L y C lado a lado, de la barra a masa.
function paraleloEnDerivacion(e: Resonador): Celda {
  const mitad = 12; // de la bajada a cada rama
  // el rótulo de L va a la izquierda de sus vueltas; el de C, a la derecha de sus placas
  const nodo = 4 + anchoRotulo(e.nombreL) + 10 + mitad;
  const ancho = nodo + mitad + 13 + anchoRotulo(e.nombreC) + 4;
  return {
    ancho,
    arriba: RADIO_TERMINAL,
    abajo: ABAJO_DERIVACION,
    dibujar(x, y, fila) {
      const cx = x + nodo;
      const [ramaL, ramaC] = [cx - mitad, cx + mitad];
      const [barraArriba, barraAbajo] = [y + PATA, y + PATA + LARGO];
      fila.trazo += `M${x} ${y}H${x + ancho}M${cx} ${y}V${barraArriba}`;
      fila.trazo += `M${ramaL} ${barraArriba}H${ramaC}`;
      fila.trazo += simbolo('L', ramaL, barraArriba, 'v') + simbolo('C', ramaC, barraArriba, 'v');
      fila.trazo += `M${ramaL} ${barraAbajo}H${ramaC}` + masa(cx, barraAbajo);
      fila.nodos.push({ x: cx, y });
      fila.rotulos.push({ ...partir(e.nombreL), x: ramaL - 10, y: junto(y, 0), ancla: 'end' });
      fila.rotulos.push({ ...partir(e.nombreC), x: ramaC + 13, y: junto(y, 0), ancla: 'start' });
    },
  };
}

// Rechaza banda, rama en derivación: L y C uno debajo del otro, hasta masa.
function serieEnDerivacion(e: Resonador): Celda {
  const rotulo = Math.max(anchoRotulo(e.nombreL), anchoRotulo(e.nombreC));
  const ancho = Math.max(LARGO + 8, NODO + AL_LADO + rotulo + 4);
  return {
    ancho,
    arriba: RADIO_TERMINAL,
    abajo: ABAJO_DERIVACION + LARGO,
    dibujar(x, y, fila) {
      const cx = x + NODO;
      fila.trazo += `M${x} ${y}H${x + ancho}M${cx} ${y}v${PATA}`;
      fila.trazo += simbolo('L', cx, y + PATA, 'v') + simbolo('C', cx, y + PATA + LARGO, 'v');
      fila.trazo += masa(cx, y + PATA + 2 * LARGO);
      fila.nodos.push({ x: cx, y });
      fila.rotulos.push({ ...partir(e.nombreL), x: cx + AL_LADO, y: junto(y, 0), ancla: 'start' });
      fila.rotulos.push({ ...partir(e.nombreC), x: cx + AL_LADO, y: junto(y, 1), ancla: 'start' });
    },
  };
}

function puertoFuente(nombre: string): Celda {
  const rotulo = anchoRotulo(nombre);
  const terminal = 4 + rotulo + 6 + RADIO_TERMINAL;
  return {
    ancho: terminal + RADIO_TERMINAL + 6,
    arriba: TAM_ROTULO * 0.75,
    abajo: TAM_ROTULO * 0.75,
    dibujar(x, y, fila) {
      fila.terminales.push({ x: x + terminal, y });
      fila.trazo += `M${x + terminal + RADIO_TERMINAL} ${y}H${x + terminal + RADIO_TERMINAL + 6}`;
      fila.rotulos.push({ ...partir(nombre), x: x + 4, y: y + CENTRADO, ancla: 'start' });
    },
  };
}

function puertoCarga(nombre: string): Celda {
  const terminal = 6 + RADIO_TERMINAL;
  return {
    ancho: terminal + RADIO_TERMINAL + 6 + anchoRotulo(nombre) + 4,
    arriba: TAM_ROTULO * 0.75,
    abajo: TAM_ROTULO * 0.75,
    dibujar(x, y, fila) {
      fila.trazo += `M${x} ${y}H${x + 6}`;
      fila.terminales.push({ x: x + terminal, y });
      fila.rotulos.push({
        ...partir(nombre),
        x: x + terminal + RADIO_TERMINAL + 6,
        y: y + CENTRADO,
        ancla: 'start',
      });
    },
  };
}

// Un símbolo de LARGO px desde (x, y), hacia la derecha ('h') o hacia abajo ('v').
function simbolo(tipo: Simple['tipo'], x: number, y: number, eje: 'h' | 'v'): string {
  const h = eje === 'h';
  const inicio = `M${x} ${y}`;
  // un tramo: `largo` a lo largo del eje y `aparte` hacia un costado
  const paso = (largo: number, aparte: number) =>
    h ? `l${largo} ${aparte}` : `l${-aparte} ${largo}`;
  switch (tipo) {
    case 'R':
      return (
        inicio +
        paso(6, 0) +
        paso(2, -5) +
        [10, -10, 10, -10, 10].map((aparte) => paso(4, aparte)).join('') +
        paso(2, -5) +
        paso(6, 0)
      );
    case 'L': {
      // cuatro medias vueltas: arriba del cable en horizontal, a la izquierda en vertical
      const arco = h ? 'a4 4 0 0 1 8 0' : 'a4 4 0 0 0 0 8';
      return inicio + paso(2, 0) + arco.repeat(4) + paso(2, 0);
    }
    case 'C': {
      const placa = (a: number) => (h ? `M${x + a} ${y - 9}v18` : `M${x - 9} ${y + a}h18`);
      const fin = h ? `M${x + 21} ${y}` : `M${x} ${y + 21}`;
      return inicio + paso(15, 0) + placa(15) + placa(21) + fin + paso(15, 0);
    }
  }
}

function masa(x: number, y: number): string {
  return `M${x} ${y}v6M${x - 8} ${y + 6}h16M${x - 5} ${y + 10}h10M${x - 2} ${y + 14}h4`;
}

function partir(nombre: string): { texto: string; sub?: string } {
  const i = nombre.indexOf('_');
  return i < 0 ? { texto: nombre } : { texto: nombre.slice(0, i), sub: nombre.slice(i + 1) };
}

// Estimación del ancho de un rótulo en la fuente del sistema, un poco por exceso.
export function anchoRotulo(nombre: string): number {
  const { texto, sub } = partir(nombre);
  return anchoTexto(texto, TAM_ROTULO) + (sub ? anchoTexto(sub, TAM_SUBINDICE) : 0);
}

function anchoTexto(texto: string, tam: number): number {
  let em = 0;
  for (const c of texto) {
    if (/[,.;:il|]/.test(c)) em += 0.32;
    else if (/[0-9]/.test(c)) em += 0.58;
    else if (/[A-ZÑ]/.test(c)) em += 0.68;
    else em += 0.56;
  }
  return Math.ceil(em * tam);
}
