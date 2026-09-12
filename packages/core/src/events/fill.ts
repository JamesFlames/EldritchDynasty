import type { Person } from '@ed/schema';
import type { SimCtx } from '../world.js';

/**
 * WHO IS STANDING WHERE, and why one slot can hold more than one man.
 *
 * A slot used to be one person, always, because `SlotSpec.count` was declared
 * in the schema and read by nobody — invariant 11, live in the save-referenced
 * content model since the field was written (issue #90). A counted slot now
 * holds a LIST, and the two shapes share one map rather than two, because a
 * second parallel record is a thing that goes out of sync silently.
 *
 * Read it through `castIn` (everybody) or `soleCast` (the one man a slot
 * names). Never index it directly: `fill[SID]` is `string | string[]`, and the
 * whole point of the union is that the compiler makes each site say which of
 * the two it meant.
 */
export type SlotFill = Record<string, string | string[]>;

/**
 * Everybody cast in a slot, in cast order. One entry for an ordinary slot,
 * none for one that was never filled.
 */
export function castIn(fill: SlotFill, sid: string): string[] {
  const v = fill[sid];
  if (v === undefined) return [];
  return typeof v === 'string' ? [v] : v;
}

/**
 * The one man a slot names, or nobody.
 *
 * For a counted slot this is the FIRST cast, which is an arbitrary man out of
 * up to five — so every singular reference to a counted slot is an authoring
 * error rather than a shorthand, and `slots/counted` rejects the ones content
 * can express (`{ slot: }` targets, a `slot` pool, `bind: arc`). This stays
 * total anyway: a rule that has not run yet, an editor preview of a
 * half-written event and a save from before the rule existed all reach here.
 */
export function soleCast(fill: SlotFill, sid: string): string | undefined {
  return castIn(fill, sid)[0];
}

/** The people a slot holds, skipping any id the store no longer knows. */
export function castPeople(fill: SlotFill, sid: string, ctx: SimCtx): Person[] {
  const out: Person[] = [];
  for (const id of castIn(fill, sid)) {
    const p = ctx.world.people.get(id);
    if (p) out.push(p);
  }
  return out;
}
