import { z } from 'zod';
import { ConditionS, RegisterS } from './conditions.js';
import { ModifierS } from './attributes.js';

/**
 * An Age is not a phase with a length. It is a HAZARD PROCESS: it arrives by
 * chance and leaves by chance, so the same Age runs a different span in every
 * run. A Wars can burn out in twenty years or grind on for eighty, and the
 * family cannot know which it is living through until it is over.
 */
export const AgeDefS = z.object({
  id: z.string(),
  /** Withheld from the player until the chronicle names it (concept §20 r1). */
  name: z.string(),
  register: RegisterS,
  blurb: z.string().optional(),

  onset: z.object({
    weight: z.number(),
    earliestYear: z.number().optional(),
    conditions: ConditionS.optional(),
    cooldownYears: z.number().default(80),
  }),

  duration: z.object({
    /** Hazard is zero below this. */
    minYears: z.number(),
    medianYears: z.number(),
    /**
     * rising      — likelier to end the longer it has run. The default feel.
     * front_loaded— burns out fast. Right for the Plague.
     * flat        — memoryless. The player can infer nothing from elapsed time.
     *               The most unsettling of the three. Use deliberately.
     */
    shape: z.enum(['flat', 'rising', 'front_loaded']).default('rising'),
  }),

  modifiers: z.array(ModifierS).default([]),

  /**
   * WHAT AN AGE DOES TO PEOPLE DYING, as a multiplier on the annual hazard
   * while it is active (issue #42).
   *
   * The Plague's own blurb has read *"Mortality catastrophic, weighted against
   * low Strength. Life affinity becomes the most valuable thing in the world.
   * Small families die out"* since the Ages were authored, and **none of that
   * was implemented**: an Age was a condition content could gate on and
   * nothing else. `modifiers` above is declared, authored by no Age in the
   * content directory, and read by nothing in `core` — every reader of that
   * field belongs to traits. Invariant 11, three times over.
   *
   * This is deliberately a plain number rather than another entry in the trait
   * modifier union, because what an Age does to mortality is a rule about
   * bodies and belongs beside the other terms in `rollDeath`, not in a
   * dispatch table. 1 is "an Age that does not kill people", which is most of
   * them, so the field is inert until an author says otherwise.
   */
  mortality: z.number().default(1),
  /** Short Ages may be excused the clause duty (concept §20 r4). */
  clauseBearing: z.boolean().default(true),
  /** Years after onset before the chronicle gives it a name. */
  namedAfterYears: z.number().default(20),
});
export type AgeDef = z.infer<typeof AgeDefS>;

export const AgeFileS = z.object({ ages: z.array(AgeDefS) });

export interface ActiveAge {
  age: string;
  began: number;
  named: boolean;
  namedAt?: number;
  paid: { clause?: string; standing: boolean; rumour?: string };
}

export interface AgeState {
  active: ActiveAge[];
  ended: { age: string; began: number; ended: number }[];
  lastEndedRegister?: z.infer<typeof RegisterS>;
}

export function emptyAgeState(): AgeState {
  return { active: [], ended: [] };
}
