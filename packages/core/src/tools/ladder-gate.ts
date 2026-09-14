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
 * Two things, and neither of them is a rung. `climb` must end with more
 * Madness on the man standing highest than `spare` does — that is the
 * mechanism, and asserting the mechanism rather than a seed is this repo's
 * own rule. And the Madness floor must stop being the thing that blocks the
 * fourth rung in the climbing column, because that is what the gate text
 * says is wrong.
 *
 * What blocks it INSTEAD is printed rather than judged. When this was
 * written, it was books and power, and that is a library and a genetics
 * question rather than this one.
 *
 * The ceiling each column reaches is printed for the same reason and asserted
 * for none: where one run's ladder stops is a seed, and this repo does not
 * gate on seeds. See the comment beside the line that prints it. The `scion`
 * column (below) is printed on the same reasoning, for the same reason.
 *
 * ─── A third column: `scion` (issue #61) ─────────────────────────────────────
 *
 * `climb` and `spare` differ in one verb — whether Madness bargains are taken.
 * `scion` differs from `spare` in a DIFFERENT one verb: whether the house has
 * named somebody to build the ladder on. It refuses every Madness bargain
 * exactly like `spare` does, so the gap between the two isolates naming a
 * scion rather than mixing it with the cost of climbing.
 *
 * Measured at the point this issue was picked up: seven of eight blockers in
 * the climbing column were the Vessel's power gate, missing by three to
 * fourteen points, and #61's own earlier measurement already priced
 * concentrating a WHOLE HOUSE's marriages at seven points at the ceiling over
 * many hundreds of weddings — almost exactly that gap. `nameScion` plays the
 * oracle a real player approximates: an attentive house always has SOMEBODY
 * named, and holds him for life rather than re-litigating the choice every
 * time a nephew edges ahead, which would spend the bias on a different man
 * every few years and concentrate nothing.
 *
 * `latePower` (see its own doc comment) is printed rather than asserted, and
 * the reason changed shape as the mechanism grew. Stage A (the marriage
 * alone) was small and steady: on twenty seeds outside the default set,
 * `scion` beat `spare` on 2, tied on 16, lost on 2 — a mean move under two
 * points, in a range this batch could not call but that never swung hard
 * either way. Stage B (the longest useful book, a term in mind, no post)
 * and Stage C (the cost, and the vacancy noticed) made the SAME comparison
 * far noisier rather than more decisive: on the same twenty seeds, `scion`
 * beat `spare` on 9, tied on 4, and lost on 7, with individual seeds moving
 * by as much as fifty points in either direction. The mean still edges
 * positive, barely. Concentrating everything onto one man raises the
 * ceiling he can reach when his book and his blood both land, and lowers it
 * when they do not, which is a different claim from Stage A's steadier one
 * and not a smaller one to prove — a bigger batch, not a bigger opinion,
 * is what would settle it. `table.test.ts` proves every piece of the
 * mechanism fires deterministically on its own; what no column here yet
 * shows is whether the variance nets out kindly over enough centuries, and
 * that is a claim for #85's own accumulation work to make, not this gate.
 */
import { loadContent } from '@ed/content';
import { indexContent, type Content, type ContentBundle, type Rung } from '@ed/schema';
import { bootstrap, clearNamingQueue } from '../sim.js';
import { stepYear } from '../year/step.js';
import { makeRng, hashSeed } from '../rng.js';
import {
  autoResolveAll, resolveChoice, type PendingChoice,
} from '../events/decisions.js';
import { eldritchPower, foremostOf, rungIndex, standingOf } from '../ascension.js';
import { phenotypeOf } from '../people/factory.js';
import { END_YEAR } from '../ending.js';
import type { SimCtx } from '../world.js';

type Source = ContentBundle | Content;

export type LadderPolicy = 'climb' | 'spare' | 'chronicler' | 'scion';

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
  /**
   * THE BEST POWER SEEN FROM `LATE_WARMUP_YEAR` ON (issue #61, Stage A) —
   * deliberately NOT the same number as `power`, and the difference is the
   * whole reason this field exists.
   *
   * `power` is the best power at the house's ALL-TIME peak rung, and issue
   * #85 already measured where that peak sits: inside the first 8% of the
   * game, set by the founding generation's already-fixed marriages, before
   * the house has a second generation of cousins for ANY marriage policy to
   * concentrate onto. Measured while building this column: `scion` and
   * `spare` produced BYTE-IDENTICAL `power` on all eight default seeds — not
   * close, identical to four decimal places — because the formative marriage
   * in a two-generation-old house usually has no household card on offer at
   * all, so a bias toward household cards has nothing to bias. That is not
   * the mechanism failing; it is `power` measuring a year the mechanism
   * cannot yet have touched.
   *
   * So this tracks the same peak, but only from the point a family the size
   * of a real dynasty could plausibly have grown a bench of cousins to marry
   * — §22's own Hierophant timing (generation 10-15) is the reference.
   */
  latePower: number;
}

