import { z } from 'zod';

/**
 * THE ASCENSION LADDER's six rungs, plus the ground (concept §22).
 *
 * Here rather than in `core/src/ascension.ts` because both the save format and
 * the condition union need it, and a hand-written second copy of a closed union
 * is the one thing this codebase refuses to keep (`CLAUDE.md`, "Do not").
 */
export const RungS = z.enum([
  'none', 'touched', 'adept', 'hierophant', 'vessel', 'demigod', 'god',
]);
export type Rung = z.infer<typeof RungS>;

/** Ordering, for "at least this rung". */
export const RUNG_ORDER: readonly Rung[] = RungS.options;
