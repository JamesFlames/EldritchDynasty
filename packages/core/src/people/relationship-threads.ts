import type { SimCtx } from '../world.js';

export type ExternalThreadPressure = 'grievance' | 'evidence' | 'courtship' | 'family';
export type ExternalThreadDirection = 'hostile' | 'useful' | 'mixed';

export interface ExternalRelationshipThread {
  house: string;
  houseName: string;
  origin: {
    kind: ExternalThreadPressure;
    year: number;
    text: string;
    eventId?: string;
  };
  pressure: ExternalThreadPressure;
  direction: ExternalThreadDirection;
  /** Existing systems which already carry a concrete fact about this relationship. */
  touches: ('match' | 'record' | 'event')[];
  salience: number;
}

interface Candidate extends ExternalRelationshipThread {
  lastYear: number;
}

const CAP = 3;

function houseName(ctx: SimCtx, id: string): string {
  return ctx.world.houses.get(id)?.name ?? id;
}

function houseOf(ctx: SimCtx, personId: string): string | undefined {
  return ctx.world.people.get(personId)?.houseOfOrigin;
}

function addTouch(c: Candidate, touch: Candidate['touches'][number]): void {
  if (!c.touches.includes(touch)) c.touches.push(touch);
}

function candidate(
  byHouse: Map<string, Candidate>,
  ctx: SimCtx,
  house: string,
  origin: Candidate['origin'],
  pressure: ExternalThreadPressure,
  score: number,
  touch: Candidate['touches'][number],
): Candidate {
  const existing = byHouse.get(house);
  if (existing) {
    existing.salience += score;
    existing.lastYear = Math.max(existing.lastYear, origin.year);
    addTouch(existing, touch);
    // Keep the oldest concrete cause. The point of a recurring thread is that
    // the callback remembers where it began rather than silently renaming
    // itself after the latest consequence.
    if (origin.year < existing.origin.year) existing.origin = origin;
    if (pressure === 'grievance') existing.pressure = pressure;
    return existing;
  }
  const made: Candidate = {
    house,
    houseName: houseName(ctx, house),
    origin,
    pressure,
    direction: 'useful',
    touches: [touch],
    salience: score,
    lastYear: origin.year,
  };
  byHouse.set(house, made);
  return made;
}

function isExternal(ctx: SimCtx, house: string | undefined): house is string {
  return Boolean(house && house !== ctx.world.playerHouse);
}

function marriageLink(ctx: SimCtx, house: string): boolean {
  const w = ctx.world;
  for (const p of w.people.all()) {
    if (p.houseOfOrigin !== house && p.houseOfOrigin !== w.playerHouse) continue;
    for (const marriage of p.marriages) {
      const spouse = w.people.get(marriage.spouse);
      if (!spouse) continue;
      const pair = new Set<string>([String(p.houseOfOrigin), String(spouse.houseOfOrigin)]);
      if (pair.has(house) && pair.has(w.playerHouse)) return true;
    }
  }
  return false;
}

/**
 * The two or three outside names this house has most reason to remember NOW.
 *
 * This is deliberately a read model, not diplomacy state. It folds facts the
 * simulation already persists: inherited grudges, outside evidence, named
 * rejected rival-lineage courtships, chronicle claims and marriages. A save
 * therefore needs no relationship-thread field and no opinion bar can drift
 * away from the events which supposedly caused it.
 */
