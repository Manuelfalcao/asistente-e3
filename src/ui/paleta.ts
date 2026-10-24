export type Colores = Record<string, string>;

export interface ParDeContraste {
  frente: string;
  fondo: string;
  // WCAG AA: 4,5:1 para texto (también los rótulos chicos) y 3:1 para bordes y puntos de color.
  minimo: 4.5 | 3;
  uso: string;
}

// Cada combinación de color que usa el Asistente. La página de muestra los presenta con su
// contraste y tests/paleta.test.ts los verifica en los dos temas.
export const PARES_DE_CONTRASTE: readonly ParDeContraste[] = [
  { frente: 'texto', fondo: 'fondo', minimo: 4.5, uso: 'Texto sobre el fondo de la página' },
  { frente: 'texto', fondo: 'superficie', minimo: 4.5, uso: 'Texto en tarjetas, campos y menú' },
  { frente: 'texto', fondo: 'superficie-2', minimo: 4.5, uso: 'Pasos intermedios y motivos' },
  { frente: 'texto', fondo: 'acento-suave', minimo: 4.5, uso: 'Texto de la franja de llegada' },
  { frente: 'texto', fondo: 'dudoso-fondo', minimo: 4.5, uso: 'Aviso de la Calculadora' },
  { frente: 'texto', fondo: 'impracticable-fondo', minimo: 4.5, uso: 'Aviso fuerte' },
  { frente: 'texto-suave', fondo: 'fondo', minimo: 4.5, uso: 'Eco y notas sobre el fondo' },
  { frente: 'texto-suave', fondo: 'superficie', minimo: 4.5, uso: 'Referencia, pestañas, rótulos' },
  { frente: 'texto-suave', fondo: 'superficie-2', minimo: 4.5, uso: 'Notas en los pasos' },
  {
    frente: 'texto-suave',
    fondo: 'acento-suave',
    minimo: 4.5,
    uso: 'Menú activo y ✕ de la franja',
  },
  { frente: 'acento', fondo: 'superficie', minimo: 4.5, uso: 'Botones de pase y pestaña activa' },
  { frente: 'acento', fondo: 'fondo', minimo: 4.5, uso: 'Enlaces sobre el fondo' },
  { frente: 'acento', fondo: 'acento-suave', minimo: 4.5, uso: 'Menú activo y botón al pasar' },
  { frente: 'sobre-acento', fondo: 'acento', minimo: 4.5, uso: 'Opción elegida y versión nueva' },
  { frente: 'dudoso-texto', fondo: 'dudoso-fondo', minimo: 4.5, uso: 'Rótulo «Valor dudoso»' },
  { frente: 'dudoso-texto', fondo: 'fondo', minimo: 4.5, uso: 'Eco con advertencia' },
  {
    frente: 'dudoso-texto',
    fondo: 'superficie',
    minimo: 4.5,
    uso: 'Eco con advertencia, en tarjeta',
  },
  {
    frente: 'impracticable-texto',
    fondo: 'impracticable-fondo',
    minimo: 4.5,
    uso: 'Rótulo «Valor impracticable»',
  },
  { frente: 'error', fondo: 'fondo', minimo: 4.5, uso: 'Motivo de un campo inválido' },
  { frente: 'error', fondo: 'superficie', minimo: 4.5, uso: 'Motivo de un campo, en tarjeta' },
  { frente: 'borde-campo', fondo: 'superficie', minimo: 3, uso: 'Borde de campos y opciones' },
  { frente: 'borde-campo', fondo: 'fondo', minimo: 3, uso: 'Borde de campos, hacia afuera' },
  { frente: 'dudoso', fondo: 'superficie', minimo: 3, uso: 'Círculo de Valor dudoso' },
  { frente: 'dudoso', fondo: 'superficie-2', minimo: 3, uso: 'Círculo en los motivos' },
  { frente: 'dudoso', fondo: 'dudoso-fondo', minimo: 3, uso: 'Círculo dentro del rótulo' },
  { frente: 'dudoso', fondo: 'acento-suave', minimo: 3, uso: 'Círculo en el pase, al pasar' },
  { frente: 'impracticable', fondo: 'superficie', minimo: 3, uso: 'Rombo y campo inválido' },
  { frente: 'impracticable', fondo: 'superficie-2', minimo: 3, uso: 'Rombo en los motivos' },
  { frente: 'impracticable', fondo: 'impracticable-fondo', minimo: 3, uso: 'Rombo en el rótulo' },
  { frente: 'impracticable', fondo: 'acento-suave', minimo: 3, uso: 'Rombo en el pase, al pasar' },
];

const MEDIA_OSCURO = '@media (prefers-color-scheme: dark)';

// Los colores de `tokens.css` (sin el `--`), resueltos a #rrggbb. El tema oscuro es el `:root`
// dentro de `@media (prefers-color-scheme: dark)` sobre el claro: hereda lo que no redefine.
export function leerPaleta(css: string): { claro: Colores; oscuro: Colores } {
  const inicio = css.indexOf(MEDIA_OSCURO);
  const media = inicio < 0 ? null : bloque(css, css.indexOf('{', inicio));
  const base = media ? css.slice(0, inicio) + css.slice(media.fin) : css;
  const crudoClaro = declaraciones(base);
  const crudoOscuro = { ...crudoClaro, ...(media ? declaraciones(media.cuerpo) : {}) };
  return { claro: resolver(crudoClaro), oscuro: resolver(crudoOscuro) };
}

function bloque(css: string, llave: number): { cuerpo: string; fin: number } {
  let nivel = 0;
  for (let i = llave; i < css.length; i++) {
    if (css[i] === '{') nivel++;
    else if (css[i] === '}' && --nivel === 0)
      return { cuerpo: css.slice(llave + 1, i), fin: i + 1 };
  }
  throw new Error('Llaves sin cerrar en tokens.css');
}

function declaraciones(css: string): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const raiz of css.matchAll(/:root\s*\{([^}]*)\}/g)) {
    for (const [, nombre, valor] of raiz[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
      salida[nombre] = valor.trim();
    }
  }
  return salida;
}

function resolver(crudo: Record<string, string>): Colores {
  const colores: Colores = {};
  const valor = (nombre: string, vistos: string[]): string | null => {
    const v = crudo[nombre];
    if (v === undefined || vistos.includes(nombre)) return null;
    const alias = /^var\(--([\w-]+)\)$/.exec(v);
    if (alias) return valor(alias[1], [...vistos, nombre]);
    return hex6(v);
  };
  for (const nombre of Object.keys(crudo)) {
    const v = valor(nombre, []);
    if (v) colores[nombre] = v;
  }
  return colores;
}

// "#abc" o "#aabbcc" a "#aabbcc"; null si no es un color así.
function hex6(color: string): string | null {
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) return null;
  const h = color.slice(1).toLowerCase();
  return '#' + (h.length === 3 ? h.replace(/./g, (c) => c + c) : h);
}

// Contraste de WCAG 2: (L1 + 0,05)/(L2 + 0,05) con la luminancia relativa de sRGB.
export function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

function luminancia(hex: string): number {
  const [r, g, b] = canales(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function canales(color: string): number[] {
  const hex = hex6(color);
  if (!hex) throw new Error(`Color no válido: ${color}`);
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
