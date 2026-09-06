import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * TWO SPEEDS, AND THE FILENAME SAYS WHICH.
 *
 * `*.slow.test.ts` is a suite that plays whole games — the ones that assert
 * the SHAPE OF A HEALTHY RUN, which is the only way to catch a house that
 * quietly empties or a scene that never fires. Forty-three of them cost about
 * forty minutes of CPU between them, and there is no cheaper way to get what
 * they check.
 *
 * Everything else asserts a mechanism against a world built by
 * `core/src/testing.ts` and finishes in seconds. That is the loop you want
 * while fixing a bug: `npm run test:fast`, 82 files in about 55 seconds. Run
 * the whole suite before you claim anything works — `npm run check` does.
 *
 * EVERY NUMBER IN THIS COMMENT WAS RE-MEASURED 2026-09-06, on a four-core
 * container, running the whole suite at once. The ones it replaced were
 * between two and three times out — "45 files in about 26 seconds" for a lane
 * that had reached 84, and a floor named after two files that had not been
 * the floor for months. Nothing reported either. Treat a timing comment as
 * perishable: re-measure before quoting it, and see `lanes.test.ts` for the
 * two rules that are enforced instead of asked for.
 *
 * A new suite that plays a whole game takes the `.slow` suffix. One that does
 * not, does not. `lanes.test.ts` enforces that now, because for months it was
 * only ever asked for: seven suites sat in the fast lane playing millennia and
 * took it to a hundred seconds, and every one of them passed the whole time.
 *
 * IT ENFORCES A SECOND RULE NOW, because the first one is not enough. A suite
 * can drive a batch through somebody ELSE's loop and the text-level net sees
 * nothing: `gates.test.ts` contains no `newGame`, no `advance` and no
 * `runYears`, and cost 61 seconds — 41% of the whole fast lane — because the
 * runs happen inside the gate functions it calls. Driving a batch through a
 * `tools/` module is now something a fast-lane suite has to DECLARE, with what
 * it drives; see `DRIVES_A_BATCH` in `lanes.test.ts`.
 *
 * TWO THINGS ABOUT THE SLOW LANE ARE WORTH KNOWING BEFORE ADDING TO IT.
 * Vitest parallelises per FILE, so the longest single file is the floor the
 * whole suite waits behind — that is `record` at 451s, which plays 240 runs of
 * 458 years for two assertions. (`ledger` and `branches` were the floor when
 * this comment was first written, at 162s and 115s; they are 75s and 47s now,
 * and were split by test, never by seed range: sharding a batch changes what
 * it samples.) And the per-file fixed cost is the Zod pass over the content
 * bundle, about 200ms, since `@ed/content` caches the YAML parse — across 82
 * fast-lane files that fixed cost is now the majority of the lane's wall
 * clock, not the tests.
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
