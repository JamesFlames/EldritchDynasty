/**
 * DOES THE LADDER CHARGE THE MAN WHO IS CLIMBING IT? (issue #41, second half)
 *
 *   npm run gate:ladder -- [runs] [years] [--bid=N]
 *   npm run gate:ladder -- 8 1000
 *
 * `ascension.ts` writes the finding this tool exists to close on the
 * Hierophant gate itself:
 *
 *   > if (p.madness < 20) return 'nothing has been asked of him that cost
 *   > anything';
 *
 * Measured over sixteen played thousand-year runs before this file existed,
 * that line was the last thing standing between the house and the fourth
 * rung — men at power 57 with ten books, eight affinities and Madness ZERO.
 * And it could not be fixed by moving a constant: power is `min(font,
 * ceiling)` and blood-Madness is `(font - ceiling) x 0.85`, the same
 * subtraction with opposite signs, so halving `MADNESS_OVERFLOW_YEARS`
 * doubled the ruin and moved the ladder not one rung in eight of eight runs.
 *
 * A ladder that runs through Madness has to be charged by CONTENT, and until
 * `events/the_ladder.yaml` every one of the game's authored `madness` effects
 * landed on a POSITION — HEAD, BEARER, CHILD, SECOND — while the ladder is
 * climbed by whoever the blood happened to land in.
 *
 * ─── The two columns ────────────────────────────────────────────────────────
 *
 * Like `gate:blood`, this PLAYS: the docket is parked, one policy answers
 * every ladder demand and the chronicler answers everything else, so the
 * difference between two columns is a difference in one verb.
 *
 * `climb` takes the branch that costs the man something, every time.
 * `spare`  refuses it, every time, and is the control.
 *
 * Neither reads a choice id. The policy is a rule over CONTENT — take (or
 * refuse) the branch whose outcomes deal Madness to somebody — so it still
 * means what it says after the next event is authored, and a list of ids
 * would not.
 *
 * ─── What it asserts ────────────────────────────────────────────────────────
 *
 * Two things, and it is deliberately not asserting a rung. `climb` must end
 * with more Madness on the man standing highest than `spare` does — that is
 * the mechanism, and asserting the mechanism rather than a seed is this
 * repo's own rule. And the Madness floor must stop being the thing that
 * blocks the fourth rung in the climbing column, because that is what the
 * gate text says is wrong.
 *
 * What blocks it INSTEAD is printed rather than judged. When this was
 * written, it was books and power, and that is a library and a genetics
 * question rather than this one.
 *
 * The ceiling each column reaches is printed for the same reason and asserted
 * for none: where one run's ladder stops is a seed, and this repo does not
 * gate on seeds. See the comment beside the line that prints it.
 */
import { loadContent } from '@ed/content';
import { indexContent, type Content, type ContentBundle, type Rung } from '@ed/schema';
import { bootstrap, clearNamingQueue } from '../sim.js';
import { stepYear } from '../year/step.js';
import { makeRng, hashSeed } from '../rng.js';
import {
  autoResolveAll, resolveChoice, type PendingChoice,
} from '../events/decisions.js';
import { foremostOf, rungIndex, standingOf } from '../ascension.js';
import { phenotypeOf } from '../people/factory.js';
import { END_YEAR } from '../ending.js';
import type { SimCtx } from '../world.js';

type Source = ContentBundle | Content;

export type LadderPolicy = 'climb' | 'spare' | 'chronicler';

export interface LadderRun {
  seed: number;
  policy: LadderPolicy;
  /** The best anyone of the house ever stood, and the man who did it. */
  best: Rung;
  name: string;
  atYear: number;
  power: number;
  books: number;
  affinities: number;
  /** His Madness at his own high-water mark, and the deepest anyone reached. */
  madness: number;
  mind: number;
  madnessPeak: number;
  /** What was between him and the next rung. */
  blocked: string;
  /** Ladder demands seen, and how many were paid for. */
  asked: number;
  paid: number;
  /** Person-years spent standing at Adept or above, with a rung still in front. */
  adeptYears: number;
  /** Of those, the ones where the man had already paid the Hierophant floor. */
  floorPaid: number;
  /**
   * The deepest Madness ever carried BY A MAN ON THE LADDER — not by anyone,
   * which is a different and much easier number: the house's most ruined man
   * is usually somebody the blood overflowed in his twenties who never read a
   * book. This is the one the issue is about.
   */
  climberMadness: number;
}

/** §22's Hierophant Madness floor, from `gateFor`. */
const HIEROPHANT_FLOOR = 20;

/**
 * Does taking this branch cost THE MAN WHO IS CLIMBING his mind?
 *
 * Narrowed to Madness landing on a `foremost` slot on purpose. "Any branch
 * that deals Madness to anybody" also catches `the_drowning`, which charges an
 * unwoken boy of seven — and a climbing column that drowns children too would
 * separate from a sparing one on Madness without either column saying anything
 * about the ladder. That is the confound this gate would be least able to see
 * and most likely to be congratulated for.
 */
