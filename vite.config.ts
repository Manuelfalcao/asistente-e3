import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string };

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
export default defineConfig(({ mode }) => {
  const archivo = mode === 'archivo';
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
                background_color: '#ffffff',
                theme_color: '#1d4ed8',
                icons: [
                  { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                  { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
                  { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                ],
              },
              workbox: { globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'] },
            }),
          ]),
    ],
    test: { include: ['tests/**/*.test.ts'] },
  };
});
