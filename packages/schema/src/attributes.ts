import { z } from 'zod';
import { AttributeIdS, LocusIdS, TraitIdS, TagS, CareerIdS } from './ids.js';
import { assertNever } from './exhaustive.js';

/**
 * Eight affinities in four opposed dyads, in two groups.
 * The GROUP is not cosmetic: it decides who may practise what (concept §9).
 */
export const AffinityGroupS = z.enum(['elemental', 'threshold']);
export type AffinityGroup = z.infer<typeof AffinityGroupS>;

export const ELEMENTAL_AFFINITIES = ['fluid', 'thermal', 'aero', 'terra'] as const;
export const THRESHOLD_AFFINITIES = ['life', 'death', 'light', 'darkness'] as const;
export const ALL_AFFINITIES = [...ELEMENTAL_AFFINITIES, ...THRESHOLD_AFFINITIES] as const;
export type AffinityName = (typeof ALL_AFFINITIES)[number];

/** Opposed pairs. Holding both halves is rare, expensive, and Church-named. */
export const DYADS = [
  { group: 'elemental', pair: ['fluid', 'thermal'] },
  { group: 'elemental', pair: ['aero', 'terra'] },
  { group: 'threshold', pair: ['life', 'death'] },
  { group: 'threshold', pair: ['light', 'darkness'] },
] as const;

export const CORE_ATTRIBUTES = ['strength', 'charm', 'agility', 'mind'] as const;

export function affinityGroup(a: string): AffinityGroup | null {
  if ((ELEMENTAL_AFFINITIES as readonly string[]).includes(a)) return 'elemental';
  if ((THRESHOLD_AFFINITIES as readonly string[]).includes(a)) return 'threshold';
  return null;
}

/**
 * The Mystic restriction, in its entirety. Women practise only the Threshold
 * four. It gates LEARNABILITY and has no Madness consequence whatsoever —
 * keeping it apart from `canExpress` is what preserves the two-magics thesis.
 */
// INVARIANT 4: the Mystic restriction. Shares no code with eldritch expression.
export function canLearn(sex: Sex, affinity: string): boolean {
  return sex === 'male' || affinityGroup(affinity) === 'threshold';
}

export const SexS = z.enum(['male', 'female']);
export type Sex = z.infer<typeof SexS>;

export const AttributeKindS = z.enum([
  'core',
  'affinity',
  'eldritch',
  'derived',
  'hidden',
]);
export type AttributeKind = z.infer<typeof AttributeKindS>;

/**
 * WHAT A TUTOR CAN TEACH — §13's forty crowns, and what they may be spent on.
 *
 * The `tutor` order asked only whether the attribute existed, so the client
 * offered all nineteen rows of `attributes.yaml` and the house could buy a
 * full eight-year term in `madness` or `eldritch_power`. Neither is read from
 * the acquired layer by anything: the money went, the term ran, the child came
 * out with a number nothing in the game consults. Forty crowns and eight years
 * for nothing, and nowhere for the player to see that it was nothing — this
 * codebase's signature failure, sold at the table.
 *
 * The other three are worse than useless, they are wrong. `health`, `fertility`
 * and `max_age` DO read the acquired layer, deliberately, in `applyVitality` —
 * that is how a rite lengthens one life. So a tutor was a thing you could hire
 * to make a child live longer, and it worked. A tutor teaches. A body is not
 * something a child can be taught.
 *
 * A switch over the closed union rather than a set of ids: an attribute is six
 * loci and a row in `attributes.yaml` (invariant 10), so the sixteenth one
 * must not have to be remembered here — but a new KIND is a decision, and this
 * is one of the places that has to make it.
 */
export function canBeTaught(kind: AttributeKind): boolean {
  switch (kind) {
    // Trained, drilled, practised. The polygenic list and the eight affinities.
    case 'core':
    case 'affinity':
      return true;
    // Derived from the body as it stands this year; the tutor is not a physician.
    case 'derived':
    // Given, X-linked, and never schedulable — invariant 4 in one word.
    case 'eldritch':
    // Not a number the house is allowed to know it is buying.
    case 'hidden':
      return false;
    default:
      return assertNever(kind);
  }
}

