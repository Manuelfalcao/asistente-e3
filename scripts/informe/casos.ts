import { CALCULADORAS } from '../../src/ui/calculadoras';
import type { AporteInforme, CasoInforme } from '../../tests/casos-informe';
import { type PruebaVitest, estadoDelCaso } from './estado';
import type { SeccionInforme } from './html';

// De las tablas de Casos de prueba a las secciones del Informe de casos. Cada Calculadora escribe un
// `informe.ts` junto a sus tablas, en tests/, y se levanta sola: no hay una lista que mantener.

const MODULOS = import.meta.glob<{ INFORME: AporteInforme }>('../../tests/**/informe.ts', {
  eager: true,
});

// Ordenados por ruta, para que el informe salga igual siempre.
export function aportesDeTests(): AporteInforme[] {
  return Object.entries(MODULOS)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, modulo]) => modulo.INFORME);
}

const TITULO_COMUN = 'Común';

// Las Calculadoras en el orden del menú y al final Común. Una Calculadora sin casos no tiene sección.
export function seccionesDeCasos(
  aportes: readonly AporteInforme[],
  pruebas: readonly PruebaVitest[],
): SeccionInforme[] {
  const orden = [...CALCULADORAS.map((c) => c.id), 'comun'];
  const desconocida = aportes.find((a) => !orden.includes(a.calculadora));
  if (desconocida)
    throw new Error(`Calculadora desconocida en un informe.ts: ${desconocida.calculadora}`);
  return orden.flatMap((id) => {
    const casos: CasoInforme[] = aportes
      .filter((a) => a.calculadora === id)
      .flatMap((a) => a.casos());
    if (!casos.length) return [];
    return [
      {
        calculadora: id,
        titulo: id === 'comun' ? TITULO_COMUN : CALCULADORAS.find((c) => c.id === id)!.nombre,
        casos: casos.map((caso) => ({
          caso,
          estado: estadoDelCaso(caso, pruebas),
        })),
      },
    ];
  });
}
