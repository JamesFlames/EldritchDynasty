import { beforeAll, describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { delegationDensityLines, measureDensity, type DensityRun } from './tools/density-gate.js';

const SEEDS = [901, 902] as const;
const TERMS = [500, 300] as const;

function sum(runs: DensityRun[], pick: (run: DensityRun) => number): number {
  return runs.reduce((total, run) => total + pick(run), 0);
}

/**
 * ISSUE #219'S PAIRED MEASUREMENT.
 *
 * Same seeds, same first-choice/plain-Record player, same term. The delegated
 * column differs in one thing only: after the player answers an ordinary event
 * once, that exact answer becomes a standing preference. Important repeats are
 * still surfaced by mustSurface(), so their count must not move.
 *
 * Reproduce the printed table directly with:
 *   npm run gate:density -- --delegation --seeds=901,902 500 300
 */
describe('delegation reduces routine interruption without thinning the meaningful stream (#219)', () => {
  const content = loadContent().bundle;
  let rows: {
    term: number;
    before: DensityRun[];
    after: DensityRun[];
  }[] = [];

  beforeAll(() => {
    rows = TERMS.map((term) => ({
      term,
      before: SEEDS.map((seed) => measureDensity(content, seed, term)),
      after: SEEDS.map((seed) => measureDensity(content, seed, term, { delegateRoutine: true })),
    }));
    // Measurement evidence belongs in the CI log as numbers, not only as an
    // assertion whose pass/fail hides how much changed.
    for (const line of delegationDensityLines(rows)) console.log(`[delegation-density] ${line}`);
  }, 900_000);

  for (const term of TERMS) {
    it(`removes repeated low-stakes prompts across the ${term}-year line`, () => {
      const row = rows.find((candidate) => candidate.term === term)!;
      const before = sum(row.before, (run) => run.choices + run.records);
      const after = sum(row.after, (run) => run.choices + run.records);
      expect(after, `${term}y surfaced ${after} choice/Record prompts after delegation vs ${before} before`)
        .toBeLessThan(before);
    });

    it(`keeps every consequential choice and Record interruption across the ${term}-year line`, () => {
      const row = rows.find((candidate) => candidate.term === term)!;
      expect(sum(row.after, (run) => run.meaningfulChoices))
        .toBe(sum(row.before, (run) => run.meaningfulChoices));
      expect(sum(row.after, (run) => run.meaningfulRecords))
        .toBe(sum(row.before, (run) => run.meaningfulRecords));
    });
  }
});
