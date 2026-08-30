import type { Person } from '@ed/schema';
import { MAIN_BRANCH } from '@ed/schema';
import type { SimCtx } from './world.js';
import { attr, phenotypeOf } from './people/factory.js';
import { branchOf, wouldSpeakFor } from './people/branches.js';
import { heirApparent } from './people/succession.js';
import { measureAscension } from './ascension.js';

/**
 * WHO THIS GENERATION IS ABOUT (issue #44).
 *
 * By 2042 a run holds about seventy living people across six halls, and there
 * are no faces by design. **A player asked to care about seventy people cares
 * about none of them** — and every beat the design is built on assumes
 * attachment that nothing was manufacturing: the Fragile One, the Vessel,
 * losing the Darkness-affine daughter in 1900.
 *
 * Attachment is a selection problem before it is an art problem, and it has
 * three conditions. NAMED shipped with the bynames and the dynastic ordinals.
 * EXPOSED TO LOSS the simulation has always done correctly. The missing one is
 * ONE DETAIL THAT IS ONLY TRUE OF THEM — something that distinguishes a person
 * from their sibling other than a number — which is what `because` is, and why
 * every line of it is a fact off this year's world rather than colour.
 *
 * Five to seven, not seventy.
 *
 * ─── This is also where #24 item 3 gets watched ─────────────────────────────
 *
 * Women hold the font, are usually the only safe people in the house, own the
 * endgame concealment instrument, and are barred from the one thing that wins
 * the game. The structure is coherent and the injustice is the point; the
 * failure mode is a player who reads the male line as the game and the
 * daughters as inventory. The tracker calls that the largest remaining design
 * risk in the genetics, and it is a UI problem rather than a data one. So
 * `carrier` is not a courtesy row on this list: it is the daughter who is
 * carrying the whole thing, named, with what she is carrying said out loud.
 *
 * ─── Derived, recomputed, never stored ──────────────────────────────────────
 *
 * Invariant 6. This is a READING of the household, the way `measureAscension`
 * and `RecordView` are — nothing here is written back. A cast written into the
 * world would be correct for one spring and then quietly wrong for four
 * hundred years, which is exactly what this codebase's worst bugs look like
 * from outside.
 */

export type CastRole =
  /** Who sits, and is answerable for all of it. */
  | 'head'
  /** Who takes the seat the day it falls vacant. The same rule `ensureHead` uses. */
  | 'heir'
  /** The one the blood is going to hurt — or the boy it has not started on yet. */
  | 'at_risk'
  /** The hall with the wound, and the man who speaks for it. */
  | 'aggrieved'
  /** The daughter carrying the line. See #24 item 3, above. */
  | 'carrier'
  /** Who came in from outside and is now holding the family's future. */
  | 'married_in'
  /** The family's answer to "am I winning?" — highest on the ladder. */
  | 'foremost';

export interface CastMember {
  person: string;
  name: string;
  role: CastRole;
  sex: string;
  age: number;
  hall: string;
  /** The one thing that is true of this person and of nobody else in the house. */
  because: string;
}

/** Role order is priority order: the first claim on a person keeps them. */
const ROLES: CastRole[] = ['head', 'heir', 'at_risk', 'carrier', 'aggrieved', 'married_in', 'foremost'];

/** Seven is the ceiling this whole reading exists to enforce. */
export const CAST_MAX = 7;

function ageOf(ctx: SimCtx, p: Person): number {
  return ctx.world.year - p.born;
}

function isBlood(p: Person, house: string): boolean {
  return p.membership.some((m) => m.house === house && (m.kind === 'blood' || m.kind === 'cadet'));
}

/** How much of it he is carrying that his channel will not pass. */
function strain(ctx: SimCtx, p: Person): number {
  const mind = attr(p, 'mind', ctx.genetics, ctx.world.year);
  return mind > 0 ? p.madness / mind : p.madness;
}

/**
 * The one the blood is going to hurt.
 *
 * First the man closest to losing to it, because that is a person with a
 * countdown on him. If nobody in the house is anywhere near it, then the boy
 * of hot blood who has not woken — `attributes.yaml` says it out loud, and it
 * is the design's own Fragile One: *the unwoken son of hot blood is the most
 * fragile person in the house*.
 */
function atRisk(ctx: SimCtx, living: Person[]): { person: Person; because: string } | undefined {
  const w = ctx.world;
  const expressers = living.filter((p) => phenotypeOf(p, ctx.genetics, w.year).eldritch.canExpress);

  const worst = [...expressers].sort((a, b) => strain(ctx, b) - strain(ctx, a))[0];
  if (worst && worst.madness >= 1) {
    const mind = Math.round(attr(worst, 'mind', ctx.genetics, w.year));
    return {
      person: worst,
      because: `carries ${Math.round(worst.madness)} of it against a mind of ${mind}.`,
    };
  }

  const fragile = expressers
    .filter((p) => !p.awakening.awakened && ageOf(ctx, p) < 16)
    .sort((a, b) => a.born - b.born)[0];
  if (fragile) {
    return {
      person: fragile,
      because: `has the blood and has not woken to it, and he is ${ageOf(ctx, fragile)}.`,
    };
  }
  return undefined;
}

