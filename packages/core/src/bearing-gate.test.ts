import { describe, expect, it } from 'vitest';
import { verdictOver, type BearingRun, type Carriage } from './tools/bearing-gate.js';

/**
 * ISSUE #45'S ACCEPTANCE, AS A JUDGMENT.
 *
 * `gate:bearing` plays 252 thousand-year runs and then makes one reading over
 * them: does the house the world remembers as carrying itself climb higher
 * than the house that kept its head down? Playing that batch is a
 * half-hour instrument, and none of it is what could go wrong with the
 * reading — so the reading is a function over runs, and this hands it two
 * distributions it must tell apart.
 *
 * That split is the whole reason `verdictOver` exists. A gate nobody has
 * watched fail is indistinguishable from a gate that cannot fail, and the
 * ladder gate's trick — hand it a declawed bundle — is not available here:
 * bearing's consequence lives in `marketAppetite`, in the engine, so there is
 * no authored charge to take away.
 */

let n = 0;

/**
 * One synthetic run. Only two of its fields are the subject — how the world
 * came to read the house, and how far up the ladder it got — and the rest are
 * plausible constants, because the reading under test is a comparison of those
 * two across bins and nothing else in the row can move it.
 */
function run(carriage: Carriage, meanCarriage: number, bestRungIndex: number): BearingRun {
  n += 1;
  return {
    seed: 4000 + n,
    carriage,
    peakCarriage: meanCarriage,
    meanCarriage,
    finalCarriage: meanCarriage,
    handsDealt: 40,
    cardsPerHand: 2.5,
    handsDeclined: 10,
    cousinsTaken: 5,
    bestRung: 'adept',
    bestRungIndex,
    warningsHeard: 2,
    warningsWithheld: 2,
    respectTierIndex: 3,
    clausesRecovered: 8,
    householdAtEnd: 60,
    regencyYears: 0,
  };
}

/** Nine runs across the whole bearing range, with the rung set by the caller. */
function batch(rungAt: (meanCarriage: number) => number): BearingRun[] {
  const carriages: Carriage[] = ['unattended', 'modest', 'proud'];
  return [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
    .map((meanCarriage, i) => run(carriages[i % 3]!, meanCarriage, rungAt(meanCarriage)));
}

describe('the bearing gate', () => {
  it('passes a game where the house that carried itself climbed higher', () => {
    // §29 rule 2: pride must usually be CORRECT. Two rungs at the bottom of
    // the range, three at the top.
    const { ok, lines } = verdictOver(batch((c) => (c > 0.6 ? 3 : 2)));
    expect(ok, lines.join('\n')).toBe(true);
  });

  it('fails a game where carrying itself only ever costs the house', () => {
    // The failure the issue names in as many words: *if they are simply
    // worse, this is a difficulty setting and players will play around it
    // rather than feel it.*
    const { ok, lines } = verdictOver(batch((c) => (c > 0.6 ? 1 : 3)));
    expect(ok, `the gate passed a game where pride is a tax:\n${lines.join('\n')}`).toBe(false);
  });

  it('fails a game where the carriage changes nothing at all', () => {
    // Flat is not a moral either. It is a system the player cannot feel, which
    // is what §29 was written to avoid.
    const { ok } = verdictOver(batch(() => 2));
    expect(ok).toBe(false);
  });

  /**
   * The spread is the half of the acceptance nothing has moved yet, so the
   * line that reports it has to say what is still owed — a bare number would
   * read as a result. What is owed has already changed once (stage 3's warning
   * lanes were built and did not move it), so this asserts that the line names
   * a mechanism rather than that it names a particular one; pinning the wording
   * is how this test failed the day the finding was updated.
   */
  it('reports the spread rather than judging it, and says what is still owed', () => {
    const { lines } = verdictOver(batch((c) => (c > 0.6 ? 3 : 2)));
    const spread = lines.find((l) => l.includes('spread:'));
    expect(spread, 'the open half of the acceptance is not reported at all').toBeTruthy();
    expect(spread, 'the spread is reported as a bare number, with nothing said about what it wants')
      .toMatch(/record read back|stage 3|last night/i);
  });
});
