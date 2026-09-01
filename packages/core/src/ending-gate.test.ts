import { describe, expect, it } from 'vitest';
import type { EndingId } from '@ed/schema';
import {
  ALL_ENDINGS, CATASTROPHES, verdictOver, type EndingRun,
} from './tools/ending-gate.js';

/**
 * THE GATE THAT GRADES THE ENDINGS (issue #42).
 *
 * A gate nobody has ever seen fail is indistinguishable from a gate that
 * cannot fail, and this one can never be shown its own failing case by the
 * real bundle: the state it exists to catch is *the shipped game could not be
 * lost*, which is a property of a distribution rather than of any content it
 * could be handed. So the judgement is a pure function over runs, and these
 * hand it both worlds.
 */

function run(ending: EndingId, seed: number): EndingRun {
  return { seed, ending, attested: 'adept', clauses: 8, survivors: 22, lowWater: 11, bloodLeft: 14, bloodLow: 6 };
}

/** A batch shaped like the target: a third catastrophes, all five present. */
function losable(n = 100): EndingRun[] {
  const out: EndingRun[] = [];
  for (let i = 0; i < n; i++) {
    const id: EndingId = i % 10 === 0 ? 'broken_line'
      : i % 10 === 1 ? 'devoured'
        : i % 10 === 2 ? 'unmade'
          : i % 10 === 3 ? 'apotheosis'
            : 'forgotten';
    out.push(run(id, i));
  }
  return out;
}

describe('the ending distribution gate', () => {
  it('passes a batch where the run is genuinely losable', () => {
    const v = verdictOver(losable());
    expect(v.ok, v.lines.join('\n')).toBe(true);
  });

  /**
   * THE STATE THIS ISSUE WAS FILED ABOUT, and the one the shipped game was in:
   * *"zero houses died out... every player-driven run finished with nine of
   * nine clauses... the simulation could not tell them apart."* Every house
   * arriving at the same place is the failure, whichever place it is.
   */
  it('fails a batch where every house arrives at the same place', () => {
    const v = verdictOver(Array.from({ length: 100 }, (_, i) => run('forgotten', i)));
    expect(v.ok).toBe(false);
    expect(v.lines.join('\n')).toMatch(/below the floor/);
  });

  it('fails a batch that cannot be lost at all', () => {
    // All five present, but the catastrophes are a rounding error — "rare and
    // memorable" rather than the recorded one-in-three.
    const runs = Array.from({ length: 200 }, (_, i): EndingRun => (
      i < 3 ? run(CATASTROPHES[i % 3]!, i) : run(i % 2 ? 'forgotten' : 'apotheosis', i)
    ));
    const v = verdictOver(runs);
    expect(v.ok).toBe(false);
    expect(v.lines.join('\n')).toMatch(/not losable enough/);
  });

  it('fails a batch that is a punishment rather than a game', () => {
    const runs = Array.from({ length: 200 }, (_, i): EndingRun => (
      i % 10 < 8 ? run(CATASTROPHES[i % 3]!, i) : run(i % 2 ? 'forgotten' : 'apotheosis', i)
    ));
    const v = verdictOver(runs);
    expect(v.ok).toBe(false);
    expect(v.lines.join('\n')).toMatch(/punishment/);
  });

  /**
   * §29's acceptance clause, which is why `forgotten` is counted separately
   * from the three catastrophes at all: the modest house has to lose too, and
   * differently. A gate that pooled them could not see this batch is wrong.
   */
  it('fails when the Forgotten stops being reachable', () => {
    const runs = Array.from({ length: 200 }, (_, i): EndingRun => (
      i % 3 === 0 ? run(CATASTROPHES[i % 3]!, i) : run(i % 7 === 0 ? 'apotheosis' : 'devoured', i)
    ));
    const v = verdictOver(runs);
    expect(v.ok).toBe(false);
    expect(v.lines.join('\n')).toMatch(/forgotten is below the floor/);
  });

  /**
   * A floor under God would be a gate demanding the rarest thing in the design
   * happen on schedule. §22 calls it the terminal outcome a family has to be
   * built for; a zero there is a finding, and this file is where that is said.
   */
  it('does not demand an apotheosis', () => {
    const runs = losable().map((r) => (r.ending === 'apotheosis' ? run('forgotten', r.seed) : r));
    const v = verdictOver(runs);
    expect(v.ok, v.lines.join('\n')).toBe(true);
    expect(v.lines.join('\n')).toMatch(/apotheosis\s+0/);
  });

  it('asserts nothing but validity on a batch too small to see a distribution', () => {
    const v = verdictOver(Array.from({ length: 12 }, (_, i) => run('forgotten', i)));
    expect(v.ok, 'a CI-sized batch must not pretend to grade a five-way split').toBe(true);
    expect(v.lines.join('\n')).toMatch(/cannot see a five-way distribution/);
  });

  it('prints every authored ending, so a zero is visible rather than absent', () => {
    const text = verdictOver(losable()).lines.join('\n');
    for (const id of ALL_ENDINGS) expect(text).toContain(id);
  });
});
