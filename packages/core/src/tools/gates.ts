/**
 * CI GATES — checks that are only worth writing once the thing they guard
 * exists, so each subcommand lands in the commit that makes it non-vacuous
 * (issue #6) rather than being authored speculatively against a shape that
 * might still change.
 *
 *   npx tsx packages/core/src/tools/gates.ts <subcommand>
 *
 * Every subcommand prints what it measured and exits non-zero on failure, so
 * CI can call it directly.
 *
 * EVERY GATE IS A FUNCTION OVER A BUNDLE, and returns its verdict rather than
 * printing it. That is not tidiness: a gate nobody has ever seen fail is
 * indistinguishable from a gate that cannot fail, and the only way to tell the
 * two apart is to hand one a bundle it must reject and watch it do so. The
 * slow gates take their sample size as an argument for the same reason —
 * `gates.test.ts` runs them at two seeds and five years, which is far too
 * small to mean anything about the game and exactly the right size to prove
 * the gate still has teeth.
 */
import { loadContent } from '@ed/content';
import { indexContent, validateBundle, type Content, type ContentBundle } from '@ed/schema';
import { bootstrap, runYears } from '../sim.js';
import { TEST_FAMILIES } from './testFamilies.js';
import { resolveSlots } from '../events/slots.js';
import { makeRng } from '../rng.js';
import { declaredOutcomes, emptyReach, readRun, type Reach } from '../events/reach.js';
import { firedUnderClimbing, gateLadder } from './ladder-gate.js';
import { MADNESS_FLOOR, MIND_FLOOR, madnessOf, mindOf, standingOf } from '../ascension.js';
import type { Rung } from '@ed/schema';
import { phenotypeOf } from '../people/factory.js';

const SEEDS = Array.from({ length: 12 }, (_, i) => 1000 + i * 7);

/** What a gate hands back: the verdict, and the lines it would have printed. */
export interface GateResult {
  ok: boolean;
  lines: string[];
}

type Source = ContentBundle | Content;

/**
 * GATE 2 — slot-fillability (issue #22). Non-vacuous only once the test
 * families exist: a template's slots either can or cannot be cast, and that
 * question was previously only ever answered by accident, whenever a real
 * simulated run happened to reach a household shaped right for it. This asks
 * it directly, against six households at the edges of the space — a template
 * that cannot cast against ANY of them is starved quietly, for as long as
 * nobody's run happens to look like one of these, which the fire-rate gate
 * (4) will eventually notice and this gate exists to catch earlier.
 *
 * Age scoping and `conditions` are deliberately NOT checked here — that is
 * frequency/condition gating, already this file's and `rules.ts`'s business.
 * This asks the narrower question underneath it: if the moment ever comes,
 * is there anyone to cast?
 */
export function gateSlotFillability(source: Source = loadContent()): GateResult {
  const bundle = indexContent(source);
  const dead: string[] = [];

  for (const e of bundle.events) {
    if (e.arc) continue; // arc nodes cast from their own binding, not the ambient pool
    if (!Object.keys(e.slots).length) continue; // nothing to fill

    const fillable = TEST_FAMILIES.some((fam) => resolveSlots(e, fam.build(bundle), makeRng(1)).ok);
    if (!fillable) dead.push(String(e.id));
  }

  const lines = [`gate 2 (slot-fillability): ${bundle.events.length} events x ${TEST_FAMILIES.length} fixtures`];
  if (dead.length) {
    lines.push(`  FAIL: ${dead.length} event(s) cannot cast against any test family:`);
    for (const id of dead) lines.push(`    ${id}`);
  }
  return { ok: dead.length === 0, lines };
}

/**
 * GATE 7 — the clause gate (issue #4). Per-Age assignment means which
 * clauses a run recovers now depends on which Ages it drew; the floor this
 * protects is the design's own — a run that reaches 2042 having recovered
 * three clauses should be rarer than the median, and the God rung (seven of
 * nine) needs the median run within striking distance of it.
 */
