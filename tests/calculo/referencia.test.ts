import { describe, expect, it } from 'vitest';
import { REFERENCIAS_ATENUADORES } from '../../src/calculo/atenuadores/atenuadores';
import { citar } from '../../src/calculo/comun/referencia';

const plano = (partes: ReturnType<typeof citar>) =>
  partes.map((p) => (p.obra ?? '') + p.texto).join('');

describe('cita de la referencia bibliográfica', () => {
  it('una obra en dos ediciones: la segunda va "junto con"', () => {
    expect(plano(citar(REFERENCIAS_ATENUADORES))).toBe(
      'Reference Data for Radio Engineers, 4.ª ed. (ITT, 1956), cap. 9, págs. 252-254, ' +
        'junto con la 1.ª ed. (1943), págs. 65-67.',
    );
  });

  it('el título de la obra va aparte, para la cursiva', () => {
    expect(citar(REFERENCIAS_ATENUADORES).map((p) => p.obra)).toEqual([
      'Reference Data for Radio Engineers',
      null,
    ]);
  });

  it('dos obras distintas van separadas por punto y coma', () => {
    const partes = citar([
      { obra: 'A', edicion: '2.ª', anio: 2000, ubicacion: 'pág. 3' },
      { obra: 'B', edicion: '1.ª', editor: 'X', anio: 1990, ubicacion: 'ec. 4' },
    ]);
    expect(plano(partes)).toBe('A, 2.ª ed. (2000), pág. 3; B, 1.ª ed. (X, 1990), ec. 4.');
  });
});
