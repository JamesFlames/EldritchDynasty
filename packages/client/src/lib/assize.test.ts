import { describe, expect, it } from 'vitest';
import { needleAt } from './assize.js';

/**
 * THE ONE WAY A GAUGE LIES (issue #51).
 *
 * A needle drawn with the sign flipped is plausible in every screenshot: it
 * sits on the rule, it moves when the player expects movement, and it is wrong
 * every time. Nothing about the page says so, and nothing about the type says
 * so either — both directions are a number between 0 and 100.
 *
 * So the direction is asserted at both ends, by name, against the meaning
 * `assize.pressure` carries on the view: −1 is the world steadying a house it
 * can see is failing, 1 is the world charging one it can see is ahead.
 */
describe('the needle follows the pressure', () => {
  it('puts the world steadying you at the left end', () => {
    expect(needleAt(-1)).toBe(0);
  });

  it('puts the world charging you at the right end', () => {
    expect(needleAt(1)).toBe(100);
  });

  it('centres a world that is not thinking about you', () => {
    expect(needleAt(0)).toBe(50);
  });

  /**
   * The claim the header could not make before: two houses the Assize is
   * treating very differently must be distinguishable without waiting for an
   * exaction. Both of these are `arm: 'resents'` and print the same sentence.
   */
  it('separates two houses the arm alone calls the same thing', () => {
    expect(needleAt(0.95) - needleAt(0.4)).toBeGreaterThan(25);
  });

  it('is monotonic, so the needle never travels against the number', () => {
    const steps = [-1, -0.6, -0.35, 0, 0.35, 0.6, 1].map(needleAt);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]!, `${steps[i]} came before ${steps[i - 1]}`).toBeGreaterThan(steps[i - 1]!);
    }
  });

  /**
   * The view rounds `pressure`, but nothing promises the engine holds it in
   * range. A needle that leaves its own rule is worse than one that pins.
   */
  it('pins rather than running off the rule', () => {
    expect(needleAt(-4)).toBe(0);
    expect(needleAt(4)).toBe(100);
    expect(needleAt(Number.NaN)).toBe(50);
  });
});
