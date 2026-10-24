import temml from 'temml';
import { describe, expect, it } from 'vitest';
import {
  type EntradaMinimaPerdida,
  REFERENCIAS_MINIMA_PERDIDA,
  calcularMinimaPerdida,
} from '../../../src/calculo/atenuadores/atenuadores';
import { dentroDeTolerancia, margen, MEDIA_UNIDAD } from '../../casos';
import { CASOS_REFERENCIA_PAD, CASOS_VERIFICACION_PAD } from './casos-pad';

function pad(entrada: EntradaMinimaPerdida) {
  const r = calcularMinimaPerdida(entrada);
  if (r.estado !== 'calculado') throw new Error(`no calculó: ${r.codigo}`);
  return r;
}

describe('casos de referencia: pads de mínima pérdida de la Fig. 7', () => {
  it('la tabla tiene las 26 filas del libro', () => {
    expect(CASOS_REFERENCIA_PAD).toHaveLength(26);
  });

  for (const caso of CASOS_REFERENCIA_PAD) {
    it(caso.id, () => {
      const r = pad(caso.entradas);
      const { perdida, serie, derivacion } = caso.esperado;
      const comparar = (nombre: string, obtenido: number, impreso: string) =>
        expect(
          dentroDeTolerancia(obtenido, impreso, caso.tolerancia),
          `${nombre}: ${obtenido} contra ${impreso} ± ${margen(caso.tolerancia, impreso)}`,
        ).toBe(true);
      comparar('pérdida', r.aMin, perdida);
      comparar('serie R1', r.pad.serie.valor, serie);
      comparar('derivación R3', r.pad.derivacion.valor, derivacion);
    });
  }
});

describe('casos de verificación: A10 y A11 de la investigación', () => {
  for (const caso of CASOS_VERIFICACION_PAD) {
    it(caso.id, () => {
      const r = pad(caso.entradas);
      const dentro = (obtenido: number, impreso: string) =>
        dentroDeTolerancia(obtenido, impreso, MEDIA_UNIDAD);
      expect(dentro(r.aMin, caso.esperado.aMin), `A_min ${r.aMin}`).toBe(true);
      expect(dentro(r.pad.serie.valor, caso.esperado.serie), `serie ${r.pad.serie.valor}`).toBe(
        true,
      );
      expect(
        dentro(r.pad.derivacion.valor, caso.esperado.derivacion),
        `derivación ${r.pad.derivacion.valor}`,
      ).toBe(true);
      // La serie del lado de 75 o de 300 Ω, la mayor.
      expect(r.pad.serie.lado).toBe('Z2');
      expect(r.pad.derivacion.lado).toBe('Z1');
    });
  }
});

