import type { CirculatingTale } from '@ed/core';

/**
 * TWO ACCOUNTS OF ONE NIGHT (issue #52).
 *
 * `about` is the event a tale is an account of, and the view's own comment on
 * it says what that means: *"Two accounts sharing this contradict each
 * other."* CI fails a build where two accounts of one event agree on
 * everything — the contradiction is the layer — and the client drew them as
 * two unrelated items in a flat list ordered by year, possibly with three
 * other tales between them, with nothing saying they were about the same
 * night at all.
 *
 * `accuracy` is deliberately withheld from the view so that no client can sort
 * accounts by truth. `teller` and `bias` are required rather than optional
 * colour, so the player weighs the accounts the way they would weigh two
 * people. All of that was built, validated, and then defeated by a list.
 *
 * ── THE ORDER, WHICH IS THE WHOLE PROBLEM ─────────────────────────────────
 *
 * Grouping is easy; not taking a side is not. Anything that decides which
 * account goes first is the game having an opinion, and the layout is a voice:
 * most-repeated would say the loudest is truest, fewest mutations would say
 * the least-drifted is truest, and putting one above the other in a column
 * says the top one is.
 *
 * So the accounts keep the order the view already handed them — by the year
 * each began circulating, then by id — which is a fact about the TELLING and
 * not about the truth, and which no client chose. Nothing here reads `form`,
 * `mutations` or the length of the text.
 */
export interface Accounts {
  /** The event they are accounts of. */
  about: string;
  /** Two or more where they contradict; one where the world has only heard once. */
  tales: CirculatingTale[];
}

export function accountsOf(tales: readonly CirculatingTale[]): Accounts[] {
  const byEvent = new Map<string, CirculatingTale[]>();
  for (const tale of tales) {
    const held = byEvent.get(tale.about);
    if (held) held.push(tale);
    else byEvent.set(tale.about, [tale]);
  }
  // Map iteration is insertion order, so the groups arrive in the order their
  // FIRST account did — the same order the flat list had, which keeps the
  // panel reading chronologically without anything having sorted it.
  return [...byEvent].map(([about, group]) => ({ about, tales: group }));
}
