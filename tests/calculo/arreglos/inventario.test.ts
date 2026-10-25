import { describe, expect, it } from 'vitest';
import { RANGO_SIN_INVENTARIO } from '../../../src/calculo/arreglos/arreglos';
import {
  type Inventario,
  alternarExcluido,
  decadasDeSerie,
  describirInventario,
  escribirTolerancia,
  estaExcluido,
  inventarioVacio,
  leerInventario,
  leerTolerancia,
  valoresCargados,
  valoresSinInventario,
} from '../../../src/calculo/arreglos/inventario';

// El Inventario (spec §8.2): qué valores salen de cada modo, cómo se guarda y cómo se describe.

const pF = (x: number) => Number(`${x}e-12`);
const aPF = (valor: number) => Number((valor / 1e-12).toPrecision(9));
const enPF = (valores: readonly { valor: number }[]) => valores.map((v) => aPF(v.valor));

const conExclusion = (parcial: Partial<Inventario['exclusion']>): Inventario => ({
  ...inventarioVacio('capacitor'),
  modo: 'exclusion',
  exclusion: { ...inventarioVacio('capacitor').exclusion, ...parcial },
});

describe('Inventario: valores cargados', () => {
  it('sin Inventario: la serie completa en el rango fijo del tipo', () => {
    const v = valoresCargados('capacitor', 'E12');
    expect(v.map((x) => x.valor)).toEqual(valoresSinInventario('capacitor', 'E12'));
    expect(v).toHaveLength(49);
    expect(v.every((x) => x.tolerancia === undefined)).toBe(true);
    expect(valoresCargados('capacitor', 'E12', inventarioVacio('capacitor'))).toEqual(v);
  });

  it('por exclusión: la serie en el rango, sin los Valores excluidos y con los extras', () => {
    const inv = conExclusion({
      min: pF(1),
      max: pF(100),
      excluidos: [pF(47), pF(39)],
      extras: [
        { valor: pF(4.3) },
        { valor: pF(0.5), tolerancia: { tipo: 'relativa', fraccion: 0.1 } },
      ],
    });
    const v = valoresCargados('capacitor', 'E12', inv);
    // E12 de 1 a 100 pF son 25 valores: 23 sin los excluidos, 25 con los 2 extras.
    expect(enPF(v)).toEqual([
      0.5, 1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.3, 4.7, 5.6, 6.8, 8.2, 10, 12, 15, 18, 22, 27,
      33, 56, 68, 82, 100,
    ]);
    // La tolerancia propia es solo de los extras que la tienen.
    expect(v.filter((x) => x.tolerancia).map((x) => x.valor)).toEqual([pF(0.5)]);
  });

  it('el rango del modo exclusión es editable', () => {
    const v = valoresCargados('capacitor', 'E6', conExclusion({ min: pF(10), max: pF(47) }));
    expect(enPF(v)).toEqual([10, 15, 22, 33, 47]);
  });

  it('los Valores excluidos son valores, no posiciones: siguen valiendo al cambiar de serie', () => {
    const inv = conExclusion({ min: pF(1), max: pF(100), excluidos: [pF(47), pF(4.3)] });
    const e12 = enPF(valoresCargados('capacitor', 'E12', inv));
    const e24 = enPF(valoresCargados('capacitor', 'E24', inv));
    const e6 = enPF(valoresCargados('capacitor', 'E6', inv));
    // El 47 pF falta en las tres series; el 4,3 pF solo está en E24 y ahí falta.
    for (const lista of [e6, e12, e24]) expect(lista).not.toContain(47);
    expect(e24).not.toContain(4.3);
    expect(e24).toContain(5.1);
    expect(e12).toHaveLength(24);
    expect(e6).toContain(68);
  });

  it('un extra vuelve a incluir un valor excluido y pisa la tolerancia del de la serie', () => {
    const inv = conExclusion({
      min: pF(1),
      max: pF(100),
      excluidos: [pF(47)],
      extras: [
        { valor: pF(47), tolerancia: { tipo: 'relativa', fraccion: 0.01 } },
        { valor: pF(22), tolerancia: { tipo: 'absoluta', valor: pF(0.1) } },
      ],
    });
    const v = valoresCargados('capacitor', 'E12', inv);
    expect(v.filter((x) => x.valor === pF(47))).toHaveLength(1);
    expect(v.find((x) => x.valor === pF(47))?.tolerancia).toEqual({
      tipo: 'relativa',
      fraccion: 0.01,
    });
    expect(v.filter((x) => x.valor === pF(22))).toHaveLength(1);
    expect(v.find((x) => x.valor === pF(22))?.tolerancia).toEqual({
      tipo: 'absoluta',
      valor: pF(0.1),
    });
    // E12 de 1 a 100 pF son 25 valores: el 47 pF excluido vuelve como extra y el 22 pF ya estaba.
    expect(v).toHaveLength(25);
  });

  it('por inclusión: los valores escritos, sean o no de la serie, ordenados y sin repetir', () => {
    const inv: Inventario = {
      ...inventarioVacio('capacitor'),
      modo: 'inclusion',
      inclusion: [
        { valor: pF(4.3) },
        { valor: pF(0.5), tolerancia: { tipo: 'absoluta', valor: pF(0.1) } },
        { valor: pF(47) },
        { valor: pF(4.3) },
      ],
    };
    const v = valoresCargados('capacitor', 'E12', inv);
    expect(enPF(v)).toEqual([0.5, 4.3, 47]);
    expect(v[0].tolerancia).toEqual({ tipo: 'absoluta', valor: pF(0.1) });
    expect(v[1].tolerancia).toBeUndefined();
  });

  it('al cambiar de modo, la lista del otro modo no se borra', () => {
    const base: Inventario = {
      modo: 'inclusion',
      inclusion: [{ valor: pF(4.3) }, { valor: pF(22) }],
      exclusion: { min: pF(1), max: pF(10), excluidos: [pF(1)], extras: [{ valor: pF(0.5) }] },
    };
    const inclusion = enPF(valoresCargados('capacitor', 'E6', base));
    const exclusion = enPF(valoresCargados('capacitor', 'E6', { ...base, modo: 'exclusion' }));
    const otraVez = enPF(valoresCargados('capacitor', 'E6', { ...base, modo: 'inclusion' }));
    expect(inclusion).toEqual([4.3, 22]);
    // E6 de 1 a 10 pF, sin el 1 pF y con el extra de 0,5 pF.
    expect(exclusion).toEqual([0.5, 1.5, 2.2, 3.3, 4.7, 6.8, 10]);
    expect(otraVez).toEqual(inclusion);
    // Y sobrevive a guardarlo y leerlo.
    const guardado = leerInventario(
      JSON.parse(JSON.stringify({ ...base, modo: 'exclusion' })),
      'capacitor',
    );
    expect(guardado.inclusion).toEqual(base.inclusion);
    expect(guardado.exclusion).toEqual(base.exclusion);
  });

  it('no hay cantidades: un mismo valor aparece una sola vez en la lista', () => {
    const inv: Inventario = {
      ...inventarioVacio('resistencia'),
      modo: 'inclusion',
      inclusion: [{ valor: 100 }],
    };
    expect(valoresCargados('resistencia', 'E12', inv).map((x) => x.valor)).toEqual([100]);
  });
});

