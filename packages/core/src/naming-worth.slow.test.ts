import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { newGame } from '@ed/core';

const bundle = loadContent();

/**
 * THE RATE (issue #62), played the way `run.slow.test.ts` plays a run.
 *
 * The measurement that opened the issue: **188.8 naming stops a run, 37.1% of
 * everything the player was ever asked**, and 205.6 names typed. The single
 * most frequent act in a game about who marries whom and what the book says
 * was typing a name into a text field for somebody who died unremarked.
 *
 * The rules themselves are asserted in `naming-worth.test.ts` against states
 * built by hand, because a rule that can never fire is invisible in a rate —
 * #62 asks for a twin rule and this simulation cannot bear twins, which no
 * amount of playing would ever have said.
 */
describe('naming is a reward, not a form', () => {
  const seeds = [7, 11, 23, 41, 77];
  const counts: number[] = [];
  const reasons = new Set<string>();

  for (const seed of seeds) {
    const g = newGame(bundle, { seed, startYear: 1042 });
    let asked = 0;
    for (let turn = 0; turn < 8000 && g.view().year < 2042; turn += 1) {
      if (g.pending.length) { g.letHimDecide(); continue; }
      const wanted = g.view().namesWanted;
      if (wanted.length) {
        asked += wanted.length;
        for (const c of wanted) reasons.add(c.because.replace(/\d+/g, 'N'));
        g.keepSuggestedNames();
        continue;
      }
      g.advance(1);
    }
    counts.push(asked);
  }

  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;

  it('asks under 25 times a run, down from 188.8', () => {
    expect(mean, `${counts.join(', ')} — mean ${mean.toFixed(1)}`).toBeLessThan(25);
  });

  /**
   * And still asks. A predicate that returned `undefined` for everybody would
   * sail through the assertion above and delete one of the four verbs, which
   * is the failure this repository actually has.
   */
  it('still asks about somebody, in every run', () => {
    expect(Math.min(...counts)).toBeGreaterThan(5);
  });

  it('gives every prompt a reason the player can read', () => {
    // Several distinct ones, not one rule doing all the work — a single
    // reason across a thousand years is the form again, wearing a label.
    expect(reasons.size).toBeGreaterThan(2);
    for (const r of reasons) expect(r.length).toBeGreaterThan(8);
  });
});
