import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { newGame } from '@ed/core';

const content = loadContent();

/**
 * THE TALE LAYER, OVER FULL RUNS.
 *
 * `tales.test.ts` proves the mechanism: a tale is born when its event fires,
 * starts circulating on its own clock, and mutates on another. None of that
 * said whether any of it happens in a game somebody plays.
 *
 * It needed saying, because this layer spent its whole life built and
 * unreachable — `world.tales` circulating correctly, saved faithfully, and
 * `SessionView` carrying no field for it, so no client could see a word. That
 * is invisible to every unit test in the repo and to the digest, because
 * everything was working. Only "does it reach the player, in a run" catches
 * it, which is the shape every `*.slow.test.ts` in this repo is for.
 *
 * Measured before writing: 18-26 tales circulating at 2042 across eight runs,
 * and all 32 authored tales reached by at least one of them. The bands below
 * are deliberately wider than that — this is a test that the layer LIVES, not
 * a pin on today's content, which changes every time a tale is authored.
 */
describe('tales reach a played run', () => {
  const SEEDS = [1000, 1001, 1002];

  function run(seed: number) {
    const game = newGame(content, { seed, decider: 'chronicler' });
    game.advance(1000);
    return game.view();
  }

  it('leaves every run with accounts in circulation', () => {
    for (const seed of SEEDS) {
      const tales = run(seed).tales;
      expect(tales.length, `seed ${seed} ended a thousand years with nothing being said`)
        .toBeGreaterThan(5);
    }
  });

  it('circulates a broad share of what is authored, not the same few', () => {
    const seen = new Set<string>();
    for (const seed of SEEDS) for (const t of run(seed).tales) seen.add(t.id);

    // A third of the corpus across three runs. Far under the ~100% measured,
    // and far over the "one arc's tales and nothing else" that a selection bug
    // would leave behind.
    expect(seen.size, 'the same handful of tales circulate in every run')
      .toBeGreaterThan(content.tales.length / 3);
  });

  it('puts contradicting accounts of one event in front of the player at once', () => {
    // The whole point of the layer: not that tales exist, but that two of them
    // about the SAME event stand together, disagreeing, with nobody ruling.
    const contested = SEEDS.map((seed) => {
      const byEvent = new Map<string, Set<string>>();
      for (const t of run(seed).tales) {
        const biases = byEvent.get(t.about) ?? new Set<string>();
        biases.add(t.bias);
        byEvent.set(t.about, biases);
      }
      return [...byEvent.values()].filter((b) => b.size > 1).length;
    });

    expect(
      contested.some((n) => n > 0),
      'no run ever showed the player two accounts of one event that disagree',
    ).toBe(true);
  });

  it('names a teller and a bias on every account it shows', () => {
    for (const seed of SEEDS) {
      for (const t of run(seed).tales) {
        expect(t.teller.length, `${t.id} circulates with no teller`).toBeGreaterThan(0);
        expect(t.bias.length, `${t.id} circulates with no bias`).toBeGreaterThan(0);
      }
    }
  });

  it('never leaks the authored accuracy into a played run', () => {
    for (const seed of SEEDS) {
      for (const t of run(seed).tales) {
        expect(Object.keys(t)).not.toContain('accuracy');
      }
    }
  });
});
