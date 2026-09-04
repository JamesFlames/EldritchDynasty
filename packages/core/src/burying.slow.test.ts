import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { newGame } from '@ed/core';

const bundle = loadContent();

/**
 * THE LANE, PLAYED (issue #71).
 *
 * *"An authored bury nobody's run ever reaches is invariant 11 with a scene
 * around it."* The engine half is asserted in `burying.test.ts` against states
 * built by hand; none of that says the scenes fire, or that a house playing
 * for it can actually clear what it is carrying.
 *
 * So this plays two policies over the same six seeds and diffs them. The
 * embellish-everything policy is deliberate: it is the house §6 ends on — the
 * one that "arrives exalted, revered, and unable to prove a single thing it
 * needs to prove" — and it is the house the bill is for.
 */
const BURYING = new Set([
  'the_cross_reference',
  'somewhere_quiet_to_be_old',
  'a_second_hand_that_agrees',
  'something_the_church_wants_more',
]);

const SEEDS = [7, 11, 23, 41, 77, 909];

function play(bury: boolean) {
  let scenes = 0;
  let buried = 0;
  let open = 0;
  let unsupportable = 0;

  for (const seed of SEEDS) {
    const g = newGame(bundle, { seed, startYear: 1042 });
    for (let turn = 0; turn < 14000 && g.view().year < 2042; turn += 1) {
      const d = g.pending[0];
      if (!d) {
        if (g.view().namesWanted.length) g.keepSuggestedNames();
        else g.advance(1);
        continue;
      }
      if (d.kind === 'choice' && BURYING.has(d.event.id) && d.choicesAreOpen) {
        scenes += 1;
        // Index 0 is the act, index 1 is declining it. Both are authored to
        // be available always, so this is a policy and not a coin.
        const take = d.choices[bury ? 0 : 1];
        if (take?.available) { g.choose(d.id, take.id, {}); continue; }
      }
      // The house that lies about everything. It is the one the bill is for.
      if (d.kind === 'record') { g.record(d.id, 'embellish'); continue; }
      g.letHimDecide();
    }

    // Arriving at the term is not being read: the ledger closes on the step
    // AFTER 2042 arrives, and `reckoning` does not exist until it has.
    for (let k = 0; k < 40 && !g.epilogue(); k += 1) {
      if (g.pending.length) { g.letHimDecide(); continue; }
      if (g.view().namesWanted.length) { g.keepSuggestedNames(); continue; }
      g.advance(1);
    }

    for (const d of g.ctx.world.discrepancies.values()) {
      if (d.state === 'buried') buried += 1;
      else if (d.state === 'open') open += 1;
    }
    unsupportable += g.epilogue()?.reckoning.unsupportable ?? 0;
  }

  const n = SEEDS.length;
  return {
    scenes: scenes / n, buried: buried / n, open: open / n, unsupportable: unsupportable / n,
  };
}

describe('burying is an act a house can actually take', () => {
  const spends = play(true);
  const does_not = play(false);

  it('puts the scenes in front of a house that has something to bury', () => {
    // Gated on `openDiscrepancies >= 1`, so a house with nothing carried is
    // never offered one — which is why the spending column sees FEWER scenes
    // than the declining one. It runs out of things to bury.
    expect(does_not.scenes).toBeGreaterThan(10);
    expect(spends.scenes).toBeGreaterThan(5);
    expect(spends.scenes).toBeLessThan(does_not.scenes);
  });

  it('clears what the house is carrying when the house pays for it', () => {
    expect(spends.buried, `${spends.buried} vs ${does_not.buried}`)
      .toBeGreaterThan(does_not.buried * 4);
    expect(spends.open, `${spends.open} open vs ${does_not.open}`)
      .toBeLessThan(does_not.open / 2);
  });

  /**
   * The bill itself. §29.3's third bite discounts the rung the book attests by
   * what the book cannot hold up, and this is that number: 10.5 for a house
   * that lied about everything and never answered for it, 0.5 for the same
   * house spending on the answer.
   */
  it('answers the bill it is supposed to answer', () => {
    expect(does_not.unsupportable, 'the lying house was not carrying a bill at all')
      .toBeGreaterThan(4);
    expect(spends.unsupportable).toBeLessThan(does_not.unsupportable / 3);
  });
});
