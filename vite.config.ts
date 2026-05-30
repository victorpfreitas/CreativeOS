import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dynamicImport = new Function('moduleUrl', 'return import(moduleUrl)') as (moduleUrl: string) => Promise<any>;

function importLocalApi(relativePath: string) {
  return dynamicImport(pathToFileURL(path.resolve(__dirname, relativePath)).href);
}

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
          const handler = (await importLocalApi('./api/ai.ts')).default;
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
          const handler = (await importLocalApi('./api/source/rss.ts')).default;
          await handler(req, createJsonResponse(res));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Local source API error' }));
        }
      });

      server.middlewares.use('/api/source/resolve-image', async (req: any, res: any) => {
        try {
          const requestUrl = new URL(req.url || '', 'http://127.0.0.1');
          req.query = Object.fromEntries(requestUrl.searchParams.entries());
          const handler = (await importLocalApi('./api/source/resolve-image.ts')).default;
          await handler(req, createJsonResponse(res));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Local source image API error' }));
        }
      });

      server.middlewares.use('/api/source/youtube', async (req: any, res: any) => {
        try {
          const requestUrl = new URL(req.url || '', 'http://127.0.0.1');
          const url = requestUrl.searchParams.get('url') || '';
          const videoId = getYouTubeVideoId(url);
          const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : '';
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            title: 'Video do YouTube',
            url,
            imageUrl: thumbnailUrl,
            transcript: '',
            transcriptSource: 'unavailable',
            language: requestUrl.searchParams.get('lang') || '',
            note: 'No ambiente local, confirme a URL e cole resumo, transcript ou bullets para gerar com fidelidade.',
            sourceCaptureType: thumbnailUrl ? 'youtube_thumbnail' : undefined,
            sourceCaptureUrl: thumbnailUrl,
            sourceCaptureStatus: thumbnailUrl ? 'ready' : 'failed',
            sourceCaptureNote: thumbnailUrl ? 'Usando thumbnail oficial do YouTube para abrir o draft.' : 'Nao consegui resolver thumbnail localmente.',
          }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Local YouTube API error' }));
        }
      });
    },
  };
}

function getYouTubeVideoId(value: string) {
  const clean = value.trim();
  if (!clean) return '';
  try {
    const parsed = new URL(clean);
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.split('/').filter(Boolean)[0] || '';
    const videoId = parsed.searchParams.get('v');
    if (videoId) return videoId;
    const shortsMatch = parsed.pathname.match(/\/shorts\/([^/?#]+)/);
    if (shortsMatch) return shortsMatch[1];
    const embedMatch = parsed.pathname.match(/\/embed\/([^/?#]+)/);
    if (embedMatch) return embedMatch[1];
  } catch {
    return clean.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([a-zA-Z0-9_-]{6,})/)?.[1] || '';
  }
  return '';
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
