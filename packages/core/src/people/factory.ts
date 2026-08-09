import type {
  AttributeDef, GenePool, Genome, GenomeRef, Person, PersonId, Sex, TraitDef, Year,
} from '@ed/schema';
import { asId } from '@ed/schema';
import { makeRng, hashSeed, conceptionSeed, type Rng } from '../rng.js';
import type { LocusTable } from '../genetics/loci.js';
import { conceive, meiosis, randomGenome } from '../genetics/meiosis.js';
import { eldritch, expressAttributes } from '../genetics/expression.js';
import { uniqueName } from './names.js';

export interface GeneticsCtx {
  table: LocusTable;
  attributes: AttributeDef[];
  traits: TraitDef[];
  pools: Map<string, GenePool>;
  runSeed: number;
  /**
   * Population means, computed from the locus table at bootstrap. Anything
   * mapping an attribute onto a real quantity centres on these rather than on
   * a constant that stops being true when the loci are retuned.
   */
  expected: Map<string, number>;
}

/**
 * Id allocation is per-WORLD, not per-module. A module-level counter is shared
 * by every simulation in the process, so the same seed produces different
 * people depending on what else has run — and since conception seeds are
 * derived from parent ids, that divergence reaches all the way into genomes.
 */
export interface IdSeq { counters: { person: number } }

export function nextPersonId(seq: IdSeq, prefix = 'p'): PersonId {
  seq.counters.person += 1;
  return asId<PersonId>(`${prefix}_${seq.counters.person.toString(36)}`);
}

/**
 * Lazy genome materialization. A shade servant costs 12 bytes until the day she
 * bears a child, at which point her genome exists, is consistent with her
 * house's pool, and would have been the same genome had she been materialized
 * on day one.
 */
export function materialize(ref: GenomeRef, sex: Sex, ctx: GeneticsCtx): Genome {
  if (ref.kind === 'materialized') return ref.genome;
  const rng = makeRng(ref.seed);
  return randomGenome(ctx.table, ctx.pools.get(ref.pool), sex, rng);
}

export function genomeOf(p: Person, ctx: GeneticsCtx): Genome {
  if (p.genome.kind === 'lazy') {
    p.genome = { kind: 'materialized', genome: materialize(p.genome, p.sex, ctx) };
  }
  return p.genome.genome;
}

export function phenotypeOf(p: Person, ctx: GeneticsCtx, year: Year) {
  if (p.phenotype && !p.phenotype.dirty && p.phenotype.computedAtYear === year) return p.phenotype;
  const g = genomeOf(p, ctx);
  const attrs = expressAttributes(g, p.sex, ctx.table, ctx.attributes, { awakened: p.awakening.awakened });

  // Genome first, then everything life did to them. The acquired layer has to
  // be re-applied on every recompute — it is not part of the derivation.
  for (const [key, delta] of Object.entries(p.acquired ?? {})) {
    attrs.set(key, (attrs.get(key) ?? 0) + delta);
  }

  p.phenotype = {
    attrs: attrs as never,
    eldritch: eldritch(g, p.sex, ctx.table),
    computedAtYear: year,
    dirty: false,
  };
  return p.phenotype;
}

export function attr(p: Person, key: string, ctx: GeneticsCtx, year: Year): number {
  return (phenotypeOf(p, ctx, year).attrs as unknown as Map<string, number>).get(key) ?? 0;
}

export function makePerson(init: {
  sex: Sex;
  born: Year;
  house: string;
  name: string;
  epithet?: string;
  genome: GenomeRef;
  membership?: Person['membership'][number]['kind'];
  mother?: PersonId;
  father?: PersonId;
  tier?: Person['tier'];
  seed: number;
  /** The world whose id sequence this person is drawn from. */
  seq: IdSeq;
}): Person {
  return {
    id: nextPersonId(init.seq),
    name: init.name,
    epithet: init.epithet,
    sex: init.sex,
    sigilSeed: init.seed,
    houseOfOrigin: asId(init.house),
    born: init.born,
    status: 'alive',
    trueParents: { mother: init.mother, father: init.father },
    claimedParents: { mother: init.mother, father: init.father },
    lineageDocuments: [],
    genome: init.genome,
    traits: new Set(),
    awakening: { awakened: false, forced: false, declaredMundane: false },
    spellsKnown: [],
    membership: [{ house: asId(init.house), kind: init.membership ?? 'blood', from: init.born }],
    marriages: [],
    madness: 0,
    acquired: {},
    castSlots: [],
    arcBindings: [],
    tier: init.tier ?? 'hot',
  };
}

