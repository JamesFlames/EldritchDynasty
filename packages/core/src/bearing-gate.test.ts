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
function run(carriage: Carriage, carried: number, rung: number): BearingRun {
  n += 1;
  return {
    seed: 4000 + n,
    carriage,
    peak: carried,
    carried,
    final: carried,
    hands: 40,
    cards: 2.5,
    declined: 10,
    kin: 5,
    best: 'adept',
    rung,
    warned: 2,
    unheard: 2,
    respect: 3,
    clauses: 8,
    household: 60,
    regencyYears: 0,
  };
}

/** Nine runs across the whole bearing range, with the rung set by the caller. */
function batch(rungAt: (carried: number) => number): BearingRun[] {
  const carriages: Carriage[] = ['unattended', 'modest', 'proud'];
  return [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
    .map((carried, i) => run(carriages[i % 3]!, carried, rungAt(carried)));
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

  it('reports the spread rather than judging it, and says whose job that is', () => {
    const { lines } = verdictOver(batch((c) => (c > 0.6 ? 3 : 2)));
    const spread = lines.find((l) => l.includes('spread:'));
    expect(spread, 'the open half of the acceptance is not reported at all').toBeTruthy();
    expect(spread).toContain('stage 3');
  });
});
