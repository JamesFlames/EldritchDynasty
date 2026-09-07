import type { Commitment, Person, RespectTier } from '@ed/schema';
import { assertNever, musterEscalation } from '@ed/schema';
import type { SimCtx } from './world.js';
import type { Rng } from './rng.js';
import { activeBranches } from './people/branches.js';

/**
 * THE MUSTER'S NUMBERS (concept §6, world §10; issue #89, Stage 2 — #95).
 *
 * Anchored on the economy as it stands (issue #89's own table): income by
 * tier 16/32/62/108/175, the levy commutation at 120 crowns as the
 * canonical "a war costs about this much" price. First guesses, to be
 * swept in the harness rather than believed — `docs/BALANCE-LOG.md`
 * carries what the sweep found.
 */
const LEVY_BY_RESPECT: Record<RespectTier, number> = {
  unknown: 4, known: 8, regarded: 14, eminent: 22, exalted: 34,
};
const MEN_PER_ACTIVE_BRANCH = 4;

/** How many men a house can put in the field — derivable from state that already exists, no tenant model. */
export function maxMen(ctx: SimCtx): number {
  return LEVY_BY_RESPECT[ctx.world.respect] + MEN_PER_ACTIVE_BRANCH * activeBranches(ctx.world).length;
}

/** ~48/yr on a 40-man commitment against an eminent house's 108 income: crushing. ~13/yr on 11: a nuisance. */
const PER_MAN_PER_YEAR = 1.2;
/** ~38% of a cohort gone over a 12-year war, worse on a bad tide. */
const BASE_ATTRITION = 0.04;
/** A serjeanty, 11 men, 12 years ≈ 13 credit. */
const CREDIT_RATE = 0.10;
/** Sits beside `military`'s 0.03 — recognisably the same order. Tide-scaled up to double at the worst tide. */
const OFFICER_HAZARD_BASE = 0.02;
const OFFICER_HAZARD_TIDE_SPAN = 0.02;

/** The tide's own yearly walk — small, so a war does not flip from triumphant to catastrophic in one spring. */
const TIDE_WALK_MAX = 8;
const TIDE_MIN = 0;
const TIDE_MAX = 100;

