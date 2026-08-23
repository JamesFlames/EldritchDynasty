import type { Person, Year } from '@ed/schema';
import { MAIN_BRANCH, assertNever } from '@ed/schema';
import type { SimCtx } from './world.js';
import type { Rng } from './rng.js';
import { hall } from './people/branches.js';
import { attr } from './people/factory.js';
import { beginStudy, canStudySpellbook, heldBooks, spellbookDef } from './people/library.js';
import { DEBT_FLOOR } from './economy.js';
import { eldritchPower } from './ascension.js';

/**
 * THE TABLE — the half of the game the player was never allowed to play.
 *
 * Every verb on `GameSession` answered a prompt the simulation raised. There
 * was no verb a player could use on a turn of their own choosing, and the
 * `auction`, `careers` and `library` phases docketed nothing at all — they
 * ticked, correctly, forever, and the player watched.
 *
 * That quietly deleted the concept's own headline tension. §13: *"special
 * education competes directly with the auction. Tutor the child you have, or
 * buy the book his grandchildren might read. Both are correct; you can afford
 * one."* The player made neither decision. And §14's auction — "announced
 * years ahead so the player can liquidate, borrow, or start planning something
 * regrettable" — resolved itself.
 *
 * The cost of that was not only agency. It was the ladder. Measured over six
 * thousand-year runs before this file existed, the most books any member of
 * the house ever finished was ONE, because `beginStudy` was reachable only
 * from an authored `study` effect and there are a handful of those in a
 * hundred and twenty-four templates. Adept wants three books, Hierophant
 * eight, God forty. The Ascension Ladder was not merely ungated — it was
 * starved four systems upstream, exactly the way both frame interludes were
 * (`CLAUDE.md`: "measure the whole funnel before moving anything").
 *
 * ─── What a table order is ──────────────────────────────────────────────────
 *
 * A standing order, not an action. The player says what the house is to do
 * with its people and its money, the year phases carry it out, and the order
 * stands until it is finished or withdrawn. That is what a head of house
 * actually does — nobody micromanages a decade — and it means the table costs
 * the player a handful of decisions a generation rather than a stream of them.
 *
 * ─── The steward ────────────────────────────────────────────────────────────
 *
 * `runStandingOrders` also acts when the player has NOT spoken, and that is
 * deliberate. A house whose player never opens the table still reads its books
 * and fills its posts, because a house does. The steward is a floor, not a
 * strategy: he puts idle readers on the cheapest book they can learn and
 * leaves the money alone. Everything above that floor is the player's, and the
 * difference between the floor and a played table is the whole point.
 */

export type TableOrder =
  /** Put somebody on a book. Costs them years, and the house nothing. */
  | { kind: 'study'; person: string; book: string }
  /**
   * Special education, §13's price table: 40 crowns for a full term, and the
   * child comes out of it measurably better at one thing.
   */
  | { kind: 'tutor'; person: string; attr: string }
  /** Put somebody in a post. */
  | { kind: 'career'; person: string; career: string }
  /** How high the house will go at the next auction, in crowns. */
  | { kind: 'bid'; ceiling: number }
  /** Keep somebody off the marriage market, or put them back on it. */
  | { kind: 'withhold'; person: string; hold: boolean };

export interface OrderResult {
  ok: boolean;
  reason?: string;
}

/** §13: special education, one attribute, full term. */
export const TUTOR_FEE = 40;
/** How long a term runs, and how much of the attribute it is worth. */
export const TUTOR_YEARS = 8;
export const TUTOR_GAIN = 9;

/**
 * Give the house an order. Refused, with a reason, when the house cannot
 * carry it out — the reason is the point, and a client shows it beside the
 * greyed option exactly as `canUseHeirloom` and `canStudySpellbook` do.
 */
