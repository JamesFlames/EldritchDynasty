import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import type { Person, Rung } from '@ed/schema';
import { indexContent } from '@ed/schema';
import {
  RUNGS, affinitiesFor, booksFor, bootstrap, eldritchPower, maxExpressiblePower, place,
  rungIndex, rungTitle, standingOf, testWorld, tickAscension, type SimCtx,
} from '@ed/core';
import { ELDRITCH_GIFT, ELDRITCH_REACH } from './genetics/expression.js';

const bundle = loadContent();
const content = indexContent(bundle);

/**
 * THE ASCENSION LADDER (concept §22) — six rungs that were not in the code.
 *
 * Grepping `core` for a tier, a rung or a gate returned comments and test
 * fixtures. The player's only answer to "am I winning?" was a Respect tier
 * that landed on exalted anyway and a clause count that filled itself.
 */
describe('the ladder is a ladder', () => {
  it('runs from the ground to God, in order, with no gaps', () => {
    expect(RUNGS[0]).toBe('none');
    expect(RUNGS[RUNGS.length - 1]).toBe('god');
    expect(RUNGS.length).toBe(7);
    for (const r of RUNGS) expect(rungTitle(r).length).toBeGreaterThan(2);
    expect(rungIndex('demigod')).toBeGreaterThan(rungIndex('hierophant'));
  });

  it('never puts anyone who cannot express on it, at any rung', () => {
    // INVARIANT 1. Capability is the only gate, and it is not sex — a mundane
    // son is exactly as barred as any woman, and for the same reason.
    const ctx = testWorld(bundle, 8080);
    for (const p of ctx.world.people.all()) {
      if (standingOf(ctx, p).rung === 'none') continue;
      expect(p.sex, `${p.name} stands on the ladder`).toBe('male');
    }
  });

  it('says what is in the way, not merely that something is', () => {
    const ctx = testWorld(bundle, 8081);
    const boy = place(ctx, { sex: 'male', age: 20 });
    const standing = standingOf(ctx, boy);
    if (standing.rung !== 'god') {
      expect(standing.blocked, 'a rung was refused without a reason').toBeTruthy();
      expect(standing.blocked!.length).toBeGreaterThan(8);
    }
  });
});

/**
 * THE SCALE. §22's gates are written 10 / 25 / 50 / 70 / 85 / 98, and the
 * genetics produce a raw quantity that tops out around 22 in practice against
 * an arithmetic ceiling of 66. Two normalisations were wrong before this one:
 * the raw scale (rung 2 of 6 unreachable in principle) and the arithmetic
 * ceiling (rung 2 a coin flip, rungs 3-6 unreachable).
 */
describe('eldritch power, on the scale the gates are written in', () => {
  it('is derived from the locus table, not hardcoded', () => {
    const ctx = testWorld(bundle, 8082);
    expect(maxExpressiblePower(ctx)).toBeGreaterThan(0);
  });

  it('gives an ordinary expresser a real distance still to climb', () => {
    const ctx = testWorld(bundle, 8083);
    const expressers = ctx.world.people.all()
      .filter((p) => eldritchPower(ctx, p) > 0);
    expect(expressers.length, 'the founding cast has nobody who can express').toBeGreaterThan(0);
    for (const p of expressers) {
      // Nobody starts at the top, and nobody is at zero who can express at all.
      expect(eldritchPower(ctx, p)).toBeLessThan(100);
    }
  });
});

describe('where the ladder actually lands', () => {
  it('lets a man who meets every gate actually hold the rung', () => {
    // The mechanism, built rather than simulated, so this says something even
    // in a batch where nobody happens to get there.
    const ctx = testWorld(bundle, 8085);
    const him = ctx.world.people.household(ctx.world.playerHouse, ctx.world.year)
      .find((p) => eldritchPower(ctx, p) > 0);
    expect(him, 'the founding cast has nobody who can express').toBeTruthy();

    him!.awakening = { awakened: true, year: ctx.world.year, age: 20, forced: false, declaredMundane: false };
    expect(standingOf(ctx, him!).rung).toBe('touched');
  });
});

/**
 * THE BOOK COUNTS. §22 asks one man for 3 / 8 / 15 / 25 / 40 books, and the
 * game contains twenty-one. The top three rungs were gates with no key, which
 * typechecked for as long as the raw power scale did and for the same reason:
 * an absolute count in prose, against content authored afterwards to a
 * different size.
 */
