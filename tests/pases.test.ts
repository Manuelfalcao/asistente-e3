import { describe, expect, it } from 'vitest';
import { leerCampo } from '../src/entrada/campo';
import type { Campo } from '../src/entrada/campos';
import {
  type EstadoNavegacion,
  type Pase,
  componenteDelPase,
  crearPase,
  franjaVisible,
  irA,
  paseDeComponente,
  pasar,
  precargaDe,
  quitar,
  textoDeFranja,
  volver,
  conValorCompleto,
} from '../src/ui/pases';

const inicio: EstadoNavegacion = { activa: 'redes', pila: [] };

const c1 = crearPase({ origen: 'redes', nombre: 'C1', magnitud: 'capacidad', valor: 87.4321e-12 });
const l1 = crearPase({
  origen: 'redes',
  nombre: 'L1',
  magnitud: 'inductancia',
  valor: 145.678e-9,
  frecuencia: 145e6,
});
const r1 = crearPase({
  origen: 'atenuadores',
  nombre: 'R1',
  magnitud: 'resistencia',
  valor: 123.456,
});

describe('destino del pase', () => {
  it('las L van a Bobinas y las C y las R a Arreglos equivalentes', () => {
    expect(l1.destino).toBe('bobinas');
    expect(c1.destino).toBe('arreglos');
    expect(r1.destino).toBe('arreglos');
  });

  it('en Arreglos equivalentes elige el tipo de componente según el valor', () => {
    expect(componenteDelPase(c1)).toBe('capacitor');
    expect(componenteDelPase(r1)).toBe('resistencia');
  });
});

describe('pila de pases', () => {
  it('pasar abre la Calculadora de destino y apila el pase', () => {
    const e = pasar(inicio, c1);
    expect(e.activa).toBe('arreglos');
    expect(e.pila).toEqual([c1]);
    expect(franjaVisible(e)).toBe(c1);
  });

  it('volver abre la Calculadora de origen y deshace el pase', () => {
    const e = volver(pasar(inicio, l1));
    expect(e.activa).toBe('redes');
    expect(e.pila).toEqual([]);
    expect(franjaVisible(e)).toBeUndefined();
  });

  it('con la pila vacía volver no hace nada', () => {
    expect(volver(inicio)).toBe(inicio);
  });

  it('los pases encadenados se apilan y volver deshace de a uno', () => {
    // Filtros pasa a Redes desde el aviso de pérdida plana, y Redes a Bobinas.
    const haciaRedes: Pase = { origen: 'filtros', destino: 'redes', rs: 50, rl: 300 };
    const e1 = pasar({ activa: 'filtros', pila: [] }, haciaRedes);
    expect(e1.activa).toBe('redes');

    const e2 = pasar(e1, l1);
    expect(e2.pila).toEqual([haciaRedes, l1]);
    expect(e2.activa).toBe('bobinas');

    const e3 = volver(e2);
    expect(e3.activa).toBe('redes');
    expect(e3.pila).toEqual([haciaRedes]);
    expect(franjaVisible(e3)).toBe(haciaRedes);

    const e4 = volver(e3);
    expect(e4.activa).toBe('filtros');
    expect(e4.pila).toEqual([]);
  });

  it('cambiar de Calculadora desde las pestañas o el menú vacía la pila', () => {
    const e = irA(pasar(inicio, c1), 'filtros');
    expect(e.activa).toBe('filtros');
    expect(e.pila).toEqual([]);
  });

  it('tocar la Calculadora que ya está abierta no vacía la pila', () => {
    const e = pasar(inicio, c1);
    expect(irA(e, 'arreglos')).toBe(e);
  });

  it('la ✕ quita la franja sin cambiar de Calculadora', () => {
    const e = quitar(pasar(inicio, c1));
    expect(e.activa).toBe('arreglos');
    expect(franjaVisible(e)).toBeUndefined();
  });

  it('una franja de otra Calculadora no se ve', () => {
    const e = pasar(inicio, c1);
    expect(franjaVisible({ ...e, activa: 'bobinas' })).toBeUndefined();
  });

  it('no modifica el estado anterior', () => {
    const antes = pasar(inicio, c1);
    pasar(antes, l1);
    volver(antes);
    quitar(antes);
    expect(antes.pila).toEqual([c1]);
  });
});

describe('texto de la franja', () => {
  it('junta el nombre y el valor con su unidad', () => {
    expect(textoDeFranja(c1)).toBe('C1 = 87,4 pF');
    expect(textoDeFranja(l1)).toBe('L1 = 146 nH');
    expect(textoDeFranja(r1)).toBe('R1 = 123 Ω');
  });
});

