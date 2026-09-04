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

    // The batch has to be able to carry the claim: sixteen refusals in one
    // seed to 1400 became zero in four seeds to 2042, over four hundred cards.
    expect(openCards).toBeGreaterThan(300);
    expect(refusals).toBe(0);
    expect(deadHands).toBe(0);
  });
});
