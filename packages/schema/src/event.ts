import { z } from 'zod';
import { ConditionS, CompareOpS, DiscrepancyStateS, FilterS } from './conditions.js';
import { FrequencyS } from './frequency.js';
import { ClaimS } from './claim.js';
import { TargetS } from './target.js';
import { ScheduleS } from './arc.js';
import { DeciderS } from './decider.js';

/**
 * The purposes vocabulary is a CLOSED set and every template declares exactly
 * three. A longer list would let an author justify anything, which defeats the
 * point of having the rule.
 */
export const PurposeS = z.enum([
  'advance_clause',
  'change_relationship',
  'worldbuild_through_action',
  'establish_magic_rule',
  'test_magic_rule',
  'change_standing',
  'plant_rumour',
  'force_record_choice',
  'buy_patience',
]);
export type Purpose = z.infer<typeof PurposeS>;

export const EventTierS = z.enum(['individual', 'head', 'family', 'record', 'frame']);
export type EventTier = z.infer<typeof EventTierS>;

export const SlotRoleS = z.enum([
  'head', 'family_member', 'spouse', 'child', 'sibling', 'cadet', 'unwoken',
  'retainer', 'rival_house', 'outsider', 'heirloom', 'spellbook',
  'tutor', 'rival', 'fragile', 'the_match',
  'listener_record', 'listener_blood',
  /** The Narrator, after he crosses over. Castable in any year, forever. */
  'guardian',
]);
export type SlotRole = z.infer<typeof SlotRoleS>;

/**
 * Bindings outlive people. In a game whose time unit is a generation, an arc
 * finding its cast dead is the NORMAL case. `inherit` is the policy that earns
 * its keep: a rival dies mid-feud and his son takes it up, and the grudge, the
 * arc and the binding all move down a generation together.
 */
export const MissingPolicyS = z.union([
  z.literal('cancel_arc'),
  z.literal('recast'),
  z.literal('continue_absent'),
  z.object({ inherit: z.enum(['heir', 'eldest_child', 'closest_blood', 'house_successor']) }),
]);
export type MissingPolicy = z.infer<typeof MissingPolicyS>;

export const SlotSpecS = z.object({
  role: SlotRoleS,
  /** The single most important field in the event model. */
  castBy: z.enum(['engine', 'player']).default('engine'),
  count: z.object({ min: z.number().int(), max: z.number().int() }).optional(),
  optional: z.boolean().default(false),
  filters: z.array(FilterS).default([]),
  /** 'arc' = the same person for the whole substory. */
  bind: z.enum(['event', 'arc']).default('event'),
  onMissing: MissingPolicyS.optional(),
});
export type SlotSpec = z.infer<typeof SlotSpecS>;

