import type { Person } from '@ed/schema';
import { MAIN_BRANCH, RESPECT_ORDER, RUNG_ORDER, assertNever } from '@ed/schema';
import type { Rung } from '@ed/schema';
import type { SimCtx } from './world.js';
import { attr, phenotypeOf } from './people/factory.js';
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
 */
export function maxExpressiblePower(ctx: SimCtx): number {
  const t = ctx.genetics.table;
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
 * Eldritch Power on §22's scale: 0 to 100. See `ASCENT_REACH` for what 100
 * means and why it is not the arithmetic maximum.
 */
export function eldritchPower(ctx: SimCtx, p: Person): number {
  const raw = phenotypeOf(p, ctx.genetics, ctx.world.year).eldritch.expressedPower;
  const reference = maxExpressiblePower(ctx) * ASCENT_REACH;
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
      if (spells < 3) return `he has read ${spells} of the three books it takes`;
      if (p.madness > mind) return 'his mind is already losing to it';
      return undefined;

    case 'hierophant':
      if (power < 50) return `the blood does not carry that far (${Math.round(power)} of 50)`;
      if (spells < 8) return `${spells} books of the eight`;
      if (affinities < 3) return `${affinities} affinities of the three`;
      // The Madness FLOOR. From here up a placid mind cannot ascend, which is
      // the whole shape of the design: the ladder runs through the thing that
      // destroys the family.
      if (p.madness < 20) return 'nothing has been asked of him that cost anything';
      if (p.madness > mind) return 'his mind is already losing to it';
      if (respect < RESPECT_ORDER.indexOf('regarded')) return 'the house is not spoken of well enough';
      return undefined;

    case 'vessel':
      if (power < 70) return `${Math.round(power)} of 70`;
      if (spells < 15) return `${spells} books of the fifteen`;
      if (mind < 70) return 'his mind is not wide enough to hold it';
      if (respect < RESPECT_ORDER.indexOf('eminent')) return 'the house is not eminent';
      return 'a living member of the blood, willingly given';

    case 'demigod':
      if (power < 85) return `${Math.round(power)} of 85`;
      if (spells < 25) return `${spells} books of the twenty-five`;
      if (affinities < 5) return `${affinities} affinities of the five`;
      if (respect < RESPECT_ORDER.indexOf('eminent')) return 'the house is not eminent';
      if (p.madness < 60) return 'he has not been hurt enough by it';
      if (p.madness > mind) return 'his mind is already losing to it';
      // Most runs have lost at least one of the three, which §22 says is
      // often the real gate. `regalia.slow.test.ts` exists because of it.
      if (regalia < REGALIA_COMPLETE) return `the Regalia are not whole (${regalia} of ${REGALIA_COMPLETE})`;
      return 'a Great Rite, sanctioned or defied';

    case 'god': {
      if (power < 98) return `${Math.round(power)} of 98`;
      if (spells < 40) return `${spells} books of the forty`;
      if (affinities < 8) return `${affinities} affinities of all eight`;
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
      return 'the Demigod, unmade';
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
  let foremost: HouseAscension['foremost'];
  let best: Rung = 'none';

  // The seat first, then the branches: a Hierophant in a cadet hall is still
  // the family's Hierophant (§16 — a hall is not a house).
  for (const p of w.people.household(w.playerHouse, w.year)) {
    const standing = standingOf(ctx, p);
    if (!foremost || rungIndex(standing.rung) > rungIndex(foremost.standing.rung)) {
      foremost = { person: p.id, name: p.name, standing };
    }
  }
  if (foremost) best = foremost.standing.rung;

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
