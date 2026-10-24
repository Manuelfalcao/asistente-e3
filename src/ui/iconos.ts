import type { IdCalculadora } from './calculadoras';

// Íconos de las Calculadoras: trazos en una grilla de 24 × 24, del color del texto.
export const ICONOS: Record<IdCalculadora, readonly string[]> = {
  // un solenoide visto de costado
  bobinas: ['M2 16h2.5c0-9 8-9 8 0c0 3-4 3-4 0c0-9 8-9 8 0c0 3-4 3-4 0c0-9 8-9 8 0H22'],
  // la respuesta de un pasa banda
  filtros: ['M3 20h18', 'M3 17c3.5 0 4-11 9-11s5.5 11 9 11'],
  // dos capacitores en paralelo
  arreglos: [
    'M2 12h3M19 12h3M5 6v12M19 6v12',
    'M5 6h5.5M13.5 6H19M10.5 3v6M13.5 3v6',
    'M5 18h5.5M13.5 18H19M10.5 15v6M13.5 15v6',
  ],
  // una carta de Smith
  redes: [
    'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0',
    'M3 12h18',
    'M12 12a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0',
    'M21 12A9 9 0 0 1 12 3M21 12A9 9 0 0 0 12 21',
  ],
  // una resistencia y la señal que baja
  atenuadores: ['M2 7h3l1.5-3 3 6 3-6 3 6 1.5-3H22', 'M5 13v8M10 15v6M15 17v4M20 19v2'],
};

// El azul del ícono es el --acento del tema claro (tests/paleta.test.ts lo verifica). Es uno solo:
// el ícono no cambia con el tema (docs/adr/0001-modo-oscuro-segun-el-sistema.md).
export const AZUL_DEL_ICONO = '#1d4ed8';

// Ícono del Asistente: "E3" sobre el azul, con las vueltas de una bobina debajo. Lo usan el menú
// y scripts/iconos.mjs, que arma los PNG del Asistente instalado.
export function svgIconoAsistente({ redondeado }: { redondeado: boolean }): string {
  const esquinas = redondeado ? ' rx="112"' : '';
  const fondo = `<rect width="512" height="512"${esquinas} fill="${AZUL_DEL_ICONO}"/>`;
  // Dibujado a trazo, sin fuente: la E y el 3 tienen 180 de alto y trazo 36, y el 3 son dos
  // semicírculos iguales. El conjunto está centrado y cabe en el círculo central del 80 %, la zona
  // segura de un ícono maskable.
  const trazo = 'fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round"';
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' +
    fondo +
    `<g ${trazo} stroke-width="36">` +
    '<path d="M222 146H150V290H222M150 218H208"/>' +
    '<path d="M272 146H326a36 36 0 0 1 0 72H298M326 218a36 36 0 0 1 0 72H272"/>' +
    '</g>' +
    `<path ${trazo} stroke-width="18" d="M160 374h16a20 20 0 0 1 40 0a20 20 0 0 1 40 0a20 20 0 0 1 40 0a20 20 0 0 1 40 0h16"/>` +
    '</svg>'
  );
}
