import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import {
  REMEMBERED_AFTER, bearingOf, dealMatch, makeRng, marketAppetite, noteBearing, place,
  testWorld, tickBearing,
} from '@ed/core';

const content = loadContent();

/**
 * BEARING (concept §29, issue #45) — how the house carries what it has.
 *
 * Every test here is about one of the five rules the design is built to keep,
 * because those are the things that make it a moral rather than a difficulty
 * setting, and every one of them is invisible from outside if it breaks.
 */
describe('bearing is read off acts, not off fortune', () => {
  it('reads zero for a house that has done nothing', () => {
    const ctx = testWorld(content, 7001);
    expect(bearingOf(ctx).score).toBe(0);
  });

  it('rises with the acts the world remembers', () => {
    const ctx = testWorld(content, 7002);
    ctx.world.year = 1042;
    for (let i = 0; i < 12; i++) noteBearing(ctx, 'refused_a_hand');
    ctx.world.year = 1042 + REMEMBERED_AFTER + 50;
    const after = bearingOf(ctx);
    expect(after.carriage).toBeGreaterThan(0);
    expect(after.score).toBeGreaterThan(0);
  });

  /**
   * RULE 3, and the one that makes this a moral rather than a rule the player
   * learns. A consequence that lands in the same decade as its cause is a
   * price tag; two generations later it is a thing the house inherited.
   */
  it('charges nothing at all for an act taken this year', () => {
    const ctx = testWorld(content, 7003);
    for (let i = 0; i < 40; i++) noteBearing(ctx, 'refused_a_hand');
    expect(bearingOf(ctx).carriage).toBe(0);

    // And still nothing the year before it is remembered.
    ctx.world.year += REMEMBERED_AFTER - 1;
    expect(bearingOf(ctx).carriage).toBe(0);
    ctx.world.year += 1;
    expect(bearingOf(ctx).carriage).toBeGreaterThan(0);
  });

  /**
   * RULE 5: reversible by act, never by apology. A house that stops does not
   * atone — the ledger simply stops growing while the run's length does, and
   * the reading falls out from under it.
   */
  it('falls when the house stops, without anything being undone', () => {
    const ctx = testWorld(content, 7004);
    for (let i = 0; i < 16; i++) noteBearing(ctx, 'refused_a_hand');
    ctx.world.year = 1042 + REMEMBERED_AFTER + 100;
    const proud = bearingOf(ctx).carriage;

    // Three more centuries, and not one more act.
    ctx.world.year += 300;
    expect(bearingOf(ctx).carriage).toBeLessThan(proud);
    expect(ctx.world.bearing.acts).toHaveLength(16);
  });

  it('weighs a refused hand heavier than a page written larger', () => {
    const loud = testWorld(content, 7005);
    const quiet = testWorld(content, 7006);
    for (const [ctx, kind] of [[loud, 'refused_a_hand'], [quiet, 'wrote_it_larger']] as const) {
      for (let i = 0; i < 10; i++) noteBearing(ctx, kind);
      ctx.world.year = 1042 + REMEMBERED_AFTER + 50;
    }
    expect(bearingOf(loud).carriage).toBeGreaterThan(bearingOf(quiet).carriage);
  });

  it('is stored as one reading the year, a client and a condition all share', () => {
    const ctx = testWorld(content, 7007);
    for (let i = 0; i < 20; i++) noteBearing(ctx, 'refused_a_hand');
    ctx.world.year = 1042 + REMEMBERED_AFTER + 100;
    expect(ctx.world.bearing.score).toBe(0);
    const read = tickBearing(ctx);
    expect(ctx.world.bearing.score).toBe(read.score);
  });
});

/**
 * STAGE 2, and the only bite there is meant to be yet: the world stops
 * offering.
 */
describe('the market answers it', () => {
  it('offers as it always did to a house that has kept its head down', () => {
    const ctx = testWorld(content, 7010);
    expect(marketAppetite(ctx)).toBe(1);
  });

  it('offers less as the house is remembered for more', () => {
    const ctx = testWorld(content, 7011);
    for (let i = 0; i < 40; i++) noteBearing(ctx, 'refused_a_hand');
    ctx.world.year = 1042 + REMEMBERED_AFTER + 100;
    tickBearing(ctx);
    expect(marketAppetite(ctx)).toBeLessThan(1);
  });

  /**
   * RULE 2: pride must usually be CORRECT. A hand with nothing on it is not a
   * decision, and a system that can empty the table is a tax the player will
   * find and route around. The house that has carried itself this way still
   * marries — it stops getting to choose.
   */
  it('never empties the table, however the house has carried itself', () => {
    const ctx = testWorld(content, 7012);
    // Straight to the worst reading there is. The acts alone cannot get here —
    // they are 0.6 of the weight — and that is deliberate: a house is read on
    // what it did AND on the halls it left angry and the seat it sat on.
    ctx.world.bearing.score = 1;
    expect(marketAppetite(ctx)).toBe(0);

    const her = place(ctx, { sex: 'female', age: 20, name: 'A Daughter To Marry' });
    const hand = dealMatch(ctx, her, makeRng(7012));
    expect(hand.cards.length, 'a hand with nothing on it is not a decision').toBeGreaterThan(0);
  });

  it('deals a full hand to a house nobody has anything to remember about', () => {
    const ctx = testWorld(content, 7013);
    const her = place(ctx, { sex: 'female', age: 20, name: 'A Daughter To Marry' });
    const open = dealMatch(ctx, her, makeRng(7013));

    ctx.world.bearing.score = 1;
    const thin = dealMatch(ctx, her, makeRng(7013));
    expect(thin.cards.length, 'the world offers a proud house no less than a modest one')
      .toBeLessThan(open.cards.length);
  });
});
