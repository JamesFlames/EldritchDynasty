import type { Year } from '@ed/schema';
import { MAIN_BRANCH, assertNever } from '@ed/schema';
import type { SimCtx } from './world.js';
import { activeBranches } from './people/branches.js';

/**
 * BEARING — how the house carries what it has, as distinct from what it has
 * (concept §29, issue #45).
 *
 * It sits beside `assizePressure` and is read the same way: derived,
 * recomputed every year, explicit in its consequences and never in its name.
 * It is not a second Assize. The Assize is the world's opinion of how the
 * house is DOING and it announces itself in the chronicle by design
 * (invariant 13). This is the world's memory of how the house has BEHAVED,
 * and it never announces itself at all, because the whole of what it is for
 * is that the player runs out of options and does not immediately know why.
 *
 * ─── The five rules it is built to keep ─────────────────────────────────────
 *
 * 1. NEVER NAME IT. No stat, no meter, no bar, and no player-facing string
 *    containing pride, arrogance, hubris or vanity. `prose/bearing` fails the
 *    build on all four, anywhere in authored content.
 * 2. PRIDE MUST USUALLY BE CORRECT. It is how a house climbs. A tax gets
 *    optimised away inside an hour and teaches nothing, so nothing here
 *    subtracts from a number the player is watching.
 * 3. IT NEVER COSTS ON THE DAY. `REMEMBERED_AFTER` is two generations, and an
 *    act younger than that is not in the reading at all. A consequence that
 *    lands in the same decade as its cause is a rule, and the player will
 *    learn the rule and stop doing the thing.
 * 4. ONLY OTHER PEOPLE SAY IT. Nothing here writes a chronicle line in the
 *    house's own voice.
 * 5. REVERSIBLE BY ACT, NEVER BY APOLOGY. The reading falls when the acts
 *    stop and the ledger of them ages out. There is no humility button.
 *
 * ─── Why some of it is stored and most of it is not ─────────────────────────
 *
 * Invariant 6: derived state is not storage. Four of the seven inputs are
 * live readings off a world that already holds them — a hall's standing
 * grievance, a long tenure, and what those two are doing to discontent.
 *
 * The other three leave NO TRACE at all today. A hand refused is a decision
 * the world forgets the moment it is taken; a person kept off the market is a
 * key in `world.withheld` that is deleted when they are released; the cousin
 * taken over an outsider looks, afterwards, exactly like a cousin who was the
 * only card. Those three are the acts this whole system is about, so they are
 * written down — with the YEAR, because rule 3 above cannot be kept without
 * one.
 */

/**
 * The acts the world remembers. A closed union, and every site handling one
 * ends in `assertNever` — a kind that falls through would be an act the house
 * is never charged for, which is invisible from outside.
 */
export type BearingAct =
  /** An Embellish: the family written larger than it was. */
  | 'wrote_it_larger'
  /** A hand refused outright, as beneath the house. */
  | 'refused_a_hand'
  /** Somebody kept off the marriage market by standing order. */
  | 'kept_her_back'
  /** The cousin card taken with an outside card sitting on the table. */
  | 'took_the_cousin';

/** One act, and the year it was taken. */
export interface BearingEntry {
  year: Year;
  kind: BearingAct;
}

/**
 * What each act weighs against the others.
 *
 * Refusing a hand is the loudest because it is the one the market itself
 * witnesses: a broker who is turned down twice stops calling. Writing the
 * family larger is quieter and slower, because the only people who can catch
 * it are the ones who kept their own copy.
 */
function weightOf(kind: BearingAct): number {
  switch (kind) {
    case 'refused_a_hand': return 1;
    case 'kept_her_back': return 0.8;
    case 'took_the_cousin': return 0.6;
    case 'wrote_it_larger': return 0.5;
    default: return assertNever(kind, 'bearing act');
  }
}

/**
 * TWO GENERATIONS, and this is rule 3 made into a number.
 *
 * A generation in this game is about twenty-five years, so an act is not in
 * the reading until it is fifty years old. The man who refused the hand is
 * dead, and the grandson finds the market thin and has no idea it is his.
 */
export const REMEMBERED_AFTER = 50;