export const AttributeDefS = z.object({
  id: AttributeIdS,
  name: z.string(),
  kind: AttributeKindS,
  group: AffinityGroupS.optional(),
  heritable: z.boolean().default(true),
  loci: z.array(LocusIdS).default([]),
  range: z.object({ min: z.number(), max: z.number() }).default({ min: 0, max: 100 }),
  /** Attributes the chronicle is allowed to lie about (concept §8, sigil drift). */
  recordable: z.boolean().default(true),
  /** Some attributes only develop after Awakening (Mind). */
  gatedBy: z.enum(['awakening', 'adulthood']).optional(),
  /**
   * SEXUAL DIMORPHISM, in points, measured male minus female.
   *
   * Applied as ±half, so the population mean of the attribute does not move —
   * this is a difference between the sexes, not a tax on one of them. Strength
   * feeds the mortality curve, and a shift that pushed the whole female
   * distribution down would quietly raise female mortality, shrink the
   * household and read as a fertility bug three systems away.
   *
   * It shifts the mean, it does not sort the population: the distributions
   * still overlap, so an exceptional woman out-lifting an ordinary man is
   * uncommon rather than impossible. `dimorphismOverlap` says how uncommon.
   */
  dimorphism: z.number().default(0),
  description: z.string().optional(),
});
export type AttributeDef = z.infer<typeof AttributeDefS>;

// ── Traits ────────────────────────────────────────────────────────────────
// The extensibility surface. A trait declares its own influence on events in
// exactly two flavours: presence (it exists) and dispatch (it was chosen).

export const EventMatchS = z.object({
  tags: z.array(TagS).optional(),
  ids: z.array(z.string()).optional(),
  tier: z.array(z.string()).optional(),
  frequency: z.array(z.string()).optional(),
});
export type EventMatch = z.infer<typeof EventMatchS>;

export const ModifierS = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('event_weight'), match: EventMatchS, multiply: z.number().optional(), add: z.number().optional() }),
  z.object({ kind: z.literal('suppress'), match: EventMatchS }),
  z.object({ kind: z.literal('unlock'), grants: z.string() }),
  z.object({ kind: z.literal('check_bonus'), match: z.object({ tags: z.array(TagS).optional(), id: z.string().optional() }), delta: z.number() }),
  z.object({ kind: z.literal('outcome_weight'), match: z.object({ tags: z.array(TagS) }), multiply: z.number() }),
  z.object({ kind: z.literal('attribute'), attr: AttributeIdS, delta: z.number(), target: z.enum(['self', 'household', 'children', 'slot']) }),
  z.object({ kind: z.literal('resource'), resource: z.string(), perYear: z.number() }),
  z.object({ kind: z.literal('reveal_signs'), power: z.number() }),
]);
export type Modifier = z.infer<typeof ModifierS>;

export const InfluenceScopeS = z.enum(['household', 'house', 'branch', 'world']);
export type InfluenceScope = z.infer<typeof InfluenceScopeS>;

export const PresenceEffectS = z.object({
  scope: InfluenceScopeS.default('household'),
  modifiers: z.array(ModifierS),
});
export const DispatchEffectS = z.object({
  whenCastAs: z.array(z.string()).optional(),
  modifiers: z.array(ModifierS),
});

export const TraitAcquisitionS = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('genetic'), locus: LocusIdS, expressWhen: z.enum(['homozygous', 'any', 'hemizygous']) }),
  z.object({ kind: z.literal('threshold'), attr: AttributeIdS, atLeast: z.number().optional(), atMost: z.number().optional() }),
  z.object({ kind: z.literal('sign'), perFontPoint: z.number() }),
  z.object({ kind: z.literal('birth'), chance: z.number() }),
  z.object({ kind: z.literal('event') }),
  z.object({ kind: z.literal('career'), career: CareerIdS, afterYears: z.number() }),
  z.object({ kind: z.literal('age'), from: z.number(), to: z.number().optional() }),
  z.object({ kind: z.literal('assigned') }),
]);

export const TraitDefS = z.object({
  id: TraitIdS,
  name: z.string(),
  tags: z.array(TagS).default([]),
  acquisition: TraitAcquisitionS,
  presence: z.array(PresenceEffectS).default([]),
  dispatch: z.array(DispatchEffectS).default([]),
  description: z.string().optional(),
});
export type TraitDef = z.infer<typeof TraitDefS>;