// ── Effects: enumerated, never free-form script ───────────────────────────
export const EffectS = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('attribute'), target: TargetS, attr: z.string(), delta: z.number() }),
  z.object({ kind: z.literal('trait'), target: TargetS, trait: z.string(), op: z.enum(['add', 'remove']) }),
  z.object({ kind: z.literal('status'), target: TargetS, status: z.string(), cause: z.string().optional() }),
  /** Guarded: applying this where canExpress is false is a validation error. */
  z.object({ kind: z.literal('madness'), target: TargetS, delta: z.number() }),
  z.object({
    kind: z.literal('heirloom'),
    op: z.enum(['grant', 'use', 'transfer']).default('grant'),
    heirloom: z.string(),
    /** `use`: the slot holding the bearer. `transfer`: who receives it. */
    to: z.string().optional(),
  }),
  /**
   * `gain` is instantaneous — the knowledge is simply theirs. `study` is the
   * same arrival with the years in front of it: the reader takes the book up
   * now and knows it in `studyYears` (scaled by their career's `studySpeed`,
   * which is the Scholar's whole perk), and `world.studies` carries the wait.
   *
   * Both exist because both are wanted. A rite that hands somebody a working
   * in a night is a `gain`; a man sitting down with a book is a `study`, and
   * the difference between them is most of what a Library is for.
   */
  z.object({ kind: z.literal('spellbook'), op: z.enum(['gain', 'study', 'lose', 'degrade']), target: TargetS, book: z.string() }),
  /**
   * Writes `Person.career`. `leave` clears the post without naming one (the
   * `career` field is ignored); `assign` requires it. Income, Respect accrual
   * and the breeding-pool/mortality costs all read `Person.career` from
   * outside this effect — see `core/src/people/careers.ts`.
   */
  z.object({ kind: z.literal('career'), target: TargetS, op: z.enum(['assign', 'leave']).default('assign'), career: z.string().optional() }),
  z.object({ kind: z.literal('treasury'), delta: z.number() }),
  z.object({ kind: z.literal('respect'), delta: z.number() }),
  z.object({ kind: z.literal('flag'), flag: z.string(), set: z.union([z.boolean(), z.number(), z.string()]) }),
  z.object({ kind: z.literal('relationship'), from: TargetS, to: TargetS, sentiment: z.number().optional(), grudge: z.object({ severity: z.number(), inheritance: z.enum(['none', 'heir_only', 'all_blood', 'house_wide']) }).optional() }),
  z.object({ kind: z.literal('chronicle'), text: z.string() }),
  z.object({ kind: z.literal('knowledge'), op: z.enum(['grant', 'revoke']), flag: z.string() }),
  z.object({ kind: z.literal('discrepancy'), op: z.enum(['create', 'prove', 'bury']), id: z.string(), severity: z.enum(['minor', 'major', 'total']).optional(), provableBy: z.array(z.string()).optional() }),
  z.object({ kind: z.literal('rumour'), op: z.enum(['seed', 'feed', 'correct']), id: z.string(), accuracy: z.number().optional() }),
  z.object({ kind: z.literal('clause'), reveal: z.string() }),
  /**
   * The cadet halls (concept §16). Without this the branches accrue grievance
   * on their own and no authored scene can ever answer it — a system the
   * player can watch and cannot touch. `slot` names the branch by one of its
   * people; with none, it means whichever hall is angriest.
   */
  z.object({ kind: z.literal('branch'), op: z.enum(['appease', 'slight']), slot: z.string().optional(), amount: z.number().default(10) }),
  z.object({ kind: z.literal('recast'), slot: z.string() }),
  z.object({ kind: z.literal('schedule'), event: z.string(), inYears: z.number() }),
  z.object({ kind: z.literal('arc'), op: z.enum(['start', 'advance', 'cancel']), arc: z.string() }),
  /**
   * What this run of the substory remembers about itself. Writes
   * `ArcInstance.localFlags`, which the `arcFlag` condition reads back — the
   * pair is what lets a successor branch on a decision three nodes upstream
   * without promoting it to a world flag every other event in the game can see.
   *
   * Only meaningful on an event firing as a node of an arc; `arcs/flags` fails
   * the build on one written anywhere else, because a write nothing can ever
   * read is not a write.
   */
  z.object({ kind: z.literal('arc_flag'), flag: z.string(), set: z.union([z.boolean(), z.number(), z.string()]) }),
  /**
   * The forging path (issue #19, concept §7 — "a bought grandmother"). Points
   * `target`'s CLAIMED parent at whoever `claimedAs` names, leaving
   * `trueParents` untouched, and files a `LineageDocument` marked `forged`.
   * This is the one place `Person.claimedParents` can diverge from
   * `trueParents` after bootstrap — without it `pedigreeF` (claimed ancestry)
   * and realized homozygosity (the genome) can never disagree.
   */
  z.object({
    kind: z.literal('forge_lineage'),
    target: TargetS,
    parent: z.enum(['mother', 'father']),
    /** The slot naming the false parent to claim instead. */
    claimedAs: z.string(),
    notarisedBy: z.string(),
    generations: z.number().int().positive().default(3),
  }),
]);
export type Effect = z.infer<typeof EffectS>;

// ── Checks: one structure for all four challenge tiers (concept §21) ──────

/**
 * What a `kind: 'record'` pool scores against — the family's own papers,
 * rather than a person. v1 is entry-state only: which event, what it tagged
 * itself, what the family did with its Record choice, and whether the
 * Discrepancy that choice may have created has since been proven or buried.
 * Claim predicates (what an account actually SAYS) arrive with the record
 * layer proper and extend this rather than replacing it.
 */
