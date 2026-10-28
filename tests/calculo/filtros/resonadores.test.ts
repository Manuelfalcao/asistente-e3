import { describe, expect, it } from 'vitest';
import {
  type EntradaResonadores,
  type ResultadoResonadores,
  PLAN_B_CHEBYSHEV_PAR,
  PLAN_B_DIVISOR_CAPACITIVO,
  calcularResonadores,
  cifrasDeSintonia,
} from '../../../src/calculo/filtros/resonadores';
import { entradaResonadores as entrada } from './casos-resonadores';
import { atenuacionAcoplada, entradaAcoplada } from './elementos';

// La Topología de resonadores acoplados (spec §7.7): Matthaei Fig. 8.11-1 despejado en L. Los casos
// CR1 a CR14 están en casos-resonadores.ts; acá van las propiedades. Todo en 144–148 MHz,
// Butterworth n = 3, de 50 a 50 Ω y con L = 22 nH, salvo que se diga otra cosa.

const BANDA = { f1: 144e6, f2: 148e6 };

function calculado(e: EntradaResonadores | ResultadoResonadores) {
  const r = 'estado' in e ? e : calcularResonadores(e);
  if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
  return r;
}

describe('Bessel: el g grande del lado de la R mayor (spec §7.7)', () => {
  const bessel = (rs: number, rl: number) => calculado(entrada({ aproximacion: 'bessel', rs, rl }));

  it('con Rs = RL va la orientación de la tabla (CR4), sin nota', () => {
    const r = bessel(50, 50);
    expect(r.invertido).toBe(false);
    expect(r.extremos.map((x) => x.rp)).toEqual([
      expect.closeTo(1622.8, 1),
      expect.closeTo(248.5, 1),
    ]);
    expect(r.notas.join(' ')).not.toMatch(/g grande/);
  });

  it('de 50 a 300 Ω se invierte sin preguntar (CR14), con nota y el detalle en los pasos', () => {
    const r = bessel(50, 300);
    expect(r.invertido).toBe(true);
    expect(r.extremos.map((x) => x.rp)).toEqual([
      expect.closeTo(248.5, 1),
      expect.closeTo(1622.8, 1),
    ]);
    expect(r.extremos[1].capacitor.valor * 1e12).toBeCloseTo(1.731, 3);
    expect(r.notas.some((t) => /g grande.*R mayor/.test(t))).toBe(true);
    expect(r.pasos.some((p) => /invertid/.test(p.texto))).toBe(true);
  });

  it('de 300 a 50 Ω el g grande de la tabla ya queda del lado de la R mayor', () => {
    const r = bessel(300, 50);
    expect(r.invertido).toBe(false);
    expect(r.extremos[0].rp).toBeCloseTo(1622.8, 1);
    expect(r.notas.some((t) => /g grande.*R mayor/.test(t))).toBe(true);
  });
});

describe('Chebyshev de Orden par, Deducción propia (spec §7.7 y §13.5)', () => {
  const par = (orden: number, ripple: number, rl = 50, planBChebyshevPar?: boolean) =>
    calculado(
      calcularResonadores(entrada({ aproximacion: 'chebyshev', ripple, orden, rl }), {
        planBChebyshevPar,
      }),
    );

  it('por defecto la bandera del plan B está apagada', () => {
    expect(PLAN_B_CHEBYSHEV_PAR).toBe(false);
  });

  it('el Orden par queda libre: el Capacitor de extremo de la salida absorbe el g(n+1) ≠ 1', () => {
    for (const [orden, ripple, rl] of [
      [4, 0.1, 50],
      [2, 0.5, 50],
      [4, 0.5, 300],
    ] as const) {
      const r = par(orden, ripple, rl);
      expect(r.orden).toBe(orden);
      expect(r.avisos.map((a) => a.codigo)).not.toContain('chebyshev-par');
      // En la Frecuencia de sintonía la pérdida es el ripple: f0 es un máximo del ripple.
      expect(atenuacionAcoplada(r, r.sintonia.f0, 50, rl)).toBeCloseTo(ripple, 9);
      expect(r.notas.some((t) => /pérdida es igual al ripple/.test(t))).toBe(true);
    }
  });

  it('con el plan B el par sube al impar, con aviso, como en π y T', () => {
    const r = par(4, 0.1, 50, true);
    expect(r.orden).toBe(5);
    expect(r.ordenPedido).toBe(4);
    expect(r.avisos.map((a) => a.codigo)).toContain('chebyshev-par');
    expect(atenuacionAcoplada(r, r.sintonia.f0, 50, 50)).toBeCloseTo(0, 9);
    expect(r.notas.some((t) => /pérdida es igual al ripple/.test(t))).toBe(false);
  });

  it('el impar no cambia con la bandera', () => {
    const propia = par(3, 0.5);
    const planB = par(3, 0.5, 50, true);
    expect(planB.orden).toBe(3);
    expect(planB.acoples.map((a) => a.capacitor.valor)).toEqual(
      propia.acoples.map((a) => a.capacitor.valor),
    );
  });
});