describe('el pad de mínima pérdida (spec §10.2)', () => {
  it('con Z1 = Z2 no hay pad: la mínima pérdida es cero', () => {
    const r = calcularMinimaPerdida({ z1: 50, z2: 50 });
    expect(r.estado).toBe('corte');
    if (r.estado === 'corte') expect(r.codigo).toBe('impedancias-iguales');
  });

  it('la serie va del lado de la impedancia mayor y la derivación del lado de la menor', () => {
    const ida = pad({ z1: 300, z2: 50 }).pad;
    expect([ida.serie.lado, ida.derivacion.lado]).toEqual(['Z1', 'Z2']);
    const vuelta = pad({ z1: 50, z2: 300 }).pad;
    expect([vuelta.serie.lado, vuelta.derivacion.lado]).toEqual(['Z2', 'Z1']);
    expect([vuelta.serie.posicion, vuelta.derivacion.posicion]).toEqual(['serie', 'derivacion']);
  });

  it('intercambiar Z1 y Z2 da el mismo pad al revés', () => {
    for (const [z1, z2] of [
      [50, 75],
      [50, 300],
      [500, 30],
    ]) {
      const ida = pad({ z1, z2 });
      const vuelta = pad({ z1: z2, z2: z1 });
      expect(vuelta.aMin).toBeCloseTo(ida.aMin, 12);
      expect(vuelta.pad.serie.valor).toBeCloseTo(ida.pad.serie.valor, 9);
      expect(vuelta.pad.derivacion.valor).toBeCloseTo(ida.pad.derivacion.valor, 9);
    }
  });

  it('A_min coincide con el de la verificación del cálculo general', () => {
    expect(pad({ z1: 50, z2: 75 }).aMin).toBeCloseTo(5.719475, 6);
    expect(pad({ z1: 50, z2: 300 }).aMin).toBeCloseTo(13.415226, 6);
    expect(pad({ z1: 50, z2: 75 }).k).toBeCloseTo(10 ** (5.719475 / 20), 6);
  });

  it('las resistencias se llaman R1 (serie) y R3 (derivación), como en la Fig. 7', () => {
    const { pad: p } = pad({ z1: 50, z2: 75 });
    expect([p.serie.nombre, p.derivacion.nombre]).toEqual(['R1', 'R3']);
    expect(p.topologia).toBe('L');
  });

  it('las fórmulas son las de §10.2 y los pasos las sustituyen', () => {
    const { pad: p } = pad({ z1: 50, z2: 75 });
    expect(p.formulas).toEqual([
      'A_{\\mathrm{min}} = 20 \\log_{10}\\left(\\sqrt{r} + \\sqrt{r - 1}\\right)',
      'R_1 = Z_{\\mathrm{mayor}} \\sqrt{1 - \\dfrac{Z_{\\mathrm{menor}}}{Z_{\\mathrm{mayor}}}}',
      'R_3 = \\dfrac{Z_{\\mathrm{menor}}}{\\sqrt{1 - \\dfrac{Z_{\\mathrm{menor}}}{Z_{\\mathrm{mayor}}}}}',
    ]);
    const latex = p.pasos.map((x) => x.latex);
    expect(latex.some((l) => l.startsWith('A_{\\mathrm{min}}'))).toBe(true);
    expect(latex).toContain(
      `${p.formulas[1]} = 75 \\cdot \\sqrt{1 - \\dfrac{50}{75}} = 43{,}3\\,\\mathrm{\\Omega}`,
    );
    expect(latex).toContain(
      `${p.formulas[2]} = \\dfrac{50}{\\sqrt{1 - \\dfrac{50}{75}}} = 86{,}6\\,\\mathrm{\\Omega}`,
    );
  });

  it('todas las fórmulas se dibujan con Temml sin errores', () => {
    for (const [z1, z2] of [
      [50, 75],
      [300, 50],
    ]) {
      const { pad: p } = pad({ z1, z2, potencia: 1 });
      for (const f of [...p.formulas, ...p.pasos.map((x) => x.latex)]) {
        expect(() => temml.renderToString(f, { throwOnError: true, wrap: 'tex' })).not.toThrow();
      }
    }
  });

  it('la verificación da Z1 a la entrada y A_min', () => {
    for (const [z1, z2] of [
      [50, 75],
      [75, 50],
      [300, 50],
    ]) {
      const r = pad({ z1, z2 });
      expect(Math.abs(r.pad.verificacion.zEntrada / z1 - 1)).toBeLessThan(1e-9);
      expect(Math.abs(r.pad.verificacion.atenuacion - r.aMin)).toBeLessThan(1e-9);
    }
  });

  it('cita la Fig. 7, pág. 260, junto con las páginas de las ecuaciones', () => {
    const r = pad({ z1: 50, z2: 75 });
    expect(r.referencias).toBe(REFERENCIAS_MINIMA_PERDIDA);
    expect(REFERENCIAS_MINIMA_PERDIDA[0].ubicacion).toBe(
      'cap. 9, pág. 253 (ecuaciones) y Fig. 7, pág. 260',
    );
    expect(REFERENCIAS_MINIMA_PERDIDA.map((x) => x.edicion)).toEqual(['4.ª', '1.ª']);
  });

  it('lleva la nota de VHF y el aviso de la frecuencia por defecto', () => {
    const r = pad({ z1: 50, z2: 75 });
    expect(r.notas.join(' ')).toMatch(/película o SMD.*no de alambre.*terminales cortos/);
    expect(r.avisos.map((a) => a.codigo)).toEqual(['frecuencia-por-defecto']);
    const con = pad({ z1: 50, z2: 75, frecuencia: 145e6 });
    expect(con.avisos).toEqual([]);
  });

  it('avisa de menos de 0,5 dB cuando las impedancias casi coinciden', () => {
    const r = pad({ z1: 50, z2: 50.1, frecuencia: 100e6 });
    expect(r.aMin).toBeLessThan(0.5);
    expect(r.avisos.map((a) => a.codigo)).toEqual(['menos-de-medio-db']);
  });

  it('revisa las dos resistencias con el criterio común de valor impracticable', () => {
    // De 1 kΩ a 10 Ω a 300 MHz: la serie de 995 Ω y la de derivación de 10 Ω pasan del 50 % de error
    const r = pad({ z1: 1000, z2: 10, frecuencia: 300e6 });
    const nombres = r.pad.revision.marcados.map((m) => m.nombre);
    expect(nombres.length).toBeGreaterThan(0);
    expect(r.pad.revision.sugerencia).toBeNull();
    // la cuenta va al final de los pasos
    expect(r.pad.pasos.at(-1)?.texto).toMatch(/reactancia parásita/);
  });
});
