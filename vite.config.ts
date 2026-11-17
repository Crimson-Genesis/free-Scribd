import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import handler from './api/process-pdf';

function scribdApiPlugin(): Plugin {
  const handleApiRequest = async (req: any, res: any) => {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    req.query = Object.fromEntries(url.searchParams.entries());

    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk: any) => (body += chunk));
      req.on('end', async () => {
        try {
          req.body = JSON.parse(body || '{}');
        } catch {
          req.body = {};
        }
        try {
          await handler(req, res);
        } catch (e: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: e.message || 'API processing error' }));
        }
      });
    } else {
      try {
        await handler(req, res);
      } catch (e: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: e.message || 'API processing error' }));
      }
    }
  };

  return {
    name: 'scribd-api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/process-pdf', handleApiRequest);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/process-pdf', handleApiRequest);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), scribdApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});
