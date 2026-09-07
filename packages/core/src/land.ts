import type { ParcelState, RespectTier } from '@ed/schema';
import type { SimCtx } from './world.js';

/**
 * LAND INCOME (concept §13, world §5/§12; issue #91, Phase A — issue #93).
 *
 * `economy.ts:219` said "Income derives from holdings, modified by the
 * Head's Charm and standing" over a five-row lookup on the Respect tier —
 * true of the comment and false of the code. This is what makes it true:
 * income is the sum of what the house currently holds (`ctx.content.parcel`
 * for the definition, `heldSince` on `WorldState.parcels` for whether it
 * counts yet), not a number read off a table.
 *
 * THE CALIBRATION (Phase A's whole acceptance bar): the 1042 endowment's
 * `baseYield` sums to exactly `TOTAL_1042_YIELD`, and this function scales
 * that sum by `INCOME_BY_RESPECT[tier] / TOTAL_1042_YIELD` — so for as long
 * as nothing is bought, sold or lost, `landIncome` returns EXACTLY what the
 * old lookup did, at every tier, every year. `npm run digest -- 8 400` is
 * the proof: the block must not move. The moment a parcel changes hands
 * (issue #91, Phase B on), the held sum diverges from 1042's and income
 * starts actually depending on what the house has, which is the entire
 * point of building this substrate now.
 */
const INCOME_BY_RESPECT: Record<RespectTier, number> = {
  unknown: 16,
  known: 32,
  regarded: 62,
  eminent: 108,
  exalted: 175,
};

/** The sum of every `baseYield` in the 1042 endowment (`parcels.yaml`). Fixed; not recomputed from content. */
const TOTAL_1042_YIELD = 140;

/**
 * The parcels the house currently holds, detached from the map — the same
 * shape `heldHeirlooms` returns for the same reason: once pulled out of
 * `WorldState.parcels`, a `ParcelState` needs its own `id` to still say which
 * parcel it is, which is exactly why that field duplicates the map key
 * rather than leaning on it.
 */
export function heldParcels(ctx: SimCtx): ParcelState[] {
  const w = ctx.world;
  return [...w.parcels.values()].filter((state) => state.heldSince <= w.year);
}

export function landIncome(ctx: SimCtx): number {
  let held = 0;
  for (const state of heldParcels(ctx)) {
    if (!state.defId) continue;
    const def = ctx.content.parcel(state.defId);
    if (def) held += def.baseYield;
  }
  return held * (INCOME_BY_RESPECT[ctx.world.respect] / TOTAL_1042_YIELD);
}
