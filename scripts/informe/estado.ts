import type { CasoInforme } from '../../tests/casos-informe';

// El estado de cada Caso de prueba en el Informe de casos (spec §13.6). Sale del resultado de Vitest
// (reporter JSON): el test que corre un caso se llama como el caso, o empieza con "<id>:".

export interface PruebaVitest {
  titulo: string;
  // 'passed', 'failed', 'skipped', 'pending' o 'todo', como los escribe Vitest.
  estado: string;
}

export type EstadoCaso = 'ok' | 'falla' | 'sin-test';

interface JsonVitest {
  testResults: { assertionResults: { title: string; status: string }[] }[];
}

function esJsonVitest(json: unknown): json is JsonVitest {
  return (
    typeof json === 'object' &&
    json !== null &&
    Array.isArray((json as JsonVitest).testResults) &&
    (json as JsonVitest).testResults.every((r) => Array.isArray(r.assertionResults))
  );
}

export function leerResultadosVitest(json: unknown): PruebaVitest[] {
  if (!esJsonVitest(json)) throw new Error('El archivo no es el resultado JSON de Vitest.');
  return json.testResults.flatMap((r) =>
    r.assertionResults.map((a) => ({ titulo: a.title, estado: a.status })),
  );
}

function coincide(id: string, titulo: string): boolean {
  return titulo === id || titulo.startsWith(`${id}:`);
}

function numerosEnTolerancia(caso: CasoInforme): boolean {
  return caso.clase === 'comportamiento' ? caso.coincide : caso.medidas.every((m) => m.dentro);
}

// 'falla' si algún test del caso falló o si algún número cae fuera de la tolerancia, aunque el test
// haya pasado: el informe no puede mostrar en verde lo que el propio informe ve en rojo. 'sin-test'
// si ningún test pasado lo corre: un caso que nadie corre no está aprobado.
export function estadoDelCaso(caso: CasoInforme, pruebas: readonly PruebaVitest[]): EstadoCaso {
  const suyas = pruebas.filter((p) => coincide(caso.id, p.titulo));
  if (suyas.some((p) => p.estado === 'failed') || !numerosEnTolerancia(caso)) return 'falla';
  return suyas.some((p) => p.estado === 'passed') ? 'ok' : 'sin-test';
}

export interface ResumenEstados {
  total: number;
  ok: number;
  falla: number;
  sinTest: number;
}

export function resumenDeEstados(estados: readonly EstadoCaso[]): ResumenEstados {
  const cuenta = (e: EstadoCaso) => estados.filter((x) => x === e).length;
  return {
    total: estados.length,
    ok: cuenta('ok'),
    falla: cuenta('falla'),
    sinTest: cuenta('sin-test'),
  };
}