function costsTheClimber(pending: PendingChoice, choiceId: string): boolean {
  const e = pending.event;
  if (e.interaction.kind === 'narration') return false;
  const choice = e.interaction.choices.find((c) => c.id === choiceId);
  if (!choice) return false;
  const onTheLadder = new Set(
    Object.entries(e.slots).filter(([, sp]) => sp.role === 'foremost').map(([id]) => id),
  );
  if (!onTheLadder.size) return false;
  return choice.outcomes.some((o) => o.effects.some(
    (f) => f.kind === 'madness' && f.delta > 0
      && typeof f.target === 'object' && 'slot' in f.target && onTheLadder.has(f.target.slot),
  ));
}

/**
 * Answer one docketed choice by the policy — but only when it is a bargain
 * about the ladder. Everything else in the game, Madness bargains included,
 * is the chronicler's in every column, for the reason `gate:blood` gives: a
 * second scripted decision would put a second difference between them.
 */
function answer(ctx: SimCtx, pending: PendingChoice, policy: LadderPolicy, rng: ReturnType<typeof makeRng>, tally: { asked: number; paid: number }): boolean {
  if (policy === 'chronicler' || !pending.choicesAreOpen) return false;
  const open = pending.choices.filter((c) => c.available);
  const costly = open.filter((c) => costsTheClimber(pending, c.id));
  const free = open.filter((c) => !costsTheClimber(pending, c.id));
  if (!costly.length) return false;   // not a ladder bargain; leave it

  tally.asked += 1;
  const want = policy === 'climb' ? costly[0] : free[0];
  if (!want) return false;
  if (policy === 'climb') tally.paid += 1;
  return resolveChoice(ctx, pending.id, want.id, rng).ok;
}

export function playOnce(bundle: Source, seed: number, years: number, policy: LadderPolicy, bid: number): LadderRun {
  const content = indexContent(bundle);
  const ctx = bootstrap(content, seed, 1042);
  const w = ctx.world;
  // The one standing order both columns share, so the shelf is the same size
  // in each. Without it the auction never spends and the books axis, not the
  // Madness axis, is what separates the columns.
  w.bidCeiling = bid;

  const tally = { asked: 0, paid: 0 };
  let peak: LadderRun | undefined;
  let madnessPeak = 0;
  let adeptYears = 0;
  let floorPaid = 0;
  let climberMadness = 0;

  for (let y = 0; y < years; y++) {
    if (w.year >= END_YEAR) break;
    stepYear(ctx, false);

    let guard = 0;
    while (w.pendingDecisions.length && guard++ < 200) {
      const rng = makeRng(hashSeed(seed, 'ladder-decide', w.year, guard));
      const choice = w.pendingDecisions.find((d): d is PendingChoice => d.kind === 'choice');
      if (choice && answer(ctx, choice, policy, rng, tally)) continue;
      autoResolveAll(ctx, rng);
    }
    clearNamingQueue(ctx);

    for (const p of w.people.household(w.playerHouse, w.year)) {
      if (!phenotypeOf(p, ctx.genetics, w.year).eldritch.canExpress) continue;
      const st = standingOf(ctx, p);
      madnessPeak = Math.max(madnessPeak, st.madness);
      if (rungIndex(st.rung) >= rungIndex('adept')) {
        adeptYears += 1;
        climberMadness = Math.max(climberMadness, st.madness);
        if (st.madness >= HIEROPHANT_FLOOR) floorPaid += 1;
      }
    }

    const top = foremostOf(ctx);
    if (!top) continue;
    const st = top.standing;
    const better = !peak
      || rungIndex(st.rung) > rungIndex(peak.best)
      || (rungIndex(st.rung) === rungIndex(peak.best) && st.power > peak.power);
    if (better) {
      peak = {
        seed, policy, best: st.rung, name: top.person.name, atYear: w.year,
        power: st.power, books: st.spells, affinities: st.affinities,
        madness: st.madness, mind: st.mind, madnessPeak: 0, blocked: st.blocked ?? '',
        asked: 0, paid: 0, adeptYears: 0, floorPaid: 0, climberMadness: 0,
      };
    }
  }

  const base: LadderRun = peak ?? {
    seed, policy, best: 'none', name: '-', atYear: w.year, power: 0, books: 0,
    affinities: 0, madness: 0, mind: 0, madnessPeak: 0, blocked: 'nobody of the house can express it',
    asked: 0, paid: 0, adeptYears: 0, floorPaid: 0, climberMadness: 0,
  };
  return { ...base, madnessPeak, adeptYears, floorPaid, climberMadness, asked: tally.asked, paid: tally.paid };
}

export interface LadderVerdict { ok: boolean; lines: string[] }

