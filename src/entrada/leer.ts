import {
  DEFINICIONES,
  EXPONENTE_DEL_PREFIJO,
  MENOS,
  MICRO,
  OHMIO,
  exponenteDelSelector,
  type Campo,
  type Prefijo,
  type Unidad,
} from './campos';
import { formatearDbm, formatearValor, vatiosADbm } from './formato';

// Lector puro de la Entrada flexible (spec §5.1). Solo lee: los rangos válidos de cada campo los
// fija su Calculadora (campo.ts).

export type ResultadoLectura =
  | { tipo: 'vacio' }
  // `valor` está en SI (H, F, Ω, Hz, W, m) o en la unidad del campo (dB, %, número). Una potencia
  // escrita en dBm lleva además los `dbm` que se escribieron.
  | { tipo: 'valor'; valor: number; dbm?: number; aviso?: string }
  | { tipo: 'error'; mensaje: string };

const error = (mensaje: string): ResultadoLectura => ({ tipo: 'error', mensaje });
const MENSAJE_MENOS = 'El signo menos solo vale en dBm';

// Los prefijos que existen, en la variante que se escribió. Solo m/M y p/P se distinguen.
function reconocerPrefijo(token: string): Prefijo | null {
  if (token.toLowerCase() === 'meg') return 'M';
  switch (token) {
    case 'p':
      return 'p';
    case 'P':
      return 'P';
    case 'n':
    case 'N':
      return 'n';
    case 'u':
    case 'U':
    case 'µ':
    case 'μ':
      return MICRO;
    case 'm':
      return 'm';
    case 'M':
      return 'M';
    case 'k':
    case 'K':
      return 'k';
    case 'g':
    case 'G':
      return 'G';
    default:
      return null;
  }
}

// Las unidades se escriben sin distinguir mayúsculas. Ω y el signo ohm (U+2126) pasan a ω al
// bajar a minúsculas. Van de las más largas a las más cortas para que "dbm" no se lea como "db".
const UNIDADES: readonly [string, Unidad][] = [
  ['ohms', OHMIO],
  ['ohm', OHMIO],
  ['dbm', 'dBm'],
  ['hz', 'Hz'],
  ['mm', 'mm'],
  ['db', 'dB'],
  ['h', 'H'],
  ['f', 'F'],
  ['w', 'W'],
  ['ω', OHMIO],
  ['%', '%'],
];

interface Cola {
  prefijo?: Prefijo;
  // El prefijo como se escribió, para el motivo y para saber si fue "m" o "M" a secas.
  token?: string;
  unidad?: Unidad;
}

// Lo que sigue al número: un prefijo, una unidad o las dos juntas, sin nada en el medio.
function leerCola(cola: string): Cola | null {
  if (cola === '') return {};
  const solo = reconocerPrefijo(cola);
  if (solo) return { prefijo: solo, token: cola };
  const minusculas = cola.toLowerCase();
  for (const [texto, unidad] of UNIDADES) {
    if (!minusculas.endsWith(texto)) continue;
    const token = cola.slice(0, cola.length - texto.length);
    if (token === '') return { unidad };
    const prefijo = reconocerPrefijo(token);
    if (prefijo) return { prefijo, token, unidad };
  }
  return null;
}

const NOMBRE_DEL_PREFIJO: Partial<Record<Prefijo, string>> = {
  p: 'pico',
  P: 'peta',
  m: 'mili',
  M: 'mega',
};

function listar(prefijos: readonly string[]): string {
  return prefijos.length < 2
    ? prefijos.join('')
    : `${prefijos.slice(0, -1).join(', ')} y ${prefijos[prefijos.length - 1]}`;
}

// El prefijo existe pero no es de esta magnitud. Si es el cruce típico entre m/M o p/P, dice cuál
// escribir; `reescribir` arma el texto corregido con el prefijo bueno.
function prefijoFueraDelJuego(
  campo: Campo,
  cola: Cola,
  reescribir: (prefijo: string) => string,
): ResultadoLectura {
  const def = DEFINICIONES[campo.magnitud];
  const escrito = `${cola.token}${cola.unidad ?? ''}`;
  const { prefijos } = def;
  if (cola.token === 'm' && prefijos.includes('M')) {
    return error(`${escrito} no tiene sentido acá; para mega usá M mayúscula: ${reescribir('M')}`);
  }
  if (cola.token === 'M' && prefijos.includes('m')) {
    return error(`${escrito} no tiene sentido acá; para mili usá m minúscula: ${reescribir('m')}`);
  }
  if (cola.token === 'P' && prefijos.includes('p')) {
    return error(`«P» es peta. Para pico usá p minúscula: ${reescribir('p')}`);
  }
  return error(
    `${escrito} no se usa acá; en ${def.nombre.replace(/ \(.*/, '')} los prefijos son ${listar(prefijos)}`,
  );
}

