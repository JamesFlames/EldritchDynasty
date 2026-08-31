import type { Person } from '@ed/schema';
import { MAIN_BRANCH, RESPECT_ORDER, RUNG_ORDER, assertNever } from '@ed/schema';
import type { Rung } from '@ed/schema';
import type { SimCtx } from './world.js';
import { attr, phenotypeOf } from './people/factory.js';
import type { LocusTable } from './genetics/loci.js';
import { hall } from './people/branches.js';
import { heirloomDef, heldHeirlooms } from './people/heirlooms.js';

/**
 * THE ASCENSION LADDER (concept §22).
 *
 * This was not in the code. Grepping `core` for a tier, a rung or a gate
 * returned comments and test fixtures and nothing else. Six rungs are
 * specified — Touched, Adept, Hierophant, the Vessel, Demigod, God — and they
 * are what a player is supposed to be climbing for forty generations, and the
 * simulation had no idea they existed. The player's only answer to "am I
 * winning?" was a Respect tier that landed on exalted anyway and a clause
 * count that filled itself.
 *
 * ─── The scale problem, and why this file normalises ────────────────────────
 *
 * §22's gates are written on a 0-100 scale: Touched at 10, Adept at 25,
 * Hierophant at 50, Vessel 70, Demigod 85, God 98. The genetics produce
 * nothing of the kind. Measured over eight thousand-year runs, the highest
 * carried font anybody reached was 26.8 and the highest EXPRESSED power was
 * 17.6, because `channelCeiling` binds hard and binds early. On the raw scale
 * the second rung of six was unreachable in principle, and the top four were
 * not merely hard but arithmetically impossible.
 *
 * Two ways out. Move the genetics until the raw numbers happen to line up with
 * a prose document — which is tuning the most load-bearing system in the game
 * to satisfy a scale nobody chose. Or map the genetic quantity onto the real
 * one, which is what invariant 10 already says to do everywhere else:
 * *"anything mapping an attribute onto a real quantity centres on
 * `ctx.genetics.expected`"*, and *"a cap is not an effect: measure whether the
 * ceiling ever binds"*. It binds. Constantly.
 *
 * So `eldritchPower` is expressed power as a percentage of what the LOCUS
 * TABLE — which is content, and regenerable — can actually produce. A man at
 * the genetic maximum reads 100. §22's numbers then mean exactly what they
 * say, the genetics are untouched, and an author who adds a font locus moves
 * the ceiling and the ladder together instead of silently breaking one of them.
 *
 * ─── What is here, and what is not ──────────────────────────────────────────
 *
 * The rungs, their gates, and the house's high-water mark are here, measured
 * every year and readable by a client and by authored content (the `ascension`
 * condition). The RITES are not: the Vessel's named sacrifice, the Great Rite
 * and its Church sanction, and the God rite's unmaking of the elder are player
 * decisions with authored text, and they belong in content rather than in a
 * measurement module. Rungs four and up therefore gate on everything §22 asks
 * for EXCEPT the rite itself, and `rungGate` names the rite as the last
 * requirement so nothing pretends the ladder is finished.
 *
 * ─── Since then: the rites are answerable (issue #43) ───────────────────────
 *
 * Half of that is no longer true and the half that changed is the important
 * one. The three rites are still not measured here — what a rite DOES is in
 * `events/rites.ts`, and whether the house is ever asked is in content, which
 * is where both belong. What is here is that `gateFor` now READS the answer:
 * `Person.rites` records the acts a man has taken, so rungs four to six can
 * be reached instead of merely described. Before it, every one of those three
 * `return`s was unconditional, and the top half of the ladder was a gate with
 * no key — the same shape as §22's forty books asked of a game containing
 * twenty-one, one floor up.
 *
 * The Vessel is built. The Great Rite and the unmaking are declared, refuse
 * with a reason, and are named by their rungs — so what is missing is missing
 * out loud rather than by omission.
 */

/**
 * The rungs themselves live in `@ed/schema` (`rung.ts`), because the save
 * format and the condition union both need them and this codebase keeps no
 * second hand-written copy of a closed union.
 */
export { RUNG_ORDER as RUNGS, type Rung } from '@ed/schema';

/** Ordering, for "at least this rung" comparisons. */
export function rungIndex(r: Rung): number {
  return RUNG_ORDER.indexOf(r);
}

