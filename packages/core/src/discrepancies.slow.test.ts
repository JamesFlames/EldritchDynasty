import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import type { BranchId, BranchState } from '@ed/schema';
import { asId, RESPECT_ORDER } from '@ed/schema';
import {
  applyEffect, bootstrap, evalCondition, grantHeirloom, place,
  runYears, selectEvents, testRng, testWorld, transferHeirloom,
} from '@ed/core';

const bundle = loadContent();
const SEEDS = [1042, 77, 909, 5150, 8080, 31];

/**
 * MAKING DISCREPANCIES READABLE (issue #9, phase 2).
 *
 * `world.discrepancies` was written on every Embellish, saved and restored
 * faithfully, and read by nothing: no condition kind, no selection pressure,
 * no Respect consequence. Record/Omit/Embellish — "you are not hiding
 * Madness, you are maintaining a story" — cost the player nothing. This file
 * covers the four pieces that wire it up, plus the two silent bugs fixed in
 * passing.
 */
describe('the discrepancy condition', () => {
  it('checks existence when state is omitted, and exact state when given', () => {
    const ctx = testWorld(bundle);
    expect(evalCondition({ discrepancy: 'x' }, ctx)).toBe(false);

    ctx.world.discrepancies.set('x', { severity: 'minor', provableBy: [], state: 'open' });
    expect(evalCondition({ discrepancy: 'x' }, ctx)).toBe(true);
    expect(evalCondition({ discrepancy: 'x', state: 'open' }, ctx)).toBe(true);
    expect(evalCondition({ discrepancy: 'x', state: 'proven' }, ctx)).toBe(false);
  });

  it('counts open ones for the aggregate form', () => {
    const ctx = testWorld(bundle);
    expect(evalCondition({ openDiscrepancies: { op: 'gte', value: 1 } }, ctx)).toBe(false);

    ctx.world.discrepancies.set('a', { severity: 'minor', provableBy: [], state: 'open' });
    ctx.world.discrepancies.set('b', { severity: 'minor', provableBy: [], state: 'proven' });
    expect(evalCondition({ openDiscrepancies: { op: 'gte', value: 1 } }, ctx)).toBe(true);
    expect(evalCondition({ openDiscrepancies: { op: 'gte', value: 2 } }, ctx)).toBe(false);
  });
});

describe('proving a Discrepancy', () => {
  it('costs Respect a full tier', () => {
    const ctx = testWorld(bundle);
    ctx.world.discrepancies.set('x', { severity: 'minor', provableBy: [], state: 'open' });
    ctx.world.respect = 'eminent';

    applyEffect({ kind: 'discrepancy', op: 'prove', id: 'x' }, ctx, {});

    expect(ctx.world.discrepancies.get('x')?.state).toBe('proven');
    expect(RESPECT_ORDER.indexOf(ctx.world.respect)).toBe(RESPECT_ORDER.indexOf('eminent') - 1);
    expect(ctx.world.respectChanged).toBe(ctx.world.year);
  });

  it('never drops standing below the floor', () => {
    const ctx = testWorld(bundle);
    ctx.world.discrepancies.set('x', { severity: 'minor', provableBy: [], state: 'open' });
    ctx.world.respect = 'unknown';

    applyEffect({ kind: 'discrepancy', op: 'prove', id: 'x' }, ctx, {});
    expect(ctx.world.respect).toBe('unknown');
  });

  it('a bury does not touch Respect', () => {
    const ctx = testWorld(bundle);
    ctx.world.discrepancies.set('x', { severity: 'minor', provableBy: [], state: 'open' });
    ctx.world.respect = 'eminent';

    applyEffect({ kind: 'discrepancy', op: 'bury', id: 'x' }, ctx, {});
    expect(ctx.world.discrepancies.get('x')?.state).toBe('buried');
    expect(ctx.world.respect).toBe('eminent');
  });

  /** The bug `the_thin_papers` shipped with: an id nothing ever creates. */
  it('does nothing to an id that was never created', () => {
    const ctx = testWorld(bundle);
    ctx.world.respect = 'eminent';

    applyEffect({ kind: 'discrepancy', op: 'prove', id: 'never_created' }, ctx, {});
    expect(ctx.world.discrepancies.has('never_created')).toBe(false);
    expect(ctx.world.respect, 'proving a phantom discrepancy still moved Respect').toBe('eminent');
  });
});

describe('heirloom transfer, the other silent bug', () => {
  it('removes it from the house\'s holdings', () => {
    const ctx = testWorld(bundle);
    const id = bundle.heirlooms[0]!.id;
    grantHeirloom(ctx, id);
    expect(ctx.world.heirlooms.has(id)).toBe(true);

    applyEffect({ kind: 'heirloom', op: 'transfer', heirloom: id }, ctx, {});
    expect(ctx.world.heirlooms.has(id)).toBe(false);
  });

  it('is a no-op rather than a throw when the house never held it', () => {
    const ctx = testWorld(bundle);
    expect(() => applyEffect({ kind: 'heirloom', op: 'transfer', heirloom: 'nothing_the_house_owns' }, ctx, {}))
      .not.toThrow();
  });
});

describe('the PRESSURE selection pass', () => {
  /**
   * `the_accounts_of_the_smaller_house` is the one authored template gated on
   * `branchGrievance`, so it is the only thing that can prove this pass draws
   * from a narrower, prioritised pool rather than merely being eligible for
   * the ambient lottery. Direct construction rather than four hundred
   * simulated years: `foundBranch` is what produces this state in a real run,
   * but the condition only reads `grievance`, so building one by hand is a
   * faithful shortcut, not a shortcut around the mechanism.
   */
  it('draws state-gated content ahead of the ambient lottery once the state holds', () => {
    let sawPressure = 0;
    for (let trial = 0; trial < 12; trial++) {
      const ctx = testWorld(bundle, 2000 + trial, 1042);
      ctx.world.generation = 1; // the_accounts_of_the_smaller_house is uncommon: minGeneration 1
      const head = place(ctx, { sex: 'male', age: 45, castSlots: ['head'] });
      const cousin = place(ctx, { sex: 'male', age: 30 });
      cousin.membership[0]!.kind = 'cadet';

      const branchId = asId<BranchId>(`br_test_${trial}`);
      const branch: BranchState = {
        id: branchId,
        name: 'Test Branch',
        house: head.houseOfOrigin,
        founder: cousin.id,
        splitFrom: 'main',
        foundedYear: ctx.world.year - 10,
        grievance: 60,
      };
      ctx.world.branches.set(branchId, branch);

      const candidates = selectEvents(ctx, testRng('pressure', trial), 1);
      if (candidates.some((c) => c.event.id === 'the_accounts_of_the_smaller_house' && c.source === 'pressure')) {
        sawPressure += 1;
      }
    }
    expect(sawPressure, 'never drew the grievance-gated event as a pressure candidate in 12 trials').toBeGreaterThan(0);
  });
});

describe('a Discrepancy reaching proven (acceptance)', () => {
  it('reaches proven in a headless run', () => {
    let provenSomewhere = false;
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 1000);
      if ([...ctx.world.discrepancies.values()].some((d) => d.state === 'proven')) provenSomewhere = true;
    }
    expect(provenSomewhere, 'no Discrepancy reached proven across any of the standard seeds').toBe(true);
  });
});
