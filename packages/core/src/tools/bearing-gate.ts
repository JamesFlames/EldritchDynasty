/**
 * IS BEARING A MORAL OR A TAX? (concept §29, issue #45's acceptance)
 *
 *   npm run gate:bearing -- [runs] [years]
 *   npm run gate:bearing -- 24 1000
 *
 * §29's whole design rests on one asymmetry, and the issue states it as the
 * test rather than as a hope:
 *
 *   > Across runs binned by bearing: high-bearing runs reach HIGHER rungs on
 *   > average AND show materially higher variance in outcome. If they are
 *   > simply worse, this is a difficulty setting and players will play around
 *   > it rather than feel it.
 *
 * A tax is a number that goes down. A moral is a bargain that usually pays and
 * occasionally ruins you, and the difference between those two is visible only
 * in a distribution — which is why this is a batch tool and not an assertion
 * about a seed.
 *
 * ─── The three columns ──────────────────────────────────────────────────────
 *
 * Like `gate:blood` and `gate:ladder`, this PLAYS: the docket is parked and one
 * policy answers the two decisions §29 is about — the Match and the Record —
 * while the chronicler answers everything else, so the columns differ by how
 * the house CARRIES itself and by nothing else.
 *
 *   proud       takes the cousin where there is one and refuses the hand where
 *               there is not, holds every carrying daughter off the market, and
 *               writes the family larger at every Record block. All four of
 *               `BearingAct`'s acts, played deliberately.
 *   modest      takes a card every time and takes the outsider, releases
 *               everybody, and records honestly. The house that does the
 *               correct, dilute, well-liked thing for a thousand years.
 *   unattended  the chronicler decides. The control, and the shape of a run
 *               nobody is playing.
 *
 * ─── What it asserts, and what it only prints ───────────────────────────────
 *
 * Asserted: the top bearing bin reaches a higher mean rung than the bottom
 * one. That is §29 rule 2 — *pride must usually be CORRECT* — and it is the
 * half of the acceptance the measurement can currently carry. Over 252 played
 * runs the bins run 2.15 / 2.31 / 2.30 on one seed set and 2.08 / 2.20 / 2.29
 * on another, so the shape is a GRADIENT from the bottom bin to the top rather
 * than a strict monotone — top minus bottom is +0.15 and +0.21, replicated,
 * against a standard error near 0.05. Pride climbs.
 *
 * NOT asserted, and this is the open half of the issue: *materially higher
 * variance*. Measured, the spread is FLAT — the top bin comes out 0.04
 * narrower than the bottom on both seed sets, with the extremes living in the
 * low and middle bins. Stage 3's three warning lanes are built and did not
 * change that, so the tail this is asking after is not a warning problem; the
 * one remaining named mechanism is the record read back on the last night.
 * Asserting a floor on the spread today would be gating on a difference this
 * batch cannot see, so the spread is printed and a floor belongs here the day
 * something moves it.
 *
 * AND DO NOT READ A RESULT OFF ONE BATCH OF IT. Run twice on different seed
 * sets before believing anything about the spread: measured on identical
 * content, a single bin's variance swings by up to 0.10 from nothing but the
 * seeds (the middle bin came out 0.26 and 0.16), which is larger than any
 * movement a content drop has ever produced in it. The top-minus-bottom
 * statistic is the one that replicates — −0.04 in both sets — and it is the
 * one to quote. This paragraph exists because the first measurement here
 * credited stage 3's first bite with doubling a gap whose noise floor is three
 * times the gap.
 *
 * NOT IN `npm run gate`, for the same reason `gate:blood` and `gate:drag` are
 * not: the rung assertion is a two-standard-error effect at eighty-four runs a
 * bin and is meaningless at the dozen a CI budget allows. It is an instrument
 * you point at the question, not a tripwire.
 *
 * Printed and not asserted: standing, clauses and household size at 2042. They
 * are the texture of the distribution rather than its subject, and where any
 * one run lands on them is a seed.
 */
