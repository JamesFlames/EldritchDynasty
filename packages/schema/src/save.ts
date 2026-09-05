import { z } from 'zod';
import { FrequencyS } from './frequency.js';
import { RungS, RiteS } from './rung.js';
import { EndingIdS } from './ending.js';
import { RespectTierS, RegisterS } from './conditions.js';
import { SexS } from './attributes.js';
import { BranchIdS, HouseIdS, PersonIdS } from './ids.js';
import { EventTemplateS } from './event.js';
import {
  LineageDocumentS, MembershipRecordS, PersonStatusS, RetainerContractS, StorageTierS,
  AwakeningStateS,
} from './person.js';
import type { LooseSecret } from './person.js';
import { LoggedDecisionS } from './decision-log.js';
import { SlotFillS } from './slot-fill.js';
import type { AgeState } from './age.js';
import type { ArcInstance } from './arc.js';
import type { BranchState } from './branch.js';
import type { HeirloomState } from './heirloom.js';
import type { LibraryBookState } from './spellbook.js';
import type { AuctionState, MarriagePromise } from './auction.js';
import { BidCurrencyS, AuctionLotKindS } from './auction.js';
import { ResolvedClaimS } from './claim.js';
import type { Relationship } from './house.js';
import type { FrequencyLedger } from './frequency.js';
import type { TaleCirculationState } from './tale.js';

/**
 * THE SAVE FORMAT.
 *
 * There was none. A playthrough is eight to twelve hours and the world was a
 * graph of `Map`s, `Set`s, a class instance and three typed arrays per person —
 * none of which survive `JSON.stringify`, and all of which had to be made
 * plain before persistence was even possible to attempt.
 *
 * Two things fall out of having it that are worth as much as saving:
 *
 *   THE STATE IS DESCRIBABLE.  Every field of a run is now named in one place
 *   and checked by Zod. "A declared field that nothing reads is a bug" cuts
 *   both ways — a field nothing SAVES is a field that silently resets.
 *
 *   RUNS ARE COMPARABLE.  A snapshot is a value, so two worlds can be compared,
 *   hashed and diffed. `determinism.test.ts` hashes one instead of asserting on
 *   a dozen hand-picked numbers and hoping they covered it.
 *
 * DERIVED STATE IS NOT SAVED, on the same principle as invariant 6: the
 * phenotype cache, the house table and the content bundle are all recomputed on
 * load. A save that carried them would be a save that could disagree with the
 * content it was loaded against, and it would do so quietly.
 */
/**
 * Bumped to 7 for the Assize (`core/src/assize.ts`): `world.assize`, what the
 * world has noticed about the house and what it has already done about it.
 * Without it a load would forget every cooldown — so a reloaded run could be
 * assessed twice in one decade — and would drop any mercy or exaction still in
 * force, which is a physician who leaves the house the moment you save.
 *
 * Bumped to 6 for secrets that walk: `world.looseSecrets`, what a released
 * retainer took out of the house with them. A save without it would load a
 * run whose leaked secrets had simply never leaked — and then quietly never
 * become the Discrepancies they were on their way to becoming, which is the
 * exact failure this file exists to close.
 *
 * Bumped to 10 for the papers (concept §7, world §13): `LineageDocument.exposed`,
 * and `papersAsked`/`papersShown` on a stored match card. Both are defaulted, so
 * a format-9 save would have loaded — as a house whose forgeries had never been
 * questioned holding a hand that asked no pedigree of anybody, which is a
 * different game quietly wearing this one's save.
 *
 * Bumped to 5 for the branching pass: `ArcInstance.history[].choice` — which
 * BRANCH a node took, not only which outcome came of it. The two stop being
 * the same fact the moment something other than the player takes the branch
 * (see `schema/src/decider.ts`), and a successor gating on `fromChoice` reads
 * it. `localFlags` needed no shape change; it was already stored and had
 * simply never been written.
 *
 * Bumped to 4 for phases 6 and 7: `world.library` (issue #15, the Library's
 * shelf), `world.auction` (issue #17), and the record layer's forged-lineage
 * fields on `LineageDocument` and `RecordBlock` claims (issue #19). Bumped to
 * 3 for nested tales (issue #14): `world.tales`, the circulation state keyed
 * by tale id. Bumped to 2 for the decision log (issue #8): `decisionLog`, the
 * `chronicle` id counter, and a stable `id` on `ChronicleEntry`. Omitting any
 * of them would not fail a load — they would silently reset, which is exactly
 * the trap this file exists to close.
 */
