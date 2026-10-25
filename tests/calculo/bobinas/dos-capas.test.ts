import temml from 'temml';
import { describe, expect, it } from 'vitest';
import { type EntradaBobina, calcularBobinas } from '../../../src/calculo/bobinas/bobinas';
import {
  PLAN_B_DOS_CAPAS,
  REFERENCIAS_DOS_CAPAS,
  REFERENCIAS_DOS_CAPAS_PLAN_B,
} from '../../../src/calculo/bobinas/dos-capas';
import { citar } from '../../../src/calculo/comun/referencia';

const mm = 1e-3;
const nH = 1e-9;

const entrada = (
  inductancia: number,
  carrete: number,
  cable: number,
  separacion = 0,
  frecuencia: number | null = null,
): EntradaBobina => ({
  inductancia: inductancia * nH,
  carrete: carrete * mm,
  cable: cable * mm,
  separacion: separacion * mm,
  frecuencia,
});

function resultado(e: EntradaBobina, planBDosCapas = false) {
  const r = calcularBobinas(e, { planBDosCapas });
  if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
  return r;
}

function dosCapas(e: EntradaBobina, planBDosCapas = false) {
  const { dosCapas } = resultado(e, planBDosCapas);
  if (dosCapas.estado !== 'calculado') throw new Error(`fuera de rango: ${dosCapas.codigo}`);
  return dosCapas;
}

// research/formulas-bobinas.md, §7: la única bobina de dos capas de la tabla dentro del rango.
const CUATRO_COMA_SIETE = entrada(4700, 8, 0.4);

describe('dos capas junto a una capa (spec §6.1 y §6.6)', () => {
  it('se calcula siempre, junto a la de una capa', () => {
    const r = resultado(CUATRO_COMA_SIETE);
    expect(r.unaCapa.vecinos).toHaveLength(2);
    expect(r.dosCapas.estado).toBe('calculado');
  });

  it('4,7 µH sobre 8 mm con 0,4 mm: n = 12,352 y 4503,0 nH con 12 por capa (research §7)', () => {
    const d = dosCapas(CUATRO_COMA_SIETE);
    expect(d.vueltasPorCapa).toBeCloseTo(12.352, 3);
    expect(d.vecinos.map((v) => v.vueltasPorCapa)).toEqual([12, 12.5]);
    expect(d.vecinos[0].inductancia / nH).toBeCloseTo(4503.0, 1);
  });

  it('cada vecino lleva las vueltas por capa y el total, que puede ser impar', () => {
    const [abajo, arriba] = dosCapas(CUATRO_COMA_SIETE).vecinos;
    expect([abajo.vueltas, arriba.vueltas]).toEqual([24, 25]);
  });

  it('los vecinos rodean al n real, con su L, su error con signo y el Largo de la bobina', () => {
    const d = dosCapas(entrada(2000, 10, 0.4, 0.2));
    const [abajo, arriba] = d.vecinos;
    expect(arriba.vueltasPorCapa - abajo.vueltasPorCapa).toBe(0.5);
    expect(abajo.vueltasPorCapa).toBeLessThanOrEqual(d.vueltasPorCapa);
    expect(arriba.vueltasPorCapa).toBeGreaterThan(d.vueltasPorCapa);
    expect(abajo.error).toBeLessThan(0);
    expect(arriba.error).toBeGreaterThan(0);
    expect(abajo.inductancia / 2000e-9 - 1).toBeCloseTo(abajo.error, 12);
    for (const v of d.vecinos) {
      // (n − 1)·p + d, con n por capa.
      expect(v.largoBobina).toBeCloseTo((v.vueltasPorCapa - 1) * 0.6 * mm + 0.4 * mm, 15);
    }
    const cercano = Math.abs(abajo.error) <= Math.abs(arriba.error) ? abajo : arriba;
    expect(d.vecinos.filter((v) => v.destacado)).toEqual([cercano]);
  });

  it('el diámetro exterior es el Diámetro del carrete + 4d', () => {
    expect(dosCapas(CUATRO_COMA_SIETE).diametroExterior).toBeCloseTo(9.6 * mm, 15);
  });
});

