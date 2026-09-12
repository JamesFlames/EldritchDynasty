#!/usr/bin/env node
/**
 * WHAT THE COMMANDS COST, MEASURED RATHER THAN REMEMBERED.
 *
 * `codemap.test.ts` already enforces that a command's cost is stated in
 * exactly ONE place, after `npm run test:fast` was documented as "~3s", "~2s",
 * "two seconds" and "about eight seconds" in four files while actually taking
 * a hundred. That rule works and is not what this is for.
 *
 * What it does not do is check whether the surviving copy is TRUE. It was not:
 * AGENTS.md said ~27s against a measured 68.07s, and `npm test` said ~25 min
 * against a measured 18.
 *
 * And the numbers rot without anybody touching them. Measured on one branch in
 * one day:
 *
 *   09:46  npm test  1,748 tests in 126 files   1085.92s
 *   19:00  npm test  1,767 tests in 126 files   1133.23s   ← same branch
 *
 * Nothing about that branch changed between those runs. Four other commits
 * landed on `main` and it rebased. So the figure is invalidated by whoever
 * lands NEXT, not by whoever wrote it, and the agent who has to notice is
 * whichever one rebases afterwards. Corrected by hand three times in one
 * session; all three were stale again before the branch landed.
 *
 * So: measure, and write the measurement down.
 *
 *   npm run cost              # measure test:fast, print what AGENTS.md should say
 *   npm run cost -- --write   # and rewrite the command block to match
 *
 * `check` and `test` are NOT measured by default: they take half an hour, and
 * a tool nobody can afford to run is a tool nobody runs. `--full` includes
 * them, for the once-a-fortnight case where the big numbers have drifted.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO = join(import.meta.dirname, '..');
const AGENTS_MD = join(REPO, 'AGENTS.md');
const WRITE = process.argv.includes('--write');
const FULL = process.argv.includes('--full');

/** Run a command, return seconds and vitest's own file/test counts if present. */
function measure(script) {
  const started = Date.now();
  let out = '';
  try {
    out = execFileSync('npm', ['run', '--silent', script], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }
  const seconds = (Date.now() - started) / 1000;
  const files = /Test Files\s+(\d+) passed/.exec(out)?.[1];
  const tests = /Tests\s+(\d+) passed/.exec(out)?.[1];
  return { script, seconds, files: files && Number(files), tests: tests && Number(tests) };
}

const human = (s) => (s < 90 ? `${s.toFixed(0)}s` : `~${Math.round(s / 60)} min`);

function main() {
  const results = [measure('test:fast')];
  if (FULL) results.push(measure('test'), measure('typecheck'), measure('validate'));

  console.log('measured on this container, just now:\n');
  for (const r of results) {
    const counts = r.tests ? `  ${r.tests} tests in ${r.files} files` : '';
    console.log(`  npm run ${r.script.padEnd(10)} ${human(r.seconds).padStart(8)}${counts}`);
  }

  const fast = results.find((r) => r.script === 'test:fast');
  const full = results.find((r) => r.script === 'test');

  if (!WRITE) {
    console.log('\n`--write` to put these into AGENTS.md\'s command block.');
    return;
  }

  let text = readFileSync(AGENTS_MD, 'utf8');
  const before = text.length;
  if (fast) {
    text = text.replace(
      /^(npm run test:fast\s+# )[^\n]*/m,
      // THE FIGURE COMES FIRST, because `codemap.test.ts` reads it back with
      // /^npm run test:fast\s+# ~?(\d+)\s*s\b/ and checks it is plausible.
      // Written the other way round — "the fix-and-rerun loop, 59s" — that
      // rule stops matching and reports that the file no longer states the
      // cost at all, which is this repository's own failure mode: the tool
      // that keeps a number true, quietly breaking the rule that checks it.
      `$1${human(fast.seconds)}, the fix-and-rerun loop. Skips the *.slow.test.ts suites;`,
    );
  }
  if (full?.tests) {
    text = text.replace(
      /^(npm test\s+# everything: )[^\n]*/m,
      `$1${full.tests.toLocaleString()} tests in ${full.files} files, ${human(full.seconds)}`,
    );
  }
  writeFileSync(AGENTS_MD, text);
  console.log(`\nAGENTS.md rewritten (${before} → ${text.length} bytes).`);
  console.log('Run `npx vitest run packages/core/src/codemap.test.ts` — it holds the budget.');
}

if (process.argv[1] && process.argv[1].endsWith('cost.mjs')) main();
