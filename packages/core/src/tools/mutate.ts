import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ── THE MUTATION PROBE ────────────────────────────────────────────────────
 *
 *   npm run mutate                      # the default targets
 *   npm run mutate -- assize            # one module
 *   npm run mutate -- assize --limit 40 # a slice of it, for a quick answer
 *
 * `docs/TEST-COVERAGE.md` measures which lines RUN. This measures whether
 * anything would notice if they ran WRONG, which is a different question and
 * the one this repository is named for. A statement executes just as happily
 * when it is incorrect: `conditions.ts` reported 84.9% statement coverage
 * while a third of its predicates had never returned an answer.
 *
 * The method is the oldest one there is. Break the code on purpose — one
 * small, plausible edit at a time — and run the tests. A mutant the suite
 * kills is a line somebody is really checking. A mutant that SURVIVES is a
 * line you can break without any test complaining, and in a codebase that
 * fails by doing nothing, that is the whole list of places a silent failure
 * could live.
 *
 * ── IT IS A PROBE, NOT A GATE, AND THAT IS DELIBERATE ─────────────────────
 *
 * It is not in `npm run check` and there is no threshold anywhere. The
 * reasoning is `TEST-COVERAGE.md`'s, applied to a sharper instrument: "a
 * coverage threshold in CI gets satisfied rather than read". A mutation score
 * in CI would be worse, because the cheapest way to raise one is to write
 * assertions that pin behaviour nobody cares about. The output here is a LIST
 * OF SURVIVORS to read, and the useful reaction to it is usually "that line
 * should not exist" as often as "that line needs a test".
 *
 * ── WHY THIS AND NOT STRYKER ──────────────────────────────────────────────
 *
 * Stryker would want to run a suite per mutant, and the suite here is 25
 * minutes. This runs the FAST LANE only — 55 seconds, and the lane a
 * developer actually iterates in — against modules chosen for being dense
 * with rules rather than dense with lines. That trade is stated rather than
 * hidden: a mutant that only the slow lane would catch is reported as a
 * survivor here, and the honest reading of the survivor list has to keep
 * that in mind. Where it matters, `--slow` runs both lanes for one module.
 */

const REPO = join(import.meta.dirname, '../../../..');

/**
 * The mutation operators, smallest first.
 *
 * Every one produces code that still typechecks and still runs — the point is
 * a plausible mistake, not a syntax error. Conditional-boundary and
 * negation mutants are the two that have historically found the most in
 * rule-dense code, which is what these modules are.
 */
interface Operator {
  name: string;
  find: RegExp;
  swap: (m: RegExpMatchArray) => string;
}

const OPERATORS: Operator[] = [
  // `>=` becomes `>`: the off-by-one that decides whether a gate is inclusive.
  { name: 'boundary', find: />=/g, swap: () => '>' },
  { name: 'boundary', find: /<=/g, swap: () => '<' },
  // The direction of a comparison. A ladder floor read backwards.
  { name: 'comparison', find: /(?<![<>=!])>(?![>=])/g, swap: () => '<' },
  { name: 'comparison', find: /(?<![<>=!])<(?![<=])/g, swap: () => '>' },
  // Equality. `!==` for `===` turns a guard into its own opposite.
  { name: 'equality', find: /===/g, swap: () => '!==' },
  { name: 'equality', find: /!==/g, swap: () => '===' },
  // Arithmetic, where a cost becomes a payment.
  { name: 'arithmetic', find: /(?<![+\-*/=<>!])\+(?![+=])/g, swap: () => '-' },
  { name: 'arithmetic', find: /(?<![+\-*/=<>!])-(?![-=>])/g, swap: () => '+' },
  // Short-circuit logic: an AND that should have been an OR gates nothing.
  { name: 'logic', find: /&&/g, swap: () => '||' },
  { name: 'logic', find: /\|\|/g, swap: () => '&&' },
  // A literal that is a rate, a weight or a cap. Doubling one is the kind of
  // change a balance edit makes by accident.
  { name: 'literal', find: /(?<![\w.])0\.(\d+)(?![\w.])/g, swap: (m) => `0.${m[1]}9` },
];

/** Rules-dense, not line-dense. These decide things. */
const TARGETS: Record<string, string> = {
  conditions: 'packages/core/src/events/conditions.ts',
  effects: 'packages/core/src/events/effects.ts',
  assize: 'packages/core/src/assize.ts',
  ascension: 'packages/core/src/ascension.ts',
  vitality: 'packages/core/src/people/vitality.ts',
  expression: 'packages/core/src/genetics/expression.ts',
  selection: 'packages/core/src/events/selection.ts',
};

export interface Mutant {
  file: string;
  line: number;
  operator: string;
  before: string;
  after: string;
}

/**
 * Every mutant a file admits.
 *
 * COMMENTS AND STRINGS ARE SKIPPED, and this is not fussiness: this
 * repository's comments are long and full of prose arrows and arithmetic, so
 * mutating them produces hundreds of mutants that change nothing and drown
 * the survivor list in noise. A survivor list nobody reads is worth exactly
 * as much as no probe at all.
 */
