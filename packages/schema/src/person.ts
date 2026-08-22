import { z } from 'zod';
import {
  PersonIdS, HouseIdS, TraitIdS, AttributeIdS, CareerIdS, SpellbookIdS,
  ArcIdS, YearS, FlagIdS,
} from './ids.js';
import { SexS } from './attributes.js';
import type { AttributeId, HouseId, PersonId, TraitId, Year, SpellbookId, ArcId, FlagId, CareerId } from './ids.js';
import type { EldritchProfile, GenomeRef } from './genome.js';
import type { Sex } from './attributes.js';

/**
 * ONE Person type for everyone: family, dead, hirelings, lifetime servants,
 * enemies, rival houses, a name in a forged pedigree. Not five types with five
 * code paths — in this game a hireling marries in, an enemy's sister becomes
 * the matriarch, and a dead man keeps voting through inherited grudges. Any
 * boundary drawn between person-types gets crossed by generation nine.
 */

export const PersonStatusS = z.enum([
  'alive',
  'dead',
  'vessel_consumed',   // greyed, but not the mark for death (concept §22)
  'missing',
  'given_to_church',
  'ascended',
  /**
   * The Narrator. Daveed Gearithy does not die when death is triggered for
   * him — he becomes the house's guardian spirit and makes its decisions from
   * that day forward. He is the player's own voice: the thing that persists
   * while individuals are born, ruined and buried.
   */
  'guardian',
]);
export type PersonStatus = z.infer<typeof PersonStatusS>;

/** hot = living and query-fast. archived = dead or inert. shade = never met. */
export const StorageTierS = z.enum(['hot', 'archived', 'shade']);
export type StorageTier = z.infer<typeof StorageTierS>;

export const MembershipKindS = z.enum([
  'blood', 'married_in', 'retainer', 'ward', 'hostage', 'clergy', 'cadet', 'none',
]);
export type MembershipKind = z.infer<typeof MembershipKindS>;

export const MembershipRecordS = z.object({
  house: HouseIdS,
  kind: MembershipKindS,
  from: YearS,
  to: YearS.optional(),
  branch: z.string().optional(),
});
export type MembershipRecord = z.infer<typeof MembershipRecordS>;

export const RetainerRoleS = z.enum([
  'tutor', 'steward', 'guard', 'midwife', 'archivist', 'singer', 'physician', 'chronicler',
]);
export type RetainerRole = z.infer<typeof RetainerRoleS>;

export const RetainerContractS = z.object({
  role: RetainerRoleS,
  term: z.enum(['seasonal', 'yearly', 'lifetime', 'bonded', 'hereditary']),
  wage: z.number(),                       // in marks per year
  loyalty: z.number().min(0).max(100).default(50),
  boundTo: z.string(),
  onEmployerDeath: z.enum(['released', 'passes_to_heir', 'freed', 'follows_named']).default('passes_to_heir'),
  /**
   * What leaves with them, and to whom. A dismissed archivist who knows a
   * Discrepancy is a Discrepancy with legs.
   */
  knowsSecrets: z.array(FlagIdS).default([]),
});
export type RetainerContract = z.infer<typeof RetainerContractS>;

/**
 * A SECRET THAT LEFT THE HOUSE.
 *
 * `knowsSecrets` and `loyalty` were declared on every authored contract and
 * read by nothing (AGENTS.md, "Known gaps"). This is the state that makes them
 * mean something: when service ends, what a retainer knows is tested against
 * how loyal they were and how badly they were let go, and what fails the test
 * walks out with them.
 *
 * A loose secret is not yet a told one. It sits with whoever took them on, for
 * as long as it takes to be asked in the friendly way, and the year it is told
 * it becomes an open Discrepancy under its own id — provable by the house that
 * now holds it, which is what puts it in the auction's stock and lets the
 * family buy its own secret back. That is the whole of "a Discrepancy with
 * legs", and none of it is new machinery.
 */
