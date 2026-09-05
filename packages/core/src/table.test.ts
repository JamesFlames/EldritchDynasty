import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import {
  DEBT_FLOOR, TUTOR_FEE, TUTOR_GAIN, TUTOR_YEARS, newGame, onTheMarket, order, phase, place,
  resumeGame, testWorld, type TableOrder,
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
/**
 * THE RECEIPT (issue #59).
 *
 * A 120-crown pedigree out of a treasury of 252 was one click with nothing
 * before it and nothing after — the button simply stopped being disabled some
 * time later. §13 means these to hurt ("the money is gone the day it is spent,
 * and the auction is in eleven years"), and a spend the player cannot feel
 * landing does not hurt: it makes the number smaller for reasons they will
 * reconstruct later, wrongly.
 *
 * The receipt is measured around the whole order rather than declared by each
 * case, so what this really guards is that no order can spend the house's
 * money silently — including the ones nobody has written yet.
 */
describe('what an order says it cost', () => {
  it('reports the price and what is left, on an order that charges', () => {
    const ctx = testWorld(bundle, 7101);
    ctx.world.treasury = 500;
    const child = place(ctx, { sex: 'female', age: 12 });

    const result = order(ctx, { kind: 'tutor', person: child.id, attr: 'mind' });
    expect(result.ok).toBe(true);
    expect(result.spent).toBe(TUTOR_FEE);
    expect(result.left).toBe(500 - TUTOR_FEE);
    expect(result.left).toBe(Math.round(ctx.world.treasury));
  });

  it('says nothing about an order that costs nothing', () => {
    const ctx = testWorld(bundle, 7102);
    ctx.world.treasury = 500;
    const daughter = place(ctx, { sex: 'female', age: 19 });

    const result = order(ctx, { kind: 'withhold', person: daughter.id, hold: true });
    expect(result.ok).toBe(true);
    // Not zero — absent. A table decorated with receipts for free things is
    // the noise a receipt is supposed to cut through.
    expect(result.spent).toBeUndefined();
    expect(result.left).toBeUndefined();
  });

  it('says nothing about an order it refused', () => {
    const ctx = testWorld(bundle, 7103);
    // Under the debt floor, not merely empty: the house is allowed to borrow
    // down to DEBT_FLOOR, so a treasury of zero still affords a tutor.
    ctx.world.treasury = DEBT_FLOOR;
    const child = place(ctx, { sex: 'female', age: 12 });

    const result = order(ctx, { kind: 'tutor', person: child.id, attr: 'mind' });
    expect(result.ok).toBe(false);
    expect(result.spent).toBeUndefined();
    expect(Math.round(ctx.world.treasury)).toBe(DEBT_FLOOR);
  });

  /**
   * The claim that matters, over every order the table offers: money never
   * moves without the result saying so. This is the one that catches an order
   * added later that charges quietly.
   */
  it('never moves the treasury without reporting it', () => {
    const ctx = testWorld(bundle, 7104);
    ctx.world.treasury = 5000;
    const child = place(ctx, { sex: 'female', age: 12, name: 'Receipted' });
    const grown = place(ctx, { sex: 'male', age: 20, name: 'Grown' });

    // Typed, NOT cast. An `as never` here let a grade of 'yeoman' and a career
    // of 'soldier' through on the first draft of this test — neither exists,
    // `PEDIGREE_PRICE['yeoman']` came back undefined, and `treasury -=
    // undefined` made the house's money NaN. A real client cannot post either
    // one, and the cast was the only thing that could.
    const orders: TableOrder[] = [
      { kind: 'tutor', person: child.id, attr: 'mind' },
      { kind: 'pedigree', person: grown.id, grade: 'caster' },
      { kind: 'bid', ceiling: 60 },
      { kind: 'withhold', person: child.id, hold: true },
      { kind: 'career', person: grown.id, career: 'military' },
    ];

    let charged = 0;
    for (const o of orders) {
      const before = ctx.world.treasury;
      const result = order(ctx, o);
      const moved = Math.round(before - ctx.world.treasury);
      if (moved !== 0) {
        expect(result.spent, `${o.kind} moved ${moved} crowns and said nothing`).toBe(moved);
        expect(result.left).toBe(Math.round(ctx.world.treasury));
        charged += 1;
      } else {
        expect(result.spent, `${o.kind} charged nothing and issued a receipt`).toBeUndefined();
      }
    }
    expect(charged, 'no order in the list actually charged, so this proved nothing').toBeGreaterThan(0);
  });
});

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

  it('takes a standing order on marriage, and keeps it across a save', () => {
    const g = newGame(loadContent(), { seed: 7008 });
    expect(g.table().marriagePolicy).toBe('as_it_falls');

    expect(g.order({ kind: 'marriages', policy: 'in' }).ok).toBe(true);
    expect(g.table().marriagePolicy).toBe('in');

    // A field the save format forgets resets silently on load, which looks
    // exactly like a standing order the house stopped obeying two centuries in.
    const resumed = resumeGame(g.save(), loadContent());
    expect(resumed.table().marriagePolicy).toBe('in');

    expect(g.order({ kind: 'marriages', policy: 'as_it_falls' }).ok).toBe(true);
    expect(g.table().marriagePolicy).toBe('as_it_falls');
  });

  it('does not let the house marry off the daughter it was told to keep', () => {
    // The order used to stop the PLAYER being asked and let `autoMarry` answer
    // in the same spring, which is the order doing the opposite of what it
    // says. Nothing reported it: she was married, correctly, by the code that
    // marries everybody the player is not asked about.
    const ctx = testWorld(bundle, 7005);
    const daughter = place(ctx, { sex: 'female', age: 20, name: 'A Withheld Daughter' });
    order(ctx, { kind: 'withhold', person: daughter.id, hold: true });

    for (let i = 0; i < 12; i++) {
      phase('marriage', ctx);
      ctx.world.year += 1;
    }

    expect(daughter.marriages).toEqual([]);
  });
});
describe('what the table shows', () => {
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

/**
 * WHERE THE BOOKS GO (issue #41, the ladder's second half).
 *
 * The steward handed books to `hall(MAIN_BRANCH)` and the ladder paid for it
 * for as long as cadet halls have existed. Measured over six thousand-year
 * runs: the strongest men in the family were living and dying in branch
 * households with nothing to read — power 71.6 and no books in eighty-four
 * years — while the seat's best-read man stood at power 0 with eight of them.
 * §22 wants power and books on the SAME MAN.
 */
describe('the steward and the shelf', () => {
  it('puts a book in front of a reader in a cadet hall', () => {
    const ctx = testWorld(bundle, 7301);
    const book = ctx.content.spellbooks.find((s) => s.threshold === 0)!;
    ctx.world.library.set(book.id, { id: book.id, acquiredYear: ctx.world.year, condition: 100 });

    // Woken: §11's learning gate (issue #79) means an unwoken cousin is not a
    // candidate for a book at all, and this test is about WHICH HALL the
    // steward reaches into, not about who may read.
    const cousin = place(ctx, { sex: 'male', age: 30, branch: 'branch_test', awakened: true });
    expect(cousin.membership[0]!.branch).toBe('branch_test');

    // The steward's diligence is a yearly roll, so this asks whether he is
    // ever offered a book at all, not whether he is offered one this spring.
    for (let i = 0; i < 60 && !ctx.world.studies.length; i++) {
      phase('table', ctx);
      ctx.world.year += 1;
    }
    expect(
      ctx.world.studies.some((s) => s.person === cousin.id),
      'nobody in a cadet hall was ever given a book',
    ).toBe(true);
  });
});
