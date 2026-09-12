import { z } from 'zod';

/**
 * WHO WAS STANDING WHERE, as it is written down.
 *
 * The persisted half of `SlotFill` (`core/src/events/slots.ts`). A slot holds
 * one person; a slot with `SlotSpec.count` holds a party, and a party is a
 * list. Both live in one map rather than in a map and a parallel list of
 * parties, because two structures that must agree eventually do not.
 *
 * A string is still valid on the way in, so every save written before counted
 * slots existed still parses — the union is a widening, and the format number
 * moved anyway (10 → 11) because a save written by this build is not readable
 * by one before it, which is the whole question the number answers.
 */
export const SlotFillS = z.record(z.string(), z.union([z.string(), z.array(z.string())]));
export type StoredSlotFill = z.infer<typeof SlotFillS>;
