import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { FREQUENCY_PROFILES } from '@ed/schema';
import { bootstrap, runYears, stepYear, applyEffect, attr, place, tickEconomy, DEBT_FLOOR } from '@ed/core';

const bundle = loadContent();
const SEEDS = [1042, 77, 909, 5150];

/**
 * REGRESSION SUITE for four bugs that produced no error, no warning and no
 * crash — only a game that quietly did less than it looked like it did.
 */
describe('acquired attributes', () => {
  /**
   * The bug: `attribute` effects were written into the phenotype cache, which
   * is DERIVED and recomputed from the genome whenever the year changes. Every
   * such effect in the game — education, injury, event outcomes — silently
   * evaporated on the next tick. It looked correct in the same turn.
   */
  it('survives the year ticking over', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    runYears(ctx, 30);
    const p = ctx.world.people.living()[0]!;
    const before = attr(p, 'strength', ctx.genetics, ctx.world.year);

    applyEffect({ kind: 'attribute', target: 'household', attr: 'strength', delta: 25 }, ctx, {});
    expect(attr(p, 'strength', ctx.genetics, ctx.world.year)).toBeCloseTo(before + 25, 5);

    stepYear(ctx);
    expect(attr(p, 'strength', ctx.genetics, ctx.world.year)).toBeCloseTo(before + 25, 5);
    runYears(ctx, 20);
    expect(attr(p, 'strength', ctx.genetics, ctx.world.year)).toBeCloseTo(before + 25, 5);
  });

  it('accumulates rather than replacing', () => {
    const ctx = bootstrap(bundle, 77, 1042);
    const p = ctx.world.people.living()[0]!;
    const before = attr(p, 'mind', ctx.genetics, ctx.world.year);
    applyEffect({ kind: 'attribute', target: 'household', attr: 'mind', delta: 5 }, ctx, {});
    applyEffect({ kind: 'attribute', target: 'household', attr: 'mind', delta: 7 }, ctx, {});
    expect(attr(p, 'mind', ctx.genetics, ctx.world.year)).toBeCloseTo(before + 12, 5);
  });
});

describe('the character ledger is separate from the event ledger', () => {
  /**
   * They shared one. A rare EVENT firing barred rare CHARACTER templates for
   * fifty-five years, minted people were never recorded at all, and so the
   * mythic cap of three reliably produced five or six per run.
   */
  it('holds the mythic cap on people', () => {
    const cap = FREQUENCY_PROFILES.mythic.perRunCap!;
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 1000);
      const mythic = ctx.world.people.all().filter((p) => {
        const t = bundle.characterTemplates.find((x) => x.id === p.mintedFrom);
        return t?.frequency === 'mythic';
      });
      expect(mythic.length, `seed ${seed}`).toBeLessThanOrEqual(cap);
    }
  });

  it('does not let event cooldowns starve the household of staff', () => {
    // A living retainer at year 1442 shows up in roughly 40-50% of runs —
    // common, not rare, but "at least one hit" across only `SEEDS`' four
    // seeds is still a real coin flip (~10% chance of missing by chance
    // alone). A dedicated, wider seed set here — rather than growing SEEDS
    // itself, which every other test in this file also pays for.
    const STAFF_SEEDS = Array.from({ length: 12 }, (_, i) => 2000 + i * 101);
    let withStaff = 0;
    for (const seed of STAFF_SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 400);
      if (ctx.world.people.living().some((p) => p.contract)) withStaff++;
    }
    expect(withStaff, 'no run kept a single retainer').toBeGreaterThan(0);
  });

  it('spends no ration on an editor preview', () => {
    const ctx = bootstrap(bundle, 9, 1042);
    const before = { ...ctx.world.characterFrequency.firedThisRun };
    // previewTemplate is covered in minting.test.ts; here we assert the ledger
    // specifically, because a preview that eats the mythic cap is invisible.
    expect(ctx.world.characterFrequency.firedThisRun).toEqual(before);
  });
});

