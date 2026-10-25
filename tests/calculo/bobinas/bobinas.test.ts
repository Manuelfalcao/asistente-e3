import temml from 'temml';
import { describe, expect, it } from 'vitest';
import {
  type EntradaBobina,
  PLAN_B_DIAMETRO_RF,
  REFERENCIAS_UNA_CAPA,
  calcularBobinas,
} from '../../../src/calculo/bobinas/bobinas';

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

function calculado(e: EntradaBobina, planB = false) {
  const r = calcularBobinas(e, { planB });
  if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
  return r;
}

describe('vecinos en pasos de media vuelta (spec §6.6)', () => {
  it('los dos vecinos rodean al N real, cada uno con su L, su error y su Largo de la bobina', () => {
    const { unaCapa } = calculado(entrada(100, 5, 0.8));
    const [abajo, arriba] = unaCapa.vecinos;
    expect(arriba.vueltas - abajo.vueltas).toBe(0.5);
    expect(abajo.vueltas).toBeLessThanOrEqual(unaCapa.vueltas);
    expect(arriba.vueltas).toBeGreaterThan(unaCapa.vueltas);
    expect(Number.isInteger(abajo.vueltas * 2)).toBe(true);
    expect(abajo.error).toBeLessThan(0);
    expect(arriba.error).toBeGreaterThan(0);
    expect(abajo.inductancia / 100e-9 - 1).toBeCloseTo(abajo.error, 12);
  });

  it('el Largo de la bobina es (N − 1)·p + d, medido por fuera', () => {
    const { unaCapa } = calculado(entrada(100, 6, 1, 1));
    for (const v of unaCapa.vecinos) {
      expect(v.largoBobina).toBeCloseTo((v.vueltas - 1) * 2 * mm + 1 * mm, 15);
    }
  });

  it('se destaca el más cercano a la L buscada', () => {
    const { unaCapa } = calculado(entrada(100, 5, 0.8));
    const [abajo, arriba] = unaCapa.vecinos;
    const cercano = Math.abs(abajo.error) <= Math.abs(arriba.error) ? abajo : arriba;
    expect(unaCapa.vecinos.filter((v) => v.destacado)).toEqual([cercano]);
  });
});

describe('diámetro del resultado principal (spec §6.3 y §13.5)', () => {
  it('por defecto es el de RF, D∞: la bandera del plan B está apagada', () => {
    expect(PLAN_B_DIAMETRO_RF).toBe(false);
    expect(calculado(entrada(100, 5, 0.8)).unaCapa.diametro).toBe('rf');
  });

  it('con el plan B es D0: 100 nH sobre 5 mm con 0,8 mm da 4,789 vueltas y 106,48 nH con 5', () => {
    // research/formulas-bobinas.md, §7.
    const { unaCapa } = calculado(entrada(100, 5, 0.8), true);
    expect(unaCapa.diametro).toBe('d0');
    expect(unaCapa.vueltas).toBeCloseTo(4.789, 3);
    expect(unaCapa.vecinos.map((v) => v.vueltas)).toEqual([4.5, 5]);
    expect(unaCapa.vecinos[1].inductancia / nH).toBeCloseTo(106.48, 2);
  });

  it('con D∞ hacen falta más vueltas que con D0', () => {
    const rf = calculado(entrada(100, 5, 0.8)).unaCapa.vueltas;
    const d0 = calculado(entrada(100, 5, 0.8), true).unaCapa.vueltas;
    expect(rf).toBeGreaterThan(d0);
  });
});

