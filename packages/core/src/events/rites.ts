import type { Person, Rite } from '@ed/schema';
import { assertNever } from '@ed/schema';
import type { SimCtx } from '../world.js';
import { attr, phenotypeOf } from '../people/factory.js';
import { ELDRITCH_GIFT } from '../genetics/expression.js';

/**
 * THE RITES OF THE LADDER (concept §22, issue #43).
 *
 * Three of the six rungs are not measurements. §22 gates them on an act — the
 * Vessel's living sacrifice, the Great Rite the Church sanctions or is defied
 * over, and the unmaking of a living Demigod — and `ascension.ts` has said so
 * since it shipped: *"rungs four and up therefore gate on everything §22 asks
 * for EXCEPT the rite itself, and `rungGate` names the rite as the last
 * requirement so nothing pretends the ladder is finished."*
 *
 * This is where the acts live. They are in the ENGINE and not in content
 * because what a rite does is a rule about bodies and blood, the way `kill`
 * and `conceiveChild` are: an author decides whether the house is asked, on
 * what terms, in what words, and what the record says afterwards. Any of that
 * is a decision. How much of a consumed woman arrives in the man who consumed
 * her is not.
 *
 * ─── What was there before ──────────────────────────────────────────────────
 *
 * `the_vessel_rite` has been in `events/rites.yaml` since the content pass,
 * and it said all of this in prose. Mechanically it was a `status` effect and
 * a flat `madness: 35`:
 *
 *   - nobody's attributes moved, so §22's *"their attributes are added to the
 *     ascendant's"* was a sentence in a body;
 *   - the Vessel's OWN Madness went nowhere, so *"transfers in full and
 *     uncapped"* was decoration and the safe-versus-gifted choice the event
 *     offers was two flavours of the same outcome;
 *   - `status: vessel_consumed` was written straight onto the person, which is
 *     a second death gate wearing a different word (invariant 2) — no marriage
 *     was closed out, no archive, and the Narrator would have been consumable;
 *   - and the man was left exactly as far from rung four as he had been before
 *     he consumed a relative to reach it.
 *
 * Which is invariant 11 in its purest form: a declared thing nothing read. It
 * typechecked, it fired, it wrote a good chronicle line, and the ladder above
 * it was unreachable in principle for as long as it stood.
 */

export interface RiteOutcome {
  ok: boolean;
  /** Why not, for a caller that wants to say so. Never thrown. */
  reason?: string;
  /** What actually moved, so a test and a report can name it. */
  moved?: {
    attributes: Record<string, number>;
    blood: number;
    madness: number;
  };
}

/**
 * THE VESSEL (§22, rung four).
 *
 * > A living family member of the blood, willingly given. Named, chosen by the
 * > player from the tree. Consumed. Their attributes are added to the
 * > ascendant's. The tree shows them greyed, with a mark that is not the mark
 * > for death.
 *
 * Four rules hold this together, and every one of them is load-bearing:
 *
 * **What he gains, he cannot pass on.** Everything lands in `Person.acquired`,
 * which `conceiveChild` never reads — a child is drawn from the GENOME, and
 * the genome is not touched here. That is §22's own reason: *"a family cannot
 * ascend by consuming its way upward; every generation has to be bred, and the
 * rite only decides who gets to spend what the breeding produced."*
 *
 * **The blood is wielded, not carried.** `carriedFont` is left alone, so what
 * the market prices and what a mother's meiosis draws from are unchanged, and
 * `withGift` raises only what the man can express — as far as his own channel
 * allows. Blood past his ceiling is not power, it is Madness. A man who
 * consumes the family's deepest carrier and has no channel to hold her buys
 * himself nothing but ruin, which is the shape §22 describes.
 *
 * **Madness transfers in full and uncapped, and only from someone who can
 * express it** (§10, invariant 1). A woman or a mundane son carries no Madness
 * to give — that is the same sentence as "she is the safe Vessel" — and the
 * gate is `canExpress` on both ends rather than a sex test.
 *
 * **`kill` is the only death gate** (invariant 2). The consumed go through it
 * like everyone else and come out the other side with a status that is not
 * `dead`, which is what the tree draws a different mark for.
 */