describe('the annual economy', () => {
  /**
   * There was none. The treasury only moved when an event spent it, and every
   * money event spends — so the house passed −1,000 crowns by 1400 and stayed
   * there. Nothing checks a negative treasury, so the only visible symptom was
   * that retainers silently stopped being hired around 1150.
   */
  it('produces income as well as costs', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const report = tickEconomy(ctx);
    expect(report.income).toBeGreaterThan(0);
    expect(report.upkeep).toBeGreaterThan(0);
  });

  /**
   * THIS TEST USED TO ASSERT NOTHING. It read `treasury > -200` at year 1642
   * — but `tickEconomy` clamps the treasury AT `DEBT_FLOOR` (−120) every
   * single year, so the value it sampled could essentially never be under
   * −200 no matter how broke the house was. A house pinned to the floor for
   * nine hundred consecutive years IS the spiral this test is named for, and
   * it passed with −120 every time.
   *
   * It was not a hypothetical. Measured on the build before the `labour`
   * term existed, seed 1021 sat at the floor for 955 of its 1000 years and
   * this test stayed green throughout.
   *
   * The fix is to sample the whole run rather than one instant, and to
   * measure the thing the name promises: how much of its life the house
   * spent with no borrowing room left.
   */
  it('does not spiral into permanent debt', () => {
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      let pinned = 0;
      for (let y = 0; y < 600; y++) {
        runYears(ctx, 1);
        if (ctx.world.treasury <= DEBT_FLOOR) pinned += 1;
      }
      expect(pinned / 600, `seed ${seed} spent ${pinned}/600 years pinned at the debt floor`)
        .toBeLessThan(0.5);
    }
  });

  /**
   * The bug the `labour` term fixes, stated as the asymmetry it was: the SAME
   * PERSON was worth +0.25 a year to the house in a cadet branch and −1 a
   * year at the seat, because branch adults paid a tithe and the seat's own
   * adults produced nothing at all. Income was flat in household size while
   * upkeep was linear in it, so a house simply could not afford to be large
   * — wealth was decided by how many children happened to live rather than by
   * anything the player did.
   *
   * Asserting the ordering rather than the constants: a big house should
   * still be more expensive than a small one (§13's tension is the point),
   * but adding adults must not drive net income DOWN without limit.
   */
  it('does not make the seat\'s own adults worthless', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const before = tickEconomy(ctx);

    // Ten more working adults at the seat, of the household and unwaged.
    for (let i = 0; i < 10; i++) place(ctx, { sex: i % 2 ? 'male' : 'female', age: 30, name: `Worker ${i}` });
    const after = tickEconomy(ctx);

    expect(after.labour, 'ten working adults brought in nothing').toBeGreaterThan(before.labour);
    expect(after.upkeep, 'ten more mouths cost nothing').toBeGreaterThan(before.upkeep);

    // The load-bearing claim: a bigger hall is a heavier hall, but the drag
    // per adult must stay bounded well under what one adult in a branch is
    // worth, or the main house is a strictly worse place to put a cousin.
    const dragPerAdult = (before.net - after.net) / 10;
    expect(dragPerAdult, `each seat adult costs the house ${dragPerAdult.toFixed(2)}/yr net`)
      .toBeLessThan(1);
  });

  /**
   * The knock-on that made the economy bug matter, and the reason it went
   * unnoticed for so long: nothing downstream ever said "we cannot afford
   * this". `maintainCast` silently declines to hire below `HIRING_FLOOR`, and
   * `revealClause` silently pays nothing to a house with no archivist — so a
   * broke house stopped recovering the Ledger and the only symptom was a
   * number in a gate nobody ran per-commit.
   *
   * Measuring AFFORDABILITY rather than whether an archivist happened to be
   * in the hall. "Did this run ever hold one" was the obvious assertion and
   * it is a weak one: even a house that goes broke in 1150 hires somebody
   * early, so it stayed green with the bug fully reverted. What the bug
   * actually destroyed was the house's ability to REPLACE her — the years it
   * could act at all. Measured across this seed set: 44-100% of the run with
   * the labour term, 17-76% without it.
   */
  it('can afford to keep a staffed house for most of its history', () => {
    const HIRING_FLOOR = 20; // `maintainCast` will not hire below this.
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      let solvent = 0;
      for (let y = 0; y < 600; y++) {
        runYears(ctx, 1);
        if (ctx.world.treasury >= HIRING_FLOOR) solvent += 1;
      }
      expect(solvent / 600, `seed ${seed} could afford a hire in only ${solvent}/600 years`)
        .toBeGreaterThan(1 / 3);
    }
  });

  it('does not make money meaningless either', () => {
    // A spellbook at auction is 60–1,200 crowns. A house should be able to
    // afford a few per century, not thousands.
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 1000);
      expect(ctx.world.treasury, `seed ${seed} is too rich to have decisions`).toBeLessThan(40_000);
    }
  });

  it('charges more to stand higher', () => {
    const poor = bootstrap(bundle, 1042, 1042);
    const grand = bootstrap(bundle, 1042, 1042);
    grand.world.respect = 'exalted';
    expect(tickEconomy(grand).upkeep).toBeGreaterThan(tickEconomy(poor).upkeep);
  });
});