export interface LooseSecret {
  /** The secret's id, and the id of the Discrepancy it becomes when told. */
  secret: string;
  /** Who carried it out. Dead or alive: a copy does not need anyone living. */
  carrier: string;
  carrierName: string;
  /** The house that took them on, and can therefore prove it. */
  house: string;
  /** The year service ended, which is the year the clock starts. */
  since: Year;
  /** Nineteen years of knowing where things are is worth more than two. */
  severity: 'minor' | 'major';
  /** The year it was finally told. Undefined while it is still only walking. */
  told?: Year;
}

export const AwakeningStateS = z.object({
  awakened: z.boolean().default(false),
  year: YearS.optional(),
  age: z.number().optional(),
  forced: z.boolean().default(false),
  declaredMundane: z.boolean().default(false),
});
export type AwakeningState = z.infer<typeof AwakeningStateS>;

/** Dowry currency. Forgeable, and forging them is an industry (concept §7). */
export const LineageDocumentS = z.object({
  generations: z.number().int(),
  notarisedBy: z.string(),
  forged: z.boolean().default(false),
  claims: z.string().optional(),
});
export type LineageDocument = z.infer<typeof LineageDocumentS>;

export interface PhenotypeCache {
  /**
   * Keyed by plain attribute id, and plain on purpose. The attribute list is
   * OPEN — an attribute is six loci and a row of YAML, and nothing in the
   * engine counts them — so every reader here holds a string that came out of
   * content. Branding the key bought nothing and cost a cast at every single
   * read site, which is how `as unknown as Map<string, number>` ended up in the
   * hot path of the phenotype accessor.
   */
  attrs: Map<string, number>;
  eldritch: EldritchProfile;
  computedAtYear: Year;
  dirty: boolean;
}

export interface Person {
  id: PersonId;
  name: string;
  /** Some people are deliberately unnamed. The founder is "the man". */
  epithet?: string;
  sex: Sex;
  sigilSeed: number;
  houseOfOrigin: HouseId;

  born: Year;
  died?: Year;
  status: PersonStatus;
  causeOfDeath?: string;

  /** Two lineages, deliberately. The documents may not match the blood. */
  trueParents: { mother?: PersonId; father?: PersonId };
  claimedParents: { mother?: PersonId; father?: PersonId };
  lineageDocuments: LineageDocument[];

  genome: GenomeRef;
  phenotype?: PhenotypeCache;

  traits: Set<TraitId>;
  awakening: AwakeningState;
  spellsKnown: SpellbookId[];
  career?: { career: CareerId; from: Year };

  membership: MembershipRecord[];
  contract?: RetainerContract;
  marriages: { spouse: PersonId; from: Year; to?: Year }[];

  /** Madness, accrued. Only ever nonzero where canExpress is true. */
  madness: number;

  /**
   * ACQUIRED modifiers — education, injury, event effects, career. Kept apart
   * from the phenotype cache because that cache is DERIVED and gets recomputed
   * from the genome whenever the year changes. Writing an effect into the
   * cache looks like it works and is gone by next spring, which silently made
   * every `attribute` effect in the game inert.
   */
  acquired: Record<string, number>;

  castSlots: string[];
  arcBindings: ArcId[];
  tier: StorageTier;

  /**
   * Death is redirected rather than applied. Set only for the Narrator, and
   * checked inside PersonStore.kill so that EVERY death path routes through
   * one gate — plague, duel, madness overflow, an authored `status` effect.
   * A second place that kills people is a second place that can kill him.
   */
  becomesGuardian?: boolean;

  /** Which CharacterTemplate produced them, if they were not authored. */
  mintedFrom?: string;
}

export function isAlive(p: Person): boolean {
  return p.status === 'alive';
}

export function ageAt(p: Person, year: Year): number {
  return (p.died ?? year) - p.born;
}

export function currentMembership(p: Person, year: Year): MembershipRecord | undefined {
  return p.membership.find((m) => m.from <= year && (m.to === undefined || m.to > year));
}