export const ChronicleQueryS = z.object({
  /** Only entries for this exact event. */
  eventId: z.string().optional(),
  /** Only entries whose event carries this tag. */
  eventTag: z.string().optional(),
  /** Only entries answered this way at Record / Omit / Embellish. */
  record: z.enum(['record', 'omit', 'embellish']).optional(),
  /** Only entries marked grey — gone, but known to have existed (concept §6). */
  greyed: z.boolean().optional(),
  /** Only entries whose Embellish created a Discrepancy currently in this state. */
  discrepancyState: z.enum(['open', 'proven', 'buried']).optional(),
  /** Only entries from the last N years. Omit to search the whole chronicle. */
  withinYears: z.number().optional(),
  /**
   * Claim predicates (issue #19), extending v1: only entries carrying a claim
   * of this shape. `attr`/`trait` narrow further; omitted, they match any
   * claim of that `kind`.
   */
  hasClaim: z.object({
    kind: z.enum(['attr', 'trait', 'death', 'deed']),
    attr: z.string().optional(),
    trait: z.string().optional(),
  }).optional(),
  /** A raw count of matches, or matches over everything the window considered. */
  measure: z.enum(['count', 'ratio']).default('count'),
});
export type ChronicleQuery = z.infer<typeof ChronicleQueryS>;

export const PoolSpecS = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('slot'), slot: z.string(), attrs: z.array(z.object({ attr: z.string(), weight: z.number() })) }),
  z.object({ kind: z.literal('party_sum'), slots: z.array(z.string()), attr: z.string() }),
  z.object({ kind: z.literal('family_sum'), attr: z.string() }),
  z.object({ kind: z.literal('family_max'), attr: z.string() }),
  z.object({ kind: z.literal('family_any'), attr: z.string(), atLeast: z.number() }),
  z.object({ kind: z.literal('record'), against: ChronicleQueryS }),
]);
export type PoolSpec = z.infer<typeof PoolSpecS>;

/**
 * Difficulty as a flat number, or as one that moves with the world — a
 * Church inquest is a harder pool during the Crusade, and a house with more
 * to lose is asked more of. Every term is optional and additive to `base`.
 */
export const DifficultyExprS = z.object({
  base: z.number(),
  /** Added for each of these Ages that is currently active, by id. */
  perActiveAge: z.record(z.string(), z.number()).optional(),
  /** Added per RespectTier above `unknown` (0..4). */
  perRespectTier: z.number().optional(),
  /** Added per hundred years since the contract's signing (1042). */
  perCentury: z.number().optional(),
});
export type DifficultyExpr = z.infer<typeof DifficultyExprS>;

export const CheckS = z.object({
  id: z.string(),
  pool: PoolSpecS,
  difficulty: z.union([z.number(), DifficultyExprS]),
  variance: z.enum(['none', 'narrow', 'wide']).default('narrow'),
  /** Degrees of success, highest threshold first. */
  bands: z.array(z.object({ atLeast: z.number(), outcome: z.string() })).min(1, 'at least one band'),
});
export type Check = z.infer<typeof CheckS>;

export const OutcomeS = z.object({
  id: z.string(),
  weight: z.number().default(100),
  text: z.string(),
  tags: z.array(z.string()).default([]),
  effects: z.array(EffectS).default([]),
  /** Spawn or advance a substory. */
  triggers: z.object({ arc: z.string(), op: z.enum(['start', 'advance']) }).optional(),
  /**
   * THE SECOND BEAT, inline.
   *
   * A two- or three-scene story does not need an arc file, a node table and a
   * two-way `arc: {of, node}` binding maintained by hand in two places — it
   * needs one line saying what happens next and who is still in the room.
   * `desugar.ts` compiles this into a real `ArcDef` before the engine ever sees
   * it, so there is still exactly one thing that runs a tree.
   *
   *   event   the follow-up. It leaves the ambient pool and fires only here.
   *   after   when it comes due, in the same vocabulary an `ArcNode` uses.
   *   keep    slots carried forward, cast with the SAME people. Everything the
   *           follow-up does not list is recast from scratch.
   */
  next: z.object({
    event: z.string(),
    after: ScheduleS.default('next_generation'),
    keep: z.array(z.string()).default([]),
  }).optional(),
});
export type Outcome = z.infer<typeof OutcomeS>;

