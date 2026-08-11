import type {
  Content, ContentBundle, Genome, Person, SavedGame, StoredGenome, StoredPerson,
  ArcId, SpellbookId, TraitId,
} from '@ed/schema';
import { asId, indexContent, SAVE_FORMAT, SavedGameS } from '@ed/schema';
import { createWorld, type SimCtx } from './world.js';
import { makeGeneticsCtx } from './sim.js';
import { PersonStore } from './people/store.js';

/**
 * SAVING AND LOADING A RUN.
 *
 * The world is a graph of Maps, Sets, a class instance and three typed arrays
 * per person. None of that is JSON, so this file is the boundary where a run
 * becomes a value and back — see `@ed/schema/save.ts` for the format itself.
 *
 * Two rules, and both of them are the same rule as invariant 6:
 *
 *   DERIVED STATE IS NOT SAVED. The phenotype cache, the house table and the
 *   content bundle are rebuilt on load. A save carrying them could disagree
 *   with the content it was loaded against, and it would do so silently.
 *
 *   EVERYTHING ELSE IS. A field that exists on the world and is missing from
 *   the format does not fail to save — it silently resets to its starting value
 *   on load, which looks like a subsystem that quietly stopped working two
 *   hundred years in. The compile-time checks in `save.ts` and the round-trip
 *   test in `save.test.ts` are both aimed at exactly that.
 */

export function saveGame(ctx: SimCtx): SavedGame {
  const w = ctx.world;
  return {
    format: SAVE_FORMAT,
    savedAt: new Date().toISOString(),

    seed: w.seed,
    year: w.year,
    generation: w.generation,
    playerHouse: w.playerHouse,

    people: w.people.all().map(storePerson),
    takenNames: [...ctx.takenNames],

    branches: [...w.branches.values()],
    relationships: [...w.relationships.entries()],

    treasury: w.treasury,
    respect: w.respect,
    ...(w.respectChanged !== undefined ? { respectChanged: w.respectChanged } : {}),
    discontent: w.discontent,

    flags: [...w.flags.entries()],
    knowledge: [...w.knowledge],
    clausesRecovered: [...w.clausesRecovered],
    rumours: [...w.rumours.entries()],
    discrepancies: [...w.discrepancies.entries()],

    age: w.age,
    arcs: [...w.arcs.entries()],
    heirlooms: [...w.heirlooms.entries()],
    scheduled: w.scheduled,

    frequency: w.frequency,
    characterFrequency: w.characterFrequency,

    chronicle: w.chronicle,
    log: w.log,
    decisionLog: w.decisionLog,
    frame: w.frame,

    ...(w.narrator !== undefined ? { narrator: w.narrator } : {}),
    ...(w.guardianSince !== undefined ? { guardianSince: w.guardianSince } : {}),
    ...(w.headSince !== undefined ? { headSince: w.headSince } : {}),

    pendingNames: w.pendingNames,
    pendingDecisions: w.pendingDecisions as SavedGame['pendingDecisions'],

    counters: w.counters,
  };
}

export class SaveFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveFormatError';
  }
}

/**
 * Rebuild a run from a save.
 *
 * `content` is passed in rather than stored, because the authored game is not
 * part of a save: an editor session between save and load is the normal case,
 * not the exception. What the save owns is everything the player caused.
 */
export function loadGame(raw: unknown, source: ContentBundle | Content): SimCtx {
  const format = (raw as { format?: unknown } | null)?.format;
  if (format !== SAVE_FORMAT) {
    throw new SaveFormatError(`save format ${String(format)}, expected ${SAVE_FORMAT}`);
  }

  const parsed = SavedGameS.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new SaveFormatError(`save is not readable: ${first?.path.join('.')} — ${first?.message}`);
  }
  const s = parsed.data;

  const content = indexContent(source);
  // `createWorld` supplies the shape and the derived house table; everything
  // below overwrites the parts a run actually owns.
  const world = createWorld(content, s.seed, s.year);
  const ctx: SimCtx = {
    world,
    content,
    genetics: makeGeneticsCtx(content, s.seed),
    takenNames: new Set(s.takenNames),
  };

  world.generation = s.generation;
  world.playerHouse = s.playerHouse;

  world.people = new PersonStore();
  for (const p of s.people) world.people.add(restorePerson(p));

  world.branches = new Map(s.branches.map((b) => [String(b.id), b]));
  world.relationships = new Map(s.relationships);

  world.treasury = s.treasury;
  world.respect = s.respect;
  if (s.respectChanged !== undefined) world.respectChanged = s.respectChanged;
  world.discontent = s.discontent;

  world.flags = new Map(s.flags);
  world.knowledge = new Set(s.knowledge);
  world.clausesRecovered = new Set(s.clausesRecovered);
  world.rumours = new Map(s.rumours);
  world.discrepancies = new Map(s.discrepancies);

  world.age = s.age;
  world.arcs = new Map(s.arcs);
  world.heirlooms = new Map(s.heirlooms);
  world.scheduled = s.scheduled;

  world.frequency = s.frequency;
  world.characterFrequency = s.characterFrequency;

  world.chronicle = s.chronicle;
  world.log = s.log;
  world.decisionLog = s.decisionLog;
  world.frame = s.frame;

  if (s.narrator !== undefined) world.narrator = s.narrator;
  if (s.guardianSince !== undefined) world.guardianSince = s.guardianSince;
  if (s.headSince !== undefined) world.headSince = s.headSince;

  world.pendingNames = s.pendingNames;
  world.pendingDecisions = s.pendingDecisions as typeof world.pendingDecisions;

  world.counters = s.counters;

  return ctx;
}