export const SAVE_FORMAT = 11;

// ── Person, in its stored form ────────────────────────────────────────────

/**
 * Genomes are stored as plain number arrays, not base64 or a binary blob.
 * A thousand-year run is a few megabytes of JSON, which is nothing next to
 * being able to open a save in a text editor and see which allele went wrong.
 */
const StoredGenomeS = z.object({
  autosomal: z.tuple([z.array(z.number()), z.array(z.number())]),
  sex: z.tuple([z.array(z.number()), z.array(z.number()).nullable()]),
  mutations: z.array(z.object({
    locus: z.string(), from: z.string(), to: z.string(), year: z.number(),
  })).default([]),
});
export type StoredGenome = z.infer<typeof StoredGenomeS>;

const StoredGenomeRefS = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('materialized'), genome: StoredGenomeS }),
  z.object({
    kind: z.literal('lazy'),
    pool: z.string(),
    seed: z.number(),
    bias: z.record(z.string(), z.number()).optional(),
  }),
]);

export const StoredPersonS = z.object({
  id: z.string(),
  name: z.string(),
  epithet: z.string().optional(),
  sex: SexS,
  sigilSeed: z.number(),
  houseOfOrigin: z.string(),
  born: z.number(),
  died: z.number().optional(),
  status: PersonStatusS,
  causeOfDeath: z.string().optional(),
  trueParents: z.object({ mother: z.string().optional(), father: z.string().optional() }),
  claimedParents: z.object({ mother: z.string().optional(), father: z.string().optional() }),
  lineageDocuments: z.array(LineageDocumentS).default([]),
  genome: StoredGenomeRefS,
  /** A Set at runtime; an array here, because JSON has no sets. */
  traits: z.array(z.string()).default([]),
  awakening: AwakeningStateS,
  spellsKnown: z.array(z.string()).default([]),
  career: z.object({ career: z.string(), from: z.number() }).optional(),
  membership: z.array(MembershipRecordS),
  contract: RetainerContractS.optional(),
  marriages: z.array(z.object({ spouse: z.string(), from: z.number(), to: z.number().optional() })).default([]),
  madness: z.number(),
  /** Issue #43. Defaulted so a save written before the rites existed still loads. */
  rites: z.array(RiteS).default([]),
  acquired: z.record(z.string(), z.number()).default({}),
  castSlots: z.array(z.string()).default([]),
  tier: StorageTierS,
  becomesGuardian: z.boolean().optional(),
  mintedFrom: z.string().optional(),
});
export type StoredPerson = z.infer<typeof StoredPersonS>;

// ── World state ───────────────────────────────────────────────────────────

export const GrudgeS = z.object({
  id: z.string(),
  originEvent: z.string(),
  originYear: z.number(),
  severity: z.number(),
  inheritance: z.enum(['none', 'heir_only', 'all_blood', 'house_wide']),
  decayPerYear: z.number(),
});

export const RelationshipS = z.object({
  from: z.string(),
  to: z.string(),
  sentiment: z.number(),
  kinds: z.array(z.enum(['rival', 'debt', 'obligation', 'affection', 'fear', 'patronage'])),
  grudges: z.array(GrudgeS),
});

/** Branded ids here, unlike everywhere else in this file, because `BranchState` brands them. */
export const BranchStateS = z.object({
  id: BranchIdS,
  name: z.string(),
  house: HouseIdS,
  founder: PersonIdS,
  splitFrom: z.string(),
  foundedYear: z.number(),
  speaker: PersonIdS.optional(),
  grievance: z.number(),
  extinct: z.number().optional(),
  recalled: z.number().optional(),
  heldSeal: z.number().optional(),
});