export const ChoiceS = z.object({
  id: z.string(),
  label: z.string(),
  /** Visibly unavailable choices are themselves information (concept §16). */
  requires: z.array(z.object({ slot: z.string(), attr: z.string(), op: CompareOpS, value: z.number() })).default([]),
  check: z.string().optional(),
  outcomes: z.array(OutcomeS).min(1),
});
export type Choice = z.infer<typeof ChoiceS>;

/**
 * Three interaction shapes, ONE template. A "mission" is not a separate
 * system: it is an event whose slots the player fills himself, which is why
 * dispatch is just `castBy: 'player'` on the slots.
 *
 * `decidedBy` is orthogonal to all three (see `decider.ts`). The shape says how
 * many branches there are and whether the player casts them; the decider says
 * who takes one. Defaulting to `player` is what makes every template authored
 * before this field existed behave exactly as it did.
 *
 * `narration` takes no decider because it has one branch and nothing to decide.
 */
export const InteractionS = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('narration'), outcomes: z.array(OutcomeS).min(1) }),
  z.object({ kind: z.literal('choice'), decidedBy: DeciderS.default('player'), choices: z.array(ChoiceS).min(2) }),
  z.object({ kind: z.literal('dispatch'), decidedBy: DeciderS.default('player'), choices: z.array(ChoiceS).min(1) }),
]);
export type Interaction = z.infer<typeof InteractionS>;

/**
 * Record / Omit / Embellish. The mechanical form of the thesis (concept §6).
 *
 * `claims` (issue #19) is what the option's `chronicle` text actually
 * ASSERTS, in the closed vocabulary — attached to `record` and `embellish`
 * only, since `omit` writes nothing to assert anything with (the blank IS the
 * artefact). An Embellish's claims are, by construction, the lie: `pedigreeF`
 * and `deriveRecordView` in `core/src/record.ts` never need to ask whether an
 * embellished claim is true, only whether a recorded one happens to be.
 */
export const RecordBlockS = z.object({
  subject: z.string(),
  options: z.object({
    record: z.object({
      chronicle: z.string(),
      grantsKnowledge: z.string().optional(),
      effects: z.array(EffectS).default([]),
      claims: z.array(ClaimS).default([]),
    }),
    omit: z.object({
      /** null prints as a dated blank line. The blank is a designed artefact. */
      chronicle: z.null().default(null),
      effects: z.array(EffectS).default([]),
    }),
    embellish: z.object({
      chronicle: z.string(),
      effects: z.array(EffectS).default([]),
      claims: z.array(ClaimS).default([]),
      discrepancy: z.object({
        id: z.string(),
        severity: z.enum(['minor', 'major', 'total']),
        provableBy: z.array(z.string()).min(1),
      }),
    }),
  }),
});
export type RecordBlock = z.infer<typeof RecordBlockS>;

/**
 * Age scoping is a DECLARATIVE FIELD rather than a condition, for three
 * reasons: the selection pipeline buckets by Age and skips whole buckets;
 * the editor can report per-Age coverage; and an Age owning three events is
 * a rules patch wearing a name, which the tool should say out loud.
 */
export const AgeScopeS = z.object({
  only: z.array(z.string()).optional(),
  never: z.array(z.string()).optional(),
  register: z.array(z.enum(['warm', 'cold', 'institutional'])).optional(),
});
export type AgeScope = z.infer<typeof AgeScopeS>;

/**
 * What `tier: 'frame'` gates on, instead of a `Condition` (concept §2, issue
 * #13). One named Discrepancy's state — the same shape the `discrepancy`
 * condition already reads, and the same map it already reads it from
 * (`world.discrepancies`, built for issue #9). No new storage, and no claim
 * vocabulary: v1 of the record layer's claim predicates is a later issue.
 */
