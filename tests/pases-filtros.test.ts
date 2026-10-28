import { describe, expect, it } from 'vitest';
import {
  type EntradaFiltro,
  type ResultadoFiltro,
  calcularFiltro,
} from '../src/calculo/filtros/filtros';
import { type EntradaResonadores, calcularResonadores } from '../src/calculo/filtros/resonadores';
import { paseDePerdidaPlana, pasesDeResonadores, pasesDelFiltro } from '../src/ui/filtros/pases';
import { leerCampo } from '../src/entrada/campo';
import {
  conValorCompleto,
  franjaVisible,
  pasar,
  precargaDeF0,
  textoDeFranja,
  volver,
} from '../src/ui/pases';

// Los pases desde la Calculadora de filtros (spec §5.5): qué valor va a qué Calculadora y con qué
// precarga.

const comun = {
  aproximacion: 'butterworth',
  ripple: null,
  topologia: 'π',
  orden: 3,
  rs: 50,
  rl: 50,
  qBobina: 100,
} as const;

function calculado(entrada: EntradaFiltro) {
  const r: ResultadoFiltro = calcularFiltro(entrada);
  if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
  return r;
}

const pasaBajos: EntradaFiltro = { ...comun, tipo: 'pasa-bajos', fc: 100e6 };
const pasaBanda: EntradaFiltro = { ...comun, tipo: 'pasa-banda', banda: { f1: 144e6, f2: 148e6 } };
const rechazaBanda: EntradaFiltro = {
  ...comun,
  tipo: 'rechaza-banda',
  banda: { f1: 88e6, f2: 108e6 },
};

describe('escaleras π y T', () => {
  it('cada L pasa a Bobinas con fc como frecuencia de trabajo y cada C a Arreglos', () => {
    const r = calculado(pasaBajos);
    const pases = pasesDelFiltro(r);
    expect(pases).toHaveLength(r.elementos.length);
    r.elementos.forEach((e, i) => {
      const p = pases[i];
      expect(p).toMatchObject({ origen: 'filtros', nombre: e.nombre, valor: e.valor });
      if (e.componente === 'L') {
        expect(p).toMatchObject({ destino: 'bobinas', magnitud: 'inductancia', frecuencia: 100e6 });
      } else {
        expect(p).toMatchObject({ destino: 'arreglos', magnitud: 'capacidad' });
        expect(p).not.toHaveProperty('frecuencia');
      }
    });
  });

  it('en pasa banda y rechaza banda la frecuencia de trabajo es f2', () => {
    for (const entrada of [pasaBanda, rechazaBanda]) {
      const r = calculado(entrada);
      const bobinas = pasesDelFiltro(r).filter((p) => p.destino === 'bobinas');
      expect(bobinas.length).toBeGreaterThan(0);
      for (const p of bobinas) {
        expect(p.destino === 'bobinas' && p.frecuencia).toBe(r.banda!.f2);
      }
    }
  });

  it('es la misma frecuencia con la que se evaluó el valor impracticable', () => {
    const r = calculado({ ...pasaBanda, rl: 300 });
    for (const p of pasesDelFiltro(r)) {
      if (p.destino === 'bobinas') expect(p.frecuencia).toBe(r.frecuenciaRevision);
    }
  });

  it('un valor con aviso lleva su nivel y su motivo', () => {
    // Pasa altos a 1 GHz: las C chicas quedan cerca de la incertidumbre del montaje.
    const r = calculado({ ...comun, tipo: 'pasa-altos', fc: 1e9, orden: 5 });
    expect(r.revision.marcados.length).toBeGreaterThan(0);
    const pases = pasesDelFiltro(r);
    for (const m of r.revision.marcados) {
      expect(pases.find((p) => p.nombre === m.nombre)).toMatchObject({
        nivel: m.nivel,
        motivo: m.motivo,
      });
    }
  });
});