describe('la Ventana de L y la L propuesta (spec §7.7, research §6.2)', () => {
  const nH = 1e-9;
  // Las ventanas de la investigación en 144–148 MHz, con la L mínima de Valor impracticable (6 nH)
  // en lugar de los 5 nH provisorios, y la L más grande de la E12 adentro.
  const VENTANAS = [
    ['Butterworth n = 3, 50 → 50', { orden: 3 }, 6, 23.0, 22],
    ['Butterworth n = 3, 50 → 300', { orden: 3, rl: 300 }, 8.96, 23.0, 22],
    ['Chebyshev 0,1 dB n = 3, 50 → 50', { aproximacion: 'chebyshev', ripple: 0.1 }, 6, 29.9, 27],
    [
      'Chebyshev 0,1 dB n = 3, 50 → 300',
      { aproximacion: 'chebyshev', ripple: 0.1, rl: 300 },
      8.69,
      29.9,
      27,
    ],
    [
      'Chebyshev 0,5 dB n = 3, 50 → 300',
      { aproximacion: 'chebyshev', ripple: 0.5, rl: 300 },
      6,
      24.6,
      22,
    ],
    ['Butterworth n = 5, 50 → 50', { orden: 5 }, 6, 18.1, 18],
    ['Butterworth n = 5, 50 → 300', { orden: 5, rl: 300 }, 14.5, 18.1, 18],
    ['Bessel n = 3, 50 → 300 (invertido)', { aproximacion: 'bessel', rl: 300 }, 6, 22.3, 22],
  ] as const;

  for (const [caso, datos, min, max, propuesta] of VENTANAS) {
    it(`${caso}: de ${min} a ${max} nH, propone ${propuesta} nH`, () => {
      const r = calculado(entrada({ ...datos, inductancia: null }));
      expect(r.ventana.min / nH).toBeCloseTo(min, min === 6 ? 9 : 2);
      expect(r.ventana.max / nH).toBeCloseTo(max, 1);
      expect(r.ventana.vacia).toBe(false);
      expect(r.ventana.propuesta / nH).toBeCloseTo(propuesta, 9);
      expect(r.inductancia.valor).toBe(r.ventana.propuesta);
      expect(r.lPropuesta).toBe(true);
    });
  }

  it('la L que escribe el Alumno manda sobre la propuesta', () => {
    const r = calculado(entrada({ inductancia: 15e-9 }));
    expect(r.inductancia.valor).toBe(15e-9);
    expect(r.lPropuesta).toBe(false);
    expect(r.ventana.propuesta).toBeCloseTo(22e-9, 18);
  });

  it('en la cota del extremo el resonador ve justo la R; en la del acople, el acople es 1 pF', () => {
    const r = calculado(entrada({ rl: 300, inductancia: null }));
    const enLaCota = calculado(
      entrada({ rl: 300, inductancia: r.ventana.cotas.extremos[1] * 1.000001 }),
    );
    expect(enLaCota.extremos[1].rp / 300).toBeCloseTo(1, 5);
    const arriba = calculado(entrada({ rl: 300, inductancia: r.ventana.max }));
    const menor = Math.min(...arriba.acoples.map((a) => a.capacitor.valor));
    expect(menor * 1e12).toBeCloseTo(1, 12);
  });

  it('con Orden 1, sin acoples, la cota de arriba la pone el Capacitor de extremo más chico', () => {
    const r = calculado(entrada({ orden: 1, rl: 200, inductancia: null }));
    expect(r.acoples).toHaveLength(0);
    expect(Number.isFinite(r.ventana.max)).toBe(true);
    const arriba = calculado(entrada({ orden: 1, rl: 200, inductancia: r.ventana.max }));
    const menor = Math.min(...arriba.extremos.map((x) => x.capacitor.valor));
    expect(menor * 1e12).toBeCloseTo(1, 12);
    expect(r.ventana.propuesta).toBeLessThan(r.ventana.max);
  });

  // De 120 a 160 MHz (FBW ≈ 28 %) el acople pide L < 263 nH, pero el C01e crece con la L y se
  // come el Capacitor de sintonía de los extremos mucho antes.
  const ANCHA = { f1: 120e6, f2: 160e6 };
  const menorSintonia = (r: ReturnType<typeof calculado>) =>
    Math.min(...r.sintonias.map((s) => s.capacitor.valor));

  it('con banda ancha la cota de arriba la pone el Capacitor de sintonía más chico en 1 pF', () => {
    const r = calculado(entrada({ banda: ANCHA, inductancia: null }));
    expect(r.ventana.max).toBe(r.ventana.cotas.sintonia);
    expect(r.ventana.max).toBeLessThan(r.ventana.cotas.acople);
    const justo = calculado(entrada({ banda: ANCHA, inductancia: r.ventana.max }));
    expect(menorSintonia(justo) * 1e12).toBeCloseTo(1, 6);
    expect(menorSintonia(r)).toBeGreaterThan(1e-12);
  });

  it('con Orden 1 de 140 a 160 MHz la propuesta no deja Capacitores de sintonía de menos de 1 pF', () => {
    const r = calculado(entrada({ orden: 1, banda: { f1: 140e6, f2: 160e6 }, inductancia: null }));
    expect(menorSintonia(r)).toBeGreaterThan(1e-12);
  });

  it('dice cómo eligió la L propuesta', () => {
    expect(calculado(entrada({ inductancia: null })).ventana.propuestaComo).toBe('mayor-e12');
    const vacia = calculado(entrada({ orden: 7, rl: 300, inductancia: null }));
    expect(vacia.ventana.propuestaComo).toBe('vacia');
  });

  it('con la ventana vacía se propone la L más chica de la E12 sobre la cota de abajo', () => {
    // Butterworth n = 7 de 50 a 300 Ω: el extremo pide más de 20,1 nH y el acople, menos de 17,2.
    const r = calculado(entrada({ orden: 7, rl: 300, inductancia: null }));
    expect(r.ventana.vacia).toBe(true);
    expect(r.ventana.min / nH).toBeCloseTo(20.14, 2);
    expect(r.ventana.max / nH).toBeCloseTo(17.16, 2);
    expect(r.ventana.propuesta / nH).toBeCloseTo(22, 9);
  });
});

