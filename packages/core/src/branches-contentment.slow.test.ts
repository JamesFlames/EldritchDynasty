import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { MAIN_BRANCH } from '@ed/schema';
import { expectRate, bootstrap, runYears, branchOf, halls, activeBranches, MAX_ACTIVE_BRANCHES } from '@ed/core';

const bundle = loadContent();
const SEEDS = [1042, 77, 909, 5150, 8080, 31];

/**
 * WHETHER A HALL CAN STAND FOR CENTURIES AND STILL BE CONTENT.
 *
 * Split out of `branches.slow.test.ts` for wall time — 30 of its 115 seconds.
 * `FADE_SEEDS` is deliberately a batch of its own and stays that way; the
 * comment below says why.
 */
describe('cadet branches — contentment', () => {
  /**
   * THE FADE, ISOLATED — and the one assertion in this file that actually
   * catches the accumulator bug the block above is named for.
   *
   * Everything easier fails to. Clamped bounds cannot fail at all; "not every
   * hall is pegged" and "some hall is content" both stay green under a pure
   * accumulator, because a run always has a hall founded in the last decade
   * sitting near zero on the way up.
   *
   * What an accumulator cannot produce is a hall that has stood for
   * generations and is STILL content — under `delta = 1` every hall is a
   * function of its own age, so age is grievance. Measured across sixteen
   * seeds: 18 of 38 long-lived halls sit under 50 with the fade in place, and
   * 1 of 46 without it. A dedicated seed set because the claim is about the
   * shape of the distribution, and this file's usual six leave it resting on
   * a single quiet run.
   */
  it('lets a hall stand for centuries and still be content', () => {
    const FADE_SEEDS = Array.from({ length: 16 }, (_, i) => 4000 + i * 97);
    let longLived = 0;
    let content = 0;

    for (const seed of FADE_SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 800);
      for (const b of ctx.world.branches.values()) {
        if (b.extinct !== undefined) continue;
        if (ctx.world.year - b.foundedYear <= 150) continue;
        longLived += 1;
        if (b.grievance < 50) content += 1;
      }
    }

    expect(longLived, 'no hall in the batch lasted long enough to measure a fade').toBeGreaterThan(10);
    expectRate({
      hits: content,
      n: longLived,
      floor: 0.2,
      what: 'grievance is accumulating rather than fading — long-lived halls that are content',
    });
  });

  it('does not sit at maximum discontent for the whole run', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    runYears(ctx, 800);
    expect(ctx.world.discontent).toBeLessThan(95);
  });
});
