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
const SEEDS = [1042, 77, 909, 5150, 8080, 31, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 1500];
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
  it('by 1500, at least one household member has a non-empty divergence', () => {
    const results = SEEDS.map(run);
    const anyDrift = results.some((r) => r.drifted > 0);
    expect(
      anyDrift,
      `no seed produced a drifted person by ${TARGET_YEAR} — counts: ${results.map((r) => r.drifted).join(',')}`,
    ).toBe(true);
  });

  it('the divergence count tracks the embellish rate', () => {
    const results = SEEDS.map(run);
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

    const detail = results.map((r) => `${r.embellishes}/${r.drifted}`).join(', ');
    expect(corr, `embellishes/drifted per seed: ${detail} — correlation ${corr}`).toBeGreaterThan(0.15);
  });
});
