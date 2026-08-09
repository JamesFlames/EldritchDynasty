import type {
  AgeState, ArcInstance, BranchState, ContentBundle, FrequencyLedger, HouseDef, RespectTier, Year,
} from '@ed/schema';
import { emptyAgeState, emptyFrequencyLedger } from '@ed/schema';
import { PersonStore } from './people/store.js';
import type { GeneticsCtx } from './people/factory.js';
import type { PendingDecision } from './events/decisions.js';

export interface ChronicleEntry {
  year: Year;
  /** Frequency decides how this renders: line | paragraph | page | illuminated. */
  weight: 'line' | 'paragraph' | 'page' | 'illuminated';
  title?: string;
  /** null prints as a dated blank line. The blank is a designed artefact. */
  text: string | null;
  eventId?: string;
  named: boolean;
  record?: 'record' | 'omit' | 'embellish';
  /**
   * Known to have existed, and gone: a dead cadet branch, a burned book, a
   * person nobody will mention again. Rendered grey (concept §6).
   */
  greyed?: boolean;
}

export interface WorldState {
  seed: number;
  year: Year;
  generation: number;
  playerHouse: string;

  people: PersonStore;
  houses: Map<string, HouseDef>;

  /**
   * Cadet branches, living and extinct (concept §16). Keyed by branch id; the
   * main hall is not in here, because it is not a branch — it is the house.
   */
  branches: Map<string, BranchState>;

  treasury: number;
  respect: RespectTier;
  discontent: number;

  flags: Map<string, boolean | number | string>;
  knowledge: Set<string>;
  clausesRecovered: Set<string>;
  rumours: Map<string, { accuracy: number; spread: number; seededYear: Year }>;
  discrepancies: Map<string, { severity: string; provableBy: string[]; state: 'open' | 'proven' | 'buried' }>;

  age: AgeState;
  arcs: Map<string, ArcInstance>;
  scheduled: { event: string; year: Year }[];

  /** Frequency rationing for EVENTS: caps, cooldowns, drought, fire counts. */
  frequency: FrequencyLedger;
  /**
   * A SEPARATE ledger for people. Sharing one with events meant a rare event
   * firing barred rare character templates for fifty-five years, and minted
   * people were never recorded at all — so the mythic cap of three produced
   * five and a half per run.
   */
  characterFrequency: FrequencyLedger;

  chronicle: ChronicleEntry[];
  log: string[];

  /**
   * The Narrator. Daveed Gearithy while he lives, and Daveed Gearithy after,
   * because death does not remove him — it only changes what he is. The voice
   * of the chronicle shifts on the year he crosses over.
   */
  narrator?: string;
  guardianSince?: Year;

  /**
   * Newborns of the house awaiting a name from the player. They already carry
   * a generated one, so nothing downstream can hold a nameless person — this
   * is an offer, not a blocker.
   */
  pendingNames: { person: string; born: Year; suggested: string; sex: string; chosen?: string }[];

  /**
   * The docket: events waiting on the player. Unlike the naming queue this one
   * IS a blocker — `stepYear` will not advance a year while a decision stands,
   * because a choice resolved after its year has passed is not a choice.
   *
   * Empty in `autoResolve` mode, which is what the harness and the tests run.
   */
  pendingDecisions: PendingDecision[];

  /**
   * Id sequences live on the WORLD, never at module scope. Module-level
   * counters are shared across every simulation in the process, so two runs of
   * the same seed diverge as soon as a third run exists between them — and the
   * headless harness runs thousands. Determinism has to survive that or it is
   * not determinism.
   */
  counters: { person: number; mint: number; arc: number; branch: number; decision: number };
}

export function createWorld(bundle: ContentBundle, seed: number, startYear: Year): WorldState {
  const playerHouse = bundle.houses.find((h) => h.isPlayerHouse)?.id ?? bundle.houses[0]!.id;
  return {
    seed,
    year: startYear,
    generation: 0,
    playerHouse,
    people: new PersonStore(),
    houses: new Map(bundle.houses.map((h) => [h.id, h])),
    branches: new Map(),
    treasury: 240,
    respect: 'known',
    discontent: 0,
    flags: new Map(),
    knowledge: new Set(),
    clausesRecovered: new Set(),
    rumours: new Map(),
    discrepancies: new Map(),
    age: emptyAgeState(),
    arcs: new Map(),
    scheduled: [],
    frequency: emptyFrequencyLedger(),
    characterFrequency: emptyFrequencyLedger(),
    chronicle: [],
    log: [],
    pendingNames: [],
    pendingDecisions: [],
    counters: { person: 0, mint: 0, arc: 0, branch: 0, decision: 0 },
  };
}

export interface SimCtx {
  world: WorldState;
  bundle: ContentBundle;
  genetics: GeneticsCtx;
  takenNames: Set<string>;
}

export function head(w: WorldState): ReturnType<PersonStore['living']>[number] | undefined {
  return w.people
    .living()
    .filter((p) => p.castSlots.includes('head'))
    .sort((a, b) => a.born - b.born)[0];
}

/**
 * Regency: a woman of the blood holds the house because no living son
 * expresses. She can defend, enrich, negotiate and arrange marriages with
 * precision. She cannot advance ascension by a point — nor accrue one of
 * Madness.
 *
 * There was a second implementation of this here that read raw allele effects
 * off haplotype zero, ignored dominance, and treated any unmaterialized genome
 * as non-expressing. Nothing called it, which is the only reason it never
 * produced a wrong answer. Expression is computed in exactly one place.
 */
export function inRegency(w: WorldState): boolean {
  return head(w)?.sex === 'female';
}
