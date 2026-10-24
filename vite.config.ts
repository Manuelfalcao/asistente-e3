import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type Plugin, defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { svgIconoAsistente } from './src/ui/iconos';
import { leerPaleta } from './src/ui/paleta';

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string };
const PALETA = leerPaleta(readFileSync('./src/ui/tokens.css', 'utf-8'));

// Los colores del navegador salen de tokens.css, y el ícono de la pestaña va embebido, así anda
// también en el HTML único, que no tiene public/.
const marcaDelAsistente: Plugin = {
  name: 'marca-del-asistente',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { name: 'color-scheme', content: 'light dark' }, injectTo: 'head' },
    ...(['claro', 'oscuro'] as const).map((tema) => ({
      tag: 'meta',
      attrs: {
        name: 'theme-color',
        content: PALETA[tema].superficie,
        media: `(prefers-color-scheme: ${tema === 'claro' ? 'light' : 'dark'})`,
      },
      injectTo: 'head' as const,
    })),
    {
      tag: 'link',
      attrs: {
        rel: 'icon',
        type: 'image/svg+xml',
        href: `data:image/svg+xml,${encodeURIComponent(svgIconoAsistente({ redondeado: true }))}`,
      },
      injectTo: 'head',
    },
  ],
};

function hashCorto(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

// `npm run build` arma la PWA; `npm run build:archivo` (modo "archivo") arma el HTML único.
// `npm run build:muestra` arma aparte la página de muestra del sistema visual, que no llega al
// Asistente: ninguno de los otros dos builds incluye muestra.html.
export default defineConfig(({ mode }) => {
  const archivo = mode === 'archivo';
  if (mode === 'muestra') {
    return {
      base: './',
      publicDir: false,
      build: {
        target: 'es2020',
        outDir: 'dist-muestra',
        rollupOptions: { input: 'muestra.html' },
      },
      plugins: [preact(), viteSingleFile()],
    };
  }
  return {
    base: './',
    publicDir: archivo ? false : 'public',
    define: {
      __VERSION__: JSON.stringify(version),
      __COMMIT__: JSON.stringify(hashCorto()),
    },
    resolve: archivo
      ? {
          alias: {
            'virtual:pwa-register/preact': fileURLToPath(
              new URL('./src/ui/sinServiceWorker.ts', import.meta.url),
            ),
          },
        }
      : {},
    build: {
      target: 'es2020',
      outDir: archivo ? 'dist-archivo' : 'dist',
    },
    plugins: [
      preact(),
      marcaDelAsistente,
      ...(archivo
        ? [
            viteSingleFile(),
            {
              // Sin public/ el HTML único no tiene el PNG: el link apuntaría a un archivo que no existe.
              name: 'sin-apple-touch-icon',
              transformIndexHtml: (html: string) =>
                html.replace(/\s*<link rel="apple-touch-icon"[^>]*>/, ''),
            },
          ]
        : [
            VitePWA({
              registerType: 'prompt',
              includeAssets: ['apple-touch-icon.png'],
              manifest: {
                name: 'Asistente E3',
                short_name: 'Asistente E3',
                description: 'Calculadoras para dimensionar los componentes de tus circuitos.',
                lang: 'es',
                start_url: './',
                scope: './',
                display: 'standalone',
                background_color: PALETA.claro.fondo,
                theme_color: PALETA.claro.superficie,
                icons: [
                  { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                  { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
                  {
                    src: 'icon-maskable-512.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'maskable',
                  },
                ],
              },
              workbox: { globPatterns: ['**/*.{js,css,html,png,svg,woff2,webmanifest}'] },
            }),
          ]),
    ],
    test: { include: ['tests/**/*.test.ts'] },
  };
});
