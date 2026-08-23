import type { LooseSecret, Person, RetainerContract } from '@ed/schema';
import type { SimCtx } from '../world.js';
import type { Rng } from '../rng.js';
import { DEBT_FLOOR } from '../economy.js';

/**
 * WHAT LEAVES WITH THEM, AND TO WHOM.
 *
 * `RetainerContract.knowsSecrets` and `RetainerContract.loyalty` were declared
 * on every authored contract, filled in for every retainer in the game, and
 * read by nothing — invariant 11's exact shape, and the last of the four
 * fields on that type to be wired. The midwife's own note says she "knows what
 * happened to the first child, which makes her a liability with legs", and for
 * a thousand years those legs went nowhere.
 *
 * The mechanism is three steps and introduces no new vocabulary:
 *
 *   LOYALTY MOVES.   A house that pays its people keeps them; a house at the
 *                    borrowing limit does not, and the number that decides
 *                    whether a released servant talks was set at hire and
 *                    never touched again.
 *
 *   A SECRET WALKS.  When service ends, each secret is tested against loyalty
 *                    and against how badly they were let go. What fails goes
 *                    on `world.looseSecrets` with the house that took them on.
 *
 *   A SECRET IS TOLD. Years later — she is asked, in the friendly way, more
 *                    than once — it becomes an OPEN DISCREPANCY under its own
 *                    id, provable by that house. From there every existing
 *                    system picks it up for free: the PRESSURE selection pass
 *                    counts it, content gates on it with the `discrepancy`
 *                    condition, the frame reads it, and the auction lists a
 *                    chronicle page for it, so the family can buy its own
 *                    secret back at a price set by how bad it is.
 *
 * The carrier's death does not stop any of this. A copy does not need anyone
 * alive, which is the argument `arcs/archive.yaml` makes by hand.
 */

/** Why service ended. A servant who was not paid talks; one whose master died does not. */
export type ReleaseReason = 'unpaid' | 'destitute' | 'employer_died';

const BITTERNESS: Record<ReleaseReason, number> = {
  /** Let go because the quarter's wages were what they were. */
  unpaid: 0.20,
  /** The house could not pay anyone. Worse: they watched it coming. */
  destitute: 0.30,
  /** Nobody wronged them. The man who hired them is some years dead. */
  employer_died: 0,
};

/** Long service cuts both ways: it is worth more, and it is harder to sell. */
const LOYAL_YEARS = 30;
const LOYALTY_OF_SERVICE = 0.15;
/** Nineteen years of knowing where things are is a different document from two. */
const MAJOR_AFTER_YEARS = 20;

/** Nobody is certain to talk, and nobody is certain not to. */
const LEAK_FLOOR = 0.02;
const LEAK_CEILING = 0.85;

/** She is not asked the first year, and she does not answer the first time. */
const TELL_AFTER_YEARS = 3;
const TELL_CHANCE_PER_YEAR = 0.09;

/** Loyalty per year: what paying them buys, and what not paying them costs. */
const LOYALTY_GAIN = 0.5;
const LOYALTY_ARREARS = -1.5;
const LOYALTY_DESTITUTE = -3;
/** Nobody's loyalty is bought all the way up by wages alone. */
const LOYALTY_CEILING = 92;

/** How long they have been in this post, in years. */
export function yearsOfService(ctx: SimCtx, p: Person): number {
  const open = p.membership.filter((m) => m.kind === 'retainer' && m.to === undefined);
  const from = open.length ? Math.min(...open.map((m) => m.from)) : undefined;
  if (from === undefined) return 0;
  return Math.max(0, ctx.world.year - from);
}

/**
 * The chance one secret gets out. Loyalty is the whole of the defence, and it
 * is not a wall: a contract written at 66 leaks a third of the time even from
 * a house that did nothing wrong.
 */
export function leakChance(contract: RetainerContract, reason: ReleaseReason, years: number): number {
  const raw = (1 - contract.loyalty / 100)
    + BITTERNESS[reason]
    - Math.min(years, LOYAL_YEARS) / LOYAL_YEARS * LOYALTY_OF_SERVICE;
  return Math.max(LEAK_FLOOR, Math.min(LEAK_CEILING, raw));
}

/**
 * Where a released servant goes. Weighted by what a house can pay, because
 * that is what actually decides it — the chapter house pays four marks and is
 * indoors. The player's own house is not a place to go from the player's own
 * house.
 */
