import { describe, expect, it } from 'vitest';
import { MEDIA_UNIDAD } from '../casos';
import { enCaso, medidaImpresa, medidaNumerica } from '../casos-informe';

// Las ayudas con que cada Calculadora adapta sus tablas al Informe de casos.

describe('medida contra un valor impreso', () => {
  const medida = medidaImpresa({
    nombre: 'R1',
    impreso: '190,7',
    obtenido: 190.69,
    tolerancia: MEDIA_UNIDAD,
    unidad: 'Ω',
  });

  it('muestra el esperado como está impreso y el obtenido con dos decimales más que el impreso', () => {
    expect(medida.esperado).toBe('190,7 Ω');
    expect(medida.obtenido).toBe('190,690 Ω');
  });

  it('da el error relativo con signo, la tolerancia y su motivo', () => {
    expect(medida.errorRelativo).toBeCloseTo(190.69 / 190.7 - 1, 12);
    expect(medida.tolerancia).toBe('± 0,05');
    expect(medida.motivo).toBe(MEDIA_UNIDAD.motivo);
    expect(medida.dentro).toBe(true);
  });

  it('fuera de la tolerancia no está dentro', () => {
    const lejos = medidaImpresa({
      nombre: 'R1',
      impreso: '190,7',
      obtenido: 190.8,
      tolerancia: MEDIA_UNIDAD,
    });
    expect(lejos.dentro).toBe(false);
  });

  it('con una Diferencia esperada la tolerancia se aplica alrededor de ella', () => {
    const m = medidaImpresa({
      nombre: 'L',
      impreso: '100,0',
      obtenido: 104.5,
      tolerancia: { tipo: 'relativa', valor: 0.001, motivo: 'm' },
      diferencia: { relativa: 0.045, motivo: 'otra aproximación' },
    });
    expect(m.dentro).toBe(true);
    expect(m.diferencia).toEqual({ texto: '+4,50 %', motivo: 'otra aproximación' });
  });

  it('un esperado de cero no tiene error relativo', () => {
    const m = medidaImpresa({ nombre: 'x', impreso: '0', obtenido: 0, tolerancia: MEDIA_UNIDAD });
    expect(m.errorRelativo).toBeNull();
  });
});

describe('medida contra un número que dio un oráculo', () => {
  const tolerancia = { tipo: 'relativa', valor: 1e-9, motivo: 'doble precisión' } as const;

  it('la tolerancia relativa se aplica sobre el esperado', () => {
    const bien = medidaNumerica({
      nombre: 'Z',
      esperado: 50,
      obtenido: 50 * (1 + 1e-12),
      tolerancia,
      decimales: 9,
    });
    expect(bien.dentro).toBe(true);
    const mal = medidaNumerica({
      nombre: 'Z',
      esperado: 50,
      obtenido: 50 * (1 + 1e-6),
      tolerancia,
      decimales: 9,
    });
    expect(mal.dentro).toBe(false);
  });

  it('con Diferencia esperada, la tolerancia se aplica alrededor de ella', () => {
    const diferencia = { relativa: -0.005, motivo: 'otra aproximación' };
    const tolerancia = { tipo: 'relativa', valor: 1e-4, motivo: 'm' } as const;
    const corrida = medidaNumerica({
      nombre: 'L',
      esperado: 100,
      obtenido: 99.5,
      tolerancia,
      diferencia,
      decimales: 3,
    });
    expect(corrida.dentro).toBe(true);
    expect(corrida.errorRelativo).toBeCloseTo(-0.005, 12);
    expect(corrida.diferencia).toEqual({ texto: '−0,50 %', motivo: 'otra aproximación' });
    const sinCorrer = medidaNumerica({
      nombre: 'L',
      esperado: 100,
      obtenido: 100,
      tolerancia,
      diferencia,
      decimales: 3,
    });
    expect(sinCorrer.dentro).toBe(false);
  });

  it('en notación científica para errores del orden de 1e-14', () => {
    const m = medidaNumerica({
      nombre: 'peor',
      esperado: 0,
      obtenido: 3.14e-14,
      tolerancia: { tipo: 'absoluta', valor: 1e-9, motivo: 'm' },
      decimales: null,
    });
    expect(m.obtenido).toBe('3,14e−14');
    expect(m.dentro).toBe(true);
  });
});

describe('un caso que se rompe', () => {
  it('sale en rojo con el error, y no tira abajo el informe', () => {
    const caso = enCaso({ id: 'c', referencia: 'spec' }, () => {
      throw new Error('no calculó: no-positiva');
    });
    expect(caso).toMatchObject({
      clase: 'comportamiento',
      id: 'c',
      coincide: false,
      obtenido: 'Error: no calculó: no-positiva',
    });
  });
});