export function gateClauses(
  source: Source = loadContent(),
  opts: { seeds?: number[]; years?: number; floor?: number } = {},
): GateResult {
  const bundle = indexContent(source);
  const seeds = opts.seeds ?? SEEDS;
  const years = opts.years ?? 1000;
  const floor = opts.floor ?? 6;

  const counts = seeds.map((seed) => {
    const ctx = bootstrap(bundle, seed, 1042);
    runYears(ctx, years);
    return ctx.world.clausesRecovered.size;
  });
  const sorted = [...counts].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const ok = median >= floor;

  const lines = [`gate 7 (clauses): median ${median} of 9 recovered across ${seeds.length} runs — [${sorted.join(', ')}]`];
  if (!ok) lines.push(`  FAIL: median must be at least ${floor} of 9`);
  return { ok, lines };
}

/**
 * GATE 4 — fire rate, the important one. `arcs.slow.test.ts` only asserts
 * each event fires at LEAST ONCE across a whole batch; that catches an event
 * with zero live paths but says nothing about an event four hundred people
 * will never see. This is the difference between shipping 400 events and
 * shipping 400 events the player actually encounters.
 *
 * A full 1000-year span, not a truncated one: generation- and Age-gated
 * content (mythic events at `minGeneration: 8`, an Age with `earliestYear:
 * 1250`) only gets a fair chance to fire across the whole run, and cutting
 * years short would undercount them for a reason that has nothing to do with
 * whether they are too rare. "Fast" here means a lean per-run measurement —
 * template fires only, none of the harness's other bookkeeping — run at 100
 * seeds rather than 12, wide enough that "under 0.5%" means something.
 *
 * Baseline measured 2026-08-11: the rarest authored event fires in 16.7% of
 * runs (12 seeds) and nothing fires in none; the 0.5% floor is not currently
 * binding on anything, which is the correct state for a guard — it exists for
 * the four hundredth event, not the twenty-seventh.
 */
/**
 * ONE BATCH, READ BY BOTH GATES (issue #64).
 *
 * Gate 4 and gate 8 were bootstrapping the SAME seeds — `5000 + i * 7` — for
 * the same thousand years, each throwing away everything the other wanted.
 * Measured: gate 4 alone was 342 seconds at 100 runs, and gate 8 plays 250 of
 * the identical runs beside it.
 *
 * Sharing the pass is worth more than the minutes. It lets gate 4 read the
 * batch gate 8 already pays for, and a fire-rate zero only means anything at a
 * batch size that can tell "never" apart from "rarely" — see `gateFireRate`.
 */
interface Batch {
  runs: number;
  /** Runs in which each template fired at least once. */
  templateRuns: Map<string, number>;
  /** Runs in which each outcome resolved, and firings per choice. */
  reach: Reach;
}

/**
 * Keyed on the SOURCE object rather than the index: `indexContent` returns a
 * fresh index for a bundle every time it is called, so keying on the result
 * would never hit. One entry, because the gates run back to back on the same
 * content and holding several batches of counts is memory nobody asked for.
 */
let lastBatch: { source: Source; runs: number; years: number; batch: Batch } | null = null;

function playBatch(source: Source, runs: number, years: number): Batch {
  if (lastBatch
    && lastBatch.source === source
    && lastBatch.runs === runs
    && lastBatch.years === years) {
    return lastBatch.batch;
  }

  const content = indexContent(source);
  const batch: Batch = { runs, templateRuns: new Map(), reach: emptyReach() };
  for (let i = 0; i < runs; i++) {
    const ctx = bootstrap(content, 5000 + i * 7, 1042);
    runYears(ctx, years);
    for (const [id, n] of Object.entries(ctx.world.frequency.templateFires)) {
      if (n > 0) batch.templateRuns.set(id, (batch.templateRuns.get(id) ?? 0) + 1);
    }
    readRun(ctx, batch.reach);
  }

  lastBatch = { source, runs, years, batch };
  return batch;
}