import { loadContent } from '@ed/content';
import {
  indexContent, RESPECT_ORDER,
  type ContentBundle, type Content, type EventTemplate, type Outcome, type Rung,
} from '@ed/schema';
import { bootstrap, clearNamingQueue } from '../sim.js';
import { stepYear } from '../year/step.js';
import { makeRng, hashSeed } from '../rng.js';
import {
  autoResolveAll, declineMatch, resolveMatch, resolveRecord,
  type PendingMatch, type PendingRecord,
} from '../events/decisions.js';
import { REMEMBERED_AFTER, WARNING_TAG, bearingOf } from '../bearing.js';
import { order } from '../table.js';
import { rungIndex } from '../ascension.js';
import { phenotypeOf } from '../people/factory.js';
import { END_YEAR } from '../ending.js';
import { inRegency, type SimCtx } from '../world.js';

export type Carriage = 'proud' | 'modest' | 'unattended';

/**
 * ONE RUN, AND WHAT IT IS BEING ASKED.
 *
 * Every field says what it RETURNS rather than what it is about, and carries
 * its unit, because half of them are per-run totals and half are means over
 * something and the two do not read alike in a table. `warned` and `unheard`
 * were the pair that made this necessary: two bare past participles, one a
 * count of scenes and the other a count of entries in a ledger, sitting next
 * to each other in the same printed row.
 */
export interface BearingRun {
  seed: number;
  carriage: Carriage;

  // ── §29's own quantity, three readings of it ────────────────────────────
  /** The highest `bearingOf().carriage` reached in the run. */
  peakCarriage: number;
  /** Its mean over every year old enough to hold a remembered act. THE BINS USE THIS. */
  meanCarriage: number;
  /** What it read in 2042. */
  finalCarriage: number;

  // ── The Match, and how the policy answered it ───────────────────────────
  /** Hands the player was dealt in the run. */
  handsDealt: number;
  /** Available cards per hand, averaged over those hands. Stage 2's own number. */
  cardsPerHand: number;
  /** Hands answered by declining every card. */
  handsDeclined: number;
  /** Hands answered by taking a household card with an outsider on the table. */
  cousinsTaken: number;

  // ── The ladder, which is what the acceptance is actually about ──────────
  /** The highest rung anybody of the house ever stood on. */
  bestRung: Rung;
  /** The same, as an index, because a mean of six names is not a thing. */
  bestRungIndex: number;

  // ── Stage 3: what the house was and was not told (issue #45) ────────────
  /**
   * Scenes that had a warning on the table and gave it — counted across every
   * lane that carries one, not off a list of ids.
   */
  warningsHeard: number;
  /** Scenes that had one and did not. `world.bearing.unheard`, which is the trace. */
  warningsWithheld: number;

  // ── The texture: where the house ended up ───────────────────────────────
  /** Standing at 2042 as an index into `RESPECT_ORDER`, for the same reason as the rung. */
  respectTierIndex: number;
  /** Ledger clauses recovered by 2042, of nine. */
  clausesRecovered: number;
  /** Living members of the household at 2042. */
  householdAtEnd: number;
  /** Years of the run spent in a Regency. */
  regencyYears: number;
}

/**
 * §7's `withhold` order, played as a rule rather than as a decision: a proud
 * house does not put its carrying daughters on anybody else's market. This is
 * `kept_her_back`, and it is the one act of the four that costs nothing at all
 * on the day it is taken.
 */
function holdTheCarriers(ctx: SimCtx, hold: boolean): void {
  const w = ctx.world;
  for (const p of w.people.household(w.playerHouse, w.year)) {
    if (p.sex !== 'female') continue;
    if (phenotypeOf(p, ctx.genetics, w.year).eldritch.carriedFont <= 0) continue;
    if (p.marriages.some((m) => m.to === undefined)) continue;
    // THROUGH THE TABLE VERB, not by writing `world.withheld` directly. The
    // first cut of this file did the latter and the act was never written
    // down — `noteBearing('kept_her_back')` lives in `order`, so a batch that
    // reaches past it measures a proud house that the world has no memory of.
    order(ctx, { kind: 'withhold', person: p.name, hold });
  }
}

/**
 * One hand, answered by carriage.
 *
 * The proud house is not simply refusing. §29's causal story is that *the
 * pride that refuses to dilute the blood is what forces the marriage that
 * ruins it*, so a proud house takes the cousin when there is one on the table
 * — `took_the_cousin` — and refuses when there is not. Refusing everything
 * would exercise one of the four acts and would also be a strategy nobody
 * plays.
 */
