import { z } from 'zod';

/**
 * THE LEDGER (concept §18).
 *
 * "The single largest structural risk in this design is promise debt: opening
 * a thousand-year mystery and paying nothing until hour eleven. The fix is
 * mechanical." The fix was a rule — **every Age reveals exactly one clause** —
 * and the rule was never built. `ActiveAge.paid.clause` existed in the schema
 * and was written by nothing, `clauseBearing` was validated and read by
 * nothing, and a measured thousand-year run recovered two clauses out of nine
 * from the three authored events that happen to grant one.
 *
 * The God rung requires seven. The endgame the whole game points at was
 * unreachable, and nothing said so.
 *
 * A clause is not flavour. Each one changes what is legally and mechanically
 * possible in 2042: what counts as payment, who may be substituted, whether a
 * Demigod is a person, what happens if the line ends before collection.
 */
export const ClauseDefS = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  /** What the family calls it once it is out. */
  name: z.string(),
  /** The contract's own words, entered in the chronicle in the contract's hand. */
  text: z.string(),
  /** What it changes at 2042, in the designer's words rather than the contract's. */
  effect: z.string(),
  /**
   * The one the player begins knowing (§18). Exactly one clause should carry
   * this, and it should be the one that makes the debt legible without making
   * it survivable.
   */
  known: z.boolean().default(false),
  /** Ordering hint for reveal. Low first — the early ones establish, the late ones cost. */
  weight: z.number().default(100),
  /**
   * Which Ages can reveal this clause (issue #4). `revealClause` draws from
   * the ACTIVE Age's assigned set rather than from global weight order, so
   * which clauses a run recovers varies by which Ages it drew, not only how
   * many. Every clause must be assigned to at least two Ages — the
   * `clause/ages` rule enforces it — or a clause pinned to one Age is a
   * clause some runs never see at all.
   */
  ages: z.array(z.string()).default([]),
});
export type ClauseDef = z.infer<typeof ClauseDefS>;

export const ClauseFileS = z.object({ clauses: z.array(ClauseDefS) });