export function gateFireRate(
  source: Source = loadContent(),
  opts: { runs?: number; years?: number; floorPct?: number; climbRuns?: number } = {},
): GateResult {
  const bundle = indexContent(source);
  // 250, matching gate 8, because the two now play ONE batch between them —
  // and because a zero has to mean something. Rule of three: nothing seen in
  // N runs has a 95% upper bound of 3/N, so a zero at 100 runs bounds the true
  // rate at 3% and the game's rarest LIVE template (`the_unmaking`) sits at 2%.
  // At 100 the gate could not tell dead content from the rarest working
  // content, and had a one-in-eight chance of failing CI on `the_unmaking`
  // alone every time it ran. At 250 the bound is 1.2% and a zero is evidence.
  const runs = opts.runs ?? 250;
  const years = opts.years ?? 1000;
  const floorPct = opts.floorPct ?? 0.5;

  const seenIn = playBatch(source, runs, years).templateRuns;

  const rates = bundle.events
    .filter((e) => e.tier !== 'frame')
    .map((e) => ({ id: String(e.id), pct: (100 * (seenIn.get(String(e.id)) ?? 0)) / runs }))
    .sort((a, b) => a.pct - b.pct);

  const suspect = rates.filter((r) => r.pct < floorPct);
  const lines = [`gate 4 (fire rate): ${runs} runs x ${years}y — rarest of ${rates.length} non-frame events:`];
  for (const r of rates.slice(0, 5)) lines.push(`    ${r.id.padEnd(34)} ${r.pct}%`);

  // THE BATCH ABOVE IS THE CHRONICLER, AND THE CHRONICLER NEVER CLIMBS
  // (issue #64).
  //
  // An event cast on a living Hierophant is unreachable to a passive house BY
  // DESIGN — the rites are the plain case, and all three were on the original
  // never-fired list while being entirely correct events doing an entirely
  // correct thing. Convicting on that sends the next person to loosen a
  // condition that is right, which is the one outcome this gate must never
  // produce.
  //
  // So a zero here is an accusation, not a verdict: anything the chronicler
  // could not reach is replayed under a policy that PLAYS for the ladder, and
  // only a template that fires for nobody under either is dead. A template
  // that fires only when somebody plays for it is in the game.
  //
  // The second pass is skipped entirely when nothing is accused, which is the
  // normal case — it costs what `gate:ladder` costs, and buys nothing against
  // a healthy bundle.
  const failing: { id: string; pct: number }[] = [];
  let acquitted: string[] = [];
  if (suspect.length) {
    const climbRuns = opts.climbRuns ?? CLIMB_ACQUIT_RUNS;
    const climbSeeds = Array.from({ length: climbRuns }, (_, i) => 4000 + i * 13);
    const climbed = firedUnderClimbing(source, climbSeeds, years);
    for (const f of suspect) {
      if (climbed.has(f.id)) acquitted.push(f.id);
      else failing.push(f);
    }
  }

  if (acquitted.length) {
    lines.push(`  ${acquitted.length} reached only by a house that plays for the ladder, which counts as reachable:`);
    for (const id of acquitted) lines.push(`    ${id}`);
  }
  if (failing.length) {
    lines.push(`  FAIL: ${failing.length} event(s) fire in under ${floorPct}% of runs, under the chronicler`);
    lines.push(`        AND in ${opts.climbRuns ?? CLIMB_ACQUIT_RUNS} runs played for the ladder:`);
    for (const f of failing) lines.push(`    ${f.id}: ${f.pct}%`);
  }
  return { ok: failing.length === 0, lines };
}

/**
 * How many played runs the acquittal pass gets (issue #64).
 *
 * Small on purpose, and it is not the same kind of number as the 250 above.
 * That batch has to tell "never" from "rarely" and needs the rule of three
 * behind it. This one only has to find ONE firing of a template the chronicler
 * already failed to reach — and the rites, the case it exists for, were
 * offered three times in eight played runs when this was measured. A template
 * that cannot manage one firing in twelve deliberate runs is not being
 * rationed by policy.
 */
const CLIMB_ACQUIT_RUNS = 12;