function answerMatch(
  ctx: SimCtx,
  pending: PendingMatch,
  carriage: Carriage,
  tally: { hands: number; cards: number; declined: number; kin: number },
): void {
  const open = pending.cards.filter((c) => c.available);
  tally.hands += 1;
  tally.cards += open.length;

  if (!open.length) {
    declineMatch(ctx, pending.id);
    tally.declined += 1;
    return;
  }

  // `household` is the card drawn from the house's own people: the cousin. It
  // only counts as the act while an outsider card is also on the table, which
  // is the one moment anybody can tell the two apart.
  const kin = open.filter((c) => c.kind === 'household');
  if (carriage === 'proud') {
    const cousin = [...kin].sort((a, b) => b.kinship - a.kinship)[0];
    if (!cousin) {
      declineMatch(ctx, pending.id);
      tally.declined += 1;
      return;
    }
    if (resolveMatch(ctx, pending.id, cousin.id).ok) tally.kin += 1;
    else { declineMatch(ctx, pending.id); tally.declined += 1; }
    return;
  }

  // Modest: the outsider, and the one who shares the least blood.
  const outward = [...open].sort((a, b) => (a.kinship - b.kinship) || (a.id < b.id ? -1 : 1))[0]!;
  if (!resolveMatch(ctx, pending.id, outward.id).ok) {
    declineMatch(ctx, pending.id);
    tally.declined += 1;
  } else if (outward.person) tally.kin += 1;
}

