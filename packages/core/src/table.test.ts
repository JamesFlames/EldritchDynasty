import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { canBeTaught, type SlotSpec } from '@ed/schema';
import {
  applyEffect, candidatesFor, DEBT_FLOOR, expectRate, TUTOR_FEE, TUTOR_GAIN, TUTOR_YEARS, newGame, onTheMarket,
  order, phase, place, resumeGame, tableView, testWorld, type TableOrder,
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

  /**
   * WHAT FORTY CROWNS MAY BE SPENT ON.
   *
   * The order asked only whether the attribute existed, and the client drew
   * its list from `SessionView.attributes` — all nineteen rows — so a house
   * could buy an eight-year term in Madness. Two ways for that to be wrong
   * and both were live: `madness` and `eldritch_power` are read from nothing
   * in the acquired layer, so the term ran and delivered a number nobody
   * consults; `health`, `fertility` and `max_age` ARE read there, by
   * `applyVitality`, so a tutor was a thing you could hire to make a child
   * live longer, and it worked.
   */
  describe('a term is bought in something teachable', () => {
    const teachable = bundle.attributes.filter((a) => canBeTaught(a.kind));
    const not = bundle.attributes.filter((a) => !canBeTaught(a.kind));

    it('refuses every attribute a tutor cannot teach, by name, and charges nothing', () => {
      expect(not.map((a) => String(a.id)).sort())
        .toEqual(['eldritch_power', 'fertility', 'health', 'madness', 'max_age']);

      for (const a of not) {
        const ctx = testWorld(bundle, 7010);
        ctx.world.treasury = 900;
        const child = place(ctx, { sex: 'female', age: 9 });

        const r = order(ctx, { kind: 'tutor', person: child.id, attr: String(a.id) });

        expect(r.ok, String(a.id)).toBe(false);
        expect(r.reason, String(a.id)).toContain(a.name);
        expect(ctx.world.treasury, `${String(a.id)} was refused and still charged`).toBe(900);
        expect(ctx.world.tutoring).toHaveLength(0);
      }
    });

    it('and still teaches every attribute that can be taught', () => {
      expect(teachable.length, 'nothing was teachable, so this proved nothing').toBeGreaterThan(10);
      for (const a of teachable) {
        const ctx = testWorld(bundle, 7011);
        ctx.world.treasury = 900;
        const child = place(ctx, { sex: 'female', age: 9 });
        expect(order(ctx, { kind: 'tutor', person: child.id, attr: String(a.id) }).ok, String(a.id))
          .toBe(true);
      }
    });

    /**
     * The list the client actually draws. Pointing the select at the session's
     * nineteen was the whole bug, and a view that agrees with the order is the
     * only thing that stops it coming back through the other door.
     */
    it('the table offers exactly what the order accepts', () => {
      const ctx = testWorld(bundle, 7012);
      const offered = tableView(ctx).teachable.map((t) => t.attr).sort();
      expect(offered).toEqual(teachable.map((a) => String(a.id)).sort());
      expect(offered).not.toContain('madness');
    });
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

/**
 * THE STEWARD'S YEAR REACHES CASTING (issue #127).
 *
 * `runStandingOrders` always knew exactly who it acted on; nothing could ask
 * before `world.stewardYear` existed, so `the_commission_bought` cast any
 * living adult and named a placement scene about a man who, four times in
 * five, held no post. These prove the wiring rather than the fiction: that
 * the three new roles read exactly what the phase wrote, and nothing else.
 */
describe('the steward\'s year (issue #127)', () => {
  const spec = (role: SlotSpec['role']): SlotSpec =>
    ({ role, castBy: 'engine', optional: false, filters: [], bind: 'event' });

  it('newly_placed, newly_taught and set_to_a_book each cast exactly who the phase named', () => {
    const ctx = testWorld(bundle, 7401);
    const placed = place(ctx, { sex: 'male', age: 30, name: 'Placed' });
    const taught = place(ctx, { sex: 'male', age: 15, name: 'Taught' });
    const opened = place(ctx, { sex: 'male', age: 15, name: 'Opened' });
    const bystander = place(ctx, { sex: 'male', age: 40, name: 'Bystander' });
    ctx.world.stewardYear = { placed: [placed.id], taught: [taught.id], opened: [opened.id] };

    expect(candidatesFor(spec('newly_placed'), ctx, {}).map((p) => p.id)).toEqual([placed.id]);
    expect(candidatesFor(spec('newly_taught'), ctx, {}).map((p) => p.id)).toEqual([taught.id]);
    expect(candidatesFor(spec('set_to_a_book'), ctx, {}).map((p) => p.id)).toEqual([opened.id]);

    // And the negative: a role finds nobody at all when the year named nobody
    // for it, rather than falling back to the household the way `family_member`
    // does — a bystander must never read as "newly" anything.
    for (const role of ['newly_placed', 'newly_taught', 'set_to_a_book'] as const) {
      expect(candidatesFor(spec(role), ctx, {}).map((p) => p.id)).not.toContain(bystander.id);
    }
  });

  it('is overwritten wholesale by the table phase, not merged with what a prior year left', () => {
    const ctx = testWorld(bundle, 7402);
    ctx.world.stewardYear = { placed: ['a_ghost'], taught: ['a_ghost'], opened: ['a_ghost'] };

    phase('table', ctx);

    expect(ctx.world.stewardYear.placed, 'last year\'s placement leaked into this year').not.toContain('a_ghost');
    expect(ctx.world.stewardYear.taught, 'last year\'s term leaked into this year').not.toContain('a_ghost');
    expect(ctx.world.stewardYear.opened, 'last year\'s study leaked into this year').not.toContain('a_ghost');
  });

  it('the table phase actually writes who it placed, not merely who it might have', () => {
    const ctx = testWorld(bundle, 7403);
    ctx.world.treasury = 100_000;

    let placed: ReturnType<typeof place> | undefined;
    for (let i = 0; i < 150 && !placed; i++) {
      phase('table', ctx);
      const id = ctx.world.stewardYear.placed[0];
      if (id) placed = ctx.world.people.get(id);
      else ctx.world.year += 1;
    }

    expect(placed, 'the steward never placed anybody in a hundred and fifty years of trying').toBeDefined();
    // The man `world.stewardYear.placed` names actually holds the post, from
    // this exact year — not a guess, and not somebody merely idle nearby.
    expect(placed!.career).toBeDefined();
    expect(placed!.career!.from).toBe(ctx.world.year);
    expect(candidatesFor(spec('newly_placed'), ctx, {}).map((p) => p.id)).toEqual([placed!.id]);
  });
});

/**
 * THE TUTOR EFFECT (issue #128).
 *
 * Before this, no authored event could ever put a child in a term or take
 * one away — `spellbook op: study` was a real verb and the tutor had none,
 * so five templates narrated a system that fired zero times in sixteen
 * played thousand-year runs.
 */
describe('the tutor effect (issue #128)', () => {
  it('begin starts a term and charges the fee, exactly like the player order', () => {
    const ctx = testWorld(bundle, 7501);
    ctx.world.treasury = 500;
    const child = place(ctx, { sex: 'male', age: 12 });

    applyEffect({ kind: 'tutor', target: { slot: 'X' }, attr: 'mind', op: 'begin' }, ctx, { X: child.id });

    expect(ctx.world.tutoring).toEqual([{ person: child.id, attr: 'mind', completes: ctx.world.year + TUTOR_YEARS }]);
    expect(ctx.world.treasury).toBe(500 - TUTOR_FEE);
  });

  /**
   * THE TRAP THE ISSUE NAMED BY LINE NUMBER: a second copy of `canBeTaught`
   * is how a term in `madness` shipped once already. This calls the effect,
   * not the order, so it is actually exercising the gate the effect uses.
   */
  it('refuses a body attribute, Madness and Eldritch Power through the SAME gate the order uses', () => {
    const ctx = testWorld(bundle, 7502);
    const child = place(ctx, { sex: 'male', age: 12 });

    for (const attr of ['health', 'madness', 'eldritch_power']) {
      applyEffect({ kind: 'tutor', target: { slot: 'X' }, attr, op: 'begin' }, ctx, { X: child.id });
    }
    expect(ctx.world.tutoring, 'a body attribute, Madness or Eldritch Power was bought a term').toEqual([]);
  });

  it('cancel drops whatever term the target is in, with no refund', () => {
    const ctx = testWorld(bundle, 7503);
    ctx.world.treasury = 500;
    const child = place(ctx, { sex: 'male', age: 12 });
    applyEffect({ kind: 'tutor', target: { slot: 'X' }, attr: 'mind', op: 'begin' }, ctx, { X: child.id });
    const afterBegin = ctx.world.treasury;

    applyEffect({ kind: 'tutor', target: { slot: 'X' }, attr: 'mind', op: 'cancel' }, ctx, { X: child.id });

    expect(ctx.world.tutoring).toEqual([]);
    expect(ctx.world.treasury, 'cancelling refunded the fee — it never does').toBe(afterBegin);
  });

  it('is a silent no-op on an unknown attribute, or a target already in a term', () => {
    const ctx = testWorld(bundle, 7504);
    const child = place(ctx, { sex: 'male', age: 12 });
    applyEffect({ kind: 'tutor', target: { slot: 'X' }, attr: 'no_such_attribute', op: 'begin' }, ctx, { X: child.id });
    expect(ctx.world.tutoring).toEqual([]);

    applyEffect({ kind: 'tutor', target: { slot: 'X' }, attr: 'mind', op: 'begin' }, ctx, { X: child.id });
    const before = [...ctx.world.tutoring];
    applyEffect({ kind: 'tutor', target: { slot: 'X' }, attr: 'charm', op: 'begin' }, ctx, { X: child.id });
    expect(ctx.world.tutoring, 'a second term opened over the first').toEqual(before);
  });

  it('a term completed through the effect marks `taught`, exactly like one bought at the table', () => {
    const ctx = testWorld(bundle, 7505);
    const child = place(ctx, { sex: 'male', age: 12 });
    applyEffect({ kind: 'tutor', target: { slot: 'X' }, attr: 'mind', op: 'begin' }, ctx, { X: child.id });

    for (let i = 0; i <= TUTOR_YEARS; i++) {
      phase('table', ctx);
      ctx.world.year += 1;
    }

    expect(child.taught).toEqual(['mind']);
  });
});

/**
 * THE STEWARD BUYS TERMS (issue #128). Zero in sixteen played thousand-year
 * runs before this — the only door open was the player's own order, and a
 * harness run gives no orders. `expectRate` is the instrument the rest of
 * this codebase uses for exactly this shape of claim: not "it can happen",
 * but "it happens in most runs, at a rate somebody chose and measured".
 *
 * A household of ten young pupils is BUILT, rather than bred over centuries
 * of `lifecycle`/`births` — this is a claim about the `table` phase's own
 * roll, and simulating a whole population's growth to reach one is a wait
 * that would obscure the thing being measured (`AGENTS.md`: "build the state
 * you mean").
 */
describe('the steward buys a term (issue #128)', () => {
  it('starts at least one term in most runs, over a batch large enough to carry the claim', () => {
    const RUNS = 30;
    const YEARS = 40;
    let hit = 0;
    for (let i = 0; i < RUNS; i++) {
      const ctx = testWorld(bundle, 8100 + i * 7);
      ctx.world.treasury = 100_000;
      for (let c = 0; c < 10; c++) place(ctx, { sex: c % 2 ? 'male' : 'female', age: 5 + c, name: `Pupil${c}` });

      for (let y = 0; y < YEARS && !ctx.world.tutoring.length; y++) {
        phase('table', ctx);
        ctx.world.year += 1;
      }
      if (ctx.world.tutoring.length) hit += 1;
    }
    expectRate({
      what: 'a run with a full household of pupils and no debt ceiling sees a term start within 40 years',
      n: RUNS, hits: hit, floor: 0.5,
    });
  });
});
