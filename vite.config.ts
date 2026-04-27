import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function localApiPlugin() {
  return {
    name: 'creative-os-local-api',
    configureServer(server: any) {
      server.middlewares.use('/api/ai', async (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(Buffer.from(chunk));
          req.body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          const handler = (await import('./api/ai')).default;
          await handler(req, createJsonResponse(res));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Local API error' }));
        }
      });

      server.middlewares.use('/api/source/rss', async (req: any, res: any) => {
        try {
          const requestUrl = new URL(req.url || '', 'http://127.0.0.1');
          req.query = Object.fromEntries(requestUrl.searchParams.entries());
          const handler = (await import('./api/source/rss')).default;
          await handler(req, createJsonResponse(res));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Local source API error' }));
        }
      });
    },
  };
}

function createJsonResponse(res: any) {
  return {
    status(code: number) {
      res.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(payload));
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  Object.assign(process.env, {
    ...loadEnv('preview', __dirname, ''),
    ...loadEnv(mode, __dirname, ''),
  });

  return {
    plugins: [react(), localApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router-dom/')) return 'vendor-react';
            if (id.includes('/firebase/') || id.includes('/@firebase/')) return 'vendor-firebase';
            if (id.includes('/html-to-image/') || id.includes('/jszip/')) return 'vendor-export';
            if (id.includes('/lucide-react/')) return 'vendor-ui';
            return undefined;
          },
        },
      },
    },
  };
});
