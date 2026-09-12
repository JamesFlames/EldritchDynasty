import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
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
  /**
   * THE VUE PLUGIN IS HERE FOR THE CLIENT'S COMPONENT TESTS.
   *
   * `packages/client` is 3,350 lines of Vue and, until now, every guard over
   * it was a text-level one: `verbs.test.ts` greps the templates to prove
   * each session verb reaches something a player can click. That catches an
   * unwired verb and nothing else — whether the click does the right thing
   * has never been asked of a rendered component.
   *
   * Component suites opt into a browser with `@vitest-environment jsdom` in a
   * docblock at the top of the file. Node stays the default, because 122 of
   * the 125 suites do not want a DOM and jsdom costs about 300ms per file to
   * stand up.
   */
  plugins: [vue()],
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
    /**
     * ISOLATION OFF, AND INVARIANT 8 IS WHY IT IS SAFE.
     *
     * Vitest gives each test FILE a fresh module registry by default, so the
     * whole `@ed/core` graph is rebuilt per file. 85 of the test files import
     * the barrel, and the cost showed up as `collect`: 64.5s of an 82.8s fast
     * lane was module construction rather than assertions.
     *
     * The reason that default exists is module-level mutable state — one file
     * mutating a counter another file reads. This repository already forbids
     * exactly that, in invariant 8: "Id sequences live on WorldState.counters,
     * never at module scope — a module-level counter is shared by every
     * simulation in the process." A grep over `packages/core/src` finds none.
     *
     * So the precondition holds by RULE rather than by luck, and the rule is
     * older than this setting. The repository had already paid for the
     * optimisation; it was not collecting it.
     *
     * MEASURED, on a four-core container, `npm run test:fast`:
     *   isolate: true    82.77s   (collect 64.50s)
     *   isolate: false   see AGENTS.md's command block
     *
     * If a suite ever needs a fresh registry, it says so per-file with
     * `// @vitest-environment` or its own describe-level setup, rather than by
     * turning this back on for all 132.
     */
    isolate: false,
  },
});
