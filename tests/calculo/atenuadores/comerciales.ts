import { inventarioVacio, valoresCargados } from '../../../src/calculo/arreglos/inventario';
import {
  calcularAtenuadores,
  calcularMinimaPerdida,
} from '../../../src/calculo/atenuadores/atenuadores';
import {
  type ValoresComerciales,
  disponiblesDe,
  valoresComerciales,
} from '../../../src/calculo/atenuadores/valores-comerciales';
import type { CasoComercial } from './casos-comerciales';

// Corre un caso de Valores comerciales con el cálculo del Asistente: el atenuador ideal de la
// topología del caso y sus Valores comerciales. Lo comparten Vitest y el Informe de casos.

// ±5 % y ±0,1 dB: los valores por defecto (spec §10.1).
const TOLERANCIA = 0.05;
const VENTANA = 0.1;

export function valoresDelCaso(caso: CasoComercial): ValoresComerciales {
  const { z1, z2 } = caso;
  const red = (() => {
    if (caso.topologia === 'pad') {
      const r = calcularMinimaPerdida({ z1, z2 });
      if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
      return r.pad;
    }
    const r = calcularAtenuadores({ atenuacion: caso.atenuacion!, z1, z2 });
    if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
    return caso.topologia === 'T' ? r.t : r.pi;
  })();
  const inventario = caso.inventario
    ? {
        ...inventarioVacio('resistencia'),
        modo: 'inclusion' as const,
        inclusion: caso.inventario.map((valor) => ({ valor })),
      }
    : inventarioVacio('resistencia');
  const disponibles =
    caso.redondeo === 'inventario'
      ? disponiblesDe('inventario', 'E12', inventario)
      : valoresCargados('resistencia', caso.redondeo);
  return valoresComerciales(
    red,
    { z1, z2, frecuencia: null },
    { disponibles, tolerancia: TOLERANCIA, ventana: caso.ventana ?? VENTANA },
  );
}
