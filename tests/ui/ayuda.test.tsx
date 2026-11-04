// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// El botón de Ayuda del encabezado y su ventana, sobre el Asistente entero.

// Importa el módulo virtual del service worker, que solo existe al compilar.
vi.mock('../../src/ui/FranjaVersionNueva', () => ({ FranjaVersionNueva: () => null }));

beforeAll(() => {
  // jsdom no tiene ResizeObserver (el esquema) ni IntersectionObserver (el atajo).
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  globalThis.IntersectionObserver ??= class {
    observe() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver;
  // jsdom no abre un <dialog> por su cuenta: lo justo para que se comporte como el del navegador.
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

afterEach(cleanup);

async function abrirAsistente() {
  localStorage.setItem('asistente-e3', JSON.stringify({ version: 1, ultima: 'atenuadores' }));
  const { App } = await import('../../src/ui/App');
  render(<App />);
}

const abrirAyuda = () => fireEvent.click(screen.getByRole('button', { name: 'Ayuda' }));

describe('la Ayuda', () => {
  it('está cerrada al abrir el Asistente', async () => {
    await abrirAsistente();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('se abre con el texto del README, sin lo de quien lo mantiene', async () => {
    await abrirAsistente();
    abrirAyuda();
    const ventana = within(await screen.findByRole('dialog', { name: 'Ayuda' }));
    expect(ventana.getByRole('heading', { level: 3, name: 'Cómo se usa' })).toBeTruthy();
    expect(ventana.getByRole('heading', { level: 4, name: 'Atenuadores' })).toBeTruthy();
    expect(ventana.queryByText(/Para quien mantiene/)).toBeNull();
  });

  it('muestra la negrita como negrita, sin los asteriscos', async () => {
    await abrirAsistente();
    abrirAyuda();
    const ventana = await screen.findByRole('dialog');
    expect(within(ventana).getByText('Desde el link:').tagName).toBe('STRONG');
    expect(ventana.textContent).not.toContain('**');
  });

  it('se cierra y deja la Calculadora como estaba', async () => {
    await abrirAsistente();
    const atenuacion = screen.getByLabelText('Atenuación A') as HTMLInputElement;
    fireEvent.input(atenuacion, { target: { value: '6' } });
    abrirAyuda();
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByLabelText('Atenuación A')).toBe(atenuacion);
    expect(atenuacion.value).toBe('6');
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual([
      'Calculadora de atenuadores',
    ]);
  });

  it('se cierra con un toque afuera, pero no con uno adentro', async () => {
    await abrirAsistente();
    abrirAyuda();
    const ventana = await screen.findByRole('dialog');
    fireEvent.click(within(ventana).getByText('Cómo se usa'));
    expect(screen.queryByRole('dialog')).not.toBeNull();
    fireEvent.click(ventana);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