function clamp(lo: number, hi: number, n: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** At most one commitment is ever `in_the_field` — `arc_the_muster`'s own `maxConcurrentInstances: 1`. */
export function activeCommitment(ctx: SimCtx): Commitment | undefined {
  return ctx.world.muster.commitments.find((c) => c.status === 'in_the_field');
}

/**
 * THE ESCALATION READ FRESH (issue #95 comment). Only a `settled`
 * commitment counts — a house that withdrew did not finish what the Crown
 * is measuring, so it does not raise the ask for the next one either.
 */
function escalationNow(ctx: SimCtx): number {
  return musterEscalation(ctx.world.muster.commitments.filter((c) => c.status === 'settled').length);
}

/** `war` in `tickEconomy`'s tally. Money moves in ONE place — `economy.ts` reads this, never `muster.ts` itself. */
export function musterUpkeep(ctx: SimCtx): number {
  const c = activeCommitment(ctx);
  if (!c) return 0;
  // `position`'s own `perYear` folds in once `positions.yaml` exists (#97).
  // An id nothing can resolve yet costs nothing extra rather than crashing.
  return c.men * PER_MAN_PER_YEAR;
}

/**
 * OFFICER MORTALITY DODGES INVARIANT 2 RATHER THAN COMPLYING WITH IT (#89).
 * A term in `rollDeath`'s hazard sum, beside `careerMortality` — `kill()`
 * stays the one gate, and this never calls it. Zero for anyone not an
 * officer of the commitment standing, which is nearly everybody nearly
 * always: the whole point of the dormancy rule is that this function costs
 * nothing to call on a house that has never mustered.
 */
export function musterMortality(ctx: SimCtx, p: Person): number {
  const c = activeCommitment(ctx);
  if (!c || !c.officers.includes(p.id)) return 0;
  const tideWorseness = (TIDE_MAX - ctx.world.muster.tide) / TIDE_MAX;
  return OFFICER_HAZARD_BASE + OFFICER_HAZARD_TIDE_SPAN * tideWorseness;
}

/** A line the player can feel and name — invariant 13 generalised past the Assize to any standing, quiet pressure. */
function chronicleLine(c: Commitment, lost: number, tide: number): string {
  const tideWord = tide >= 60 ? 'in the house\'s favour' : tide <= 40 ? 'against the house' : 'holding, for now';
  const men = `${c.men} of the house's men remain in the field`;
  return lost > 0
    ? `The war goes on. ${men}, ${lost} lost this year, and the tide runs ${tideWord}.`
    : `The war goes on. ${men}, and the tide runs ${tideWord}.`;
}

/**
 * THE YEARLY TICK, run from the `muster` phase. FULLY DORMANT with no
 * commitment standing — no draw, no write, no chronicle line — which is
 * the free regression test issue #95 names: a run that never musters must
 * produce a bit-identical `npm run digest` block.
 *
 * Settlement is not this function's job. `the_settlement` is a docketed
 * choice event with its own Record block, reached through `arc_the_muster`'s
 * own successor graph (`ageActive: the_wars` on the edges) — existing
 * engine machinery. This only keeps the books between beats.
 */
export function tickMuster(ctx: SimCtx, rng: Rng): void {
  const w = ctx.world;
  const c = activeCommitment(ctx);
  if (!c) return;

  w.muster.tide = clamp(TIDE_MIN, TIDE_MAX, w.muster.tide + rng.range(-TIDE_WALK_MAX, TIDE_WALK_MAX));

  const tideWorseness = (TIDE_MAX - w.muster.tide) / TIDE_MAX;
  const escalation = escalationNow(ctx);
  const attritionRate = BASE_ATTRITION * (1 + tideWorseness) * escalation;
  const lost = Math.min(c.men, Math.round(c.men * attritionRate));
  c.men -= lost;

  c.credit += CREDIT_RATE * c.men * escalation;

  w.chronicle.push({
    year: w.year,
    weight: 'line',
    text: chronicleLine(c, lost, w.muster.tide),
    named: false,
  });
}

// ── The `muster` effect's operations (issue #95, `events/effects.ts`'s `case 'muster'`) ──

/** Opens a commitment. `men` is clamped to `maxMen` — an authored levy asking for more than the house can field asks for what it can. */
export function beginCommitment(ctx: SimCtx, men: number, age: string): Commitment {
  const w = ctx.world;
  const id = `must_${(w.counters.muster += 1).toString(36)}`;
  const commitment: Commitment = {
    id,
    began: w.year,
    age,
    men: clamp(0, maxMen(ctx), men),
    from: {},
    officers: [],
    credit: 0,
    status: 'in_the_field',
  };
  w.muster.commitments.push(commitment);
  return commitment;
}

/** More men into the standing commitment, attributed to whichever hall sent them, if named. */
export function reinforceCommitment(ctx: SimCtx, men: number, from?: string): boolean {
  const c = activeCommitment(ctx);
  if (!c || men <= 0) return false;
  c.men += men;
  if (from) c.from[from] = (c.from[from] ?? 0) + men;
  return true;
}

/** Real family, never a second one twice. */
export function addOfficer(ctx: SimCtx, personId: string): boolean {
  const c = activeCommitment(ctx);
  if (!c) return false;
  if (!c.officers.includes(personId)) c.officers.push(personId);
  return true;
}

/** Bought, or withdrawn from — `positions.yaml`'s ids are Stage 3's (#97); this stores whatever id it is given. */
export function setPosition(ctx: SimCtx, position: string): boolean {
  const c = activeCommitment(ctx);
  if (!c) return false;
  c.position = position;
  return true;
}

/** `status: 'settled'` — spends the credit, or not; the calling event's Record block decides what that means. */
export function settleCommitment(ctx: SimCtx): boolean {
  const c = activeCommitment(ctx);
  if (!c) return false;
  c.status = 'settled';
  ctx.world.muster.lastSettled = ctx.world.year;
  return true;
}

/** Keeps the men, forfeits the credit. Available every year — the good decision (#89). */
export function withdrawCommitment(ctx: SimCtx): boolean {
  const c = activeCommitment(ctx);
  if (!c) return false;
  c.status = 'withdrawn';
  return true;
}

// ── The player's own verb (issue #89's interaction table, "Changing it") ──

/**
 * WHAT A PLAYER CAN TELL A STANDING COMMITMENT, ANY YEAR, NO DOCKET (#89).
 * Narrower than the full `muster` Effect: `begin`, `add_officer` and
 * `settle` are scripted moments an authored event reaches, not something a
 * player free-picks off a panel. Buying up a position needs `positions.yaml`
 * (issue #97, Stage 3) to have a price to show; the `set_position` effect
 * exists for content to use once it does, but this verb does not expose it
 * yet — there is nothing honest to charge for it.
 */
export type MusterOrder =
  | { op: 'reinforce'; men: number }
  | { op: 'withdraw' };

export interface MusterOrderResult {
  ok: boolean;
  reason?: string;
}

export function musterOrder(ctx: SimCtx, order: MusterOrder): MusterOrderResult {
  switch (order.op) {
    case 'reinforce': {
      if (!activeCommitment(ctx)) return { ok: false, reason: 'no commitment is standing' };
      if (order.men <= 0) return { ok: false, reason: 'not a number of men' };
      return reinforceCommitment(ctx, order.men)
        ? { ok: true }
        : { ok: false, reason: 'no commitment is standing' };
    }
    case 'withdraw': {
      return withdrawCommitment(ctx)
        ? { ok: true }
        : { ok: false, reason: 'no commitment is standing to call home' };
    }
    default:
      return assertNever(order, 'muster order');
  }
}
