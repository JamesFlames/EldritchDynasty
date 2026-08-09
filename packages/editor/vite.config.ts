import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const REPO = r('../..');
const CONTENT = join(REPO, 'packages/content');

/**
 * Dev-only content bridge. The editor reads YAML through import.meta.glob and
 * writes it back through this endpoint, which keeps the round-trip on real
 * files and in git — the tool writes clean files and gets out of the way.
 *
 * The Electron build replaces this with IPC to the main process; the client
 * API surface is identical so nothing above it changes.
 */
function contentBridge() {
  return {
    name: 'ed-content-bridge',
    configureServer(server: any) {
      server.middlewares.use('/api/content', (req: any, res: any) => {
        if (req.method !== 'PUT') {
          res.statusCode = 405;
          return res.end('PUT only');
        }
        let body = '';
        req.on('data', (c: Buffer) => (body += c));
        req.on('end', () => {
          try {
            const { path, text } = JSON.parse(body) as { path: string; text: string };
            const target = resolve(CONTENT, path);
            if (!target.startsWith(CONTENT)) throw new Error('path escapes content root');
            // Read-before-write: never overwrite something we have not seen.
            readFileSync(target, 'utf8');
            writeFileSync(target, text, 'utf8');
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ ok: true, path }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: String(e) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [vue(), contentBridge()],
  resolve: {
    alias: {
      '@ed/schema': r('../schema/src/index.ts'),
      '@ed/core': r('../core/src/index.ts'),
    },
  },
  server: {
    fs: { allow: [REPO] },
  },
});
