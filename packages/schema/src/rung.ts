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

/**
 * THE RITES (concept §22, issue #43).
 *
 * Three of the six rungs are not bought with blood and books at all. They are
 * bought with an act somebody in the family has to agree to, and §22 names all
 * three: the Vessel's living sacrifice, the Great Rite the Church either
 * sanctions or is defied over, and the unmaking of a living Demigod to raise a
 * younger man past him.
 *
 * A closed union, like every other verb list here (invariant 5), because the
 * rite is the LAST requirement of its rung — `gateFor` in `core/ascension.ts`
 * names it as the thing still missing, and a person who has taken one carries
 * it on their record forever. A rite half-declared is a rung nothing can ever
 * reach, which is exactly how these three rungs stood before this existed.
 */
export const RiteS = z.enum(['vessel', 'great_rite', 'unmaking']);
export type Rite = z.infer<typeof RiteS>;

/** Which rung each rite is the last requirement of. */
export const RITE_OF_RUNG: Readonly<Record<'vessel' | 'demigod' | 'god', Rite>> = {
  vessel: 'vessel',
  demigod: 'great_rite',
  god: 'unmaking',
};
