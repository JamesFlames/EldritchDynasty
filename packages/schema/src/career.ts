import { z } from 'zod';
import { CareerIdS } from './ids.js';

/**
 * CAREERS — Respect is bought with descendants.
 *
 * Purchased placements, chiefly for the Unwoken. The careers that pay Respect
 * cost the house either the person's body (Military mortality) or their
 * bloodline (Clergy, removed from the breeding pool): a rule the simulation
 * could not express before this file, because `Person.career` was declared,
 * saved, and read by nothing.
 *
 * `respectYield` is QUALITATIVE on purpose — Respect tiers gate categories
 * rather than granting bonuses (Exalted is what makes Ascension socially
 * possible), so a career's contribution is a per-year CHANCE of moving the
 * tier, through the same `respect` effect every other Respect-moving system
 * in the game already uses. See `core/src/people/careers.ts`.
 */
export const CareerRespectYieldS = z.enum(['none', 'low', 'moderate', 'high']);
export type CareerRespectYield = z.infer<typeof CareerRespectYieldS>;

export const CareerDefS = z.object({
  id: CareerIdS,
  name: z.string(),
  respectYield: CareerRespectYieldS,
  /** Crowns/year to the treasury. `variance` widens a random per-year swing — Military income is "variable". */
  income: z.object({ base: z.number(), variance: z.number().min(0).default(0) }),
  /** Clergy: taken out of the breeding pool entirely — no marriage, no children. */
  removesFromBreedingPool: z.boolean().default(false),
  /** Military: kills people. Extra annual death hazard, 0-1, added in `rollDeath`. */
  extraMortality: z.number().min(0).max(1).default(0),
  /**
   * Clergy: grants Madness cover. Subtracted from the household's worst
   * Madness before `tickRespect` asks whether it is visible enough to burn a
   * tier — a family can hide a great deal behind a cassock.
   */
  madnessCover: z.number().min(0).default(0),
  /** Court: Charm growth, better suitor cards. The growth half — an acquired-layer attribute delta per year held. */
  attributeGrowth: z.object({ attr: z.string(), perYear: z.number() }).optional(),
  /** Scholar: faster study. Multiplies a spellbook's `studyYears`; under 1 is faster. */
  studySpeed: z.number().positive().default(1),
  minAge: z.number().int().nonnegative().default(16),
  blurb: z.string().optional(),
});
export type CareerDef = z.infer<typeof CareerDefS>;

export const CareerFileS = z.object({ careers: z.array(CareerDefS) });