export function playOnce(
  source: ContentBundle | Content,
  seed: number,
  years: number,
  carriage: Carriage,
): BearingRun {
  const ctx = bootstrap(source, seed, 1042);
  const w = ctx.world;
  // The standing order a house of this carriage gives once and never revisits.
  if (carriage === 'modest') w.marriagePolicy = 'out';
  if (carriage === 'proud') w.marriagePolicy = 'in';

  const tally = { hands: 0, cards: 0, declined: 0, kin: 0 };
  let peakCarriage = 0;
  let carriageSum = 0;
  let sampledYears = 0;
  let regencyYears = 0;

  for (let i = 0; i < years; i++) {
    if (w.year >= END_YEAR) break;
    if (carriage !== 'unattended') holdTheCarriers(ctx, carriage === 'proud');
    stepYear(ctx, carriage === 'unattended');

    let guard = 0;
    while (w.pendingDecisions.length && guard++ < 200) {
      const rng = makeRng(hashSeed(seed, 'bearing-batch', w.year, guard));

      const match = w.pendingDecisions.find((d): d is PendingMatch => d.kind === 'match');
      if (match) { answerMatch(ctx, match, carriage, tally); continue; }

      // The Embellish is the loudest of the four acts and the only one the
      // player takes with a pen. A modest house never reaches for it.
      const record = w.pendingDecisions.find((d): d is PendingRecord => d.kind === 'record');
      if (record) { resolveRecord(ctx, record.id, carriage === 'proud' ? 'embellish' : 'record'); continue; }

      autoResolveAll(ctx, rng);
    }
    clearNamingQueue(ctx);

    const read = bearingOf(ctx).carriage;
    peakCarriage = Math.max(peakCarriage, read);
    // The MEAN reading, and it is what the bins are built on. `carriage` is
    // acts per century of the run so far, so its peak is dominated by the
    // first century — one act at year 1100 divides by a single century and
    // reads as a house that has been doing this for eight hundred years. The
    // mean is what the world actually lived with.
    if (w.year > w.assize.openedAt + REMEMBERED_AFTER) { carriageSum += read; sampledYears += 1; }
    if (inRegency(w)) regencyYears += 1;
  }

  return {
    seed,
    carriage,
    peakCarriage,
    meanCarriage: sampledYears ? carriageSum / sampledYears : 0,
    finalCarriage: bearingOf(ctx).carriage,
    handsDealt: tally.hands,
    cardsPerHand: tally.hands ? tally.cards / tally.hands : 0,
    handsDeclined: tally.declined,
    cousinsTaken: tally.kin,
    bestRung: w.ascension.best,
    bestRungIndex: rungIndex(w.ascension.best),
    // WARNINGS THE HOUSE ACTUALLY GOT, across every lane that carries one.
    //
    // This counted firings of ONE event — `the_letter_comes_and_is_expected`,
    // the successor of the first lane written — so the two lanes added later
    // were invisible to it by construction, and the column could not move
    // however many scenes the library gained. A conclusion was drawn off it
    // (*"more scenes are not the lever"*) that the instrument was incapable of
    // supporting either way.
    //
    // Counted exactly instead: every firing of a scene that HAD a warning on
    // the table either took it or wrote `noteUnheard`, so the two sum to the
    // number of such firings and the difference is what was heard.
    warningsHeard: warningScenesFired(ctx) - w.bearing.unheard.length,
    warningsWithheld: w.bearing.unheard.length,
    respectTierIndex: RESPECT_ORDER.indexOf(w.respect),
    clausesRecovered: w.clausesRecovered.size,
    householdAtEnd: w.people.household(w.playerHouse, w.year).length,
    regencyYears,
  };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
/** Population variance. A distribution's width is the whole subject here. */
const variance = (xs: number[]) => {
  const m = mean(xs);
  return mean(xs.map((x) => (x - m) ** 2));
};

export interface BearingVerdict { ok: boolean; lines: string[] }

/**
 * The acceptance asks for runs BINNED BY BEARING rather than for a policy
 * comparison, and the difference is not pedantic. A column is a strategy and
 * carries everything else that strategy does — a proud column that also
 * withholds is carrying `BALANCE-LOG`'s own measured trap, and a verdict read
 * off it is a verdict about withholding.
 *
 * So the columns exist to SPREAD the reading, and the verdict is read off the
 * pooled runs, sorted by how the world came to read the house and cut in
 * three. Which policy produced a given run is not part of the question.
 */
function bins(runs: BearingRun[]): { label: string; runs: BearingRun[] }[] {
  const sorted = [...runs].sort((a, b) => a.meanCarriage - b.meanCarriage);
  const third = Math.max(1, Math.floor(sorted.length / 3));
  return [
    { label: 'kept its head down', runs: sorted.slice(0, third) },
    { label: 'the middle', runs: sorted.slice(third, sorted.length - third) },
    { label: 'carried itself', runs: sorted.slice(sorted.length - third) },
  ];
}

/**
 * THE JUDGMENT, over runs somebody else played.
 *
 * Split out from the playing for the reason every gate in this repo is a
 * function rather than a script: a gate nobody has watched fail is
 * indistinguishable from a gate that cannot fail. The ladder gate can be
 * handed a declawed BUNDLE because what it measures is authored; bearing's
 * consequence is in `marketAppetite`, in the engine, so there is no content to
 * take away. What can be handed to a test is the distribution itself — one
 * where the house that carried itself climbed higher, and one where it did
 * not — and that is exactly the reading this function makes.
 */
/**
 * How many times a scene with a `warning` outcome on the table fired at all.
 *
 * Read off the CONTENT rather than a list of ids, so it still means what it
 * says after the next warning lane is authored — which is the same reason
 * `gate:ladder` recognises a ladder bargain by its effects rather than by name.
 */
function warningScenesFired(ctx: SimCtx): number {
  const carriers = new Set(
    ctx.content.events
      .filter((e) => allOutcomesOf(e).some((o) => o.tags.includes(WARNING_TAG)))
      .map((e) => e.id),
  );
  return ctx.world.chronicle.filter((c) => c.eventId !== undefined && carriers.has(c.eventId)).length;
}

/** Every outcome of a template, whichever interaction shape it uses. */
function allOutcomesOf(e: { interaction: EventTemplate['interaction'] }): Outcome[] {
  return e.interaction.kind === 'narration'
    ? e.interaction.outcomes
    : e.interaction.choices.flatMap((c) => c.outcomes);
}

export function verdictOver(runs: BearingRun[]): BearingVerdict {
  const lines: string[] = [];
  const byCarriage = new Map<Carriage, BearingRun[]>();
  for (const r of runs) byCarriage.set(r.carriage, [...(byCarriage.get(r.carriage) ?? []), r]);
  for (const [carriage, rs] of byCarriage) {
    lines.push(
      `  ${carriage.padEnd(10)} carriage ${mean(rs.map((r) => r.meanCarriage)).toFixed(2)}`
      + ` (peak ${mean(rs.map((r) => r.peakCarriage)).toFixed(2)})`
      + `  cards/hand ${mean(rs.map((r) => r.cardsPerHand)).toFixed(2)}`
      + `  hands ${mean(rs.map((r) => r.handsDealt)).toFixed(0)}`
      + `  declined ${mean(rs.map((r) => r.handsDeclined)).toFixed(0)}`
      + `  cousins ${mean(rs.map((r) => r.cousinsTaken)).toFixed(0)}`
      + `  warnings heard ${mean(rs.map((r) => r.warningsHeard)).toFixed(1)}`
      + `  withheld ${mean(rs.map((r) => r.warningsWithheld)).toFixed(1)}`,
    );
  }

  lines.push(`  --- ${runs.length} runs, pooled and cut in three by how the world reads the house ---`);
  const cut = bins(runs);
  for (const b of cut) {
    const rungs = b.runs.map((r) => r.bestRungIndex);
    lines.push(
      `  ${b.label.padEnd(18)} n ${String(b.runs.length).padStart(2)}`
      + `  carriage ${mean(b.runs.map((r) => r.meanCarriage)).toFixed(2)}`
      + `  mean rung ${mean(rungs).toFixed(2)} (var ${variance(rungs).toFixed(2)})`
      + `  warnings heard ${mean(b.runs.map((r) => r.warningsHeard)).toFixed(1)}`
      + `  reached ${[...new Set(b.runs.map((r) => r.bestRung))].join('/')}`
      + `  standing ${mean(b.runs.map((r) => r.respectTierIndex)).toFixed(2)}`
      + `  clauses ${mean(b.runs.map((r) => r.clausesRecovered)).toFixed(1)}`
      + `  household ${mean(b.runs.map((r) => r.householdAtEnd)).toFixed(1)}`,
    );
  }

  const low = cut[0]!.runs.map((r) => r.bestRungIndex);
  const high = cut[2]!.runs.map((r) => r.bestRungIndex);
  const higher = mean(high) > mean(low);
  const spread = variance(high) - variance(low);

  if (!higher) {
    lines.push('  FAIL: the house that carried itself does not reach higher rungs than the one that'
      + ' kept its head down — §29 rule 2 says pride must usually be CORRECT, and a carriage that'
      + ' only costs is a tax players optimise away inside an hour');
  }
  // The other half of the acceptance, printed rather than judged. See the head
  // of this file: the tail this is asking after is stage 3's, and stage 3 is
  // not built.
  lines.push(`  spread: the top bin carries ${spread >= 0 ? '+' : ''}${spread.toFixed(2)} of variance`
    + ' over the bottom — the acceptance asks for MATERIALLY more, and a single batch cannot see a'
    + ' difference this size (run two seed sets). Stage 3\'s warning lanes are built and did not'
    + ' move it; the one mechanism left is the record read back on the last night');
  return { ok: higher, lines };
}

export function gateBearing(
  source: ContentBundle | Content = loadContent(),
  opts: { seeds?: number[]; years?: number } = {},
): BearingVerdict {
  const bundle = indexContent(source);
  const seeds = opts.seeds ?? Array.from({ length: 12 }, (_, i) => 4000 + i * 13);
  const years = opts.years ?? 1000;

  const runs = (['proud', 'modest', 'unattended'] as const)
    .flatMap((carriage) => seeds.map((s) => playOnce(bundle, s, years, carriage)));

  const verdict = verdictOver(runs);
  return {
    ok: verdict.ok,
    lines: [`gate (bearing): ${seeds.length} played runs x ${years} years, per carriage`, ...verdict.lines],
  };
}

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('bearing-gate.ts');
if (isMain) {
  const runs = Number(process.argv[2] ?? 12);
  const years = Number(process.argv[3] ?? 1000);
  const seeds = Array.from({ length: runs }, (_, i) => 4000 + i * 13);
  const { ok, lines } = gateBearing(loadContent(), { seeds, years });
  for (const l of lines) console.log(l);
  process.exit(ok ? 0 : 1);
}
