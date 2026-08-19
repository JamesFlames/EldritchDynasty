import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { applyEffect, beget, bootstrap, place, resolveTargets } from '@ed/core';
import type { Person } from '@ed/schema';
import type { SimCtx } from '@ed/core';

interface Cast { head: Person; son: Person; daughter: Person; aunt: Person; stranger: Person }

const bundle = loadContent();

/**
 * WHO AN EFFECT LANDS ON.
 *
 * Every authored effect names a `Target`, and every one of the failures this
 * resolves is silent. A broadcast target that quietly widens hits people the
 * author never meant; one that quietly narrows leaves an effect applying to
 * nobody, which reads as an event that fired and did nothing. The slot forms
 * are worse: an unfilled slot has to resolve to NOBODY rather than to whoever
 * happens to answer, because a cast that failed is a cast that failed.
 */

/** A house with a Head, two of his children, an aunt, and a stranger abroad. */
function household(): SimCtx & { cast: Cast } {
  const ctx = bootstrap(bundle, 1042, 1042);
  for (const p of ctx.world.people.living()) ctx.world.people.kill(p.id, ctx.world.year, 'before the test');
  for (const p of ctx.world.people.all()) p.castSlots = [];

  const head = place(ctx, { sex: 'male', age: 45, name: 'Head', castSlots: ['head'] });
  const son = place(ctx, { sex: 'male', age: 20, name: 'Son' });
  const daughter = place(ctx, { sex: 'female', age: 18, name: 'Daughter' });
  const aunt = place(ctx, { sex: 'female', age: 60, name: 'Aunt' });
  const stranger = place(ctx, { sex: 'male', age: 30, name: 'Stranger', house: 'house_marrow' });
  beget(ctx, son, undefined, head);
  beget(ctx, daughter, undefined, head);

  return Object.assign(ctx, { cast: { head, son, daughter, aunt, stranger } });
}

const names = (xs: { name: string }[]) => xs.map((p) => p.name).sort();

describe('the broadcast targets', () => {
  it('head names the man holding the seal, and nobody else', () => {
    const ctx = household();
    expect(names(resolveTargets('head', ctx, {}))).toEqual(['Head']);
  });

  it('head names nobody at all while the seat stands empty', () => {
    const ctx = household();
    ctx.cast.head.castSlots = [];
    expect(resolveTargets('head', ctx, {})).toEqual([]);
  });

  it('household names everyone living under the roof, and no outsider', () => {
    const ctx = household();
    expect(names(resolveTargets('household', ctx, {}))).toEqual(['Aunt', 'Daughter', 'Head', 'Son']);
  });

  it('all_blood counts the blood living elsewhere, and never the dead', () => {
    const ctx = household();
    // Married away, still of the blood. The household no longer holds her.
    ctx.cast.aunt.membership[0]!.to = ctx.world.year;
    ctx.world.people.kill(ctx.cast.son.id, ctx.world.year, 'a fall');

    expect(names(resolveTargets('household', ctx, {}))).toEqual(['Daughter', 'Head']);
    expect(names(resolveTargets('all_blood', ctx, {}))).toEqual(['Aunt', 'Daughter', 'Head']);
  });

  it('children_of_head names his children and not his sister', () => {
    const ctx = household();
    expect(names(resolveTargets('children_of_head', ctx, {}))).toEqual(['Daughter', 'Son']);
  });

  it('children_of_head buries the dead ones rather than counting them', () => {
    const ctx = household();
    ctx.world.people.kill(ctx.cast.son.id, ctx.world.year, 'a fever');
    expect(names(resolveTargets('children_of_head', ctx, {}))).toEqual(['Daughter']);
  });

  it('children_of_head names nobody when there is no Head to have any', () => {
    const ctx = household();
    ctx.cast.head.castSlots = [];
    expect(resolveTargets('children_of_head', ctx, {})).toEqual([]);
  });
});

describe('the slot targets', () => {
  it('resolves a filled slot to exactly the person cast in it', () => {
    const ctx = household();
    const fill = { SUBJECT: ctx.cast.stranger.id };
    expect(names(resolveTargets({ slot: 'SUBJECT' }, ctx, fill))).toEqual(['Stranger']);
    expect(names(resolveTargets({ all: 'SUBJECT' }, ctx, fill))).toEqual(['Stranger']);
  });

  it('resolves an unfilled slot to nobody, rather than to whoever is nearest', () => {
    const ctx = household();
    expect(resolveTargets({ slot: 'ABSENT' }, ctx, {})).toEqual([]);
    expect(resolveTargets({ slot: 'ABSENT' }, ctx, { OTHER: ctx.cast.head.id })).toEqual([]);
  });

  it('resolves a slot cast to somebody who no longer exists to nobody', () => {
    const ctx = household();
    expect(resolveTargets({ slot: 'GHOST' }, ctx, { GHOST: 'p_nobody' })).toEqual([]);
  });
});

describe('an effect lands on exactly what the target resolved', () => {
  it('reaches every child of the Head from one broadcast', () => {
    const ctx = household();
    applyEffect({ kind: 'attribute', target: 'children_of_head', attr: 'charm', delta: 5 }, ctx, {});

    expect(ctx.cast.son.acquired.charm).toBe(5);
    expect(ctx.cast.daughter.acquired.charm).toBe(5);
    expect(ctx.cast.head.acquired.charm ?? 0).toBe(0);
    expect(ctx.cast.stranger.acquired.charm ?? 0).toBe(0);
  });

  it('does nothing at all when the slot it names was never cast', () => {
    const ctx = household();
    applyEffect({ kind: 'attribute', target: { slot: 'ABSENT' }, attr: 'charm', delta: 5 }, ctx, {});

    for (const p of ctx.world.people.all()) expect(p.acquired.charm ?? 0).toBe(0);
  });
});
