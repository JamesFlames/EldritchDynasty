#!/usr/bin/env node
/**
 * THE LANDING, AS ONE COMMAND, RUNNING THE SAME SET CI RUNS.
 *
 * AGENTS.md carries standing authorisation to fast-forward `main` with no pull
 * request "as soon as `npm run check` is green". CI runs THREE jobs. `check` is
 * `typecheck && validate && test` — it does not run the gates.
 *
 * That gap is not theoretical. Four of the eleven red runs of `check.yml` on
 * `main` in runs 61-100 failed at the `gates` step, each one AFTER the whole
 * test suite had been green for forty-one minutes. An agent that ran the check,
 * saw green and pushed did exactly what the rulebook told it to and broke trunk.
 *
 * docs/PARALLEL.md patched over it by asking the agent to classify its own diff
 * first — gates "after the rebase, always" for content, `test:fast` and a gate
 * for docs — which is a decision made before the answer is known, with a
 * shorter path available for getting it wrong.
 *
 * So the landing is one command and the set is derived, not remembered:
 * `land.test.ts` reads `.github/workflows/check.yml` and fails the build if CI
 * grows a job this does not run. That is the same argument check.yml already
 * makes for iterating GATES rather than naming gates in a list — gate 2 was
 * written for CI and wired into nothing for its whole life under a hand-kept
 * list. This is that argument one level up.
 *
 *   npm run land               # fetch, rebase, run every CI job's work, push
 *   npm run land -- --dry-run  # print the plan and do none of it
 *
 * What this does NOT do is put the gates in the fix-and-rerun loop. `npm run
 * gate` is nine minutes; it belongs here, once, on the rebased head. The loop
 * is still `npm run test:fast`.
 */
import { execFileSync, spawnSync } from 'node:child_process';

/**
 * The npm scripts a landing runs, in order, ON THE REBASED HEAD.
 *
 * Ordered cheapest-first so a broken template fails in seconds rather than
 * after the suite. CI runs its three jobs in PARALLEL for the opposite reason —
 * a serial run reports only the first thing wrong — but a landing has one
 * terminal and an agent waiting on it, and there the first failure is the
 * answer it needs.
 */
export const STEPS = ['typecheck', 'validate', 'test', 'gate'];

/**
 * CI steps that provably cannot fail a build, and so are not part of a landing.
 *
 * `prose-lint.ts` ends in `process.exit(0)` unconditionally and says why:
 * `prose/voice` is warning-level only, because "a linter that blocks writers
 * gets disabled within a fortnight". It prints GitHub annotations. Running it
 * here would cost a content load to produce output nobody is reading.
 *
 * Anything CI runs that is in neither list fails `land.test.ts`. That is the
 * point: a fourth job cannot be added to the workflow and quietly not be part
 * of what an agent runs before it pushes to trunk.
 */
export const ADVISORY = ['lint:prose'];

/** Environment, not a check. Every job starts with it and none of them is testing it. */
const SETUP = ['ci', 'install'];

/**
 * Every npm script `check.yml` runs, as script names.
 *
 * A function over the workflow TEXT rather than a script that reads one file,
 * so the test can hand it a workflow it must reject — a rule nobody has watched
 * fail is indistinguishable from a rule that cannot.
 *
 * Deliberately naive about YAML: it matches `npm ...` anywhere in the file,
 * including inside comments. A comment mentioning a command CI does not run
 * makes this OVER-report, which fails the build and gets read. The other
 * direction — a real step this misses — is the one that would be silent, and
 * a `run:` line is the only place a bare `npm` appears in practice.
 */
export function ciScripts(workflow) {
  const found = new Set();
  for (const [, run, name] of workflow.matchAll(/\bnpm (?:(run|test|ci|install)\b)\s*([\w:-]*)/g)) {
    if (run === 'run' && name) found.add(name);
    else if (run && run !== 'run') found.add(run);
  }
  for (const s of SETUP) found.delete(s);
  return found;
}

// ── the landing itself ───────────────────────────────────────────────────────

const DRY = process.argv.includes('--dry-run');

const say = (s) => console.log(s);
const die = (s) => {
  console.error(`land: ${s}`);
  process.exit(1);
};

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();

/** Inherit the terminal: an agent watching a nine-minute gate needs to see it move. */
const run = (cmd, args) => spawnSync(cmd, args, { stdio: 'inherit' }).status === 0;

function main() {
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');

  /**
   * A shallow clone answers ancestry questions WRONGLY rather than refusing, so
   * a rebase onto a graft boundary is not a rebase. tools/orient.sh unshallows
   * from the SessionStart hook; this is for the sessions where it did not run.
   */
  const blockers = [
    git('rev-parse', '--is-shallow-repository') === 'true' &&
      'this clone is shallow — `git fetch --unshallow`, or run tools/orient.sh.\n' +
      '  Ancestry answers here are noise, and a rebase is an ancestry answer.',
    git('status', '--porcelain') && 'working tree is dirty. Commit or stash before landing.',
    branch === 'main' && 'already on main — land from the feature branch.',
  ].filter(Boolean);

  say(`landing ${branch} → main`);
  say(`  fetch · rebase · ${STEPS.map((s) => `npm run ${s}`).join(' · ')} · push`);

  // A dry run REPORTS the preconditions rather than stopping at the first one.
  // Being told about the dirty tree and then, on the next attempt, about the
  // shallow clone is two round trips to learn one thing.
  if (DRY) {
    for (const b of blockers) say(`\n  would stop: ${b}`);
    say(`\n--dry-run: nothing was fetched, rebased, run or pushed.`);
    process.exit(blockers.length ? 1 : 0);
  }
  if (blockers.length) die(blockers[0]);

  say('\n$ git fetch origin main');
  if (!run('git', ['fetch', 'origin', 'main'])) die('fetch failed.');

  say('\n$ git rebase origin/main');
  if (!run('git', ['rebase', 'origin/main'])) {
    die('rebase left conflicts. Resolve them, `git rebase --continue`, then run this again.\n' +
        '      Never hand-resolve packages/content/loci.yaml or docs/VOCABULARY.md — take\n' +
        '      either side and regenerate (npm run gen:loci, npm run gen:docs).');
  }

  // Everything below is ON THE REBASED HEAD, which is the whole point. A branch
  // that was green against the base it forked from says nothing about the base
  // it lands on — two content branches can each pass every gate and their merge
  // fail gate 4, with no overlap between the two diffs.
  for (const step of STEPS) {
    say(`\n$ npm run ${step}`);
    if (!run('npm', ['run', step])) {
      die(`\`npm run ${step}\` failed on the rebased head. Nothing was pushed.`);
    }
  }

  say('\n$ git push origin HEAD:main');
  if (!run('git', ['push', 'origin', 'HEAD:main'])) {
    die('push rejected — somebody landed first. Run this again: it rebases and re-checks.');
  }

  say(`\nlanded. Verify the verdict actually arrived: a run that concludes in seconds`);
  say(`with no steps is an ABSENCE, not a pass — see issue #118.`);
}

// Importable for the test that compares STEPS against the workflow, runnable as
// a command. Without the guard, importing it would try to land.
if (process.argv[1] && process.argv[1].endsWith('land.mjs')) main();
