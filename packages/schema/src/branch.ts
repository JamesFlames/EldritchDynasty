import type { BranchId, HouseId, PersonId, Year } from './ids.js';

/**
 * CADET BRANCHES (concept §16).
 *
 * "Everyone else becomes a cadet branch" is step six of the core loop, and for
 * a long time it was the only step that did nothing. Non-heir sons stayed in
 * the main hall and were damped by the crowding brake, which meant the family
 * had exactly one household forever: no cousins, no aggrieved relatives with
 * their own libraries and their own chronicles, and nowhere for the seal to go
 * when the main line ran out of men.
 *
 * A branch is a HOUSEHOLD, not a house. Its people are still of the Eldritch
 * House and still carry its blood — `membership.house` never changes — but
 * they live under their own roof, breed against their own crowding brake, and
 * are counted separately by the economy.
 *
 * Three things follow from that, and all three are the point:
 *
 *   THE FAMILY GROWS SIDEWAYS.  Each branch has its own soft cap, so a house
 *   that would have been throttled at fourteen mouths spreads into five halls
 *   instead of choking in one.
 *
 *   THE SEAL HAS SOMEWHERE TO GO.  Succession reaches into the branches when
 *   the main line fails, which is how "a mundane cadet cousin is sitting where
 *   the founder sat" (§23) becomes a thing that can actually happen.
 *
 *   THEY REMEMBER.  Grievance accrues in a branch that watches a lesser man
 *   hold the seal, and an aggrieved branch stops paying its tithe long before
 *   it does anything louder (§22 Insurrection).
 */

/** The trunk. Not a real branch record — the household the head lives in. */
export const MAIN_BRANCH = 'main';

export interface BranchState {
  id: BranchId;
  /** Named for its founder, because that is how the family will refer to it. */
  name: string;
  house: HouseId;
  founder: PersonId;
  /** The household this one split away from. `main` for a split from the trunk. */
  splitFrom: string;
  foundedYear: Year;

  /**
   * Who speaks for the branch. Recomputed the moment he dies — a branch with
   * no head is a branch whose sons never leave, and it silently swells.
   */
  speaker?: PersonId;

  /**
   * The wound the Head is too busy to notice. Rises while the branch holds a
   * man who could have led and did not; falls when the branch is honoured.
   * 0–100.
   */
  grievance: number;

  /** Set the year the last member dies. Extinct branches are kept, and greyed. */
  extinct?: Year;
  /** Set the year one of its own was called back to hold the main house. */
  recalled?: Year;
  /**
   * The year this branch last put one of its own in the seal room. A branch
   * that has never done it is the one with the wound.
   */
  heldSeal?: Year;
}

export function isActiveBranch(b: BranchState): boolean {
  return b.extinct === undefined;
}