export function rungTitle(r: Rung): string {
  switch (r) {
    case 'none': return 'unwoken';
    case 'touched': return 'Touched';
    case 'adept': return 'Adept';
    case 'hierophant': return 'Hierophant';
    case 'vessel': return 'the Vessel';
    case 'demigod': return 'Demigod';
    case 'god': return 'God';
    default: return assertNever(r);
  }
}

/**
 * The most Eldritch Power the locus table can put into one man, on the raw
 * genetic scale. Every font locus at its strongest allele, throttled by the
 * ceiling the best possible channel allows.
 *
 * Computed off the table, never hardcoded: `gen-loci.mjs` is a tool and
 * `loci.yaml` is generated, so a hardcoded maximum stops being true the first
 * time anybody adds an attribute.
 *
 * Computed ONCE, at bootstrap, and carried on `GeneticsCtx` beside `expected`
 * — which is the same pattern for the same reason. It is a pure function of
 * the locus table, and the table does not change during a run; `eldritchPower`
 * asks for it on every rung of every gate of every person, and the `foremost`
 * slot role asks `standingOf` of the whole household. Walking the table each
 * time cost two and a half million redundant reductions a run.
 */
export function maxPowerOf(t: LocusTable): number {
  const best = (alleles: { effect?: number }[][], indices: number[]) =>
    indices.reduce((sum, i) => {
      const at = alleles[i] ?? [];
      return sum + at.reduce((m, a) => Math.max(m, a.effect ?? 0), 0);
    }, 0);

  const font = best(t.xAlleles, t.fontIndices);
  // A man has ONE X. The font sum is haploid, and doubling it here would put
  // the whole ladder out of reach by exactly a factor of two.
  const channel = best(t.autosomalAlleles, t.channelIndices) * 2;
  return Math.min(font, 4 + channel * 0.8);
}

/** The same number, off a running context. */
export function maxExpressiblePower(ctx: SimCtx): number {
  return ctx.genetics.maxPower;
}

/**
 * HOW MUCH OF THE THEORETICAL MAXIMUM A THOUSAND YEARS CAN ACTUALLY REACH.
 *
 * The first cut of this file normalised against `maxExpressiblePower` itself —
 * every font locus at its best allele, throttled by the best possible channel —
 * and that was the same mistake as §22's raw numbers, wearing better clothes.
 * Measured: the table's theoretical maximum is 66, and across six thousand-year
 * runs the highest carried font anybody reached was 26.8 and the highest
 * EXPRESSED power about 22. A scale whose top is 66 puts an ordinary expresser
 * at 17 and the best man in a run at 33, so the ladder's second rung was still
 * a coin flip and its top four were still unreachable.
 *
 * Invariant 10 is the rule that was being broken both times: *anything mapping
 * an attribute onto a real quantity centres on what the population actually
 * produces*, not on an arithmetic ceiling nobody stands near. So the scale is
 * anchored where forty generations of deliberate concentration can actually
 * reach, and the calibration is a measurement rather than an argument:
 *
 *   ordinary expresser   raw ~11  ->  EP ~37   (Adept's 25 is a real rung)
 *   a well-bred line     raw ~22  ->  EP ~74   (Hierophant's 50 is a goal)
 *   the best ever seen   raw ~27  ->  EP ~90   (Demigod's 85 is a tail)
 *   God's 98                          needs raw ~29, beyond any run measured
 *
 * That is the shape §22 asks for in prose: Adept typical by generation 3-5,
 * Hierophant "where most first runs die", Demigod a target rather than a
 * milestone, and God the terminal outcome a family has to be built for.
 *
 * Still derived from the table, so an author who adds a font locus moves the
 * ladder with it rather than silently breaking it.
 */
const ASCENT_REACH = 0.45;

