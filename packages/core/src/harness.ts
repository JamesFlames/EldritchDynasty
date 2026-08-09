/**
 * Headless harness. For a game where one playthrough is 8-12 hours, batch
 * simulation is the only viable balance method — this is the thing that
 * answers "is the God rung actually reachable" before anyone plays for eleven
 * hours to find out it is not.
 *
 *   npx tsx packages/core/src/harness.ts 24 1000
 */
import { loadContent } from '@ed/content';
import { MAIN_BRANCH, validateBundle } from '@ed/schema';
import { bootstrap, runYears } from './sim.js';
import { phenotypeOf } from './people/factory.js';
import { activeBranches, halls } from './people/branches.js';

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

  /** Cadet branches (concept §16). A run with none is a run with one household. */
  mainHall: number;
  branchesLive: number;
  branchesEver: number;
  branchesRecalled: number;
  grievance: number;
  discontent: number;

  /** What the chronicler did with the Record blocks he was offered. */
  recorded: number;
  omitted: number;
  embellished: number;

  /** The Ledger (§18), standing (§17) and old quarrels (§7). */
  clauses: number;
  respect: string;
  grudges: number;
  oldestGrudge: number;
  retainers: number;
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

  const live = activeBranches(w);
  const records = w.chronicle.filter((c) => c.record !== undefined);

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

    mainHall: (halls(w, w.year).get(MAIN_BRANCH) ?? []).length,
    branchesLive: live.length,
    branchesEver: w.branches.size,
    branchesRecalled: [...w.branches.values()].filter((b) => b.recalled !== undefined).length,
    grievance: round(live.reduce((a, b) => a + b.grievance, 0) / Math.max(1, live.length)),
    discontent: round(w.discontent),

    recorded: records.filter((c) => c.record === 'record').length,
    omitted: records.filter((c) => c.record === 'omit').length,
    embellished: records.filter((c) => c.record === 'embellish').length,

    clauses: w.clausesRecovered.size,
    respect: w.respect,
    grudges: [...w.relationships.values()].reduce((a, r) => a + r.grudges.length, 0),
    oldestGrudge: [...w.relationships.values()]
      .flatMap((r) => r.grudges)
      .reduce((m, g) => Math.max(m, w.year - g.originYear), 0),
    retainers: w.people.living().filter((p) => p.contract).length,
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

  // Cadet branches. A run showing 0 founded is the old behaviour — one
  // household, damped by the crowding brake, for a thousand years.
  console.log('\n  the halls:');
  console.log(`    main hall         ${avg((s) => s.mainHall)}  of ${avg((s) => s.living)} living`);
  console.log(`    branches          ${avg((s) => s.branchesLive)} live / ${avg((s) => s.branchesEver)} ever founded`);
  console.log(`    seal to a cadet   ${avg((s) => s.branchesRecalled)} branches, per run`);
  console.log(`    grievance         ${avg((s) => s.grievance)}   discontent ${avg((s) => s.discontent)}`);

  console.log('\n  the record (what the chronicler did with it):');
  console.log(`    recorded ${avg((s) => s.recorded)}   omitted ${avg((s) => s.omitted)}   embellished ${avg((s) => s.embellished)}`);

  // The Ledger. A run showing 9.0 every time is the calendar handing over the
  // contract; a run showing 2.0 is a house that never kept an archivist. Both
  // should happen, and the God rung needs seven.
  const clauses = all.map((s) => s.clauses).sort((a, b) => a - b);
  console.log('\n  the Ledger and the world:');
  console.log(`    clauses recovered ${avg((s) => s.clauses)}   (min ${clauses[0]}, max ${clauses[clauses.length - 1]}, `
    + `${all.filter((s) => s.clauses >= 7).length}/${runs} reach the God gate of 7)`);
  const tiers = new Map<string, number>();
  for (const s of all) tiers.set(s.respect, (tiers.get(s.respect) ?? 0) + 1);
  console.log(`    standing at 2042  ${[...tiers].map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  console.log(`    live grudges      ${avg((s) => s.grudges)}   oldest ${avg((s) => s.oldestGrudge)} years`);
  console.log(`    retainers in post ${avg((s) => s.retainers)}`);

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