/** The daughter carrying the most of it, and what her being spent would cost. */
function carrier(ctx: SimCtx, living: Person[]): { person: Person; because: string } | undefined {
  const w = ctx.world;
  const font = (p: Person) => phenotypeOf(p, ctx.genetics, w.year).eldritch.carriedFont;
  const women = living
    .filter((p) => p.sex === 'female' && isBlood(p, w.playerHouse) && font(p) > 0)
    .sort((a, b) => font(b) - font(a));
  const her = women[0];
  if (!her) return undefined;

  const married = her.marriages.some((m) => m.to === undefined);
  const rank = women.length > 1 ? `more of the blood than any woman living of the house` : 'the only carried font left in the house';
  return {
    person: her,
    because: married
      ? `carries ${rank}, and is already married.`
      : `carries ${rank}, and has not been spent yet.`,
  };
}

/** The hall with the wound, and whoever speaks for it. */
function aggrieved(ctx: SimCtx): { person: Person; because: string } | undefined {
  const w = ctx.world;
  const halls = [...w.branches.values()]
    .filter((b) => b.extinct === undefined && b.grievance > 0)
    .sort((a, b) => b.grievance - a.grievance);
  for (const b of halls) {
    const speaker = wouldSpeakFor(ctx, b.id);
    if (!speaker) continue;
    const held = b.heldSeal ? `has not held the seal since ${b.heldSeal}` : 'has never held the seal';
    return {
      person: speaker,
      because: `speaks for ${b.name}, which ${held} and is owed ${Math.round(b.grievance)} for it.`,
    };
  }
  return undefined;
}

/**
 * WHO CAME IN. A wife of another house is not of the blood and is not in any
 * hall of ours by descent — and in a game about a bloodline she is the easiest
 * person in the house to stop seeing, which is the whole argument for putting
 * her on this list.
 */
function marriedIn(ctx: SimCtx, living: Person[]): { person: Person; because: string } | undefined {
  const w = ctx.world;
  const font = (p: Person) => phenotypeOf(p, ctx.genetics, w.year).eldritch.carriedFont;
  const outsiders = living.filter((p) => p.houseOfOrigin !== w.playerHouse
    && p.marriages.some((m) => m.to === undefined));
  if (!outsiders.length) return undefined;

  const childrenOf = (p: Person) => living.filter(
    (q) => q.trueParents.mother === p.id || q.trueParents.father === p.id,
  );

  const scored = outsiders
    .map((p) => ({ p, kids: childrenOf(p), font: font(p) }))
    .sort((a, b) => b.kids.length - a.kids.length || b.font - a.font);
  const best = scored[0];
  if (!best) return undefined;

  const house = ctx.content.house(best.p.houseOfOrigin)?.name ?? best.p.houseOfOrigin;
  const because = best.kids.length
    ? `married in from ${house}, and ${best.kids.length} of the house's living are hers.`
    : `married in from ${house}, and has given the house nobody yet.`;
  return { person: best.p, because };
}

/**
 * Five to seven people, this year, with a reason each.
 *
 * Recomputed on every call and stored nowhere (invariant 6). The order is the
 * order a client should draw them in: it is priority order, not importance —
 * the head first because he is answerable, and the outsider last because she
 * is the one nobody would have looked for.
 */
export function castOf(ctx: SimCtx): CastMember[] {
  const w = ctx.world;
  const living = w.people.household(w.playerHouse, w.year);
  if (!living.length) return [];

  const head = living.find((p) => p.castSlots.includes('head'));
  const picks = new Map<CastRole, { person: Person; because: string }>();

  if (head) {
    const since = w.headSince !== undefined && w.headSince <= w.year
      ? `has held the seal since ${w.headSince}`
      : 'holds the seal';
    picks.set('head', {
      person: head,
      because: `${since}, and answers for the ${living.length} living of the house.`,
    });
  }

  const next = heirApparent(ctx, head?.id);
  if (next) {
    const can = phenotypeOf(next, ctx.genetics, w.year).eldritch.canExpress;
    picks.set('heir', {
      person: next,
      because: can
        ? 'takes the seat the day it falls vacant.'
        : 'takes the seat the day it falls vacant, and cannot express a word of it.',
    });
  }

  const risk = atRisk(ctx, living);
  if (risk) picks.set('at_risk', risk);

  const her = carrier(ctx, living);
  if (her) picks.set('carrier', her);

  const wound = aggrieved(ctx);
  if (wound) picks.set('aggrieved', wound);

  const outsider = marriedIn(ctx, living);
  if (outsider) picks.set('married_in', outsider);

  const foremost = measureAscension(ctx).foremost;
  if (foremost) {
    const p = w.people.get(foremost.person);
    if (p) {
      picks.set('foremost', {
        person: p,
        because: foremost.standing.blocked
          ? `stands highest of anyone, and ${foremost.standing.blocked}`
          : `stands highest of anyone the house has.`,
      });
    }
  }

  // ONE PERSON, ONE ROW. The head is very often the heir's father, the
  // foremost man and the one at risk all at once; a list that showed him four
  // times would be a list of four people again.
  const seen = new Set<string>();
  const out: CastMember[] = [];
  for (const role of ROLES) {
    const pick = picks.get(role);
    if (!pick || seen.has(pick.person.id)) continue;
    seen.add(pick.person.id);
    const branch = branchOf(w, pick.person, w.year);
    out.push({
      person: pick.person.id,
      name: pick.person.name,
      role,
      sex: pick.person.sex,
      age: ageOf(ctx, pick.person),
      hall: branch === MAIN_BRANCH ? 'the seat' : w.branches.get(branch)?.name ?? branch,
      because: pick.because,
    });
    if (out.length === CAST_MAX) break;
  }
  return out;
}