export function gateLadder(
  source: Source = loadContent(),
  opts: { seeds?: number[]; years?: number; bid?: number } = {},
): LadderVerdict {
  const bundle = indexContent(source);
  const seeds = opts.seeds ?? [4000, 4013, 4026, 4039, 4052, 4065];
  const years = opts.years ?? 1000;
  const bid = opts.bid ?? 600;

  const columns = (['climb', 'spare'] as const).map((policy) => ({
    policy,
    runs: seeds.map((s) => playOnce(bundle, s, years, policy, bid)),
  }));

  const mean = (rs: LadderRun[], f: (r: LadderRun) => number) => rs.reduce((a, r) => a + f(r), 0) / (rs.length || 1);
  const lines: string[] = [`gate (ladder): ${seeds.length} played runs x ${years} years, per policy`];
  const share = (rs: LadderRun[]) => mean(rs, (r) => r.floorPaid) / Math.max(1, mean(rs, (r) => r.adeptYears));
  for (const c of columns) {
    lines.push(
      `  ${c.policy.padEnd(6)} deepest Madness on a man ON THE LADDER ${mean(c.runs, (r) => r.climberMadness).toFixed(1).padStart(5)}`
      + `  ladder-years past the floor ${(100 * share(c.runs)).toFixed(0).padStart(3)}%`
      + `  bargains offered ${mean(c.runs, (r) => r.asked).toFixed(1).padStart(5)}`
      + `  best power ${mean(c.runs, (r) => r.power).toFixed(1).padStart(5)}`
      + `  books ${mean(c.runs, (r) => r.books).toFixed(1).padStart(4)}`,
    );
  }

  // THE CEILING, PRINTED AND NOT ASSERTED. #41's acceptance is "Adept is not
  // the modal ceiling", and where a run's ceiling lands is a seed: measured
  // over twenty played thousand-year runs the climbing column reaches
  // Hierophant in six and the sparing column in two, so at this gate's six
  // default seeds a floor on that share would be a coin. This repo does not
  // gate on seeds. What made the top of the ladder unreachable was arithmetic
  // — forty books asked of a game containing twenty-one — and arithmetic is
  // asserted in `ascension.test.ts`, deterministically, where it cannot flake.
  // This line is here so that a human reading a sweep can see the ceiling move.
  for (const c of columns) {
    const tally = new Map<Rung, number>();
    for (const r of c.runs) tally.set(r.best, (tally.get(r.best) ?? 0) + 1);
    lines.push(`  ${c.policy.padEnd(6)} best rung reached: `
      + [...tally].sort((a, b) => rungIndex(b[0]) - rungIndex(a[0]))
        .map(([r, n]) => `${r} ${n}`).join('  '));
  }

  const climb = columns[0]!.runs;
  const spare = columns[1]!.runs;
  const separates = mean(climb, (r) => r.climberMadness) > mean(spare, (r) => r.climberMadness);
  const paid = share(climb);
  const floorReached = paid >= FLOOR_SHARE_FLOOR;

  if (!separates) {
    lines.push('  FAIL: climbing and sparing leave the same Madness on the men standing on the ladder —'
      + ' the decision does not reach it');
  }
  if (!floorReached) {
    lines.push(`  FAIL: only ${(100 * paid).toFixed(0)}% of ladder-years in the climbing column have paid`
      + ` §22's Hierophant floor of ${HIEROPHANT_FLOOR} (floor ${(100 * FLOOR_SHARE_FLOOR).toFixed(0)}%)`);
  }
  lines.push(`  what stops the climbing column instead: ${[...new Set(climb.map((r) => r.blocked))].join(' | ')}`);
  return { ok: separates && floorReached, lines };
}

/**
 * A FLOOR AND NOT A TARGET, set the way gate 4's fire-rate floor was: far
 * enough below where the content stands that it never argues with an author,
 * close enough to matter before somebody quietly removes the last bargain.
 * Measured over twelve played thousand-year runs at the time of writing:
 *
 *     climb  deepest Madness on a man on the ladder 40.8   ladder-years past the floor 21%
 *     spare  deepest Madness on a man on the ladder  9.4   ladder-years past the floor  2%
 *
 * Five per cent is a quarter of where the climbing column stands and more
 * than twice where the sparing one does, which is the gap this is here to
 * keep open.
 *
 * Asserted of the climbing column only. A house whose player refuses every
 * bargain SHOULD arrive at the gate with a whole man and no Madness — that is
 * the bargain being real, and it is the control this gate is built around.
 */
const FLOOR_SHARE_FLOOR = 0.05;

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('ladder-gate.ts');
if (isMain) {
  const args = process.argv.slice(2);
  const runs = Number(args[0] ?? 6);
  const years = Number(args[1] ?? 1000);
  const bid = Number(args.find((a) => a.startsWith('--bid='))?.split('=')[1] ?? 600);
  const seeds = Array.from({ length: runs }, (_, i) => 4000 + i * 13);
  const { ok, lines } = gateLadder(loadContent(), { seeds, years, bid });
  for (const l of lines) console.log(l);
  process.exit(ok ? 0 : 1);
}