describe('cortes (spec §6.5 y §6.7)', () => {
  it('con menos de una vuelta no se calcula: hace falta un lazo o una pista', () => {
    for (const planB of [false, true]) {
      const r = calcularBobinas(entrada(5, 5, 0.8), { planB });
      expect(r.estado).toBe('corte');
      if (r.estado !== 'corte') return;
      expect(r.codigo).toBe('menos-de-una-vuelta');
      expect(r.texto).toMatch(/lazo o una pista/);
    }
  });

  it('aunque no se calcule, la L buscada pasa por el criterio de valor impracticable', () => {
    const r = calcularBobinas(entrada(5, 5, 0.8));
    expect(r.estado).toBe('corte');
    expect(r.revision.marcados.map((m) => m.nivel)).toEqual(['impracticable']);
    expect(r.estado === 'corte' && r.pasos.at(-1)?.texto).toBe(
      'L buscada: incertidumbre del montaje sobre L',
    );
  });

  it('con un cable más grueso que el carrete la L de RF deja de crecer: no se calcula', () => {
    const r = calcularBobinas(entrada(1e6, 1, 2));
    expect(r.estado === 'corte' && r.codigo).toBe('fuera-del-modelo');
  });
});

describe('SRF estimada (spec §6.6)', () => {
  it('la menor entre el largo de hilo y Medhurst, como en la tabla de la investigación', () => {
    // research/formulas-bobinas.md, §7, con D0 (el plan B): [L, carrete, cable, s, hilo, Medhurst],
    // en MHz y con las cifras que imprime la tabla.
    const tabla: [number, number, number, number, string, string][] = [
      [22, 4, 0.8, 0, '4500', '2100'],
      [47, 5, 0.8, 0, '2800', '1300'],
      [100, 5, 0.8, 0, '1700', '950'],
      [100, 6, 1, 1, '1200', '870'],
      [220, 6, 0.5, 0, '1250', '580'],
      [470, 8, 0.5, 0, '770', '340'],
      [1000, 6, 0.5, 0, '420', '290'],
    ];
    // Media unidad de la última cifra significativa impresa: "4500" va con ±50, "1250" con ±5.
    const margen = (impreso: string) =>
      0.5 * 10 ** (impreso.length - impreso.replace(/0+$/, '').length);
    for (const [l, carrete, cable, s, hilo, medhurst] of tabla) {
      const { srf } = calculado(entrada(l, carrete, cable, s), true).unaCapa;
      const nombre = `${l} nH sobre ${carrete} mm`;
      expect(Math.abs(srf.largoDeHilo / 1e6 - Number(hilo)), nombre).toBeLessThanOrEqual(
        margen(hilo),
      );
      expect(Math.abs(srf.medhurst / 1e6 - Number(medhurst)), nombre).toBeLessThanOrEqual(
        margen(medhurst),
      );
      expect(srf.estimada).toBe(Math.min(srf.largoDeHilo, srf.medhurst));
    }
  });
});

describe('avisos (spec §6.7)', () => {
  const codigos = (e: EntradaBobina, planB = false) =>
    calculado(e, planB).avisos.map((a) => a.codigo);

  it('con menos de dos vueltas avisa que el modelo pierde precisión', () => {
    for (const planB of [false, true]) {
      const r = calculado(entrada(15, 4, 0.8), planB);
      expect(r.unaCapa.vueltas).toBeLessThan(2);
      expect(r.avisos.map((a) => a.codigo)).toContain('menos-de-dos-vueltas');
      expect(r.avisos.find((a) => a.codigo === 'menos-de-dos-vueltas')?.texto).toMatch(
        /terminales dominan/,
      );
    }
  });

  it('con la frecuencia de trabajo por encima de SRF/3 avisa por autorresonancia', () => {
    for (const planB of [false, true]) {
      expect(codigos(entrada(1000, 6, 0.5, 0, 145e6), planB)).toContain('autorresonancia');
      expect(codigos(entrada(1000, 6, 0.5, 0, 50e6), planB)).not.toContain('autorresonancia');
      expect(codigos(entrada(1000, 6, 0.5, 0), planB)).not.toContain('autorresonancia');
    }
  });

  it('debajo de 100 nH la nota de terminales pasa a aviso destacado', () => {
    const r = calculado(entrada(47, 5, 0.8));
    const aviso = r.avisos.find((a) => a.codigo === 'terminales');
    expect(aviso?.texto).toMatch(/8 nH por cm/);
    expect(r.notas.join(' ')).not.toMatch(/8 nH por cm/);
    const cien = calculado(entrada(100, 5, 0.8));
    expect(cien.avisos.map((a) => a.codigo)).not.toContain('terminales');
    expect(cien.notas.join(' ')).toMatch(/8 nH por cm/);
  });

  it('siempre van las notas de terminales y de metal cercano', () => {
    for (const l of [47, 100, 1000]) {
      const r = calculado(entrada(l, 6, 0.5));
      const todo = [...r.avisos.map((a) => a.texto), ...r.notas].join(' ');
      expect(todo).toMatch(/8 nH por cm/);
      expect(r.notas.join(' ')).toMatch(/metal cercano/);
    }
  });

  it('una nota corta dice que estirar o comprimir la bobina ajusta la L', () => {
    expect(calculado(entrada(100, 5, 0.8)).unaCapa.notas.join(' ')).toMatch(
      /[Ee]stirar o comprimir la bobina ajusta la L/,
    );
  });
});

