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
    const agents = readFileSync(join(REPO, 'AGENTS.md'), 'utf8');
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
