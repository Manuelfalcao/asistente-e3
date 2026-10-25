import { describe, expect, it } from 'vitest';
import { leerCampo } from '../../src/entrada/campo';
import { opcionesDelSelector } from '../../src/entrada/campos';
import {
  CABLE,
  CARRETE,
  FRECUENCIA,
  INDUCTANCIA,
  SEPARACION,
  SEPARACION_POR_DEFECTO,
} from '../../src/ui/bobinas/campos';

// Los campos de la Calculadora de bobinas y sus validaciones (spec §6.1).
const leer = (texto: string, spec: typeof CARRETE) =>
  leerCampo(texto, { ...spec, unidad: opcionesDelSelector(spec.magnitud)[0] });

describe('campos de la Calculadora de bobinas (spec §6.1)', () => {
  it('la inductancia buscada va en nH por defecto y tiene que ser mayor que 0', () => {
    expect(leer('100', INDUCTANCIA)).toMatchObject({ estado: 'valido', valor: 100e-9 });
    expect(leer('0', INDUCTANCIA).estado).toBe('invalido');
  });

  it('el Diámetro del carrete y el del cable van en mm y tienen que ser mayores que 0', () => {
    for (const spec of [CARRETE, CABLE]) {
      expect(leer('0,8', spec)).toMatchObject({ estado: 'valido', valor: 0.8e-3 });
      expect(leer('0', spec).estado).toBe('invalido');
    }
  });

  it('la Separación entre vueltas admite 0 y viene en 0', () => {
    expect(SEPARACION_POR_DEFECTO).toBe('0');
    expect(leer('0', SEPARACION)).toMatchObject({ estado: 'valido', valor: 0 });
    expect(leer('0,5', SEPARACION)).toMatchObject({ estado: 'valido', valor: 0.5e-3 });
  });

  it('la frecuencia de trabajo es opcional, en MHz por defecto', () => {
    expect(FRECUENCIA.obligatorio).toBeFalsy();
    expect(leer('', FRECUENCIA).estado).toBe('vacio');
    expect(leer('145', FRECUENCIA)).toMatchObject({ estado: 'valido', valor: 145e6 });
    expect(leer('0', FRECUENCIA).estado).toBe('invalido');
  });

  it('las entradas obligatorias son la L y los tres largos', () => {
    expect([INDUCTANCIA, CARRETE, CABLE, SEPARACION].every((c) => c.obligatorio)).toBe(true);
    expect(CABLE.nombre).toBe('Diámetro del cable');
  });
});
