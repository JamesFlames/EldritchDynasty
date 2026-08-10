import type { CharacterRole, Person, RetainerRole } from '@ed/schema';
import type { SimCtx } from '../world.js';
import { DEBT_FLOOR } from '../economy.js';
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
    w.headSince = w.year;
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

/**
 * A CONTRACT ENDS WITH THE MAN WHO SIGNED IT.
 *
 * Every field on `RetainerContract` that decides how service ENDS was dead
 * code. `onEmployerDeath` was declared on all four authored contracts and read
 * nowhere; `term` — seasonal, yearly, lifetime, bonded, hereditary — was read
 * nowhere either. Worse, `mint` overwrote the authored `boundTo` with the
 * house id, so the employer could never die and the enum could never fire. A
 * steward's blurb says out loud that his contract is hereditary and that
 * "servant dynasties need real lineage too", and his children inherited
 * nothing for a thousand years.
 *
 * Contracts now bind to the HEAD who hired them, which is what makes
 * `passes_to_heir` mean something, and the term decides what happens after.
 */
export function releaseContracts(ctx: SimCtx): Person[] {
  const w = ctx.world;
  const released: Person[] = [];
  const head = w.people.living().find((p) => p.castSlots.includes('head'));

  const release = (p: Person, why: string) => {
    p.contract = undefined;
    released.push(p);
    w.chronicle.push({ year: w.year, weight: 'line', text: `${p.name} ${why}`, named: false });
  };

  for (const p of w.people.living()) {
    const contract = p.contract;
    if (!contract) continue;

    // A short-term contract is renewed while the house can pay for it, and a
    // house that cannot pay loses its staff. This is the first thing an empty
    // treasury actually costs the player.
    if ((contract.term === 'seasonal' || contract.term === 'yearly') && w.treasury < contract.wage / 20) {
      release(p, 'was not kept on, the quarter\'s wages being what they were.');
      continue;
    }

    // A lifetime contract is a promise of employment, not an exemption from
    // being paid. A house pinned at the borrowing limit loses even the staff
    // it swore to keep — which is what destitution means, and it is why
    // clause recovery is something a solvent house earns rather than
    // something every house is handed. Hereditary service is a family bound
    // to the house rather than a wage, and does not lapse.
    if (w.treasury <= DEBT_FLOOR && contract.term !== 'hereditary') {
      release(p, 'left the house, there being nothing left to pay them with.');
      continue;
    }

    const employer = w.people.get(contract.boundTo);
    if (employer && employer.status === 'alive') continue;
    // Bound to the house itself rather than to a man: never lapses.
    if (!employer && contract.boundTo === w.playerHouse) continue;

    if (contract.onEmployerDeath === 'passes_to_heir' && head) {
      contract.boundTo = head.id;
      continue;
    }
    if (contract.onEmployerDeath === 'follows_named' && head) {
      contract.boundTo = head.id;
      continue;
    }
    release(p, 'was released from service, the one who hired them being some years dead.');
  }
  return released;
}

/**
 * Servant dynasties. A hereditary post passes to a child of the house's own
 * staff before anybody thinks to hire a stranger — which is the whole of what
 * "hereditary" was supposed to buy, and is also how a family ends up with an
 * archivist whose great-grandmother filed the thing he is looking for.
 */
export function inheritPost(ctx: SimCtx, role: RetainerRole): Person | undefined {
  const w = ctx.world;
  const last = w.people
    .all()
    .filter((p) => p.contract?.role === role && p.contract.term === 'hereditary' && p.status !== 'alive')
    .sort((a, b) => (b.died ?? 0) - (a.died ?? 0))[0];
  if (!last) return undefined;

  const heir = w.people
    .children(last.id)
    .filter((c) => c.status === 'alive' && w.year - c.born >= 16 && !c.contract)
    .sort((a, b) => a.born - b.born)[0];
  if (!heir) return undefined;

  const head = w.people.living().find((p) => p.castSlots.includes('head'));
  heir.contract = { ...last.contract!, boundTo: (head?.id) ?? w.playerHouse };
  w.chronicle.push({
    year: w.year,
    weight: 'line',
    text: `${heir.name} took up ${last.name}'s post, which had been in that family nearly as long as the seal.`,
    named: false,
  });
  return heir;
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

    // The staff's own children first. Hiring a stranger into a hereditary post
    // while the last holder's son is in the house is how you lose the son.
    const inherited = inheritPost(ctx, role);
    if (inherited) { added.push(inherited); continue; }

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
