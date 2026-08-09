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