/** §22's Hierophant Madness floor, from `gateFor`. */
const HIEROPHANT_FLOOR = 20;

/**
 * WHEN A MARRIAGE POLICY HAS SOMETHING TO WORK WITH (issue #61, Stage A).
 * §22 targets Hierophant at generation 10-15, roughly 250-375 years past
 * 1042 at this world's marriage age — 300 splits that band. `latePower`
 * is measured only from here, so a founding-generation marriage neither
 * column could have influenced does not stand in for the mechanism.
 */
const LATE_WARMUP_YEARS = 300;

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
  // A `rite` counts, and it is not an afterthought: §22's Vessel transfers the
  // consumed relative's Madness into the ascendant in full and uncapped, so it
  // is the single largest thing the ladder ever asks of the man climbing it
  // (issue #43). It carries no `madness` effect to recognise it by, because
  // how much arrives is a fact about two people rather than an authored number.
  return choice.outcomes.some((o) => o.effects.some(
    (f) => (f.kind === 'madness' && f.delta > 0
      && typeof f.target === 'object' && 'slot' in f.target && onTheLadder.has(f.target.slot))
      || (f.kind === 'rite' && onTheLadder.has(f.ascendant)),
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

/**
 * THE SCION COLUMN'S ONE VERB. Names whoever the house is building the ladder
 * on — an attentive player's standing order, played the way `gate:blood`
 * plays `marry_in`: set once by a rule over the state rather than answered
 * choice by choice.
 *
 * Holds the role for life once given. Renaming to whoever gained a point this
 * year would spend the marriage bias on a different man every few years and
 * concentrate nothing — the same reasoning the order's own doc comment gives
 * for why the game does not do this automatically either.
 *
 * PREFERS SOMEBODY NOT YET MARRIED, and this is not a minor tie-break: the
 * first cut of this column ranked by raw power alone and measured BYTE
 * IDENTICAL to `spare` — 61.8 in both, to one decimal, across eight seeds.
 * The reason was in the trace rather than the arithmetic. Naming only
 * fires when the previous scion is gone, so by the time it fires the
 * candidate has usually spent his whole adult life already married under
 * whatever policy stood before he was ever named — the override arrives
 * having missed the one decision it exists to change. Measured over one
 * seed to 1000 years: the power-only rule produced ONE scion marriage the
 * order could still act on; preferring the unmarried produced nine, several
 * of them cousins the family would otherwise have spent on the open market.
 * An attentive house does not wait for a man to become available to be
 * remarkable; it names the boy.
 */
function nameScion(ctx: SimCtx): void {
  const w = ctx.world;
  const current = w.scion ? w.people.get(w.scion) : undefined;
  const stillHere = current?.status === 'alive'
    && w.people.household(w.playerHouse, w.year).some((q) => q.id === current.id);
  if (stillHere) return;

  const expressers = w.people.household(w.playerHouse, w.year)
    .filter((p) => phenotypeOf(p, ctx.genetics, w.year).eldritch.canExpress);
  const unmarried = expressers.filter((p) => !p.marriages.some((m) => !m.to));
  const pool = unmarried.length ? unmarried : expressers;
  w.scion = pool.length
    ? [...pool].sort((a, b) =>
      eldritchPower(ctx, b) - eldritchPower(ctx, a) || (a.id < b.id ? -1 : 1))[0]!.id
    : null;
}

export function playOnce(bundle: Source, seed: number, years: number, policy: LadderPolicy, bid: number): LadderRun {
  const content = indexContent(bundle);
  const ctx = bootstrap(content, seed, 1042);
  const w = ctx.world;
  // The one standing order both columns share, so the shelf is the same size
  // in each. Without it the auction never spends and the books axis, not the
  // Madness axis, is what separates the columns.
  w.bidCeiling = bid;

  const startYear = w.year;
  const tally = { asked: 0, paid: 0 };
  let peak: LadderRun | undefined;
  let madnessPeak = 0;
  let adeptYears = 0;
  let floorPaid = 0;
  let climberMadness = 0;
  let latePower = 0;

  for (let y = 0; y < years; y++) {
    // The term, or the line running out before it (issue #42) — either stops
    // `stepYear` from turning the year on its own; this loop has no reason to
    // keep calling it once that has happened.
    if (w.year >= END_YEAR || w.ending) break;
    if (policy === 'scion') nameScion(ctx);
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
    if (w.year - startYear >= LATE_WARMUP_YEARS) {
      latePower = Math.max(latePower, st.power);
    }
    const better = !peak
      || rungIndex(st.rung) > rungIndex(peak.best)
      || (rungIndex(st.rung) === rungIndex(peak.best) && st.power > peak.power);
    if (better) {
      peak = {
        seed, policy, best: st.rung, name: top.person.name, atYear: w.year,
        power: st.power, books: st.spells, affinities: st.affinities,
        madness: st.madness, mind: st.mind, madnessPeak: 0, blocked: st.blocked ?? '',
        asked: 0, paid: 0, adeptYears: 0, floorPaid: 0, climberMadness: 0, latePower: 0,
      };
    }
  }

  const base: LadderRun = peak ?? {
    seed, policy, best: 'none', name: '-', atYear: w.year, power: 0, books: 0,
    affinities: 0, madness: 0, mind: 0, madnessPeak: 0, blocked: 'nobody of the house can express it',
    asked: 0, paid: 0, adeptYears: 0, floorPaid: 0, climberMadness: 0, latePower: 0,
  };
  return {
    ...base, madnessPeak, adeptYears, floorPaid, climberMadness, latePower, asked: tally.asked, paid: tally.paid,
  };
}

/**
 * WHICH TEMPLATES A HOUSE THAT PLAYS FOR THE LADDER EVER SEES (issue #64).
 *
 * The fire-rate gate plays the chronicler, and the chronicler never climbs. So
 * an event cast on a living Hierophant — the rites, most obviously — is
 * unreachable to that batch BY DESIGN, and a gate that convicted on it would
 * send the next person to loosen conditions that are correct. Measured when
 * the issue was filed: `the_vessel_rite`, `the_vessel_remembered` and
 * `the_unmaking` were all on the never-fired list, and all three fire fine
 * under a policy that climbs.
 *
 * This is the acquittal pass. It is deliberately NOT part of the main batch —
 * playing 250 runs by policy costs what `gate:ladder` costs and buys nothing
 * in the healthy case, because nothing is failing. It runs only over the
 * templates the chronicler batch could not reach, which is normally none.
 */
export function firedUnderClimbing(source: Source, seeds: number[], years: number, bid = 900): Set<string> {
  const fired = new Set<string>();
  for (const seed of seeds) {
    const ctx = playForFires(source, seed, years, bid);
    for (const [id, n] of Object.entries(ctx.world.frequency.templateFires)) {
      if (n > 0) fired.add(id);
    }
  }
  return fired;
}

/** `playOnce`'s loop, kept to the part that matters here: the world afterwards. */
function playForFires(source: Source, seed: number, years: number, bid: number): SimCtx {
  const ctx = bootstrap(indexContent(source), seed, 1042);
  const w = ctx.world;
  w.bidCeiling = bid;
  const tally = { asked: 0, paid: 0 };

  for (let y = 0; y < years; y++) {
    if (w.year >= END_YEAR || w.ending) break;
    stepYear(ctx, false);
    let guard = 0;
    while (w.pendingDecisions.length && guard++ < 200) {
      const rng = makeRng(hashSeed(seed, 'ladder-decide', w.year, guard));
      const choice = w.pendingDecisions.find((d): d is PendingChoice => d.kind === 'choice');
      if (choice && answer(ctx, choice, 'climb', rng, tally)) continue;
      autoResolveAll(ctx, rng);
    }
    clearNamingQueue(ctx);
  }
  return ctx;
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

  const columns = (['climb', 'spare', 'scion'] as const).map((policy) => ({
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
      + `  late power ${mean(c.runs, (r) => r.latePower).toFixed(1).padStart(5)}`
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
  const scion = columns[2]!.runs;
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
  // NAMING A SCION, PRINTED AND NOT ASSERTED — the same choice this file
  // already makes for the ceiling each column reaches, and for the same
  // reason. See the header comment above for the fuller measurement: the
  // full mechanism (marriage, books, mind, no post, the cost) is noisier
  // than Stage A's marriage-only cut was, not steadier — on twenty seeds
  // outside the default set, `scion` beat `spare` on `latePower` by 9 of
  // 20, tied on 4, lost on 7, with single seeds moving fifty points either
  // way. Concentrating everything the house has onto one man raises what he
  // can reach when it lands and lowers it when it does not; `table.test.ts`
  // proves every piece fires deterministically, so what is uncertain is
  // whether the variance nets out kindly over enough centuries — a question
  // for a much larger batch, not for whether the mechanism exists.
  lines.push(`  scion  best power from year ${LATE_WARMUP_YEARS} on: `
    + `${mean(scion, (r) => r.latePower).toFixed(1)} vs spare's ${mean(spare, (r) => r.latePower).toFixed(1)}`
    + ' (not asserted — see the comment above this line)');
  lines.push(`  what stops the climbing column instead: ${[...new Set(climb.map((r) => r.blocked))].join(' | ')}`);
  lines.push(`  what stops the scion column instead: ${[...new Set(scion.map((r) => r.blocked))].join(' | ')}`);
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
