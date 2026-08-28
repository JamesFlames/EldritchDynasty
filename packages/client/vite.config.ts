import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const REPO = r('../..');

/**
 * The game, served. Deliberately thinner than the editor's config: the editor
 * needs a middleware that writes YAML back to disk, and the client must never
 * be able to. It reads the content directory and nothing else.
 */
export default defineConfig({
  // Relative asset paths, so a build loads from file:// as well as from a
  // server — the same reason the editor's build does.
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      '@ed/schema': r('../schema/src/index.ts'),
      '@ed/core': r('../core/src/index.ts'),
    },
  },
  server: {
    // The editor holds 5173. Running both at once is the normal way to work on
    // content: author on one port, play it on the other.
    port: 5174,
    fs: { allow: [REPO] },
  },
});