/**
 * §22's BOOK COUNTS — the second quantity in this file that was prose taken
 * raw, and the one that made the top of the ladder impossible rather than
 * merely hard.
 *
 * §22 asks one man for 3 books at Adept, 8 at Hierophant, 15 at the Vessel,
 * 25 at Demigod and 40 at God. **The game contains twenty-one spellbooks.**
 * Forty of twenty-one is not a difficult gate; it is a gate with no key, and
 * it typechecked for as long as the raw power scale did and for exactly the
 * same reason — an absolute count, written in prose, against content that was
 * authored afterwards to a different size (invariant 11).
 *
 * That is the same shape `ASCENT_REACH` was built to fix, so it takes the same
 * fix, including the mistake that file already records making once. Measured
 * over twelve played thousand-year runs at a bid ceiling of 600:
 *
 *   the catalogue                      21 books, 8 of them at threshold 0
 *   the shelf the house assembles      12.1 of the 21
 *   the best-read man of a run          7.0, and never more than 9
 *
 * So normalising against the catalogue itself — all twenty-one — would be
 * `maxExpressiblePower` all over again: an arithmetic ceiling nobody stands
 * near, wearing better clothes. The scale is anchored where a thousand years
 * can actually put books in ONE MAN'S hands, which is `BOOK_REACH` of what
 * exists, and §22's counts are then read as fractions of its own top of forty:
 *
 *   Adept's 3      ->  1 book    an ordinary reader has it; a rung, cleared early
 *   Hierophant's 8 ->  3 books   a scaled 2, floored by the 3 affinities beside it
 *   the Vessel's 15 -> 4 books   a well-read man is past it; the blood is not
 *   Demigod's 25   ->  7 books   exactly the best-read man of a typical run
 *   God's 40       -> 11 books   two past the best ever measured, half the shelf
 *
 * What that leaves standing at the top is the blood, which is what §22 says is
 * supposed to stop a house: measured across the same twelve runs, power 50
 * with 3 books happens in 1,899 person-years and power 85 with 3 books in
 * NONE. Books ration the bottom of the ladder and the font rations the top,
 * and before this they both rationed the top and one of them did it with a
 * number no content could satisfy.
 *
 * Derived from the catalogue, like everything else here, so an author who adds
 * a spellbook moves the ladder with it instead of silently breaking it.
 */
const SPELLS_OF_22: Record<Rung, number> = {
  none: 0, touched: 0, adept: 3, hierophant: 8, vessel: 15, demigod: 25, god: 40,
};

/** §22's own top, which the counts above are read as fractions of. */
const SPELLS_AT_GOD = 40;

/**
 * HOW MUCH OF THE LIBRARY A THOUSAND YEARS CAN PUT IN ONE MAN.
 *
 * Half of it. The measurement is in the block above: the shelf reaches 12.1 of
 * 21 and the best-read man of a run holds 7, never more than 9. Half of the
 * catalogue is 10.5, which puts God's gate two books past the best reading
 * anybody has managed — the same discipline `ASCENT_REACH` applies to God's
 * 98, which needs a font beyond any run measured.
 *
 * A number to sweep and re-measure, not to nudge: raising it makes the top of
 * the ladder ask for books that do not exist again, and lowering it hands the
 * Vessel to any man who reads.
 */
const BOOK_REACH = 0.5;

/**
 * §22's AFFINITY COUNTS, which need no normalisation and are here to say why.
 *
 * Three of eight at Hierophant, five at Demigod, all eight at God — and the
 * game contains exactly the eight affinities §22 counts. These were already
 * written against what exists, which is the whole difference between them and
 * the book counts beside them, and moving them would be tuning a number that
 * is not wrong.
 */
const AFFINITIES_OF_22: Record<Rung, number> = {
  none: 0, touched: 0, adept: 0, hierophant: 3, vessel: 0, demigod: 5, god: 8,
};

export function affinitiesFor(rung: Rung): number {
  return AFFINITIES_OF_22[rung];
}

/**
 * How many books this rung actually wants, of the ones the game contains.
 *
 * Never fewer than one where §22 asks for any: a rung that asks for no reading
 * at all is not the rung §22 wrote, whatever the arithmetic rounds to.
 *
 * And never fewer than the affinities beside it. A book carries ONE affinity,
 * so a man holding n books covers at most n of them, and §22's own numbers
 * respect that at every rung — 8 books against 3 affinities, 25 against 5, 40
 * against 8. Normalising the books and not the affinities crosses those two
 * lines at Hierophant, where a scaled 2 sits under an unscaled 3, and the
 * declared book count becomes a number no man can ever be stopped by
 * (invariant 11): the affinity gate one line below would already have refused
 * him. The lower bound is not a difficulty choice — measured, Hierophant
 * wanted three books before this and wants three after it. It is the
 * difference between a gate that says what it does and a gate that does not.
 */