describe('plan B de dos capas (spec §6.4 y §13.5)', () => {
  it('por defecto se corrige con Maxwell: la bandera del plan B está apagada', () => {
    expect(PLAN_B_DOS_CAPAS).toBe(false);
    expect(dosCapas(CUATRO_COMA_SIETE).correccion).toBe('maxwell');
  });

  it('con el plan B es Rosa y Grover (91) sola, sin ΔL2', () => {
    const plan = dosCapas(CUATRO_COMA_SIETE, true);
    expect(plan.correccion).toBe('plan-b');
    // Con vueltas juntas ΔL2 = μ0·a·N·(−0,1119 + 0,017) resta: sin ella hacen falta menos vueltas.
    expect(plan.vueltasPorCapa).toBeLessThan(dosCapas(CUATRO_COMA_SIETE).vueltasPorCapa);
    // Con s = d, ln(D′/d) = ln √2 la vuelve positiva: sin ella hacen falta más.
    const separadas = entrada(4700, 8, 0.4, 0.4);
    expect(dosCapas(separadas, true).vueltasPorCapa).toBeGreaterThan(
      dosCapas(separadas).vueltasPorCapa,
    );
  });

  it('la bandera de dos capas no toca la de una capa', () => {
    const conPlan = resultado(CUATRO_COMA_SIETE, true);
    expect(conPlan.unaCapa).toEqual(resultado(CUATRO_COMA_SIETE).unaCapa);
  });
});

describe('fuera de rango (spec §6.4 y §6.7)', () => {
  const fuera = (e: EntradaBobina) => {
    const r = resultado(e);
    if (r.dosCapas.estado !== 'fuera-de-rango') throw new Error('se calculó');
    return { r, dosCapas: r.dosCapas };
  };

  it('c/a > 0,25: 470 nH sobre 4 mm con 0,5 mm', () => {
    const { r, dosCapas } = fuera(entrada(470, 4, 0.5));
    expect(dosCapas.codigo).toBe('cable-grueso');
    expect(dosCapas.texto).toMatch(/c\/a > 0,25/);
    // La de una capa se muestra siempre.
    expect(r.unaCapa.vecinos).toHaveLength(2);
  });

  it('n′ < 1: 150 nH sobre 10 mm con 0,5 mm piden menos de 2 vueltas por capa', () => {
    const { dosCapas } = fuera(entrada(150, 10, 0.5));
    expect(dosCapas.codigo).toBe('mas-corta-que-profunda');
    expect(dosCapas.texto).toMatch(/n′ = b\/c < 1/);
  });

  it('n′ < 1 en el vecino de abajo, aunque el n real entre en el rango', () => {
    // Con s = 0,25 mm, n′ = 1 con n = 1,333; la L pide n = 1,447 y el vecino de abajo es 1.
    const { dosCapas } = fuera(entrada(150, 10, 0.5, 0.25));
    expect(dosCapas.codigo).toBe('mas-corta-que-profunda');
  });

  it('con vueltas muy separadas, menos de una vuelta por capa', () => {
    const { dosCapas } = fuera(entrada(40, 10, 0.5, 1));
    expect(dosCapas.codigo).toBe('menos-de-una-vuelta-por-capa');
  });

  it('el motivo no lleva números de dos capas: ni vueltas ni L', () => {
    for (const e of [entrada(470, 4, 0.5), entrada(150, 10, 0.5), entrada(40, 10, 0.5, 1)]) {
      const { dosCapas } = fuera(e);
      expect(Object.keys(dosCapas).sort()).toEqual(['codigo', 'estado', 'texto']);
      expect(dosCapas.texto).not.toMatch(/\d+(,\d+)? ?(nH|µH|vueltas)/);
    }
  });

  it('cuando una capa no se calcula, no hay tarjeta de dos capas', () => {
    expect(calcularBobinas(entrada(5, 5, 0.8)).estado).toBe('corte');
  });
});

