// Entradas, última Calculadora y (más adelante) Inventario en `localStorage` (spec §4.4). El JSON
// lleva `version` desde el primer día, y `migrar` lleva cualquier versión anterior a la actual.
// Todas las escrituras van en try/catch: si no se puede guardar, el Asistente sigue andando.

export const CLAVE = 'asistente-e3';
export const VERSION_ALMACEN = 1;

export interface EntradaGuardada {
  texto: string;
  unidad?: string;
}

export interface Datos {
  version: number;
  // Id de la última Calculadora abierta.
  ultima?: string;
  // Calculadora → campo → texto y Selector de unidad.
  entradas: Record<string, Record<string, EntradaGuardada>>;
  // Lo escribe el ticket 36; acá solo se conserva.
  inventario?: unknown;
}

// Lo mínimo de `Storage` que se usa, para probar sin navegador.
export interface Soporte {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
  removeItem(clave: string): void;
}

export const datosVacios = (): Datos => ({ version: VERSION_ALMACEN, entradas: {} });

const esObjeto = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

// Cada versión vieja tendrá su paso, que la sube a la siguiente. Hoy solo existe la 1: lo que no
// se reconoce (JSON de otra forma o de una versión futura) se descarta y se arranca de cero.
export function migrar(crudo: unknown): Datos {
  if (!esObjeto(crudo) || crudo.version !== VERSION_ALMACEN) return datosVacios();
  const datos = datosVacios();
  if (typeof crudo.ultima === 'string') datos.ultima = crudo.ultima;
  if (esObjeto(crudo.entradas)) {
    for (const [calculadora, campos] of Object.entries(crudo.entradas)) {
      if (!esObjeto(campos)) continue;
      const limpios: Record<string, EntradaGuardada> = {};
      for (const [campo, e] of Object.entries(campos)) {
        if (!esObjeto(e) || typeof e.texto !== 'string') continue;
        limpios[campo] =
          typeof e.unidad === 'string' ? { texto: e.texto, unidad: e.unidad } : { texto: e.texto };
      }
      datos.entradas[calculadora] = limpios;
    }
  }
  if (crudo.inventario !== undefined) datos.inventario = crudo.inventario;
  return datos;
}

export class Almacen {
  private datos: Datos;

  constructor(private soporte: Soporte | null) {
    this.datos = this.leer();
  }

  private leer(): Datos {
    try {
      const texto = this.soporte?.getItem(CLAVE);
      return texto ? migrar(JSON.parse(texto)) : datosVacios();
    } catch {
      return datosVacios();
    }
  }

  // Devuelve si pudo escribir. Lo cambiado queda en memoria aunque no se pueda guardar.
  private escribir(): boolean {
    try {
      if (!this.soporte) return false;
      this.soporte.setItem(CLAVE, JSON.stringify(this.datos));
      return true;
    } catch {
      return false;
    }
  }

  ultima(): string | undefined {
    return this.datos.ultima;
  }

  guardarUltima(id: string): boolean {
    this.datos.ultima = id;
    return this.escribir();
  }

  entrada(calculadora: string, campo: string): EntradaGuardada | undefined {
    return this.datos.entradas[calculadora]?.[campo];
  }

  guardarEntrada(calculadora: string, campo: string, entrada: EntradaGuardada): boolean {
    (this.datos.entradas[calculadora] ??= {})[campo] = entrada;
    return this.escribir();
  }

  // Prueba real de escritura: un `.html` con origen opaco tira error al tocar `localStorage`.
  puedeGuardar(): boolean {
    try {
      if (!this.soporte) return false;
      const prueba = `${CLAVE}:prueba`;
      this.soporte.setItem(prueba, '1');
      this.soporte.removeItem(prueba);
      return true;
    } catch {
      return false;
    }
  }
}

function soporteDelNavegador(): Soporte | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export const almacen = new Almacen(soporteDelNavegador());
