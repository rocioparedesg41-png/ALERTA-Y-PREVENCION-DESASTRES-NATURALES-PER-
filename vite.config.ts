import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { createApiMiddleware } from './serverApi.ts';

const BUILD_VERSION = `2026.11-${Date.now().toString(36)}`;

function igpApiAndSwPlugin(): Plugin {
  const apiMiddleware = createApiMiddleware();

  return {
    name: 'igp-api-and-sw-version',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void apiMiddleware(req, res, next);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void apiMiddleware(req, res, next);
      });
    },
    closeBundle() {
      const distSwPath = path.resolve(__dirname, 'dist', 'service-worker.js');
      if (fs.existsSync(distSwPath)) {
        try {
          const content = fs.readFileSync(distSwPath, 'utf-8');
          const updated = content.replace(/__SW_CACHE_VERSION__/g, BUILD_VERSION);
          fs.writeFileSync(distSwPath, updated, 'utf-8');
        } catch (err) {
          console.warn('[Vite Build] No se pudo estampar versión en service-worker.js:', err);
        }
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), igpApiAndSwPlugin()],
    define: {
      __APP_BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
    },
  };
});
