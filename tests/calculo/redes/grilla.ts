import { type RedBarrido, respuesta } from '../../../src/calculo/comun/barrido';
import { calcularRedL } from '../../../src/calculo/redes/redes';
import { c, cascada, modulo, zEntrada } from '../../oraculos/abcd';
import { GRILLA_FRECUENCIAS, GRILLA_RESISTENCIAS, VECES_F0 } from './casos';
import { elementoOraculo, s21Oraculo, zEntradaOraculo } from './elementos';

// Las grillas de verificación de redes de adaptación contra el oráculo ABCD (spec §13.3): las
// recorre el test y las muestra el Informe de casos, con el peor error y dónde estuvo.

export interface Peor {
  valor: number;
  donde: string;
}

function acumulador() {
  let peor: Peor = { valor: 0, donde: '' };
  return {
    registrar(valor: number, donde: string) {
      if (valor > peor.valor || peor.donde === '') peor = { valor, donde };
    },
    get peor() {
      return peor;
    },
  };
}

const variantesDe = (rs: number, rl: number, f0: number) => {
  const r = calcularRedL({ f0, rs, rl, qBobina: 100 });
  if (r.estado !== 'calculado') throw new Error(`no calculó ${rs} → ${rl} Ω: ${r.codigo}`);
  return r.variantes;
};

// Las dos variantes de cada par distinto de la grilla, en cada frecuencia: |Zin − R_s|/R_s en f₀
// con el oráculo.
export function recorrerGrilla(): { redes: number; zEntrada: Peor } {
  const acc = acumulador();
  let redes = 0;
  for (const f0 of GRILLA_FRECUENCIAS) {
    for (const rs of GRILLA_RESISTENCIAS) {
      for (const rl of GRILLA_RESISTENCIAS) {
        if (rs === rl) continue;
        for (const v of variantesDe(rs, rl, f0)) {
          const z = zEntradaOraculo(v, f0, rl);
          acc.registrar(
            modulo(c(z.re - rs, z.im)) / rs,
            `${v.filtrado} ${rs} → ${rl} Ω, ${f0 / 1e6} MHz`,
          );
          redes++;
        }
      }
    }
  }
  return { redes, zEntrada: acc.peor };
}

// Redes en las que el barrido común se compara contra el oráculo: las dos variantes de la red L,
// sin y con la R de pérdida de cada L, y dos atenuadores resistivos.
function redesDePrueba(): { nombre: string; red: RedBarrido; f0: number }[] {
  const redes: { nombre: string; red: RedBarrido; f0: number }[] = [];
  for (const [rs, rl, f0] of [
    [100, 1000, 100e6],
    [300, 50, 145e6],
    [12, 75, 30e6],
  ]) {
    for (const v of variantesDe(rs, rl, f0)) {
      const ideal = v.componentes.map(({ componente, posicion, valor }) => ({
        componente,
        posicion,
        valor,
      }));
      redes.push({
        nombre: `${v.filtrado} ${rs} → ${rl} Ω`,
        red: { rs, rl, elementos: ideal },
        f0,
      });
      const conPerdida = ideal.map((e) =>
        e.componente === 'L' ? { ...e, rSerie: (2 * Math.PI * f0 * e.valor) / 50 } : e,
      );
      redes.push({
        nombre: `${v.filtrado} ${rs} → ${rl} Ω con Q = 50`,
        red: { rs, rl, elementos: conPerdida },
        f0,
      });
    }
  }
  // El T de 10 dB de 50 Ω y el π de 20 dB de 300 a 50 Ω (A4 y A9 de los atenuadores).
  redes.push(
    {
      nombre: 'T de 10 dB',
      red: {
        rs: 50,
        rl: 50,
        elementos: [
          { componente: 'R', posicion: 'serie', valor: 25.9747 },
          { componente: 'R', posicion: 'derivacion', valor: 35.1364 },
          { componente: 'R', posicion: 'serie', valor: 25.9747 },
        ],
      },
      f0: 100e6,
    },
    {
      nombre: 'π de 20 dB',
      red: {
        rs: 300,
        rl: 50,
        elementos: [
          { componente: 'R', posicion: 'derivacion', valor: 571.042 },
          { componente: 'R', posicion: 'serie', valor: 606.249 },
          { componente: 'R', posicion: 'derivacion', valor: 53.3204 },
        ],
      },
      f0: 100e6,
    },
  );
  return redes;
}

// El peor error relativo de |S21|² y de Zin entre el barrido común y el oráculo, en f₀/50, 0,3·f₀,
// f₀, 2·f₀, 3·f₀ y 50·f₀.
export function recorrerBarrido(): { puntos: number; s21: Peor; zEntrada: Peor } {
  const s21 = acumulador();
  const z = acumulador();
  let puntos = 0;
  for (const { nombre, red, f0 } of redesDePrueba()) {
    for (const veces of VECES_F0) {
      const f = veces * f0;
      const propia = respuesta(red, f);
      const oraculo = s21Oraculo(red.elementos, f, red.rs, red.rl);
      const zOraculo = zEntrada(cascada(red.elementos.map((e) => elementoOraculo(e, f))), red.rl);
      const donde = `${nombre}, ${veces === 1 ? '' : `${Number(veces.toFixed(3))}·`}f₀`;
      s21.registrar(Math.abs(propia.s21Cuadrado / oraculo - 1), donde);
      z.registrar(
        modulo(c(propia.zEntrada.re - zOraculo.re, propia.zEntrada.im - zOraculo.im)) /
          modulo(zOraculo),
        donde,
      );
      puntos++;
    }
  }
  return { puntos, s21: s21.peor, zEntrada: z.peor };
}