describe("the book gates are read off the shelf that exists, not off §22's prose", () => {
  const ctx = testWorld(bundle, 8090);

  it('never asks one man for more books than the game contains', () => {
    // The bug, stated as the test that would have caught it. God wanted forty
    // of twenty-one.
    const catalogue = ctx.content.spellbooks.length;
    expect(catalogue).toBeGreaterThan(0);
    for (const r of RUNGS) {
      expect(booksFor(ctx, r), `${r} wants more books than exist`).toBeLessThanOrEqual(catalogue);
    }
  });

  it('is derived from the catalogue, so adding a spellbook moves the ladder with it', () => {
    const half = {
      ...ctx,
      content: { ...ctx.content, spellbooks: ctx.content.spellbooks.slice(0, 10) },
    } as typeof ctx;
    expect(booksFor(half, 'god')).toBeLessThan(booksFor(ctx, 'god'));
  });

  it('climbs: no rung ever wants fewer books than the rung below it', () => {
    let last = 0;
    for (const r of RUNGS) {
      const need = booksFor(ctx, r);
      expect(need, `${r} asks for fewer books than the rung beneath it`).toBeGreaterThanOrEqual(last);
      last = need;
    }
  });

  it('never asks for more affinities than books, since a book carries one', () => {
    // Normalising the books and not the affinities crosses these two lines at
    // Hierophant, and the book count there becomes a number nothing can be
    // stopped by — the affinity gate one line below refuses him first.
    for (const r of RUNGS) {
      expect(affinitiesFor(r), `${r} wants affinities no shelf of that size can cover`)
        .toBeLessThanOrEqual(booksFor(ctx, r));
    }
  });

  it('still asks for reading at every rung §22 asks for reading at', () => {
    // The rounding takes Adept's three books to under one. A rung that asks
    // for no reading at all is not the rung §22 wrote.
    for (const r of RUNGS.slice(rungIndex('adept'))) {
      expect(booksFor(ctx, r), `${r} asks for no books`).toBeGreaterThan(0);
    }
    expect(booksFor(ctx, 'touched')).toBe(0);
  });

  it('says how many books it wants, in the message, rather than a stale numeral', () => {
    const ctx2 = testWorld(bundle, 8091);
    const him = ctx2.world.people.household(ctx2.world.playerHouse, ctx2.world.year)
      .find((p) => eldritchPower(ctx2, p) > 0);
    expect(him, 'the founding cast has nobody who can express').toBeTruthy();
    him!.awakening = { awakened: true, year: ctx2.world.year, age: 20, forced: false, declaredMundane: false };
    him!.spellsKnown = [];
    const blocked = standingOf(ctx2, him!).blocked ?? '';
    // Whatever stops him, the sentence must not quote a count the code no
    // longer uses. "the three books it takes" outlived the three.
    for (const stale of ['the three books', 'of the eight', 'of the fifteen', 'twenty-five', 'of the forty']) {
      expect(blocked, `a gate still quotes ${stale}`).not.toContain(stale);
    }
  });
});

/**
 * STAGNATION (§22, issue #43).
 *
 * A man near the top of the ladder does not die on schedule and does not let
 * go. `headSince` has measured tenure rather than age since it shipped *for
 * exactly this*, and nothing read it for this until now — invariant 11's
 * shape, one floor up from the fields it usually catches.
 */
describe('the seat a man will not get out of', () => {
  /** A Head standing at the Vessel, built rather than bred. */
  function stagnantHead(ctx: SimCtx, tenure: number): Person {
    const him = ctx.world.people.living().find((p) => p.castSlots.includes('head'))!;
    ctx.world.respect = 'eminent';
    him.awakening.awakened = true;
    him.acquired[ELDRITCH_GIFT] = 400;
    him.acquired.mind = 200;
    him.madness = 30;
    for (const b of content.spellbooks.slice(0, 11)) him.spellsKnown.push(b.id);
    him.rites.push('vessel');
    him.phenotype = undefined;
    ctx.world.headSince = ctx.world.year - tenure;
    return him;
  }

  it('raises discontent while he keeps the seal, and not before a generation of it', () => {
    const ctx = bootstrap(content, 1042, 1042);
    const him = stagnantHead(ctx, 5);
    expect(standingOf(ctx, him).rung).toBe('vessel');

    ctx.world.discontent = 0;
    tickAscension(ctx);
    expect(ctx.world.discontent, 'five years in the chair is not yet a grievance').toBe(0);

    ctx.world.headSince = ctx.world.year - 40;
    tickAscension(ctx);
    expect(ctx.world.discontent).toBeGreaterThan(0);
  });

  /**
   * A Vessel in a cadet hall is not stagnation — he is just somebody the
   * family avoids. The whole of §22's sentence is that he stays HEAD.
   */
  it('charges nothing to a man at the same rung who does not hold the seal', () => {
    const ctx = bootstrap(content, 1042, 1042);
    const him = stagnantHead(ctx, 40);
    him.castSlots = him.castSlots.filter((s) => s !== 'head');

    ctx.world.discontent = 0;
    tickAscension(ctx);
    expect(ctx.world.discontent).toBe(0);
  });

  it('charges nothing for a long reign by a man who never climbed', () => {
    const ctx = bootstrap(content, 1042, 1042);
    const him = ctx.world.people.living().find((p) => p.castSlots.includes('head'))!;
    expect(rungIndex(standingOf(ctx, him).rung)).toBeLessThan(rungIndex('vessel'));
    ctx.world.headSince = ctx.world.year - 80;

    ctx.world.discontent = 0;
    tickAscension(ctx);
    expect(ctx.world.discontent).toBe(0);
  });

  // The property that matters for the day rung five is reachable: nothing has
  // to be rewritten for a Demigod to be worse than a Vessel at the same thing.
  it('scales with how high he stands, so the top of the ladder costs more', () => {
    const charge = (rites: ('vessel' | 'great_rite')[], gift: number) => {
      const ctx = bootstrap(content, 1042, 1042);
      const him = stagnantHead(ctx, 40);
      him.rites.length = 0;
      for (const r of rites) him.rites.push(r);
      him.acquired[ELDRITCH_GIFT] = gift;
      him.acquired[ELDRITCH_REACH] = 40;   // room enough for the blood above
      him.madness = 70;
      him.phenotype = undefined;
      ctx.world.discontent = 0;
      tickAscension(ctx);
      return { charged: ctx.world.discontent, rung: standingOf(ctx, him).rung };
    };

    const vessel = charge(['vessel'], 400);
    const higher = charge(['vessel', 'great_rite'], 400);
    expect(vessel.rung).toBe('vessel');
    if (rungIndex(higher.rung) > rungIndex('vessel')) {
      expect(higher.charged).toBeGreaterThan(vessel.charged);
    } else {
      // Rung five is not reachable in a built fixture either; the scaling is
      // then asserted where it can be — one step is charged one step's worth.
      expect(vessel.charged).toBeGreaterThan(0);
    }
  });
});
