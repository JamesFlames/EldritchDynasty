import type { Grudge, Person, PersonId, Relationship } from '@ed/schema';
import { asId } from '@ed/schema';
import type { SimCtx, WorldState } from '../world.js';

/**
 * RELATIONSHIPS AND GRUDGES.
 *
 * "Enemies are not a type. Hostility is an edge" — `schema/src/house.ts` said
 * so, defined `Relationship` and `Grudge` with an `inheritance` enum, and
 * nothing anywhere read either of them. Four authored outcomes emitted
 * `kind: relationship` effects, including the seal feud's own grudge —
 * severity 60, `inheritance: all_blood` — and every one of them evaporated at
 * the point of application. The effect switch listed the case with a comment
 * saying it was handled by its own subsystem. There was no subsystem.
 *
 * The point of the enum is that a grudge OUTLIVES the man who took it. A feud
 * whose parties are both dead by the second generation is not a feud, it is an
 * argument — so the same fall-through the arc bindings use applies here: his
 * heir, then his closest blood, then his house. Only a vanished house ends it.
 */

const key = (from: string, to: string) => `${from}->${to}`;

export function edge(w: WorldState, from: string, to: string): Relationship | undefined {
  return w.relationships.get(key(from, to));
}

export function sentimentBetween(w: WorldState, from: string, to: string): number {
  return edge(w, from, to)?.sentiment ?? 0;
}

function upsert(w: WorldState, from: string, to: string): Relationship {
  const existing = w.relationships.get(key(from, to));
  if (existing) return existing;
  const fresh: Relationship = { from, to, sentiment: 0, kinds: [], grudges: [] };
  w.relationships.set(key(from, to), fresh);
  return fresh;
}

export function relate(
  w: WorldState,
  from: string,
  to: string,
  sentiment: number,
  kinds: Relationship['kinds'] = [],
): Relationship {
  const rel = upsert(w, from, to);
  rel.sentiment = Math.max(-100, Math.min(100, rel.sentiment + sentiment));
  for (const k of kinds) if (!rel.kinds.includes(k)) rel.kinds.push(k);
  return rel;
}

export function addGrudge(
  ctx: SimCtx,
  from: string,
  to: string,
  spec: { severity: number; inheritance: Grudge['inheritance'] },
  originEvent = 'unrecorded',
): Grudge {
  const w = ctx.world;
  const rel = upsert(w, from, to);
  if (!rel.kinds.includes('rival')) rel.kinds.push('rival');

  const grudge: Grudge = {
    id: `gr_${(w.counters.grudge += 1).toString(36)}`,
    originEvent,
    originYear: w.year,
    severity: Math.max(0, Math.min(100, spec.severity)),
    inheritance: spec.inheritance,
    // Severe grudges last longer, which is the only sense in which severity is
    // a duration. A slight fades in a generation; a killing does not.
    decayPerYear: 0.35,
  };
  rel.grudges.push(grudge);
  return grudge;
}

/** Every grudge anyone currently holds against this person. */
export function grudgesAgainst(w: WorldState, id: string): Grudge[] {
  const out: Grudge[] = [];
  for (const rel of w.relationships.values()) {
    if (rel.to === id) out.push(...rel.grudges);
  }
  return out;
}

/** The worst live grudge held against anyone of the player's house. */
export function grudgeAgainstUs(w: WorldState): number {
  let worst = 0;
  for (const rel of w.relationships.values()) {
    const target = w.people.get(rel.to);
    const theirs = (target?.houseOfOrigin) === w.playerHouse
      || target?.membership.some((m) => m.house === w.playerHouse && m.to === undefined);
    if (!theirs) continue;
    for (const g of rel.grudges) worst = Math.max(worst, g.severity);
  }
  return worst;
}

/**
 * Who takes up his quarrel.
 *
 * Deliberately the same chain `events/arcs.ts` uses for bindings, and for the
 * same reason: in a game whose time unit is a generation, both parties being
 * dead is the NORMAL case, not the edge case. `heir_only` gives up if there is
 * no child, because that is what the policy says; everything else falls
 * through, and only a vanished house ends a feud.
 */
