/**
 * WHAT A TEST FILE COSTS — ALL OF IT, NOT JUST THE PART INSIDE `it()`.
 *
 * ── WHY THE OBVIOUS INSTRUMENT IS THE WRONG ONE ───────────────────────────
 *
 * Vitest's own JSON reporter gives each file the span from its first test
 * STARTING to its last one ENDING. Measured against this repository that is
 * not the cost of the file, and the gap is not small:
 *
 *   the whole suite, by the JSON reporter   28.3 min of test time
 *   the same run, by the clock              ~62 min on four cores
 *
 * Roughly half the work is outside every test body. `arcs.slow.test.ts` is
 * the clearest case: it collects `const BATCH = runBatch(COVERAGE_SEEDS)` at
 * MODULE SCOPE — 360 thousand-year runs, deliberately, so that four
 * assertions share one batch instead of playing it four times. The JSON
 * reporter attributes every second of that to nothing at all and reports the
 * file at 55 seconds.
 *
 * A packing built on those numbers would put the batch files together and be
 * confidently wrong, which is the same shape as the path-hash sharding it
 * replaces — a number that looks like a duration and is a fact about
 * something else. So this reporter records the four spans vitest actually
 * tracks per file and adds them:
 *
 *   prepare      standing the worker up
 *   environment  jsdom, where a suite asks for one
 *   collect      importing the module — where a module-scope batch lives
 *   tests        the test bodies
 *
 * `tools/cost.mjs` attaches this, `tools/shards.mjs` packs from what it
 * writes, and `lanes.test.ts` fails the build when the packing drifts.
 */
import { writeFileSync } from 'node:fs';

export default class DurationReporter {
  onInit(ctx) {
    this.ctx = ctx;
    // Where to write, taken from the reporter's own output file so that
    // nothing here has to agree with a path spelled out somewhere else.
    this.out = ctx.config.outputFile?.['duration-reporter']
      ?? ctx.config.outputFile
      ?? 'test-durations.raw.json';
    if (typeof this.out !== 'string') this.out = 'test-durations.raw.json';
  }

  onFinished(files = []) {
    const rows = {};
    for (const f of files) {
      if (!f.filepath) continue;
      const parts = {
        prepare: f.prepareDuration ?? 0,
        environment: f.environmentLoad ?? 0,
        setup: f.setupDuration ?? 0,
        collect: f.collectDuration ?? 0,
        tests: f.result?.duration ?? 0,
      };
      rows[f.filepath] = {
        ...parts,
        total: Math.round(Object.values(parts).reduce((a, b) => a + b, 0)),
      };
    }
    writeFileSync(this.out, `${JSON.stringify(rows, null, 2)}\n`);
  }
}
