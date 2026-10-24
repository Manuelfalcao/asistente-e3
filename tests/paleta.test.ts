import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AZUL_DEL_ICONO } from '../src/ui/iconos';
import { PARES_DE_CONTRASTE, contraste, leerPaleta } from '../src/ui/paleta';

// Vitest deja vacío cualquier import de CSS, también con `?raw`: se lee del disco.
const tokens = readFileSync(new URL('../src/ui/tokens.css', import.meta.url), 'utf-8');

const CSS_DE_EJEMPLO = `
:root {
  color-scheme: light dark;
  --fondo: #ffffff;
  --texto: #111111;
  --error: var(--texto);
  --toque: 2.75rem;
}
@media (prefers-color-scheme: dark) {
  :root {
    --fondo: #000;
    --texto: #EEEEEE;
  }
}
`;

describe('paleta', () => {
  it('lee los colores de los dos temas; el oscuro hereda lo que no redefine', () => {
    const { claro, oscuro } = leerPaleta(CSS_DE_EJEMPLO);
    expect(claro).toEqual({ fondo: '#ffffff', texto: '#111111', error: '#111111' });
    expect(oscuro).toEqual({ fondo: '#000000', texto: '#eeeeee', error: '#eeeeee' });
  });

  it.each(['claro', 'oscuro'] as const)(
    'en el tema %s, cada texto y rótulo llega a AA sobre su fondo',
    (tema) => {
      const colores = leerPaleta(tokens)[tema];
      const fallas = PARES_DE_CONTRASTE.flatMap(({ frente, fondo, minimo }) => {
        expect(colores[frente], `--${frente}`).toBeDefined();
        expect(colores[fondo], `--${fondo}`).toBeDefined();
        const r = contraste(colores[frente], colores[fondo]);
        return r < minimo ? [`${frente} sobre ${fondo}: ${r.toFixed(2)} < ${minimo}`] : [];
      });
      expect(fallas).toEqual([]);
    },
  );

  it('el ícono del Asistente usa el acento del tema claro', () => {
    expect(AZUL_DEL_ICONO).toBe(leerPaleta(tokens).claro.acento);
  });

  it('pide 4,5:1 a todo texto y 3:1 a bordes de campos y puntos de aviso', () => {
    const minimos = new Set(PARES_DE_CONTRASTE.map((p) => p.minimo));
    expect([...minimos].sort()).toEqual([3, 4.5]);
    const texto = PARES_DE_CONTRASTE.filter((p) => p.minimo === 4.5).map((p) => p.frente);
    expect(texto).toEqual(
      expect.arrayContaining(['texto', 'texto-suave', 'dudoso-texto', 'impracticable-texto']),
    );
  });

  it('mide el contraste como WCAG 2', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 5);
    // #767676 sobre blanco es el gris más claro que llega a AA (4,54:1).
    expect(contraste('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
    expect(contraste('#ffffff', '#767676')).toBeCloseTo(4.54, 2);
    expect(contraste('#fff', '#000')).toBeCloseTo(21, 5);
  });
});
