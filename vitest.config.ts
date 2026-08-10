import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * TWO SPEEDS, AND THE FILENAME SAYS WHICH.
 *
 * `*.slow.test.ts` is a suite that simulates centuries — the ones that assert
 * the SHAPE OF A HEALTHY RUN, which is the only way to catch a house that
 * quietly empties or a scene that never fires. Nine of them cost ninety seconds
 * of CPU between them, and there is no cheaper way to get what they check.
 *
 * Everything else asserts a mechanism and runs in about eight seconds total.
 * That is the loop you want while fixing a bug: `npm run test:fast`. Run the
 * whole suite before you claim anything works — `npm run check` does.
 *
 * A new suite that runs a century takes the `.slow` suffix. One that does not,
 * does not.
 */
export const SLOW_SUITES = 'packages/**/*.slow.test.ts';

export default defineConfig({
  resolve: {
    alias: {
      '@ed/schema': r('./packages/schema/src/index.ts'),
      '@ed/core': r('./packages/core/src/index.ts'),
      '@ed/content': r('./packages/content/src/index.ts'),
    },
  },
  test: {
    include: ['packages/**/*.test.ts'],
    environment: 'node',
  },
});
