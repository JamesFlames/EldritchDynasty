import { z } from 'zod';
import { PositionIdS } from './ids.js';

/**
 * POSITIONS (concept §6, world §10; issue #89, Stage 3 — #97).
 *
 * A career is what one man does for life. A position is what the HOUSE
 * stakes on one war, and it dies with the war — different owner, different
 * lifetime, stated here so nobody merges the two files in about two years.
 * `discountWithCareer` is how they talk without merging: a house with a man
 * already serving buys a captaincy cheaper, and the discount amount lives in
 * `core/src/muster.ts` as a tuned constant, the same way every other muster
 * number does — this field only needs to name the career.
 *
 * `minRespect`, `discountWithCareer` and the price/multiplier pairing are
 * plain strings and optional numbers here rather than a branded enum or a
 * required field, on the same reasoning `slots/counted`'s own comment gives:
 * a schema failure aborts the whole parse and never names the position. The
 * `war/wiring` rule in `rules.ts` is what actually enforces all three, and
 * names the offending position when it does not hold.
 */
export const PositionDefS = z.object({
  id: PositionIdS,
  name: z.string(),
  /** One-time cost to buy in. Absent for `none` — word gets around, and buying it costs nothing because there is nothing to buy. */
  price: z.number().nonnegative().optional(),
  /** Folded into `musterUpkeep`, on top of the per-man cost. */
  perYear: z.number().nonnegative().default(0),
  /**
   * Applied to credit accrual in `tickMuster`. Required whenever `price` is —
   * `war/wiring` rejects a position with one and not the other, rather than
   * defaulting the missing one and going quiet about it.
   */
  multiplier: z.number().positive().optional(),
  /** A `RespectTier` name, checked against `RESPECT_ORDER` by `war/wiring`. */
  minRespect: z.string().optional(),
  /** A `military`-shaped commission already serving discounts this one. Checked against `content.career` by `war/wiring`. */
  discountWithCareer: z.string().optional(),
  /** The buy is refused unless some officer on the standing commitment is at least this old. */
  requiresOfficerAged: z.number().int().nonnegative().optional(),
});
export type PositionDef = z.infer<typeof PositionDefS>;

export const PositionFileS = z.object({ positions: z.array(PositionDefS) });
