import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { expectRate, newGame } from '@ed/core';

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
    // TWENTY-FOUR RUNS, AND A FLOOR THAT MARKS A BROKEN SYSTEM RATHER THAN
    // THE CURRENT READING. Both halves of that were learned the hard way.
    //
    // This asserted `> 8` of twelve — a feud in more than two runs in three —
    // against a rate measured over 48 seeds on two independent seed sets at
    // 81% to 90%. Two thirds is barely one and a half standard errors below
    // that, so the assertion was a coin: at 81% it fails about one build in
    // four with nothing wrong. It duly went red on two household templates
    // that fire under once a run between them and create no grudges at all,
    // because adding anything to the pool re-rolls which scene wins every draw
    // for a thousand years.
    //
    // Doubling the batch was not enough on its own — 19 of 24 against a floor
    // of two thirds is still only about 1.5 standard errors, and `expectRate`
    // refuses it. What fixes it is asking the right question. The claim this
    // test is named for is that the family HAS somewhere to quarrel with
    // itself, and a broken version of that reads near zero, not at 70%. So the
    // floor goes where a regression would be. At the measured rate that is
    // better than three standard errors clear, and it would still catch
    // grudges collapsing — which two thirds, ironically, was too fragile to do
    // reliably.
    const oldest: number[] = [];
    let withGrudges = 0;
    for (let i = 0; i < 24; i += 1) {
      const g = newGame(bundle, { seed: 3000 + i * 17, decider: 'chronicler' });
      g.advance(1000);
      const w = g.ctx.world;
      const grudges = [...w.relationships.values()].flatMap((r) => r.grudges);
      if (!grudges.length) continue;
      withGrudges += 1;
      oldest.push(Math.max(...grudges.map((x) => w.year - x.originYear)));
    }
    expectRate({
      hits: withGrudges,
      n: 24,
      floor: 0.5,
      what: 'a thousand years and nobody fell out with anybody',
    });
    oldest.sort((a, b) => a - b);
    expect(oldest[Math.floor(oldest.length / 2)], 'no feud outlived a single generation')
      .toBeGreaterThan(30);
  });
});