export function booksFor(ctx: SimCtx, rung: Rung): number {
  const asked = SPELLS_OF_22[rung];
  if (asked <= 0) return 0;
  const reference = ctx.content.spellbooks.length * BOOK_REACH;
  const scaled = Math.round((asked / SPELLS_AT_GOD) * reference);
  return Math.max(1, affinitiesFor(rung), scaled);
}

/**
 * Eldritch Power on §22's scale: 0 to 100. See `ASCENT_REACH` for what 100
 * means and why it is not the arithmetic maximum.
 */
export function eldritchPower(ctx: SimCtx, p: Person): number {
  const raw = phenotypeOf(p, ctx.genetics, ctx.world.year).eldritch.expressedPower;
  const reference = ctx.genetics.maxPower * ASCENT_REACH;
  return reference > 0 ? Math.min(100, (raw / reference) * 100) : 0;
}

/** What one person has and what the rung above them still wants. */
export interface Standing {
  rung: Rung;
  /** The one thing most obviously in the way of the next rung. */
  blocked?: string;
  power: number;
  spells: number;
  affinities: number;
  madness: number;
  mind: number;
}

/**
 * §22's gates, in order, each returning the reason it is NOT met.
 *
 * Written as "why not" rather than "yes" on purpose: the player needs to be
 * told what is in the way, and a boolean cannot say. `blocked` on the house's
 * standing is what a client puts under the rung.
 */
function gateFor(ctx: SimCtx, p: Person, rung: Rung): string | undefined {
  const w = ctx.world;
  const power = eldritchPower(ctx, p);
  const spells = p.spellsKnown.length;
  const books = booksFor(ctx, rung);
  const affinityNeed = affinitiesFor(rung);
  const affinities = affinityCount(ctx, p);
  const mind = attr(p, 'mind', ctx.genetics, w.year);
  const respect = RESPECT_ORDER.indexOf(w.respect);
  const regalia = heldHeirlooms(ctx)
    .filter((h) => heirloomDef(ctx, h.id)?.kind === 'regalia').length;

  switch (rung) {
    case 'none':
      return undefined;

    case 'touched':
      if (!p.awakening.awakened) return 'he has not woken';
      if (power < 10) return `the blood is thin in him (${Math.round(power)} of 10)`;
      return undefined;

    case 'adept':
      if (power < 25) return `not enough of it comes through (${Math.round(power)} of 25)`;
      if (spells < books) return `he has read ${spells} of the ${books} ${books === 1 ? 'book' : 'books'} it takes`;
      if (p.madness > mind) return 'his mind is already losing to it';
      return undefined;

    case 'hierophant':
      if (power < 50) return `the blood does not carry that far (${Math.round(power)} of 50)`;
      if (spells < books) return `${spells} books of the ${books}`;
      if (affinities < affinityNeed) return `${affinities} affinities of the ${affinityNeed}`;
      // The Madness FLOOR. From here up a placid mind cannot ascend, which is
      // the whole shape of the design: the ladder runs through the thing that
      // destroys the family.
      if (p.madness < 20) return 'nothing has been asked of him that cost anything';
      if (p.madness > mind) return 'his mind is already losing to it';
      if (respect < RESPECT_ORDER.indexOf('regarded')) return 'the house is not spoken of well enough';
      return undefined;

    case 'vessel':
      if (power < 70) return `${Math.round(power)} of 70`;
      if (spells < books) return `${spells} books of the ${books}`;
      if (mind < 70) return 'his mind is not wide enough to hold it';
      if (respect < RESPECT_ORDER.indexOf('eminent')) return 'the house is not eminent';
      // THE RITE, and it is a thing that happened rather than a quantity that
      // accumulated (issue #43). This line used to return unconditionally,
      // which made rung four unreachable in principle and said so honestly —
      // `events/rites.ts` is what finally lets it be answered.
      if (!p.rites.includes('vessel')) return 'a living member of the blood, willingly given';
      return undefined;

    case 'demigod':
      if (power < 85) return `${Math.round(power)} of 85`;
      if (spells < books) return `${spells} books of the ${books}`;
      if (affinities < affinityNeed) return `${affinities} affinities of the ${affinityNeed}`;
      if (respect < RESPECT_ORDER.indexOf('eminent')) return 'the house is not eminent';
      if (p.madness < 60) return 'he has not been hurt enough by it';
      if (p.madness > mind) return 'his mind is already losing to it';
      // Most runs have lost at least one of the three, which §22 says is
      // often the real gate. `regalia.slow.test.ts` exists because of it.
      if (regalia < REGALIA_COMPLETE) return `the Regalia are not whole (${regalia} of ${REGALIA_COMPLETE})`;
      // Rung five's rite is declared and not built (issue #43's second half),
      // so this still returns on every path — the difference from rung four is
      // that there is now a place for it to be answered from.
      if (!p.rites.includes('great_rite')) return 'a Great Rite, sanctioned or defied';
      return undefined;

    case 'god': {
      if (power < 98) return `${Math.round(power)} of 98`;
      if (spells < books) return `${spells} books of the ${books}`;
      if (affinities < affinityNeed) return `${affinities} affinities of all ${affinityNeed}`;
      if (respect < RESPECT_ORDER.indexOf('exalted')) return 'the house is not exalted';
      if (p.madness < 90) return 'he has not been hurt enough by it';
      if (mind < p.madness) return 'his mind is losing to it';
      if (w.clausesRecovered.size < GOD_CLAUSES) {
        return `${w.clausesRecovered.size} of the ${GOD_CLAUSES} clauses`;
      }
      // THE TERMINAL IRONY (§22). A dynasty that concentrates everything into
      // one perfect patriarch cannot ascend: the rite needs a living Demigod
      // AND somebody separate who exceeds him.
      const elder = livingAtRung(ctx, 'demigod').find((q) => q.id !== p.id);
      if (!elder) return 'there is no Demigod for him to exceed';
      if (!p.rites.includes('unmaking')) return 'the Demigod, unmade';
      return undefined;
    }

    default:
      return assertNever(rung);
  }
}

