import type { RespectTier } from '@ed/schema';
import type { SimCtx } from './world.js';
import { attr } from './people/factory.js';

/**
 * THE ANNUAL ECONOMY (concept §13).
 *
 * This did not exist. The treasury only ever moved when an event spent it, and
 * every event that touches money spends it — so the house drifted past −1,000
 * crowns by year 1400 and stayed there. Nothing broke, because nothing checks
 * a negative treasury: the only visible symptom was that `maintainCast`
 * silently stopped hiring retainers, so the tutor, the midwife and the
 * archivist quietly vanished from the game around year 1150.
 *
 * Prices are the ones in the brief, and they are small enough to feel.
 * 1 crown = 20 marks = 240 mites.
 */

/** Typical income by standing. The brief pins Regarded at 55–70/year. */
const INCOME_BY_RESPECT: Record<RespectTier, number> = {
  unknown: 16,
  known: 32,
  regarded: 62,
  eminent: 108,
  exalted: 175,
};

/**
 * The cost of living as a house of that standing. Not in the brief's price
 * table, and needed: with only per-head upkeep the treasury climbs past
 * 50,000 crowns by 2042 and money stops being a constraint at all — which
 * quietly removes the §13 tension the whole economy exists for ("tutor the
 * child you have, or buy the book his grandchildren might read").
 *
 * Standing is not free. A house at Eminent must be seen to live like one.
 */
const STANDING_COST: Record<RespectTier, number> = {
  unknown: 6,
  known: 20,
  regarded: 44,
  eminent: 84,
  exalted: 146,
};

/** Standing cost, per living household member, per year. */
const UPKEEP_PER_HEAD = 1;
/** Raising a child, per year, birth to twenty. Doubles the cost of the young. */
const CHILD_SURCHARGE = 1;

export interface EconomyReport {
  income: number;
  upkeep: number;
  wages: number;
  net: number;
}

export function tickEconomy(ctx: SimCtx): EconomyReport {
  const w = ctx.world;
  const roster = w.people.household(w.playerHouse, w.year);

  // Income derives from holdings, modified by the Head's Charm and standing.
  const head = roster.find((p) => p.castSlots.includes('head'));
  const charm = head ? attr(head, 'charm', ctx.genetics, w.year) : 0;
  const income = INCOME_BY_RESPECT[w.respect] * (1 + charm / 220);

  let upkeep = STANDING_COST[w.respect];
  let wages = 0;
  for (const p of roster) {
    if (p.contract) {
      // A servant's yearly wage is quoted in marks; twenty to the crown.
      wages += p.contract.wage / 20;
      continue;
    }
    upkeep += UPKEEP_PER_HEAD;
    if (w.year - p.born < 20) upkeep += CHILD_SURCHARGE;
  }

  const net = income - upkeep - wages;
  w.treasury += net;

  // A house cannot borrow forever. Debt bites standing rather than stopping
  // the clock — being visibly broke is how a great house stops being one.
  if (w.treasury < -120) {
    w.treasury = -120;
    w.discontent += 1;
  }

  return { income, upkeep, wages, net };
}