describe('realizabilidad y L fuera de la ventana (spec §7.7 y §7.10)', () => {
  const codigos = (r: ResultadoResonadores) =>
    r.estado === 'calculado' ? r.avisos.map((a) => a.codigo) : [];

  it('CR9: con L = 8 nH de 50 a 300 Ω el extremo de salida no llega; dice cuál y la L mínima', () => {
    const r = calcularResonadores(entrada({ rl: 300, inductancia: 8e-9 }));
    expect(r.estado).toBe('corte');
    if (r.estado !== 'corte') return;
    expect(r.codigo).toBe('extremo-no-realizable');
    expect(r.texto).toMatch(/salida/);
    expect(r.texto).toContain('268 Ω');
    expect(r.texto).toContain('8,96 nH');
    expect(r.texto).not.toMatch(/entrada/);
    expect(r.ventana?.min).toBeCloseTo(8.96e-9, 11);
  });

  it('con los dos extremos cortos los nombra a los dos, con la L mínima de cada uno', () => {
    const r = calcularResonadores(entrada({ rs: 1000, rl: 600, inductancia: 10e-9 }));
    expect(r.estado === 'corte' && r.codigo).toBe('extremo-no-realizable');
    if (r.estado !== 'corte') return;
    expect(r.texto).toMatch(/entrada.*salida/);
  });

  it('una L dentro de la ventana no avisa nada de la ventana', () => {
    const avisos = codigos(calcularResonadores(entrada({ inductancia: 15e-9 })));
    expect(avisos).not.toContain('debajo-de-l-minima');
    expect(avisos).not.toContain('acople-debajo-del-minimo');
    expect(avisos).not.toContain('ventana-vacia');
  });

  it('debajo de la L mínima avisa esa cota', () => {
    const r = calcularResonadores(entrada({ inductancia: 5e-9 }));
    expect(codigos(r)).toEqual(expect.arrayContaining(['debajo-de-l-minima']));
    expect(codigos(r)).not.toContain('acople-debajo-del-minimo');
  });

  it('por encima de la ventana avisa el Capacitor de acople mínimo', () => {
    const r = calcularResonadores(entrada({ inductancia: 27e-9 }));
    expect(codigos(r)).toEqual(expect.arrayContaining(['acople-debajo-del-minimo']));
    expect(
      r.estado === 'calculado' &&
        r.avisos.find((a) => a.codigo === 'acople-debajo-del-minimo')?.texto,
    ).toMatch(/C12/);
  });

  it('con la ventana vacía avisa y sugiere bajar el Orden o aceptar acoples debajo del mínimo', () => {
    const r = calcularResonadores(entrada({ orden: 7, rl: 300, inductancia: null }));
    expect(codigos(r)).toContain('ventana-vacia');
    const texto =
      r.estado === 'calculado' ? r.avisos.find((a) => a.codigo === 'ventana-vacia')!.texto : '';
    expect(texto).toMatch(/Bajá el Orden/);
    expect(texto).toMatch(/acoples/);
    expect(codigos(r)).not.toContain('acople-debajo-del-minimo');
  });

  it('con la ventana vacía, la L del Alumno igual avisa qué cotas viola', () => {
    // 145–146 MHz, Butterworth n = 5: el acople pide L < 4,6 nH, debajo de la L mínima.
    const r = calcularResonadores(
      entrada({ banda: { f1: 145e6, f2: 146e6 }, orden: 5, inductancia: 5e-9 }),
    );
    expect(codigos(r)).toEqual(
      expect.arrayContaining(['ventana-vacia', 'debajo-de-l-minima', 'acople-debajo-del-minimo']),
    );
  });

  it('un Capacitor de sintonía de un extremo negativo corta, y dice qué L lo arregla', () => {
    // De 120 a 160 MHz (FBW = 28,29 %), C1/Cr = 1 − FBW·Q/g − k12 > 0 pide
    // Rp < R·(1 + (g·(1 − k12)/FBW)²) = 449,9 Ω, o sea L < 149 nH (cuenta a mano).
    const r = calcularResonadores(
      entrada({ banda: { f1: 120e6, f2: 160e6 }, inductancia: 220e-9 }),
    );
    expect(r.estado === 'corte' && r.codigo).toBe('sintonia-negativa');
    if (r.estado !== 'corte') return;
    expect(r.texto).toMatch(/C1 queda en −.*L < 149 nH/);
  });

  it('si ninguna L arma el filtro corta, dice por qué y no pide subir la L', () => {
    // 200–300 MHz de 50 a 300 Ω: la salida pide L > 79,6 nH y C1 > 0, L < 58,2 nH (cuenta a mano).
    const r = calcularResonadores(
      entrada({ banda: { f1: 200e6, f2: 300e6 }, rl: 300, inductancia: null }),
    );
    expect(r.estado === 'corte' && r.codigo).toBe('sin-l-realizable');
    if (r.estado !== 'corte') return;
    expect(r.texto).toMatch(/salida.*79,6 nH/);
    expect(r.texto).toMatch(/C1.*58,2 nH/);
    expect(r.texto).not.toMatch(/Subí la L/);
  });

  it('un Capacitor de sintonía del medio negativo no depende de la L: tampoco hay L que sirva', () => {
    // De 100 a 300 MHz (FBW = 90,28 %) los dos acoples de C2 suman 2·k = 1,28 Cr.
    const r = calcularResonadores(
      entrada({ banda: { f1: 100e6, f2: 300e6 }, inductancia: 100e-9 }),
    );
    expect(r.estado === 'corte' && r.codigo).toBe('sin-l-realizable');
    if (r.estado !== 'corte') return;
    expect(r.texto).toMatch(/C2.*no depende de la L/);
  });
});

