import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { bootstrap, familySnapshot, runYears } from '@ed/core';

const bundle = loadContent();

/**
 * SIGIL DRIFT ACROSS THE SEED SET (issue #19 acceptance).
 *
 * "Across the seed set, at least one household member has a non-empty
 * divergence by 1500, and the divergence count tracks the embellish rate."
 * Without this, the record layer is indistinguishable from not having been
 * built — the assertion the issue itself names.
 */
const TARGET_YEAR = 1500;

function run(seed: number) {
  const ctx = bootstrap(bundle, seed, 1042);
  runYears(ctx, TARGET_YEAR - 1042);
  const snapshot = familySnapshot(ctx);
  const embellishes = ctx.world.decisionLog.filter((d) => d.kind === 'record' && d.option === 'embellish').length;
  const drifted = snapshot.filter((p) => p.drift).length;
  return { embellishes, drifted, snapshot };
}

describe('sigil drift across the seed set (issue #19 acceptance)', () => {
  /**
   * The sample is this test's own, and wider than the sixteen seeds both tests
   * in this file used to share, for the reason the correlation test below
   * already had to take its own: drift is RARE, and
   * "at least one of sixteen seeds" is a bet on a rare event landing inside a
   * fixed set rather than a measurement of whether it happens.
   *
   * Measured over 40 seeds at this target year, with and without the careers
   * content that first exposed this: 5/40 seeds drift either way — an
   * identical rate — while embellishments went from 77 to 107. A per-seed rate
   * of ~12% means sixteen seeds come up empty about one time in eight, so ANY
   * content change had a one-in-eight chance of reddening this test on
   * behaviour that was demonstrably intact. It duly did.
   *
   * Later target years do not rescue it — drift is measured on the household
   * that is alive at the target, so it plateaus near 30% of seeds even at 2042
   * (12/40 without the careers content, 11/40 with it). Sample size is the only
   * lever, so this takes the sample and leaves the assertion alone.
   */
  const DRIFT_SEEDS = Array.from({ length: 40 }, (_, i) => 100 + i * 137);

  it('by 1500, at least one household member has a non-empty divergence', () => {
    const results = DRIFT_SEEDS.map(run);
    const anyDrift = results.some((r) => r.drifted > 0);
    expect(
      anyDrift,
      `no seed produced a drifted person by ${TARGET_YEAR} — counts: ${results.map((r) => r.drifted).join(',')}`,
    ).toBe(true);
  });

  /**
   * `drifted` is near-binary at 1500 (almost always 0 or 1 per seed), so the
   * Pearson correlation against it is a noisy statistic — measured directly
   * across several independent 60-80 seed samples at this same target year,
   * it ranged from ~0.10 to ~0.60, run to run, on content that never changed.
   * The direction was consistently positive; the magnitude was not stable
   * enough for a tight floor to survive an unrelated content change shifting
   * which seeds land where. `CORR_SEEDS` trades the original 16 for a wider,
   * dedicated sample; the drift test above has since had to do the same, for
   * the same reason. 0.08 is comfortably below every sample measured while
   * still catching the failure this test exists for: embellishing having
   * NO relationship to drift at all.
   */
  it('the divergence count tracks the embellish rate', () => {
    // 200 seeds, not 60, and the floor stays where it was.
    //
    // Measured on the content that finally tripped this: five INDEPENDENT
    // 60-seed samples returned 0.216, 0.248, 0.261, 0.350 and 0.360 — the
    // relationship is strong and entirely intact — while this test's own
    // hard-coded 60 returned 0.058. One block of sixty was simply an unlucky
    // draw, and the test had no way to tell that from a regression. The same
    // stream widened to 200 returns 0.237.
    //
    // The comment above already worked this out twice for the other statistic
    // in this file. It is the same lesson a third time: a fixed seed block is
    // a sample, and asserting a threshold on one sample of a noisy statistic
    // reports the sample rather than the game.
    const CORR_SEEDS = Array.from({ length: 200 }, (_, i) => 1000 + i * 17);
    const results = CORR_SEEDS.map(run);
    const n = results.length;
    const meanE = results.reduce((s, r) => s + r.embellishes, 0) / n;
    const meanD = results.reduce((s, r) => s + r.drifted, 0) / n;

    let cov = 0;
    let varE = 0;
    let varD = 0;
    for (const r of results) {
      cov += (r.embellishes - meanE) * (r.drifted - meanD);
      varE += (r.embellishes - meanE) ** 2;
      varD += (r.drifted - meanD) ** 2;
    }
    const corr = varE > 0 && varD > 0 ? cov / Math.sqrt(varE * varD) : 0;

    expect(corr, `correlation ${corr} across ${n} seeds`).toBeGreaterThan(0.08);
  });
});
