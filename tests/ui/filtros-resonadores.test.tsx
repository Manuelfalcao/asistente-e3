// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import type { FunctionComponent } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// La pantalla de la Calculadora de filtros con la Topología de resonadores acoplados (spec §7.7): lo
// que el Alumno elige y lo que ve. El cálculo se prueba aparte; acá, que la pantalla lo muestre.

let Filtros: FunctionComponent;

beforeAll(() => {
  // jsdom no tiene ResizeObserver, que usa el esquema para medir el ancho.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

beforeEach(async () => {
  // El almacén lee localStorage al cargarse: cada test arranca sin entradas guardadas.
  localStorage.clear();
  vi.resetModules();
  ({ Filtros } = await import('../../src/ui/filtros/Filtros'));
  render(<Filtros />);
});

afterEach(cleanup);

const escribir = (etiqueta: string | RegExp, texto: string) =>
  fireEvent.input(screen.getByLabelText(etiqueta), { target: { value: texto } });

const elegir = (grupo: string, opcion: string) =>
  fireEvent.click(within(screen.getByRole('group', { name: grupo })).getByLabelText(opcion));

// 144–148 MHz, Butterworth de Orden 3, de 50 a 300 Ω, en resonadores acoplados.
function pasaBandaAcoplado() {
  elegir('Tipo de filtro', 'Pasa banda');
  elegir('Topología', 'Resonadores acoplados');
  escribir('Orden', '3');
  escribir('f1 (borde bajo)', '144');
  escribir('f2 (borde alto)', '148');
  escribir('RL (carga)', '300');
}

const resultados = () => screen.getByRole('region', { name: 'Resultados' });

describe('la Topología de resonadores acoplados en la pantalla de filtros', () => {
  it('solo se ofrece en pasa banda', () => {
    const topologias = () => within(screen.getByRole('group', { name: 'Topología' }));
    expect(topologias().queryByLabelText('Resonadores acoplados')).toBeNull();
    elegir('Tipo de filtro', 'Pasa banda');
    expect(topologias().getByLabelText('Resonadores acoplados')).toBeTruthy();
    elegir('Tipo de filtro', 'Rechaza banda');
    expect(topologias().queryByLabelText('Resonadores acoplados')).toBeNull();
  });

  it('el Orden se ingresa: el cálculo desde una atenuación todavía no está', () => {
    elegir('Tipo de filtro', 'Pasa banda');
    elegir('Orden', 'Calcular desde una atenuación');
    elegir('Topología', 'Resonadores acoplados');
    expect(screen.queryByRole('group', { name: 'Orden' })).toBeNull();
    expect(screen.getByLabelText('Orden')).toBeTruthy();
    expect(screen.queryByLabelText('As (atenuación mínima)')).toBeNull();
  });

  it('propone la L con la Ventana de L a la vista, y el campo vacío usa la propuesta', () => {
    pasaBandaAcoplado();
    expect(screen.getByLabelText('L de los resonadores')).toHaveProperty('value', '');
    expect(screen.getByText(/Vacío: la propuesta, 22 nH/).textContent).toMatch(
      /válida: 8,96 – 23 nH/,
    );
    expect(within(resultados()).getByText(/la propone el Asistente/).textContent).toMatch(
      /la más grande de la serie E12 en la Ventana de L/,
    );
  });

  it('con la ventana vacía no dice que la L es la más grande de la E12', () => {
    pasaBandaAcoplado();
    escribir('Orden', '7');
    const detalle = within(resultados()).getByText(/la propone el Asistente/).textContent;
    expect(detalle).toMatch(/la Ventana de L está vacía/);
    expect(detalle).not.toMatch(/la más grande/);
  });

  it('si ninguna L arma el filtro, lo dice en lugar del resultado', () => {
    pasaBandaAcoplado();
    escribir('f1 (borde bajo)', '200');
    escribir('f2 (borde alto)', '300');
    expect(resultados().textContent).toMatch(/Ninguna L arma este filtro/);
  });

  it('muestra la Frecuencia de sintonía con su leyenda, la central geométrica y los capacitores', () => {
    pasaBandaAcoplado();
    const r = within(resultados());
    expect(r.getByText('145,959 MHz')).toBeTruthy();
    expect(r.getByText(/ajustá cada resonador a esta frecuencia/)).toBeTruthy();
    expect(r.getByText('145,986 MHz')).toBeTruthy();
    for (const nombre of ['C01', 'C12', 'C23', 'C34', 'C1', 'C2', 'C3']) {
      expect(r.getByText(nombre, { selector: '.nombre' })).toBeTruthy();
    }
    // El Capacitor de sintonía C2, 51,95 pF, con el rango de ±20 % del trimmer.
    expect(r.getByText(/trimmer de 41,6 pF a 62,3 pF/)).toBeTruthy();
    expect(r.getByText(/se arman con trimmer/)).toBeTruthy();
    expect(r.getByRole('img').getAttribute('aria-label')).toMatch(
      /^De Rs a RL: C01 en serie, L y C1 \(resonador paralelo\) en derivación, C12 en serie/,
    );
  });

  it('con una L fuera de la ventana avisa qué cota viola', () => {
    pasaBandaAcoplado();
    escribir('L de los resonadores', '27n');
    expect(within(resultados()).getByText(/C12, queda en/)).toBeTruthy();
  });

  it('con una L que no deja adaptar un extremo corta, y dice cuál y la L mínima', () => {
    pasaBandaAcoplado();
    escribir('L de los resonadores', '8n');
    const texto = resultados().textContent!;
    expect(texto).toMatch(/resonador de salida/);
    expect(texto).toMatch(/8,96 nH/);
  });

  it('al dejar el pasa banda vuelve a π o T', () => {
    pasaBandaAcoplado();
    elegir('Tipo de filtro', 'Pasa bajos');
    const topologias = within(screen.getByRole('group', { name: 'Topología' }));
    const marcada = topologias
      .getAllByRole('radio')
      .find((x) => (x as HTMLInputElement).checked) as HTMLInputElement;
    expect(['π', 'T']).toContain(marcada.value);
  });
});
