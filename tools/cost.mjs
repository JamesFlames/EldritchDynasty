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
 *
 * ── AND IT EMITS THE PER-FILE TABLE, WHICH IS THE POINT NOW ───────────────
 *
 * Issue #146: three files carried timing blocks, all three said "treat a
 * timing comment as perishable, re-measure before quoting", and all three had
 * rotted anyway — `check.yml` by a factor of nearly four, in the direction
 * that hid a 68-minute build. The warning is not the mechanism.
 *
 * So the measurement stops being prose. `--full --write` records what every
 * test FILE cost into `tools/test-durations.json`, and two things read it:
 * the shard packing in `tools/shards.mjs`, and the balance rule in
 * `lanes.test.ts` that fails the build when the shards drift apart. A figure
 * something reads is data, and data that is wrong fails a test — which is
 * this repository's own argument against specifications, applied to its own
 * timing comments.
 *
 *   npm run cost                          # test:fast, print what AGENTS.md should say
 *   npm run cost -- --write               # and rewrite the command block to match
 *   npm run cost -- --full --write        # the whole suite, and the per-file table
 *   npm run cost -- --report <file>       # read a vitest JSON report already on disk
 *                                         # instead of spending another half hour
 *
 * WHAT THE PER-FILE FIGURE IS, EXACTLY. Vitest's JSON reporter gives each file
 * the span from its first test starting to its last one ending, so it is TEST
 * TIME and excludes transform and collect. That is the honest thing to pack
 * with — the files that decide a shard's cost are the ones that play millennia
 * inside a test body, and for those the two are within a per-cent of each
 * other. For a fast-lane file the fixed cost (about 200ms of Zod over the
 * content bundle) is a real share of its wall clock and is NOT in this number,
 * which is why the packing carries a floor for an unmeasured file rather than
 * treating a small figure as free. Stated here because a number whose
 * definition is unwritten is the next thing to rot.
 */
import { execFileSync } from 'node:child_process';
import { npmInvocation } from './portable.mjs';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { DURATIONS_FILE, packShards, shardCosts } from './shards.mjs';

const REPO = join(import.meta.dirname, '..');
const AGENTS_MD = join(REPO, 'AGENTS.md');
const WRITE = process.argv.includes('--write');
const FULL = process.argv.includes('--full');
/** A vitest JSON report already on disk, so a half-hour run is spent once. */
const REPORT = (() => {
  const i = process.argv.indexOf('--report');
  return i === -1 ? null : process.argv[i + 1];
})();

/** How many shards CI runs, read off the workflow rather than assumed. */
function shardCount() {
  const wf = readFileSync(join(REPO, '.github/workflows/check.yml'), 'utf8');
  return /^\s*shard:\s*\[([^\]]+)\]/m.exec(wf)?.[1].split(',').length ?? 4;
}

/**
 * Per-file test time, keyed by repo-relative POSIX path — the key the packing
 * and the balance rule both use.
 */
function perFile(reportJson) {
  const out = {};
  for (const r of reportJson.testResults ?? []) {
    const key = relative(REPO, r.name).split(sep).join('/');
    out[key] = Math.max(0, Math.round((r.endTime ?? 0) - (r.startTime ?? 0)));
  }
  return out;
}