describe('pasos intermedios, fórmulas y referencias (spec §7.7)', () => {
  const r = calculado(entrada({ rl: 300 }));
  const textos = r.pasos.map((p) => p.texto).join('\n');
  const latex = r.pasos.map((p) => p.latex).join('\n');

  it('traen FBW, Cr, los k, los Q_ext, el Rp y la red L de cada extremo', () => {
    expect(latex).toContain('\\mathrm{FBW} = ');
    expect(latex).toContain('C_r = ');
    expect(latex).toContain('k_{12} = ');
    expect(latex).toContain('k_{23} = ');
    expect(latex).toContain('Q_{e,\\mathrm{entrada}} = ');
    expect(latex).toContain('Q_{e,\\mathrm{salida}} = ');
    expect(latex).toMatch(/R_\{p,\\mathrm\{salida\}\} = .*736\{,\}5/);
    expect(textos).toMatch(/Q de la sección L/);
    expect(latex).toContain('C_{01} = ');
    expect(latex).toContain('C_{34} = ');
  });

  it('traen la diferencia entre la Frecuencia de sintonía y la central geométrica', () => {
    expect(textos).toMatch(
      /Frecuencia de sintonía.*central geométrica|central geométrica.*Frecuencia de sintonía/,
    );
    // 145,9589 contra 145,9863 MHz (research §1): −27,4 kHz, y con las cifras que lo distinguen.
    expect(latex).toMatch(
      /145\{,\}959\\,\\mathrm\{MHz\} - 145\{,\}986\\,\\mathrm\{MHz\} = -27\{,\}\d+\\,\\mathrm\{kHz\}/,
    );
  });

  it('la Frecuencia de sintonía se muestra con las cifras que la distinguen de la geométrica', () => {
    // La última cifra, hasta una milésima del BW: con 4 MHz en 146 MHz, 1 kHz (6 cifras); con
    // 20 MHz en 97,5 MHz, 10 kHz (4 cifras: 97,50 MHz).
    expect(cifrasDeSintonia(145.959e6, 4e6)).toBe(6);
    expect(cifrasDeSintonia(97.5e6, 20e6)).toBe(4);
    // Nunca menos que las 3 de un resultado, aunque la cuenta dé menos.
    expect(cifrasDeSintonia(100e6, 20e9)).toBe(3);
  });

  it('traen cada Capacitor de sintonía con el rango del trimmer', () => {
    for (const k of [1, 2, 3]) expect(latex).toContain(`C_{${k}} = `);
    expect(textos).toMatch(/trimmer/);
  });

  it('muestran las fórmulas del método y citan a Matthaei, Zverev y Cohn', () => {
    expect(r.formulas.join(' ')).toContain('\\omega_0 = \\omega_1 + \\omega_2');
    expect(r.formulas.join(' ')).toContain('C_r = \\dfrac{1}{\\omega_0^2 L}');
    const citas = r.referencias.map((x) => `${x.autor} ${x.ubicacion}`).join(' ');
    expect(citas).toMatch(/Matthaei.*Fig\. 8\.11-1/);
    expect(citas).toMatch(/Zverev/);
    expect(citas).toMatch(/Cohn/);
  });
});