export const ArcInstanceS = z.object({
  id: z.string(),
  arc: z.string(),
  node: z.string(),
  bindings: z.record(z.string(), z.string()),
  localFlags: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  startedYear: z.number(),
  dueYear: z.number().optional(),
  history: z.array(z.object({ node: z.string(), outcome: z.string(), choice: z.string().optional(), year: z.number() })),
  status: z.enum(['active', 'ended', 'cancelled', 'expired']),
});

export const HeirloomStateS = z.object({
  id: z.string(),
  acquiredYear: z.number(),
  usesLeft: z.number().optional(),
  lastUsedYear: z.number().optional(),
  spent: z.boolean(),
  usedOn: z.array(z.object({ person: z.string(), year: z.number() })),
});

/** The Library's shelf (issue #15). See `schema/src/spellbook.ts`. */
export const LibraryBookStateS = z.object({
  id: z.string(),
  acquiredYear: z.number(),
  condition: z.number(),
  namedFor: z.object({ person: z.string(), name: z.string(), year: z.number() }).optional(),
});

/** The auction (issue #17). See `schema/src/auction.ts`. */
export const AuctionBidS = z.object({
  house: z.string(),
  currency: BidCurrencyS,
  amount: z.number(),
  heirloomOffered: z.string().optional(),
});

export const AuctionLotS = z.object({
  id: z.string(),
  kind: AuctionLotKindS,
  refId: z.string(),
  house: z.string(),
  announcedYear: z.number(),
  saleYear: z.number(),
  reserveCoin: z.number(),
  playerBid: AuctionBidS.optional(),
});

export const AuctionHistoryEntryS = z.object({
  lot: AuctionLotS,
  year: z.number(),
  winner: z.enum(['player', 'rival', 'nobody']),
  winningHouse: z.string().optional(),
});

export const AuctionStateS = z.object({
  upcoming: z.array(AuctionLotS),
  history: z.array(AuctionHistoryEntryS),
  nextAnnounceYear: z.number(),
  favours: z.number(),
});

export const MarriagePromiseS = z.object({
  toHouse: z.string(),
  year: z.number(),
  lot: z.string(),
});

/** A secret that walked out with a released retainer. See `schema/src/person.ts`. */
export const LooseSecretS = z.object({
  secret: z.string(),
  carrier: z.string(),
  carrierName: z.string(),
  house: z.string(),
  since: z.number(),
  severity: z.enum(['minor', 'major']),
  told: z.number().optional(),
});

export const TaleCirculationStateS = z.object({
  bornYear: z.number(),
  circulatesFrom: z.number(),
  circulating: z.boolean(),
  mutations: z.number(),
  lastMutated: z.number().optional(),
});

export const AgeStateS = z.object({
  active: z.array(z.object({
    age: z.string(),
    began: z.number(),
    named: z.boolean(),
    namedAt: z.number().optional(),
    paid: z.object({
      clause: z.string().optional(),
      standing: z.boolean(),
      rumour: z.string().optional(),
    }),
  })),
  ended: z.array(z.object({
    age: z.string(),
    began: z.number(),
    ended: z.number(),
    /**
     * ISSUE #81. Defaulted rather than required, and the default is the safe
     * reading: an ended Age in a save written before this field existed
     * withholds a name rather than inventing one. §20's rule is that the
     * family finds out what these years were afterwards — a migration that
     * guessed "named" would put words in a dead chronicler's mouth.
     */
    named: z.boolean().default(false),
    namedAt: z.number().optional(),
  })),
  lastEndedRegister: RegisterS.optional(),
});

const FrequencyCountsS = z.object({
  common: z.number(), uncommon: z.number(), rare: z.number(), mythic: z.number(),
});

export const FrequencyLedgerS = z.object({
  firedThisRun: FrequencyCountsS,
  lastFiredYear: z.object({
    common: z.number().nullable(), uncommon: z.number().nullable(),
    rare: z.number().nullable(), mythic: z.number().nullable(),
  }),
  templateFires: z.record(z.string(), z.number()),
  /** Defaulted so a save written before the template ration existed still loads. */
  templateLastFired: z.record(z.string(), z.number()).default({}),
});