describe('Inventario: lo guardado', () => {
  it('lo que no se reconoce vuelve a un Inventario vacío', () => {
    for (const crudo of [null, undefined, 3, 'x', [], { modo: 'rarisimo' }]) {
      expect(leerInventario(crudo, 'resistencia')).toEqual(inventarioVacio('resistencia'));
    }
  });

  it('descarta los valores mal formados y arregla el rango', () => {
    const inv = leerInventario(
      {
        modo: 'inclusion',
        inclusion: [
          { valor: 10 },
          { valor: -3 },
          { valor: 'x' },
          7,
          { valor: 22, tolerancia: { tipo: 'relativa', fraccion: 0.02 } },
          { valor: 47, tolerancia: { tipo: 'rara' } },
          { valor: 68, tolerancia: { tipo: 'absoluta', valor: -1 } },
        ],
        exclusion: { min: 100, max: 1, excluidos: [4.7, 'x', 0, -1], extras: 'no' },
      },
      'resistencia',
    );
    expect(inv.modo).toBe('inclusion');
    expect(inv.inclusion).toEqual([
      { valor: 10 },
      { valor: 22, tolerancia: { tipo: 'relativa', fraccion: 0.02 } },
      { valor: 47 },
      { valor: 68 },
    ]);
    expect(inv.exclusion.min).toBe(RANGO_SIN_INVENTARIO.resistencia.min);
    expect(inv.exclusion.max).toBe(RANGO_SIN_INVENTARIO.resistencia.max);
    expect(inv.exclusion.excluidos).toEqual([4.7]);
    expect(inv.exclusion.extras).toEqual([]);
  });

  it('el rango por defecto es el fijo del tipo', () => {
    expect(inventarioVacio('capacitor').exclusion).toMatchObject({ min: 1e-12, max: 10e-9 });
    expect(inventarioVacio('resistencia').exclusion).toMatchObject({ min: 1, max: 10e6 });
    expect(inventarioVacio('capacitor').modo).toBe('ninguno');
  });
});

describe('Inventario: la grilla de la serie', () => {
  it('una fila por década, con los valores de la serie en el rango', () => {
    const filas = decadasDeSerie('E6', pF(1), pF(100));
    expect(filas.map((f) => f.valores.length)).toEqual([6, 6, 1]);
    expect(filas.map((f) => f.valores[0])).toEqual([pF(1), pF(10), pF(100)]);
    expect(filas[1].valores.map(aPF)).toEqual([10, 15, 22, 33, 47, 68]);
  });

  it('un rango que corta la década deja solo lo que entra', () => {
    const filas = decadasDeSerie('E12', pF(2), pF(30));
    expect(filas.map((f) => f.valores.length)).toEqual([8, 6]);
  });

  it('un toque excluye y otro vuelve a incluir, por valor', () => {
    const uno = alternarExcluido([], pF(4.7));
    expect(uno).toEqual([pF(4.7)]);
    expect(estaExcluido(uno, pF(4.7))).toBe(true);
    expect(estaExcluido(uno, pF(47))).toBe(false);
    // 4,7 pF escrito de otra forma sigue siendo el mismo valor.
    expect(estaExcluido(uno, 4.7 * 1e-12)).toBe(true);
    expect(alternarExcluido(uno, 4.7 * 1e-12)).toEqual([]);
    expect(alternarExcluido([pF(1), pF(2.2)], pF(4.7))).toEqual([pF(1), pF(2.2), pF(4.7)]);
  });
});