function newEmployer(ctx: SimCtx, rng: Rng): string | undefined {
  const rivals = ctx.content.houses.filter((h) => h.id !== ctx.world.playerHouse);
  return rng.weighted(rivals, (h) => Math.min(h.wealth, 1000))?.id;
}

/**
 * Service has ended. Test what they know against what they were owed.
 *
 * Called from `releaseContracts` with the contract still in hand — the release
 * clears `p.contract`, and a secret read after that is a secret nobody knows.
 */
export function walkSecrets(
  ctx: SimCtx, p: Person, contract: RetainerContract, reason: ReleaseReason, rng: Rng,
): LooseSecret[] {
  const w = ctx.world;
  if (!contract.knowsSecrets.length) return [];

  const years = yearsOfService(ctx, p);
  const chance = leakChance(contract, reason, years);
  const walked: LooseSecret[] = [];

  for (const secret of contract.knowsSecrets) {
    const id = String(secret);
    // Once it is out it is out. A second retainer knowing the same thing does
    // not make it twice as loose, and two entries would tell it twice.
    if (w.looseSecrets.some((l) => l.secret === id)) continue;
    if (!rng.bool(chance)) continue;
    const house = newEmployer(ctx, rng);
    if (!house) continue;

    walked.push({
      secret: id,
      carrier: p.id,
      carrierName: p.name,
      house,
      since: w.year,
      severity: years >= MAJOR_AFTER_YEARS ? 'major' : 'minor',
    });
  }

  if (!walked.length) return [];
  w.looseSecrets.push(...walked);
  w.chronicle.push({
    year: w.year,
    weight: 'line',
    text: `${p.name} took a place elsewhere within the year, and took the rest of it along.`,
    named: false,
  });
  return walked;
}

/**
 * The year the house pays its people, or does not, and the year somebody is
 * finally asked what a house like that keeps in its presses.
 */
export function tickSecrets(ctx: SimCtx, rng: Rng): void {
  driftLoyalty(ctx);
  tellSecrets(ctx, rng);
}

/**
 * Loyalty is bought with wages and spent on arrears. Set at hire and never
 * moved, it made a servant's whole disposition a property of the template
 * rather than of the reign they served under — a house can now earn the
 * silence of a man it hired at 55, and lose the silence of one it hired at 78.
 */
export function driftLoyalty(ctx: SimCtx): void {
  const w = ctx.world;
  for (const p of w.people.living()) {
    const c = p.contract;
    if (!c) continue;
    const delta = w.treasury <= DEBT_FLOOR ? LOYALTY_DESTITUTE
      : w.treasury < c.wage / 20 ? LOYALTY_ARREARS
        : LOYALTY_GAIN;
    const next = c.loyalty + delta;
    c.loyalty = Math.max(0, Math.min(delta > 0 ? LOYALTY_CEILING : 100, next));
  }
}

/**
 * A loose secret becomes a Discrepancy the year it is told. Under its own id,
 * so a house has exactly one account of one thing — and provable by whoever
 * has been keeping the person who knows.
 */
export function tellSecrets(ctx: SimCtx, rng: Rng): string[] {
  const w = ctx.world;
  const told: string[] = [];

  for (const loose of w.looseSecrets) {
    if (loose.told !== undefined) continue;
    if (w.year - loose.since < TELL_AFTER_YEARS) continue;
    if (!rng.bool(TELL_CHANCE_PER_YEAR)) continue;

    loose.told = w.year;
    told.push(loose.secret);

    const existing = w.discrepancies.get(loose.secret);
    if (existing) {
      // A buried thing comes back up: burying it settled the house's own
      // record, and settled nothing at all outside the house. A PROVEN one
      // stays proven — it is already as far out as it goes — and gains a
      // second house that can say so.
      if (existing.state === 'buried') existing.state = 'open';
      if (!existing.provableBy.includes(loose.house)) existing.provableBy.push(loose.house);
    } else {
      w.discrepancies.set(loose.secret, {
        severity: loose.severity,
        provableBy: [loose.house],
        state: 'open',
      });
    }

    const house = w.houses.get(loose.house)?.name ?? loose.house;
    w.chronicle.push({
      year: w.year,
      weight: 'paragraph',
      text: `Something this house has never written down was known at ${house} by the spring, `
        + `and the road it came by ran through ${loose.carrierName}. `
        + 'Nobody there was rude about it. They simply had it.',
      named: false,
      discrepancyId: loose.secret,
    });
  }
  return told;
}