export interface BirthResult {
  child?: Person;
  stillborn: boolean;
  reason?: string;
}

/**
 * Conception and birth. Everything the design asks for falls out of one pass
 * of meiosis run twice — including the fact that a hot line loses sons and
 * keeps daughters, which pushes a family toward Regency exactly when it is
 * closest to ascending.
 */
export function conceiveChild(
  mother: Person,
  father: Person,
  ordinal: number,
  year: Year,
  ctx: GeneticsCtx,
  takenNames: Set<string>,
  /**
   * The household the couple lives in. Children belong to it, not to either
   * parent's house of origin — which makes a matrilineal match (a groom who
   * joins his wife's house) work without a special case, and makes a daughter
   * married outward take her children with her without one either.
   */
  household: string,
  seq: IdSeq,
): BirthResult {
  const rng = makeRng(conceptionSeed(ctx.runSeed, String(mother.id), String(father.id), ordinal));

  const mg = genomeOf(mother, ctx);
  const fg = genomeOf(father, ctx);
  const motherGamete = meiosis(mg, ctx.table, 'female', rng, year);
  const fatherGamete = meiosis(fg, ctx.table, 'male', rng, year);
  const { genome, sex } = conceive(motherGamete, fatherGamete, ctx.table);

  // Deleterious homozygosity kills either sex.
  const load = countLethal(genome, ctx.table);
  if (load > 0 && rng.bool(Math.min(0.75, 0.28 * load))) {
    return { stillborn: true, reason: 'the blood ran too close' };
  }

  // Overflow in the womb is a MALE outcome: a daughter's second copy of the
  // blood modulates what a son's single copy cannot. The sex ratio bends
  // against the player under exactly the conditions the player worked hardest
  // to create, and the coin flip was never touched.
  const profile = eldritch(genome, sex, ctx.table);
  if (profile.canExpress && profile.overflowMadness > 0) {
    const risk = Math.min(0.55, profile.overflowMadness / 90);
    if (rng.bool(risk)) return { stillborn: true, reason: 'pressure with no vessel' };
  }

  const name = uniqueName(sex, takenNames, rng);
  takenNames.add(name);

  const child = makePerson({
    sex,
    house: household,
    born: year,
    name,
    genome: { kind: 'materialized', genome },
    mother: mother.id,
    father: father.id,
    seq,
    seed: hashSeed(ctx.runSeed, String(mother.id), String(father.id), ordinal),
  });
  child.madness = 0;
  return { child, stillborn: false };
}

function countLethal(g: Genome, table: LocusTable): number {
  let n = 0;
  for (let i = 0; i < table.autosomal.length; i++) {
    if (table.autosomal[i]!.kind !== 'deleterious') continue;
    if (g.autosomal[0][i] !== g.autosomal[1][i]) continue;
    const allele = table.autosomalAlleles[i]![g.autosomal[0][i]!];
    if (allele?.tags.includes('lethal_homozygous')) n += 1;
  }
  return n;
}

/**
 * Awakening. Timing is driven by carried font in BOTH sexes, even though only
 * one of them will ever use it — which makes an early-waking daughter the one
 * honest signal in a market built on forged documents.
 */
export function rollAwakening(p: Person, year: Year, ctx: GeneticsCtx, rng: Rng): boolean {
  if (p.awakening.awakened || p.awakening.declaredMundane) return false;
  const age = year - p.born;
  if (age < 2) return false;

  const font = phenotypeOf(p, ctx, year).eldritch.carriedFont;
  if (font <= 0) return false;

  // Higher carried font skews earlier and widens the tail.
  const peak = Math.max(6, 22 - font * 0.55);
  const spread = 7 + font * 0.2;
  const density = Math.exp(-((age - peak) ** 2) / (2 * spread ** 2));
  const chance = density * (0.03 + font * 0.004);
  if (rng.bool(chance)) {
    p.awakening = { awakened: true, year, age, forced: false, declaredMundane: false };
    if (p.phenotype) p.phenotype.dirty = true;
    return true;
  }
  return false;
}

/** Involuntary Madness accrual. Reads canExpress and nothing else. */
export function accrueMadness(p: Person, ctx: GeneticsCtx, year: Year): number {
  const profile = phenotypeOf(p, ctx, year).eldritch;
  if (!profile.canExpress) return 0;
  const delta = profile.overflowMadness / 40;
  p.madness += delta;
  return delta;
}
