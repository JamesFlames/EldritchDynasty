/**
 * Fingerprint a set of runs.
 *
 *   npm run digest -- 8 400
 *
 * Prints one line per seed: a hash of the entire saved world after N years.
 * The point is DIFFING ACROSS COMMITS. A refactor that is meant to change
 * nothing should print the same block before and after; if it does not, the
 * change is not a refactor, and this says so in two seconds rather than after a
 * thousand-year harness run and a squint at eleven averages.
 *
 * It is deliberately not a checked-in golden. A constant in a test file gets
 * updated reflexively the first time a balance tweak moves it, and from then on
 * it asserts nothing. A tool the author runs on purpose, either side of a
 * change they believe is behaviour-preserving, keeps its meaning.
 */
import { loadContent } from '@ed/content';
import { bootstrap, runYears } from '../sim.js';
import { digestOf } from '../save.js';

export function digests(seeds: number[], years: number): { seed: number; digest: string }[] {
  const content = loadContent();
  return seeds.map((seed) => {
    const ctx = bootstrap(content, seed, 1042);
    runYears(ctx, years);
    return { seed, digest: digestOf(ctx) };
  });
}

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('digest.ts');
if (isMain) {
  const count = Number(process.argv[2] ?? 8);
  const years = Number(process.argv[3] ?? 400);
  const seeds = Array.from({ length: count }, (_, i) => 1000 + i * 7);
  console.log(`${count} runs x ${years} years`);
  for (const { seed, digest } of digests(seeds, years)) {
    console.log(`  ${String(seed).padStart(6)}  ${digest}`);
  }
}
