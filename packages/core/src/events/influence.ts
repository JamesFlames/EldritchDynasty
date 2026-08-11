import type { Modifier, Person } from '@ed/schema';
import type { SimCtx } from '../world.js';
import { attr } from '../people/factory.js';

/**
 * THE `attribute` MODIFIER — the last of the six influence kinds declared and
 * never read (issue #11). `attr()` stays exactly what it is: a pure read of
 * genome plus the acquired layer (invariant 6, derived state is not storage).
 * This is a SEPARATE read on top of it, for the three places a trait's
 * `attribute` modifier is allowed to matter: a check's pool, `Choice.requires`,
 * and a slot filter. Nothing here is written back to a `Person`.
 *
 * Four targets, one each:
 *   self      — the trait holder reading their own attribute.
 *   household — anyone in the household, for as long as a holder is in it.
 *   children  — household members under twenty specifically. The holder need
 *               not be their parent: `the_tutors_aphorisms` belongs to a
 *               hired tutor, and "children" there means the ones he teaches,
 *               not ones of his blood.
 *   slot      — dispatch only: the holder, and only once cast into a role
 *               named in `whenCastAs` — `role` is that cast role, supplied by
 *               the caller because only the caller knows what the person was
 *               cast AS. Omitting `role` is "not currently cast anywhere."
 */
type AttributeModifier = Extract<Modifier, { kind: 'attribute' }>;

/** Same threshold `slots.ts`'s `child` role and `economy.ts`'s `CHILD_SURCHARGE` use. */
const CHILD_AGE = 20;

function attributeModifiersOf(ctx: SimCtx, holder: Person, attrKey: string): AttributeModifier[] {
  const out: AttributeModifier[] = [];
  for (const tid of holder.traits) {
    const trait = ctx.content.trait(tid);
    if (!trait) continue;
    for (const pres of trait.presence) {
      for (const m of pres.modifiers) {
        if (m.kind === 'attribute' && m.attr === attrKey) out.push(m);
      }
    }
  }
  return out;
}

function dispatchAttributeModifiersOf(ctx: SimCtx, holder: Person, attrKey: string, role: string): AttributeModifier[] {
  const out: AttributeModifier[] = [];
  for (const tid of holder.traits) {
    const trait = ctx.content.trait(tid);
    if (!trait) continue;
    for (const disp of trait.dispatch) {
      if (!disp.whenCastAs?.includes(role)) continue;
      for (const m of disp.modifiers) {
        if (m.kind === 'attribute' && m.attr === attrKey) out.push(m);
      }
    }
  }
  return out;
}

export function influencedAttr(ctx: SimCtx, p: Person, attrKey: string, role?: string): number {
  const w = ctx.world;
  let value = attr(p, attrKey, ctx.genetics, w.year);
  const isChild = w.year - p.born < CHILD_AGE;

  for (const holder of w.people.household(w.playerHouse, w.year)) {
    for (const m of attributeModifiersOf(ctx, holder, attrKey)) {
      if (m.target === 'household') value += m.delta;
      else if (m.target === 'self' && holder.id === p.id) value += m.delta;
      else if (m.target === 'children' && isChild) value += m.delta;
    }
  }

  if (role) {
    for (const m of dispatchAttributeModifiersOf(ctx, p, attrKey, role)) {
      if (m.target === 'slot') value += m.delta;
    }
  }

  return value;
}