describe('SRF, avisos y notas de dos capas (spec §6.6 y §6.7)', () => {
  it('la SRF estimada es la menor entre el largo de hilo y Medhurst, con la aclaración de una capa', () => {
    const d = dosCapas(CUATRO_COMA_SIETE);
    expect(d.srf.estimada).toBe(Math.min(d.srf.largoDeHilo, d.srf.medhurst));
    expect(d.notas.join(' ')).toMatch(/capacidad entre capas/);
  });

  it('siempre avisa que en RF la L real queda algo por debajo, sin cuantificarlo', () => {
    const rf = dosCapas(CUATRO_COMA_SIETE).avisos.find((a) => a.codigo === 'rf');
    expect(rf?.texto).toMatch(/en RF .* la L real va a quedar algo por debajo/);
    expect(rf?.texto).not.toMatch(/\d/);
  });

  it('avisa por autorresonancia con la frecuencia de trabajo por encima de un tercio de su SRF', () => {
    const d = dosCapas(CUATRO_COMA_SIETE);
    const codigos = (f: number) =>
      dosCapas(entrada(4700, 8, 0.4, 0, f)).avisos.map((a) => a.codigo);
    expect(codigos(d.srf.estimada / 2.9)).toEqual(['rf', 'autorresonancia']);
    expect(codigos(d.srf.estimada / 3.1)).toEqual(['rf']);
  });

  it('la nota de las ranuras: la L baja cerca de un 1 %', () => {
    expect(dosCapas(CUATRO_COMA_SIETE).notas.join(' ')).toMatch(
      /apilada.*mismo sentido.*ranuras.*cerca de un 1 %/,
    );
  });

  it('la fórmula marca sus adaptaciones; en el plan B, lo que daría la de Maxwell', () => {
    expect(dosCapas(CUATRO_COMA_SIETE).notaFormula).toBe(
      'Rosa y Grover (91) y (93), con adaptación propia para RF y Separación, verificada contra ' +
        'suma de anillos.',
    );
    expect(dosCapas(CUATRO_COMA_SIETE, true).notaFormula).toMatch(
      /^Rosa y Grover \(91\) sola.*las 12,5 vueltas por capa darían 4,\d+ µH \([+−]/,
    );
  });
});

describe('pasos intermedios de dos capas (spec §6.6)', () => {
  const latex = (d: ReturnType<typeof dosCapas>) => d.pasos.map((p) => p.latex);

  it('la geometría, el rango, Ls, ΔL1, Bs, D′, el término de Maxwell, ΔL2 y la L', () => {
    const todo = latex(dosCapas(entrada(2000, 10, 0.4, 0.2))).join('\n');
    for (const simbolo of [
      'p = d + s',
      'a = \\dfrac{D_{\\mathrm{c}}}{2} + d',
      'c = 2d',
      '\\dfrac{c}{a} = ',
      'D_{\\mathrm{ext}} = D_{\\mathrm{c}} + 4d',
      'n = ',
      'N = 2n',
      'b = n p',
      "n' = \\dfrac{b}{c}",
      'x = \\dfrac{2a}{b}',
      'k_L = ',
      'L_s = \\dfrac{\\mu_0 \\pi (2a)^2 N^2 k_L}{4b}',
      "B_s(n') \\approx 0{,}3522843",
      '\\Delta L_1 = \\mu_0 a N^2 \\dfrac{c}{b}',
      "D' = \\sqrt{p d}",
      "\\ln\\dfrac{D'}{d} - 0{,}1119 + E",
      '\\Delta L_2 = \\mu_0 a N',
      'L = L_s - \\Delta L_1 + \\Delta L_2',
    ]) {
      expect(todo, simbolo).toContain(simbolo);
    }
  });

  it('la L sustituida con el n real da la L buscada', () => {
    const d = dosCapas(entrada(2000, 10, 0.4, 0.2));
    expect(latex(d).find((l) => l.startsWith('L = L_s - \\Delta L_1 + \\Delta L_2'))).toMatch(
      /= 2\\,\\mathrm\{µH\}$|= 2\\,\\mathrm\{\\mu H\}$/,
    );
  });

  it('el término E queda con su decisión: se mantiene, con los casos contra la suma de anillos', () => {
    const d = dosCapas(CUATRO_COMA_SIETE);
    const maxwell = d.pasos.find((p) => p.latex.startsWith("\\ln\\dfrac{D'}{d} - 0{,}1119 + E"));
    expect(maxwell?.latex).toContain('+ 0{,}017 =');
    expect(maxwell?.fuente).toMatch(/E = 0,017.*se mantiene.*suma de anillos.*con E.*sin E/);
  });

  it('b va con la aclaración de que no es el Largo de la bobina', () => {
    const paso = dosCapas(CUATRO_COMA_SIETE).pasos.find((p) => p.latex.startsWith('b = n p'));
    expect(paso?.texto).toMatch(/No es el Largo de la bobina/);
  });

  it('la comparación con el plan B, y en el plan B con la corrección de Maxwell', () => {
    const propia = latex(dosCapas(CUATRO_COMA_SIETE));
    expect(propia.some((l) => l.startsWith('L_{91}('))).toBe(true);
    // Con vueltas juntas Rosa (91) sola queda cerca: research §5.4, de −0,03 a +0,19 %.
    expect(propia.find((l) => l.startsWith('\\dfrac{L_{91}}{L} - 1'))).toMatch(
      /= [+-]?0{,}\d+\\,\\%$/,
    );
    const planB = latex(dosCapas(CUATRO_COMA_SIETE, true));
    expect(planB.join('\n')).not.toContain('\\Delta L_2 = ');
    expect(planB).toContain(
      planB.find((l) => l.startsWith('L = L_s - \\Delta L_1 = ')) ?? 'falta la L del plan B',
    );
    expect(planB.some((l) => l.startsWith('L_{93}('))).toBe(true);
  });

  it('la SRF con el diámetro medio y, con frecuencia de trabajo, la comparación con SRF/3', () => {
    const todo = latex(dosCapas(entrada(4700, 8, 0.4, 0, 30e6))).join('\n');
    expect(todo).toContain('D_{\\mathrm{m}} = 2a');
    expect(todo).toContain('\\ell_w = \\sqrt{(\\pi D_{\\mathrm{m}} N)^2 + (2b)^2}');
    expect(todo).toContain('\\dfrac{C_L}{D_{\\mathrm{m}}} = 0{,}1126 \\dfrac{b}{D_{\\mathrm{m}}}');
    expect(todo).toMatch(/f = 30\\,\\mathrm\{MHz\} \\leq \\dfrac\{f_\{\\mathrm\{SRF\}\}\}\{3\}/);
  });

  it('Hazeltine con su N, su rango declarado, la diferencia y por qué no es el principal', () => {
    const d = dosCapas(CUATRO_COMA_SIETE);
    // La raíz de la cuadrática va aparte, para que N_H entre en 375 px.
    expect(latex(d).some((l) => l.startsWith('R = \\sqrt{(4{,}5pL)^2'))).toBe(true);
    expect(latex(d).some((l) => l.startsWith('N_H = \\dfrac{4{,}5pL + R}{1{,}6a^2} = '))).toBe(
      true,
    );
    // Con esas vueltas Hazeltine da la L buscada.
    expect(latex(d).find((l) => l.startsWith('L = \\dfrac{0{,}8a^2 N_H^2}'))).toMatch(
      /= 4{,}7\\,\\mathrm\{\\mu H\}$/,
    );
    const terminos = d.pasos.find((p) => p.latex.startsWith('6a = '));
    expect(terminos?.fuente).toMatch(/parecidos.*fuera de su rango/);
    const diferencia = d.pasos.find((p) => p.latex.startsWith('\\dfrac{N_H}{N} - 1'));
    expect(diferencia?.latex).toMatch(/= [+-]\d/);
    expect(diferencia?.texto).toMatch(
      /No es el cálculo principal.*cable redondo.*fuera de su rango/,
    );
  });

  it('todas las fórmulas se dibujan con Temml y ningún comando perdió su barra', () => {
    const fuentes: string[] = [];
    for (const [e, planB] of [
      [CUATRO_COMA_SIETE, false],
      [CUATRO_COMA_SIETE, true],
      [entrada(2000, 10, 0.4, 0.2, 145e6), false],
      [entrada(10000, 10, 0.3), true],
    ] as const) {
      const d = dosCapas(e, planB);
      fuentes.push(...d.formulas, ...latex(d));
    }
    for (const f of fuentes) {
      expect(() => temml.renderToString(f, { throwOnError: true, wrap: 'tex' }), f).not.toThrow();
      expect(f, f).not.toMatch(
        /(^|[^\\a-z])(dfrac|infty|quad|mathrm|sqrt|ln|pi|mu|Delta|left|right)(?![a-z])/,
      );
    }
  });
});

describe('referencias de dos capas (spec §6.8)', () => {
  it('Rosa y Grover (91) y (93) marcando la adaptación, la Circular 74, la Tabla X y Hazeltine', () => {
    const d = dosCapas(CUATRO_COMA_SIETE);
    expect(d.referencias).toEqual(REFERENCIAS_DOS_CAPAS);
    const texto = citar(d.referencias)
      .map((p) => `${p.obra ?? ''}${p.texto}`)
      .join('');
    expect(texto).toMatch(
      /Rosa y F\. W\. Grover, .*1912, \(91\) y \(93\), con adaptación propia para RF y Separación, verificada contra suma de anillos, y Tabla X/,
    );
    expect(texto).toMatch(/Circular 74.*1918, ec\. 156 y 159/);
    expect(texto).toMatch(/Lundin/);
    expect(texto).toMatch(/Medhurst/);
    expect(texto).toMatch(/Wheeler.*1928.*Hazeltine/);
  });

  it('en el plan B no cita la (93) ni la adaptación', () => {
    const d = dosCapas(CUATRO_COMA_SIETE, true);
    expect(d.referencias).toEqual(REFERENCIAS_DOS_CAPAS_PLAN_B);
    const texto = d.referencias.map((r) => r.ubicacion).join(' ');
    expect(texto).not.toMatch(/\(93\)|159|adaptación/);
  });
});