describe('el divisor capacitivo, Deducción propia (spec §7.7 y §13.5)', () => {
  it('por defecto la bandera del plan B está apagada', () => {
    expect(PLAN_B_DIVISOR_CAPACITIVO).toBe(false);
  });

  it('CR10: de 50 a 300 Ω, Ca y Cb de cada extremo, y el resonador del extremo sin C propio', () => {
    const r = calculado(entrada({ rl: 300 }));
    const [entradaDiv, salidaDiv] = r.extremos.map((x) => x.divisor!);
    expect(entradaDiv.ca * 1e12).toBeCloseTo(71.59, 2);
    expect(entradaDiv.cb * 1e12).toBeCloseTo(202.3, 1);
    expect(salidaDiv.ca * 1e12).toBeCloseTo(146.5, 1);
    expect(salidaDiv.cb * 1e12).toBeCloseTo(82.99, 2);
    // Con el divisor, la red adapta en f0 igual que con el Capacitor de extremo.
    const divisores = [entradaDiv, salidaDiv];
    expect(Math.abs(atenuacionAcoplada(r, r.sintonia.f0, 50, 300, { divisores }))).toBeLessThan(
      1e-9,
    );
    expect(r.pasos.some((p) => /divisor capacitivo/i.test(p.texto))).toBe(true);
  });

  it('con el plan B el divisor sale de los pasos y el resultado principal no cambia', () => {
    const propia = calculado(entrada({ rl: 300 }));
    const planB = calculado(calcularResonadores(entrada({ rl: 300 }), { planBDivisor: true }));
    expect(planB.extremos.map((x) => x.divisor)).toEqual([null, null]);
    expect(planB.pasos.some((p) => /divisor capacitivo/i.test(p.texto))).toBe(false);
    expect(planB.extremos.map((x) => x.capacitor.valor)).toEqual(
      propia.extremos.map((x) => x.capacitor.valor),
    );
  });
});

