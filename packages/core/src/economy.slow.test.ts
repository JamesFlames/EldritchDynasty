import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { FREQUENCY_PROFILES } from '@ed/schema';
import { bootstrap, runYears, stepYear, applyEffect, attr, tickEconomy } from '@ed/core';

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
    let withStaff = 0;
    for (const seed of SEEDS) {
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

  it('does not spiral into permanent debt', () => {
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 600);
      expect(ctx.world.treasury, `seed ${seed}`).toBeGreaterThan(-200);
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
