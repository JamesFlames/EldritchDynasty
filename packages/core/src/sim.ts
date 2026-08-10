/**
 * BOOTSTRAP AND THE PLAYER'S VERBS.
 *
 * What a year DOES lives in `year/phases.ts`; how a population moves lives in
 * `people/demography.ts`. This file builds the world, puts the founding cast in
 * it, and holds the handful of things the player does directly to a person.
 */
import type { Content, ContentBundle, GenePool, Person, SeedPerson } from '@ed/schema';
import { asId, indexContent } from '@ed/schema';
import { buildLocusTable } from './genetics/loci.js';
import { randomGenome } from './genetics/meiosis.js';
import { makePerson, phenotypeOf, type GeneticsCtx } from './people/factory.js';
import { expectedAttribute } from './genetics/expression.js';
import { createWorld, type SimCtx, type WorldState } from './world.js';
import { hashSeed, makeRng, type Rng } from './rng.js';
import { autoMarry } from './people/demography.js';
import { branchOf } from './people/branches.js';
import { grantOpeningClause } from './ages/scheduler.js';

export function makeGeneticsCtx(content: Content, seed: number): GeneticsCtx {
  const pools = new Map<string, GenePool>();
  for (const h of content.houses) pools.set(h.id, h.genePool);
  const table = buildLocusTable(content.loci);
  return {
    table,
    attributes: content.attributes,
    traits: content.traits,
    pools,
    runSeed: seed,
    expected: new Map(content.attributes.map((a) => [String(a.id), expectedAttribute(table, String(a.id))])),
  };
}

/**
 * Build a world and put the founding cast in it.
 *
 * Takes either the raw bundle or an already-indexed `Content` — tests hand over
 * whatever they loaded, the harness indexes once and reuses it across a
 * thousand runs.
 */
export function bootstrap(source: ContentBundle | Content, seed = 1042, startYear = 1042): SimCtx {
  const content = indexContent(source);
  const world = createWorld(content, seed, startYear);
  const genetics = makeGeneticsCtx(content, seed);
  const ctx: SimCtx = { world, content, genetics, takenNames: new Set() };

  const byKey = new Map<string, Person>();
  const ordered = orderSeeds(content.characters);

  for (const s of ordered) {
    const rng = makeRng(hashSeed(seed, 'seed-person', s.key));
    const pool = genetics.pools.get(s.house);
    const genome = randomGenome(genetics.table, pool, s.sex, rng);

    // `bias` nudges an authored intent without pinning the genome: the founder
    // is meant to be formidable, but the alleles are still rolled.
    applyBias(genome, s, genetics, rng);

    // Born of one house, living in another. A wife of House Ilm who has
    // married into The Eldritch House is a daughter of Ilm AND a member of the
    // Gearithy household, and the two facts are stored separately because they
    // are two different facts: one decides her genome, one decides who feeds her.
    const attached = s.household
      ?? (s.membership === 'blood' || s.membership === 'cadet' || s.membership === 'none'
        ? s.house
        : world.playerHouse);

    const p = makePerson({
      sex: s.sex,
      born: s.born,
      house: s.house,
      name: s.name,
      epithet: s.epithet,
      genome: { kind: 'materialized', genome },
      membership: s.membership,
      seed: hashSeed(seed, s.key),
      seq: world,
    });
    p.membership = [{ house: asId(attached), kind: s.membership, from: s.born }];
    p.castSlots = [...s.castSlots];
    if (s.isHead) p.castSlots.push('head');
    if (s.becomesGuardian) p.becomesGuardian = true;
    if (s.contract) p.contract = s.contract;
    for (const t of s.traits) p.traits.add(asId(t));
    if ((s.house !== world.playerHouse)) p.tier = 'hot';

    world.people.add(p);
    ctx.takenNames.add(p.name);
    byKey.set(s.key, p);
  }

  // Second pass: parentage and marriages, now that everyone exists.
  for (const s of ordered) {
    const p = byKey.get(s.key)!;
    world.people.setParents(p.id, {
      mother: s.motherKey ? byKey.get(s.motherKey)?.id : undefined,
      father: s.fatherKey ? byKey.get(s.fatherKey)?.id : undefined,
    });
    p.claimedParents = { ...p.trueParents };
  }
  autoMarry(ctx, makeRng(hashSeed(seed, 'bootstrap-marriages')));

  const founder = [...byKey.values()].find((p) => p.becomesGuardian);
  world.narrator = founder ? founder.id : undefined;

  // "The player begins knowing one" (concept §18).
  grantOpeningClause(ctx);

  world.chronicle.push({
    year: startYear,
    weight: 'illuminated',
    title: 'A Debt of Three Parts',
    text: `In the year 1042 ${founder?.name ?? 'the head of the house'} signed something, `
      + 'and the house has been paying for it ever since.',
    named: true,
  });

  return ctx;
}

