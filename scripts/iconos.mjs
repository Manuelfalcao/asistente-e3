// Arma los PNG del Asistente instalado desde el mismo SVG que usa el menú (src/ui/iconos.ts).
// Uso: npm run iconos. Los PNG quedan en public/ y se guardan en el repo. Node 24 importa el .ts
// de src/ directamente (sin tipos).
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { svgIconoAsistente } from '../src/ui/iconos.ts';

const SALIDAS = [
  // PC y navegador: esquinas redondeadas y transparentes
  { archivo: 'icon-192.png', lado: 192, redondeado: true },
  { archivo: 'icon-512.png', lado: 512, redondeado: true },
  // Android recorta el maskable con su propia forma: va a sangre
  { archivo: 'icon-maskable-512.png', lado: 512, redondeado: false },
  // iPhone redondea solo y no admite transparencia
  { archivo: 'apple-touch-icon.png', lado: 180, redondeado: false },
];

for (const { archivo, lado, redondeado } of SALIDAS) {
  const svg = svgIconoAsistente({ redondeado });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: lado } }).render().asPng();
  writeFileSync(new URL(`../public/${archivo}`, import.meta.url), png);
  console.log(`public/${archivo}`);
}