/** All three founding heirlooms, held at once. */
const REGALIA_COMPLETE = 3;
/** Seven of the nine, per §22's God gate. */
const GOD_CLAUSES = 7;

/**
 * How far up one person is, and what is stopping them going further.
 *
 * A rung is held only if every rung below it is: the ladder is a ladder.
 */
export function standingOf(ctx: SimCtx, p: Person): Standing {
  const ph = phenotypeOf(p, ctx.genetics, ctx.world.year);
  const base: Omit<Standing, 'rung' | 'blocked'> = {
    power: Math.round(eldritchPower(ctx, p) * 10) / 10,
    spells: p.spellsKnown.length,
    affinities: affinityCount(ctx, p),
    madness: Math.round(p.madness),
    mind: Math.round(attr(p, 'mind', ctx.genetics, ctx.world.year)),
  };

  // INVARIANT 1: no rung above `none` without the capability gate, and the
  // capability gate is `canExpress` and nothing else.
  if (!ph.eldritch.canExpress) return { rung: 'none', blocked: 'he cannot express it', ...base };

  let held: Rung = 'none';
  for (const rung of RUNG_ORDER.slice(1)) {
    const why = gateFor(ctx, p, rung);
    if (why) return { rung: held, blocked: why, ...base };
    held = rung;
  }
  return { rung: held, ...base };
}

/**
 * Standing against standing: higher rung first, then more power.
 *
 * The rung is a step and the power is where on the step he is, so two Adepts
 * are not the same man to a ladder that is about to ask one of them for
 * something. Ties past both fall to household order, which is stable per
 * world — this reading may not draw dice.
 */
function outranks(a: Standing, b: Standing): boolean {
  const step = rungIndex(a.rung) - rungIndex(b.rung);
  return step !== 0 ? step > 0 : a.power > b.power;
}

/**
 * THE MAN WHO IS CLIMBING (issue #41).
 *
 * The house's foremost EXPRESSER — not its foremost person, which is a
 * different and emptier question. Everyone who cannot express stands at rung
 * `none` forever (invariant 1), so ranking the whole household ranked seventy
 * people who were all tied at the bottom and handed back whichever of them the
 * store listed first. That man was then printed on the cast panel as *stands
 * highest of anyone*, with `he cannot express it` after it.
 *
 * Restricting the pool to `canExpress` is also what makes the `foremost` slot
 * role structurally safe to deal Madness to: invariant 1 says Madness follows
 * capability and nothing else, and here the capability is the pool rather
 * than a filter an author has to remember to write.
 *
 * Derived, recomputed, stored nowhere (invariant 6).
 */
