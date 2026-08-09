import type { RespectTier } from '@ed/schema';
import { MAIN_BRANCH, RESPECT_ORDER } from '@ed/schema';
import type { SimCtx } from './world.js';
import { attr } from './people/factory.js';
import { activeBranches, hall } from './people/branches.js';

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

/**
 * Drop one tier, if there is one to drop.
 *
 * Decay floors at **Known**, and the floor is load-bearing rather than kind. A
 * house with a seal, a hall and eight hundred years of dead is known to exist;
 * Unknown is a thing that has to be DONE to you, and it stays reachable
 * through authored `respect` effects. Without the floor the decay compounds
 * through the economy — Unknown pays 16 a year against a standing cost of 6
 * and twenty mouths, so the house cannot afford an archivist, so it stops
 * recovering clauses, so its endgame is decided by year 1300 by a rule about
 * being boring.
 */
function slip(ctx: SimCtx, why: string, floor = 1): boolean {
  const w = ctx.world;
  const i = RESPECT_ORDER.indexOf(w.respect);
  if (i <= floor) return false;
  w.respect = RESPECT_ORDER[i - 1]!;
  w.respectChanged = w.year;
  w.chronicle.push({
    year: w.year,
    weight: 'paragraph',
    title: 'They Were Spoken Of Differently',
    text: `The house was ${RESPECT_ORDER[i]} and then it was not, because ${why}. `
      + 'Nobody announced it. It was simply the case by the following spring.',
    named: false,
  });
  return true;
}

export function tickRespect(ctx: SimCtx): void {
  const w = ctx.world;
  const since = w.respectChanged ?? w.year;

  // Visible Madness burns standing fast. The gate is capability, as ever —
  // only those who can express can overflow, so this can never fire on a
  // household of women and mundane men.
  const roster = hall(w, MAIN_BRANCH, w.year);
  const worst = roster.reduce((m, p) => Math.max(m, p.madness), 0);
  if (worst > VISIBLE_MADNESS && w.year % 5 === 0) {
    if (slip(ctx, 'of what people had started to say about the son in the east rooms')) return;
  }

  // A quiet generation costs a tier.
  if (w.year - since >= RESPECT_QUIET_YEARS) {
    if (slip(ctx, 'nothing had been done in thirty years worth telling anyone about')) return;
    w.respectChanged = w.year;   // already at the floor; stop re-checking yearly
  }
}

/** Standing cost, per living household member, per year. */
const UPKEEP_PER_HEAD = 1;
/** Raising a child, per year, birth to twenty. Doubles the cost of the young. */
const CHILD_SURCHARGE = 1;

/**
 * What a cadet hall sends the seat each year, per working adult.
 *
 * A branch feeds itself — it is not on the main house's books — and sends up
 * what it can spare. An aggrieved one sends nothing, and stops sending it long
 * before it does anything louder. The tithe is small on purpose: five halls
 * paying is a comfortable house, not a rich one, and the §13 tension ("tutor
 * the child you have, or buy the book his grandchildren might read") survives.
 */
const TITHE_PER_ADULT = 0.75;

/**
 * And what they cost. Kin are cheaper than mouths at your own table and they
 * are not free: dowries, funerals, the standing of the name they share.
 *
 * The two numbers are set so a loyal branch roughly pays for itself and an
 * aggrieved one is a straight drain. That is the whole economic argument for
 * noticing the wound before it becomes an Insurrection.
 */
const KIN_UPKEEP_PER_HEAD = 0.5;

export interface EconomyReport {
  income: number;
  upkeep: number;
  wages: number;
  tithe: number;
  net: number;
}

/**
 * RESPECT DECAYS (concept §17).
 *
 * It did not. Respect moved only when an authored effect moved it, so a house
 * that had a good century at 1300 was still Eminent in 2042 having done
 * nothing since — and two of four measured runs simply sat at Exalted from the
 * moment they got there. Which means the endgame squeeze the whole last act is
 * built on ("you need enormous Madness to ascend, Respect to be allowed to,
 * and Madness destroys Respect") had one of its three jaws missing.
 *
 * Three pressures, all annual, all slow enough to be a generation's problem
 * rather than a year's:
 *
 *   QUIET      a generation that does nothing loses a tier. Standing is a
 *              performance, and nobody remembers a house that stopped.
 *   MADNESS    visible Madness burns it fast. Concealment is what the last two
 *              centuries are FOR.
 *   DEBT       being visibly broke is how a great house stops being one.
 *              Already present; now it costs standing rather than a counter.
 */
const RESPECT_QUIET_YEARS = 45;
/** Household Madness above this is visible, whatever the family says. */
const VISIBLE_MADNESS = 45;

export function tickEconomy(ctx: SimCtx): EconomyReport {
  const w = ctx.world;
  const roster = hall(w, MAIN_BRANCH, w.year);

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

  // The branches keep their own books and send up a tithe (concept §16).
  let tithe = 0;
  for (const b of activeBranches(w)) {
    const members = hall(w, b.id as unknown as string, w.year);
    const working = members.filter((p) => w.year - p.born >= 16 && !p.contract).length;
    tithe += working * TITHE_PER_ADULT * Math.max(0, 1 - b.grievance / 100);
    upkeep += members.length * KIN_UPKEEP_PER_HEAD;
  }

  const net = income + tithe - upkeep - wages;
  w.treasury += net;

  // A house cannot borrow forever. Debt bites standing rather than stopping
  // the clock — being visibly broke is how a great house stops being one.
  if (w.treasury < -120) {
    w.treasury = -120;
    w.discontent = Math.min(100, w.discontent + 1);
    slip(ctx, 'the house was visibly broke, and everybody could see it');
  }

  tickRespect(ctx);
  return { income, upkeep, wages, tithe, net };
}
