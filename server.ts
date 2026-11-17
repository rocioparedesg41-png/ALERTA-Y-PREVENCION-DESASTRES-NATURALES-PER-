import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiMiddleware } from './serverApi.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();
  const apiMiddleware = createApiMiddleware();

  // Rutas backend oficiales (SASPe SSE, IGP, PDFs institucionales, Gemini)
  app.use((req, res, next) => {
    void apiMiddleware(req, res, next);
  });

  if (isProd) {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(
      express.static(distDir, {
        maxAge: '1y',
        immutable: true,
        setHeaders: (res, filePath) => {
          const base = path.basename(filePath);
          if (base === 'index.html' || base === 'service-worker.js' || base === 'manifest.json') {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          }
        },
      })
    );

    app.get('*', (_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build no encontrado. Ejecute npm run build.');
      }
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use((req, res, next) => {
      const urlPath = (req.url || '').split('?')[0];
      if (urlPath === '/service-worker.js' || urlPath === '/manifest.json') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
      vite.middlewares(req, res, next);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Alerta Perú] Servidor activo en http://0.0.0.0:${PORT} (${isProd ? 'producción' : 'desarrollo'})`);
  });
}

startServer().catch((err) => {
  console.error('Error fatal al iniciar el servidor:', err);
  process.exit(1);
});