/**
 * An interlude the frame phase fired (issue #13). Kept separate from
 * `chronicle` on purpose: the chronicle is the family's own record, written
 * in the tale's voice between 1042 and 2042; the frame is the year 2042
 * itself, reacting to that record from outside it. Mixing the two arrays
 * would blur the layer boundary the concept brief holds absolute (§2).
 */
export const FrameEntryS = z.object({
  /** The simulated year the interlude was shown at — pacing, not diegetic time. */
  year: z.number(),
  eventId: z.string(),
  outcomeId: z.string(),
  text: z.string(),
});
export type FrameEntry = z.infer<typeof FrameEntryS>;

export const ChronicleEntryS = z.object({
  /** Set only on entries `applyOutcome` created — see `applyRecord` (issue #8). */
  id: z.string().optional(),
  year: z.number(),
  weight: z.enum(['line', 'paragraph', 'page', 'illuminated']),
  title: z.string().optional(),
  /** null prints as a dated blank line. The blank is a designed artefact. */
  text: z.string().nullable(),
  eventId: z.string().optional(),
  named: z.boolean(),
  record: z.enum(['record', 'omit', 'embellish']).optional(),
  greyed: z.boolean().optional(),
  /**
   * The rung this page attests (issue #39). In 2042 the creditor reads the
   * CHRONICLE and not the world, so what the house became and what its book
   * can show are asked separately, and this is the half the book can show.
   */
  rung: RungS.optional(),
  /** Set when Embellish created a Discrepancy — links the two for ChronicleQuery (issue #10). */
  discrepancyId: z.string().optional(),
  /** What this entry claims, resolved against its cast (issue #19). */
  claims: z.array(ResolvedClaimS).optional(),
});

/**
 * The docket, saved whole.
 *
 * A pending decision carries the EVENT it is about, and it is stored rather
 * than referenced by id, because a decision is a promise already made to the
 * player. If the content is edited between save and load — which it will be,
 * constantly, since the editor writes the same YAML the game reads — the
 * question they were asked must still be the question they answer.
 */
const DecisionChoiceS = z.object({
  id: z.string(),
  label: z.string(),
  available: z.boolean(),
  blockedBy: z.string().optional(),
});

const CastRequestS = z.object({
  slot: z.string(),
  optional: z.boolean(),
  count: z.object({ min: z.number(), max: z.number() }).optional(),
  candidates: z.array(z.object({ id: z.string(), name: z.string(), age: z.number() })),
});