describe('Inventario: tolerancia por valor escrita', () => {
  it('un porcentaje es relativo; un valor con unidad es absoluto', () => {
    expect(leerTolerancia('2', 'capacitor')).toEqual({
      tipo: 'valor',
      tolerancia: { tipo: 'relativa', fraccion: 0.02 },
    });
    expect(leerTolerancia('2,5 %', 'resistencia')).toEqual({
      tipo: 'valor',
      tolerancia: { tipo: 'relativa', fraccion: 0.025 },
    });
    expect(leerTolerancia('0,1 pF', 'capacitor')).toEqual({
      tipo: 'valor',
      tolerancia: { tipo: 'absoluta', valor: pF(0.1) },
    });
    expect(leerTolerancia('2 Ω', 'resistencia')).toEqual({
      tipo: 'valor',
      tolerancia: { tipo: 'absoluta', valor: 2 },
    });
  });

  it('vacío es "sin tolerancia propia"; lo ilegible o fuera de rango es error', () => {
    expect(leerTolerancia('  ', 'capacitor')).toEqual({ tipo: 'vacio' });
    expect(leerTolerancia('hola', 'capacitor').tipo).toBe('error');
    expect(leerTolerancia('150', 'capacitor').tipo).toBe('error');
    // Una resistencia no se mide en pF.
    expect(leerTolerancia('0,1 pF', 'resistencia').tipo).toBe('error');
  });

  it('se escribe de forma que vuelve a leerse', () => {
    for (const t of [
      { tipo: 'relativa', fraccion: 0.05 },
      { tipo: 'absoluta', valor: pF(0.25) },
    ] as const) {
      const texto = escribirTolerancia(t, 'capacitor');
      expect(leerTolerancia(texto, 'capacitor')).toEqual({ tipo: 'valor', tolerancia: t });
    }
    expect(escribirTolerancia({ tipo: 'relativa', fraccion: 0.05 }, 'capacitor')).toBe('5 %');
    expect(escribirTolerancia({ tipo: 'absoluta', valor: pF(0.25) }, 'capacitor')).toBe('0,25 pF');
  });
});

describe('Inventario: cómo se describe', () => {
  it('sin Inventario', () => {
    expect(describirInventario('capacitor', 'E12')).toMatchObject({
      texto: 'Serie E12 completa, sin Inventario',
      rango: '1 pF – 10 nF',
      cantidad: 49,
    });
  });

  it('por exclusión, como en la spec', () => {
    const inv = conExclusion({ excluidos: [pF(47), pF(39), pF(1)] });
    const d = describirInventario('capacitor', 'E12', inv);
    expect(d.texto).toBe(
      'Inventario de capacitores: E12 por exclusión, 1 pF – 10 nF, 3 Valores excluidos',
    );
    expect(d.cantidad).toBe(46);
  });

  it('por exclusión: singular, ninguno y extras', () => {
    expect(
      describirInventario('capacitor', 'E24', conExclusion({ excluidos: [pF(47)] })).texto,
    ).toBe('Inventario de capacitores: E24 por exclusión, 1 pF – 10 nF, 1 Valor excluido');
    expect(
      describirInventario('resistencia', 'E6', {
        ...inventarioVacio('resistencia'),
        modo: 'exclusion',
      }).texto,
    ).toBe('Inventario de resistencias: E6 por exclusión, 1 Ω – 10 MΩ, ningún Valor excluido');
    const conExtras = conExclusion({ extras: [{ valor: pF(4.3) }, { valor: pF(0.5) }] });
    expect(describirInventario('capacitor', 'E12', conExtras).detalle).toContain('2 extra');
  });

  it('por inclusión', () => {
    const inv: Inventario = {
      ...inventarioVacio('capacitor'),
      modo: 'inclusion',
      inclusion: [{ valor: pF(0.5) }, { valor: pF(4.3) }, { valor: pF(47) }],
    };
    expect(describirInventario('capacitor', 'E12', inv)).toMatchObject({
      texto: 'Inventario de capacitores: por inclusión, 3 valores, 0,5 pF – 47 pF',
      cantidad: 3,
    });
    expect(
      describirInventario('capacitor', 'E12', { ...inv, inclusion: [{ valor: pF(4.3) }] }).texto,
    ).toBe('Inventario de capacitores: por inclusión, 1 valor, 4,3 pF');
    expect(describirInventario('capacitor', 'E12', { ...inv, inclusion: [] }).texto).toBe(
      'Inventario de capacitores: por inclusión, sin valores',
    );
  });
});