describe('avisos por FBW, que nunca bloquean (spec §7.7)', () => {
  const avisosCon = (banda: { f1: number; f2: number }) => {
    const r = calculado(entrada({ banda, inductancia: null }));
    return { fbw: r.sintonia.fbw, codigos: r.avisos.map((a) => a.codigo), avisos: r.avisos };
  };

  it('hasta 10 % ninguno', () => {
    const { fbw, codigos } = avisosCon(BANDA);
    expect(fbw).toBeLessThan(0.1);
    expect(codigos).not.toContain('fbw-ancho');
    expect(codigos).not.toContain('fbw-fuera-de-rango');
  });

  it('entre 10 y 20 %, informativo: el flanco alto atenúa menos que el prototipo', () => {
    const { fbw, codigos, avisos } = avisosCon({ f1: 140e6, f2: 160e6 });
    expect(fbw).toBeGreaterThan(0.1);
    expect(fbw).toBeLessThan(0.2);
    expect(codigos).toContain('fbw-ancho');
    expect(codigos).not.toContain('fbw-fuera-de-rango');
    expect(avisos.find((a) => a.codigo === 'fbw-ancho')!.texto).toMatch(/por encima de f2/);
  });

  it('por encima de 20 %, fuerte: fuera del rango de validez del método', () => {
    const { fbw, codigos, avisos } = avisosCon({ f1: 120e6, f2: 160e6 });
    expect(fbw).toBeGreaterThan(0.2);
    expect(codigos).toContain('fbw-fuera-de-rango');
    expect(codigos).not.toContain('fbw-ancho');
    expect(avisos.find((a) => a.codigo === 'fbw-fuera-de-rango')!.texto).toMatch(/Matthaei/);
  });
});