export const PendingDecisionS = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('choice'),
    id: z.string(),
    year: z.number(),
    event: EventTemplateS,
    body: z.string(),
    fill: SlotFillS,
    choices: z.array(DecisionChoiceS),
    cast: z.array(CastRequestS),
    arcStep: z.object({
      instance: ArcInstanceS,
      node: z.unknown(),
      fill: SlotFillS,
      absent: z.boolean(),
    }).optional(),
  }),
  z.object({
    kind: z.literal('match'),
    id: z.string(),
    year: z.number(),
    subject: z.object({
      id: z.string(),
      name: z.string(),
      sex: SexS,
      age: z.number(),
    }),
    /**
     * Stored whole, for the same reason a pending choice stores its event
     * whole: a card is a promise already made. Two of these three people do
     * not exist and one of them may never — the recipe IS the promise, and
     * re-dealing the hand on load would answer a question with different
     * cards from the ones the player was looking at.
     */
    cards: z.array(z.object({
      id: z.string(),
      kind: z.enum(['household', 'outsider']),
      name: z.string(),
      sex: SexS,
      age: z.number(),
      house: z.string(),
      houseName: z.string(),
      blurb: z.string(),
      dowry: z.number(),
      kinship: z.number(),
      /**
       * Defaulted rather than required, so a save written before the line read
       * existed still loads — as a hand of cards nobody had a word for, which
       * is exactly what those cards were.
       */
      line: z.enum(['fertile', 'ordinary', 'thin', 'unknown']).default('unknown'),
      lineSeen: z.number().default(0),
      words: z.string().default(''),
      /**
       * The papers (concept §7). Defaulted for the same reason `line` is: a
       * save written before the dowry was documentation still loads, as a hand
       * nobody asked a pedigree of — which is what those hands were.
       */
      papersAsked: z.number().default(0),
      papersShown: z.number().default(0),
      /**
       * THE MATCHMAKER'S PANEL (issue #68). Defaulted whole, for the third
       * time and the same reason `line` and the papers are: a save written
       * before the panel existed loads as a hand nobody was shown any
       * evidence for, which is exactly what those hands were.
       */
      panel: z.object({
        issue: z.array(z.object({
          name: z.string(),
          relation: z.string(),
          borne: z.number(),
          grown: z.number(),
        })).default([]),
        woken: z.array(z.object({
          name: z.string(),
          relation: z.string(),
          year: z.number(),
          sex: SexS,
          expressed: z.boolean(),
        })).default([]),
        said: z.array(z.object({
          tale: z.string(),
          teller: z.string(),
          bias: z.string(),
          text: z.string(),
        })).default([]),
        ourBook: z.array(z.object({
          year: z.number(),
          text: z.string(),
          record: z.enum(['record', 'omit', 'embellish']).optional(),
          embellished: z.boolean(),
        })).default([]),
      }).default({ issue: [], woken: [], said: [], ourBook: [] }),
      person: z.string().optional(),
      recipe: z.object({
        template: z.string(),
        house: z.string(),
        sex: SexS,
        age: z.number(),
        name: z.string(),
        seed: z.number(),
      }).optional(),
      available: z.boolean(),
      blockedBy: z.string().optional(),
    })),
  }),
  z.object({
    kind: z.literal('record'),
    id: z.string(),
    year: z.number(),
    event: EventTemplateS,
    subject: z.string(),
    options: z.array(z.object({
      option: z.enum(['record', 'omit', 'embellish']),
      chronicle: z.string().nullable(),
      discrepancy: z.string().optional(),
    })),
    /** The chronicle entry this event's outcome created (issue #8). */
    entryId: z.string(),
    /** The cast the firing actually resolved against — claims (issue #19) target these people. */
    fill: SlotFillS,
  }),
]);

