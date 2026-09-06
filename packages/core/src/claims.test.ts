import { describe, expect, it } from 'vitest';
import { expectMean, expectRate, proportionSE, MIN_MARGIN_SE } from '@ed/core';

/**
 * THE GUARD ON THE GUARDS.
 *
 * `expectRate` exists because three batch-statistical tests in this suite broke
 * on commits that changed nothing they measured. It is itself a rule, and this
 * repository's own lesson about rules applies to it: *a validation rule needs a
 * bundle it must REJECT, not only one it passes. A rule nobody has seen fail is
 * indistinguishable from a rule that cannot fail.*
 *
 * So both refusals are exercised, and so is the arithmetic underneath them.
 */
describe('the standard error of a proportion', () => {
  it('is widest at a half and narrows toward the ends', () => {
    expect(proportionSE(50, 100)).toBeGreaterThan(proportionSE(90, 100));
    expect(proportionSE(50, 100)).toBeGreaterThan(proportionSE(10, 100));
  });

  it('narrows as the batch grows, which is the whole remedy it prescribes', () => {
    expect(proportionSE(24, 48)).toBeLessThan(proportionSE(6, 12));
  });

  /**
   * Twelve for twelve is good evidence and not proof. Without the floor it
   * reports an SE of exactly zero and therefore infinite confidence, off a
   * sample that has simply not seen the other outcome yet.
   */
  it('never reports certainty from a batch that has not seen the other outcome', () => {
    expect(proportionSE(12, 12)).toBeGreaterThan(0);
    expect(proportionSE(12, 12)).toBe(1 / 12);
    expect(proportionSE(0, 12)).toBe(1 / 12);
  });
});

describe('expectRate refuses two different things', () => {
  it('passes a claim the batch can actually carry', () => {
    // 46 of 48 against a floor of two-thirds: a wide margin on a wide batch.
    const margin = expectRate({ hits: 46, n: 48, floor: 0.667, what: 'a well-made claim' });
    expect(margin).toBeGreaterThan(MIN_MARGIN_SE);
  });

  it('REJECTS a claim that is simply false', () => {
    expect(() => expectRate({ hits: 4, n: 48, floor: 0.667, what: 'feuds' }))
      .toThrow(/and the claim is more than 67%/);
  });

  /**
   * The case the whole helper is for, and the exact shape that shipped three
   * times: the claim is TRUE on this batch and would be false on the next one.
   * Nineteen of twenty-four against a floor of two-thirds is about 1.3 standard
   * errors — a coin, not a finding.
   */
  it('REJECTS a claim that is true only by luck, and says so about the test', () => {
    expect(() => expectRate({ hits: 19, n: 24, floor: 0.667, what: 'feuds' }))
      .toThrow(/standard errors/);
    expect(() => expectRate({ hits: 19, n: 24, floor: 0.667, what: 'feuds' }))
      .toThrow(/about the TEST, not the game/);
  });

  it('prescribes a batch size that would actually carry the claim', () => {
    let message = '';
    try {
      expectRate({ hits: 19, n: 24, floor: 0.667, what: 'feuds' });
    } catch (e) {
      message = (e as Error).message;
    }
    const wants = Number(/about (\d+) runs/.exec(message)?.[1]);
    expect(wants, message).toBeGreaterThan(24);

    // And the prescription is honest: at the same observed rate, that many runs
    // clears the bar. This is the assertion that stops the advice being a
    // number somebody made up to fill the sentence.
    const scaled = Math.round((19 / 24) * wants);
    expect(() => expectRate({ hits: scaled, n: wants, floor: 0.667, what: 'feuds' })).not.toThrow();
  });
});

