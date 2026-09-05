import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * THE MUTEX THAT LETS SEVERAL AGENTS SHARE THIS REPOSITORY.
 *
 * `tools/agents.mjs` is the claim tool — see docs/PARALLEL.md. It lives at the
 * repository root as plain `.mjs` rather than in this directory as TypeScript
 * because an agent runs it before it has decided whether to `npm install`, and
 * `tsx` is a dependency. The test belongs here, where the suite is.
 *
 * What is worth testing is exactly one thing: that two agents cannot both hold
 * one issue. Everything else the tool does is printing. And the failure it
 * guards is the quiet kind this codebase specialises in — two sessions working
 * the same issue for an afternoon look, from inside either one, precisely like
 * one session working it.
 *
 * So the test stands up a bare repository and two clones of it, and races them.
 * The guarantee being leaned on is git's own: a push that creates a ref which
 * already exists, carrying a commit that is not a descendant of the one there,
 * is rejected by the receiving end. The claim commits are ORPHANS, so no second
 * claim can ever be a descendant of the first, so the second push always loses.
 */

const TOOL = join(import.meta.dirname, '../../../../tools/agents.mjs');
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

let root: string;
const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

/** Returns the tool's exit code and its output, because a DENIED must be both. */
const agents = (cwd: string, ...args: string[]) => {
  try {
    return { code: 0, out: execFileSync('node', [TOOL, ...args], { cwd, encoding: 'utf8' }) };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { code: err.status, out: `${err.stdout}${err.stderr}` };
  }
};

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'ed-agents-'));
  git(root, 'init', '-q', '--bare', 'origin.git');
  git(root, 'init', '-q', 'alpha');
  const alpha = join(root, 'alpha');
  git(alpha, 'config', 'user.email', 'alpha@example.com');
  git(alpha, 'config', 'user.name', 'alpha');
  git(alpha, 'commit', '-q', '--allow-empty', '-m', 'init');
  git(alpha, 'remote', 'add', 'origin', join(root, 'origin.git'));
  git(alpha, 'push', '-q', 'origin', 'HEAD:refs/heads/main');
  git(root, 'clone', '-q', join(root, 'origin.git'), 'beta');
  const beta = join(root, 'beta');
  git(beta, 'config', 'user.email', 'beta@example.com');
  git(beta, 'config', 'user.name', 'beta');
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('the claim ref', () => {
  it('gives an issue to one agent and refuses the other', () => {
    const taken = agents(join(root, 'alpha'), 'take', '101', '--agent', 'alpha', '--paths', 'packages/core/src/land.ts');
    expect(taken.code).toBe(0);
    expect(taken.out).toContain('held: 101');

    const denied = agents(join(root, 'beta'), 'take', '101', '--agent', 'beta');
    expect(denied.code).toBe(1);
    expect(denied.out).toContain('DENIED');
    expect(denied.out).toContain('alpha');
  });

  it('rejects a claim pushed straight at a ref somebody holds — the guarantee under the tool', () => {
    const beta = join(root, 'beta');
    const orphan = git(beta, 'commit-tree', EMPTY_TREE, '-m', 'claim 101\n\nagent: beta');
    expect(() => git(beta, 'push', 'origin', `${orphan}:refs/heads/claim/101`)).toThrow();
  });

  it('warns the taker when another agent has declared the same paths', () => {
    const out = agents(join(root, 'beta'), 'take', '102', '--agent', 'beta', '--paths', 'packages/core/src/land.ts');
    expect(out.code).toBe(0);
    expect(out.out).toContain('overlapping paths on 101');
  });

  it('warns when a second agent enters the content lane, where branches interact', () => {
    agents(join(root, 'alpha'), 'take', '103', '--agent', 'alpha', '--paths', 'packages/content/events');
    const out = agents(join(root, 'beta'), 'take', '104', '--agent', 'beta', '--paths', 'packages/content/ages');
    expect(out.out).toContain('CONTENT lane');
  });

  it('releases by tombstone rather than by deleting the ref, and the next agent can take it', () => {
    // Deleting would be tidier. A web session's git proxy refuses ref deletion
    // with a 403, so a release that deleted would work on a laptop and leave
    // the issue permanently held in a container.
    const released = agents(join(root, 'alpha'), 'release', '101', '--agent', 'alpha');
    expect(released.code).toBe(0);
    expect(git(join(root, 'origin.git'), 'rev-parse', '--verify', 'refs/heads/claim/101')).toMatch(/^[0-9a-f]{40}$/);

    expect(agents(join(root, 'beta'), 'list').out).not.toContain('101 ');
    const retaken = agents(join(root, 'beta'), 'take', '101', '--agent', 'beta');
    expect(retaken.code).toBe(0);
    expect(retaken.out).toContain('held: 101');
  });

  it('will not release another agent\'s claim without being told twice', () => {
    const out = agents(join(root, 'alpha'), 'release', '101', '--agent', 'alpha');
    expect(out.code).toBe(2);
    expect(out.out).toContain('held by beta');
  });

  it('refuses to steal a claim that is not stale, and takes one that is', () => {
    const fresh = agents(join(root, 'alpha'), 'steal', '101', '--agent', 'alpha');
    expect(fresh.code).toBe(2);
    expect(fresh.out).toContain('not stale yet');

    // A session that died without releasing: the claim stands, nothing renews it.
    const beta = join(root, 'beta');
    const old = new Date(Date.now() - 9 * 3600 * 1000).toISOString();
    const stale = execFileSync('git', ['commit-tree', EMPTY_TREE, '-m', 'claim 105\n\nagent: ghost\nlane: code'], {
      cwd: beta,
      encoding: 'utf8',
      env: { ...process.env, GIT_AUTHOR_DATE: old, GIT_COMMITTER_DATE: old },
    }).trim();
    git(beta, 'push', '-q', 'origin', `${stale}:refs/heads/claim/105`);

    const stolen = agents(join(root, 'alpha'), 'steal', '105', '--agent', 'alpha');
    expect(stolen.code).toBe(0);
    expect(stolen.out).toContain('stolen: 105');
  });

  it('spells out the closing keywords for every issue one branch is holding', () => {
    // A branch lands as many issues as it claimed, and GitHub needs the keyword
    // before EACH number: `Closes #12, closes #13` closes both, `Closes #12,
    // #13` closes only #12. That rule is discovered by finding the second issue
    // still open a week later, so the tool writes the line out.
    agents(join(root, 'alpha'), 'take', '200', '--agent', 'epic');
    const second = agents(join(root, 'alpha'), 'take', '201', '--agent', 'epic');
    expect(second.out).toContain('Closes #200, closes #201');

    const checked = agents(join(root, 'alpha'), 'check', '--agent', 'epic');
    expect(checked.out).toContain('landing commit needs: Closes #200, closes #201');
  });

  it('reports an overlap from check, and says so in its exit code', () => {
    // `check` is what an agent runs before the nine-minute check, to find out
    // whether somebody landed in its paths while it worked.
    const out = agents(join(root, 'beta'), 'check', '--agent', 'beta');
    expect(out.code).toBe(1);
    expect(out.out).toMatch(/same paths|CONTENT lane/);
  });
});
