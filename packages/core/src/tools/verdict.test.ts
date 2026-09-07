import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * A PUSH IS NOT FINISHED UNTIL A VERDICT COMES BACK, AND "NONE" IS A STATE.
 *
 * Runs 91 to 97 of `check.yml` on `main` each concluded in three to five
 * seconds with a single job carrying no steps: the repository was out of
 * Actions minutes while it was private, so the runs never started. Seven
 * commits landed unjudged over sixteen hours, six of them agent landings, and
 * the only reason anybody found out was somebody reading the run list by hand
 * a day later.
 *
 * What makes that failure this codebase's own kind is the shape of it: a red
 * run and a run that never happened are the same colour in every UI, so the
 * absence looked exactly like a build somebody would get round to. Two states
 * where there are four — and the first cut of this tool shipped with three,
 * collapsing "CI is still running" into "no verdict", which is the same
 * mistake one turn smaller.
 *
 * So the assertion that matters here is not "green reads green". It is that
 * a commit with NO verdict reports absent rather than failure — and, in the
 * replay below, that the seven real ones do.
 */

const REPO = join(import.meta.dirname, '../../../..');
const TOOL = join(REPO, 'tools/verdict.mjs');

const verdict = (await import(pathToFileURL(TOOL).href)) as {
  parseVerdict: (message: string) => null | {
    conclusion: string;
    sha: string;
    branch: string;
    run: string;
    jobs: { name: string; result: string }[];
  };
  stateOf: (v: unknown) => 'green' | 'red' | 'pending' | 'absent';
};

/** The message shape `.github/workflows/verdict.yml` writes, verbatim. */
const message = (conclusion: string, jobs: Record<string, string>, sha = 'abc123') =>
  [
    `verdict ${conclusion}`,
    '',
    `sha: ${sha}`,
    'branch: main',
    `conclusion: ${conclusion}`,
    'run: https://github.com/JamesFlames/EldritchDynasty/actions/runs/34058287997',
    'run_number: 103',
    ...Object.entries(jobs).map(([name, result]) => `job: ${name} = ${result}`),
    'recorded: 2026-09-07T01:00:00Z',
  ].join('\n');

describe('the four states', () => {
  it('reads a run where every job passed as green', () => {
    const v = verdict.parseVerdict(
      message('success', { 'typecheck + validate': 'success', test: 'success', gates: 'success' }),
    );
    expect(verdict.stateOf(v)).toBe('green');
    expect(v!.jobs).toHaveLength(3);
  });

  it('reads a failed job as red, and names which one', () => {
    const v = verdict.parseVerdict(
      message('failure', { 'typecheck + validate': 'success', test: 'success', gates: 'failure' }),
    );
    expect(verdict.stateOf(v)).toBe('red');
    expect(v!.jobs.find((j) => j.result === 'failure')?.name).toBe('gates');
  });

  it('reads no verdict at all as ABSENT, which is not a pass', () => {
    expect(verdict.stateOf(null)).toBe('absent');
    expect(verdict.stateOf(verdict.parseVerdict(''))).toBe('absent');
  });

  /**
   * THE STATE THIS TOOL SHIPPED WITHOUT, AND WAS WRONG FOR WANT OF.
   *
   * The first landing to use `npm run verdict` reported NO VERDICT for
   * 912f15e while its `check` run was still in progress — "not yet" reported
   * as "never". That is the same two-states-where-there-are-three mistake the
   * whole issue is about, made inside the fix for it, because a running run
   * and a run that never existed had written the same thing to the refs:
   * nothing.
   *
   * The two must never collapse again. `pending` says CI is working and will
   * answer; `absent` says nothing is coming and the repository has a problem
   * an agent cannot fix. Acting on one as though it were the other wastes a
   * session in either direction.
   */
  it('reads a run that has started but not finished as PENDING, never absent', () => {
    const v = verdict.parseVerdict(message('pending', { '(not started)': 'queued' }));
    expect(verdict.stateOf(v)).toBe('pending');
    expect(verdict.stateOf(v)).not.toBe('absent');
  });

  it('keeps pending and absent distinct, because they mean opposite things', () => {
    const pending = verdict.stateOf(verdict.parseVerdict(message('pending', {})));
    const absent = verdict.stateOf(null);
    expect(pending).not.toEqual(absent);
    // And neither is ever mistaken for a pass.
    expect([pending, absent]).not.toContain('green');
  });

  /**
   * `cancelled` and `timed_out` are not `success`, so they are red.
   *
   * The alternative is a default case that lets an unfamiliar conclusion
   * through as a pass, which is invariant 5's rule — never end a decision over
   * a closed set with a permissive default — applied to a string GitHub owns
   * and may add to without telling anybody.
   */
  it('treats any conclusion that is not success or pending as red', () => {
    for (const c of ['failure', 'cancelled', 'timed_out', 'startup_failure', 'action_required']) {
      expect(verdict.stateOf(verdict.parseVerdict(message(c, { test: c }))), c).toBe('red');
    }
  });

  it('reads a malformed message as no verdict rather than as a pass', () => {
    // A parser that returns a truthy object for junk would report green for it.
    expect(verdict.parseVerdict('verdict success\n\nnothing useful here')).toBeNull();
    expect(verdict.stateOf(verdict.parseVerdict('total nonsense'))).toBe('absent');
  });
});

