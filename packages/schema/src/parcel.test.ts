import { describe, expect, it } from 'vitest';
import { ParcelDefS, RentPolicyS } from './parcel.js';

/**
 * Issue #93's own acceptance bar: "A parcels.yaml bundle the validator must
 * REJECT — a parcel with no place, or no provenance — not only one it
 * passes." `place` and `provenance` are issue #91's first design commitment
 * ("not a number with a name; a name with a number") made structural rather
 * than merely encouraged in a comment, so a template that skips either fails
 * to load at all rather than shipping a parcel nobody can point to.
 */
describe('ParcelDefS', () => {
  const valid = {
    id: 'test_farm',
    name: 'Test Farm',
    kind: 'tenant_farm',
    acres: 100,
    baseYield: 7,
    place: 'the near country',
    provenance: 'Held since the founding, like everything else on the roll.',
  };

  it('parses a well-formed parcel', () => {
    expect(ParcelDefS.safeParse(valid).success).toBe(true);
  });

  it('rejects a parcel with no place', () => {
    expect(ParcelDefS.safeParse({ ...valid, place: '' }).success).toBe(false);
  });

  it('rejects a parcel with no provenance', () => {
    expect(ParcelDefS.safeParse({ ...valid, provenance: '' }).success).toBe(false);
  });

  it('rejects a parcel of a kind the closed union does not name', () => {
    expect(ParcelDefS.safeParse({ ...valid, kind: 'castle' }).success).toBe(false);
  });

  it('defaults foundingHolding to true — the 1042 endowment need not say so', () => {
    const parsed = ParcelDefS.parse(valid);
    expect(parsed.foundingHolding).toBe(true);
    expect(parsed.marketable).toBe(true);
  });

  it('accepts a parcel marked as not yet held', () => {
    const parsed = ParcelDefS.parse({ ...valid, foundingHolding: false });
    expect(parsed.foundingHolding).toBe(false);
  });

  it('accepts a price for a zero-yield presence and rejects a free one', () => {
    expect(ParcelDefS.safeParse({ ...valid, kind: 'town_house', baseYield: 0, marketPrice: 180 }).success).toBe(true);
    expect(ParcelDefS.safeParse({ ...valid, kind: 'town_house', baseYield: 0, marketPrice: 0 }).success).toBe(false);
  });
});

describe('RentPolicyS', () => {
  it('names exactly customary, hard and rack', () => {
    expect(RentPolicyS.options).toEqual(['customary', 'hard', 'rack']);
    expect(RentPolicyS.safeParse('pressed').success).toBe(false);
  });
});