export function activeExternalThreads(ctx: SimCtx, limit = CAP): ExternalRelationshipThread[] {
  const w = ctx.world;
  const byHouse = new Map<string, Candidate>();

  for (const rel of w.relationships.values()) {
    const fromHouse = houseOf(ctx, rel.from);
    const toHouse = houseOf(ctx, rel.to);
    const outside = isExternal(ctx, fromHouse) && toHouse === w.playerHouse ? fromHouse
      : isExternal(ctx, toHouse) && fromHouse === w.playerHouse ? toHouse
        : undefined;
    if (!outside) continue;

    for (const grudge of rel.grudges) {
      candidate(byHouse, ctx, outside, {
        kind: 'grievance',
        year: grudge.originYear,
        eventId: grudge.originEvent,
        text: `${houseName(ctx, outside)} still carries what began with ${grudge.originEvent} in ${grudge.originYear}.`,
      }, 'grievance', 45 + grudge.severity, 'event');
    }
  }

  for (const loose of w.looseSecrets) {
    if (!isExternal(ctx, loose.house)) continue;
    const c = candidate(byHouse, ctx, loose.house, {
      kind: 'evidence',
      year: loose.since,
      text: `${loose.carrierName} carried ${loose.secret} to ${houseName(ctx, loose.house)} in ${loose.since}.`,
    }, 'evidence', loose.told === undefined ? 55 : 70, 'record');
    addTouch(c, 'event');
  }

  for (const [id, discrepancy] of w.discrepancies) {
    if (discrepancy.state !== 'open') continue;
    for (const house of discrepancy.provableBy) {
      if (!isExternal(ctx, house)) continue;
      const c = candidate(byHouse, ctx, house, {
        kind: 'evidence',
        year: w.year,
        text: `${houseName(ctx, house)} can still prove ${id}.`,
      }, 'evidence', 35, 'record');
      addTouch(c, 'event');
    }
  }

  for (const [house, lineage] of w.rivalLineages) {
    if (!isExternal(ctx, house)) continue;
    const remembered = lineage.people
      .filter((p) => p.courtship !== undefined)
      .sort((a, b) => (b.courtship?.offered ?? 0) - (a.courtship?.offered ?? 0))[0];
    if (!remembered?.courtship) continue;
    candidate(byHouse, ctx, house, {
      kind: 'courtship',
      year: remembered.courtship.offered,
      text: `${remembered.courtship.name} of ${houseName(ctx, house)} was put before the house in ${remembered.courtship.offered}.`,
    }, 'courtship', 45, 'match');
  }

  // Chronicle claims are another concrete route back to an outside house. They
  // make the same identity relevant to both the Record and the Match panel,
  // which already reads old pages about a card's house.
  for (const entry of w.chronicle) {
    for (const claim of entry.claims ?? []) {
      const house = houseOf(ctx, claim.person);
      if (!isExternal(ctx, house)) continue;
      const c = candidate(byHouse, ctx, house, {
        kind: 'evidence',
        year: entry.year,
        ...(entry.eventId ? { eventId: entry.eventId } : {}),
        text: `The house's own book named ${houseName(ctx, house)} in ${entry.year}.`,
      }, 'evidence', 18, 'record');
      addTouch(c, 'match');
    }
  }

  for (const c of byHouse.values()) {
    const useful = marriageLink(ctx, c.house);
    const hostile = c.pressure === 'grievance';
    c.direction = hostile && useful ? 'mixed' : hostile ? 'hostile' : 'useful';
    if (useful) {
      c.salience += 30;
      addTouch(c, 'match');
      if (c.origin.kind !== 'grievance') c.pressure = 'family';
    }
    // Recency breaks ties without erasing old origins.
    c.salience += Math.max(0, 25 - Math.floor((w.year - c.lastYear) / 4));
  }

  return [...byHouse.values()]
    .sort((a, b) => b.salience - a.salience || b.lastYear - a.lastYear || a.house.localeCompare(b.house))
    .slice(0, Math.max(0, Math.min(CAP, limit)))
    .map(({ lastYear: _lastYear, ...thread }) => thread);
}

export function externalThreadFor(ctx: SimCtx, house: string): ExternalRelationshipThread | undefined {
  return activeExternalThreads(ctx).find((thread) => thread.house === house);
}

/**
 * The highest-salience active thread represented by a concrete set of people.
 *
 * Event and Record consumers already know who was cast. Passing those ids
 * here keeps relationship memory attached to an actual outside participant
 * rather than spraying the currently hottest feud onto unrelated scenes.
 */
export function externalThreadForPeople(
  ctx: SimCtx,
  personIds: Iterable<string>,
): ExternalRelationshipThread | undefined {
  const houses = new Set<string>();
  for (const id of personIds) {
    const house = houseOf(ctx, id);
    if (isExternal(ctx, house)) houses.add(house);
  }
  return activeExternalThreads(ctx).find((thread) => houses.has(thread.house));
}
