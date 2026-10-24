import { describe, expect, it } from 'vitest';
import { numeroLatex, valorLatex } from '../../src/calculo/comun/latex';

describe('números para las fórmulas (spec §5.4)', () => {
  it('escribe la coma decimal como {,} y redondea a 4 cifras', () => {
    expect(numeroLatex(3.16227766)).toBe('3{,}162');
    expect(numeroLatex(0.647512)).toBe('0{,}6475');
  });

  it('no pone ceros de relleno ni coma en los enteros', () => {
    expect(numeroLatex(50)).toBe('50');
    expect(numeroLatex(10)).toBe('10');
    expect(numeroLatex(2386.2)).toBe('2386');
  });

  it('usa el menos de LaTeX, que Temml escribe como signo menos', () => {
    expect(numeroLatex(-24.9554)).toBe('-24{,}96');
  });

  it('acepta otra cantidad de cifras', () => {
    expect(numeroLatex(3.16227766, 3)).toBe('3{,}16');
  });
});

describe('valores con unidad para las fórmulas', () => {
  it('pone un espacio fino y la unidad en \\mathrm', () => {
    expect(valorLatex(43.0331, 'resistencia')).toBe('43{,}03\\,\\mathrm{\\Omega}');
  });

  it('elige el prefijo como el formato de salida', () => {
    expect(valorLatex(2386.203, 'resistencia')).toBe('2{,}386\\,\\mathrm{k\\Omega}');
    expect(valorLatex(145e6, 'frecuencia')).toBe('145\\,\\mathrm{MHz}');
    expect(valorLatex(4.7e-6, 'inductancia')).toBe('4{,}7\\,\\mathrm{\\mu H}');
  });

  it('escribe los dB con 2 decimales', () => {
    expect(valorLatex(5.719475, 'decibeles')).toBe('5{,}72\\,\\mathrm{dB}');
  });

  it('con 3 cifras en el nivel de resultado', () => {
    expect(valorLatex(43.0331, 'resistencia', 'resultado')).toBe('43\\,\\mathrm{\\Omega}');
  });
});