describe('Capacitores de sintonía con trimmer (spec §7.7)', () => {
  it('cada uno trae el rango de ±20 % que tiene que cubrir el trimmer', () => {
    const r = calculado(entrada());
    for (const s of r.sintonias) {
      expect(s.trimmer.min / s.capacitor.valor).toBeCloseTo(0.8, 12);
      expect(s.trimmer.max / s.capacitor.valor).toBeCloseTo(1.2, 12);
    }
  });

  it('siempre avisa que se arman con trimmer y que el valor es el punto medio del ajuste', () => {
    const texto = calculado(entrada()).avisos.find((a) => a.codigo === 'trimmer')?.texto;
    expect(texto).toMatch(/trimmer/);
    expect(texto).toMatch(/punto medio/);
  });
});

describe('pérdida de Cohn (spec §7.8)', () => {
  it('CR1: 4,343·Σgk/(FBW·Qu) con el FBW de Cohn da 6,341 dB con Qu = 100', () => {
    expect(calculado(entrada()).perdidaCohn).toBeCloseTo(6.341, 3);
  });

  it('no depende de la L ni de las terminaciones', () => {
    const a = calculado(entrada({ inductancia: 10e-9 })).perdidaCohn;
    expect(calculado(entrada({ inductancia: 20e-9, rl: 300 })).perdidaCohn).toBeCloseTo(a, 12);
  });
});

describe('valor impracticable y notas (spec §5.6 y §7.7)', () => {
  it('revisa en f2 la L y todos los capacitores, incluidos los de sintonía, y sugiere bajar el Orden', () => {
    const r = calculado(entrada({ inductancia: 5e-9 }));
    expect(r.frecuenciaRevision).toBe(148e6);
    const marcados = Object.fromEntries(r.revision.marcados.map((m) => [m.nombre, m.nivel]));
    // 3 nH sobre 5 nH: 60 %.
    expect(marcados.L).toBe('impracticable');
    expect(r.revision.sugerencia).toBe('Bajá el Orden.');
  });

  it('CR1: los acoples de 1,05 pF son Valor dudoso, como dice la spec', () => {
    const r = calculado(entrada());
    const marcados = Object.fromEntries(r.revision.marcados.map((m) => [m.nombre, m.nivel]));
    expect(marcados).toEqual({ C12: 'dudoso', C23: 'dudoso' });
  });

  it('con capacitores de sintonía chicos también los marca', () => {
    // A 300 MHz con L grande, Cr es de unos pocos pF.
    const r = calculado(
      entrada({ banda: { f1: 290e6, f2: 310e6 }, orden: 1, inductancia: 150e-9 }),
    );
    expect(r.revision.marcados.map((m) => m.nombre)).toContain('C1');
  });

  it('con f0 y BW avisa que f0 se toma como central geométrica, y que no es la de sintonía', () => {
    const r = calculado(entrada({ banda: { f0: 146e6, bw: 4e6 } }));
    const texto = r.avisos.find((a) => a.codigo === 'f0-geometrica')?.texto;
    expect(texto).toMatch(/central geométrica/);
    expect(texto).toMatch(/Frecuencia de sintonía/);
  });

  it('notas: los acoples son sensibles y los valores no se redondean a una serie E', () => {
    const notas = calculado(entrada()).notas.join('\n');
    expect(notas).toMatch(/acoples son sensibles/);
    expect(notas).toMatch(/no se redondean/);
    expect(notas).toMatch(/f2/);
  });
});

