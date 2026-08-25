import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { MAIN_BRANCH } from '@ed/schema';
import { bootstrap, runYears, branchOf, halls, activeBranches, MAX_ACTIVE_BRANCHES } from '@ed/core';

const bundle = loadContent();
const SEEDS = [1042, 77, 909, 5150, 8080, 31];

/**
 * CADET BRANCHES (concept §16).
 *
 * Step six of the core loop — "name an heir, everyone else becomes a cadet
 * branch" — did nothing for a long time, and did it silently: non-heir sons
 * stayed in the main hall, the crowding brake damped them, and the family
 * quietly had exactly one household for a thousand years.
 *
 * These assertions are about the SHAPE of a healthy run. A branch system that
 * founds nothing, founds everything, strands people in no hall at all, or
 * never gives the seal back looks identical from the outside.
 */
describe('cadet branches', () => {
  it('founds branches rather than keeping every son under one roof', () => {
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 300);
      expect(ctx.world.branches.size, `seed ${seed} never split`).toBeGreaterThan(0);
    }
  });

  it('never runs more halls than the cap allows', () => {
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 600);
      expect(activeBranches(ctx.world).length, `seed ${seed}`).toBeLessThanOrEqual(MAX_ACTIVE_BRANCHES);
    }
  });

  /** A hall with nobody in it is a hall that should have been buried. */
  it('marks a branch extinct the year its last member dies', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    runYears(ctx, 500);
    const populated = halls(ctx.world, ctx.world.year);
    for (const b of ctx.world.branches.values()) {
      const members = populated.get(b.id) ?? [];
      if (b.extinct !== undefined) expect(members.length, b.name).toBe(0);
      else expect(members.length, b.name).toBeGreaterThan(0);
    }
  });

  /**
   * Everyone lives somewhere. Moving a man between halls closes one membership
   * and opens another; getting that wrong leaves people in two halls at once,
   * which double-counts them in every roster the game has.
   */
  it('leaves nobody in two halls at once', () => {
    for (const seed of [1042, 5150]) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 400);
      const w = ctx.world;
      for (const p of w.people.living()) {
        const open = p.membership.filter((m) => m.to === undefined);
        expect(open.length, `${p.name} holds ${open.length} memberships`).toBe(1);
      }
      const total = [...halls(w, w.year).values()].reduce((a, m) => a + m.length, 0);
      expect(total).toBe(w.people.household(w.playerHouse, w.year).length);
    }
  });

  /**
   * THE PAYOFF. "A mundane cadet cousin is sitting where the founder sat"
   * (§23) requires that succession can actually reach into a branch — and that
   * whoever it reaches comes home, because a Head who rules from the smaller
   * house is a Head whose own hall is somebody else's.
   */
  it('brings the Head home when the seal goes to a cadet', () => {
    let recalls = 0;
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 600);
      const w = ctx.world;
      recalls += [...w.branches.values()].filter((b) => b.recalled !== undefined).length;

      const head = w.people.living().find((p) => p.castSlots.includes('head'));
      if (head) expect(branchOf(w, head, w.year), `seed ${seed}: head rules from a branch`).toBe(MAIN_BRANCH);
    }
    expect(recalls, 'the seal never once went to a cadet in six runs').toBeGreaterThan(0);
  });

  /** The head of the family is not a cadet, whatever he used to be. */
  it('keeps a recalled cousin out of the cadet slot afterwards', () => {
    const ctx = bootstrap(bundle, 909, 1042);
    runYears(ctx, 500);
    const w = ctx.world;
    for (const p of w.people.living()) {
      if (!p.castSlots.includes('head')) continue;
      expect(p.membership.find((m) => m.to === undefined)?.kind).not.toBe('cadet');
    }
  });

  /**
   * The demographic point of the whole feature: the family grows sideways.
   * One hall with one crowding brake is why runs ended with twenty people.
   */
  it('spreads the family across halls instead of choking one', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    runYears(ctx, 600);
    const populated = [...halls(ctx.world, ctx.world.year)].filter(([, m]) => m.length > 0);
    expect(populated.length).toBeGreaterThan(1);
  });

  it('is still deterministic with branches in play', () => {
    const a = bootstrap(bundle, 4242, 1042);
    const b = bootstrap(bundle, 4242, 1042);
    runYears(a, 300);
    runYears(b, 300);
    expect([...a.world.branches.keys()]).toEqual([...b.world.branches.keys()]);
    expect([...a.world.branches.values()].map((x) => x.grievance))
      .toEqual([...b.world.branches.values()].map((x) => x.grievance));
  });
});
