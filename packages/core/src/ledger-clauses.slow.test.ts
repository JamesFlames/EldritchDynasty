import { beforeAll, describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import type { RespectTier } from '@ed/schema';
import { RESPECT_ORDER } from '@ed/schema';
import {
  bootstrap, runYears, stepYear, applyEffect, makeRng, mint, previewTemplate,
  tickRelationships, tickRespect, CAMPAIGN_YEARS, expectMean,
} from '@ed/core';

const bundle = loadContent();
// 1042, 909 and 5150 replaced: under the corrected blood-membership count
// (issue #42) each of their own lines breaks in the founding century (1136,
// 1074 and 1109), which a batch this small cannot absorb. 910, 912 and 5151
// are confirmed to survive the full 500-year Long Line.
const SEEDS = [910, 77, 912, 5151, 8080, 31];

/**
 * THE SILENT SUBSYSTEMS.
 *
 * Every assertion in this file covers something that was declared in the
 * schema, referenced by authored content or named in the concept brief, and
 * implemented by nothing. None of them threw. Each one looked, from the
 * outside, exactly like a working feature that happened not to have come up.
 */
/**
 * WHICH clauses a run recovers — split out of `ledger.slow.test.ts` for wall
 * time. This single test was 56 of that file's 162 seconds, and vitest
 * parallelises per FILE, so the longest file sets the floor the whole suite
 * waits behind.
 *
 * The batch inside it is untouched. What it measures is the SPREAD across
 * runs, so taking seeds out of it would not make it faster — it would make it
 * a different, weaker claim.
 */
describe('the Ledger pays out (concept §18) — which clauses', () => {
  /**
   * Issue #4: per-Age assignment means `revealClause` draws from the ACTIVE
   * Age's own set rather than global weight order, so two runs that recover
   * the same NUMBER of clauses need not recover the same ones — that now
   * depends on which Ages they drew. Comparing sets across the whole seed set
   * is not enough to show that: counts differ seed to seed regardless of
   * mechanism, so two runs of different lengths always look "different" even
   * as prefixes of one fixed order. The real claim is about runs that tie —
   * a bigger seed set to guarantee (pigeonhole, at most ten possible counts)
   * that some pair does.
   *
   * TWENTY-FOUR, not twelve. Twelve guarantees a tie and does not guarantee
   * ENOUGH ties: if the two or three pairs it happens to produce all land on
   * the same set, the test reports that clause choice is fixed when it is not.
   * That is what it reported when slots began filling in dependency order —
   * over forty seeds the same measurement showed several distinct sets at
   * five separate counts.
   */
  const seeds = Array.from({ length: 24 }, (_, i) => 1000 + i * 7);
  let measured: { count: number; recovered: Set<string> }[] = [];

  beforeAll(() => {
    measured = seeds.map((seed) => {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, CAMPAIGN_YEARS);
      return { count: ctx.world.clausesRecovered.size, recovered: new Set(ctx.world.clausesRecovered) };
    });
  }, 600_000);

  it('varies which clauses a run recovers, not merely how many', () => {
    const byCount = new Map<number, Set<string>[]>();
    for (const row of measured) {
      byCount.set(row.count, [...(byCount.get(row.count) ?? []), row.recovered]);
    }

    let divergentTie = false;
    for (const sets of byCount.values()) {
      if (sets.length < 2) continue;
      const signatures = new Set(sets.map((s) => [...s].sort().join(',')));
      if (signatures.size > 1) divergentTie = true;
    }
    expect(divergentTie, 'every pair of runs that tied on clause COUNT recovered the exact same SET').toBe(true);
  });

  it('leaves a typical 500-year house substantially informed without making all nine automatic', () => {
    // #133 Stage 5A, calibrated on a separate 40-run batch after making the
    // Archivist reachable at the 500-year term: mean 6.0, p25 4, median 6,
    // p75 8; all nine in 4/40. This guard is intentionally much wider than
    // that result. It catches the Ledger collapsing back to the old median 5
    // or becoming a calendar payout, not ordinary seed-to-seed movement.
    expectMean({
      values: measured.map((m) => m.count),
      floor: 5,
      ceiling: 8,
      what: 'Ledger clauses recovered in a 500-year Long Line',
    });
  });
});