export function order(ctx: SimCtx, o: TableOrder): OrderResult {
  const w = ctx.world;

  switch (o.kind) {
    case 'study': {
      const p = ours(ctx, o.person);
      if (!p) return { ok: false, reason: 'nobody of this house by that name' };
      const def = spellbookDef(ctx, o.book);
      if (!def) return { ok: false, reason: 'no such book' };
      if (!w.library.has(o.book)) return { ok: false, reason: 'the house does not hold it' };
      const can = canStudySpellbook(ctx, p, def);
      if (!can.ok) return { ok: false, reason: can.reason ?? 'not theirs to learn' };
      return beginStudy(ctx, p, def)
        ? { ok: true }
        : { ok: false, reason: 'he is already at it, or already has it' };
    }

    case 'tutor': {
      const p = ours(ctx, o.person);
      if (!p) return { ok: false, reason: 'nobody of this house by that name' };
      if (!ctx.content.attributes.some((a) => String(a.id) === o.attr)) {
        return { ok: false, reason: 'nothing anybody teaches' };
      }
      if (w.year - p.born > TUTOR_AGE_LIMIT) return { ok: false, reason: 'too old to be taught' };
      if (w.tutoring.some((t) => t.person === p.id)) return { ok: false, reason: 'already in a term' };
      if (w.treasury - TUTOR_FEE < DEBT_FLOOR) {
        return { ok: false, reason: `the house cannot raise ${TUTOR_FEE} crowns` };
      }
      // §13's whole tension is that this money is gone and the auction is in
      // eleven years. It is spent NOW, not on completion.
      w.treasury -= TUTOR_FEE;
      w.tutoring.push({ person: p.id, attr: o.attr, completes: w.year + TUTOR_YEARS });
      return { ok: true };
    }

    case 'career': {
      const p = ours(ctx, o.person);
      if (!p) return { ok: false, reason: 'nobody of this house by that name' };
      const def = ctx.content.career(o.career);
      if (!def) return { ok: false, reason: 'no such post' };
      if (p.career?.career === o.career) return { ok: false, reason: 'he already holds it' };
      if (w.year - p.born < CAREER_AGE) return { ok: false, reason: 'too young for a post' };
      p.career = { career: def.id, from: w.year };
      return { ok: true };
    }

    case 'bid': {
      if (!Number.isFinite(o.ceiling) || o.ceiling < 0) return { ok: false, reason: 'not a figure' };
      w.bidCeiling = Math.round(o.ceiling);
      return { ok: true };
    }

    case 'withhold': {
      const p = ours(ctx, o.person);
      if (!p) return { ok: false, reason: 'nobody of this house by that name' };
      // A daughter held back is power the house keeps and a match it does not
      // make. §7: every daughter married outward is power leaving the blood
      // forever, and there was no way to decline to spend her.
      if (o.hold) w.withheld[p.id] = w.year;
      else delete w.withheld[p.id];
      return { ok: true };
    }

    default:
      return assertNever(o);
  }
}

const TUTOR_AGE_LIMIT = 22;
const CAREER_AGE = 16;

/** Everyone of the house, alive, this year — the people orders may name. */
function ours(ctx: SimCtx, id: string): Person | undefined {
  const w = ctx.world;
  const p = w.people.get(id);
  if (!p || p.status !== 'alive') return undefined;
  return w.people.household(w.playerHouse, w.year).some((q) => q.id === p.id) ? p : undefined;
}

/** What the table can currently be told to do. A client draws this. */
export interface TableView {
  treasury: number;
  bidCeiling: number;
  /** Books on the shelf, and who in the house could take one up. */
  shelf: { book: string; name: string; years: number; readers: { person: string; name: string }[] }[];
  /** Terms of tutoring already paid for. */
  tutoring: { person: string; name: string; attr: string; completes: Year }[];
  /** Studies under way. */
  studying: { person: string; name: string; book: string; completes: Year }[];
  /** Who is being kept off the market. */
  withheld: { person: string; name: string; since: Year }[];
  /** What a full term of tutoring costs today, and whether it can be paid. */
  tutorFee: number;
  canTutor: boolean;
}

export function tableView(ctx: SimCtx): TableView {
  const w = ctx.world;
  const household = w.people.household(w.playerHouse, w.year);
  const name = (id: string) => w.people.get(id)?.name ?? id;

  const shelf = heldBooks(ctx).map((state) => {
    const def = spellbookDef(ctx, state.id);
    const readers = def
      ? household
        .filter((p) => canStudySpellbook(ctx, p, def).ok
          && !p.spellsKnown.some((b) => String(b) === state.id)
          && !w.studies.some((s) => s.person === p.id && s.book === state.id))
        .map((p) => ({ person: p.id, name: p.name }))
      : [];
    return {
      book: state.id,
      name: def?.name ?? state.id,
      years: def?.studyYears ?? 0,
      readers,
    };
  });

  return {
    treasury: Math.round(w.treasury),
    bidCeiling: w.bidCeiling,
    shelf,
    tutoring: w.tutoring.map((t) => ({ ...t, name: name(t.person) })),
    studying: w.studies.map((s) => ({ ...s, name: name(s.person) })),
    withheld: Object.entries(w.withheld).map(([person, since]) => ({ person, name: name(person), since })),
    tutorFee: TUTOR_FEE,
    canTutor: w.treasury - TUTOR_FEE >= DEBT_FLOOR,
  };
}

