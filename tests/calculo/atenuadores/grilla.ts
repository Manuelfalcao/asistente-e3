import {
  calcularAtenuadores,
  calcularMinimaPerdida,
} from '../../../src/calculo/atenuadores/atenuadores';
import { GRILLA_ATENUACIONES, GRILLA_IMPEDANCIAS } from './casos-pad';
import { escaleraDeAtenuador, escaleraDePad, medir } from './elementos';

// Las grillas de verificación contra el oráculo ABCD (spec §13.3): las recorre el test y las muestra
// el Informe de casos, con el peor error de cada magnitud.

export interface PeoresErrores {
  // Cuántas redes se verificaron.
  redes: number;
  // |Zin / Z1 − 1| y |Zout / Z2 − 1| máximos, y |A obtenida − A pedida| máximo en dB.
  zEntrada: { valor: number; donde: string };
  zSalida: { valor: number; donde: string };
  atenuacion: { valor: number; donde: string };
}

function acumulador() {
  const peor: Omit<PeoresErrores, 'redes'> = {
    zEntrada: { valor: 0, donde: '' },
    zSalida: { valor: 0, donde: '' },
    atenuacion: { valor: 0, donde: '' },
  };
  const registrar = (campo: keyof typeof peor, valor: number, donde: string) => {
    if (valor > peor[campo].valor || peor[campo].donde === '') peor[campo] = { valor, donde };
  };
  return { peor, registrar };
}

// La menor atenuación del par, con la fórmula del Reference Data: la grilla queda arriba.
export function aMinDelPar(z1: number, z2: number): number {
  const r = Math.max(z1, z2) / Math.min(z1, z2);
  return r === 1 ? 0 : 20 * Math.log10(Math.sqrt(r) + Math.sqrt(r - 1));
}

// El T y el π en la grilla de Z1, Z2 y dB. Debajo de A_min es un corte (spec §10.5): se comprueba
// que corte y se saltea. `fueraDeLugar` lista los que cortaron de más o no cortaron.
export function recorrerGrilla(): PeoresErrores & { fueraDeLugar: string[] } {
  const { peor, registrar } = acumulador();
  const fueraDeLugar: string[] = [];
  let redes = 0;
  for (const z1 of GRILLA_IMPEDANCIAS) {
    for (const z2 of GRILLA_IMPEDANCIAS) {
      for (const a of GRILLA_ATENUACIONES) {
        const r = calcularAtenuadores({ atenuacion: a, z1, z2 });
        const debajo = a <= aMinDelPar(z1, z2);
        if (debajo !== (r.estado === 'corte')) {
          fueraDeLugar.push(`${z1} → ${z2}, ${a} dB`);
          continue;
        }
        if (r.estado !== 'calculado') continue;
        for (const red of [r.t, r.pi]) {
          const m = medir(escaleraDeAtenuador(red), z1, z2);
          const donde = `${red.topologia} ${z1} → ${z2}, ${a} dB`;
          registrar('zEntrada', Math.abs(m.zEntrada / z1 - 1), donde);
          registrar('zSalida', Math.abs(m.zSalida / z2 - 1), donde);
          registrar('atenuacion', Math.abs(m.atenuacion - a), donde);
          redes++;
        }
      }
    }
  }
  return { redes, ...peor, fueraDeLugar };
}

// El pad de mínima pérdida en la grilla de Z1 y Z2 distintas.
export function recorrerGrillaPad(): PeoresErrores {
  const { peor, registrar } = acumulador();
  let redes = 0;
  for (const z1 of GRILLA_IMPEDANCIAS) {
    for (const z2 of GRILLA_IMPEDANCIAS) {
      if (z1 === z2) continue;
      const r = calcularMinimaPerdida({ z1, z2 });
      if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
      const m = medir(escaleraDePad(r.pad), z1, z2);
      const donde = `pad ${z1} → ${z2}`;
      registrar('zEntrada', Math.abs(m.zEntrada / z1 - 1), donde);
      registrar('zSalida', Math.abs(m.zSalida / z2 - 1), donde);
      registrar('atenuacion', Math.abs(m.atenuacion - r.aMin), donde);
      redes++;
    }
  }
  return { redes, ...peor };
}
