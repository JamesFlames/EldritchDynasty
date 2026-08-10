import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import {
  bootstrap, stepYear, runYears, renameChild, clearNamingQueue,
} from '@ed/core';

const bundle = loadContent();

/** Advance until at least one child is waiting to be named. */
function untilBirth(seed = 1042, cap = 80) {
  const ctx = bootstrap(bundle, seed, 1042);
  for (let i = 0; i < cap && ctx.world.pendingNames.length === 0; i++) stepYear(ctx);
  return ctx;
}

describe('naming the children', () => {
  it('queues newborns of the house, and only of the house', () => {
    const ctx = untilBirth();
    expect(ctx.world.pendingNames.length).toBeGreaterThan(0);
    for (const n of ctx.world.pendingNames) {
      const p = ctx.world.people.get(n.person)!;
      expect(p).toBeDefined();
      expect(p.houseOfOrigin).toBe(ctx.world.playerHouse);
      expect(p.born).toBe(n.born);
    }
  });

  it('gives every newborn a name before queueing, so nothing holds a nameless person', () => {
    const ctx = untilBirth();
    for (const n of ctx.world.pendingNames) {
      const p = ctx.world.people.get(n.person)!;
      expect(p.name.trim().length).toBeGreaterThan(0);
      expect(n.suggested).toBe(p.name);
    }
  });

  it('applies the chosen name, logs it, and drains the queue', () => {
    const ctx = untilBirth();
    const target = ctx.world.pendingNames[0]!.person;
    const before = ctx.world.chronicle.length;
    const queued = ctx.world.pendingNames.length;

    expect(renameChild(ctx, target, 'Sorrel')).toBe(true);
    expect(ctx.world.people.get(target)!.name).toBe('Sorrel');
    expect(ctx.world.pendingNames.length).toBe(queued - 1);
    expect(ctx.world.chronicle.length).toBe(before + 1);
    expect(ctx.world.chronicle.at(-1)!.text).toContain('Sorrel');
  });

  /**
   * The bug this exists for: the child was renamed and vanished from the
   * household view. Naming must never change where a person lives.
   */
  it('keeps a renamed child in the household roster', () => {
    const ctx = untilBirth();
    const target = ctx.world.pendingNames[0]!.person;
    const inHouseholdBefore = ctx.world.people
      .household(ctx.world.playerHouse, ctx.world.year)
      .some((p) => p.id === target);

    renameChild(ctx, target, 'Sorrel');

    const roster = ctx.world.people.household(ctx.world.playerHouse, ctx.world.year);
    expect(roster.some((p) => p.id === target)).toBe(inHouseholdBefore);
    expect(inHouseholdBefore).toBe(true);
    expect(roster.map((p) => p.name)).toContain('Sorrel');
  });

  it('frees the old name and reserves the new one', () => {
    const ctx = untilBirth();
    const target = ctx.world.pendingNames[0]!.person;
    const old = ctx.world.people.get(target)!.name;

    renameChild(ctx, target, 'Sorrel');
    expect(ctx.takenNames.has('Sorrel')).toBe(true);
    expect(ctx.takenNames.has(old)).toBe(false);
  });

  it('refuses blank names and unknown people, without draining the queue', () => {
    const ctx = untilBirth();
    const queued = ctx.world.pendingNames.length;
    const target = ctx.world.pendingNames[0]!.person;

    expect(renameChild(ctx, target, '   ')).toBe(false);
    expect(renameChild(ctx, 'p_nonexistent', 'Sorrel')).toBe(false);
    expect(ctx.world.pendingNames.length).toBe(queued);
  });

  it('refuses to rename someone who is not in the queue', () => {
    const ctx = untilBirth();
    const head = ctx.world.people.living().find((p) => p.castSlots.includes('head'))!;
    const before = head.name;
    expect(renameChild(ctx, head.id, 'Impostor')).toBe(false);
    expect(head.name).toBe(before);
  });

  it('lets the chronicler keep the names', () => {
    const ctx = untilBirth();
    const names = ctx.world.pendingNames.map((n) => ctx.world.people.get(n.person)!.name);
    clearNamingQueue(ctx);
    expect(ctx.world.pendingNames).toEqual([]);
    // Ignoring the offer is a valid way to play: the names survive.
    for (const n of names) expect(ctx.world.people.all().some((p) => p.name === n)).toBe(true);
  });

  it('does not grow the queue without bound over a long run', () => {
    const ctx = bootstrap(bundle, 909, 1042);
    runYears(ctx, 600);
    // Unnamed children accumulate, but only one entry per child ever.
    const ids = ctx.world.pendingNames.map((n) => n.person);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
