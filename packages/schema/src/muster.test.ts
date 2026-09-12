import { describe, expect, it } from 'vitest';
import { CommitmentS, emptyMusterState, musterEscalation, MUSTER_TIDE_START } from './muster.js';

describe('emptyMusterState', () => {
  it('starts with no commitments and the tide at its middle', () => {
    const state = emptyMusterState();
    expect(state.commitments).toEqual([]);
    expect(state.tide).toBe(MUSTER_TIDE_START);
  });
});

describe('CommitmentS', () => {
  const valid = {
    id: 'must_1',
    began: 1200,
    age: 'the_wars',
    men: 11,
    from: { br_a: 7, br_b: 4 },
    officers: ['per_1'],
    credit: 0,
    status: 'in_the_field',
  };

  it('parses a well-formed commitment', () => {
    expect(CommitmentS.safeParse(valid).success).toBe(true);
  });

  it('position is optional — a war fought under no banner', () => {
    const parsed = CommitmentS.parse(valid);
    expect(parsed.position).toBeUndefined();
  });

  it('rejects a status the closed union does not name', () => {
    expect(CommitmentS.safeParse({ ...valid, status: 'ongoing' }).success).toBe(false);
  });
});

/**
 * THE ESCALATION LEVER: a pure function of the settled-commitment count,
 * unit-tested at 0, 1 and 6 prior commitments per the design comment on
 * issue #95. No world, no RNG — if this needed either, it would be reading
 * something invariant 6 says derived state may not store.
 */
describe('musterEscalation', () => {
  it('is 1 (no escalation) with no prior settled commitments', () => {
    expect(musterEscalation(0)).toBe(1);
  });

  it('rises with each prior settled commitment', () => {
    const zero = musterEscalation(0);
    const one = musterEscalation(1);
    const six = musterEscalation(6);
    expect(one).toBeGreaterThan(zero);
    expect(six).toBeGreaterThan(one);
  });

  it('compounds — six is not merely six times one step', () => {
    // (1+step)^6 vs 1+6*step: compounding must have overtaken the linear estimate.
    const step = musterEscalation(1) - 1;
    expect(musterEscalation(6)).toBeGreaterThan(1 + 6 * step);
  });
});
