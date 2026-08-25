import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import type { Rung } from '@ed/schema';
import { RUNGS, newGame, rungIndex } from '@ed/core';
/**
 * THE LADDER, MEASURED OVER WHOLE RUNS.
 *
 * These three ran in the fast lane for as long as the ladder has existed, and
 * cost 69 seconds of the 100 that lane took — one batch of 24 thousand-year
 * runs and two single ones. They assert the shape of a healthy run, which is
 * exactly what the `.slow` suffix is for; the mechanism tests that can be
 * BUILT rather than simulated stay in `ascension.test.ts`.
 */
describe('where the ladder actually lands, across a run', () => {
  it('gets a house past Touched, and does not hand it the top', () => {
    // A BATCH, not three seeds. Adept lands in about two chronicler runs in
    // five, and the first cut of this test sampled three of them and reported
    // the sample — which is the mistake `record.slow.test.ts` has now made
    // three times and `CLAUDE.md` names twice ("never pin a test to one seed
    // reaching one state").
    //
    // 24, not 12, and the reason is a measurement rather than a preference.
    // The rate this test is sampling MOVED: with the rare content drop in the
    // bundle, Adept lands in 7 chronicler runs in 24 against 9 in 24 without
    // it — the rare tier now fires about 22 times a thousand years instead of
    // 7, which is its own documented cadence ("a few per century") and which
    // takes those firings out of the common pool, where the library and the
    // table live. Twelve seeds against a rate near three in ten is a coin
    // flip on a `> 1` assertion, and it came up one.
    //
    // The assertion is that the second rung is REACHABLE by a house nobody is
    // steering, not that it is reached at a particular rate. 24 seeds says
    // that; 12 said it only when the rate was four in ten.
    const content = loadContent();
    const reached: Rung[] = [];
    for (let s = 0; s < 24; s += 1) {
      const g = newGame(content, { seed: 3000 + s, decider: 'chronicler' });
      g.advance(1000);
      reached.push(g.ctx.world.ascension.best);
    }
    const adepts = reached.filter((r) => rungIndex(r) >= rungIndex('adept')).length;

    // Adept is §22's "typical generation 3-5" rung and it was arithmetically
    // impossible: the highest expressed power in eight runs was 17.6 against a
    // gate of 25, and the most books anybody read was one.
    expect(adepts, `${reached.join(',')}`).toBeGreaterThan(1);
    // And nothing hands a chronicler-driven house a Demigod. The top of the
    // ladder is meant to be built for, over centuries, on purpose — a player
    // who never opens the table should not arrive there by waiting.
    expect(reached.every((r) => rungIndex(r) < rungIndex('demigod')), reached.join(','))
      .toBe(true);
  });
  it('remembers the high-water mark after the man holding it dies', () => {
    const g = newGame(loadContent(), { seed: 3003, decider: 'chronicler' });
    g.advance(1000);
    const w = g.ctx.world;
    expect(rungIndex(w.ascension.best)).toBeGreaterThanOrEqual(rungIndex(w.ascension.rung));
    if (w.ascension.best !== 'none') {
      expect(w.ascension.reachedAt[w.ascension.best]).toBeGreaterThan(1042);
    }
  });
  it('puts the rung on the view, which is the whole point of building it', () => {
    const g = newGame(loadContent(), { seed: 3000, decider: 'chronicler' });
    g.advance(300);
    const v = g.view();
    expect(RUNGS).toContain(v.ascension.rung as never);
    expect(v.ascension.title.length).toBeGreaterThan(2);
  });
});