/**
 * How many remembered acts a century it takes to read as a house that carries
 * itself.
 *
 * SIX, and measured rather than argued. The first cut was sixteen, reasoned
 * from a run's arithmetic — the player is dealt about one hand a generation,
 * so four a century, so a proud house does about four proud things a century,
 * so set it at four times that. Every step of that was right except the
 * conclusion, because a house cannot do four times what the maximum is.
 *
 * Measured over twelve played thousand-year runs at three policies, where
 * `proud` refuses every hand it is ever dealt:
 *
 *                  peak bearing   cards on the table
 *     modest           0.37             2.75
 *     unattended       0.56             2.45
 *     proud            0.74             2.02
 *
 * At sixteen the proud column peaked at 0.44 and still saw 2.64 cards — the
 * ceiling was unreachable by any play at all, so §29's stated end state
 * (*until the cousin card is the only card on the table*) could not happen in
 * any run. At six it happens, and the modest house still sees 2.75 of its
 * three cards, which is rule 2: pride must usually be CORRECT, and a house
 * that does not carry itself this way is barely touched.
 */
const PROUD_PER_CENTURY = 6;

/** A hall this angry is a hall that has been left standing. */
const GRIEVANCE_FULL = 60;

/**
 * A tenure past this is being sat on rather than held. §22's Demigod
 * Stagnation uses forty-five for the same shape and the same reason; this is
 * the softer reading of it, and starts counting where that one starts acting.
 */
const LONG_TENURE = 45;

export interface Bearing {
  /** Acts old enough to be remembered, per century of the run so far. */
  carriage: number;
  /** What the halls are owed and have not been given. */
  grievance: number;
  /** How far past a long tenure the seat has been held. */
  tenure: number;
  /** The combined read, 0 (the house keeps its head down) to 1. */
  score: number;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * How the world has come to read the house. Derived, recomputed, stored
 * nowhere except as `world.bearing.score` for the same reason
 * `assize.pressure` is: so a client, an authored condition and the phase that
 * acted all read one number rather than three recomputations of it.
 */
export function bearingOf(ctx: SimCtx): Bearing {
  const w = ctx.world;

  // RULE 3. Anything younger than two generations is not in the reading, and
  // that is the whole of why entries carry a year.
  let remembered = 0;
  for (const e of w.bearing.acts) {
    if (w.year - e.year >= REMEMBERED_AFTER) remembered += weightOf(e.kind);
  }
  // Per century of the run so far, so a house is read on how it has carried
  // itself rather than on how long it has been carrying. Measured from the
  // first year that could hold a remembered act, never from zero: dividing by
  // an elapsed time shorter than the lag makes the first remembered act read
  // as a century's worth of them.
  const centuries = Math.max(1, (w.year - w.assize.openedAt - REMEMBERED_AFTER) / 100);
  const carriage = clamp01(remembered / (centuries * PROUD_PER_CENTURY));

  const halls = activeBranches(w).filter((b) => b.id !== MAIN_BRANCH);
  const grievance = halls.length
    ? clamp01(halls.reduce((n, b) => n + b.grievance, 0) / (halls.length * GRIEVANCE_FULL))
    : 0;

  const held = w.headSince === undefined ? 0 : w.year - w.headSince;
  const tenure = clamp01((held - LONG_TENURE) / LONG_TENURE);

  // Weighted toward the acts, because the acts are what the player DID and the
  // other two are what the house let stand. A hall left angry for a century is
  // real and is not a decision anybody took on a particular afternoon.
  const score = clamp01(carriage * 0.6 + grievance * 0.25 + tenure * 0.15);
  return { carriage, grievance, tenure, score };
}

/**
 * Write one act down. Called from the verb that performs it and from nowhere
 * else, so the ledger cannot drift from what the player actually did.
 */
export function noteBearing(ctx: SimCtx, kind: BearingAct): void {
  ctx.world.bearing.acts.push({ year: ctx.world.year, kind });
}

/** One reading, written to the world. Draws no dice. */
export function tickBearing(ctx: SimCtx): Bearing {
  const now = bearingOf(ctx);
  ctx.world.bearing.score = now.score;
  return now;
}

/**
 * STAGE 2, AND FOR NOW THE ONLY BITE (issue #45).
 *
 * The world stops offering. A house that has refused enough hands is offered
 * fewer, and the ones it is offered come with less, until the cousin is the
 * only card on the table.
 *
 * This is the moral in one loop and it needs no text: §7 already says cousin
 * marriage is *not a temptation, it is the mechanism*, and this makes it also
 * a CONSEQUENCE. The pride that refuses to dilute the blood is what forces the
 * marriage that ruins it.
 *
 * Returns the market's appetite, 1 (it offers what it always did) to 0 (it
 * sends only what it cannot place elsewhere). Deliberately not a cliff: a
 * threshold would be a rule, and a rule gets learned and played around.
 */
export function marketAppetite(ctx: SimCtx): number {
  return 1 - ctx.world.bearing.score;
}
