import { DEFINICIONES, EXPONENTE_DEL_PREFIJO, MENOS, type Magnitud, type Prefijo } from './campos';

// Formato de salida (spec §5.2): coma decimal, prefijo de ingeniería con grafía oficial y un
// espacio antes de la unidad. Todo texto que sale de acá vuelve a leerse con la Entrada flexible.

// 3 cifras significativas en los resultados y 4 en los pasos intermedios.
export type Nivel = 'resultado' | 'paso';
const CIFRAS: Record<Nivel, number> = { resultado: 3, paso: 4 };

export function redondearCifras(x: number, cifras: number): number {
  return x === 0 ? 0 : Number(x.toPrecision(cifras));
}

function exponente10(x: number): number {
  return Number(Math.abs(x).toExponential().split('e')[1]);
}

// x / 10^exp sin el error de la división: se corre el exponente del texto, no el número.
function escalar(x: number, exp: number): number {
  const [mantisa, e] = Math.abs(x).toExponential(14).split('e');
  return Math.sign(x) * Number(`${mantisa}e${Number(e) - exp}`);
}

// Con coma, sin ceros de relleno y con el signo menos tipográfico.
function escribirDecimal(x: number, decimales: number): string {
  let texto = Math.abs(x).toFixed(Math.min(decimales, 100));
  if (texto.includes('.')) texto = texto.replace(/0+$/, '').replace(/\.$/, '');
  const esCero = Number(texto) === 0;
  return (x < 0 && !esCero ? MENOS : '') + texto.replace('.', ',');
}

// dB y dBm: 2 decimales, sin ceros de relleno.
function dosDecimales(x: number): string {
  return escribirDecimal(Number(x.toFixed(2)), 2);
}

export function formatearNumero(x: number, cifras: number): string {
  const r = redondearCifras(x, cifras);
  if (r === 0) return '0';
  return escribirDecimal(r, Math.max(0, cifras - 1 - exponente10(r)));
}

const PREFIJO_DEL_EXPONENTE = new Map<number, Prefijo | ''>([
  [0, ''],
  ...(Object.entries(EXPONENTE_DEL_PREFIJO) as [Prefijo, number][]).map(
    ([prefijo, exp]) => [exp, prefijo] as [number, Prefijo],
  ),
]);

export function formatearValor(valor: number, magnitud: Magnitud, nivel: Nivel = 'resultado') {
  const cifras = CIFRAS[nivel];
  const def = DEFINICIONES[magnitud];
  switch (magnitud) {
    case 'decibeles':
      return `${dosDecimales(valor)} dB`;
    case 'porcentaje':
      return `${formatearNumero(valor, 2)} %`;
    case 'numero':
      return formatearNumero(valor, cifras);
    case 'entero':
      return String(Math.round(valor));
    case 'largo':
      return `${formatearNumero(escalar(redondearCifras(valor, cifras), -3), cifras)} mm`;
  }
  // El valor se redondea primero, en SI: así 999,6 nH ya es 1 µH al elegir el prefijo, y el valor
  // redondeado es el mismo para cualquiera que lo calcule (la ida y vuelta lo verifica).
  const redondeado = redondearCifras(valor, cifras);
  // Los prefijos de la magnitud, sin saltos que la Entrada flexible no pueda volver a leer.
  const exponentes = [0, ...def.prefijos.map((p) => EXPONENTE_DEL_PREFIJO[p])].sort(
    (a, b) => a - b,
  );
  const objetivo = Math.floor((redondeado === 0 ? 0 : exponente10(redondeado)) / 3) * 3;
  let i = 0;
  while (i + 1 < exponentes.length && exponentes[i + 1] <= objetivo) i++;
  const prefijo = PREFIJO_DEL_EXPONENTE.get(exponentes[i]) ?? '';
  return `${formatearNumero(escalar(redondeado, exponentes[i]), cifras)} ${prefijo}${def.unidad}`;
}

// Una potencia en vatios, a dBm.
export function vatiosADbm(vatios: number): number {
  return 10 * Math.log10(vatios * 1000);
}

export function formatearDbm(dbm: number): string {
  return `${dosDecimales(dbm)} dBm`;
}

// Fuera de la ida y vuelta: un error relativo es un resultado con signo, no un valor que se escriba
// en un campo (el menos solo vale en dBm, spec §5.1).
// Un error relativo, con signo y con el menos tipográfico: "+4,7 %", "−1,2 %". Recibe el
// porcentaje, no la fracción.
export function formatearErrorRelativo(porcentaje: number): string {
  const redondeado = redondearCifras(porcentaje, 2);
  if (redondeado === 0) return '0 %';
  return `${redondeado > 0 ? '+' : ''}${formatearNumero(porcentaje, 2)} %`;
}
