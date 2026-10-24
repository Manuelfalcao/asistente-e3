import { describe, expect, it } from 'vitest';
import { CALCULADORAS, CALCULADORA_INICIAL } from '../src/ui/calculadoras';
import { textoVersion } from '../src/ui/version';

describe('armazón', () => {
  it('tiene las cinco Calculadoras y abre en la de bobinas', () => {
    expect(CALCULADORAS).toHaveLength(5);
    expect(CALCULADORA_INICIAL.id).toBe('bobinas');
    expect(new Set(CALCULADORAS.map((c) => c.id)).size).toBe(5);
  });

  it('la Versión junta la semántica y el hash corto', () => {
    expect(textoVersion('0.1.0', 'abc1234')).toBe('v0.1.0 · abc1234');
  });
});