/**
 * WHAT THE CREDITOR IS READING (concept §2). A frame scene gates on the record
 * rather than on the world, because the frame is 2042 reacting to what the
 * family wrote down, not to what happened.
 *
 * It could only ever name ONE SPECIFIC Discrepancy, and that is why the frame
 * nearly never happened: sampled every fifty years across a run, the eligible
 * pool held zero scenes at almost every sample, and four player-driven runs of
 * one build produced 2, 13, 15 and 3 interludes with silences of six and eight
 * hundred years. Every authored interlude was waiting for one particular lie
 * to have been told, and most of them never were.
 *
 * The other three shapes ask about the record in general — how much of it
 * there is, how much of it is missing, and whether the family is carrying any
 * unproven lie at all. Those are the readings the guardian can always make,
 * because there is always a chronicle and it always says something.
 */
export const FrameReadS = z.union([
  z.object({
    discrepancy: z.string(),
    /** Omit to ask only whether it exists at all. */
    state: DiscrepancyStateS.optional(),
  }),
  /** Any Discrepancy at all, optionally in a given state. */
  z.object({
    anyDiscrepancy: z.object({
      state: DiscrepancyStateS.optional(),
      atLeast: z.number().default(1),
    }),
  }),
  /** How much the family has written down. `atLeast: 1` is "there is a record". */
  z.object({ recorded: z.object({ atLeast: z.number() }) }),
  /** How many dated blank lines the chronicle carries. */
  z.object({ omitted: z.object({ atLeast: z.number() }) }),
  /**
   * THE PAGE THIS EVENT LEFT, whatever it ended up saying.
   *
   * The fifth shape, and it exists because the first one is too narrow for
   * an interlude whose premise is that a thing HAPPENED and was written
   * about, rather than that a particular lie was told about it. Measured over
   * thirty-six thousand-year runs: `seal_the_regalia_incomplete` fires in
   * eleven of them, each one gets exactly one Record decision, and the
   * chronicler embellishes two — so `{ discrepancy: regalia_lie }` reaches
   * 5.6% of runs and everything gated on it is content 94% of players never
   * see. The page itself is there in all eleven: recorded, embellished, or a
   * dated blank, and a blank is an artefact the guardian can read as well as
   * a sentence.
   *
   * Still the record and not the world (an omitted page is a page), which is
   * the whole reason this is a `reads` and not a `condition`.
   */
  z.object({ chronicled: z.string() }),
]);
export type FrameRead = z.infer<typeof FrameReadS>;

export const EventTemplateS = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/, 'ids are snake_case and never renamed after commit'),
  title: z.string(),
  tier: EventTierS,
  /** Common | Uncommon | Rare | Mythic — see schema/frequency.ts. */
  frequency: FrequencyS,
  /** Per-template nudge WITHIN its frequency tier. Tier does the heavy lifting. */
  weight: z.number().default(100),
  repeatable: z.boolean().default(true),
  cooldownYears: z.number().default(0),
  tags: z.array(z.string()).default([]),
  purposes: z.array(PurposeS).length(3, 'exactly three declared purposes'),

  ages: AgeScopeS.optional(),
  slots: z.record(z.string(), SlotSpecS).default({}),
  conditions: ConditionS.optional(),
  checks: z.array(CheckS).default([]),
  /**
   * `tier: 'frame'` gates on `reads` instead of `conditions` — see
   * `FrameReadS`. Frame-only; every other tier leaves this empty.
   */
  reads: z.array(FrameReadS).default([]),

  body: z.string(),
  /** Required when arc bindings may be dead by the time this node fires. */
  absentBody: z.string().optional(),

  interaction: InteractionS,
  record: RecordBlockS.optional(),
  rumour: z.object({ id: z.string(), accuracy: z.number(), spread: z.number() }).optional(),
  accounts: z.array(z.string()).default([]),

  arc: z.object({ of: z.string(), node: z.string() }).optional(),
});
export type EventTemplate = z.infer<typeof EventTemplateS>;

export const EventFileS = z.object({
  events: z.array(EventTemplateS),
});