// ── People ────────────────────────────────────────────────────────────────

function storePerson(p: Person): StoredPerson {
  return {
    id: p.id,
    name: p.name,
    ...(p.epithet !== undefined ? { epithet: p.epithet } : {}),
    sex: p.sex,
    sigilSeed: p.sigilSeed,
    houseOfOrigin: p.houseOfOrigin,
    born: p.born,
    ...(p.died !== undefined ? { died: p.died } : {}),
    status: p.status,
    ...(p.causeOfDeath !== undefined ? { causeOfDeath: p.causeOfDeath } : {}),
    trueParents: { ...p.trueParents },
    claimedParents: { ...p.claimedParents },
    lineageDocuments: p.lineageDocuments,
    genome: p.genome.kind === 'materialized'
      ? { kind: 'materialized', genome: storeGenome(p.genome.genome) }
      : { kind: 'lazy', pool: p.genome.pool, seed: p.genome.seed },
    traits: [...p.traits],
    awakening: p.awakening,
    spellsKnown: [...p.spellsKnown],
    ...(p.career ? { career: { career: String(p.career.career), from: p.career.from } } : {}),
    membership: p.membership,
    ...(p.contract ? { contract: p.contract } : {}),
    marriages: p.marriages,
    madness: p.madness,
    acquired: p.acquired,
    castSlots: p.castSlots,
    arcBindings: p.arcBindings.map(String),
    tier: p.tier,
    ...(p.becomesGuardian !== undefined ? { becomesGuardian: p.becomesGuardian } : {}),
    ...(p.mintedFrom !== undefined ? { mintedFrom: p.mintedFrom } : {}),
    // The phenotype cache is deliberately absent. It is derived, and a saved
    // one would be a stale one the moment the year moved.
  };
}

function restorePerson(s: StoredPerson): Person {
  const p: Person = {
    id: asId(s.id),
    name: s.name,
    sex: s.sex,
    sigilSeed: s.sigilSeed,
    houseOfOrigin: asId(s.houseOfOrigin),
    born: s.born,
    status: s.status,
    trueParents: {
      ...(s.trueParents.mother ? { mother: asId(s.trueParents.mother) } : {}),
      ...(s.trueParents.father ? { father: asId(s.trueParents.father) } : {}),
    },
    claimedParents: {
      ...(s.claimedParents.mother ? { mother: asId(s.claimedParents.mother) } : {}),
      ...(s.claimedParents.father ? { father: asId(s.claimedParents.father) } : {}),
    },
    lineageDocuments: s.lineageDocuments,
    genome: s.genome.kind === 'materialized'
      ? { kind: 'materialized', genome: restoreGenome(s.genome.genome) }
      : { kind: 'lazy', pool: s.genome.pool, seed: s.genome.seed },
    traits: new Set(s.traits.map((t) => asId<TraitId>(t))),
    awakening: s.awakening,
    spellsKnown: s.spellsKnown.map((x) => asId<SpellbookId>(x)),
    membership: s.membership,
    marriages: s.marriages.map((m) => ({
      spouse: asId(m.spouse),
      from: m.from,
      ...(m.to !== undefined ? { to: m.to } : {}),
    })),
    madness: s.madness,
    acquired: s.acquired,
    castSlots: s.castSlots,
    arcBindings: s.arcBindings.map((x) => asId<ArcId>(x)),
    tier: s.tier,
  };

  if (s.epithet !== undefined) p.epithet = s.epithet;
  if (s.died !== undefined) p.died = s.died;
  if (s.causeOfDeath !== undefined) p.causeOfDeath = s.causeOfDeath;
  if (s.career) p.career = { career: asId(s.career.career), from: s.career.from };
  if (s.contract) p.contract = s.contract;
  if (s.becomesGuardian !== undefined) p.becomesGuardian = s.becomesGuardian;
  if (s.mintedFrom !== undefined) p.mintedFrom = s.mintedFrom;
  return p;
}

function storeGenome(g: Genome): StoredGenome {
  return {
    autosomal: [[...g.autosomal[0]], [...g.autosomal[1]]],
    sex: [[...g.sex[0]], g.sex[1] ? [...g.sex[1]] : null],
    mutations: g.mutations,
  };
}

function restoreGenome(g: StoredGenome): Genome {
  return {
    autosomal: [Int16Array.from(g.autosomal[0]), Int16Array.from(g.autosomal[1])],
    sex: [Int16Array.from(g.sex[0]), g.sex[1] ? Int16Array.from(g.sex[1]) : null],
    mutations: g.mutations,
  };
}

/**
 * A stable fingerprint of a run.
 *
 * The determinism tests used to assert on a handful of hand-picked numbers —
 * population, treasury, the head's name — which caught the divergence they were
 * written for and nothing else. A digest of the whole save covers every field
 * the format knows about, including the ones added after the test was written.
 */
export function digest(save: SavedGame): string {
  const json = canonical(save);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < json.length; i++) {
    const c = json.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}:${json.length}`;
}

export function digestOf(ctx: SimCtx): string {
  return digest(saveGame(ctx));
}

/**
 * JSON with object keys in a fixed order, and `savedAt` dropped.
 *
 * Property insertion order is not state. A membership record written as
 * `{ house, kind, from, branch }` and later given a `to` serialises differently
 * from the same record rebuilt by Zod in schema order — identical data, two
 * different strings. A digest that noticed the difference would fail every
 * round-trip test for a reason that means nothing, which is worse than having
 * no digest: it would be the tests crying wolf about the one property they
 * exist to protect.
 *
 * Array order IS state and is left alone.
 */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([k, v]) => v !== undefined && k !== 'savedAt')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}
