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
 */
import { loadContent } from '@ed/content';
import { validateBundle } from '@ed/schema';
import { bootstrap, runYears } from '../sim.js';
import { TEST_FAMILIES } from './testFamilies.js';
import { resolveSlots } from '../events/slots.js';
import { makeRng } from '../rng.js';

const SEEDS = Array.from({ length: 12 }, (_, i) => 1000 + i * 7);

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
function gateSlotFillability(): boolean {
  const bundle = loadContent();
  const dead: string[] = [];

  for (const e of bundle.events) {
    if (e.arc) continue; // arc nodes cast from their own binding, not the ambient pool
    if (!Object.keys(e.slots).length) continue; // nothing to fill

    const fillable = TEST_FAMILIES.some((fam) => resolveSlots(e, fam.build(bundle), makeRng(1)).ok);
    if (!fillable) dead.push(e.id);
  }

  console.log(`gate 2 (slot-fillability): ${bundle.events.length} events x ${TEST_FAMILIES.length} fixtures`);
  if (dead.length) {
    console.log(`  FAIL: ${dead.length} event(s) cannot cast against any test family:`);
    for (const id of dead) console.log(`    ${id}`);
  }
  return dead.length === 0;
}

/**
 * GATE 7 — the clause gate (issue #4). Per-Age assignment means which
 * clauses a run recovers now depends on which Ages it drew; the floor this
 * protects is the design's own — a run that reaches 2042 having recovered
 * three clauses should be rarer than the median, and the God rung (seven of
 * nine) needs the median run within striking distance of it.
 */
function gateClauses(): boolean {
  const bundle = loadContent();
  const counts = SEEDS.map((seed) => {
    const ctx = bootstrap(bundle, seed, 1042);
    runYears(ctx, 1000);
    return ctx.world.clausesRecovered.size;
  });
  const sorted = [...counts].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const ok = median >= 6;
  console.log(`gate 7 (clauses): median ${median} of 9 recovered across ${SEEDS.length} runs — [${sorted.join(', ')}]`);
  if (!ok) console.log(`  FAIL: median must be at least 6 of 9`);
  return ok;
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
function gateFireRate(): boolean {
  const bundle = loadContent();
  const runs = 100;
  const years = 1000;
  const FLOOR_PCT = 0.5;

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

  const failing = rates.filter((r) => r.pct < FLOOR_PCT);
  console.log(`gate 4 (fire rate): ${runs} runs x ${years}y — rarest of ${rates.length} non-frame events:`);
  for (const r of rates.slice(0, 5)) console.log(`    ${r.id.padEnd(34)} ${r.pct}%`);
  if (failing.length) {
    console.log(`  FAIL: ${failing.length} event(s) fire in under ${FLOOR_PCT}% of runs:`);
    for (const f of failing) console.log(`    ${f.id}: ${f.pct}%`);
  }
  return failing.length === 0;
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
function gatePurposes(): boolean {
  const issues = validateBundle(loadContent(), ['event/purposes', 'event/purpose-overlap']);
  console.log(`gate 6 (purposes): ${issues.length} issue(s)`);
  for (const i of issues) console.log(`    [${i.rule}] ${i.where}: ${i.message}`);
  return issues.length === 0;
}

const GATES: Record<string, () => boolean> = {
  clauses: gateClauses,
  'fire-rate': gateFireRate,
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
  process.exit(gate() ? 0 : 1);
}
