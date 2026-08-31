import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import type { Rung } from '@ed/schema';
import {
  RUNGS, affinitiesFor, booksFor, eldritchPower, maxExpressiblePower, place,
  rungIndex, rungTitle, standingOf, testWorld,
} from '@ed/core';

const bundle = loadContent();

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
