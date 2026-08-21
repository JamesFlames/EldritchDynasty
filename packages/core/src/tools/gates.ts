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
import { declaredOutcomes, outcomeReach } from '../events/reach.js';

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
export function gateFireRate(
  source: Source = loadContent(),
  opts: { runs?: number; years?: number; floorPct?: number } = {},
): GateResult {
  const bundle = indexContent(source);
  const runs = opts.runs ?? 100;
  const years = opts.years ?? 1000;
  const floorPct = opts.floorPct ?? 0.5;

  const seenIn = new Map<string, number>();
  for (let i = 0; i < runs; i++) {
    const ctx = bootstrap(bundle, 5000 + i * 7, 1042);
    runYears(ctx, years);
    for (const [id, n] of Object.entries(ctx.world.frequency.templateFires)) {
      if (n > 0) seenIn.set(id, (seenIn.get(id) ?? 0) + 1);
    }
  }

  const rates = bundle.events
    .filter((e) => e.tier !== 'frame')
    .map((e) => ({ id: String(e.id), pct: (100 * (seenIn.get(String(e.id)) ?? 0)) / runs }))
    .sort((a, b) => a.pct - b.pct);

  const failing = rates.filter((r) => r.pct < floorPct);
  const lines = [`gate 4 (fire rate): ${runs} runs x ${years}y — rarest of ${rates.length} non-frame events:`];
  for (const r of rates.slice(0, 5)) lines.push(`    ${r.id.padEnd(34)} ${r.pct}%`);
  if (failing.length) {
    lines.push(`  FAIL: ${failing.length} event(s) fire in under ${floorPct}% of runs:`);
    for (const f of failing) lines.push(`    ${f.id}: ${f.pct}%`);
  }
  return { ok: failing.length === 0, lines };
}

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
export function gateOutcomeReach(
  source: Source = loadContent(),
  opts: { runs?: number; years?: number } = {},
): GateResult {
  const bundle = indexContent(source);
  const runs = opts.runs ?? 100;
  const years = opts.years ?? 1000;

  const declared = declaredOutcomes(bundle);
  const seenIn = outcomeReach(bundle, runs, years);

  const rates = [...declared]
    .map(([key, where]) => ({ where, pct: (100 * (seenIn.get(key) ?? 0)) / runs }))
    .sort((a, b) => a.pct - b.pct);

  const dead = rates.filter((r) => r.pct === 0);
  const lines = [`gate 8 (outcome reach): ${runs} runs x ${years}y — rarest of ${rates.length} authored outcomes:`];
  for (const r of rates.slice(0, 5)) lines.push(`    ${r.where.padEnd(52)} ${r.pct}%`);
  if (dead.length) {
    lines.push(`  FAIL: ${dead.length} outcome(s) never resolve:`);
    for (const d of dead) lines.push(`    ${d.where}`);
  }
  return { ok: dead.length === 0, lines };
}

export const GATES: Record<string, (source?: Source) => GateResult> = {
  clauses: gateClauses,
  'fire-rate': gateFireRate,
  'outcome-reach': gateOutcomeReach,
  purposes: gatePurposes,
  'slot-fillability': gateSlotFillability,
};

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('gates.ts');
if (isMain) {
  const name = process.argv[2];
  const gate = name ? GATES[name] : undefined;
  if (!gate) {
    console.error(`usage: gates.ts <${Object.keys(GATES).join('|')}>`);
    process.exit(2);
  }
  const { ok, lines } = gate();
  for (const line of lines) console.log(line);
  process.exit(ok ? 0 : 1);
}
