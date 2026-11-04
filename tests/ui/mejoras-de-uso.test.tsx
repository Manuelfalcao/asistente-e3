// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Lo que el armazón y los campos suman para el Alumno, sea cual sea la Calculadora: el título de la
// pantalla, el ejemplo del campo vacío, Enter, el atajo al resultado y el mensaje sin resultado.

// Importa el módulo virtual del service worker, que solo existe al compilar.
vi.mock('../../src/ui/FranjaVersionNueva', () => ({ FranjaVersionNueva: () => null }));

type Vista = { target: Element; isIntersecting: boolean };
let avisarVista: (cambios: Vista[]) => void;

beforeAll(() => {
  // jsdom no tiene ResizeObserver (el esquema) ni IntersectionObserver (el atajo).
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  globalThis.IntersectionObserver = class {
    constructor(aviso: (cambios: Vista[]) => void) {
      avisarVista = aviso;
    }
    observe() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver;
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  // El almacén lee localStorage al cargarse: cada test arranca sin entradas guardadas.
  localStorage.clear();
  vi.resetModules();
});

afterEach(cleanup);

async function abrirFiltros() {
  localStorage.setItem('asistente-e3', JSON.stringify({ version: 1, ultima: 'filtros' }));
  const { App } = await import('../../src/ui/App');
  render(<App />);
}

const escribir = (etiqueta: string, texto: string) =>
  fireEvent.input(screen.getByLabelText(etiqueta), { target: { value: texto } });

const enter = (etiqueta: string) =>
  fireEvent.keyDown(screen.getByLabelText(etiqueta), { key: 'Enter' });

describe('el título de la pantalla', () => {
  it('es el nombre de la Calculadora, como único h1', async () => {
    await abrirFiltros();
    const titulos = screen.getAllByRole('heading', { level: 1 });
    expect(titulos.map((h) => h.textContent)).toEqual(['Calculadora de filtros']);
  });
});

describe('un campo vacío', () => {
  it('muestra cómo se puede escribir el valor', async () => {
    await abrirFiltros();
    escribir('fc', '');
    expect(screen.getByLabelText<HTMLInputElement>('fc').placeholder).toBe('ej. 145M');
  });
});

describe('Enter en un campo', () => {
  it('pasa al campo siguiente', async () => {
    await abrirFiltros();
    screen.getByLabelText('Orden').focus();
    enter('Orden');
    expect(document.activeElement).toBe(screen.getByLabelText('fc'));
  });

  it('en el último, cierra el teclado y lleva al resultado', async () => {
    await abrirFiltros();
    const campos = [...document.querySelectorAll<HTMLInputElement>('.entradas .campo-valor input')];
    const ultimo = campos[campos.length - 1];
    ultimo.focus();
    fireEvent.keyDown(ultimo, { key: 'Enter' });
    expect(document.activeElement).not.toBe(ultimo);
    expect(document.querySelector('.resultados')?.scrollIntoView).toHaveBeenCalled();
  });
});

describe('el atajo entre las entradas y el resultado', () => {
  const entradas = () => document.querySelector('.cuerpo-calculadora > :first-child')!;
  const resultados = () => document.querySelector('.resultados')!;
  const atajo = () => document.querySelector('.salto')?.textContent;
  const conResultado = () => {
    escribir('Orden', '5');
    escribir('fc', '148M');
  };

  it('lleva al resultado cuando este queda fuera de la vista', async () => {
    await abrirFiltros();
    conResultado();
    act(() =>
      avisarVista([
        { target: resultados(), isIntersecting: false },
        { target: entradas(), isIntersecting: true },
      ]),
    );
    expect(atajo()).toContain('Ver resultado');
  });

  it('vuelve a las entradas cuando estas quedan fuera de la vista', async () => {
    await abrirFiltros();
    conResultado();
    act(() =>
      avisarVista([
        { target: resultados(), isIntersecting: true },
        { target: entradas(), isIntersecting: false },
      ]),
    );
    expect(atajo()).toContain('Volver a las entradas');
  });

  it('no aparece con todo a la vista, ni sin un resultado al que ir', async () => {
    await abrirFiltros();
    conResultado();
    act(() =>
      avisarVista([
        { target: resultados(), isIntersecting: true },
        { target: entradas(), isIntersecting: true },
      ]),
    );
    expect(atajo()).toBeUndefined();

    escribir('fc', '');
    act(() => avisarVista([{ target: resultados(), isIntersecting: false }]));
    expect(atajo()).toBeUndefined();
  });
});

describe('el mensaje sin resultado', () => {
  it('solo marca como error lo que hay que corregir', async () => {
    const { SinResultado } = await import('../../src/ui/comun/Resultado');
    const clase = (mensaje: string) => {
      const { container } = render(<SinResultado mensaje={mensaje} />);
      return container.querySelector('.sin-resultado')?.classList.contains('corregir');
    };
    expect(clase('Completá: fc')).toBe(false);
    expect(clase('Corregí: fc')).toBe(true);
  });
});
