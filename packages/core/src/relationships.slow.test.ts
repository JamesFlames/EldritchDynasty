import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { newGame } from '@ed/core';

const bundle = loadContent();

/**
 * FEUDS, MEASURED OVER WHOLE RUNS.
 *
 * One test, twelve thousand-year runs, 27 of the 34 seconds
 * `relationships.test.ts` used to cost — and it sat in the fast lane, which
 * every other test in that file belongs in because they build the state they
 * mean and tick one phase over it.
 *
 * It cannot be built rather than simulated: what it samples is how long a
 * grudge survives being INHERITED across four centuries of deaths, which is
 * the shape of a healthy run and nothing shorter.
 */
describe('grudges that outlive the men who took them, across whole runs', () => {
  it('gives the family somewhere to quarrel with itself', () => {
    // Rival houses quarrel with the seat perhaps nine times in a thousand
    // years (`assize.ts`). The family quarrels with itself constantly, and
    // those are the feuds `inheritance: all_blood` was written for — the ones
    // with the same surname on both ends.
    //
    // A BATCH, and the reason is a measurement. What this samples is the age
    // of the oldest grudge still HELD by somebody alive in 2042, and a grudge
    // is pruned when its holder dies (the test above proves that), so the
    // number is really "how long ago did the last long-lived grudge-holder
    // acquire theirs" — one observation off one run, on a quantity with a
    // very long tail. Measured over 20 seeds it clears thirty years in about
    // four runs in five, with a median of 90; seed 3000 alone came up 19
    // after a content drop that had nothing to do with grudges. The claim is
    // that feuds outlive a generation, not that every run's does.
    const oldest: number[] = [];
    let withGrudges = 0;
    for (let i = 0; i < 12; i += 1) {
      const g = newGame(bundle, { seed: 3000 + i * 17, decider: 'chronicler' });
      g.advance(1000);
      const w = g.ctx.world;
      const grudges = [...w.relationships.values()].flatMap((r) => r.grudges);
      if (!grudges.length) continue;
      withGrudges += 1;
      oldest.push(Math.max(...grudges.map((x) => w.year - x.originYear)));
    }
    expect(withGrudges, 'a thousand years and nobody fell out with anybody, in any run')
      .toBeGreaterThan(8);
    oldest.sort((a, b) => a - b);
    expect(oldest[Math.floor(oldest.length / 2)], 'no feud outlived a single generation')
      .toBeGreaterThan(30);
  });
});
