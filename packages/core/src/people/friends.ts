import type { Sex, Year } from '@ed/schema';
import type { Rng } from '../rng.js';

/**
 * THE FIVE NAMES THE PLAYER GAVE AT THE SIGNING.
 *
 * At the prologue the player is asked for five people they could not have done
 * without, and what sex each of them is. Those names then come back — a
 * midwife in 1310, a rival's second son in 1688 — once each, and never again.
 *
 * It is the one place in the game where something outside the fiction is
 * carried into it, and the fiction is built to hold exactly that: the thing at
 * the table asked for names it could wear, and the family has spent a thousand
 * years not agreeing about why the same handful keeps turning up. The names
 * arrive with no fanfare and nothing points at them. A player who does not
 * notice has lost nothing; a player who does gets the only jolt this game can
 * deliver that no amount of authored prose can.
 *
 * ─── The rules, and why each one is where it is ─────────────────────────────
 *
 * ONCE EACH. `spentIn` is the year the name was handed out, and a name with a
 * year on it is never offered again. That is what makes the fifth arrival mean
 * something: the player learns, somewhere around the third, that the supply is
 * finite.
 *
 * SAME SEX. A friend's name goes on a person of the friend's sex, because the
 * point is recognition and this world's given names are strongly sexed.
 *
 * NO DICE WHEN THERE IS NOTHING TO WIN. `claimFriendName` returns before it
 * touches the stream when no name of that sex is free — the user's "at least
 * while there are unused names of that gender available", and also the reason
 * a world nobody founded is bit-for-bit the world it was before this file
 * existed. The harness, the digest, every gate and every test bootstrap with
 * an empty roster and draw exactly the numbers they drew yesterday. Rolling
 * the coin first and discarding it would have been one line shorter and would
 * have moved every number in the game.
 *
 * SPENT IS SPENT, EVEN ON A CARD NOBODY TOOK. A suitor dealt to the Match and
 * declined has already had her name reserved (`rollRecipe`, and the comment
 * there says why). A friend's name spent that way is spent: the house heard it
 * once. The one exception is a newborn the player renames — see
 * `releaseFriendName`, and `renameChild`, which is the player saying no to the
 * suggestion rather than the world using the name up.
 */
export interface FriendName {
  /** As the player typed it, trimmed. Not run through `uniqueName` — it is theirs. */
  name: string;
  sex: Sex;
  /** The year it was handed to somebody. Absent while it is still in the bag. */
  spentIn?: Year;
}

/** How many the signing asks for. */
export const MAX_FRIENDS = 5;

/** A given name is a word, not a sentence. */
export const FRIEND_NAME_MAX = 32;

/**
 * How often a new person of the right sex arrives wearing one, while any are
 * left. The user's number, and it is the right shape: over a run that mints
 * about eleven hundred people, ten percent empties a five-name bag long before
 * 2042 without any of the five landing in the first decade every time.
 */
export const FRIEND_NAME_CHANCE = 0.1;

/**
 * Take a friend's name for somebody arriving now, or don't.
 *
 * Returns `undefined` — having drawn NOTHING from `rng` — when the bag holds
 * no free name of this sex. See the header: that is what keeps every unfounded
 * run identical to the run it was before this existed.
 *
 * `taken` is consulted rather than trusted to be empty: a friend called Edric
 * cannot be handed out while a living Edric holds the name, and a name we
 * cannot use is a name that has not been spent.
 */
export function claimFriendName(
  friends: FriendName[],
  sex: Sex,
  taken: Set<string>,
  year: Year,
  rng: Rng,
): string | undefined {
  const free = friends.filter((f) => f.sex === sex && f.spentIn === undefined && !taken.has(f.name));
  if (!free.length) return undefined;
  if (!rng.bool(FRIEND_NAME_CHANCE)) return undefined;

  const chosen = free[rng.int(free.length)]!;
  chosen.spentIn = year;
  taken.add(chosen.name);
  return chosen.name;
}

/**
 * Put a name back in the bag, if this is the year it came out of it.
 *
 * Only `renameChild` calls this, and only for a newborn whose suggested name
 * the player has just overwritten. The player did not use the name — the
 * chronicler offered it and was told no — and spending one of five on an offer
 * that was refused is the kind of quiet loss this repo's whole test suite
 * exists to catch.
 *
 * THE YEAR IS THE GUARD, and it is not belt and braces. A player's friend may
 * perfectly well be called Rowan or Alys, which are also names in `names.ts`'s
 * own pool. Spend such a name in 1050, bury its holder, let `retireNames`
 * release it thirty years later, and `uniqueName` can hand the same word to a
 * newborn in 1200 knowing nothing about any of this. Renaming THAT child
 * un-spends a friend who arrived a hundred and fifty years ago, and the name
 * goes out a second time — one arrival becoming two, which is the one promise
 * this feature makes. Matching on the year says what the sentence above says:
 * this name was taken out of the bag for the child in front of you.
 */
export function releaseFriendName(friends: FriendName[], name: string, year: Year): boolean {
  const held = friends.find((f) => f.name === name && f.spentIn === year);
  if (!held) return false;
  delete held.spentIn;
  return true;
}

/**
 * What the player typed, made into a roster.
 *
 * Trimmed, emptied of blanks, capped at five, and deduplicated case-blind:
 * two friends called Sam is a roster whose second Sam can never be handed out
 * — `taken` holds the name after the first — which is a five-name bag that
 * silently holds four. Rejecting it at the door is the difference between a
 * rule and a shrug.
 */
export function normaliseFriends(
  input: readonly { name: string; sex: Sex }[],
): { ok: true; friends: FriendName[] } | { ok: false; reason: string } {
  const out: FriendName[] = [];
  const seen = new Set<string>();
  for (const row of input) {
    const name = row.name.trim().replace(/\s+/g, ' ');
    if (!name) continue;
    if (name.length > FRIEND_NAME_MAX) return { ok: false, reason: `'${name}' is longer than a name` };
    if (row.sex !== 'male' && row.sex !== 'female') return { ok: false, reason: `${name} needs to be one or the other` };
    const key = name.toLowerCase();
    if (seen.has(key)) return { ok: false, reason: `two of them are called ${name}` };
    seen.add(key);
    out.push({ name, sex: row.sex });
  }
  if (out.length > MAX_FRIENDS) return { ok: false, reason: `five names, not ${out.length}` };
  return { ok: true, friends: out };
}
