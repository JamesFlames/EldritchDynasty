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
import { bootstrap, runYears } from '../sim.js';

const SEEDS = Array.from({ length: 12 }, (_, i) => 1000 + i * 7);

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

const GATES: Record<string, () => boolean> = {
  clauses: gateClauses,
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
