import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { order, phase, place, testWorld } from '@ed/core';

const bundle = loadContent();

/**
 * THE SCION IS FED, AND A HALL NOTICES (issue #61, Stage C).
 *
 * Concentration is not a free mechanic — see `people/branches.ts`'s own
 * `GRIEVANCE_SCION_FED`. This is deterministic and fast on purpose: `tickBranches`
 * takes no `rng`, so a single call either moves the two halls apart or it does
 * not, and there is nothing here that needs a played run to see.
 */
describe('the scion is fed, and a hall notices (issue #61, Stage C)', () => {
  it('raises grievance in the hall that is not his, and not in the one that is', () => {
    const ctx = testWorld(bundle, 7701);
    const w = ctx.world;

    // SAME NAME, SAME AGE, on purpose: `place`'s genome is a pure function of
    // name and age, so this gives both cousins the identical roll on
    // whether either of them can express — the one thing that would
    // otherwise make one branch's `passedOver` term differ from the
    // other's for a reason that has nothing to do with the scion.
    const scionMember = place(ctx, { sex: 'male', age: 30, name: 'A Cousin', branch: 'branch_scion' });
    const otherMember = place(ctx, { sex: 'male', age: 30, name: 'A Cousin', branch: 'branch_other' });
    w.branches.set('branch_scion' as never, {
      id: 'branch_scion', name: 'Scion Hall', house: w.playerHouse, founder: scionMember.id,
      splitFrom: 'main', foundedYear: w.year - 30, grievance: 10,
    } as never);
    w.branches.set('branch_other' as never, {
      id: 'branch_other', name: 'Other Hall', house: w.playerHouse, founder: otherMember.id,
      splitFrom: 'main', foundedYear: w.year - 30, grievance: 10,
    } as never);

    expect(order(ctx, { kind: 'scion', person: scionMember.id }).ok).toBe(true);

    phase('branches', ctx);

    const scionHall = w.branches.get('branch_scion' as never)!;
    const otherHall = w.branches.get('branch_other' as never)!;
    expect(
      otherHall.grievance,
      'the hall without the scion did not end the year more aggrieved than the hall with him',
    ).toBeGreaterThan(scionHall.grievance);
  });

  it('adds nothing when nobody has been named', () => {
    const ctx = testWorld(bundle, 7702);
    const w = ctx.world;
    const member = place(ctx, { sex: 'male', age: 30, name: 'A Cousin', branch: 'branch_only' });
    w.branches.set('branch_only' as never, {
      id: 'branch_only', name: 'Only Hall', house: w.playerHouse, founder: member.id,
      splitFrom: 'main', foundedYear: w.year - 30, grievance: 10,
    } as never);

    phase('branches', ctx);

    // No scion at all: whatever moved it, it was not this issue's addition.
    // `GRIEVANCE_FADE` alone can only ever move it down.
    expect(w.branches.get('branch_only' as never)!.grievance).toBeLessThanOrEqual(10);
  });
});

/**
 * THE HEIR IS FED TOO, AND A HALL NOTICES TWICE (issue #61, Stage E4).
 *
 * `GRIEVANCE_SCION_FED` is added a second time when a hall holds neither
 * the Scion nor the heir — the programme now costs the rest of the family
 * twice over, not once, and a hall passed over for both should end the
 * year more aggrieved than one passed over for only one of them.
 */
describe('the heir is fed too, and a hall notices twice (issue #61, Stage E4)', () => {
  it('a hall holding neither ends more aggrieved than a hall holding one of the pair', () => {
    const ctx = testWorld(bundle, 7703);
    const w = ctx.world;

    // SAME NAME, SAME AGE across all three, for the same reason the Scion's
    // own test uses it: an identical roll on canExpress for every founder,
    // so nothing but the programme itself can move one hall's grievance
    // differently from another's.
    const scionMember = place(ctx, { sex: 'male', age: 30, name: 'A Cousin', branch: 'branch_scion' });
    const heirMember = place(ctx, { sex: 'male', age: 30, name: 'A Cousin', branch: 'branch_heir' });
    const neitherMember = place(ctx, { sex: 'male', age: 30, name: 'A Cousin', branch: 'branch_neither' });
    w.branches.set('branch_scion' as never, {
      id: 'branch_scion', name: 'Scion Hall', house: w.playerHouse, founder: scionMember.id,
      splitFrom: 'main', foundedYear: w.year - 30, grievance: 10,
    } as never);
    w.branches.set('branch_heir' as never, {
      id: 'branch_heir', name: 'Heir Hall', house: w.playerHouse, founder: heirMember.id,
      splitFrom: 'main', foundedYear: w.year - 30, grievance: 10,
    } as never);
    w.branches.set('branch_neither' as never, {
      id: 'branch_neither', name: 'Neither Hall', house: w.playerHouse, founder: neitherMember.id,
      splitFrom: 'main', foundedYear: w.year - 30, grievance: 10,
    } as never);

    expect(order(ctx, { kind: 'scion', person: scionMember.id }).ok).toBe(true);
    expect(order(ctx, { kind: 'scionHeir', person: heirMember.id }).ok).toBe(true);

    phase('branches', ctx);

    const scionHall = w.branches.get('branch_scion' as never)!;
    const heirHall = w.branches.get('branch_heir' as never)!;
    const neitherHall = w.branches.get('branch_neither' as never)!;
    expect(
      neitherHall.grievance,
      'a hall holding neither did not end more aggrieved than one holding the Scion',
    ).toBeGreaterThan(scionHall.grievance);
    expect(
      neitherHall.grievance,
      'a hall holding neither did not end more aggrieved than one holding the heir',
    ).toBeGreaterThan(heirHall.grievance);
  });
});
