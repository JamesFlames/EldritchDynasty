import type { CharacterRole, Person, RetainerRole } from '@ed/schema';
import type { SimCtx } from '../world.js';
import type { Rng } from '../rng.js';
import { phenotypeOf } from './factory.js';
import { branchOf, recallToMain } from './branches.js';
import { eligibleTemplates, mint, mintForRole, pickTemplate } from './minting.js';
import { MAIN_BRANCH } from '@ed/schema';

/**
 * Succession, and keeping the recurring cast filled.
 *
 * Without this, every `head`, `tutor` and `rival` slot becomes unfillable
 * within one generation and the event pool silently collapses to nothing. The
 * failure mode is not a crash — it is a thousand years in which nothing
 * happens, which is exactly the drift the design is most afraid of.
 */

export interface SuccessionResult {
  newHead?: Person;
  regency: boolean;
}

/**
 * Only a man who expresses may lead the house. When no living son of the blood
 * expresses, a woman of the blood holds it instead — she can defend, enrich,
 * negotiate and arrange marriages with precision, and she cannot advance
 * ascension by a single point. Nor can she accrue a single point of Madness.
 */
export function ensureHead(ctx: SimCtx, rng: Rng): SuccessionResult {
  const w = ctx.world;
  const living = w.people.household(w.playerHouse, w.year);
  const current = living.find((p) => p.castSlots.includes('head') && p.status === 'alive');
  if (current) return { newHead: undefined, regency: current.sex === 'female' };

  for (const p of w.people.all()) {
    p.castSlots = p.castSlots.filter((s) => s !== 'head');
  }

  const blood = living.filter(
    (p) => p.membership.some((m) => m.kind === 'blood' || m.kind === 'cadet') && w.year - p.born >= 16,
  );

  /**
   * The seat first, then the branches. A cadet cousin is a worse claim than a
   * son of the main line and a far better one than nobody — which is how "a
   * mundane cadet cousin is sitting where the founder sat" (§23) happens, and
   * why a house with living branches is much harder to end.
   */
  const bySeniority = (a: Person, b: Person) => {
    const ab = branchOf(w, a, w.year) === MAIN_BRANCH ? 0 : 1;
    const bb = branchOf(w, b, w.year) === MAIN_BRANCH ? 0 : 1;
    return ab - bb || a.born - b.born;
  };

  /** Seat him, and bring him home if he was not living in the main house. */
  const seat = (p: Person): Person => {
    p.castSlots.push('head');
    recallToMain(ctx, p);
    return p;
  };

  const expressing = blood
    .filter((p) => p.sex === 'male' && phenotypeOf(p, ctx.genetics, w.year).eldritch.canExpress)
    .sort(bySeniority);

  if (expressing.length) {
    return { newHead: seat(expressing[0]!), regency: false };
  }

  // No expressing son. The house enters Regency, and the Ledger keeps counting.
  const women = blood.filter((p) => p.sex === 'female').sort(bySeniority);
  if (women.length) {
    seat(women[0]!);
    w.chronicle.push({
      year: w.year,
      weight: 'paragraph',
      title: 'A Regency',
      text: `No son of the house woke, and so ${women[0]!.name} held it. She held it well, and she could not move it an inch.`,
      named: false,
    });
    return { newHead: women[0], regency: true };
  }

  // A mundane man is better than nobody: he can hold a house, just not advance it.
  const anyMan = blood.filter((p) => p.sex === 'male').sort(bySeniority);
  if (anyMan.length) {
    return { newHead: seat(anyMan[0]!), regency: false };
  }

  void rng;
  return { regency: false };
}

const RETAINER_ROLES: RetainerRole[] = ['tutor', 'steward', 'midwife', 'archivist'];

/** Cast slots kept occupied by minting, and the role that refills each. */
const CAST_ROLES: { slot: string; role: CharacterRole; chance: number }[] = [
  { slot: 'rival', role: 'rival', chance: 0.5 },
  { slot: 'the_match', role: 'the_match', chance: 0.25 },
];

/**
 * Recurring roles are refilled with new people every few generations, so the
 * family's history rhymes. Event authors write to SLOTS, not to individuals —
 * which only works if somebody keeps the slots occupied.
 */
export function maintainCast(ctx: SimCtx, rng: Rng): Person[] {
  const w = ctx.world;
  const added: Person[] = [];
  const living = w.people.living();

  // ── Household retainers, drawn from character templates ────────────────
  for (const role of RETAINER_ROLES) {
    if (living.some((p) => p.contract?.role === role)) continue;
    if (!rng.bool(0.35)) continue;
    if (w.treasury < 20) continue;

    const candidates = eligibleTemplates(ctx, 'retainer').filter((t) => t.contract?.role === role);
    const template = rng.weighted(candidates, (t) => t.weight);
    if (!template) continue;
    added.push(mint(template, ctx, rng, { household: w.playerHouse, membership: 'retainer' }));
  }

  // ── Recurring cast: refilled when the last occupant dies ────────────────
  for (const { slot, role, chance } of CAST_ROLES) {
    if (living.some((p) => p.castSlots.includes(slot))) continue;
    if (!rng.bool(chance)) continue;
    const p = mintForRole(ctx, role, rng);
    if (p) added.push(p);
  }

  // ── Mythic arrivals: rationed by the same tier system events use ────────
  const wanderer = pickTemplate(ctx, 'wanderer', rng);
  if (wanderer && rng.bool(0.05)) {
    const p = mint(wanderer, ctx, rng, { household: w.playerHouse, membership: 'none' });
    added.push(p);
    w.chronicle.push({
      year: w.year,
      weight: 'illuminated',
      title: wanderer.title,
      text: wanderer.blurb ?? `${p.name} arrived, and nobody had sent for them.`,
      named: true,
    });
  }

  // ── The Fragile One: found rather than minted. ────────────────────────
  // Huge font, poor channel — enormous pressure with no vessel. Always a boy,
  // because only those who can express can break.
  if (!living.some((p) => p.castSlots.includes('fragile'))) {
    const candidate = w.people
      .household(w.playerHouse, w.year)
      .filter((p) => {
        const e = phenotypeOf(p, ctx.genetics, w.year).eldritch;
        return e.canExpress && e.overflowMadness > 4;
      })
      .sort((a, b) =>
        phenotypeOf(b, ctx.genetics, w.year).eldritch.overflowMadness
        - phenotypeOf(a, ctx.genetics, w.year).eldritch.overflowMadness)[0];
    if (candidate) candidate.castSlots.push('fragile');
  }

  return added;
}
