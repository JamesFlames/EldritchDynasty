/**
 * Headless harness. For a game where one playthrough is 8-12 hours, batch
 * simulation is the only viable balance method — this is the thing that
 * answers "is the God rung actually reachable" before anyone plays for eleven
 * hours to find out it is not.
 *
 *   npx tsx packages/core/src/harness.ts 24 1000
 */
import { loadContent } from '@ed/content';
import { validateBundle } from '@ed/schema';
import { bootstrap, runYears } from './sim.js';
import { phenotypeOf } from './people/factory.js';

export interface RunStats {
  seed: number;
  people: number;
  living: number;
  maxFont: number;
  maxExpressed: number;
  maxMadness: number;
  madWomen: number;
  madIncapable: number;
  regencyYears: number;
  frequency: Record<string, number>;
  ageSpans: { age: string; span: number }[];
  chronicleEntries: number;
}

export function runOnce(seed: number, years: number): RunStats {
  const bundle = loadContent();
  const ctx = bootstrap(bundle, seed, 1042);
  runYears(ctx, years);

  const w = ctx.world;
  let maxFont = 0, maxExpressed = 0, maxMadness = 0, madWomen = 0, madIncapable = 0;

  for (const p of w.people.all()) {
    const ph = phenotypeOf(p, ctx.genetics, w.year);
    maxFont = Math.max(maxFont, ph.eldritch.carriedFont);
    maxExpressed = Math.max(maxExpressed, ph.eldritch.expressedPower);
    maxMadness = Math.max(maxMadness, p.madness);
    if (p.madness > 0 && p.sex === 'female') madWomen++;
    if (p.madness > 0 && !ph.eldritch.canExpress) madIncapable++;
  }

  return {
    seed,
    people: w.people.size,
    living: w.people.living().length,
    maxFont: round(maxFont),
    maxExpressed: round(maxExpressed),
    maxMadness: round(maxMadness),
    madWomen,
    madIncapable,
    regencyYears: 0,
    frequency: { ...w.frequency.firedThisRun },
    ageSpans: w.age.ended.map((e) => ({ age: e.age, span: e.ended - e.began })),
    chronicleEntries: w.chronicle.length,
  };
}

const round = (n: number) => Math.round(n * 10) / 10;

export function batch(runs: number, years: number): void {
  const bundle = loadContent();
  const issues = validateBundle(bundle);
  const errors = issues.filter((i) => i.level === 'error');
  console.log(`content: ${bundle.events.length} events, ${bundle.ages.length} ages, ${bundle.loci.length} loci`);
  console.log(`validation: ${errors.length} errors, ${issues.length - errors.length} warnings`);
  for (const e of errors) console.log(`  ERROR ${e.where}: ${e.message}`);

  const all: RunStats[] = [];
  for (let i = 0; i < runs; i++) all.push(runOnce(1000 + i * 7, years));

  const avg = (f: (s: RunStats) => number) => round(all.reduce((a, s) => a + f(s), 0) / all.length);

  console.log(`\n${runs} runs x ${years} years`);
  console.log(`  people/run        ${avg((s) => s.people)}   living at end ${avg((s) => s.living)}`);
  console.log(`  max carried font  ${avg((s) => s.maxFont)}`);
  console.log(`  max expressed EP  ${avg((s) => s.maxExpressed)}`);
  console.log(`  max madness       ${avg((s) => s.maxMadness)}`);
  console.log(`  chronicle entries ${avg((s) => s.chronicleEntries)}`);

  console.log('\n  events fired by frequency (mean per run):');
  for (const f of ['common', 'uncommon', 'rare', 'mythic']) {
    console.log(`    ${f.padEnd(9)} ${avg((s) => s.frequency[f] ?? 0)}`);
  }

  const spans = new Map<string, number[]>();
  for (const s of all) for (const a of s.ageSpans) spans.set(a.age, [...(spans.get(a.age) ?? []), a.span]);
  console.log('\n  age spans (min / median / max, years):');
  for (const [age, xs] of [...spans].sort()) {
    const sorted = [...xs].sort((a, b) => a - b);
    console.log(`    ${age.padEnd(20)} ${sorted[0]} / ${sorted[Math.floor(sorted.length / 2)]} / ${sorted[sorted.length - 1]}   (n=${xs.length})`);
  }

  const madW = all.reduce((a, s) => a + s.madWomen, 0);
  const madI = all.reduce((a, s) => a + s.madIncapable, 0);
  console.log(`\n  INVARIANTS  mad women: ${madW}   mad-but-incapable: ${madI}   (both must be 0)`);
}

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('harness.ts');
if (isMain) batch(Number(process.argv[2] ?? 16), Number(process.argv[3] ?? 600));
