import { loadContent } from '@ed/content';
import { playedRun, simulationKey, corpusStats } from '../corpus.js';

/**
 * WARM THE RUN CORPUS, and print the key CI should cache under.
 *
 *   npm run corpus            # warm every batch the suite asks for
 *   npm run corpus -- --key   # print the cache key and exit
 *
 * The corpus turns `record.slow.test.ts` from 451 seconds into 23 — but only
 * once the runs are in it. COLD it is slightly SLOWER than replaying (539s),
 * because playing a run and then saving and compressing it costs more than
 * playing it. That is the whole reason this file exists: a cache that is
 * never warm is a tax, and CI is where it would never be warm.
 *
 * So CI caches `node_modules/.cache/ed-runs` under the key below, which is a
 * hash of the simulation sources and the content together. Change either and
 * the key changes, the restore misses, and this warms a fresh corpus for the
 * next run — no invalidation to reason about, and no way to serve a run the
 * current code would not produce.
 */

/**
 * The batches the slow lane actually asks for.
 *
 * KEPT NEXT TO THE SUITES THAT ASK, not guessed: each entry names the file it
 * is warming for, so a batch that changes size in a suite and not here shows
 * up as a cold miss rather than as a wrong answer — the corpus is a cache, so
 * the worst a stale entry here can do is cost time.
 */
const BATCHES: { what: string; seeds: number[]; years: number }[] = [
  {
    what: 'record.slow.test.ts — drift across the seed set',
    seeds: Array.from({ length: 40 }, (_, i) => 100 + i * 137),
    years: 458,
  },
  {
    what: 'record.slow.test.ts — drift tracks the embellish rate',
    seeds: Array.from({ length: 200 }, (_, i) => 1000 + i * 17),
    years: 458,
  },
  {
    what: 'corpus.slow.test.ts — the integrity pair',
    seeds: [100],
    years: 458,
  },
];

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('corpus-warm.ts');
if (isMain) {
  if (process.argv.includes('--key')) {
    // Printed alone, on one line, so a workflow can read it with `$(...)`.
    process.stdout.write(`${simulationKey()}\n`);
  } else {
    const bundle = loadContent();
    const started = Date.now();
    let total = 0;

    for (const batch of BATCHES) {
      const t0 = Date.now();
      for (const seed of batch.seeds) playedRun(bundle, seed, batch.years);
      total += batch.seeds.length;
      const took = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`  ${batch.seeds.length} x ${batch.years}y  ${took}s  ${batch.what}`);
    }

    const { hits, misses } = corpusStats();
    console.log(
      `corpus warm: ${total} runs, ${hits} already held, ${misses} played, `
      + `${((Date.now() - started) / 1000).toFixed(1)}s total`,
    );
    console.log(`key ${simulationKey()}`);
  }
}