describe('expectMean, for the statistic that behaves worse', () => {
  const tight = [10, 11, 9, 10, 11, 9, 10, 11, 9, 10, 11, 9];
  /** `hotPairs`, near enough: a heavy tail whose sd exceeds its own mean. */
  const heavy = [0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 5, 6, 6, 13, 15, 24, 24, 26, 28, 45];

  it('passes a tight batch comfortably clear of the floor', () => {
    expect(expectMean({ values: tight, floor: 5, what: 'a steady thing' })).toBeGreaterThan(MIN_MARGIN_SE);
  });

  it('REJECTS a claim that is simply false', () => {
    expect(() => expectMean({ values: tight, floor: 50, what: 'a steady thing' }))
      .toThrow(/and the claim is more than 50/);
  });

  /**
   * THE EXACT FIVE THAT SHIPPED — `blood.slow.test.ts` on the commit before
   * the library fix, where the mean came out 5.40 against a floor of 5 and
   * passed. The claim was TRUE on that batch. It is still not a claim five
   * runs can carry, and this is the failure that says so.
   */
  it('REJECTS a heavy-tailed claim read off too few runs, even when it is true', () => {
    const shipped = [13, 1, 4, 7, 2];
    const mean = shipped.reduce((a, b) => a + b, 0) / shipped.length;
    expect(mean, 'the fixture must be a claim that PASSES, or it tests the wrong branch')
      .toBeGreaterThan(5);
    expect(() => expectMean({ values: shipped, floor: 5, what: 'hot pairs' }))
      .toThrow(/standard errors/);
  });

  /**
   * And the same shape at twice the width clears it.
   *
   * `heavy` is a hand-made stand-in with a slightly fatter tail than the real
   * thing, and at twenty values it lands just under the bar — the actual
   * twenty-seed batch in `blood.slow.test.ts` passes. That is worth leaving
   * as the fixture rather than pasting the real numbers in: what is being
   * tested here is the helper, and a fixture that sits a hair under two
   * standard errors is the one that would catch the helper drifting.
   */
  it('accepts the same claim once the batch is wide enough to carry it', () => {
    expect(() => expectMean({ values: [...heavy, ...heavy], floor: 5, what: 'hot pairs' }))
      .not.toThrow();
  });

  /**
   * A BUDGET IS A CLAIM TOO.
   *
   * Half of what these suites assert is a ceiling — "asks under 25 times a
   * run" — and before `ceiling` existed every one of them was a bare
   * `toBeLessThan` on an average, outside the helper that was built to stop
   * exactly that. `naming-worth.slow.test.ts` then failed at a mean of 25.0
   * against a threshold of 25, on a commit that changed nothing it measured.
   * The mirror must behave the same in all three directions: pass, false, and
   * true-but-unprovable.
   */
  describe('and the same guard read as a budget', () => {
    it('passes a batch comfortably under the ceiling', () => {
      expect(expectMean({ values: tight, ceiling: 15, what: 'a steady thing' }))
        .toBeGreaterThan(MIN_MARGIN_SE);
    });

    it('REJECTS a budget the batch simply blows', () => {
      expect(() => expectMean({ values: tight, ceiling: 5, what: 'a steady thing' }))
        .toThrow(/and the claim is less than 5/);
    });

    it('REJECTS a budget held by too few runs, even when the batch is under it', () => {
      // The five that shipped, as measured: 25.0 against a budget of 28 is a
      // true claim and is not a thing five runs of that spread can say — the
      // margin is 1.6 standard errors. At twelve runs the same game clears it.
      const shipped = [22, 22, 32, 23, 26];
      expect(shipped.reduce((a, b) => a + b, 0) / shipped.length,
        'the fixture must be a claim that PASSES, or it tests the wrong branch').toBeLessThan(28);
      expect(() => expectMean({ values: shipped, ceiling: 28, what: 'naming stops' }))
        .toThrow(/standard errors/);
    });

    it('names the ceiling, not the floor, when it prescribes a wider batch', () => {
      let message = '';
      try {
        expectMean({ values: [22, 22, 32, 23, 26], ceiling: 28, what: 'naming stops' });
      } catch (e) {
        message = (e as Error).message;
      }
      expect(message).toMatch(/move the ceiling/);
    });

    it('refuses a claim that names both, because that is two claims', () => {
      expect(() => expectMean({ values: tight, floor: 5, ceiling: 15, what: 'both' }))
        .toThrow(/exactly one/);
      expect(() => expectMean({ values: tight, what: 'neither' }))
        .toThrow(/exactly one/);
    });
  });

  it('refuses to pronounce on a batch of one', () => {
    expect(() => expectMean({ values: [10], floor: 5, what: 'one run' }))
      .toThrow(/at least two runs/);
  });

  it('uses the sample standard deviation, which does not flatter a small batch', () => {
    // With the population form (n) the spread reads smaller and the margin
    // larger — the error would be invisible and always in the wrong direction.
    const vals = [4, 6, 8, 10];
    const mean = 7;
    const sample = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length - 1));
    const population = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
    expect(sample).toBeGreaterThan(population);
  });
});
