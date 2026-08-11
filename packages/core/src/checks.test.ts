import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import type { Check, PoolSpec, Person } from '@ed/schema';
import {
  evalCheck, evalDifficulty, place, poolScore, resolveChoiceOutcome, testRng, testWorld,
} from '@ed/core';

const bundle = loadContent();

/**
 * CHECKS (issue #10, phase 3). `CheckS`/`PoolSpecS` were declared, referenced
 * by `Choice.check`, and evaluated nowhere — a choice carrying a check
 * resolved by outcome weight exactly as if it had none. These are direct
 * tests of the evaluator; `age_scoped.yaml`'s `what_came_up_the_river_road`
 * is the first authored choice to actually carry one, and its real-run
 * behaviour (a genuine three-way spread of bands over a sample of runs) was
 * confirmed by hand before this suite was written.
 */

// INVARIANT 6: `acquired` is a write-only layer re-applied on every recompute
// of a cached phenotype (people/factory.ts `phenotypeOf`) — a direct write
// has to invalidate the cache the same way `applyEffect`'s `attribute` case
// does, or a second read in the same year returns the first read's answer.
function setAcquired(p: Person, key: string, value: number): void {
  p.acquired[key] = value;
  if (p.phenotype) p.phenotype.dirty = true;
}
describe('poolScore', () => {
  it('slot: the weighted sum of one cast person\'s attributes', () => {
    const ctx = testWorld(bundle);
    const p = place(ctx, { sex: 'male', age: 30 });
    setAcquired(p, 'strength', 40);
    setAcquired(p, 'charm', 10);
    const spec: PoolSpec = {
      kind: 'slot', slot: 'X', attrs: [{ attr: 'strength', weight: 2 }, { attr: 'charm', weight: 1 }],
    };
    // strength and charm both start from a genome baseline; only the acquired
    // delta is controlled, so assert the RELATIVE effect of the weights
    // rather than an exact number pinned to genetics.
    const withBoth = poolScore(ctx, spec, { X: p.id });
    setAcquired(p, 'strength', 0);
    setAcquired(p, 'charm', 0);
    const withNeither = poolScore(ctx, spec, { X: p.id });
    expect(withBoth).toBeGreaterThan(withNeither);
  });

  it('slot: an unfilled slot scores zero', () => {
    const ctx = testWorld(bundle);
    const spec: PoolSpec = { kind: 'slot', slot: 'X', attrs: [{ attr: 'strength', weight: 1 }] };
    expect(poolScore(ctx, spec, {})).toBe(0);
  });

  it('party_sum: sums the named slots, skipping any unfilled', () => {
    const ctx = testWorld(bundle);
    const a = place(ctx, { sex: 'male', age: 30 });
    const b = place(ctx, { sex: 'male', age: 30 });
    a.acquired.strength = 20;
    b.acquired.strength = 20;
    const spec: PoolSpec = { kind: 'party_sum', slots: ['A', 'B', 'C'], attr: 'strength' };
    const both = poolScore(ctx, spec, { A: a.id, B: b.id });
    const oneOnly = poolScore(ctx, spec, { A: a.id });
    expect(both).toBeGreaterThan(oneOnly);
  });

  it('family_max: the household\'s single best, not the sum', () => {
    const ctx = testWorld(bundle);
    const a = place(ctx, { sex: 'male', age: 30 });
    const b = place(ctx, { sex: 'male', age: 30 });
    a.acquired.strength = 1000;
    b.acquired.strength = -1000;
    const spec: PoolSpec = { kind: 'family_max', attr: 'strength' };
    const max = poolScore(ctx, spec, {});
    const sumSpec: PoolSpec = { kind: 'family_sum', attr: 'strength' };
    const sum = poolScore(ctx, sumSpec, {});
    expect(max).toBeGreaterThan(sum);
  });

  it('family_any: 1 if anyone clears the bar, 0 if nobody does — the anti-specialisation check', () => {
    const ctx = testWorld(bundle);
    // Bootstrap seeds a founding cast into the household roster this pool
    // scans, so the bar has to be cleared (or not) by the WHOLE roster, not
    // just the one person this test places.
    const roster = ctx.world.people.household(ctx.world.playerHouse, ctx.world.year);
    for (const person of roster) setAcquired(person, 'strength', -1000);
    const p = place(ctx, { sex: 'male', age: 30 });
    setAcquired(p, 'strength', -1000);
    const spec: PoolSpec = { kind: 'family_any', attr: 'strength', atLeast: 30 };
    expect(poolScore(ctx, spec, {})).toBe(0);
    setAcquired(p, 'strength', 1000);
    expect(poolScore(ctx, spec, {})).toBe(1);
  });

  it('record: counts or ratios chronicle entries matching a ChronicleQuery', () => {
    const ctx = testWorld(bundle, 1042, 1042);
    // Bootstrap seeds one founding chronicle entry; clear it so the ratio
    // below is over exactly the three entries this test controls.
    ctx.world.chronicle.length = 0;
    ctx.world.chronicle.push(
      { year: 1040, weight: 'line', text: 'a', named: false, eventId: 'x', record: 'embellish' },
      { year: 1041, weight: 'line', text: 'b', named: false, eventId: 'y', record: 'omit' },
      { year: 1042, weight: 'line', text: 'c', named: false, eventId: 'x', record: 'record' },
    );
    const count = poolScore(ctx, { kind: 'record', against: { eventId: 'x', measure: 'count' } }, {});
    expect(count).toBe(2);
    const ratio = poolScore(ctx, { kind: 'record', against: { record: 'embellish', measure: 'ratio' } }, {});
    expect(ratio).toBeCloseTo(1 / 3);
  });

  it('record: discrepancyState follows the entry\'s linked Discrepancy, not a guess', () => {
    const ctx = testWorld(bundle, 1042, 1042);
    ctx.world.discrepancies.set('lie_a', { severity: 'minor', provableBy: [], state: 'proven' });
    ctx.world.chronicle.push(
      { year: 1042, weight: 'line', text: 'a', named: false, record: 'embellish', discrepancyId: 'lie_a' },
      { year: 1042, weight: 'line', text: 'b', named: false, record: 'embellish', discrepancyId: 'lie_b_never_proven' },
    );
    const proven = poolScore(ctx, { kind: 'record', against: { discrepancyState: 'proven', measure: 'count' } }, {});
    expect(proven).toBe(1);
  });
});