describe('el diseño de Matthaei, despejado en L (spec §7.7)', () => {
  it('CR1: Butterworth n = 3 de 144 a 148 MHz con L = 22 nH', () => {
    const r = calculado(entrada());
    expect(r.sintonia.f0 / 1e6).toBeCloseTo(145.9589, 4);
    expect(r.sintonia.fbw).toBeCloseTo(0.027395, 6);
    expect(r.cr * 1e12).toBeCloseTo(54.05, 2);
    expect(r.extremos.map((x) => x.rp)).toEqual([
      expect.closeTo(736.5, 1),
      expect.closeTo(736.5, 1),
    ]);
    expect(r.extremos.map((x) => x.capacitor.valor * 1e12)).toEqual([
      expect.closeTo(5.886, 3),
      expect.closeTo(5.886, 3),
    ]);
    expect(r.acoples.map((x) => x.capacitor.valor * 1e12)).toEqual([
      expect.closeTo(1.047, 3),
      expect.closeTo(1.047, 3),
    ]);
    expect(r.sintonias.map((x) => x.capacitor.valor * 1e12)).toEqual([
      expect.closeTo(47.51, 2),
      expect.closeTo(51.95, 2),
      expect.closeTo(47.51, 2),
    ]);
  });

  // De 50 a 300 Ω, en las tres Aproximaciones: el Capacitor de extremo transforma exacto en ω0.
  const GRILLA = [
    ['butterworth', null, 3, 50, 50],
    ['butterworth', null, 3, 50, 300],
    ['butterworth', null, 5, 300, 75],
    ['chebyshev', 0.1, 3, 50, 300],
    ['chebyshev', 0.5, 5, 75, 50],
    ['butterworth', null, 1, 50, 200],
  ] as const;

  for (const [aproximacion, ripple, orden, rs, rl] of GRILLA) {
    it(`${aproximacion} n = ${orden}, de ${rs} a ${rl} Ω: adapta en la Frecuencia de sintonía`, () => {
      const r = calculado(entrada({ aproximacion, ripple, orden, rs, rl, inductancia: 47e-9 }));
      const f0 = r.sintonia.f0;
      expect(Math.abs(atenuacionAcoplada(r, f0, rs, rl))).toBeLessThan(1e-9);
      const z = entradaAcoplada(r, f0, rl);
      expect(Math.abs(z.re - rs) / rs).toBeLessThan(1e-9);
      expect(Math.abs(z.im) / rs).toBeLessThan(1e-9);
    });
  }
});

describe('Orden calculado desde una atenuación (spec §7.7)', () => {
  const desde = (as: number, fs: number, e: Partial<EntradaResonadores> = {}) =>
    calcularResonadores(entrada({ orden: { as, fs }, inductancia: null, ...e }));

  it('si la red simulada no llega, sube y lo dice con las palabras de la spec', () => {
    const r = calculado(desde(48, 160e6));
    expect(r.ordenPedido).toBeNull();
    expect(r.ordenCalculado!.prototipo.orden).toBe(3);
    expect(r.orden).toBe(4);
    expect(r.ordenCalculado!.probados.map((p) => p.orden)).toEqual([3, 4]);
    const aviso = r.avisos.find((a) => a.codigo === 'orden-por-asimetria')!.texto;
    expect(aviso).toMatch(
      /^El prototipo pedía n = 3, pero por la asimetría del flanco alto hace falta n = 4/,
    );
    expect(r.pasos.some((p) => /^Red simulada con Orden 3, en fs: no llega/.test(p.texto))).toBe(
      true,
    );
    expect(r.pasos.some((p) => /^Red simulada con Orden 4, en fs: cumple/.test(p.texto))).toBe(
      true,
    );
    expect(r.notas[0]).toMatch(/red simulada, con componentes ideales/);
  });

  it('casi no depende de la L: con 10 nH y con 22 nH sale el mismo Orden', () => {
    const a = calculado(desde(48, 160e6, { inductancia: 10e-9 }));
    const b = calculado(desde(48, 160e6, { inductancia: 22e-9 }));
    expect(a.orden).toBe(b.orden);
    expect(a.ordenCalculado!.atenuacionSimulada).toBeCloseTo(
      b.ordenCalculado!.atenuacionSimulada,
      0,
    );
  });

  it('si con 10 no llega, avisa y no calcula', () => {
    const r = desde(125, 200e6, { banda: { f1: 140e6, f2: 160e6 } });
    expect(r.estado === 'corte' && r.codigo).toBe('orden-excedido');
    expect(r.estado === 'corte' && r.texto).toMatch(/ni con Orden 10/);
  });

  it('una atenuación de 0 dB es entrada inválida', () => {
    const r = desde(0, 160e6);
    expect(r.estado === 'corte' && r.codigo).toBe('entrada-invalida');
  });
});
