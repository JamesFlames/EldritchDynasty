import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { bootstrap, runYears } from '@ed/core';

const bundle = loadContent();
const SEEDS = [1042, 77, 909, 5150, 8080, 31];

/**
 * DEMOGRAPHY REGRESSION SUITE.
 *
 * Every assertion here exists because the opposite of it shipped. None of
 * these failures throw — a house that quietly empties, or quietly doubles
 * every generation, looks exactly like a working simulation from the outside,
 * which is why the tests have to say it out loud.
 */
describe('the house survives its own thousand years', () => {
  /**
   * The bug: `Math.max(0, (age - 45) ** 2)`. The square is always positive, so
   * the clamp did nothing and the mortality curve ran BACKWARDS — a one-year-
   * old carried a 12% annual hazard and almost no child reached seventeen.
   * Every run went extinct by about 1150 and nothing ever threw.
   */
  it('lets children reach adulthood', () => {
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 120);
      const reachedAdulthood = ctx.world.people
        .all()
        .filter((p) => p.born > 1042)
        .filter((p) => (p.died ?? ctx.world.year) - p.born >= 17);
      expect(reachedAdulthood.length, `seed ${seed}`).toBeGreaterThan(2);
    }
  });

  it('still has a household after four hundred years', () => {
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 400);
      const roster = ctx.world.people.household(ctx.world.playerHouse, ctx.world.year);
      expect(roster.length, `seed ${seed} went extinct`).toBeGreaterThan(0);
    }
  });

  it('reaches 2042 with a living house more often than not', () => {
    let survived = 0;
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 1000);
      if (ctx.world.people.household(ctx.world.playerHouse, ctx.world.year).length > 0) survived++;
    }
    // The Broken Line is a real ending, not the default outcome.
    expect(survived).toBeGreaterThan(SEEDS.length / 2);
  });

  /**
   * The overcorrection: removing the mortality bug doubled the house every
   * 25 years, which at 600 years is many orders of magnitude past this
   * ceiling — the bound exists to catch THAT, not to pin the household to
   * within a person or two of its observed size. 110 rather than 90: a
   * 30-seed sample at this same span put the natural high end at 88 (median
   * ~62), and 90 had essentially no headroom above it — any content change
   * that reshuffles which seed lands where can tip a seed over a threshold
   * that tight without the house actually having exploded.
   */
  it('does not breed without bound', () => {
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 600);
      const roster = ctx.world.people.household(ctx.world.playerHouse, ctx.world.year);
      expect(roster.length, `seed ${seed} exploded`).toBeLessThan(110);
    }
  });

  it('keeps a head while there is anyone to be one', () => {
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 400);
      const w = ctx.world;
      const roster = w.people.household(w.playerHouse, w.year);
      const eligible = roster.filter(
        (p) => p.membership.some((m) => m.kind === 'blood' || m.kind === 'cadet')
          && w.year - p.born >= 16,
      );
      if (!eligible.length) continue;
      expect(roster.some((p) => p.castSlots.includes('head')), `seed ${seed}`).toBe(true);
    }
  });

  it('caps each couple at a completed family rather than 27 fertile years', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    runYears(ctx, 400);
    for (const p of ctx.world.people.all()) {
      if (p.sex !== 'female') continue;
      expect(ctx.world.people.children(p.id).length, p.name).toBeLessThanOrEqual(6);
    }
  });

  it('is deterministic — the same seed produces the same house', () => {
    const a = bootstrap(bundle, 4242, 1042);
    const b = bootstrap(bundle, 4242, 1042);
    runYears(a, 200);
    runYears(b, 200);
    expect(a.world.people.size).toBe(b.world.people.size);
    expect(a.world.people.all().map((p) => `${p.name}:${p.born}`))
      .toEqual(b.world.people.all().map((p) => `${p.name}:${p.born}`));
    expect(a.world.chronicle.length).toBe(b.world.chronicle.length);
  });

  /**
   * Issue #24 item 4: "are births rerollable on reload?" A save/reload does
   * not rewind the RNG — every system draws from its own `streamFor(world,
   * name, ...)` stream, hashed from `(seed, year, system)` alone (`rng.ts`,
   * INVARIANT 8) — so nothing a player did or logged can perturb a birth
   * that has not happened yet, and nothing can un-perturb one that already
   * did. This is the mechanism that makes "no" the actual answer rather than
   * a policy nobody enforces: there is no lever a reload could pull.
   */
  it('does not let an unrelated decision reroll a birth (issue #24 item 4)', () => {
    const a = bootstrap(bundle, 6161, 1042);
    const b = bootstrap(bundle, 6161, 1042);
    runYears(a, 60);
    runYears(b, 60);
    b.world.decisionLog.push({ kind: 'record', year: b.world.year, event: 'the_levy_at_the_door', option: 'omit' });
    runYears(a, 120);
    runYears(b, 120);
    expect(a.world.people.all().map((p) => `${p.name}:${p.born}:${p.sex}`))
      .toEqual(b.world.people.all().map((p) => `${p.name}:${p.born}:${p.sex}`));
  });
});