const MENSAJE_SIN_PREFIJO: Partial<Record<string, string>> = {
  largo: 'Los largos van en mm, sin prefijos: escribí solo el número',
  decibeles: 'Este campo es de decibeles (dB): escribí solo el número',
  porcentaje: 'Este campo es un porcentaje: escribí solo el número',
  numero: 'Este campo es un número: escribí solo el número, sin prefijo ni unidad',
  entero: 'Tiene que ser un número entero, sin prefijo ni unidad',
};

function motivoDeUnidad(campo: Campo): string {
  const { magnitud } = campo;
  if (magnitud === 'numero' || magnitud === 'entero') return MENSAJE_SIN_PREFIJO[magnitud]!;
  if (magnitud === 'potencia' && campo.dbm) return 'Este campo es de potencia (W o dBm)';
  if (magnitud === 'largo') return 'Este campo es un largo en mm: escribí solo el número';
  return `Este campo es de ${DEFINICIONES[magnitud].nombre}`;
}

function unidadAceptada(campo: Campo, unidad: Unidad): boolean {
  const propia = DEFINICIONES[campo.magnitud].unidad;
  return unidad === propia || (unidad === 'dBm' && campo.magnitud === 'potencia' && !!campo.dbm);
}

const MANTISA = /^(\d+[.,]?\d*|[.,]\d+)/;
const RKM = /^(\d+)(meg|[A-Za-zµμ])(\d+)\s*(.*)$/i;
// Con la unidad opcional detrás, como en "4k7 ohm": la última captura es lo que sigue a la R.
const R_COMO_COMA = /^(\d*)[rR](\d+)\s*(.*)$/;
const R_FINAL = /^(\d+)[rR]\s*(.*)$/;

// Detrás de una R que hace de coma solo puede ir la unidad, sin prefijo.
function esSoloOhmios(cola: string): boolean {
  const leida = leerCola(cola.trim());
  return leida !== null && leida.prefijo === undefined && (leida.unidad ?? OHMIO) === OHMIO;
}

function aDecimal(mantisa: string): string {
  let texto = mantisa.replace(',', '.');
  if (texto.endsWith('.')) texto = texto.slice(0, -1);
  return texto.startsWith('.') ? `0${texto}` : texto;
}