export function mutantsOf(file: string, source: string): Mutant[] {
  const blanked = source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
    .replace(/'(?:[^'\\\n]|\\.)*'/g, (m) => `'${' '.repeat(Math.max(0, m.length - 2))}'`)
    .replace(/`(?:[^`\\]|\\.)*`/g, (m) => `\`${' '.repeat(Math.max(0, m.length - 2))}\``);

  const out: Mutant[] = [];
  const seen = new Set<number>();
  for (const op of OPERATORS) {
    for (const m of blanked.matchAll(op.find)) {
      const at = m.index!;
      // One mutant per position: the operators overlap (`>=` is also a `>`),
      // and two edits at one offset cannot both be applied anyway.
      if (seen.has(at)) continue;
      seen.add(at);
      out.push({
        file,
        line: source.slice(0, at).split('\n').length,
        operator: op.name,
        before: m[0],
        after: op.swap(m),
      });
    }
  }
  return out.sort((a, b) => a.line - b.line);
}

/** The source with one mutant applied. */
export function applyMutant(source: string, mutant: Mutant, at: number): string {
  return source.slice(0, at) + mutant.after + source.slice(at + mutant.before.length);
}

function runsGreen(lane: string): boolean {
  try {
    execFileSync('npx', ['vitest', 'run', ...lane.split(' ')], {
      cwd: REPO,
      stdio: 'pipe',
      timeout: 15 * 60_000,
    });
    return true;
  } catch {
    return false;
  }
}

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('mutate.ts');
if (isMain) {
  const args = process.argv.slice(2);
  const limitAt = args.indexOf('--limit');
  const limit = limitAt >= 0 ? Number(args[limitAt + 1]) : Infinity;
  // The value after `--limit` is the limit, not a target. Without this, `-- 
  // conditions --limit 2` reports "unknown target: 2", which is the tool
  // failing to read its own command line.
  const named = args.filter((a, i) => !a.startsWith('--') && i !== limitAt + 1);
  const lane = args.includes('--slow')
    ? 'packages/**/*.test.ts'
    : '--exclude packages/**/*.slow.test.ts';

  const chosen = named.length ? named : Object.keys(TARGETS);
  const unknown = chosen.filter((c) => !TARGETS[c]);
  if (unknown.length) {
    console.error(`unknown target(s): ${unknown.join(', ')}`);
    console.error(`known: ${Object.keys(TARGETS).join(', ')}`);
    process.exit(2);
  }

  console.log('MUTATION PROBE — breaking code on purpose to see who notices.');
  console.log(`lane: ${args.includes('--slow') ? 'both lanes' : 'fast lane only'}`);

  /**
   * ── THE LANE HAS TO BE GREEN BEFORE ANY OF THIS MEANS ANYTHING ───────────
   *
   * A mutant is "killed" when the lane goes red. If the lane is ALREADY red,
   * every mutant is killed, the probe reports a perfect score, and the report
   * is worthless — silently, which is the failure this whole tool exists to
   * find, committed by the tool itself.
   *
   * That is not hypothetical: the first real run of this probe was invalidated
   * exactly that way. A component suite written in another window landed in
   * the lane mid-run with a broken fixture, and from that moment every mutant
   * came back killed. Forty minutes of runner time, and a clean bill of health
   * that meant nothing.
   *
   * So the baseline is measured first, every time, and a red lane is a refusal
   * rather than a warning.
   */
  process.stdout.write('baseline: ');
  if (!runsGreen(lane)) {
    console.log('RED.');
    console.error(
      '\nThe lane is failing before a single mutant was applied, so every mutant would '
      + 'come back "killed" and the score would be a lie. Fix the lane first.',
    );
    process.exit(2);
  }
  console.log('green.\n');

  const survivors: Mutant[] = [];
  let killed = 0;
  let tested = 0;

  for (const name of chosen) {
    const rel = TARGETS[name]!;
    const path = join(REPO, rel);
    const original = readFileSync(path, 'utf8');
    const all = mutantsOf(rel, original);

    // Evenly spread rather than the first N, so a limited run samples the
    // whole file instead of its imports.
    const step = Math.max(1, Math.ceil(all.length / Math.min(limit, all.length)));
    const picked = all.filter((_, i) => i % step === 0).slice(0, limit);

    console.log(`${name}: ${all.length} mutants, testing ${picked.length}`);

    for (const mutant of picked) {
      // Re-find the offset in the pristine source each time; the file on disk
      // is always the original between mutants.
      const lines = original.split('\n');
      const before = lines.slice(0, mutant.line - 1).join('\n');
      const offset = mutant.line === 1 ? 0 : before.length + 1;
      const inLine = lines[mutant.line - 1]!.indexOf(mutant.before);
      if (inLine < 0) continue;

      try {
        writeFileSync(path, applyMutant(original, mutant, offset + inLine));
        tested += 1;
        if (runsGreen(lane)) {
          survivors.push(mutant);
          console.log(`  SURVIVED  ${rel}:${mutant.line}  ${mutant.before} -> ${mutant.after}  (${mutant.operator})`);
        } else {
          killed += 1;
        }
      } finally {
        // ALWAYS. A probe that leaves a mutant on disk has broken the thing
        // it was measuring, and the next person to run the suite gets a
        // failure nobody wrote.
        writeFileSync(path, original);
      }
    }
  }

  console.log(`\n${killed} killed, ${survivors.length} survived, of ${tested} tested`);
  if (survivors.length) {
    console.log('\nEvery line below can be broken without a single test complaining.');
    console.log('Sometimes that means it needs a test. Sometimes it means it should not exist.');
    for (const s of survivors) {
      console.log(`  ${s.file}:${s.line}  ${s.before} -> ${s.after}`);
    }
  }
}