export const SavedGameS = z.object({
  /** Bumped whenever the shape changes. A loader that cannot read it says so. */
  format: z.literal(SAVE_FORMAT),
  savedAt: z.string().optional(),

  seed: z.number(),
  year: z.number(),
  generation: z.number(),
  playerHouse: z.string(),

  people: z.array(StoredPersonS),
  /** Names already spoken for. Lives on SimCtx, not the world, and is still state. */
  takenNames: z.array(z.string()),

  branches: z.array(BranchStateS),
  relationships: z.array(z.tuple([z.string(), RelationshipS])),

  treasury: z.number(),
  respect: RespectTierS,
  respectChanged: z.number().optional(),
  discontent: z.number(),
  /**
   * The most of its own blood the house has ever had living at once
   * (issue #42). Defaulted, so a format-8 save loads and simply starts
   * counting from what it has now.
   */
  bloodHighWater: z.number().default(0),

  flags: z.array(z.tuple([z.string(), z.union([z.boolean(), z.number(), z.string()])])),
  knowledge: z.array(z.string()),
  clausesRecovered: z.array(z.string()),
  rumours: z.array(z.tuple([z.string(), z.object({
    accuracy: z.number(), spread: z.number(), seededYear: z.number(),
  })])),
  discrepancies: z.array(z.tuple([z.string(), z.object({
    severity: z.string(),
    provableBy: z.array(z.string()),
    state: z.enum(['open', 'proven', 'buried']),
  })])),
  /**
   * Secrets carried out of the house by released retainers, told and untold.
   * Defaulted rather than required so a format-6 save written by a client
   * that never had a retainer walk still loads.
   */
  looseSecrets: z.array(LooseSecretS).default([]),
  /** Person id -> the year the house last took them to market (`match.ts`). */
  courted: z.record(z.string(), z.number()).default({}),
  /** THE TABLE (`core/src/table.ts`) — the player's standing orders. */
  tutoring: z.array(z.object({
    person: z.string(), attr: z.string(), completes: z.number(),
  })).default([]),
  bidCeiling: z.number().default(0),
  withheld: z.record(z.string(), z.number()).default({}),
  /**
   * BEARING (`core/src/bearing.ts`, concept §29). `acts` is the only part
   * that is state; the score beside it is the last reading, saved so a load
   * does not read zero for a year before the phase runs again.
   *
   * Defaulted so a format-7 save still loads — a house that carried itself
   * proudly before this existed simply is not remembered for it, which is the
   * honest answer rather than a guess at what it did.
   */
  bearing: z.object({
    score: z.number().default(0),
    acts: z.array(z.object({
      year: z.number(),
      kind: z.enum(['wrote_it_larger', 'refused_a_hand', 'kept_her_back', 'took_the_cousin']),
    })).default([]),
    /** Stage 3's trace: the years somebody had something to say and did not. */
    unheard: z.array(z.object({ year: z.number(), event: z.string() })).default([]),
  }).default({ score: 0, acts: [], unheard: [] }),
  /** The standing order on marriage (issue #41). Defaulted for saves older than it. */
  marriagePolicy: z.enum(['in', 'out', 'as_it_falls']).default('as_it_falls'),
  /** THE ASCENSION LADDER (`core/src/ascension.ts`, concept §22). */
  ascension: z.object({
    rung: RungS,
    best: RungS,
    reachedAt: z.record(RungS, z.number()).default({}),
  }),
  /**
   * THE FIVE NAMES (`core/src/people/friends.ts`). Who the player said at the
   * signing they could not have done without, and which of them have since
   * turned up wearing their own names.
   *
   * Defaulted rather than required so a save written before the signing asked
   * the question still loads — it simply has an empty bag, which is also every
   * headless run.
   */
  friends: z.array(z.object({
    name: z.string(),
    sex: SexS,
    /**
     * The year the name becomes claimable. Defaulted to the first year of the
     * game rather than required: a save written before the five were spread
     * over five centuries has names that were all due at once, which is what
     * that run actually played.
     */
    dueFrom: z.number().default(1042),
    spentIn: z.number().optional(),
  })).default([]),
  /**
   * THE SIGNING (concept §3, issue #38). Optional because a world nobody
   * founded is a legal world — the harness bootstraps two hundred of them a
   * minute and answers no prologue. What is here is what the player chose,
   * kept so that the epilogue can name which element the thousand years
   * changed nine hundred years later.
   */
  founding: z.object({
    houseName: z.string(),
    heirloom: z.string(),
    grudge: z.string(),
    year: z.number(),
  }).optional(),
  /** WHERE IT LANDED (concept §23, issue #39). Set once, in 2042, and never again. */
  ending: z.object({ id: EndingIdS, year: z.number() }).optional(),
  /** THE ASSIZE (`core/src/assize.ts`) — what the world has done about the house. */
  assize: z.object({
    pressure: z.number().default(0),
    openedAt: z.number(),
    lastSitting: z.number(),
    fired: z.record(z.string(), z.number()).default({}),
    favour: z.number().optional(),
    mercy: z.number().optional(),
    exaction: z.number().optional(),
  }),

  age: AgeStateS,
  arcs: z.array(z.tuple([z.string(), ArcInstanceS])),
  heirlooms: z.array(z.tuple([z.string(), HeirloomStateS])),
  /** The Library's shelf, by spellbook id (issue #15). */
  library: z.array(z.tuple([z.string(), LibraryBookStateS])),
  /** The auction (issue #17). */
  auction: AuctionStateS,
  marriagePromises: z.array(MarriagePromiseS),
  /** Nested-tale circulation state, keyed by tale id (issue #14). */
  tales: z.array(z.tuple([z.string(), TaleCirculationStateS])),
  scheduled: z.array(z.object({ event: z.string(), year: z.number(), first: z.number().optional() })),
  /**
   * Books being read. Defaulted rather than required so a save written before
   * `spellbook.op: study` existed still loads — it simply had nobody reading.
   */
  studies: z.array(z.object({ person: z.string(), book: z.string(), completes: z.number() })).default([]),

  frequency: FrequencyLedgerS,
  characterFrequency: FrequencyLedgerS,

  chronicle: z.array(ChronicleEntryS),
  log: z.array(z.string()),
  /** Append-only, and separate from the chronicle: what the family SAYS happened vs what was DECIDED (issue #8). */
  decisionLog: z.array(LoggedDecisionS),

  /** The frame layer (issue #13) — its own cadence, its own array, kept off the chronicle on purpose. */
  frame: z.object({
    lastFired: z.number().nullable(),
    /** eventId -> the year it last fired. Drives `repeatable` and `cooldownYears`, frame's own. */
    firedAt: z.record(z.string(), z.number()),
    entries: z.array(FrameEntryS),
  }),

  narrator: z.string().optional(),
  guardianSince: z.number().optional(),
  headSince: z.number().optional(),
  /**
   * WHO HAS HELD THE SEAL (issue #56). Defaulted rather than required, so a
   * save written before the line was kept loads as a house whose earlier heads
   * are simply not recorded — which is true of it, and better than refusing to
   * open it.
   */
  succession: z.array(z.object({
    person: z.string(),
    name: z.string(),
    from: z.number(),
    to: z.number().optional(),
  })).default([]),

  pendingNames: z.array(z.object({
    person: z.string(), born: z.number(), suggested: z.string(),
    sex: z.string(), chosen: z.string().optional(),
    /**
     * ISSUE #62. Defaulted, so a save written before the cut loads with its
     * queue intact and unexplained rather than throwing. Those prompts were
     * raised for every child of the seat, and the honest thing to say about
     * one is that the house has a new child — not to invent a reason it was
     * never chosen for.
     */
    because: z.string().default('a child of the house'),
  })),
  pendingDecisions: z.array(PendingDecisionS),

  counters: z.object({
    person: z.number(), mint: z.number(), arc: z.number(),
    branch: z.number(), decision: z.number(), grudge: z.number(), chronicle: z.number(), lot: z.number(),
  }),
});
export type SavedGame = z.infer<typeof SavedGameS>;