describe('precisión completa', () => {
  const capacidad: Campo = { magnitud: 'capacidad', unidad: 'pF' };

  it('el campo de destino muestra 4 cifras con la unidad del Selector', () => {
    expect(precargaDe(c1.valor, 'capacidad')).toMatchObject({ texto: '87,43', unidad: 'pF' });
    expect(precargaDe(2.2e-9, 'capacidad')).toMatchObject({ texto: '2,2', unidad: 'nF' });
    expect(precargaDe(145e6, 'frecuencia')).toMatchObject({ texto: '145', unidad: 'MHz' });
    expect(precargaDe(4700, 'resistencia')).toMatchObject({ texto: '4,7', unidad: 'kΩ' });
  });

  it('una unidad que el Selector no ofrece va escrita en el texto', () => {
    // 2,5 mH: el Selector de inductancia solo tiene nH y µH.
    const p = precargaDe(2.5e-3, 'inductancia');
    expect(p.unidad).toBeUndefined();
    expect(p.texto).toBe('2,5 mH');
  });

  it('el texto del campo se lee de vuelta con la unidad elegida', () => {
    const p = precargaDe(c1.valor, 'capacidad');
    const estado = leerCampo(p.texto, { ...capacidad, nombre: 'Valor buscado', unidad: p.unidad });
    expect(estado).toMatchObject({ estado: 'valido' });
    if (estado.estado === 'valido') expect(estado.valor).toBeCloseTo(87.43e-12, 20);
  });

  it('mientras el texto no se edite, se usa el valor completo', () => {
    const p = precargaDe(c1.valor, 'capacidad');
    const spec = { ...capacidad, nombre: 'Valor buscado', unidad: p.unidad };
    const leido = leerCampo(p.texto, spec);
    const usado = conValorCompleto(leido, p, p.texto, p.unidad);
    expect(usado).toMatchObject({ estado: 'valido', valor: c1.valor });
  });

  it('si se edita el texto, vale lo que se escribió', () => {
    const p = precargaDe(c1.valor, 'capacidad');
    const spec = { ...capacidad, nombre: 'Valor buscado', unidad: p.unidad };
    const editado = '87,44';
    const usado = conValorCompleto(leerCampo(editado, spec), p, editado, p.unidad);
    expect(usado).toMatchObject({ estado: 'valido' });
    expect(usado.estado === 'valido' && usado.valor).toBeCloseTo(87.44e-12, 20);
    expect(usado.estado === 'valido' && usado.valor).not.toBe(c1.valor);
  });

  it('si se cambia el Selector de unidad, vale lo que se lee', () => {
    const p = precargaDe(c1.valor, 'capacidad');
    const spec = { ...capacidad, nombre: 'Valor buscado', unidad: 'nF' };
    const usado = conValorCompleto(leerCampo(p.texto, spec), p, p.texto, 'nF');
    expect(usado.estado === 'valido' && usado.valor).toBeCloseTo(87.43e-9, 18);
  });

  it('sin precarga, o con el campo inválido, no toca el estado', () => {
    const spec = { ...capacidad, nombre: 'Valor buscado' };
    const leido = leerCampo('4,7', spec);
    expect(conValorCompleto(leido, null, '4,7', 'pF')).toBe(leido);
    const malo = leerCampo('4,7x', spec);
    const p = precargaDe(c1.valor, 'capacidad');
    expect(conValorCompleto(malo, p, '4,7x', 'pF')).toBe(malo);
  });
});

describe('pase de un componente del resultado', () => {
  const marcados = [{ nombre: 'C1', nivel: 'dudoso' as const, motivo: 'C1: cerca de su SRF' }];

  it('una L pasa a Bobinas con la frecuencia de evaluación', () => {
    const p = paseDeComponente(
      'redes',
      { componente: 'L', nombre: 'L1', valor: 95.06e-9 },
      marcados,
      { frecuencia: 145e6 },
    );
    expect(p).toMatchObject({ destino: 'bobinas', magnitud: 'inductancia', frecuencia: 145e6 });
    expect(p.nivel).toBeUndefined();
  });

  it('una C o una R pasa a Arreglos, con el aviso del valor si lo tiene', () => {
    const c = paseDeComponente(
      'redes',
      { componente: 'C', nombre: 'C1', valor: 9.5e-12 },
      marcados,
    );
    expect(c).toMatchObject({
      destino: 'arreglos',
      magnitud: 'capacidad',
      nivel: 'dudoso',
      motivo: 'C1: cerca de su SRF',
    });
    const r = paseDeComponente(
      'atenuadores',
      { componente: 'R', nombre: 'R2', valor: 47 },
      marcados,
    );
    expect(r).toMatchObject({ destino: 'arreglos', magnitud: 'resistencia' });
    expect(r.nivel).toBeUndefined();
  });
});
