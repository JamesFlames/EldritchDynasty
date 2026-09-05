import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { newGame } from '@ed/core';
import { expectMean } from './testing.js';

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

/**
 * Sixteen, not six. The claims below are PAIRED differences held to
 * `expectMean`'s two standard errors, and six runs of a quantity whose
 * standard deviation is comparable to its own mean cannot carry one. Six was
 * enough while the effect was 95%; it is not enough now that the effect is a
 * quarter, which is the honest size of it.
 */
const SEEDS = [7, 11, 23, 41, 77, 909, 131, 227, 313, 419, 523, 631, 739, 827, 941, 1051];

interface Run { buried: number; open: number; unsupportable: number }

function play(bury: boolean) {
  let scenes = 0;
  let buried = 0;
  let open = 0;
  let unsupportable = 0;
  const perSeed: Run[] = [];

  for (const seed of SEEDS) {
    const before = { buried, open, unsupportable };
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
    perSeed.push({
      buried: buried - before.buried,
      open: open - before.open,
      unsupportable: unsupportable - before.unsupportable,
    });
  }

  const n = SEEDS.length;
  return {
    scenes: scenes / n, buried: buried / n, open: open / n, unsupportable: unsupportable / n,
    // Per seed, so the two columns can be diffed WITHIN a world rather than
    // between two column means. Both policies play the same sixteen worlds and
    // differ in one choice, so the pairing cancels almost all of the variance
    // that the run itself contributes and what is left is the act.
    perSeed,
  };
}

describe('burying is an act a house can actually take', () => {
  const spends = play(true);
  const does_not = play(false);

  /**
   * THESE THRESHOLDS WERE REWRITTEN, AND THE REASON IS THE POINT OF THE FILE.
   *
   * The first cut asserted the lane clears 95% of the bill — `buried` four
   * times the declining column, `open` under half, `unsupportable` under a
   * third. Every one of those passed. All of them were measuring the bug.
   *
   * `gate:bearing`, seed set 4000+13i, 60 runs a column, found it. The top bin
   * is the house that carried itself proudly and embellished every block, and
   * across the commit that added this lane it went:
   *
   *     rungs reached      2.43 -> 2.43     it climbed exactly as high
   *     rungs PROVED       2.08 -> 2.43     and could suddenly prove all of it
   *     rungs withheld     0.35 -> 0.00
   *     unsupportable     15.4  ->  2.3
   *
   * A 95% answer to the bill is not an answer, it is an amnesty, and it took
   * §6's thesis sentence with it: "exalted, revered, and unable to prove a
   * single thing it needs to prove" stopped being a state the game could
   * reach. So the RATION was cut — three of the four scenes happen once each,
   * the man from Cawdry is a trade on a cooldown — and these assertions now
   * describe what the lane is FOR rather than what it was doing.
   *
   * The corrected shape, measured: a house that spends on burying every chance
   * it gets puts about five lies down across a thousand years and arrives
   * still owing about three quarters of the bill.
   */
  it('puts the scenes in front of a house that has something to bury', () => {
    // Gated on `openDiscrepancies >= 1`, so a house with nothing carried is
    // never offered one — which is why the spending column sees FEWER scenes
    // than the declining one. It runs out of things to bury.
    expect(does_not.scenes).toBeGreaterThan(4);
    expect(spends.scenes).toBeGreaterThan(3);
    expect(spends.scenes).toBeLessThan(does_not.scenes);
  });

  /**
   * THE ACT REACHES REAL LIES. This is the half that must never soften: a
   * `bury` that cannot reach a Discrepancy created at play time is invariant
   * 11 with a scene around it, and no ration changes that.
   */
  it('buries what a declining house never touches', () => {
    expectMean({
      values: spends.perSeed.map((r, i) => r.buried - does_not.perSeed[i]!.buried),
      floor: 2,
      what: 'lies put down, spending house minus declining, paired by seed',
    });
  });

  /**
   * THE BILL MOVES, AND DOES NOT VANISH. Both directions are asserted, because
   * only asserting the first is how the amnesty shipped.
   *
   * §29.3's third bite discounts the rung the book attests by what the book
   * cannot hold up. A house that lied about everything and never answered for
   * it carries about fifteen; the same house spending on every answer it is
   * offered carries about eleven. The act is worth roughly a quarter of the
   * bill, and the remaining three quarters is the game.
   */
  it('answers part of the bill, and only part', () => {
    expect(does_not.unsupportable, 'the lying house was not carrying a bill at all')
      .toBeGreaterThan(8);

    const paid = spends.perSeed.map((r, i) => does_not.perSeed[i]!.unsupportable - r.unsupportable);
    expectMean({
      values: paid,
      floor: 1,
      what: 'bill answered by burying, paired by seed',
    });

    // AND THE CEILING, which is the assertion this file did not have and the
    // one that would have caught the regression here instead of in a gate two
    // issues away. A lane that clears most of the bill has stopped being an
    // act and become an apology, and §29.4's rule 5 forbids exactly that.
    expect(spends.unsupportable, `${spends.unsupportable} left of ${does_not.unsupportable}`)
      .toBeGreaterThan(does_not.unsupportable * 0.5);
  });
});