/**
 * The save format and the runtime types, held together by the compiler.
 *
 * Each line below fails to compile if the runtime interface and the schema
 * that persists it drift apart — a field added to `BranchState` and not to
 * `BranchStateS` would otherwise save, load, and simply be absent, which is
 * indistinguishable from a feature that has not come up yet.
 */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

export type SaveShapesAgree = [
  Same<Relationship, z.infer<typeof RelationshipS>>,
  Same<BranchState, z.infer<typeof BranchStateS>>,
  Same<ArcInstance, z.infer<typeof ArcInstanceS>>,
  Same<HeirloomState, z.infer<typeof HeirloomStateS>>,
  Same<LibraryBookState, z.infer<typeof LibraryBookStateS>>,
  Same<AuctionState, z.infer<typeof AuctionStateS>>,
  Same<MarriagePromise, z.infer<typeof MarriagePromiseS>>,
  Same<AgeState, z.infer<typeof AgeStateS>>,
  Same<FrequencyLedger, z.infer<typeof FrequencyLedgerS>>,
  Same<TaleCirculationState, z.infer<typeof TaleCirculationStateS>>,
  Same<LooseSecret, z.infer<typeof LooseSecretS>>,
];
export const SAVE_SHAPES_AGREE: SaveShapesAgree = [
  true, true, true, true, true, true, true, true, true, true, true,
];

/** Frequency keys, so the ledger schema above cannot drift from the enum. */
export type FrequencyKeysAgree = Same<
  Record<z.infer<typeof FrequencyS>, number>,
  z.infer<typeof FrequencyCountsS>
>;
export const FREQUENCY_KEYS_AGREE: FrequencyKeysAgree = true;
