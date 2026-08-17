import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { validateBundle } from '@ed/schema';
import {
  applyEffect, bootstrap, careerMortality, inBreedingPool, phase, place, testRng, tickCareers,
} from '@ed/core';

const bundle = loadContent();

describe('the careers content', () => {
  it('validates', () => {
    expect(validateBundle(bundle).filter((i) => i.level === 'error')).toEqual([]);
  });

  it('authors the five rows the brief names', () => {
    const ids = bundle.careers.map((c) => c.id);
    for (const id of ['military', 'clergy', 'court', 'merchant', 'scholar']) {
      expect(ids).toContain(id);
    }
  });

  it('the careers that pay Respect cost either the body or the bloodline', () => {
    const military = bundle.careers.find((c) => c.id === 'military')!;
    const clergy = bundle.careers.find((c) => c.id === 'clergy')!;
    expect(military.extraMortality).toBeGreaterThan(0);
    expect(clergy.removesFromBreedingPool).toBe(true);
  });
});

describe('the career effect writes Person.career', () => {
  it('assign sets it, leave clears it', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const p = place(ctx, { sex: 'male', age: 30 });

    applyEffect({ kind: 'career', target: { slot: 'X' }, op: 'assign', career: 'merchant' }, ctx, { X: p.id });
    expect(String(p.career?.career)).toBe('merchant');
    expect(p.career?.from).toBe(ctx.world.year);

    applyEffect({ kind: 'career', target: { slot: 'X' }, op: 'leave' }, ctx, { X: p.id });
    expect(p.career).toBeUndefined();
  });
});

describe('tickCareers', () => {
  it('pays income into the treasury', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const p = place(ctx, { sex: 'male', age: 30 });
    p.career = { career: 'merchant' as never, from: ctx.world.year };
    const before = ctx.world.treasury;

    tickCareers(ctx, testRng('careers'));
    expect(ctx.world.treasury).toBeGreaterThan(before);
  });

  it('grows Charm for a courtier over the years', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const p = place(ctx, { sex: 'male', age: 30 });
    p.career = { career: 'court' as never, from: ctx.world.year };

    for (let i = 0; i < 10; i++) { tickCareers(ctx, testRng('careers', i)); ctx.world.year += 1; }
    expect(p.acquired.charm ?? 0).toBeGreaterThan(0);
  });

  it('lights up the career TraitAcquisition kind: a long-served soldier is hardened by the line', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const p = place(ctx, { sex: 'male', age: 30 });
    p.career = { career: 'military' as never, from: ctx.world.year - 10 };

    tickCareers(ctx, testRng('careers'));
    expect([...p.traits].map(String)).toContain('hardened_by_the_line');
  });

  it('does not grant the career trait early', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const p = place(ctx, { sex: 'male', age: 30 });
    p.career = { career: 'military' as never, from: ctx.world.year - 2 };

    tickCareers(ctx, testRng('careers'));
    expect([...p.traits].map(String)).not.toContain('hardened_by_the_line');
  });
});

describe('the costs that make the rule true (issue #16)', () => {
  it('clergy are excluded from the breeding pool', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const p = place(ctx, { sex: 'female', age: 25 });
    expect(inBreedingPool(ctx, p)).toBe(true);
    p.career = { career: 'clergy' as never, from: ctx.world.year };
    expect(inBreedingPool(ctx, p)).toBe(false);
  });

  it('clergy do not marry through autoMarry', () => {
    const ctx = bootstrap(bundle, 3, 1044);
    const p = place(ctx, { sex: 'female', age: 22, name: 'Ordained' });
    p.career = { career: 'clergy' as never, from: ctx.world.year };
    place(ctx, { sex: 'male', age: 24, name: 'Suitor' });

    for (let i = 0; i < 6; i++) phase('marriage', ctx);
    expect(p.marriages.length).toBe(0);
  });

  it('military service adds its own extra annual death hazard, read by rollDeath', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const soldier = place(ctx, { sex: 'male', age: 30 });
    expect(careerMortality(ctx, soldier)).toBe(0);

    soldier.career = { career: 'military' as never, from: ctx.world.year };
    expect(careerMortality(ctx, soldier)).toBeGreaterThan(0);
    expect(careerMortality(ctx, soldier)).toBe(ctx.content.mustCareer('military').extraMortality);
  });

  it('a soldier with the same body dies more often than his unplaced twin, holding the RNG draw fixed', () => {
    // Same name and age on both sides — an identical lazy genome and an
    // identical rng stream position — so the only thing that can move the
    // outcome is `extraMortality` itself.
    let soldierDeaths = 0;
    let civilianDeaths = 0;

    for (let seed = 1; seed <= 40; seed++) {
      const a = bootstrap(bundle, seed, 1042);
      const soldier = place(a, { sex: 'male', age: 90, name: 'Twin' });
      soldier.career = { career: 'military' as never, from: a.world.year };
      phase('lifecycle', a);
      if (soldier.status === 'dead') soldierDeaths += 1;

      const b = bootstrap(bundle, seed, 1042);
      const civilian = place(b, { sex: 'male', age: 90, name: 'Twin' });
      phase('lifecycle', b);
      if (civilian.status === 'dead') civilianDeaths += 1;
    }

    expect(soldierDeaths).toBeGreaterThanOrEqual(civilianDeaths);
    expect(soldierDeaths).toBeGreaterThan(0);
  });
});
