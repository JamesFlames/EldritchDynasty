import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { asId, indexContent, type HouseId } from '@ed/schema';
import { place, testWorld } from './testing.js';
import { fragility, thinLine } from './people/demography.js';
import type { SimCtx } from './world.js';

const content = indexContent(loadContent());

/**
 * A SMALL LINE HAS NO BUFFER (issue #42).
 *
 * `broken_line` is one of §23's five endings and fired in 0 of 60 runs. The
 * reason was not that the game is kind: it is that it had no tail. The blood's
 * low-water mark is 3 at the worst and 4 at the median, both at the FOUNDING,
 * and from there it climbs to about 46 — one window in a thousand years, and
 * nothing sharpened it.
 *
 * A large family absorbs a bad year. A family of four has nobody else. These
 * assert the mechanism rather than a rate, because the rate is a batch
 * statistic and lives in `gate:endings`.
 */
describe('a line with nobody left to lose', () => {
  /**
   * A house that HAS n of its blood alive, and once had `was`.
   *
   * The two are different questions and the whole point of the mechanism: a
   * founding house of three is not in trouble, and a house of three that used
   * to be thirty is the thing §23's `broken_line` is about. `bloodHighWater`
   * is what tells them apart, so a fixture that did not set it measured a
   * brand-new house every time.
   */
  function lineOf(n: number, was = 20): SimCtx {
    const ctx = testWorld(content);
    // Clear the founding blood, then build the line the test means.
    for (const p of [...ctx.world.people.living()]) {
      if (p.membership.some((m) => m.kind === 'blood')) {
        ctx.world.people.kill(p.id, ctx.world.year, 'making room for the fixture');
      }
    }
    for (let i = 0; i < n; i++) {
      place(ctx, { sex: i % 2 ? 'male' : 'female', age: 30, name: `Line ${i}` });
    }
    ctx.world.bloodHighWater = Math.max(n, was);
    return ctx;
  }

  it('leaves a house with a buffer completely alone', () => {
    const ctx = lineOf(20);
    const p = ctx.world.people.living().find((q) => q.name === 'Line 1')!;
    expect(fragility(ctx, p)).toBe(1);
    expect(thinLine(ctx)).toBe(1);
  });

  /**
   * A YOUNG LINE IS NOT A DYING ONE. Against a flat threshold this was the
   * founding century of every run in the game, and the measured cost was the
   * middle of the distribution rather than the tail — the batch lost a fifth
   * of its grudges and an already-marginal outcome stopped firing at all.
   */
  it('does not press a house that is small because it is new', () => {
    const young = lineOf(3, 3);
    const p = young.world.people.living().find((q) => q.name === 'Line 1')!;
    expect(fragility(young, p)).toBe(1);
    expect(thinLine(young)).toBe(1);

    // The same three people, in a house that used to be thirty.
    const fallen = lineOf(3, 30);
    const q = fallen.world.people.living().find((r) => r.name === 'Line 1')!;
    expect(fragility(fallen, q)).toBeGreaterThan(1);
    expect(thinLine(fallen)).toBeLessThan(1);
  });

  it('presses harder the fewer of the blood are left', () => {
    const wide = lineOf(9);
    const narrow = lineOf(2);
    const pw = wide.world.people.living().find((q) => q.name === 'Line 1')!;
    const pn = narrow.world.people.living().find((q) => q.name === 'Line 1')!;
    expect(fragility(narrow, pn)).toBeGreaterThan(fragility(wide, pw));
    expect(fragility(wide, pw)).toBeGreaterThan(1);
  });

  /**
   * A retainer dying is a sad thing that happens to a household, not a thing
   * that can end a family — and the household is floored near ten forever by
   * a recurring cast that is re-minted, so reading it would make this inert.
   */
  it('is a fact about the blood, not about the household', () => {
    const ctx = lineOf(2);
    const hired = place(ctx, { sex: 'male', age: 30, name: 'The Cook' });
    hired.membership = [{ house: asId<HouseId>(ctx.world.playerHouse), kind: 'retainer', from: ctx.world.year }];
    expect(fragility(ctx, hired)).toBe(1);
  });

  // Killing the last of a line does nothing if the last of a line breeds back
  // at full rate: measured, low-water reached 1 in 40 runs and none ended.
  it('also makes a dying house a poor match, which is the half that closes it', () => {
    expect(thinLine(lineOf(2))).toBeLessThan(1);
    expect(thinLine(lineOf(2))).toBeLessThan(thinLine(lineOf(3)));
  });
});