export function foremostOf(ctx: SimCtx): { person: Person; standing: Standing } | undefined {
  const w = ctx.world;
  let best: { person: Person; standing: Standing } | undefined;
  // The seat first, then the branches: a Hierophant in a cadet hall is still
  // the family's Hierophant (§16 — a hall is not a house).
  for (const p of w.people.household(w.playerHouse, w.year)) {
    if (!phenotypeOf(p, ctx.genetics, w.year).eldritch.canExpress) continue;
    const standing = standingOf(ctx, p);
    if (!best || outranks(standing, best.standing)) best = { person: p, standing };
  }
  return best;
}

/** Everyone of the house currently standing at or above a rung. */
export function livingAtRung(ctx: SimCtx, rung: Rung): Person[] {
  const w = ctx.world;
  const want = rungIndex(rung);
  return w.people
    .household(w.playerHouse, w.year)
    .filter((p) => rungIndex(standingOf(ctx, p).rung) >= want);
}

export interface HouseAscension {
  /** The highest rung anybody of the house stands on this year. */
  rung: Rung;
  /** The highest ever reached. Falls to nobody when the man dies; this does not. */
  best: Rung;
  /** Who is highest, and what is in their way. */
  foremost?: { person: string; name: string; standing: Standing };
}

/**
 * Where the house stands. Measured every year by the `ascension` phase, which
 * writes `world.ascension` — so a client, an authored condition and the year
 * that acted all read one number rather than three recomputations of it.
 */
export function measureAscension(ctx: SimCtx): HouseAscension {
  const w = ctx.world;
  const top = foremostOf(ctx);
  const foremost: HouseAscension['foremost'] = top
    ? { person: top.person.id, name: top.person.name, standing: top.standing }
    : undefined;
  const best: Rung = foremost ? foremost.standing.rung : 'none';

  const highWater = rungIndex(best) >= rungIndex(w.ascension.best) ? best : w.ascension.best;
  return { rung: best, best: highWater, ...(foremost ? { foremost } : {}) };
}

/**
 * One reading, written to the world. Draws no dice — the ladder is a
 * measurement, and a measurement that moved the RNG would make every phase
 * after it depend on how many spells somebody happened to know.
 */
export function tickAscension(ctx: SimCtx): HouseAscension {
  const now = measureAscension(ctx);
  const w = ctx.world;
  const climbed = rungIndex(now.best) > rungIndex(w.ascension.best);

  w.ascension.rung = now.rung;
  w.ascension.best = now.best;

  if (climbed) {
    w.ascension.reachedAt[now.best] = w.year;
    w.chronicle.push({
      year: w.year,
      weight: 'paragraph',
      title: 'A Rung',
      text: `${now.foremost?.name ?? 'Somebody of the house'} stood where nobody of the `
        + `blood had stood before. They called it ${rungTitle(now.best)}, when they `
        + 'called it anything, and most of them did not.',
      named: false,
      // What the BOOK will be able to show in 2042. The ending reads the
      // chronicle rather than `world.ascension` (§6), and this is the page it
      // reads: a house that climbed and a house that can prove it climbed are
      // two different houses on the last night.
      rung: now.best,
    });
  }
  return now;
}

/** How many distinct affinities this person's books cover. */
function affinityCount(ctx: SimCtx, p: Person): number {
  const seen = new Set<string>();
  for (const id of p.spellsKnown) {
    const def = ctx.content.spellbook(id);
    if (def) seen.add(String(def.affinity));
  }
  return seen.size;
}

/**
 * Whether the seat has anybody Touched. §22: "No Touched male = Regency" — the
 * one place the ladder was always load-bearing, and the one place the rest of
 * the code already agreed with it.
 */
export function seatHasTouched(ctx: SimCtx): boolean {
  const w = ctx.world;
  return hall(w, MAIN_BRANCH, w.year)
    .some((p) => rungIndex(standingOf(ctx, p).rung) >= rungIndex('touched'));
}
