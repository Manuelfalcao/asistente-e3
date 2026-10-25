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