/**
 * THE STEWARD. Run every year from the `table` phase.
 *
 * Two jobs. Finish the terms the house has paid for, and — where the player
 * has left somebody idle — put readers on books. He never spends money and
 * never touches the market: those are the decisions, and a steward who made
 * them would be the player again.
 */
export function runStandingOrders(
  ctx: SimCtx,
  rng: Rng,
): { taught: string[]; opened: string[]; placed: string[] } {
  const w = ctx.world;
  const taught: string[] = [];
  const opened: string[] = [];
  const placed: string[] = [];

  // Terms come due. `acquired` is where life's changes go — invariant 6, and
  // writing into the phenotype cache would look like it worked until spring.
  for (const t of [...w.tutoring]) {
    if (w.year < t.completes) continue;
    w.tutoring = w.tutoring.filter((x) => x !== t);
    const p = w.people.get(t.person);
    if (!p || p.status !== 'alive') continue;
    p.acquired[t.attr] = (p.acquired[t.attr] ?? 0) + TUTOR_GAIN;
    taught.push(p.id);
    w.chronicle.push({
      year: w.year,
      weight: 'line',
      text: `${p.name} finished the term, and was better at ${t.attr} than the house had any right to expect.`,
      named: false,
    });
  }

  // Idle readers, and a shelf. The steward reaches for the SHORTEST book
  // anybody can finish, because he is minding the house rather than building
  // a Hierophant — the long ones are the player's call.
  const seat = hall(w, MAIN_BRANCH, w.year);
  const busy = new Set(w.studies.map((s) => s.person));
  const books = heldBooks(ctx)
    .map((s) => spellbookDef(ctx, s.id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d))
    .sort((a, b) => a.studyYears - b.studyYears);
  if (!books.length) {
    placePosts(ctx, rng, placed);
    return { taught, opened, placed };
  }

  // THE BLOOD READS FIRST. A house chasing the ladder puts its books in front
  // of the boy who can express, not in front of whoever happens to be idle —
  // and the gates want power AND books ON THE SAME MAN (§22). Sorted rather
  // than filtered: a mundane cousin with a free decade still reads, he just
  // reads second.
  const byBlood = [...seat].sort((a, b) => eldritchPower(ctx, b) - eldritchPower(ctx, a));
  for (const p of byBlood) {
    if (busy.has(p.id)) continue;
    if (w.year - p.born < READING_AGE) continue;
    // One at a time, and not everybody every year: a house is not a seminary.
    // Somebody who can express is worth pushing; everybody else is worth
    // letting get on with it.
    const keen = eldritchPower(ctx, p) > 0 ? STEWARD_DILIGENCE_BLOOD : STEWARD_DILIGENCE;
    if (!rng.bool(keen)) continue;
    const book = books.find((d) => canStudySpellbook(ctx, p, d).ok
      && !p.spellsKnown.some((b) => String(b) === String(d.id)));
    if (!book) continue;
    if (beginStudy(ctx, p, book)) {
      opened.push(p.id);
      busy.add(p.id);
    }
  }
  placePosts(ctx, rng, placed);
  return { taught, opened, placed };
}

/**
 * SOMEBODY HAS TO DO SOMETHING WITH THE SPARE SONS.
 *
 * `tickCareers` only ever MAINTAINED a career — paying its income, growing its
 * attribute, granting its trait after enough years. Nothing placed anybody.
 * Placement came only from an authored `career` effect, so the measured answer
 * was three placements a run, twelve of eighteen of them scholars, and seven
 * of the eight authored posts were decoration.
 *
 * The steward places by what the post is FOR, weighted rather than picked, so
 * a house does not end up all clergy. He never buys a commission the treasury
 * cannot stand, and he never touches anybody the player has given an order
 * about.
 */
