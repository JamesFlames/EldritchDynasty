import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { RESPECT_ORDER } from '@ed/schema';
import { heldParcels, landIncome, testWorld } from '@ed/core';

const bundle = loadContent();

/**
 * PHASE A'S WHOLE ACCEPTANCE BAR (issue #93): the house owns the same 1,400
 * acres either way — the only question is whether the number is looked up
 * or added up. The 1042 endowment's `baseYield` sums to exactly what the old
 * five-row lookup returned at each tier, scaled by the same fraction, so for
 * as long as nothing is bought, sold or lost `landIncome` must reproduce the
 * old table byte for byte. `npm run digest -- 8 400` is the same claim
 * proved over a played run; this is the claim proved directly, at every
 * tier, without waiting on the simulation to visit one.
 */
describe('landIncome', () => {
  const OLD_LOOKUP = { unknown: 16, known: 32, regarded: 62, eminent: 108, exalted: 175 } as const;

  it('reproduces the old flat Respect-tier lookup exactly, at every tier, in 1042', () => {
    for (const tier of RESPECT_ORDER) {
      const ctx = testWorld(bundle);
      ctx.world.respect = tier;
      expect(landIncome(ctx), `tier ${tier}`).toBeCloseTo(OLD_LOOKUP[tier], 10);
    }
  });

  it('scales down when the house no longer holds a parcel it started with', () => {
    const ctx = testWorld(bundle);
    ctx.world.respect = 'known';
    const before = landIncome(ctx);

    const [firstId, firstState] = [...ctx.world.parcels.entries()][0]!;
    ctx.world.parcels.set(firstId, { ...firstState, heldSince: ctx.world.year + 1 });

    expect(landIncome(ctx), 'losing a parcel must lower income, not leave it flat').toBeLessThan(before);
  });

  it('gives every held parcel its own id, detached from the map', () => {
    // The same guarantee `heldHeirlooms` makes: pulled out of the map, a
    // `ParcelState` still says which parcel it is.
    const ctx = testWorld(bundle);
    const held = heldParcels(ctx);
    expect(held.length).toBeGreaterThan(0);
    expect(new Set(held.map((p) => p.id)).size).toBe(held.length);
  });

  it('ignores a parcel not yet held this year', () => {
    const ctx = testWorld(bundle);
    ctx.world.respect = 'known';
    const [firstId, firstState] = [...ctx.world.parcels.entries()][0]!;
    ctx.world.parcels.set(firstId, { ...firstState, heldSince: ctx.world.year + 5 });
    const held = landIncome(ctx);

    ctx.world.parcels.set(firstId, { ...firstState, heldSince: ctx.world.year });
    const alsoHeld = landIncome(ctx);

    expect(held).toBeLessThan(alsoHeld);
  });
});
