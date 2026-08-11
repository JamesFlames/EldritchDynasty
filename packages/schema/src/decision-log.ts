import { z } from 'zod';

/**
 * THE DECISION LOG (issue #8, phase 1).
 *
 * `saveGame` / `loadGame` make a run a SNAPSHOT — loading is O(1), but a
 * snapshot says nothing about how the house got there. This is the
 * append-only record beside it: which choice, which outcome, who was cast,
 * which Record option, which child got which name. It is what lets the
 * harness bisect a balance change and what makes a bug reported eleven hours
 * into somebody's playthrough reproducible at all.
 *
 * A closed union ending in `assertNever`, on the same discipline `EffectS`
 * runs under: a new kind of decision is a compile error at its one consumer,
 * not a silent gap in the record.
 *
 * Deliberately NARROW. Only decisions with a genuinely EXTERNAL answer are
 * logged — one a human chose, or the chronicler chose on their behalf at a
 * specific moment. Everything else in a run (mortality, marriages, births,
 * the whole shape of a year) is already reproducible from the seed alone;
 * logging it too would make the log a second copy of the save rather than
 * the thing the snapshot is missing.
 */
export const LoggedDecisionS = z.discriminatedUnion('kind', [
  /**
   * A narration outcome or an answered choice. `choiceId` is absent for
   * narration, which has nothing to choose — the outcome still rolls, and
   * still gets a line, but nobody decided anything. `fill` is the full slot
   * assignment the effects actually ran against, so a player-cast slot
   * replays as what was cast rather than being re-rolled.
   */
  z.object({
    kind: z.literal('outcome'),
    year: z.number(),
    event: z.string(),
    choiceId: z.string().optional(),
    outcomeId: z.string(),
    fill: z.record(z.string(), z.string()),
  }),
  /** Record / Omit / Embellish. Not a choice outcome — `applyRecord` never runs through `commitOutcome`. */
  z.object({
    kind: z.literal('record'),
    year: z.number(),
    event: z.string(),
    option: z.enum(['record', 'omit', 'embellish']),
  }),
  /** A newborn renamed. `renameChild` mutates `takenNames`, which feeds every later name roll. */
  z.object({
    kind: z.literal('name'),
    year: z.number(),
    person: z.string(),
    name: z.string(),
  }),
]);
export type LoggedDecision = z.infer<typeof LoggedDecisionS>;
