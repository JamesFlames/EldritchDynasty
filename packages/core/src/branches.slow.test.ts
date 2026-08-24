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
   * Grievance has to be a SIGNAL. As an accumulator it pegged at 100 in every
   * run by 1400 — a gate that is always open is not a gate — so it fades when
   * nothing is wrong and climbs while a hall is being passed over.
   */
  it('keeps grievance and discontent inside a usable range', () => {
    const everyGrievance: number[] = [];

    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 800);

      // The clamp itself, which is a real invariant — `tickBranches` pins both
      // to 0..100 and a future change dropping that would land here. It is NOT
      // the claim this test is named for, though: both values are clamped by
      // construction, so asserting only the bounds is a test that cannot fail.
      expect(ctx.world.discontent).toBeGreaterThanOrEqual(0);
      expect(ctx.world.discontent).toBeLessThanOrEqual(100);

      const live = [...ctx.world.branches.values()].filter((b) => b.extinct === undefined);
      expect(live.length, `seed ${seed} finished with no live hall to measure`).toBeGreaterThan(0);
      for (const b of live) {
        expect(b.grievance, b.name).toBeGreaterThanOrEqual(0);
        expect(b.grievance, b.name).toBeLessThanOrEqual(100);
      }

      // THE ACTUAL CLAIM. The bug this test was written for is an accumulator
      // that pegged every hall at 100 by 1400 — "a gate that is always open is
      // not a gate". A whole house sitting at the ceiling is that bug back.
      const pegged = live.filter((b) => b.grievance >= 99).length;
      expect(pegged, `seed ${seed}: all ${live.length} live halls sit at the ceiling`)
        .toBeLessThan(live.length);

      everyGrievance.push(...live.map((b) => b.grievance));
    }

    // And it has to move in BOTH directions, or it is a counter rather than a
    // temperature. Asserted across the batch, not per seed — a run in which no
    // hall ever had a grievance is a legitimate run, just a quiet one.
    //
    // A WIDER BLOCK for this one claim, and the reason is a measurement. What
    // is being sampled is one number per surviving hall at one instant, and
    // its distribution is heavy-tailed: a hall reaches the ceiling by going a
    // century without being honoured, which most halls in most runs do not do.
    // Six seeds is about thirty hall-observations and the top of that sample
    // is carried by one hall. Measured over 24 independent seeds — 120
    // observations — the maximum is 100.0 both before and after the hundred-
    // template common drop; measured over the six above it moved from 98.2 to
    // 49.8, which is the same statistic reporting the sample rather than the
    // game. This is the fourth time that lesson has been learned in this
    // repository and the second time it has been written into a test.
    const wideGrievance: number[] = [];
    for (let i = 0; i < 18; i += 1) {
      const ctx = bootstrap(bundle, 3300 + i * 41, 1042);
      runYears(ctx, 800);
      for (const b of ctx.world.branches.values()) {
        if (b.extinct === undefined) wideGrievance.push(b.grievance);
      }
    }
    expect(Math.min(...wideGrievance), 'no hall in any run was ever content').toBeLessThan(10);
    expect(Math.max(...wideGrievance), 'no hall in any run ever became aggrieved').toBeGreaterThan(50);
    expect(everyGrievance.length, 'the narrow block measured nothing').toBeGreaterThan(0);
  });

  /**
   * THE FADE, ISOLATED — and the one assertion in this file that actually
   * catches the accumulator bug the block above is named for.
   *
   * Everything easier fails to. Clamped bounds cannot fail at all; "not every
   * hall is pegged" and "some hall is content" both stay green under a pure
   * accumulator, because a run always has a hall founded in the last decade
   * sitting near zero on the way up.
   *
   * What an accumulator cannot produce is a hall that has stood for
   * generations and is STILL content — under `delta = 1` every hall is a
   * function of its own age, so age is grievance. Measured across sixteen
   * seeds: 18 of 38 long-lived halls sit under 50 with the fade in place, and
   * 1 of 46 without it. A dedicated seed set because the claim is about the
   * shape of the distribution, and this file's usual six leave it resting on
   * a single quiet run.
   */
  it('lets a hall stand for centuries and still be content', () => {
    const FADE_SEEDS = Array.from({ length: 16 }, (_, i) => 4000 + i * 97);
    let longLived = 0;
    let content = 0;

    for (const seed of FADE_SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 800);
      for (const b of ctx.world.branches.values()) {
        if (b.extinct !== undefined) continue;
        if (ctx.world.year - b.foundedYear <= 150) continue;
        longLived += 1;
        if (b.grievance < 50) content += 1;
      }
    }

    expect(longLived, 'no hall in the batch lasted long enough to measure a fade').toBeGreaterThan(10);
    expect(content / longLived, `only ${content}/${longLived} long-lived halls were content — grievance is accumulating, not fading`)
      .toBeGreaterThan(0.2);
  });

  it('does not sit at maximum discontent for the whole run', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    runYears(ctx, 800);
    expect(ctx.world.discontent).toBeLessThan(95);
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
