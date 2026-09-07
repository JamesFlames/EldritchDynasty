import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import {
  activeCommitment, addOfficer, beginCommitment, bootstrap, END_YEAR, expectHealthyWorld,
  loadGame, reinforceCommitment, runYears, saveGame, setPosition, testRng, tickMuster,
} from '@ed/core';

const bundle = loadContent();

/**
 * ISSUE #95's ACCEPTANCE, PLAYED RATHER THAN ASSERTED IN THE ABSTRACT.
 *
 * `muster.test.ts` proves each function does what its name says in
 * isolation; this file proves two things only a played world can: a live
 * commitment is exactly as save-durable as everything else on `WorldState`
 * (invariant "a field on the world must reach the save format" — the
 * failure mode is a field that resets silently, which looks identical to a
 * working save until a player two centuries in loses the war they were
 * fighting), and a commitment left standing for a full run — the honest
 * state of the world before #97 wires a settlement event to end one — never
 * drives the house negative on men or extinct on people.
 */
describe('a live commitment survives being written down', () => {
  it('round-trips every field a player could have set — men, officers, position, credit, tide', () => {
    const before = bootstrap(bundle, 1042, 1042);
    const officerA = before.world.people.household(before.world.playerHouse, before.world.year)[0]!;

    const c = beginCommitment(before, 5, 'the_wars');
    reinforceCommitment(before, 3, 'branch_a');
    addOfficer(before, officerA.id);
    setPosition(before, 'a_captaincy');
    tickMuster(before, testRng('muster-save')); // moves the tide and accrues credit off zero
    before.world.muster.tide = 63;

    expect(c.men).toBeGreaterThan(0);
    expect(c.credit).toBeGreaterThan(0);

    const after = loadGame(JSON.parse(JSON.stringify(saveGame(before))), bundle);
    const restored = activeCommitment(after);

    expect(restored).toBeDefined();
    expect(restored!.id).toBe(c.id);
    expect(restored!.men).toBe(c.men);
    expect(restored!.officers).toEqual(c.officers);
    expect(restored!.position).toBe(c.position);
    expect(restored!.credit).toBe(c.credit);
    expect(restored!.from).toEqual(c.from);
    expect(after.world.muster.tide).toBe(before.world.muster.tide);
  });

  it('round-trips the tide and lastSettled with no commitment standing, too', () => {
    const before = bootstrap(bundle, 909, 1042);
    before.world.muster.tide = 71;
    beginCommitment(before, 5, 'the_wars');
    const c = activeCommitment(before)!;
    c.status = 'settled';
    before.world.muster.lastSettled = before.world.year;

    const after = loadGame(JSON.parse(JSON.stringify(saveGame(before))), bundle);

    expect(activeCommitment(after)).toBeUndefined();
    expect(after.world.muster.tide).toBe(71);
    expect(after.world.muster.lastSettled).toBe(before.world.year);
    expect(after.world.muster.commitments[0]!.status).toBe('settled');
  });
});

/**
 * A COMMITMENT NOBODY EVER SETTLES IS THE HONEST CASE UNTIL #97.
 *
 * `the_settlement` (`arc_the_muster`'s own docketed event) is what will
 * eventually close one out; wiring it to the `muster` effect is Stage 3, not
 * this issue. So the state this issue actually ships a house into, for the
 * whole of a played run, is a war that never ends — and that has to be safe:
 * men never negative, upkeep never a term that empties the treasury into
 * something else breaking, and officer mortality — small per invariant 2's
 * neighbourly `careerMortality` term, real all the same — never enough on
 * its own to take a house to zero.
 */
describe('a commitment left standing for a whole run', () => {
  const SEEDS = [1042, 2201, 3311, 4455, 5566];

  it('never runs men negative, and leaves the world internally coherent at 2042', () => {
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      const founders = ctx.world.people.household(ctx.world.playerHouse, ctx.world.year);
      const c = beginCommitment(ctx, 10, 'the_wars');
      for (const p of founders.slice(0, 2)) addOfficer(ctx, p.id);

      let minMen = c.men;
      while (ctx.world.year < END_YEAR) {
        runYears(ctx, 1);
        minMen = Math.min(minMen, c.men);
      }

      expect(minMen, `seed ${seed}: men went negative`).toBeGreaterThanOrEqual(0);
      expect(ctx.world.year).toBe(END_YEAR);
      expectHealthyWorld(ctx);
    }
  });

  it('does not, on its own, take the player house extinct', () => {
    let alive = 0;
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      const founders = ctx.world.people.household(ctx.world.playerHouse, ctx.world.year);
      beginCommitment(ctx, 10, 'the_wars');
      for (const p of founders.slice(0, 2)) addOfficer(ctx, p.id);

      runYears(ctx, END_YEAR - ctx.world.year);

      if (ctx.world.people.household(ctx.world.playerHouse, END_YEAR).length > 0) alive += 1;
    }
    expect(alive, `houses alive at 2042 out of ${SEEDS.length}`).toBeGreaterThan(SEEDS.length / 2);
  });
});
