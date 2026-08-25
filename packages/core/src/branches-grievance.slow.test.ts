import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { MAIN_BRANCH } from '@ed/schema';
import { bootstrap, runYears, branchOf, halls, activeBranches, MAX_ACTIVE_BRANCHES } from '@ed/core';

const bundle = loadContent();
const SEEDS = [1042, 77, 909, 5150, 8080, 31];

/**
 * GRIEVANCE AS A SIGNAL, ON ITS OWN CLOCK.
 *
 * Split out of `branches.slow.test.ts` for wall time, not for meaning: this
 * one test was 44 of that file's 115 seconds, and vitest parallelises per
 * FILE, so the longest file is the floor the whole suite waits on.
 *
 * Its seed batch came with it whole. Sharding a batch-statistical test by
 * seed range would change what it samples, which is the mistake this codebase
 * has now recorded four times.
 */
describe('cadet branches — grievance', () => {
  /**
   * Grievance has to be a SIGNAL. As an accumulator it pegged at 100 in every
   * run by 1400 — a gate that is always open is not a gate — so it fades when
   * nothing is wrong and climbs while a hall is being passed over.
   */
  it('keeps grievance and discontent inside a usable range', () => {
    const everyGrievance: number[] = [];

    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 800);

      // The clamp itself, which is a real invariant — `tickBranches` pins both
      // to 0..100 and a future change dropping that would land here. It is NOT
      // the claim this test is named for, though: both values are clamped by
      // construction, so asserting only the bounds is a test that cannot fail.
      expect(ctx.world.discontent).toBeGreaterThanOrEqual(0);
      expect(ctx.world.discontent).toBeLessThanOrEqual(100);

      const live = [...ctx.world.branches.values()].filter((b) => b.extinct === undefined);
      expect(live.length, `seed ${seed} finished with no live hall to measure`).toBeGreaterThan(0);
      for (const b of live) {
        expect(b.grievance, b.name).toBeGreaterThanOrEqual(0);
        expect(b.grievance, b.name).toBeLessThanOrEqual(100);
      }

      // THE ACTUAL CLAIM. The bug this test was written for is an accumulator
      // that pegged every hall at 100 by 1400 — "a gate that is always open is
      // not a gate". A whole house sitting at the ceiling is that bug back.
      const pegged = live.filter((b) => b.grievance >= 99).length;
      expect(pegged, `seed ${seed}: all ${live.length} live halls sit at the ceiling`)
        .toBeLessThan(live.length);

      everyGrievance.push(...live.map((b) => b.grievance));
    }

    // And it has to move in BOTH directions, or it is a counter rather than a
    // temperature. Asserted across the batch, not per seed — a run in which no
    // hall ever had a grievance is a legitimate run, just a quiet one.
    //
    // A WIDER BLOCK for this one claim, and the reason is a measurement. What
    // is being sampled is one number per surviving hall at one instant, and
    // its distribution is heavy-tailed: a hall reaches the ceiling by going a
    // century without being honoured, which most halls in most runs do not do.
    // Six seeds is about thirty hall-observations and the top of that sample
    // is carried by one hall. Measured over 24 independent seeds — 120
    // observations — the maximum is 100.0 both before and after the hundred-
    // template common drop; measured over the six above it moved from 98.2 to
    // 49.8, which is the same statistic reporting the sample rather than the
    // game. This is the fourth time that lesson has been learned in this
    // repository and the second time it has been written into a test.
    const wideGrievance: number[] = [];
    for (let i = 0; i < 18; i += 1) {
      const ctx = bootstrap(bundle, 3300 + i * 41, 1042);
      runYears(ctx, 800);
      for (const b of ctx.world.branches.values()) {
        if (b.extinct === undefined) wideGrievance.push(b.grievance);
      }
    }
    expect(Math.min(...wideGrievance), 'no hall in any run was ever content').toBeLessThan(10);
    expect(Math.max(...wideGrievance), 'no hall in any run ever became aggrieved').toBeGreaterThan(50);
    expect(everyGrievance.length, 'the narrow block measured nothing').toBeGreaterThan(0);
  });
});
