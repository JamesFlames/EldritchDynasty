import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * TWO SPEEDS, AND THE FILENAME SAYS WHICH.
 *
 * `*.slow.test.ts` is a suite that plays whole games — the ones that assert
 * the SHAPE OF A HEALTHY RUN, which is the only way to catch a house that
 * quietly empties or a scene that never fires. Thirty-two of them cost about
 * twenty minutes of CPU between them, and there is no cheaper way to get what
 * they check.
 *
 * Everything else asserts a mechanism against a world built by
 * `core/src/testing.ts` and finishes in seconds. That is the loop you want
 * while fixing a bug: `npm run test:fast`, 45 files in about 26 seconds. Run
 * the whole suite before you claim anything works — `npm run check` does.
 *
 * A new suite that plays a whole game takes the `.slow` suffix. One that does
 * not, does not. `lanes.test.ts` enforces that now, because for months it was
 * only ever asked for: seven suites sat in the fast lane playing millennia and
 * took it to a hundred seconds, and every one of them passed the whole time.
 *
 * TWO THINGS ABOUT THE SLOW LANE ARE WORTH KNOWING BEFORE ADDING TO IT.
 * Vitest parallelises per FILE, so the longest single file is the floor the
 * whole suite waits behind — `ledger` at 162s and `branches` at 115s were that
 * floor, and are split (by test, never by seed range: sharding a batch changes
 * what it samples). And the per-file fixed cost is now the Zod pass over the
 * content bundle, about 200ms, since `@ed/content` caches the YAML parse.
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