describe('evalDifficulty', () => {
  it('passes a flat number through unchanged', () => {
    const ctx = testWorld(bundle);
    expect(evalDifficulty(ctx, 42)).toBe(42);
  });

  it('adds each active Age\'s own term, respect tier, and centuries elapsed', () => {
    const ctx = testWorld(bundle, 1042, 1242); // two centuries in
    ctx.world.age.active.push({ age: 'the_wars', began: 1240, named: true, paid: { standing: false } });
    ctx.world.respect = 'eminent'; // index 3
    const d = evalDifficulty(ctx, {
      base: 10, perActiveAge: { the_wars: 5 }, perRespectTier: 2, perCentury: 1,
    });
    expect(d).toBe(10 + 5 + 3 * 2 + 2 * 1);
  });
});

describe('evalCheck', () => {
  const flatCheck = (): Check => ({
    id: 'c1',
    pool: { kind: 'family_max', attr: 'strength' },
    difficulty: 20,
    variance: 'none',
    bands: [
      { atLeast: 10, outcome: 'great' },
      { atLeast: -10, outcome: 'ok' },
      { atLeast: -1000, outcome: 'bad' },
    ],
  });

  it('with no variance, the roll is exactly the pool score and the band is deterministic', () => {
    const ctx = testWorld(bundle);
    const p = place(ctx, { sex: 'male', age: 30 });
    p.acquired.strength = 1000; // guaranteed to clear the top band
    const result = evalCheck(ctx, flatCheck(), bundle.events[0]!, {}, testRng('x'));
    expect(result.roll).toBe(result.score + result.bonus);
    expect(result.outcomeId).toBe('great');
  });

  it('picks the worst band when nothing clears any threshold', () => {
    const ctx = testWorld(bundle);
    // family_max scans the whole household roster, so the founding cast
    // bootstrap seeds has to be driven down too, not just the placed person.
    const roster = ctx.world.people.household(ctx.world.playerHouse, ctx.world.year);
    for (const person of roster) setAcquired(person, 'strength', -1000);
    const p = place(ctx, { sex: 'male', age: 30 });
    setAcquired(p, 'strength', -1000);
    const result = evalCheck(ctx, flatCheck(), bundle.events[0]!, {}, testRng('x'));
    expect(result.outcomeId).toBe('bad');
  });
});

describe('resolveChoiceOutcome', () => {
  it('falls back to weighted pickOutcome when the choice carries no check', () => {
    const ctx = testWorld(bundle);
    const event = bundle.events.find((e) => e.interaction.kind === 'choice')!;
    if (event.interaction.kind !== 'choice') throw new Error('unreachable');
    const choice = event.interaction.choices[0]!;
    const outcome = resolveChoiceOutcome(ctx, event, choice, {}, testRng('x'));
    expect(choice.outcomes.map((o) => o.id)).toContain(outcome.id);
  });

  it('resolves the real authored check to one of its declared bands', () => {
    const ctx = testWorld(bundle, 1042, 1042);
    const event = bundle.events.find((e) => e.id === 'what_came_up_the_river_road')!;
    if (event.interaction.kind !== 'choice') throw new Error('unreachable');
    const choice = event.interaction.choices.find((c) => c.check)!;
    const head = place(ctx, { sex: 'male', age: 40, castSlots: ['head'] });

    const outcome = resolveChoiceOutcome(ctx, event, choice, { HEAD: head.id }, testRng('x'));
    expect(['driven_off', 'held', 'broken_through']).toContain(outcome.id);
  });
});
