import { describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

/**
 * THE LANDING RUNS WHAT CI RUNS, AND THE SET IS DERIVED RATHER THAN REMEMBERED.
 *
 * AGENTS.md grants standing authorisation to fast-forward `main` with no pull
 * request as soon as `npm run check` is green. `check` is
 * `typecheck && validate && test`. CI runs three jobs, and the third is the
 * gates — nine minutes of measured runs that `check` has never touched.
 *
 * Four of the eleven red runs of `check.yml` on `main` across runs 61-100
 * failed at exactly that step. Runs 64 and 65 are the clearest: typecheck,
 * validate and the whole test suite green, forty-one minutes of it, then
 * `gates` red. Both agents did what the rulebook said and broke trunk anyway.
 *
 * `tools/land.mjs` is the command that closes it. This is the test that keeps
 * it closed, and the thing it guards is not today's four steps — it is the
 * FOURTH JOB nobody has written yet. check.yml already makes this argument
 * about its own gate list:
 *
 *   "The gates are not split by name, deliberately. `npm run gate` runs
 *    whatever is in `GATES`, so a new gate is in CI the moment it exists rather
 *    than the moment somebody remembers this file — gate 2 was written for CI
 *    and wired into nothing for its whole life under the old hand-kept list."
 *
 * A landing command that names its own steps has that failure mode one level
 * up, and it is worse there: a forgotten gate costs a red build, a forgotten
 * JOB costs a red `main` that the agent responsible has already stopped
 * watching.
 */

const REPO = join(import.meta.dirname, '../../../..');
const TOOL = join(REPO, 'tools/land.mjs');
const WORKFLOW = join(REPO, '.github/workflows/check.yml');

const land = (await import(pathToFileURL(TOOL).href)) as {
  STEPS: string[];
  ADVISORY: string[];
  ciScripts: (workflow: string) => Set<string>;
  issueLeftOpen: (branch: string, commitLog: string) => string | null;
};

const workflow = readFileSync(WORKFLOW, 'utf8');

describe('the landing runs every check CI runs', () => {
  it('leaves no script CI runs out of the landing', () => {
    const covered = new Set([...land.STEPS, ...land.ADVISORY]);
    const missed = [...land.ciScripts(workflow)].filter((s) => !covered.has(s));
    expect(
      missed,
      `check.yml runs ${missed.join(', ')}, and \`npm run land\` does not.\n` +
      `Add it to STEPS in tools/land.mjs — or to ADVISORY, if it provably cannot\n` +
      `fail a build, with the reason beside it. An agent's licence to push to\n` +
      `main is that command being green.`,
    ).toEqual([]);
  });

  it('claims no step CI does not actually run', () => {
    const ci = land.ciScripts(workflow);
    const invented = land.STEPS.filter((s) => !ci.has(s));
    expect(
      invented,
      `tools/land.mjs runs ${invented.join(', ')}, which check.yml does not. Either\n` +
      `CI dropped a job and the landing is now stricter than the build, or the\n` +
      `step name is wrong and the landing has been failing on a typo.`,
    ).toEqual([]);
  });

  /**
   * THE WORKFLOW IT MUST REJECT.
   *
   * A rule nobody has watched fail is indistinguishable from a rule that cannot
   * fail, which is why every gate in this repo is a function over its input
   * rather than a script — `gates.test.ts` hands each one content it must
   * refuse. This does the same with a fourth job, because that is the shape of
   * the change that will actually happen: somebody adds a job, `land` does not
   * grow a step, and nothing anywhere says so.
   */
  it('catches a job added to CI that the landing does not run', () => {
    const fourth = `${workflow}
  smoke:
    name: smoke
    runs-on: ubuntu-latest
    steps:
      - run: npm ci
      - run: npm run smoke
`;
    const covered = new Set([...land.STEPS, ...land.ADVISORY]);
    const missed = [...land.ciScripts(fourth)].filter((s) => !covered.has(s));
    expect(missed, 'a fourth CI job went unnoticed by the derivation').toEqual(['smoke']);
  });

  it('reads a job the workflow does not have as no job at all', () => {
    // The other direction, so the test above is not passing on a parser that
    // simply reports everything. `npm ci` is environment and never a check.
    const bare = 'jobs:\n  lint:\n    steps:\n      - run: npm ci\n';
    expect([...land.ciScripts(bare)]).toEqual([]);
  });
});

/**
 * A BRANCH NAMED FOR AN ISSUE THAT LANDS WITHOUT CLOSING IT.
 *
 * `claude/issue-106-grlfdh` landed clean, CI went green, and #106 stayed
 * open — the commit's title carried `(#106)`, which GitHub does not read,
 * and no commit said `Closes #106`, which it does. The convention was
 * already correct in AGENTS.md and docs/PARALLEL.md; the session read
 * CLAUDE.md and went straight to `npm run land` without finding the
 * sentence. A rule that only lives in prose is a rule a landing can run
 * clean past, so this is the same argument `ciScripts` makes about a CI job
 * nobody remembered to add to the landing, one layer up: the check has to be
 * IN the command, not near it.
 */
describe('a branch named for an issue is refused if nothing closes it', () => {
  it('says nothing about a branch that does not name an issue', () => {
    expect(land.issueLeftOpen('claude/some-feature-abcxyz', 'did a thing, no issue involved')).toBeNull();
  });

  it('catches the actual bug: a title reference is not a closing keyword', () => {
    const msg = land.issueLeftOpen('claude/issue-106-grlfdh', 'Phase 14 layout: one client, 390px to ultrawide (#106)\n\nsome body text');
    expect(msg, '"(#106)" in a title read as though it closed the issue').not.toBeNull();
    expect(msg).toContain('#106');
  });

  it.each(['Closes #106', 'closes #106', 'Fixes #106', 'fixed #106', 'Resolves #106'])(
    'accepts %s as a real closing keyword',
    (line) => {
      expect(land.issueLeftOpen('claude/issue-106-grlfdh', `Some commit\n\n${line}`)).toBeNull();
    },
  );

  it('requires the keyword before EACH number, matching GitHub and janitor.sh', () => {
    // "Closes #106, #107" closes only #106 on GitHub — janitor.sh reads it the
    // same way on purpose, so what this refuses and what GitHub actually did
    // never diverge.
    expect(land.issueLeftOpen('claude/issue-107-x', 'Closes #106, #107'), 'a bare second number was read as closed').not.toBeNull();
    expect(land.issueLeftOpen('claude/issue-107-x', 'Closes #106, closes #107')).toBeNull();
  });

  it('is wired into the landing, not just exported and unused', () => {
    const source = readFileSync(join(REPO, 'tools/land.mjs'), 'utf8');
    expect(
      source,
      'issueLeftOpen is defined but the blockers array never calls it — the check ' +
      'exists and nothing runs it, which is invisible in exactly the way this bug was',
    ).toMatch(/issueLeftOpen\(branch,/);
    expect(source, 'there is no way to land anyway once the branch is right').toContain('--no-issue-check');
  });
});

/**
 * WHAT IT VERIFIES MUST BE WHAT IT PUSHES, AND ONE LANDING AT A TIME.
 *
 * Three failures on 2026-09-07 came from one shape. `land` ran its steps
 * against the live working tree and then pushed `HEAD:main`, which resolves
 * half an hour later:
 *
 *   9/9 gates pass
 *   $ git push origin HEAD:main
 *      ac12cda..02183f5  HEAD -> main
 *
 * That landing started at 891cac5 and verified 891cac5. `02183f5` was
 * committed while it ran and had been through no step at all. It reached trunk
 * under a green banner and CI failed it.
 *
 * It happened because a live landing was read as a dead one — empty log, no
 * `vitest` process, both equally consistent with "between steps" — and a
 * second was started over the same checkout.
 *
 * Both assertions below are from the SECOND actor's point of view, which is
 * the same choice `agents.test.ts` makes about the claim mutex: whether the
 * internals changed is an implementation detail, whether the other party is
 * stopped is the entire point.
 */
describe('a landing pushes what it verified, and only one runs at a time', () => {
  const TOOL = join(REPO, 'tools/land.mjs');
  const source = readFileSync(TOOL, 'utf8');

  it('pushes a named SHA rather than HEAD', () => {
    // The CALL, not the prose: land.mjs quotes `git push origin HEAD:main` in
    // the comment explaining what went wrong, and the first cut of this
    // assertion matched that — failing on the documentation of the bug.
    expect(
      source,
      '`land` still pushes HEAD:main. HEAD resolves at PUSH time, so a commit ' +
      'made during the half-hour run is what lands — unverified, under the ' +
      'green banner of the run that never saw it. Push the SHA captured before ' +
      'the steps.',
    ).not.toMatch(/run\('git', \[[^\]]*'HEAD:main'/);
    expect(source, 'nothing captures the commit being landed').toMatch(/const target = git\('rev-parse', 'HEAD'\)/);
    expect(source, 'the push does not use the captured commit').toMatch(/\$\{target\}:main/);
  });

  it('refuses a second landing and names the process holding it', () => {
    const held = { pid: process.pid, started: new Date().toISOString() };
    const lock = join(git(REPO, 'rev-parse', '--git-dir'), 'land.lock');
    const existed = existsSync(lock);
    const previous = existed ? readFileSync(lock, 'utf8') : null;
    writeFileSync(lock, JSON.stringify(held));
    try {
      const r = spawnSync('node', [TOOL], { encoding: 'utf8' });
      expect(r.status, 'a second landing was allowed to start').not.toBe(0);
      const out = `${r.stdout}${r.stderr}`;
      expect(out).toContain('already running');
      // The sentence that was missing: which process, and since when. Without
      // it the only evidence is an empty log, which reads as death.
      expect(out).toContain(String(process.pid));
      expect(out).toContain(held.started);
    } finally {
      if (previous !== null) writeFileSync(lock, previous);
      else if (existsSync(lock)) unlinkSync(lock);
    }
  });

  /**
   * THE STEPS RUN SOMEWHERE THE SESSION CANNOT REACH.
   *
   * This is the fix that removes the condition rather than guarding it. The
   * steps used to run against the live working tree, so a landing and its own
   * session could not share a container: a landing was started, the next issue
   * was worked while its suite ran, and the suite verified a tree carrying
   * changes the push would not carry.
   *
   * Asserted on the SOURCE rather than by running a thirty-minute landing,
   * which is the honest trade: what this can prove cheaply is that the steps
   * are handed a cwd that is not this checkout, and that the worktree is
   * cleaned up however the landing ends. That a landing is unaffected by
   * concurrent edits is acceptance criterion 3 on #130 and belongs to a person
   * with half an hour, not to the fast lane.
   */
  it('runs its steps in a worktree rather than in the session checkout', () => {
    expect(source, 'no worktree is created').toMatch(/worktree', 'add', '--detach'/);
    expect(
      source,
      'the steps are not handed the worktree as their cwd, so they still run ' +
      'against the live tree and a landing still forbids its own session to type',
    ).toMatch(/run\('npm', \['run', step\], tree\)/);
  });

  it('removes the worktree however the landing ends', () => {
    // A worktree left behind is registered in `.git/worktrees`, and the next
    // `git worktree add` at that path refuses — one abandoned landing would
    // otherwise break every landing after it, which is the same shape as a
    // stale lock.
    expect(source).toMatch(/worktree', 'remove', '--force'/);
    expect(source, 'cleanup is not attached to exit').toMatch(/process\.on\('exit', sweep\)/);
  });

  it('no longer re-checks the tree, because the condition is gone', () => {
    // The guard it replaces. Keeping both would leave a landing still refusing
    // on an edit it is now immune to.
    expect(
      source,
      'the tree re-check survived the worktree change — a landing that cannot ' +
      'be affected by an edit must not abandon itself over one',
    ).not.toMatch(/the working tree changed while the checks ran/);
  });

  /**
   * The other direction, and the one that turns a bad landing into every
   * future landing refusing: a lock whose holder is gone must be taken, not
   * obeyed. A stale lock is the failure mode of every lock file ever written.
   */
  it('clears a lock left behind by a process that is gone', () => {
    const lock = join(git(REPO, 'rev-parse', '--git-dir'), 'land.lock');
    const existed = existsSync(lock);
    const previous = existed ? readFileSync(lock, 'utf8') : null;
    // pid 2^22 is above every Linux default pid_max and owned by nothing.
    writeFileSync(lock, JSON.stringify({ pid: 4194303, started: '2026-01-01T00:00:00Z' }));
    try {
      const r = spawnSync('node', [TOOL, '--dry-run'], { encoding: 'utf8' });
      const out = `${r.stdout}${r.stderr}`;
      expect(out, 'a dead holder still blocked a landing').not.toContain('already running');
    } finally {
      if (previous !== null) writeFileSync(lock, previous);
      else if (existsSync(lock)) unlinkSync(lock);
    }
  });
});

describe('the landing is reachable and documented as the licence', () => {
  it('is an npm script', () => {
    const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.land, 'package.json has no `land` script').toContain('tools/land.mjs');
  });

  it('is what AGENTS.md names in the standing authorisation', () => {
    // The sentence granting a push to trunk with no review is the one place in
    // this repository where naming the wrong command has already cost four red
    // runs on `main`. It is worth asserting the sentence itself.
    //
    // PROSE WRAPS, and this rule was line-based: the sentence and the command
    // it licenses sat on one 900-character line, and the first edit that
    // rewrapped the bullet moved `npm run land` onto the next line and failed
    // a build over a paragraph break. `codemap.test.ts` learned the same thing
    // about its timing rule. Continuation lines are indented, so folding them
    // into their bullet turns each bullet back into one line to match against.
    //
    // `[ \t]` and NOT `\s`, which matches a newline: `\n\s+` folds a blank line
    // too, so the whole document collapses onto one line, that line contains
    // every phrase in the file, and the rule passes on an AGENTS.md licensing
    // `npm run check`. Checked by mutating the file and watching this fail.
    const agents = readFileSync(join(REPO, 'AGENTS.md'), 'utf8').replace(/\n[ \t]+/g, ' ');
    const rule = agents
      .split('\n')
      .filter((l) => /standing authorization|standing authorisation/i.test(l))
      .join('\n');
    expect(rule, 'AGENTS.md no longer states a standing authorisation at all').not.toEqual('');
    expect(
      rule,
      'the standing authorisation still licenses a push on a command that is not the ' +
      'landing. It must name `npm run land`, which is the set CI runs.',
    ).toContain('npm run land');
  });
});