/**
 * GATE 6 — purposes. Both halves are content-validation rules, already
 * enforced as errors by `npm run validate`; this subcommand exists so CI (or
 * an author) can call the purpose gate on its own, without the rest of the
 * content rules, the same way the other numbered gates are addressable.
 *
 *   `event/purposes`        — every template names exactly three purposes.
 *   `event/purpose-overlap` — no three templates share all three.
 */
export function gatePurposes(source: Source = loadContent()): GateResult {
  const issues = validateBundle(indexContent(source), ['event/purposes', 'event/purpose-overlap']);
  const lines = [`gate 6 (purposes): ${issues.length} issue(s)`];
  for (const i of issues) lines.push(`    [${i.rule}] ${i.where}: ${i.message}`);
  return { ok: issues.length === 0, lines };
}

/**
 * GATE 8 — outcome reach. Gate 4 asks whether an EVENT is ever seen; this
 * asks whether every BRANCH of it is, which is a different question and the
 * one authoring actually gets wrong. An event can fire in 85% of runs and
 * still have a choice nobody has ever been offered and an outcome nobody has
 * ever read — and the failure is silent in the exact way this codebase
 * specialises in, because the event's fire rate looks healthy from outside.
 *
 * `outcomes/weights` in `rules.ts` already refuses outcomes that are
 * STATICALLY impossible. Nothing this gate catches is static: a choice's
 * `requires` reads attributes off the people cast in the moment, and a check's
 * bands are cleared or not by a population the simulation produces. The only
 * instrument for those is a run.
 *
 * No new bookkeeping: `world.decisionLog` already records `{event, choiceId,
 * outcomeId}` at every commit, because replay (issue #8) needed it to.
 *
 * SAMPLE SIZE IS THE WHOLE DESIGN. At 30 runs this gate flags outcomes that
 * are merely rare — `hold_the_gate -> driven_off` resolves in 11% of runs and
 * looked dead at 30. 100 runs is gate 4's own sample and the smallest one
 * where "never" means never.
 */
/**
 * HOW MANY TIMES AN OUTCOME MUST HAVE BEEN EXPECTED BEFORE A ZERO CONVICTS.
 *
 * A zero is evidence in proportion to how many chances were taken. If an
 * outcome should have resolved `e` times, the chance it resolved none is
 * about `exp(-e)`: at 3 that is 5%, at 5 it is under 1%. Five is the number
 * because this gate makes 872 of these judgements at once — at 5% each, a
 * few dozen marginal outcomes would produce a spurious red most runs, which
 * is the whole failure this constant exists to end.
 */
const PROOF_EXPECTED = 5;

/** What a zero can support, and the sentence explaining why. */
export type ZeroVerdict =
  | { kind: 'dead'; why: string }
  | { kind: 'unproven'; why: string };

/**
 * SORT ONE ZERO BY WHAT IT CAN ACTUALLY SUPPORT (issue #80).
 *
 * Pulled out of the gate and exported because the branch that matters most —
 * an outcome with plenty of chances that took none of them — cannot be
 * provoked from content at all. Weights are authored, so a choice that fires
 * often WILL land on every outcome under it unless the roller itself is
 * broken; that branch is a guard against an engine bug, and the only way to
 * see it fail is to hand it the numbers directly.
 *
 * `fired` is the parent choice's firings across the whole batch, `share` the
 * outcome's normalised weight within that choice.
 */
export function judgeZeroReach(fired: number, share: number, runs: number): ZeroVerdict {
  if (fired === 0) {
    return { kind: 'dead', why: `its choice never fired in ${runs} runs` };
  }
  const expected = fired * share;
  if (expected >= PROOF_EXPECTED) {
    return { kind: 'dead', why: `expected ~${expected.toFixed(1)} of ${fired} firings, resolved none` };
  }
  // Linear in runs: firings scale with the batch, so this is the size at which
  // a zero here would actually mean something.
  const needed = Math.ceil((runs * PROOF_EXPECTED) / Math.max(expected, 1e-9));
  return {
    kind: 'unproven',
    why: `only ~${expected.toFixed(1)} expected of ${fired} firings; would need ~${needed} runs to prove`,
  };
}