function orderSeeds(seeds: SeedPerson[]): SeedPerson[] {
  const out: SeedPerson[] = [];
  const placed = new Set<string>();
  let remaining = [...seeds];
  let guard = 0;
  while (remaining.length && guard++ < 50) {
    const ready = remaining.filter(
      (s) => (!s.motherKey || placed.has(s.motherKey)) && (!s.fatherKey || placed.has(s.fatherKey)),
    );
    if (!ready.length) { out.push(...remaining); break; }
    for (const s of ready) { out.push(s); placed.add(s.key); }
    remaining = remaining.filter((s) => !placed.has(s.key));
  }
  return out;
}

function applyBias(genome: ReturnType<typeof randomGenome>, s: SeedPerson, ctx: GeneticsCtx, rng: Rng): void {
  for (const [attrKey, strength] of Object.entries(s.bias)) {
    const contribs = ctx.table.byAttribute.get(attrKey) ?? [];
    for (const c of contribs) {
      if (!rng.bool(Math.min(0.95, Math.abs(strength)))) continue;
      const alleles = c.where === 'autosomal' ? ctx.table.autosomalAlleles[c.index]! : ctx.table.xAlleles[c.index]!;
      const best = alleles
        .map((a, i) => ({ a, i }))
        .sort((x, y) => (strength >= 0 ? y.a.effect - x.a.effect : x.a.effect - y.a.effect))[0];
      if (!best) continue;
      if (c.where === 'autosomal') genome.autosomal[rng.int(2)]![c.index] = best.i;
      else genome.sex[0][c.index] = best.i;
    }
  }
}

/**
 * NAMING THE CHILDREN.
 *
 * Every newborn of the player's household is given a generated name so nothing
 * downstream can hold a nameless person, and is queued for the player to
 * rename. Naming is one of the few things the player does directly to an
 * individual rather than to the bloodline, and it should feel like it.
 *
 * The queue drains on rename or on `clearNamingQueue`. Ignoring it is a valid
 * way to play: the chronicler picked a name, and the chronicler is not you.
 */
export function renameChild(ctx: SimCtx, personId: string, name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;

  const p = ctx.world.people.get(personId);
  if (!p) return false;

  const pending = ctx.world.pendingNames.find((n) => n.person === personId);
  if (!pending) return false;

  ctx.takenNames.delete(p.name);
  p.name = trimmed;
  ctx.takenNames.add(trimmed);
  pending.chosen = trimmed;

  ctx.world.pendingNames = ctx.world.pendingNames.filter((n) => n.person !== personId);
  ctx.world.chronicle.push({
    year: ctx.world.year,
    weight: 'line',
    text: `${trimmed} was born, and named.`,
    named: false,
  });
  return true;
}

export function clearNamingQueue(ctx: SimCtx): void {
  ctx.world.pendingNames = [];
}

export function familySnapshot(ctx: SimCtx) {
  const w = ctx.world;
  return w.people.all().map((p) => {
    const ph = phenotypeOf(p, ctx.genetics, w.year);
    return {
      id: p.id,
      name: p.name,
      epithet: p.epithet,
      sex: p.sex,
      born: p.born,
      died: p.died,
      status: p.status,
      generation: w.people.generationOf(p.id),
      mother: p.trueParents.mother,
      father: p.trueParents.father,
      house: p.houseOfOrigin,
      awakened: p.awakening.awakened,
      madness: p.madness,
      sigilSeed: p.sigilSeed,
      branch: p.status === 'alive' ? branchOf(w, p, w.year) : undefined,
      castSlots: p.castSlots,
      contract: p.contract,
      eldritch: ph.eldritch,
      attrs: Object.fromEntries(ph.attrs),
    };
  });
}

export type FamilyMember = ReturnType<typeof familySnapshot>[number];
export type { WorldState };

// The year lives next door now. Re-exported so `import { stepYear } from
// '@ed/core'` — which is what every test, the harness and the editor write —
// keeps meaning what it meant.
export { stepYear, runYears } from './year/step.js';
export type { YearReport } from './year/report.js';