function placePosts(ctx: SimCtx, rng: Rng, placed: string[]): void {
  const w = ctx.world;
  const posts = ctx.content.careers;
  if (!posts.length) return;

  // A HOUSE HAS A FINITE NUMBER OF COMMISSIONS. The first cut of this had no
  // ceiling and placed 773 people a run, which fixed "seven of the eight posts
  // are decoration" by turning careers into a standing yield: `tickCareers`
  // pays Respect per holder per year, so thirty simultaneous holders drove
  // every one of six runs to exalted and flattened the standing spread that
  // the Assize had just opened up. A post is a thing the house buys and can
  // only afford so many of.
  const household = w.people.household(w.playerHouse, w.year);
  let held = household.filter((p) => p.career).length;
  if (held >= MAX_POSTS) return;

  for (const p of household) {
    if (held >= MAX_POSTS) return;
    if (p.career || p.contract) continue;
    const age = w.year - p.born;
    if (age < CAREER_AGE || age > CAREER_AGE_LIMIT) continue;
    // The Head has a post already, and it is the seal.
    if (p.castSlots.includes('head')) continue;
    if (!rng.bool(STEWARD_PLACEMENT)) continue;

    const open = posts.filter((def) => {
      // §16: ordination removes them from the succession entirely. A steward
      // does not remove the only son who can express from the breeding pool —
      // that is a decision, and an expensive one, and it is the player's.
      if (def.removesFromBreedingPool && eldritchPower(ctx, p) > 0) return false;
      // A commission is bought. Being visibly broke is not the moment.
      if (def.extraMortality && w.treasury < COMMISSION_FLOOR) return false;
      // AND THE HOUSE DOES NOT SEND THE BOY WHO CAN EXPRESS TO THE WARS.
      // `military` carries `extraMortality: 0.03` and scores well on strength,
      // so the steward's first cut posted strong expressers to it and they
      // died before they had read three books — the ladder went back to
      // `touched` in every run, from a rung it had just reached in five of
      // six. Everything the family is counting on is concentrated in exactly
      // the people it must not spend (§7), and a steward should know that.
      if (def.extraMortality && eldritchPower(ctx, p) > 0) return false;
      return true;
    });
    const def = rng.weighted(open, (d) => postFit(ctx, p, d));
    if (!def) continue;

    p.career = { career: def.id, from: w.year };
    placed.push(p.id);
    held += 1;
  }
}

/**
 * How well a post suits a person. A weight, not a filter — a house puts people
 * where they will do, and sometimes where there is room.
 *
 * Every post scores at least 1 so nothing is unreachable, which is the whole
 * failure this replaces: scholar was twelve of eighteen placements because
 * `study` effects were the only authored placements in the library.
 */
function postFit(ctx: SimCtx, p: Person, def: { id: string; studySpeed?: number }): number {
  const w = ctx.world;
  const of = (k: string) => attr(p, k, ctx.genetics, w.year);
  switch (String(def.id)) {
    // A scholar is for the blood, and for the boy who can actually read.
    case 'scholar': return 1 + (eldritchPower(ctx, p) > 0 ? 4 : 0) + of('mind') / 30;
    case 'clergy': return 1 + of('mind') / 40 + (w.discontent > 40 ? 2 : 0);
    case 'military': return 1 + of('strength') / 25;
    case 'court': return 1 + of('charm') / 25;
    case 'advocate': return 1 + of('mind') / 35;
    case 'merchant': return 1 + (w.treasury < 300 ? 3 : 1);
    case 'factor': return 1 + (w.treasury < 300 ? 2 : 1);
    case 'sea': return 1 + of('strength') / 40;
    default: return 1;
  }
}

/** Past this age nobody is starting a career. */
const CAREER_AGE_LIMIT = 45;
/** Below this the house is not buying anybody a commission. */
const COMMISSION_FLOOR = 120;
/** The chance an idle adult is put to a post in a given year. */
const STEWARD_PLACEMENT = 0.09;
/**
 * How many posts the house can hold at once. Six is about one in three of the
 * seat — enough that every authored career is reachable, few enough that the
 * Respect they yield is a decision the house made rather than weather.
 */
const MAX_POSTS = 6;

/** Old enough to be given a book and left alone with it. */
const READING_AGE = 14;
/**
 * The chance an idle reader is set to a book in a given year. Low on purpose:
 * the steward is a floor under the library, not a strategy, and a house that
 * reads everything on the shelf the moment it arrives leaves the player's own
 * orders nothing to be better than.
 */
const STEWARD_DILIGENCE = 0.12;
/** And the chance for somebody who can actually express it. */
const STEWARD_DILIGENCE_BLOOD = 0.45;

/** Whether the market may be shown this person (`withhold`). */
export function onTheMarket(ctx: SimCtx, p: Person): boolean {
  return ctx.world.withheld[p.id] === undefined;
}

/** How much this person has been taught, over what the blood gave them. */
export function taught(ctx: SimCtx, p: Person, key: string): number {
  return attr(p, key, ctx.genetics, ctx.world.year);
}