// Lee lo que el Alumno escribió en un campo de valor. No juzga el rango: eso es del campo.
export function leerEntrada(texto: string, campo: Campo): ResultadoLectura {
  const original = texto.trim();
  if (original === '') return { tipo: 'vacio' };
  const def = DEFINICIONES[campo.magnitud];
  const noEntiendo = error(`No entiendo «${original}»`);

  const signo = /^[-−]\s*/.exec(original);
  const negativo = signo !== null;
  const cuerpo = signo ? original.slice(signo[0].length) : original;

  if (negativo && (campo.magnitud !== 'potencia' || !campo.dbm)) {
    // Un menos con otra cosa ilegible no es un problema de signo, es que no se entiende.
    return MANTISA.test(cuerpo) ? error(MENSAJE_MENOS) : noEntiendo;
  }

  // Más de un separador ("1.000,5"): no hay separador de miles.
  const cabeza = /^[\d.,]+/.exec(cuerpo)?.[0] ?? '';
  if ((cabeza.match(/[.,]/g) ?? []).length > 1) {
    return error(`No entiendo «${original}»: no se usa separador de miles`);
  }

  if (campo.magnitud === 'entero') {
    if (/^\d+$/.test(cuerpo)) return { tipo: 'valor', valor: Number(cuerpo) };
    return MANTISA.test(cuerpo) && /^[\d.,]+$/.test(cuerpo)
      ? error('Tiene que ser un número entero')
      : noEntiendo;
  }

  // La R como coma o como final vale solo en resistencia ("R47", "47R", "4R7").
  if (campo.magnitud === 'resistencia') {
    const coma = R_COMO_COMA.exec(cuerpo);
    const final = R_FINAL.exec(cuerpo);
    const forma = coma ?? final;
    if (forma && esSoloOhmios(forma[forma.length - 1])) {
      const texto = coma ? `${coma[1] || '0'}.${coma[2]}` : final![1];
      return { tipo: 'valor', valor: Number(texto) };
    }
  }

  let mantisa: string;
  let exponenteCientifico = 0;
  let cientifica = false;
  let cola: Cola | null;
  let reescribir: (prefijo: string) => string;
  let esRkm = false;

  const rkm = RKM.exec(cuerpo);
  const prefijoRkm = rkm ? reconocerPrefijo(rkm[2]) : null;
  if (rkm && prefijoRkm) {
    // Notación RKM: el prefijo hace de coma ("4n7" = 4,7 n).
    if (!def.rkm) {
      if (def.prefijos.length === 0) return error(MENSAJE_SIN_PREFIJO[campo.magnitud]!);
      return error(`Acá no se usa la notación RKM. Escribí ${rkm[1]},${rkm[3]}${rkm[2]}`);
    }
    esRkm = true;
    mantisa = `${rkm[1]}.${rkm[3]}`;
    cola = leerCola(rkm[4]);
    if (cola && cola.prefijo === undefined) cola = { ...cola, prefijo: prefijoRkm, token: rkm[2] };
    else if (cola) return noEntiendo;
    reescribir = (prefijo) => `${rkm[1]}${prefijo}${rkm[3]}`;
  } else {
    const numero = MANTISA.exec(cuerpo);
    if (!numero) return noEntiendo;
    mantisa = aDecimal(numero[0]);
    let resto = cuerpo.slice(numero[0].length);
    const parteCientifica = /^[eE]([+-]?\d+)/.exec(resto);
    if (parteCientifica) {
      cientifica = true;
      exponenteCientifico = Number(parteCientifica[1]);
      resto = resto.slice(parteCientifica[0].length);
    }
    cola = leerCola(resto.trim());
    reescribir = (prefijo) => `${numero[0]}${prefijo}`;
  }
  if (!cola) return noEntiendo;

  if (cola.unidad && !unidadAceptada(campo, cola.unidad)) return error(motivoDeUnidad(campo));
  if (cola.prefijo) {
    if (cientifica) return error('La notación científica no se combina con un prefijo');
    if (def.prefijos.length === 0) return error(MENSAJE_SIN_PREFIJO[campo.magnitud]!);
    if (cola.unidad === 'dBm') return error('dBm no lleva prefijo');
    if (!def.prefijos.includes(cola.prefijo)) return prefijoFueraDelJuego(campo, cola, reescribir);
  }

  const esDbm = cola.unidad === 'dBm' || (!cola.prefijo && !cola.unidad && campo.unidad === 'dBm');
  if (negativo && !esDbm) return error(MENSAJE_MENOS);
  const desborda = error(`«${original}» es demasiado grande`);
  if (esDbm) {
    const dbm = Number(`${negativo ? '-' : ''}${mantisa}e${exponenteCientifico}`);
    const valor = 10 ** (dbm / 10) / 1000;
    if (!Number.isFinite(valor) || !Number.isFinite(dbm)) return desborda;
    return {
      tipo: 'valor',
      valor,
      dbm,
      ...avisoDeMiles(cuerpo, campo, cola, esRkm, negativo, valor),
    };
  }

  const exponente = cola.prefijo
    ? EXPONENTE_DEL_PREFIJO[cola.prefijo] + def.exponenteBase
    : cola.unidad
      ? def.exponenteBase
      : exponenteDelSelector(campo);
  const valor = Number(`${mantisa}e${exponenteCientifico + exponente}`);
  if (!Number.isFinite(valor)) return desborda;
  return { tipo: 'valor', valor, ...avisoDeMiles(cuerpo, campo, cola, esRkm, false, valor) };
}

// Aviso suave: un separador seguido de exactamente 3 dígitos, con parte entera distinta de cero
// ("1.000", "4,700"), casi siempre es un separador de miles que acá no existe. El valor se acepta.
// Solo avisa con un número pelado: si el Alumno escribió prefijo o unidad ("1,234 kΩ", que es lo
// que muestra el Asistente en los pasos intermedios), sabe lo que escribe.
function avisoDeMiles(
  cuerpo: string,
  campo: Campo,
  cola: Cola,
  esRkm: boolean,
  negativo: boolean,
  valor: number,
): { aviso?: string } {
  if (esRkm || cola.prefijo || cola.unidad) return {};
  const miles = /^(\d*[1-9]\d*)[.,](\d{3})$/.exec(cuerpo);
  if (!miles) return {};
  const [, entera, decimales] = miles;
  const mil = `${negativo ? '-' : ''}${entera}${decimales}`;
  const leido =
    campo.magnitud === 'potencia' && campo.unidad === 'dBm'
      ? formatearDbm(vatiosADbm(valor))
      : formatearValor(valor, campo.magnitud, 'paso');
  const alternativas = [mil];
  // "1k" solo es lo mismo que "1000" si el selector está en la unidad base.
  if (DEFINICIONES[campo.magnitud].prefijos.includes('k') && exponenteDelSelector(campo) === 0) {
    const fraccion = decimales.replace(/0+$/, '');
    alternativas.push(`${entera}${fraccion ? `,${fraccion}` : ''}k`);
  }
  const cuanto = mil === '1000' ? 'mil' : mil;
  return { aviso: `Se leyó ${leido}. Para ${cuanto}, escribí ${alternativas.join(' o ')}.` };
}
