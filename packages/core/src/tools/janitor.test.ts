import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * THE SWEEP, AND THE CLONE THAT MAKES IT LIE.
 *
 * `tools/janitor.sh` deletes branches whose head is already an ancestor of
 * main. The first time it ran for real it deleted every branch on the remote,
 * and the reason took a truth table to find: an agent's container clones
 * SHALLOW — 59 commits of a 141-commit history — and `git merge-base
 * --is-ancestor` cannot walk past the graft boundary. It does not error there.
 * It answers FALSE, for every branch older than the shallow window, silently.
 *
 * So the same script over the same refs said "7 merged, 29 kept" in the
 * container and "36 merged" on a runner with fetch-depth: 0, and the second one
 * was right. A wrong answer that looks like a cautious answer is the worst
 * shape a check can have, and this repository is full of the same lesson:
 * nothing throws, so the failure is always something quietly not happening.
 *
 * These tests pin the three things that matter: it refuses on a shallow clone,
 * it is correct on a full one, and it pauses rather than acting when nearly
 * every branch comes back merged.
 */

const TOOL = join(import.meta.dirname, '../../../../tools/janitor.sh');

let root: string;
const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

const janitor = (cwd: string, env: Record<string, string> = {}) => {
  try {
    const out = execFileSync('bash', [TOOL], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_STEP_SUMMARY: '/dev/null', ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { code: err.status, out: `${err.stdout}${err.stderr}` };
  }
};

const branches = (bare: string) =>
  git(bare, 'for-each-ref', '--format=%(refname:short)', 'refs/heads/').split('\n').sort();

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'ed-janitor-'));
  const bare = join(root, 'origin.git');
  // `-b main`: a bare repo whose HEAD names a branch that never gets created
  // clones as an empty repository, and the fixture then proves nothing.
  git(root, 'init', '-q', '--bare', '-b', 'main', bare);
  git(root, 'clone', '-q', bare, 'seed');
  const seed = join(root, 'seed');
  git(seed, 'config', 'user.email', 'a@example.com');
  git(seed, 'config', 'user.name', 'a');

  // A history deep enough that a --depth 1 clone cannot see the bottom of it.
  for (let i = 0; i < 12; i++) git(seed, 'commit', '-q', '--allow-empty', '-m', `main ${i}`);
  git(seed, 'push', '-q', 'origin', 'HEAD:refs/heads/main');

  // `landed` is an old commit ON main's own history: genuinely merged, and old
  // enough to sit outside a shallow window. This is the branch the shallow
  // clone gets wrong.
  git(seed, 'push', '-q', 'origin', `${git(seed, 'rev-parse', 'HEAD~8')}:refs/heads/claude/landed`);
  git(seed, 'checkout', '-q', '-b', 'claude/in-flight');
  git(seed, 'commit', '-q', '--allow-empty', '-m', 'work nobody has merged');
  git(seed, 'push', '-q', 'origin', 'HEAD:refs/heads/claude/in-flight');

  git(root, 'clone', '-q', bare, 'full');
  // file://, because `--depth` is ignored for a plain local path.
  git(root, 'clone', '-q', '--depth', '1', `file://${bare}`, 'shallow');
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('the janitor', () => {
  it('refuses to run on a shallow clone rather than answering wrongly', () => {
    const shallow = join(root, 'shallow');
    expect(git(shallow, 'rev-parse', '--is-shallow-repository')).toBe('true');

    const r = janitor(shallow, { DRY_RUN: '1' });
    expect(r.code).toBe(2);
    expect(r.out).toContain('shallow');
    // The point of the guard: on this clone the merged branch reads as unmerged,
    // so every answer it could give would be wrong in one direction or the other.
    expect(r.out).not.toContain('decide claude/landed');
  });

  it('leaves every branch alone when it refuses', () => {
    const before = branches(join(root, 'origin.git'));
    janitor(join(root, 'shallow'));
    expect(branches(join(root, 'origin.git'))).toEqual(before);
  });

  it('tells merged from unmerged on a full clone', () => {
    const r = janitor(join(root, 'full'), { DRY_RUN: '1' });
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/decide claude\/landed:.*MERGED/);
    expect(r.out).toMatch(/decide claude\/in-flight:.*keep/);
    expect(r.out).toContain('would: git push origin --delete claude/landed');
    expect(r.out).not.toContain('delete claude/in-flight');
  });

  it('pauses instead of sweeping when nearly every branch comes back merged', () => {
    // Half the branches here are merged, so a 40% ceiling trips. The ceiling is
    // not a correctness check — a backlog nobody could ever delete legitimately
    // looks like this — it is the thing that makes a NEW failure need a human.
    const r = janitor(join(root, 'full'), { DRY_RUN: '1', JANITOR_MAX_SHARE: '40' });
    expect(r.code).toBe(1);
    expect(r.out).toContain('REFUSED');
    expect(r.out).not.toContain('would: git push origin --delete');
  });

  it('sweeps when the ceiling is deliberately raised', () => {
    const r = janitor(join(root, 'full'), { DRY_RUN: '1', JANITOR_MAX_SHARE: '99' });
    expect(r.code).toBe(0);
    expect(r.out).toContain('would: git push origin --delete claude/landed');
  });
});
