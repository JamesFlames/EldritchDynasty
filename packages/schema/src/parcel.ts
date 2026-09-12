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
export const ParcelKindS = z.enum([
  'tenant_farm', 'mill', 'woodland', 'common', 'demesne',
  'slate_work', 'sarrow_bottom', 'town_house', 'wetland',
]);
export type ParcelKind = z.infer<typeof ParcelKindS>;

/** The three terms a steward can keep the rent roll on (issue #100). */
export const RentPolicyS = z.enum(['customary', 'hard', 'rack']);
export type RentPolicy = z.infer<typeof RentPolicyS>;

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
   * An authored price for holdings whose value is not proportional to annual
   * produce. Bramme's house yields no rent at all, but its town presence is
   * not free; the Sarrow bottom includes access to the book road.
   */
  marketPrice: z.number().positive().optional(),
  /**
   * WHERE IT IS, and where it came from — issue #91's first design
   * commitment: "not a number with a name; a name with a number." `place` is
   * a location this world already has (world §5's near country); `provenance`
   * is how the house came to hold it. Both required and both non-empty:
   * `parcels/wiring` rejects a bundle missing either.
   */
  place: z.string().min(1),
  provenance: z.string().min(1),
  /**
   * TRUE FOR THE 1042 ENDOWMENT, false for a parcel the house does not yet
   * hold (issue #94, Phase B) — a neighbour's ground that may come onto the
   * market, but was never the house's to begin with. `createWorld` seeds a
   * `ParcelState` only for the ones marked true; the rest exist in content,
   * unheld, until `buy` mints one.
   */
  foundingHolding: z.boolean().default(true),
  /** False when an authored acquisition route, rather than the ordinary fair, owns this deed. */
  marketable: z.boolean().default(true),
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
  /**
   * WHAT AN `improve` ORDER BOUGHT (issue #94, Phase B), added to `def.baseYield`
   * by `landIncome`. On the state, not the def: the def is authored and read-only,
   * and the same farm sold and later bought back again starts again at zero — the
   * drainage work does not travel with a deed nobody worked to earn.
   */
  yieldBonus?: number;
  /**
   * This year's risk result (issue #100). Rewritten by the land phase and
   * saved because the economy phase has not necessarily read it when a save
   * is taken. Absent means the stable baseline of 1.
   */
  yieldFactor?: number;
  /**
   * WHAT THE PLAYER CALLS IT (issue #96, Phase C). `session.nameParcel()`
   * writes this; the def's own `name` is authored and read-only, so a nicknamed
   * farm and a def-less parcel Phase C mints (an assart, a drained strip) both
   * need somewhere the player's own word can live. The plat reads this before
   * `def.name`, when present.
   */
  name?: string;
  /**
   * WHETHER THE HOUSE'S OWN COPY IS BACKED BY THE NOTARY'S BOOK (issue #96;
   * world §8, §12). Absent means true — every parcel the house is seeded with
   * or buys outright is proved by construction, and only a drawn doubt marks
   * this false. `false` with `contestedBy` unset is "title not proved": the
   * house's copy exists and nobody else's does either, so the ground is real
   * but the paper is not. See `contestedBy` for the sharper case.
   */
  titleProved?: boolean;
  /**
   * SOMEBODY ELSE'S TERRIER NAMES THIS GROUND TOO (issue #96) — the
   * Discrepancy system (world §16) pointed at ground rather than at the
   * chronicle. A name for the plat to draw against the house's own claim,
   * both at once and neither adjudicated: the game does not decide whose
   * book is right (invariant: no narrator who knows the truth). Absent means
   * uncontested.
   */
  contestedBy?: string;
}