/** Run a command, return seconds and vitest's own file/test counts if present. */
function measure(script, extra = []) {
  const started = Date.now();
  let out = '';
  try {
    // Through `npmInvocation`, because `npm` on Windows is a `.cmd` shim that
    // cannot be spawned without a shell — and the instrument that measures
    // what the commands cost is no use on a machine it cannot run them on.
    const npm = npmInvocation();
    out = execFileSync(
      npm.command,
      [...npm.prefix, 'run', '--silent', script, ...(extra.length ? ['--', ...extra] : [])],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch (e) {
    out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }
  const seconds = (Date.now() - started) / 1000;
  const files = /Test Files\s+(\d+) passed/.exec(out)?.[1];
  const tests = /Tests\s+(\d+) passed/.exec(out)?.[1];
  return { script, seconds, files: files && Number(files), tests: tests && Number(tests) };
}

const human = (s) => (s < 90 ? `${s.toFixed(0)}s` : `~${Math.round(s / 60)} min`);

/**
 * Run the whole suite once, with the JSON reporter attached, and return both
 * the wall clock AND the per-file table.
 *
 * ONE RUN FEEDS BOTH, which is the whole of #146's second half: a wall-clock
 * figure and a per-file table measured on different days can disagree, and
 * nothing would say which was current. Measured together they cannot.
 */
function measureFull() {
  if (REPORT) {
    // A report already on disk. The wall clock is not this tool's to claim in
    // that case — it did not run the suite — so it says so rather than
    // inventing one from the report's own timestamps, which exclude the
    // install, the transform and the teardown.
    const json = JSON.parse(readFileSync(REPORT, 'utf8'));
    return {
      result: {
        script: 'test',
        seconds: null,
        files: json.testResults?.length,
        tests: json.numTotalTests,
      },
      files: perFile(json),
    };
  }
  const dir = mkdtempSync(join(tmpdir(), 'ed-cost-'));
  const out = join(dir, 'report.json');
  try {
    // Both reporters: the default one still prints the counts `measure` reads
    // back, and the JSON one writes the table. Asking for the table alone would
    // silently break the figure this tool has always produced.
    const result = measure('test', ['--reporter=default', '--reporter=json', `--outputFile=${out}`]);
    return { result, files: perFile(JSON.parse(readFileSync(out, 'utf8'))) };
  } catch {
    console.error('cost: the suite ran but no JSON report came back; per-file table skipped.');
    return { result: measure('test'), files: null };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * What the committed table says the shards will cost, and how far apart.
 *
 * Printed on every run, measured or not, because the number this reports is
 * the one that was wrong for a month: `check.yml` argued that balancing the
 * shards would buy nothing, off a floor that had halved underneath it.
 */
function reportShards(files) {
  const n = shardCount();
  const costs = shardCosts(Object.keys(files), n, files);
  const packed = packShards(Object.keys(files), n, files);
  const total = Object.values(files).reduce((a, b) => a + b, 0);
  const max = Math.max(...costs);
  const min = Math.min(...costs);
  const longest = Math.max(...Object.values(files));
  const worst = Object.entries(files).sort((a, b) => b[1] - a[1]).slice(0, 5);

  console.log(`\n  packed into ${n} shards (what CI's matrix says):\n`);
  costs.forEach((c, i) => {
    console.log(`    shard ${i + 1}/${n}  ${human(c / 1000).padStart(8)}   ${packed[i].length} files`);
  });
  console.log(`\n    spread    ${(max / min).toFixed(2)}x   longest over shortest`);
  console.log(`    floor     ${human(longest / 1000)}   the single longest FILE — no shard count cuts this`);
  console.log(`    perfect   ${human(total / n / 1000)}   total test time over ${n}`);
  console.log('\n  the five dearest files:');
  for (const [f, ms] of worst) console.log(`    ${human(ms / 1000).padStart(8)}  ${f}`);
  if (longest > total / n) {
    console.log('\n  THE LONGEST FILE IS OVER A SHARD\'S FAIR SHARE. Vitest parallelises per');
    console.log('  FILE, so no packing and no shard count can get below it. AGENTS.md has the');
    console.log('  fix and its one prohibition: split it BY TEST, never by seed range.');
  }
}

function main() {
  const results = [];
  let table = null;

  if (!REPORT) results.push(measure('test:fast'));
  if (FULL || REPORT) {
    const full = measureFull();
    results.push(full.result);
    table = full.files;
    if (!REPORT) results.push(measure('typecheck'), measure('validate'));
  }

  console.log(REPORT ? `read from ${REPORT}:\n` : 'measured on this container, just now:\n');
  for (const r of results) {
    const counts = r.tests ? `  ${r.tests} tests in ${r.files} files` : '';
    const clock = r.seconds === null ? '       —' : human(r.seconds).padStart(8);
    console.log(`  npm run ${r.script.padEnd(10)} ${clock}${counts}`);
  }

  const fast = results.find((r) => r.script === 'test:fast');
  const full = results.find((r) => r.script === 'test');

  // The committed table if this run did not measure one — so `npm run cost`
  // with no arguments still reports the shard spread, which costs nothing and
  // is the number that went unwatched.
  const shown = table ?? (() => {
    try {
      return JSON.parse(readFileSync(join(REPO, DURATIONS_FILE), 'utf8')).files;
    } catch {
      return null;
    }
  })();
  if (shown && Object.keys(shown).length) reportShards(shown);

  if (!WRITE) {
    console.log('\n`--write` to put these into AGENTS.md\'s command block'
      + (table ? ` and ${DURATIONS_FILE}.` : '.'));
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
  if (full?.tests && full.seconds !== null) {
    text = text.replace(
      /^(npm test\s+# everything: )[^\n]*/m,
      `$1${full.tests.toLocaleString()} tests in ${full.files} files, ${human(full.seconds)}`,
    );
  }
  if (text.length === before && text === readFileSync(AGENTS_MD, 'utf8')) {
    // `--report` measures no wall clock, so it has nothing to say about the
    // command block and must not claim it rewrote one. A tool that reports
    // work it did not do is the same lie as a figure that is out of date.
    console.log('\nAGENTS.md unchanged — this run measured no wall clock to put in it.');
  } else {
    writeFileSync(AGENTS_MD, text);
    console.log(`\nAGENTS.md rewritten (${before} → ${text.length} bytes).`);
  }

  if (table) {
    const n = shardCount();
    const costs = shardCosts(Object.keys(table), n, table);
    writeFileSync(join(REPO, DURATIONS_FILE), `${JSON.stringify({
      // Everything below is DATA that something reads — see `tools/shards.mjs`
      // and the balance rule in `lanes.test.ts`. Do not hand-edit it; re-run
      // `npm run cost -- --full --write`. A hand-kept number here is the
      // timing comment this file exists to replace, wearing JSON.
      note: 'Generated by `npm run cost -- --full --write`. Per-file TEST TIME in ms '
        + '(vitest\'s JSON reporter: first test start to last test end, excluding '
        + 'transform and collect). Read by tools/shards.mjs to pack the CI shards, '
        + 'and by packages/core/src/lanes.test.ts to fail the build when they drift '
        + 'apart. Never hand-edited.',
      measured: new Date().toISOString().slice(0, 10),
      shards: n,
      shardCostsMs: costs,
      totalMs: Object.values(table).reduce((a, b) => a + b, 0),
      files: Object.fromEntries(Object.entries(table).sort(([a], [b]) => (a < b ? -1 : 1))),
    }, null, 2)}\n`);
    console.log(`${DURATIONS_FILE} rewritten — ${Object.keys(table).length} files.`);
  }
  console.log('Run `npx vitest run packages/core/src/codemap.test.ts packages/core/src/lanes.test.ts`'
    + ' — they hold the budget and the balance.');
}

if (process.argv[1] && process.argv[1].endsWith('cost.mjs')) main();
