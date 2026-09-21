import { beforeAll, describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { bootstrap, END_YEAR, expectMean, runYears } from '@ed/core';
import { CAMPAIGN_YEARS } from './campaign.js';

const content = loadContent();

/**
 * TUTOR COMPLETIONS PER GENERATION (issue #125, Stage 5 — the closing pass).
 *
 * Finding 1 of the epic was that the tutor's term never ran at all: 0
 * completions in 16 runs of 1000 years, because nothing could START one — the
 * player's own standing order was the only door. A `tutor` Effect kind and a
 * steward who buys terms (issues #127/#128) opened it; this is the
 * re-measurement the closing pass asked for, at the CURRENT campaign term
 * (#133 made A Long Line 500 years, 1042 to 1542) through the plain
 * chronicler — no active policy, `bootstrap` + `runYears` alone, the same
 * method the opening measurement used (gate 4's own seeds, `5000 + i * 7`).
 *
 * A BAND, not a floor: a floor alone cannot catch the rate falling back
 * toward zero if a later change quietly starves the steward's diligence roll
 * again — and that silent zero is exactly what this epic opened with.
 *
 * Broken Lines are excluded from the ratio, the same way BALANCE-LOG's
 * "#133 Stage 5A" excludes them from its Ledger claim: a line that dies at
 * generation three divides a small tutoring count by a small generation
 * count, and the resulting ratio is a fact about the extinction rather than
 * about the tutor's cadence.
 */
describe('tutor completions per generation (issue #125)', () => {
  const SEEDS = Array.from({ length: 16 }, (_, i) => 5000 + i * 7);

  let perGeneration: number[] = [];
  let survived = 0;

  beforeAll(() => {
    for (const seed of SEEDS) {
      const ctx = bootstrap(content, seed, 1042);
      let tutorCompletions = 0;
      for (let y = 0; y < CAMPAIGN_YEARS; y++) {
        runYears(ctx, 1);
        tutorCompletions += ctx.world.stewardYear.taught.length;
      }
      if (ctx.world.year >= END_YEAR) {
        survived += 1;
        perGeneration.push(tutorCompletions / Math.max(1, ctx.world.generation));
      }
    }
  }, 180_000);

  it('reaches the 1542 term in most of the batch, so the ratio below is about a completed house', () => {
    expect(survived, `only ${survived} of ${SEEDS.length} seeds reached 1542`).toBeGreaterThan(SEEDS.length / 2);
  });

  /**
   * The band: floor 5, ceiling 16. Measured 2026-09-21 on sixteen full runs
   * (fourteen reaching term): mean 9.36 tutor completions per generation, sd
   * 1.65 — the floor clears the observed minimum (7.15) with room, and the
   * ceiling sits above the observed maximum (11.7) with room, so ordinary
   * seed-to-seed drift does not trip either side. See docs/BALANCE-LOG.md,
   * "#125 Stage 5" for the full sixteen-seed table.
   */
  it('completes several tutor terms a generation, not the zero the epic opened with', () => {
    expectMean({ values: perGeneration, floor: 5, what: 'tutor completions per generation' });
    expectMean({ values: perGeneration, ceiling: 16, what: 'tutor completions per generation' });
  });
});