export function consumeVessel(
  ctx: SimCtx,
  ascendant: Person,
  vessel: Person,
  cause = 'given to the rite, and not spoken of again',
): RiteOutcome {
  const w = ctx.world;
  if (ascendant.id === vessel.id) return { ok: false, reason: 'a man cannot be his own Vessel' };
  if (vessel.status !== 'alive') return { ok: false, reason: 'the Vessel is not living' };

  // OF THE BLOOD, and checked here rather than left to a filter. §22 says "a
  // living family member OF THE BLOOD", and the `family_member` slot role
  // casts the whole household — wives married in, wards, retainers. A rite
  // that would take any of them is a rite about the household rather than
  // about the line, and the line is the entire subject of the game.
  const ofTheBlood = w.people.blood(w.playerHouse).some((p) => p.id === vessel.id);
  if (!ofTheBlood) return { ok: false, reason: 'the Vessel is not of the blood' };

  const theirs = phenotypeOf(vessel, ctx.genetics, w.year).eldritch;
  const his = phenotypeOf(ascendant, ctx.genetics, w.year).eldritch;

  const moved: NonNullable<RiteOutcome['moved']> = { attributes: {}, blood: 0, madness: 0 };

  // Attributes, in full. `derived` ones are recomputed from the body every
  // year (invariant 6) and `eldritch` ones are not attributes at all — they
  // are the font and the channel, and they move below, under their own rule.
  for (const def of ctx.genetics.attributes) {
    if (def.kind === 'derived' || def.kind === 'eldritch') continue;
    const value = attr(vessel, def.id, ctx.genetics, w.year);
    if (value <= 0) continue;
    ascendant.acquired[def.id] = (ascendant.acquired[def.id] ?? 0) + value;
    moved.attributes[def.id] = value;
  }

  // The blood. Written even for a man who cannot express, and inert for him —
  // `withGift` refuses to raise anybody the genome did not already make an
  // expresser, so the record of what he was given stays true without the gift
  // ever becoming a second way to make one (invariants 1 and 4).
  if (theirs.carriedFont > 0) {
    ascendant.acquired[ELDRITCH_GIFT] = (ascendant.acquired[ELDRITCH_GIFT] ?? 0) + theirs.carriedFont;
    moved.blood = theirs.carriedFont;
  }

  // INVARIANT 1: canExpress is the only Madness gate, and it is asked of both
  // people. Nothing passes from someone who never had any; nothing arrives in
  // someone who could not hold it.
  if (theirs.canExpress && his.canExpress && vessel.madness > 0) {
    ascendant.madness += vessel.madness;
    moved.madness = vessel.madness;
  }

  // The phenotype cache is derived (invariant 6) and the year has not moved,
  // so nothing would recompute it before something read a stale one.
  if (ascendant.phenotype) ascendant.phenotype.dirty = true;

  // INVARIANT 2: the one death gate, with the mark that is not the mark for
  // death. A Vessel who happens to be the Narrator is redirected by `kill`
  // like any other death, and the rite quietly buys nothing.
  w.people.kill(vessel.id, w.year, cause, 'vessel_consumed');

  if (!ascendant.rites.includes('vessel')) ascendant.rites.push('vessel');
  return { ok: true, moved };
}

/**
 * Perform a rite by name. The one entry point, so the effect verb, a test and
 * whatever the client eventually offers cannot disagree about what a rite is.
 *
 * `great_rite` and `unmaking` are §22's rungs five and six, and they are
 * declared here rather than silently missing: the union is closed and this
 * switch ends in `assertNever`, so the day one of them is authored the
 * compiler asks for it. Until then they refuse, with the reason, instead of
 * doing nothing — which is the failure mode this whole codebase is built to
 * refuse (`CLAUDE.md`: "a declared field that nothing reads is a bug").
 */
export function performRite(
  ctx: SimCtx,
  rite: Rite,
  ascendant: Person,
  subject: Person | undefined,
  cause?: string,
): RiteOutcome {
  switch (rite) {
    case 'vessel':
      if (!subject) return { ok: false, reason: 'the Vessel rite takes a named living relative' };
      return consumeVessel(ctx, ascendant, subject, cause);
    case 'great_rite':
      return { ok: false, reason: 'the Great Rite is not built (issue #43)' };
    case 'unmaking':
      return { ok: false, reason: 'the unmaking is not built (issue #43)' };
    default:
      return assertNever(rite, 'rite');
  }
}
