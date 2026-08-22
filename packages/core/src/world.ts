import type {
  AgeState, ArcInstance, AuctionState, BranchState, Content, FrameEntry, FrequencyLedger, HeirloomState, HouseDef,
  LibraryBookState, LoggedDecision, MarriagePromise, PersonId, Relationship, ResolvedClaim, RespectTier,
  TaleCirculationState, Year,
} from '@ed/schema';
import { emptyAuctionState } from '@ed/schema';
import { emptyAgeState, emptyFrequencyLedger } from '@ed/schema';
import { PersonStore } from './people/store.js';
import type { GeneticsCtx } from './people/factory.js';
import type { PendingDecision } from './events/decisions.js';

export interface ChronicleEntry {
  /**
   * Stable identity for the entry an outcome created (issue #8). Only set by
   * `applyOutcome` — the record layer is the reason it exists: `applyRecord`
   * used to find "the" entry for an event by `(eventId, year)`, which rewrote
   * the wrong line the moment one template fired twice in the same year.
   */
  id?: string;
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
  /** Set when `record: 'embellish'` created a Discrepancy — links the two for `ChronicleQuery` (issue #10). */
  discrepancyId?: string;
  /**
   * What this entry actually CLAIMS, resolved against the cast it fired with
   * (issue #19). `RecordView` (`core/src/record.ts`) folds these across the
   * whole chronicle into what the family's record currently says about a
   * person — the one source of truth for sigil drift.
   */
  claims?: ResolvedClaim[];
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
  /**
   * The year standing last moved, in either direction. Respect decays without
   * maintenance (§17) and this is the clock it decays against — a house that
   * has done nothing worth telling anyone about for thirty years loses a tier.
   */
  respectChanged?: Year;
  discontent: number;

  /**
   * Hostility is an edge, not a type (concept §7). Keyed `from->to` by person
   * id. Grudges live on the edge and outlive both parties — see
   * `people/relationships.ts`.
   */
  relationships: Map<string, Relationship>;

  flags: Map<string, boolean | number | string>;
  knowledge: Set<string>;
  clausesRecovered: Set<string>;
  rumours: Map<string, { accuracy: number; spread: number; seededYear: Year }>;
  discrepancies: Map<string, { severity: string; provableBy: string[]; state: 'open' | 'proven' | 'buried' }>;

  age: AgeState;
  arcs: Map<string, ArcInstance>;
  /** Heirlooms the house holds, by id, with their charges and cooldowns. */
  heirlooms: Map<string, HeirloomState>;
  /** The Library's shelf: physical spellbook copies the house holds, by id (issue #15). */
  library: Map<string, LibraryBookState>;
  /** Lots announced, sold, and lost — how a Discrepancy gets proven by purchase (issue #17). */
  auction: AuctionState;
  /** Marriage promises pledged as an auction bid currency (issue #17). */
  marriagePromises: MarriagePromise[];
  /**
   * Nested-tale circulation, by tale id (issue #14). A tale is born the year
   * the event it is `about` actually fires — `applyOutcome` does the writing,
   * because that is the one place an outcome commits. The `generation` phase
   * ticks whether it has started circulating and how many times it has
   * mutated since.
   */
  tales: Map<string, TaleCirculationState>;
  /** `first` is the year it was originally due, so retries cannot loop forever. */
  scheduled: { event: string; year: Year; first?: Year }[];
  /**
   * Books being read right now. A `spellbook` effect with `op: 'study'` puts
   * one here and the `library` phase takes it off when the year comes.
   *
   * This is the one piece of state that makes `studyYears` mean anything.
   * `world.scheduled` could not carry it: that schedules an EVENT, recast from
   * scratch when it comes due, and a study belongs to a particular person for
   * a length of time only that person's career knows.
   */
  studies: { person: PersonId; book: string; completes: Year }[];

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
   * The year the sitting Head took the seal. Demigod Stagnation (§22) is about
   * TENURE — "each generation he remains Head" — and was measured off the
   * head's age instead, so a cousin who inherited at sixty and died at seventy
   * counted as a stagnant reign of ten years. It fired constantly once the
   * strength dimorphism let men live longer, and pinned the branches at
   * maximum grievance in every run.
   */
  headSince?: Year;

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
   * INVARIANT 8. Id sequences live on the WORLD, never at module scope. Module-level
   * counters are shared across every simulation in the process, so two runs of
   * the same seed diverge as soon as a third run exists between them — and the
   * headless harness runs thousands. Determinism has to survive that or it is
   * not determinism.
   */
  counters: { person: number; mint: number; arc: number; branch: number; decision: number; grudge: number; chronicle: number; lot: number };

  /**
   * The decision log (issue #8): every outcome, Record answer and rename that
   * had a genuinely external answer, in the order it happened. Append-only —
   * nothing in `core` ever removes an entry. See `schema/decision-log.ts`.
   */
  decisionLog: LoggedDecision[];

  /**
   * The frame layer (concept §2, Layer 1; issue #13). Its own array, kept off
   * `chronicle` on purpose — the chronicle is the family's own record,
   * written between 1042 and 2042; the frame is 2042 itself, reacting to that
   * record from outside it. It also rations on its own cadence, off a ledger
   * of its own, so a frame firing never steals an ambient event's budget
   * (invariant 7's shape: "ration separately").
   */
  frame: {
    /** The last year ANY frame event fired, for the minimum-gap cadence check. */
    lastFired: Year | null;
    /**
     * eventId -> the year it last fired. Drives `repeatable` and
     * `cooldownYears` — declared on every `EventTemplate` since the schema's
     * first draft and read by nothing in `core` until now (invariant 11: a
     * declared field nothing reads is a bug). Most interludes are a single
     * beat (`repeatable: false`); a few return, on their own cooldown, for as
     * long as the Discrepancy they react to stays open.
     */
    firedAt: Record<string, number>;
    entries: FrameEntry[];
  };
}

export function createWorld(content: Content, seed: number, startYear: Year): WorldState {
  const playerHouse = content.houses.find((h) => h.isPlayerHouse)?.id ?? content.houses[0]?.id;
  if (!playerHouse) throw new Error('content declares no houses; there is nobody to play');
  return {
    seed,
    year: startYear,
    generation: 0,
    playerHouse,
    people: new PersonStore(),
    houses: new Map(content.houses.map((h) => [h.id, h])),
    branches: new Map(),
    relationships: new Map(),
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
    heirlooms: new Map(),
    library: new Map(),
    auction: emptyAuctionState(startYear),
    marriagePromises: [],
    tales: new Map(),
    scheduled: [],
    studies: [],
    frequency: emptyFrequencyLedger(),
    characterFrequency: emptyFrequencyLedger(),
    chronicle: [],
    log: [],
    pendingNames: [],
    pendingDecisions: [],
    counters: { person: 0, mint: 0, arc: 0, branch: 0, decision: 0, grudge: 0, chronicle: 0, lot: 0 },
    decisionLog: [],
    frame: { lastFired: null, firedAt: {}, entries: [] },
  };
}

/**
 * Everything a simulation function is allowed to reach for, and nothing else.
 *
 *   world     the mutable state of this run. The only thing that changes.
 *   content   the authored game, indexed. Read-only for the whole run.
 *   genetics  the locus table and population means, derived from content once.
 *   names     names already spoken for, so no two living people share one.
 *
 * A function taking `SimCtx` can be called from a test, the harness, the editor
 * and the game client without any of them knowing about the others.
 */
export interface SimCtx {
  world: WorldState;
  content: Content;
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
