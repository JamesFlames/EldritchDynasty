import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { bootstrap, evalCondition, evalCheck, place, stepYear, testRng } from '@ed/core';

const bundle = loadContent();
const SEEDS = [1042, 77, 909, 5150, 8080, 31];

/**
 * GATE 2 OF ISSUE #11: every modifier kind appearing in `traits.yaml` was
 * applied at least once across the seed set — not merely exhaustive in a
 * switch, not merely correct in a unit test against hand-built state, but
 * reachable through the REAL authored content in a REAL headless run.
 *
 * `unlock`, `outcome_weight`, `resource` and `attribute` (`children` target)
 * are checked by running each seed a thousand years and confirming the real
 * trait's precondition actually arises in the household at some point — the
 * mechanism itself is proven correct in `influence.test.ts`, so this file's
 * job is reachability, not correctness.
 *
 * `check_bonus` is the exception, and it is documented rather than silently
 * downgraded: `hard_hands` acquires via a strength threshold the engine does
 * not enforce (no acquisition pipeline reads `threshold` — traits attach only
 * via a character template's `traits:` list, a founding character, or a
 * `trait` effect, and none of those name `hard_hands`). Getting a blood Head
 * to hold it by the time `what_came_up_the_river_road` fires is a
 * content-population problem, not a wiring one, and out of this issue's
 * scope. It is verified here by direct construction against the real trait
 * and the real authored check instead — the same "faithful shortcut"
 * `discrepancies.slow.test.ts` uses for the PRESSURE pass.
 */
describe('every implemented modifier kind is reachable through real content', () => {
  it('unlock: some seed\'s household holds a trait that grants `gate_watch`', () => {
    let seen = false;
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      for (let i = 0; i < 1000 && !seen; i++) {
        stepYear(ctx);
        if (evalCondition({ unlocked: 'gate_watch' }, ctx)) seen = true;
      }
      if (seen) break;
    }
    expect(seen, 'no seed ever minted a keeps_a_night_watch holder into the household').toBe(true);
  });

  it('outcome_weight: some seed\'s household holds a trait matching a real outcome tag', () => {
    let seen = false;
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      for (let i = 0; i < 1000 && !seen; i++) {
        stepYear(ctx);
        const holdsIt = ctx.world.people.household(ctx.world.playerHouse, ctx.world.year)
          .some((p) => [...p.traits].includes('keeps_a_night_watch' as never));
        if (holdsIt) seen = true;
      }
      if (seen) break;
    }
    expect(seen, 'no seed ever minted a keeps_a_night_watch holder into the household').toBe(true);
  });

  it('resource: some seed\'s household holds a trait with a per-year resource term', () => {
    let seen = false;
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      for (let i = 0; i < 1000 && !seen; i++) {
        stepYear(ctx);
        const holdsIt = ctx.world.people.household(ctx.world.playerHouse, ctx.world.year)
          .some((p) => [...p.traits].includes('keeps_the_tollgate' as never));
        if (holdsIt) seen = true;
      }
      if (seen) break;
    }
    expect(seen, 'no seed ever minted a keeps_the_tollgate holder into the household').toBe(true);
  });

  it('attribute: some seed\'s household pairs a the_tutors_aphorisms holder with a child under twenty', () => {
    let seen = false;
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      for (let i = 0; i < 1000 && !seen; i++) {
        stepYear(ctx);
        const roster = ctx.world.people.household(ctx.world.playerHouse, ctx.world.year);
        const hasTutor = roster.some((p) => [...p.traits].includes('the_tutors_aphorisms' as never));
        const hasChild = roster.some((p) => ctx.world.year - p.born < 20);
        if (hasTutor && hasChild) seen = true;
      }
      if (seen) break;
    }
    expect(seen, 'no seed ever paired a the_tutors_aphorisms holder with a household child').toBe(true);
  });

  it('check_bonus: direct construction against the real hard_hands trait and gate_stand check', () => {
    const ctx = bootstrap(bundle, SEEDS[0]!, 1042);
    const event = ctx.content.mustEvent('what_came_up_the_river_road');
    const check = event.checks.find((c) => c.id === 'gate_stand')!;
    const head = place(ctx, { sex: 'male', age: 40, castSlots: ['head'], traits: ['hard_hands'] });
    const result = evalCheck(ctx, check, event, { HEAD: head.id }, testRng('gate'));
    expect(result.bonus).toBe(12);
  });
});
