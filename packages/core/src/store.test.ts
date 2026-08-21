import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { bootstrap, place } from '@ed/core';

const content = loadContent();

/**
 * THE TIERS, AND THE TWO ACCESSORS NOBODY CALLED.
 *
 * Slot queries scan the HOT tier only, so which tier a person sits in decides
 * whether the game can see them at all. `archive` is called constantly — every
 * death goes through it — but `promote`, the way back, had never been called by
 * any test, and neither had `mustGet`. A tier mechanism that can only move one
 * direction under test is a mechanism half of which has never run.
 */

describe('the person store moves people between tiers', () => {
  it('archive takes someone out of the hot tier and drops their phenotype cache', () => {
    const ctx = bootstrap(content, 1042, 1042);
    const p = place(ctx, { sex: 'male', age: 30, name: 'Goes Cold' });
    expect(ctx.world.people.living().some((x) => x.id === p.id)).toBe(true);

    ctx.world.people.archive(p.id);

    expect(p.tier).toBe('archived');
    expect(p.phenotype).toBeUndefined();
    expect(ctx.world.people.living().some((x) => x.id === p.id)).toBe(false);
  });

  /** The way back. Never called by a test before this one. */
  it('promote puts them back, and the record was never lost', () => {
    const ctx = bootstrap(content, 1042, 1042);
    const p = place(ctx, { sex: 'male', age: 30, name: 'Comes Back' });
    ctx.world.people.archive(p.id);

    ctx.world.people.promote(p.id);

    expect(p.tier).toBe('hot');
    expect(ctx.world.people.living().some((x) => x.id === p.id)).toBe(true);
    expect(ctx.world.people.get(p.id)?.name).toBe('Comes Back');
  });

  it('promoting somebody who does not exist is a no-op, not a crash', () => {
    const ctx = bootstrap(content, 1042, 1042);

    expect(() => ctx.world.people.promote('per_nonesuch')).not.toThrow();
    expect(ctx.world.people.get('per_nonesuch')).toBeUndefined();
  });

  /**
   * `get` returns undefined and lets the caller decide; `mustGet` is for the
   * paths where a missing person is a bug in the engine rather than a state the
   * world can legitimately be in, and it has to be LOUD about it.
   */
  it('mustGet returns the person, or throws naming the id it could not find', () => {
    const ctx = bootstrap(content, 1042, 1042);
    const p = place(ctx, { sex: 'female', age: 22, name: 'Definitely Here' });

    expect(ctx.world.people.mustGet(p.id)).toBe(p);
    expect(() => ctx.world.people.mustGet('per_nonesuch')).toThrow(/per_nonesuch/);
  });

  it('an archived person is still reachable by id, because the chronicle refers to them forever', () => {
    const ctx = bootstrap(content, 1042, 1042);
    const p = place(ctx, { sex: 'male', age: 70, name: 'Long Dead' });
    ctx.world.people.archive(p.id);

    expect(ctx.world.people.get(p.id)?.name).toBe('Long Dead');
    expect(ctx.world.people.mustGet(p.id).name).toBe('Long Dead');
  });
});
