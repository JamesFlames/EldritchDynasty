import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { newGame } from '@ed/core';

const bundle = loadContent();

/**
 * ISSUE #83, PLAYED — the claim `match.test.ts` cannot make from a built world.
 *
 * The three fast tests over there assert the MECHANISM: a card closes when its
 * person marries, a hand is withdrawn when its subject does, the rest of the
 * docket is re-read when one hand spends another's subject. Each of them
 * builds the state it means, which is the only sane way to reach a widow.
 *
 * None of them can say the window is actually shut. That is a claim about
 * every path the simulation takes between dealing a hand and answering it —
 * `arcs`, `ambient` and the frame all run after `marriage` parks a hand, and
 * any of them can kill a promised bride. The only way to know is to play the
 * games and try every card.
 *
 * Before the fix, seed 7 alone to 1400: fifteen hands taken and sixteen
 * refusals of cards drawn `available: true`, five of them hands where every
 * single card refused.
 */
describe('the marriage panel, played', () => {
  it('never refuses an open card, over four seeds played to the term', () => {
    let openCards = 0;
    let refusals = 0;
    let deadHands = 0;

    for (const seed of [7, 11, 23, 41]) {
      const g = newGame(bundle, { seed, startYear: 1042 });
      for (let turn = 0; turn < 4000; turn += 1) {
        const pending = g.pending;
        if (!pending.length) {
          g.advance(1);
          if (g.view().year >= 2042 && !g.pending.length) break;
          continue;
        }
        const d = pending[0]!;
        if (d.kind !== 'match') { g.letHimDecide(); continue; }

        const open = d.cards.filter((c) => c.available);
        openCards += open.length;
        if (!open.length) deadHands += 1;
        let took = false;
        for (const c of open) {
          if (g.match(d.id, c.id).ok) { took = true; break; }
          refusals += 1;
        }
        if (!took) g.declineHand(d.id);
      }
    }

    // THE BATCH HAS TO BE ABLE TO CARRY THE CLAIM, and this floor is the
    // claim's denominator rather than a measurement of it.
    //
    // Zero refusals means nothing without knowing how many cards were tried.
    // At 200 the rule of three puts the 95% upper bound on the refusal rate
    // at about 1.5%, against sixteen refusals in ONE seed to 1400 before the
    // fix — which is the comparison this test exists to make.
    //
    // It was 300, against a measured 412, and a content drop that re-rolled
    // the draws took it to 257 and failed the build on a number nobody was
    // asserting anything about. A floor set just under a measurement is a
    // measurement in disguise; this one is set where the statistics stop
    // working.
    expect(openCards).toBeGreaterThan(200);
    expect(refusals).toBe(0);
    expect(deadHands).toBe(0);
  });
});
