import type { SessionView } from '@ed/core';

export type MemberView = SessionView['halls'][number]['members'][number];

/**
 * WHO THIS PERSON HANGS UNDER, ACCORDING TO THE BOOK.
 *
 * The tree is drawn from `record.parents` and never from `parents` — a forged
 * dowry moves the first and not the second, and a house that has bought itself
 * a grandmother should see the grandmother it bought. The truth is on the card
 * when you open it.
 *
 * The father where the hall holds him, the mother otherwise, so that a child
 * with both parents present hangs once rather than twice. A hall is not a
 * house (invariant 15): the parent may be alive in another hall entirely, in
 * which case the child is a root of this one, which is exactly what a cadet
 * branch looks like from the inside.
 */
export function recordedParent(m: MemberView, hall: MemberView[]): string | undefined {
  const claimed = m.record.parents;
  const here = (id: string | undefined) => (id && hall.some((x) => x.id === id) ? id : undefined);
  return here(claimed.father) ?? here(claimed.mother);
}

/** The people in this hall nobody in this hall is recorded as the parent of. */
export function roots(hall: MemberView[]): MemberView[] {
  return hall.filter((m) => recordedParent(m, hall) === undefined);
}

/** The people this hall records as theirs. */
export function children(m: MemberView, hall: MemberView[]): MemberView[] {
  return hall.filter((x) => recordedParent(x, hall) === m.id);
}