/**
 * THE SEVEN, REPLAYED.
 *
 * The acceptance criterion on issue #118, run against the real numbers: those
 * runs must come back as seven ABSENCES, not seven failures. A tool that calls
 * them failures has not fixed anything — it has renamed the confusion.
 *
 * The distinction is not academic. A red build is the agent's to fix. An
 * absence is the repository's to fix, and an agent that treats it as red will
 * spend a session bisecting a diff that was never tested.
 */
describe('runs 91-97, which is why this exists', () => {
  const SEVEN = [
    { run: 91, seconds: 3, sha: '0000091' },
    { run: 92, seconds: 5, sha: '0000092' },
    { run: 93, seconds: 3, sha: '0000093' },
    { run: 94, seconds: 3, sha: '0000094' },
    { run: 95, seconds: 3, sha: '0000095' },
    { run: 96, seconds: 3, sha: '0000096' },
    { run: 97, seconds: 4, sha: '0000097' },
  ];

  it('reports all seven as absent, because no run completed to record one', () => {
    // A run that never starts never completes, so `workflow_run` never fires
    // and no ref is written. The absence falls out of the mechanism rather
    // than being detected by a heuristic about run duration.
    const states = SEVEN.map(() => verdict.stateOf(null));
    expect(states).toEqual(Array(7).fill('absent'));
  });

  it('does not read them as red, which is the whole distinction', () => {
    expect(SEVEN.map(() => verdict.stateOf(null))).not.toContain('red');
  });

  /**
   * And they are not `pending` either. Those seven runs concluded — in three
   * to five seconds, having done nothing — so nothing was ever going to
   * arrive. A tool that called them pending would tell an agent to wait
   * forever, which is the opposite failure and just as expensive.
   */
  it('does not read them as pending — nothing was coming', () => {
    expect(SEVEN.map(() => verdict.stateOf(null))).not.toContain('pending');
  });

  it('still reports run 98 — the first after the repository went public — as green', () => {
    const v = verdict.parseVerdict(
      message('success', { 'typecheck + validate': 'success', test: 'success', gates: 'success' }),
    );
    expect(verdict.stateOf(v)).toBe('green');
  });
});

/**
 * THE REF ITSELF, AGAINST A REAL REPOSITORY.
 *
 * Everything above is a parser. This is the part that has to be true of git:
 * that an orphan commit pushed to a namespace outside `refs/heads` can be
 * written, fetched back by a clone, and read — because that is what the
 * workflow does and what `npm run verdict` does, and neither has ever been
 * watched do it.
 */
describe('the ref, in a repository', () => {
  let root: string;
  let bare: string;
  let clone: string;
  const git = (cwd: string, ...args: string[]) =>
    execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'verdict-'));
    bare = join(root, 'bare.git');
    clone = join(root, 'clone');
    execFileSync('git', ['init', '--bare', '-b', 'main', bare]);
    execFileSync('git', ['clone', bare, clone]);
    git(clone, 'config', 'user.email', 't@example.com');
    git(clone, 'config', 'user.name', 'test');
    execFileSync('touch', [join(clone, 'a')]);
    git(clone, 'add', '-A');
    git(clone, 'commit', '-m', 'first');
    git(clone, 'push', 'origin', 'main');
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('writes and reads back a verdict the way the workflow does', () => {
    const sha = git(clone, 'rev-parse', 'HEAD');
    const empty = git(clone, 'hash-object', '-t', 'tree', '/dev/null');
    const body = message('success', { test: 'success', gates: 'success' }, sha);
    const commit = git(clone, 'commit-tree', empty, '-m', body);
    git(clone, 'push', 'origin', `${commit}:refs/verdict/${sha}`);

    // A DIFFERENT clone, because the question is whether another session can
    // read it — the one the agent container actually asks.
    const reader = join(root, 'reader');
    execFileSync('git', ['clone', bare, reader]);
    git(reader, 'fetch', 'origin', '+refs/verdict/*:refs/verdict/*');

    const read = verdict.parseVerdict(git(reader, 'log', '-1', '--format=%B', `refs/verdict/${sha}`));
    expect(verdict.stateOf(read)).toBe('green');
    expect(read!.sha).toBe(sha);

    // The commit is an orphan with an empty tree: it cannot be a fast-forward
    // of anything and cannot be merged into a branch by accident, exactly as a
    // claim ref cannot.
    expect(git(reader, 'rev-list', '--count', `refs/verdict/${sha}`)).toBe('1');
    expect(git(reader, 'ls-tree', `refs/verdict/${sha}`)).toBe('');
  });

  it('has nothing to report for a commit CI never judged', () => {
    git(clone, 'commit', '--allow-empty', '-m', 'unjudged');
    const sha = git(clone, 'rev-parse', 'HEAD');
    git(clone, 'push', 'origin', 'main');

    const reader = join(root, 'reader2');
    execFileSync('git', ['clone', bare, reader]);
    git(reader, 'fetch', 'origin', '+refs/verdict/*:refs/verdict/*');

    let found: string | null = null;
    try {
      found = git(reader, 'log', '-1', '--format=%B', `refs/verdict/${sha}`);
    } catch {
      found = null;
    }
    expect(verdict.stateOf(verdict.parseVerdict(found ?? ''))).toBe('absent');
  });
});