export function gateOutcomeReach(
  source: Source = loadContent(),
  opts: { runs?: number; years?: number } = {},
): GateResult {
  const bundle = indexContent(source);
  // 250, not 100, and this is a power calculation rather than a preference.
  //
  // The gate asserts that EVERY authored outcome resolves at least once, over
  // 872 of them. The distribution has a long tail: an ending under one branch
  // of a template that reaches three per cent of runs is about one expected
  // resolution in a hundred, so on any given measurement several outcomes sit
  // at one or two expected hits and roughly a third of those show zero. Which
  // ones is decided by the draw, so every content change anywhere in the game
  // reshuffles the casualties — across one afternoon this gate named nine
  // different "never resolves" outcomes in nine consecutive runs, on content
  // that was getting steadily healthier, and four of the nine were the heavier
  // half of their own branch.
  //
  // 250 runs makes that rarer. It does not make it go away, and for a while
  // this gate treated `pct === 0` as proof anyway — see below.
  const runs = opts.runs ?? 250;
  const years = opts.years ?? 1000;

  const declared = declaredOutcomes(bundle);
  const reach = playBatch(source, runs, years).reach;

  const rates = [...declared]
    .map(([key, o]) => ({ o, pct: (100 * (reach.runs.get(key) ?? 0)) / runs }))
    .sort((a, b) => a.pct - b.pct);

  /**
   * ── WHAT A ZERO IS ALLOWED TO MEAN (issue #80) ────────────────────────────
   *
   * `pct === 0` used to be the entire verdict, and it convicted an outcome
   * this gate had barely asked about. `the_match_that_never_comes/counter ->
   * opened` failed a build at weight 20 of 100 under a choice reached seven
   * times in 250 runs: seven chances, a 21% chance of showing zero, and it
   * showed zero. The same outcome reaches 1.2% on the commit before, and the
   * only thing that changed between them was 177 lines of unrelated content
   * re-rolling every draw in the game — BALANCE-LOG's headline, arriving as a
   * red build with a content id on it.
   *
   * That is worse than noise. A gate whose red is routinely explained away is
   * a gate that will have a genuinely dead outcome explained away too.
   *
   * So a zero is now sorted by what it can support, which needs the one number
   * the old shape threw away: how many chances the outcome actually had.
   *
   *   the choice never fired at all  → DEAD. Nobody was ever offered it, and
   *                                    that is the more serious finding, which
   *                                    the old shape could not tell apart.
   *   expected >= PROOF_EXPECTED     → DEAD. It should have landed five times.
   *   expected <  PROOF_EXPECTED     → UNPROVEN. Says so, names the batch size
   *                                    that would settle it, and does not fail.
   *
   * This is `expectRate`'s contract — assert the claim AND that the batch can
   * carry it, and fail with the batch size that would — applied to a gate that
   * had the reasoning in its comment and `=== 0` in its code.
   */
  const dead: string[] = [];
  const unproven: string[] = [];

  for (const { o, pct } of rates) {
    if (pct > 0) continue;
    const verdict = judgeZeroReach(reach.firings.get(o.choice) ?? 0, o.share, runs);
    (verdict.kind === 'dead' ? dead : unproven).push(`${o.label}  — ${verdict.why}`);
  }

  const lines = [`gate 8 (outcome reach): ${runs} runs x ${years}y — rarest of ${rates.length} authored outcomes:`];
  for (const r of rates.slice(0, 5)) lines.push(`    ${r.o.label.padEnd(52)} ${r.pct}%`);
  if (unproven.length) {
    // Reported every time, never fatal. An outcome that lives here for several
    // commits running is a real finding — it means the content can barely be
    // reached — and it is invisible unless the gate says so out loud.
    lines.push(`  ${unproven.length} outcome(s) too rare for ${runs} runs to judge:`);
    for (const u of unproven) lines.push(`    ${u}`);
  }
  if (dead.length) {
    lines.push(`  FAIL: ${dead.length} outcome(s) never resolve:`);
    for (const d of dead) lines.push(`    ${d}`);
  }
  return { ok: dead.length === 0, lines };
}