describe('valor impracticable de la L buscada (spec §5.6 y §6.7)', () => {
  const nivel = (e: EntradaBobina) => calculado(e).revision.marcados[0]?.nivel ?? null;

  it('la L mínima: Valor impracticable debajo de 6 nH y Valor dudoso debajo de 15 nH', () => {
    expect(nivel(entrada(5, 1, 0.2))).toBe('impracticable');
    expect(nivel(entrada(12, 2, 0.3))).toBe('dudoso');
    expect(nivel(entrada(20, 2, 0.3))).toBe(null);
  });

  it('el motivo nombra la L buscada y la cuenta va al final de los pasos', () => {
    const r = calculado(entrada(5, 1, 0.2, 0, 145e6));
    expect(r.revision.marcados[0].motivo).toBe(
      'L buscada: suponiendo montaje Manhattan, ±3 nH → 60 % de error',
    );
    expect(r.unaCapa.pasos.at(-1)?.texto).toBe('L buscada: incertidumbre del montaje sobre L');
  });
});

describe('pasos intermedios (spec §6.6)', () => {
  const textos = (r: ReturnType<typeof calculado>) => r.unaCapa.pasos.map((p) => p.texto);
  const latex = (r: ReturnType<typeof calculado>) => r.unaCapa.pasos.map((p) => p.latex);

  it('el N real, D0, Dmin, D∞, ℓ, x, kL, ks, km, Ls, la corrección y la L', () => {
    const r = calculado(entrada(100, 6, 1, 1));
    const todo = latex(r).join('\n');
    for (const simbolo of [
      'p = d + s',
      'D_0 = D_{\\mathrm{c}} + d',
      'N = ',
      'D_{\\mathrm{min}} = D_0 - d + \\dfrac{2d}{N}',
      'w = \\dfrac{1}{(p/d - 1)^2}',
      'D_\\infty = \\dfrac{D_0 + D_{\\mathrm{min}} w}{1 + w}',
      '\\ell = N p',
      'x = \\dfrac{D_\\infty}{\\ell}',
      'k_L = ',
      'k_s = \\dfrac{3}{2} - \\ln\\dfrac{2p}{d}',
      'k_m = \\ln 2\\pi',
      'L_s = \\dfrac{\\mu_0 \\pi D_\\infty^2 N^2 k_L}{4\\ell}',
      '\\Delta L = \\dfrac{\\mu_0 D_\\infty N (k_s + k_m)}{2}',
      'L = L_s - \\Delta L',
    ]) {
      expect(todo, simbolo).toContain(simbolo);
    }
  });

  it('la L sustituida con el N real da la L buscada', () => {
    const r = calculado(entrada(100, 6, 1, 1));
    expect(latex(r).find((l) => l.startsWith('L = L_s - \\Delta L'))).toMatch(
      /= 100\\,\\mathrm\{nH\}$/,
    );
  });

  it('ℓ va con la aclaración de que no es el Largo de la bobina', () => {
    const r = calculado(entrada(100, 5, 0.8));
    const delLargo = r.unaCapa.pasos.find((p) => p.latex.startsWith('\\ell = N p'));
    expect(delLargo?.texto).toMatch(/No es el Largo de la bobina/);
  });

  it('cada fórmula va con sus números sustituidos: kL con x y km con N', () => {
    // 100 nH sobre 5 mm con 0,8 mm, plan B: N = 4,789 y x = 5,8 / 3,831 = 1,514 (bobina corta).
    const corta = latex(calculado(entrada(100, 5, 0.8), true)).join('\n');
    expect(corta).toContain('1 + \\dfrac{0{,}383901}{1{,}514^2}');
    expect(corta).toContain('\\ln(4 \\cdot 1{,}514)');
    expect(corta).toContain('\\dfrac{\\ln 4{,}789}{6 \\cdot 4{,}789}');
    // 1 µH sobre 6 mm con 0,5 mm, plan B: N = 17,29 y x = 6,5 / 8,645 = 0,7519 (bobina larga).
    const larga = latex(calculado(entrada(1000, 6, 0.5), true)).join('\n');
    expect(larga).toContain('1 + 0{,}383901 \\cdot 0{,}7519^2');
    expect(larga).toContain('k_L = F - \\dfrac{4x}{3\\pi}');
  });

  it('los errores relativos de los pasos van con signo', () => {
    // Con D∞ de resultado principal, la L con D0 del mismo vecino es mayor: la diferencia es +.
    const r = calculado(entrada(100, 5, 0.8));
    const diferencia = r.unaCapa.pasos.find((p) => p.latex.startsWith('\\dfrac{L_0}{L} - 1'));
    expect(diferencia?.latex).toMatch(/= \+\d+\\,\\%$/);
  });

  it('con vueltas juntas, w es infinito y D∞ = Dmin', () => {
    expect(latex(calculado(entrada(100, 5, 0.8))).join('\n')).toContain(
      'w = \\dfrac{1}{(p/d - 1)^2} \\to \\infty',
    );
  });

  it('la L y el N con D0, y el efecto del esmalte en ks', () => {
    const r = calculado(entrada(100, 5, 0.8));
    // research/formulas-bobinas.md, §7: con D0, 4,789 vueltas.
    expect(latex(r)).toContain('N_0 = 4{,}789');
    expect(latex(r).some((l) => l.startsWith('L_0('))).toBe(true);
    expect(textos(r).join(' ')).toMatch(/esmalte/);
  });

  it('en el plan B el resultado va con D0 y D∞ queda como comparación', () => {
    const r = calculado(entrada(100, 5, 0.8), true);
    const todo = latex(r).join('\n');
    expect(todo).toContain('x = \\dfrac{D_0}{\\ell}');
    expect(todo).toContain('N = 4{,}789');
    expect(todo).toContain('D_\\infty = D_{\\mathrm{min}}');
    expect(latex(r).some((l) => l.startsWith('L_\\infty('))).toBe(true);
    expect(r.unaCapa.notaDiametro).toMatch(
      /Knight \(ec\. 4\.2, semiempírica\) las 5 vueltas darían/,
    );
  });

  it('con menos de dos vueltas la nota del plan B no dice que D∞ baja la L', () => {
    // Con N < 2, Dmin = D0 − d + 2d/N queda por encima de D0 y la L de RF sale mayor.
    const r = calculado(entrada(14, 4, 0.8), true);
    expect(r.unaCapa.notaDiametro).toMatch(/\(\+\d/);
    expect(r.unaCapa.notaDiametro).not.toMatch(/queda por debajo/);
    expect(r.unaCapa.notaDiametro).toMatch(/no corrige hacia abajo/);
    expect(calculado(entrada(100, 5, 0.8), true).unaCapa.notaDiametro).toMatch(/queda por debajo/);
  });

  it('con D∞ la nota del diámetro lo aclara como semiempírico y sin referato', () => {
    expect(calculado(entrada(100, 5, 0.8)).unaCapa.notaDiametro).toMatch(
      /Knight \(ec\. 4\.2\).*semiempírica, sin referato/,
    );
  });

  it('Wheeler 1928 con su N, su rango declarado, la diferencia y por qué no es el principal', () => {
    const r = calculado(entrada(100, 5, 0.8));
    // research/formulas-bobinas.md, §7: Wheeler pide 4,265 vueltas contra 4,789 de Rosa y Nagaoka.
    expect(latex(r)).toContain('n_W = \\dfrac{10pL + \\sqrt{100p^2L^2 + 36a^3L}}{2a^2} = 4{,}265');
    // Con esas vueltas Wheeler da la L buscada.
    expect(latex(r).find((l) => l.startsWith('L = \\dfrac{a^2 n_W^2}'))).toMatch(
      /= 100\\,\\mathrm\{nH\}$/,
    );
    const diferencia = r.unaCapa.pasos.find((p) => p.latex.startsWith('\\dfrac{n_W}{N_0}'));
    expect(diferencia?.latex).toMatch(/= -11\\,\\%$/);
    expect(diferencia?.texto).toMatch(/no tiene en cuenta el cable redondo/);
    expect(diferencia?.fuente).toMatch(/b > 0,8a.*dentro de su rango/);
  });

  it('Wheeler fuera de su rango lo dice', () => {
    const r = calculado(entrada(22, 4, 0.8));
    const diferencia = r.unaCapa.pasos.find((p) => p.latex.startsWith('\\dfrac{n_W}{N_0}'));
    expect(diferencia?.fuente).toMatch(/fuera de su rango/);
  });

  it('la SRF y, con frecuencia de trabajo, la comparación con SRF/3', () => {
    const r = calculado(entrada(1000, 6, 0.5, 0, 145e6));
    const todo = latex(r).join('\n');
    expect(todo).toContain('\\ell_w = \\sqrt{(\\pi D_0 N)^2 + \\ell^2}');
    expect(todo).toContain('f_{\\mathrm{M}} = \\dfrac{1}{2\\pi\\sqrt{L C_L}}');
    expect(todo).toMatch(/f = 145\\,\\mathrm\{MHz\} > \\dfrac\{f_\{\\mathrm\{SRF\}\}\}\{3\}/);
  });

  it('todas las fórmulas se dibujan con Temml y ningún comando perdió su barra', () => {
    const casos = [
      [entrada(100, 5, 0.8), false],
      [entrada(100, 6, 1, 1, 145e6), false],
      [entrada(1000, 6, 0.5, 0, 145e6), true],
      [entrada(15, 4, 0.8), true],
      [entrada(5, 1, 0.2), false],
    ] as const;
    const fuentes: string[] = [];
    for (const [e, planB] of casos) {
      const r = calculado(e, planB);
      fuentes.push(...r.unaCapa.formulas, ...latex(r));
    }
    const corte = calcularBobinas(entrada(5, 5, 0.8));
    if (corte.estado === 'corte') fuentes.push(...corte.pasos.map((p) => p.latex));
    for (const f of fuentes) {
      expect(() => temml.renderToString(f, { throwOnError: true, wrap: 'tex' }), f).not.toThrow();
      expect(f, f).not.toMatch(/(^|[^\\a-z])(dfrac|infty|quad|mathrm|sqrt|ln|pi|mu)(?![a-z])/);
    }
  });
});

describe('referencias (spec §6.8)', () => {
  it('Rosa y Nagaoka en la forma de Knight, Lundin, el D∞ semiempírico, la SRF y Wheeler', () => {
    const { referencias } = calculado(entrada(100, 5, 0.8)).unaCapa;
    expect(referencias).toBe(REFERENCIAS_UNA_CAPA);
    const texto = referencias
      .map((r) => `${r.autor} ${r.obra} ${r.anio} ${r.ubicacion}`)
      .join(' | ');
    expect(texto).toMatch(/Knight Solenoid Inductance Calculation 2016 ec\. 10\.6, 10\.4 y 10\.18/);
    expect(texto).toMatch(/Lundin Proc\. IEEE 1985/);
    expect(texto).toMatch(/ec\. 4\.2 \(diámetro efectivo de RF, semiempírica y sin referato\)/);
    expect(texto).toMatch(/self-resonance and self-capacitance of solenoid coils 2016/);
    expect(texto).toMatch(/Medhurst Wireless Engineer 1947/);
    expect(texto).toMatch(/Wheeler Proc\. IRE 1928/);
  });
});
