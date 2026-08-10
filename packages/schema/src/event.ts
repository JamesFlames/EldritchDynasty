import { z } from 'zod';
import { ConditionS, CompareOpS, FilterS } from './conditions.js';
import { FrequencyS } from './frequency.js';

/**
 * The purposes vocabulary is a CLOSED set and every template declares exactly
 * three (editor brief §4.5). A longer list would let an author justify
 * anything, which defeats the point of having the rule.
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
export const TargetS = z.union([
  z.object({ slot: z.string() }),
  z.object({ all: z.string() }),
  z.enum(['head', 'household', 'all_blood', 'children_of_head']),
]);
export type Target = z.infer<typeof TargetS>;

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
  z.object({ kind: z.literal('spellbook'), op: z.enum(['gain', 'lose', 'degrade']), book: z.string() }),
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
]);
export type Effect = z.infer<typeof EffectS>;

// ── Checks: one structure for all four challenge tiers (concept §21) ──────
export const PoolSpecS = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('slot'), slot: z.string(), attrs: z.array(z.object({ attr: z.string(), weight: z.number() })) }),
  z.object({ kind: z.literal('party_sum'), slots: z.array(z.string()), attr: z.string() }),
  z.object({ kind: z.literal('family_sum'), attr: z.string() }),
  z.object({ kind: z.literal('family_max'), attr: z.string() }),
  z.object({ kind: z.literal('family_any'), attr: z.string(), atLeast: z.number() }),
  z.object({ kind: z.literal('record'), against: z.string() }),
]);

export const CheckS = z.object({
  id: z.string(),
  pool: PoolSpecS,
  difficulty: z.number(),
  variance: z.enum(['none', 'narrow', 'wide']).default('narrow'),
  /** Degrees of success, highest threshold first. */
  bands: z.array(z.object({ atLeast: z.number(), outcome: z.string() })),
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
 */
export const InteractionS = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('narration'), outcomes: z.array(OutcomeS).min(1) }),
  z.object({ kind: z.literal('choice'), choices: z.array(ChoiceS).min(2) }),
  z.object({ kind: z.literal('dispatch'), choices: z.array(ChoiceS).min(1) }),
]);
export type Interaction = z.infer<typeof InteractionS>;

/** Record / Omit / Embellish. The mechanical form of the thesis (concept §6). */
export const RecordBlockS = z.object({
  subject: z.string(),
  options: z.object({
    record: z.object({
      chronicle: z.string(),
      grantsKnowledge: z.string().optional(),
      effects: z.array(EffectS).default([]),
    }),
    omit: z.object({
      /** null prints as a dated blank line. The blank is a designed artefact. */
      chronicle: z.null().default(null),
      effects: z.array(EffectS).default([]),
    }),
    embellish: z.object({
      chronicle: z.string(),
      effects: z.array(EffectS).default([]),
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
