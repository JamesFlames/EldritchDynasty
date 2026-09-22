import type { Genome } from './genome.js';
import type { Year } from './ids.js';
import type { Sex } from './attributes.js';

/**
 * RIVAL-HOUSE DESCENT (issue #24 item 6).
 *
 * The design accepted for rival genetics is that every person's genome is
 * already materialized from their OWN house's real `genePool`
 * (`people/factory.ts`), so a rival's daughter draws faithfully from her
 * house's font and deleterious frequencies rather than a generic pool. What
 * was missing is DESCENT: each new rival character was an independent draw
 * from a static frequency table, not a child of a previously-materialized
 * rival ancestor through real meiosis.
 *
 * This is that lineage, and it is deliberately shallow. A `RivalPerson` is a
 * genealogical fact and nothing else — no membership, no career, no cast
 * slots, no chronicle, no docket. Its only reader is `people/rivals.ts`
 * (which grows it) and `people/minting.ts` (which, when the Match deals a
 * card for this house, mints a real `Person` from one of these rather than
 * rolling a fresh genome). See `RIVAL_LINEAGE_HOUSES` in `people/rivals.ts`
 * for which houses grow one, and AGENTS.md issue #24 for the staged build
 * order this belongs to.
 */
export interface RivalPerson {
  /** Its own namespace (`riv_...`), never a `PersonId` — she is not in any `PersonStore` yet. */
  id: string;
  /** Plain, like `MintRecipe.house` and `WorldState.houses`'s keys — never branded `HouseId`. */
  house: string;
  sex: Sex;
  born: Year;
  /** Set by mortality inside the shadow lineage. Kept, greyed nowhere — nothing renders her. */
  died?: Year;
  /** Named rival ancestors, by `RivalPerson.id` — the whole point of this file. */
  mother?: string;
  father?: string;
  /** Another `RivalPerson.id` — never a `PersonId`. Unset for a candidate the Match has not spent yet. */
  spouse?: string;
  /**
   * SHE LEFT THE SHADOW LINEAGE (issue #24 item 6). Set the year a Match card
   * built from her is taken — `people/minting.ts`'s `mintRecipe` marks it the
   * moment she is materialized as a real `Person` under `PersonId`. A person
   * who has left no longer marries or bears within the lineage: she is living
   * the player's game now, not this one.
   */
  left?: Year;
  /** Always materialized — a shadow population is small, and there is nobody waiting to read her lazily. */
  genome: Genome;
}

/** One rival house's shadow lineage, keyed by house id on `WorldState.rivalLineages`. */
export interface RivalLineageState {
  house: string;
  /** Append-only. The dead and the departed stay, because descent reads through them. */
  people: RivalPerson[];
}
