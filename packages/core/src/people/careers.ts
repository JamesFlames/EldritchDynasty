import type { CareerDef, Person } from '@ed/schema';
import type { SimCtx } from '../world.js';
import type { Rng } from '../rng.js';
import { applyEffect } from '../events/effects.js';

/**
 * CAREERS — Respect is bought with descendants (issue #16).
 *
 * `Person.career` was declared, saved, and read by nothing. This is the one
 * place it is read: income into `tickEconomy`'s treasury, a per-year chance of
 * moving Respect through the same `respect` effect every other system uses,
 * and the costs that make the rule true — read by `demography.ts` directly
 * rather than duplicated here.
 */

export function careerDefOf(ctx: SimCtx, p: Person): CareerDef | undefined {
  return p.career ? ctx.content.career(p.career.career) : undefined;
}

/** Clergy: taken out of the breeding pool entirely. No marriage, no children. */
export function inBreedingPool(ctx: SimCtx, p: Person): boolean {
  return !careerDefOf(ctx, p)?.removesFromBreedingPool;
}

/** Military: kills people. Read by `rollDeath`, added straight into the annual hazard. */
export function careerMortality(ctx: SimCtx, p: Person): number {
  return careerDefOf(ctx, p)?.extraMortality ?? 0;
}

/** Clergy: grants Madness cover. The largest cover held anywhere in `roster`. */
export function madnessCoverOf(ctx: SimCtx, roster: Person[]): number {
  let cover = 0;
  for (const p of roster) cover = Math.max(cover, careerDefOf(ctx, p)?.madnessCover ?? 0);
  return cover;
}

/** How strongly a per-year Respect roll succeeds, by the career's qualitative yield. */
const RESPECT_CHANCE: Record<CareerDef['respectYield'], number> = {
  none: 0,
  low: 0.008,
  moderate: 0.02,
  high: 0.05,
};

/**
 * Income, Respect accrual, Charm growth, and lighting up the one dead branch
 * of `TraitAcquisitionS` this phase owns: a trait whose acquisition names a
 * career grants itself once the holder has served it long enough. Called once
 * a year, for the whole household — see `year/phases.ts`.
 */
export function tickCareers(ctx: SimCtx, rng: Rng): void {
  const w = ctx.world;

  for (const p of w.people.household(w.playerHouse, w.year)) {
    if (!p.career) continue;
    const def = ctx.content.career(p.career.career);
    if (!def) continue;

    w.treasury += def.income.base + (def.income.variance ? rng.range(-def.income.variance, def.income.variance) : 0);

    const chance = RESPECT_CHANCE[def.respectYield];
    if (chance > 0 && rng.bool(chance)) {
      applyEffect({ kind: 'respect', delta: 1 }, ctx, {});
    }

    if (def.attributeGrowth) {
      const { attr, perYear } = def.attributeGrowth;
      p.acquired[attr] = (p.acquired[attr] ?? 0) + perYear;
      if (p.phenotype) p.phenotype.dirty = true;
    }

    const heldYears = w.year - p.career.from;
    for (const trait of ctx.content.traits) {
      if (trait.acquisition.kind !== 'career') continue;
      if (trait.acquisition.career !== p.career.career) continue;
      if (heldYears < trait.acquisition.afterYears) continue;
      p.traits.add(trait.id);
    }
  }
}