describe('resonadores acoplados', () => {
  const entrada: EntradaResonadores = {
    aproximacion: 'butterworth',
    ripple: null,
    orden: 3,
    banda: { f1: 144e6, f2: 148e6 },
    rs: 50,
    rl: 300,
    qBobina: 100,
    inductancia: null,
  };
  const r = calcularResonadores(entrada);
  if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
  const pases = pasesDeResonadores(r);

  it('la L pasa a Bobinas con la Frecuencia de sintonía', () => {
    expect(pases.l).toMatchObject({
      origen: 'filtros',
      destino: 'bobinas',
      nombre: 'L',
      valor: r.inductancia.valor,
      frecuencia: r.sintonia.f0,
    });
  });

  it('los Capacitores de extremo y de acople pasan a Arreglos como capacitor', () => {
    const capacitores = [...r.extremos, ...r.acoples].map((x) => x.capacitor);
    for (const c of capacitores) {
      expect(pases.capacitores.get(c.nombre)).toMatchObject({
        destino: 'arreglos',
        magnitud: 'capacidad',
        valor: c.valor,
      });
    }
  });

  it('los Capacitores de sintonía no se pasan: van con trimmer', () => {
    for (const s of r.sintonias) expect(pases.capacitores.has(s.capacitor.nombre)).toBe(false);
  });
});

describe('el aviso de pérdida plana', () => {
  it('pasa a redes de adaptación con Rs y RL, sin f₀ fuera de pasa banda', () => {
    for (const entrada of [pasaBajos, rechazaBanda]) {
      const r = calculado({ ...entrada, rl: 300 });
      const p = paseDePerdidaPlana({ rs: 50, rl: 300 }, r);
      expect(p).toEqual({ origen: 'filtros', destino: 'redes', rs: 50, rl: 300 });
    }
  });

  it('en pasa banda lleva también f₀, la central geométrica', () => {
    const r = calculado({ ...pasaBanda, rl: 300 });
    const p = paseDePerdidaPlana({ rs: 50, rl: 300 }, r);
    expect(p).toEqual({ origen: 'filtros', destino: 'redes', rs: 50, rl: 300, f0: r.banda!.f0 });
  });

  it('la franja nombra Rs, RL y, si va, f₀', () => {
    const r = calculado({ ...pasaBanda, rl: 300 });
    expect(textoDeFranja(paseDePerdidaPlana({ rs: 50, rl: 300 }, r))).toBe(
      'Rs = 50 Ω, RL = 300 Ω, f₀ = 146 MHz',
    );
    expect(
      textoDeFranja(paseDePerdidaPlana({ rs: 300, rl: 50 }, { ...r, tipo: 'pasa-bajos' })),
    ).toBe('Rs = 300 Ω, RL = 50 Ω');
  });

  it('desde Redes se encadena a Bobinas y Volver deshace de a uno', () => {
    const r = calculado({ ...pasaBajos, rl: 300 });
    const aRedes = paseDePerdidaPlana({ rs: 50, rl: 300 }, r);
    const l = pasesDelFiltro(r).find((p) => p.destino === 'bobinas')!;
    const e1 = pasar({ activa: 'filtros', pila: [] }, aRedes);
    expect(e1.activa).toBe('redes');
    expect(franjaVisible(e1)).toBe(aRedes);
    const e2 = pasar(e1, { ...l, origen: 'redes' });
    expect(e2.activa).toBe('bobinas');
    expect(volver(e2).activa).toBe('redes');
    expect(volver(volver(e2))).toEqual({ activa: 'filtros', pila: [] });
  });
});

describe('f₀ al llegar a Redes', () => {
  it('en pasa banda llega el f₀ del filtro', () => {
    const r = calculado({ ...pasaBanda, rl: 300 });
    const p = precargaDeF0(paseDePerdidaPlana({ rs: 50, rl: 300 }, r));
    expect(p).toMatchObject({ texto: '146', unidad: 'MHz', valor: r.banda!.f0 });
  });

  it('fuera de pasa banda el campo queda vacío: no vale un f₀ viejo que la franja no nombra', () => {
    const r = calculado({ ...pasaBajos, rl: 300 });
    const p = precargaDeF0(paseDePerdidaPlana({ rs: 50, rl: 300 }, r));
    expect(p.texto).toBe('');
    const leido = leerCampo(p.texto, { magnitud: 'frecuencia', nombre: 'f₀', unidad: p.unidad });
    expect(conValorCompleto(leido, p, p.texto, p.unidad).estado).not.toBe('valido');
  });
});
