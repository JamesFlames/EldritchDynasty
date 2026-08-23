import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import {
  TUTOR_FEE, TUTOR_GAIN, TUTOR_YEARS, newGame, onTheMarket, order, phase, place, resumeGame,
  testWorld,
} from '@ed/core';

const bundle = loadContent();

/**
 * THE TABLE (`table.ts`) — the verbs a player uses on a turn of their own
 * choosing.
 *
 * Every other verb on the session answers a prompt the simulation raised, and
 * the auction, careers and library phases docketed nothing at all. That
 * deleted §13's headline tension by having the simulation decide both halves
 * of it, and it starved the Ascension Ladder four systems upstream: the most
 * books anybody in a thousand-year run ever finished was ONE, because
 * `beginStudy` was reachable only from an authored effect.
 */
describe('giving the house an order', () => {
  it('pays for a term of tutoring now, and delivers it in eight years', () => {
    const ctx = testWorld(bundle, 7001);
    ctx.world.treasury = 500;
    const child = place(ctx, { sex: 'female', age: 12 });

    const before = ctx.world.treasury;
    expect(order(ctx, { kind: 'tutor', person: child.id, attr: 'mind' }).ok).toBe(true);
    // §13's tension is that the money is gone and the auction is in eleven
    // years. Spent on the day it is ordered, not on completion.
    expect(ctx.world.treasury).toBe(before - TUTOR_FEE);

    const start = ctx.world.year;
    for (let i = 0; i <= TUTOR_YEARS; i++) {
      phase('table', ctx);
      ctx.world.year += 1;
    }
    // Invariant 6: life's changes go in `acquired`. Writing into the phenotype
    // cache looks like it worked until spring.
    expect(child.acquired.mind).toBe(TUTOR_GAIN);
    expect(ctx.world.year).toBeGreaterThan(start);
  });

  it('refuses what the house cannot pay for, and says why', () => {
    const ctx = testWorld(bundle, 7002);
    ctx.world.treasury = -119;
    const child = place(ctx, { sex: 'male', age: 10 });
    const r = order(ctx, { kind: 'tutor', person: child.id, attr: 'mind' });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('crowns');
  });

  it('will not teach a grown man, or a person of another house', () => {
    const ctx = testWorld(bundle, 7003);
    ctx.world.treasury = 900;
    const grown = place(ctx, { sex: 'male', age: 40 });
    expect(order(ctx, { kind: 'tutor', person: grown.id, attr: 'mind' }).ok).toBe(false);
    expect(order(ctx, { kind: 'tutor', person: 'nobody', attr: 'mind' }).ok).toBe(false);
  });

  it('keeps a daughter off the market when told to, and puts her back', () => {
    // §7: every daughter married outward is power leaving the blood forever,
    // and there was no way to decline to spend her.
    const ctx = testWorld(bundle, 7004);
    const daughter = place(ctx, { sex: 'female', age: 18 });
    expect(order(ctx, { kind: 'withhold', person: daughter.id, hold: true }).ok).toBe(true);
    expect(onTheMarket(ctx, daughter)).toBe(false);
    expect(order(ctx, { kind: 'withhold', person: daughter.id, hold: false }).ok).toBe(true);
    expect(onTheMarket(ctx, daughter)).toBe(true);
  });
});

describe('the steward, when the player has not spoken', () => {
  it('gets books off the shelf and into people, which nothing did before', () => {
    const g = newGame(loadContent(), { seed: 3001, decider: 'chronicler' });
    g.advance(1000);
    const best = Math.max(0, ...g.ctx.world.people.all().map((p) => p.spellsKnown.length));
    // It was 1, in every run measured, because study began only from an
    // authored effect and there are a handful of those in 124 templates.
    expect(best, 'nobody in a thousand years read more than one book').toBeGreaterThan(2);
  });

  it('never spends the house money — that is the player\'s decision, not his', () => {
    const ctx = testWorld(bundle, 7005);
    ctx.world.treasury = 1000;
    for (let i = 0; i < 40; i++) {
      phase('table', ctx);
      ctx.world.year += 1;
    }
    expect(ctx.world.treasury).toBe(1000);
  });
});

describe('what the table shows', () => {
  it('names the books, who could read them, and what a term costs', () => {
    const g = newGame(loadContent(), { seed: 3000, decider: 'chronicler' });
    g.advance(400);
    const t = g.table();
    expect(t.tutorFee).toBe(TUTOR_FEE);
    expect(typeof t.canTutor).toBe('boolean');
    expect(t.treasury).toBe(Math.round(g.ctx.world.treasury));
    for (const book of t.shelf) {
      expect(book.name.length).toBeGreaterThan(2);
      for (const r of book.readers) expect(r.name.length).toBeGreaterThan(1);
    }
  });

  it('survives a save and a load with its orders intact', () => {
    const g = newGame(loadContent(), { seed: 7006 });
    g.advance(60);
    const someone = g.ctx.world.people.household(g.ctx.world.playerHouse, g.year)
      .find((p) => g.year - p.born < 20);
    g.ctx.world.treasury = 400;
    if (someone) expect(g.order({ kind: 'tutor', person: someone.id, attr: 'mind' }).ok).toBe(true);
    expect(g.order({ kind: 'bid', ceiling: 350 }).ok).toBe(true);

    const back = resumeGame(g.save(), loadContent());
    expect(back.ctx.world.bidCeiling).toBe(350);
    expect(back.ctx.world.tutoring).toEqual(g.ctx.world.tutoring);
  });
});