/**
 * GATE 9 — A LADDER GATE WITH NO KEY (issue #61).
 *
 * §22's mind and Madness floors were written in prose on a 0-100 scale and
 * compared against raw attribute values topping out near 81 and 35. Measured:
 * **0.00% of 1,273 sampled expressers cleared the Vessel's `mind >= 70`**, and
 * the Demigod's `madness >= 60` and God's 90 were above the maximum the
 * simulation had ever produced. Rungs four, five and six had never been held
 * by anybody, so Apotheosis — the ending on the box — had never fired.
 *
 * It typechecked forever, which is the point. A gate nobody clears is a gate
 * nobody notices: the ladder simply stops, quietly, at rung three, and the
 * game plays.
 *
 * This asks the question that would have caught it, and asks it of the
 * population rather than of the prose: **is each floor cleared by somebody?**
 * Not "does the number look right" — a number cannot look wrong when the scale
 * it belongs to is somewhere else.
 *
 * It reads `MIND_FLOOR` and `MADNESS_FLOOR` off `ascension.ts` rather than
 * restating them, because a gate holding its own copy of "the Vessel wants 70"
 * is the same class of bug one layer out.
 */
export function gateLadderScales(
  source: Source = loadContent(),
  opts: {
    runs?: number;
    years?: number;
    every?: number;
    /**
     * The floors to judge, defaulting to §22's. Overridable so `gates.test.ts`
     * can hand this a rung gate nobody can clear and watch it refuse —
     * normalising made the real floors scale-INVARIANT, which is the point of
     * them and also means no edit to `attributes.yaml` can produce the failure
     * this gate exists to catch. The judgement is the thing under test.
     */
    mindFloor?: Partial<Record<Rung, number>>;
    madnessFloor?: Partial<Record<Rung, number>>;
  } = {},
): GateResult {
  const content = indexContent(source);
  const mindFloors = opts.mindFloor ?? MIND_FLOOR;
  const madnessFloors = opts.madnessFloor ?? MADNESS_FLOOR;
  const runs = opts.runs ?? 8;
  const years = opts.years ?? 1000;
  // Sampled through the run rather than at the end: a man who stood at
  // Hierophant in 1400 and died in 1440 is not in the household at 2042, and
  // the whole question is what the population PRODUCED.
  const every = opts.every ?? 25;

  const minds: number[] = [];
  const madnesses: number[] = [];
  /** How many person-samples ever stood on each rung. */
  const held = new Map<Rung, number>();
  for (let i = 0; i < runs; i++) {
    const ctx = bootstrap(content, 5000 + i * 7, 1042);
    for (let y = 0; y < years; y += every) {
      runYears(ctx, Math.min(every, years - y));
      for (const p of ctx.world.people.living()) {
        if (!phenotypeOf(p, ctx.genetics, ctx.world.year).eldritch.canExpress) continue;
        minds.push(mindOf(ctx, p));
        madnesses.push(madnessOf(ctx, p));
        const r = standingOf(ctx, p).rung;
        held.set(r, (held.get(r) ?? 0) + 1);
      }
    }
  }

  const share = (values: number[], floor: number) =>
    (values.length ? 100 * values.filter((v) => v >= floor).length / values.length : 0);

  const lines = [
    `gate 9 (ladder scales): ${runs} runs x ${years}y — ${minds.length} expresser-samples`,
  ];
  const dead: string[] = [];
  const unproven: string[] = [];

  /**
   * ── WHAT A ZERO IS ALLOWED TO MEAN HERE (the same rule as gate 8) ─────────
   *
   * A floor nobody clears is the bug this gate exists for — but only when
   * somebody actually stood on the rung BELOW it. The ladder is a chain, and
   * madness above Hierophant is PURCHASED (§10) through the rites the upper
   * rungs themselves unlock: if nobody reaches Demigod, God's Madness floor
   * has not been tested, it has been starved. Failing on it would blame the
   * scale for something downstream of it, and send the next person to loosen a
   * number that is right.
   *
   * So a zero convicts only where the rung beneath it is populated.
   */
  const below: Partial<Record<Rung, Rung>> = {
    hierophant: 'adept', vessel: 'hierophant', demigod: 'vessel', god: 'demigod',
  };
  const judge = (rung: string, what: string, floor: number, pct: number) => {
    lines.push(`    ${rung.padEnd(11)} wants ${what} ${String(floor).padStart(2)} — ${pct.toFixed(1)}% of expressers reach it`);
    if (pct > 0) return;
    const under = below[rung as Rung];
    const standing = under ? held.get(under) ?? 0 : 1;
    if (standing > 0) dead.push(`${rung}: ${what} >= ${floor} is cleared by nobody, and ${standing} stood at ${under}`);
    else unproven.push(`${rung}: ${what} >= ${floor} untested — nobody ever stood at ${under}`);
  };

  for (const [rung, floor] of Object.entries(mindFloors)) judge(rung, 'mind', floor!, share(minds, floor!));
  for (const [rung, floor] of Object.entries(madnessFloors)) {
    judge(rung, 'madness', floor!, share(madnesses, floor!));
  }

  lines.push(`    rungs actually held: ${[...held].map(([r, n]) => `${r} ${n}`).join(' · ')}`);
  if (unproven.length) {
    lines.push(`  ${unproven.length} floor(s) the ladder never got far enough to test:`);
    for (const u of unproven) lines.push(`    ${u}`);
  }
  if (dead.length) {
    lines.push(`  FAIL: ${dead.length} rung gate(s) nobody can clear:`);
    for (const d of dead) lines.push(`    ${d}`);
  }
  return { ok: dead.length === 0, lines };
}

