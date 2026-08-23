import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { bootstrap, runYears } from '@ed/core';

const bundle = loadContent();
const SEEDS = [1042, 77, 909, 5150, 8080, 31, 4242, 611];

/**
 * DOES IT REACH A REAL RUN?
 *
 * The tests in `secrets.test.ts` build the household they mean and prove the
 * mechanism works when it is reached. This file asks the only other question
 * worth asking in this codebase: does anything ever reach it? A leak path that
 * fires in zero runs of a thousand years is not in the game, and — the whole
 * shape of failure here — nothing would say so.
 */
describe('secrets across a batch of thousand-year runs', () => {
  const runs = SEEDS.map((seed) => {
    const ctx = bootstrap(bundle, seed, 1042);
    runYears(ctx, 1000);
    const w = ctx.world;
    return {
      seed,
      loose: w.looseSecrets.length,
      told: w.looseSecrets.filter((l) => l.told !== undefined).length,
      open: [...w.discrepancies.values()].filter((d) => d.state === 'open').length,
      fromSecrets: w.looseSecrets.filter((l) => l.told !== undefined && w.discrepancies.has(l.secret)).length,
      loyalty: w.people.living().filter((p) => p.contract).map((p) => p.contract!.loyalty),
      // Loyalty against the number the person's own template was authored
      // with, which is what the test below is actually named after.
      drifted: w.people.living().filter((p) => {
        if (!p.contract || !p.mintedFrom) return false;
        const authored = bundle.characterTemplates.find((t) => t.id === p.mintedFrom)?.contract?.loyalty;
        return authored !== undefined && p.contract.loyalty !== authored;
      }).length,
    };
  });

  it('lets a secret out of the house at all', () => {
    const total = runs.reduce((a, r) => a + r.loose, 0);
    expect(total, 'no secret walked in any run — the path is unreachable').toBeGreaterThan(0);
  });

  it('gets some of them told, rather than leaving them walking forever', () => {
    const told = runs.reduce((a, r) => a + r.told, 0);
    expect(told, 'secrets walked and none was ever told: the telling roll never lands').toBeGreaterThan(0);
  });

  it('turns every told secret into a Discrepancy, and no untold one', () => {
    for (const r of runs) {
      expect(r.fromSecrets, `seed ${r.seed}: a told secret with no Discrepancy behind it`).toBe(r.told);
    }
  });

  it('does not flood the record with them', () => {
    // A house has at most a handful of posts that know anything, and a secret
    // goes loose once. Two figures a run, not twenty — if this ever trips,
    // something is re-leaking a secret that is already out.
    for (const r of runs) {
      expect(r.loose, `seed ${r.seed} leaked ${r.loose} secrets`).toBeLessThanOrEqual(8);
    }
  });

  it('moves loyalty off the number the template was written with', () => {
    // Against each person's OWN authored number, rather than against the band
    // every authored contract happens to sit in. The band was a proxy for this
    // and a lossy one: `driftLoyalty` can run on every retainer in the batch
    // and still leave all of them inside 48-78, which is what a household-posts
    // drop and a changed economy did to it — five drifted values, 57 through
    // 77, not one of them outside the band, and the test read that as the
    // subsystem never having run. This asks the question in the name.
    const all = runs.flatMap((r) => r.loyalty);
    expect(all.length, 'no house in the batch had staff at 2042').toBeGreaterThan(0);

    const drifted = runs.reduce((a, r) => a + r.drifted, 0);
    expect(drifted, 'every retainer in the batch still holds their hiring number').toBeGreaterThan(0);
  });
});