function successorTo(w: WorldState, id: string, mode: Grudge['inheritance']): string | undefined {
  const p = w.people.get(id);
  if (!p) return undefined;

  const byAge = (xs: Person[]) => [...xs].sort((a, b) => a.born - b.born);
  const alive = (xs: Person[]) => xs.filter((x) => x.status === 'alive');

  const heir = () => byAge(alive(w.people.children(p.id)))[0];
  const blood = () => byAge(alive(w.people.siblings(p.id)))[0];
  const house = () => byAge(
    w.people.living().filter((q) => q.houseOfOrigin === p.houseOfOrigin && q.id !== p.id),
  )[0];

  const chain = mode === 'heir_only' ? [heir]
    : mode === 'all_blood' ? [heir, blood]
      : [heir, blood, house];

  for (const step of chain) {
    const found = step();
    if (found) return found.id;
  }
  return undefined;
}

/**
 * Annual upkeep: fade what is fading, and move what is inherited down a
 * generation. Without the re-pointing every relationship in the world is
 * between two corpses within forty years, which reads exactly like a working
 * feud system holding no feuds.
 */
export function tickRelationships(ctx: SimCtx): void {
  const w = ctx.world;
  const dead = (id: string) => {
    const p = w.people.get(id);
    return !p || (p.status !== 'alive' && p.status !== 'guardian');
  };

  for (const [k, rel] of [...w.relationships]) {
    // Sentiment cools toward indifference; grudges are what persist.
    rel.sentiment *= 0.995;
    if (Math.abs(rel.sentiment) < 1) rel.sentiment = 0;

    rel.grudges = rel.grudges.filter((g) => {
      g.severity -= g.decayPerYear;
      return g.severity > 1;
    });

    if (!rel.grudges.length && rel.sentiment === 0) {
      w.relationships.delete(k);
      continue;
    }

    // Re-point either end that has died, per the grudge's own policy. A
    // relationship carrying grudges with different policies keeps the widest.
    const policy = rel.grudges.reduce<Grudge['inheritance']>(
      (widest, g) => (RANK[g.inheritance] > RANK[widest] ? g.inheritance : widest),
      'none',
    );
    if (policy === 'none') {
      if (dead(rel.from) || dead(rel.to)) w.relationships.delete(k);
      continue;
    }

    const from = dead(rel.from) ? successorTo(w, rel.from, policy) : rel.from;
    const to = dead(rel.to) ? successorTo(w, rel.to, policy) : rel.to;

    // A feud with nobody left to hold it is over. That is the correct way for
    // a feud to end, and the only one.
    if (!from || !to || from === to) { w.relationships.delete(k); continue; }
    if (from === rel.from && to === rel.to) continue;

    w.relationships.delete(k);
    const moved = upsert(w, from, to);
    moved.sentiment = Math.max(-100, Math.min(100, moved.sentiment + rel.sentiment));
    moved.grudges.push(...rel.grudges);
    for (const kind of rel.kinds) if (!moved.kinds.includes(kind)) moved.kinds.push(kind);
    moved.from = from;
    moved.to = to;
  }
}

const RANK: Record<Grudge['inheritance'], number> = {
  none: 0,
  heir_only: 1,
  all_blood: 2,
  house_wide: 3,
};

/** Whoever hates us most, for casting a rival who has a reason. */
export function bitterestAgainst(w: WorldState, houseId: string): PersonId | undefined {
  let worst: { id: string; severity: number } | undefined;
  for (const rel of w.relationships.values()) {
    const target = w.people.get(rel.to);
    if (!target) continue;
    const theirs = target.membership.some(
      (m) => m.house === houseId && m.to === undefined,
    );
    if (!theirs) continue;
    const holder = w.people.get(rel.from);
    if (!holder || holder.status !== 'alive') continue;
    for (const g of rel.grudges) {
      if (!worst || g.severity > worst.severity) worst = { id: rel.from, severity: g.severity };
    }
  }
  return worst ? asId<PersonId>(worst.id) : undefined;
}