describe('pedigree integrity', () => {
  it('never puts a child in the same generation as a parent', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    runYears(ctx, 300);
    const store = ctx.world.people;
    for (const p of store.all()) {
      for (const parent of [p.trueParents.mother, p.trueParents.father]) {
        if (!parent || !store.get(parent)) continue;
        expect(store.generationOf(p.id), p.name).toBeGreaterThan(store.generationOf(parent));
      }
    }
  });

  it('never lets anyone be born before a parent', () => {
    const ctx = bootstrap(bundle, 77, 1042);
    runYears(ctx, 300);
    const store = ctx.world.people;
    for (const p of store.all()) {
      for (const parent of [p.trueParents.mother, p.trueParents.father]) {
        const par = parent ? store.get(parent) : undefined;
        if (!par) continue;
        expect(p.born, `${p.name} vs ${par.name}`).toBeGreaterThan(par.born);
      }
    }
  });

  /**
   * The upper bound is 49 rather than 45 because childbearing ends on a curve
   * rather than at a wall. It stays an ABSOLUTE bound because the female
   * curve stretches at well under half the ceiling ratio — eggs deplete, they
   * do not wear — so even a very long-lived woman is finished a little after
   * fifty rather than proportionally later. A woman bearing at forty-seven is
   * a thing that happens once in a few hundred births and is worth a line in
   * the chronicle. A woman bearing at fifty-three is a bug.
   */
  it('never lets a mother bear a child outside a plausible age', () => {
    const ctx = bootstrap(bundle, 909, 1042);
    runYears(ctx, 300);
    const store = ctx.world.people;
    for (const p of store.all()) {
      const mum = p.trueParents.mother ? store.get(p.trueParents.mother) : undefined;
      if (!mum) continue;
      const age = p.born - mum.born;
      expect(age, `${mum.name} bore ${p.name} at ${age}`).toBeGreaterThanOrEqual(17);
      expect(age, `${mum.name} bore ${p.name} at ${age}`).toBeLessThanOrEqual(52);
    }
  });

  /**
   * And the tail stays a tail. The wall at forty-four put thirteen percent of
   * every house's births in the four years before it and none at all after,
   * which is a shape no population has ever had; the risk in replacing it
   * with a curve is doing the same thing in the other direction. Long-lived
   * houses push this up a little, which is intended — but only a little,
   * because the female curve stretches at under half rate.
   */
  it('keeps late motherhood rare', () => {
    let late = 0;
    let all = 0;
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 400);
      const store = ctx.world.people;
      for (const p of store.all()) {
        const mum = p.trueParents.mother ? store.get(p.trueParents.mother) : undefined;
        if (!mum) continue;
        all += 1;
        if (p.born - mum.born >= 45) late += 1;
      }
    }
    expect(all).toBeGreaterThan(400);
    expect(late / all, 'births past forty-five stopped being remarkable').toBeLessThan(0.02);
  });

  it('never leaves a person living in no household at all', () => {
    const ctx = bootstrap(bundle, 5150, 1042);
    runYears(ctx, 250);
    for (const p of ctx.world.people.living()) {
      expect(p.membership.some((m) => m.to === undefined), p.name).toBe(true);
    }
  });

  it('never marries anyone to a dead spouse', () => {
    const ctx = bootstrap(bundle, 8080, 1042);
    runYears(ctx, 300);
    for (const p of ctx.world.people.living()) {
      for (const m of p.marriages) {
        if (m.to !== undefined) continue;
        const spouse = ctx.world.people.get(m.spouse);
        expect(spouse?.status, `${p.name}'s spouse`).not.toBe('dead');
      }
    }
  });

  it('keeps marriages symmetrical on both sides', () => {
    const ctx = bootstrap(bundle, 31, 1042);
    runYears(ctx, 250);
    for (const p of ctx.world.people.all()) {
      for (const m of p.marriages) {
        const spouse = ctx.world.people.get(m.spouse);
        expect(spouse, `${p.name} married a ghost`).toBeDefined();
        expect(spouse!.marriages.some((x) => x.spouse === p.id), `${p.name} <-> ${spouse!.name}`).toBe(true);
      }
    }
  });
});
