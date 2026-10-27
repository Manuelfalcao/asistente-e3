import { describe, expect, it } from 'vitest';
import { REGISTRO } from '../../src/calculo/comun/registro';

// El registro común que lee el Informe de casos (spec §13.5).
describe('registro de Criterios prácticos y Deducciones propias', () => {
  it('registra los umbrales de Valor dudoso y Valor impracticable como Criterio práctico', () => {
    const umbrales = REGISTRO.find((e) => e.id === 'umbrales-valor-impracticable');
    expect(umbrales?.tipo).toBe('criterio-practico');
    expect(umbrales?.queEs).toMatch(/20 %.*50 %/);
    // Los números del montaje salen del mismo lugar que usa el cálculo.
    expect(umbrales?.queEs).toContain('±3 nH');
    expect(umbrales?.queEs).toContain('±0,5 pF');
    expect(umbrales?.queEs).toContain('2,8 nH');
    expect(umbrales?.queEs).toContain('4,5 nH');
    expect(umbrales?.queEs).toContain('0,43 pF');
  });

  it('registra el D∞ de RF de una capa como Deducción propia, con el plan B detrás de una bandera', () => {
    const rf = REGISTRO.find((e) => e.id === 'diametro-rf-una-capa');
    expect(rf?.tipo).toBe('deduccion-propia');
    expect(rf?.bandera).toBe('PLAN_B_DIAMETRO_RF');
    expect(rf?.queEs).toMatch(/Knight.*ec\. 4\.2/);
    expect(rf?.adaptacion).toMatch(/semiempírica/);
    expect(rf?.planB).toMatch(/D0/);
    expect(rf?.deduccion?.map((p) => p.latex).join(' ')).toContain('D_\\infty');
  });

  it('registra las adaptaciones de dos capas como Deducción propia, con Rosa (91) sola de plan B', () => {
    const dos = REGISTRO.find((e) => e.id === 'maxwell-externo-dos-capas');
    expect(dos?.tipo).toBe('deduccion-propia');
    expect(dos?.bandera).toBe('PLAN_B_DOS_CAPAS');
    // Las tres adaptaciones: Maxwell externo, D′ = √(p·d) y el ajuste de Bs.
    expect(dos?.adaptacion).toMatch(
      /ln\(D\/d\) − 0,1119 \+ E en lugar de ln\(D\/d\) \+ 0,13806 \+ E/,
    );
    expect(dos?.adaptacion).toMatch(/D′ = √\(p·d\)/);
    expect(dos?.adaptacion).toMatch(/Bs con un ajuste cerrado/);
    // Y la decisión sobre E (pendiente P2).
    expect(dos?.adaptacion).toMatch(/E = 0,017.*se mantiene/);
    // Y el rango, ampliado más allá del NBS hasta lo verificado.
    expect(dos?.adaptacion).toMatch(/c\/a ≤ 0,25.*a c\/a ≤ 0,42.*suma de anillos/);
    expect(dos?.planB).toMatch(/Rosa y Grover \(91\) sola/);
    expect(dos?.respaldo).toMatch(/suma de anillos/);
    const deduccion = dos?.deduccion?.map((p) => p.latex).join(' ');
    expect(deduccion).toContain('0{,}13806 = \\ln(2 \\cdot 0{,}447049) + \\dfrac{1}{4}');
    expect(deduccion).toContain("D' = \\sqrt{p d}");
  });

  it('registra el Chebyshev par de resonadores acoplados como Deducción propia, con su bandera', () => {
    const par = REGISTRO.find((e) => e.id === 'chebyshev-par-resonadores');
    expect(par?.tipo).toBe('deduccion-propia');
    expect(par?.bandera).toBe('PLAN_B_CHEBYSHEV_PAR');
    expect(par?.respaldo).toMatch(/CR5.*CR6/);
    expect(par?.planB).toMatch(/impar/);
    expect(par?.deduccion?.length).toBeGreaterThan(0);
  });

  it('registra el divisor capacitivo como Deducción propia, que con el plan B sale de los pasos', () => {
    const divisor = REGISTRO.find((e) => e.id === 'divisor-capacitivo');
    expect(divisor?.tipo).toBe('deduccion-propia');
    expect(divisor?.bandera).toBe('PLAN_B_DIVISOR_CAPACITIVO');
    expect(divisor?.respaldo).toMatch(/−0,7 %/);
    expect(divisor?.planB).toMatch(/pasos intermedios/);
    expect(divisor?.deduccion?.map((p) => p.latex).join(' ')).toContain('C_b');
  });

  it('registra la Ventana de L y el ±20 % del trimmer como Criterios prácticos', () => {
    const ventana = REGISTRO.find((e) => e.id === 'ventana-de-l');
    expect(ventana?.tipo).toBe('criterio-practico');
    // Los números salen del mismo lugar que usa el cálculo.
    expect(ventana?.queEs).toContain('6 nH');
    expect(ventana?.queEs).toContain('1 pF');
    expect(ventana?.queEs).toMatch(/E12/);
    expect(ventana?.adaptacion).toMatch(/Orden 1/);
    const trimmer = REGISTRO.find((e) => e.id === 'trimmer-20');
    expect(trimmer?.tipo).toBe('criterio-practico');
    expect(trimmer?.queEs).toContain('±20 %');
  });

  it('cada entrada dice qué es, qué se adaptó y por qué, su respaldo y su plan B', () => {
    for (const e of REGISTRO) {
      for (const campo of [e.nombre, e.queEs, e.adaptacion, e.respaldo, e.planB]) {
        expect(campo.trim(), e.id).not.toBe('');
      }
      // Cada plan B de una Deducción propia queda detrás de una bandera.
      if (e.tipo === 'deduccion-propia') expect(e.bandera, e.id).toBeTruthy();
    }
  });

  it('los id no se repiten', () => {
    const ids = REGISTRO.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
