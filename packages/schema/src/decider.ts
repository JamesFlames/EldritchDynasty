import { z } from 'zod';
import { ConditionS } from './conditions.js';

/**
 * WHO TAKES THE BRANCH.
 *
 * An event with more than one branch has always had exactly two answers to
 * "who decides" — the player, from the docket, or the dice, by outcome weight.
 * Both are in the design and neither is the whole of it. A house whose treasury
 * is empty does not deliberate about the tithe; it pays or it does not, and the
 * ledger has already said which. A party sent into a flooded undercroft is not
 * choosing what happens down there either — the player chose WHO WENT, and what
 * those four people are between them decides the rest.
 *
 * So the decider is a field, and a closed one. Four kinds:
 *
 *   player   the docket stops the clock and asks. What `choice` has always meant.
 *   chance   a weighted draw over the branches. What `narration` has always meant,
 *            made available to an event that has several branches worth naming.
 *   state    a LADDER of guards over the same `Condition` vocabulary every other
 *            gate reads, taken top down. The family's own condition decides.
 *   party    a `Check` the event declares, whose bands name CHOICE ids. The
 *            player casts the `castBy: player` slots — that is his decision —
 *            and the pooled condition of exactly those people decides the rest.
 *
 * `party` is built entirely out of parts that already worked in isolation and
 * could not be composed: `dispatch` let the player cast a party, `PoolSpec` had
 * `party_sum` and `family_any`, and `evalCheck` evaluated both. What was missing
 * was any way for a check to pick a BRANCH rather than an outcome inside a branch
 * the player had already picked, which is precisely what a delegated decision is.
 */

/**
 * One rung. Read top down; the first whose `when` holds takes the choice it
 * names. A rung with no `when` always holds, which is how an author writes the
 * `else` — and a ladder without one falls through to `chance` rather than
 * stalling the year.
 */
export const StateRungS = z.object({
  when: ConditionS.optional(),
  /** The choice id this rung takes. */
  take: z.string(),
  /** Shown in the editor's branch trace and in the reason a decision logs. */
  because: z.string().optional(),
});
export type StateRung = z.infer<typeof StateRungS>;

export const DeciderS = z.union([
  z.literal('player'),
  z.literal('chance'),
  z.object({ state: z.array(StateRungS).min(1, 'a ladder needs at least one rung') }),
  z.object({ party: z.object({ check: z.string() }) }),
]);
export type Decider = z.infer<typeof DeciderS>;

/** The tag a `Decider` discriminates on, for switches and for the editor's kind selector. */
export type DeciderKind = 'player' | 'chance' | 'state' | 'party';

export function deciderKind(d: Decider): DeciderKind {
  if (d === 'player' || d === 'chance') return d;
  return 'state' in d ? 'state' : 'party';
}
