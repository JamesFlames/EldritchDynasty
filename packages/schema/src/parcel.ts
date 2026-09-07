import { z } from 'zod';
import { ParcelIdS } from './ids.js';

/**
 * LAND (concept §13, world §5/§12; issue #91).
 *
 * `core/src/economy.ts:219` has read "Income derives from holdings, modified
 * by the Head's Charm and standing" since the economy existed, over a
 * five-row lookup on the Respect tier — a comment describing a system that
 * was never built. This is the substrate: `ParcelKind` is closed (invariant
 * 5), so every site handling one ends in `assertNever` and a kind added to
 * the schema without a yield rate or a place in `land.ts`'s `landIncome`
 * cannot compile quietly.
 *
 * PHASE A calibrates the 1042 endowment so `landIncome` returns EXACTLY what
 * the old Respect lookup did, at every tier, for as long as nothing is
 * bought, sold or lost — see `core/src/land.ts`. Later phases (issue #91,
 * Phase B on) let the sum actually move, which is the whole point of
 * building this now rather than leaving the comment at line 219 wrong.
 */
export const ParcelKindS = z.enum(['tenant_farm', 'mill', 'woodland', 'common', 'demesne']);
export type ParcelKind = z.infer<typeof ParcelKindS>;

export const ParcelDefS = z.object({
  id: ParcelIdS,
  name: z.string(),
  kind: ParcelKindS,
  /** Real acreage, out of the house's roughly 1,400 (world §5) — descriptive for now, and what Phase F measures moving. */
  acres: z.number().positive(),
  /**
   * The parcel's own economic weight, in the units `landIncome` sums to a
   * crown figure. Not a price and not a flat yield-per-acre rate: the mill
   * is twenty acres and outweighs any three of the farms, and a formula that
   * only multiplied acres by a kind rate could not say so.
   */
  baseYield: z.number().nonnegative(),
  /**
   * WHERE IT IS, and where it came from — issue #91's first design
   * commitment: "not a number with a name; a name with a number." `place` is
   * a location this world already has (world §5's near country); `provenance`
   * is how the house came to hold it. Both required and both non-empty:
   * `parcels/wiring` rejects a bundle missing either.
   */
  place: z.string().min(1),
  provenance: z.string().min(1),
});
export type ParcelDef = z.infer<typeof ParcelDefS>;

export const ParcelFileS = z.object({ parcels: z.array(ParcelDefS) });

/**
 * OWNERSHIP, AT RUNTIME. `id` is a COUNTER-GENERATED instance id
 * (`counters.parcel`, the same shape `nextPersonId` already uses — every
 * stateful thing in this codebase gets one, decoupled from any authored
 * template), not the content id: Phase C mints parcels an author never
 * wrote (an assart, a drained strip), and those need an id with no
 * `ParcelDef` behind them at all. `defId` is that def, absent for exactly
 * that case.
 *
 * `id` duplicates `WorldState.parcels`' own map key, the same redundancy
 * `HeirloomState` and `LibraryBookState` already carry, so a parcel read out
 * of the map stays self-describing.
 *
 * `heldSince` is read by `landIncome`: a parcel somehow dated into the
 * future does not count toward this year's income, which will matter the
 * moment Phase B can create one mid-run.
 */
export interface ParcelState {
  id: string;
  /** The authored parcel this is. Absent for one Phase C mints with no `ParcelDef` behind it. */
  defId?: string;
  heldSince: number;
}