export const GATES: Record<string, (source?: Source) => GateResult> = {
  clauses: gateClauses,
  'fire-rate': gateFireRate,
  // Issue #41. The only gate here that PLAYS — two columns one verb apart —
  // because the question it asks is about the player and `runYears` is the
  // chronicler. It lives in `ladder-gate.ts` with its own sweep entry point
  // (`npm run gate:ladder`), and is registered here because a gate outside
  // this table is a gate CI does not run.
  ladder: gateLadder,
  'ladder-scales': gateLadderScales,
  'outcome-reach': gateOutcomeReach,
  purposes: gatePurposes,
  'slot-fillability': gateSlotFillability,
};

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('gates.ts');
if (isMain) {
  const name = process.argv[2];

  // No argument means all of them — `npm run gate`, which is "what will CI
  // say". The gate names are four things to remember and CI's answer needs
  // all four; remembering them one at a time is how a gate goes unrun, which
  // is what happened to slot-fillability for its whole life before someone
  // noticed it was written for CI and wired into nothing.
  const chosen = name ? [name] : Object.keys(GATES);
  if (chosen.some((n) => !GATES[n])) {
    console.error(`usage: gates.ts [${Object.keys(GATES).join('|')}]  (no argument runs all)`);
    process.exit(2);
  }

  // LOADED ONCE, AND HANDED TO EVERY GATE (issue #64).
  //
  // Each gate defaults `source` to `loadContent()`, so calling them with no
  // argument gave every one of them a bundle object of its own — and the
  // batch gate 4 and gate 8 now share is keyed on that object, so it never
  // hit and both of them played the same 250 runs anyway. The sharing was
  // real and the cache was addressing nobody.
  const content = loadContent();

  let failed = 0;
  for (const n of chosen) {
    if (chosen.length > 1) console.log(`\n── ${n} ──`);
    const { ok, lines } = GATES[n]!(content);
    for (const line of lines) console.log(line);
    if (!ok) failed += 1;
  }
  if (chosen.length > 1) {
    console.log(`\n${chosen.length - failed}/${chosen.length} gates pass`);
  }
  process.exit(failed ? 1 : 0);
}
