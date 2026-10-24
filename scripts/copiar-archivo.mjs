// Deja el HTML único dentro de la PWA para el link "Descargar versión para PC".
import { copyFileSync, existsSync } from 'node:fs';

if (existsSync('dist')) {
  copyFileSync('dist-archivo/index.html', 'dist/asistente-e3.html');
}
