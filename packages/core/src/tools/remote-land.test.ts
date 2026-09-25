import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO = join(import.meta.dirname, '../../../..');
const WORKFLOW = join(REPO, '.github/workflows/remote-land.yml');
const workflow = readFileSync(WORKFLOW, 'utf8');

/**
 * Connector-only sessions cannot execute a local landing, but that must not
 * create a second, weaker meaning of "green". The remote path is intentionally
 * a thin transport: authorize one exact PR head, then run tools/land.mjs.
 */
describe('the connector-only remote landing', () => {
  it('starts only from an explicit /land comment on a pull request', () => {
    expect(workflow).toContain('issue_comment:');
    expect(workflow).toContain("github.event.comment.body == '/land'");
    expect(workflow).toContain('github.event.issue.pull_request');
    expect(workflow, 'pull_request_target would execute PR code with a write token').not.toContain('pull_request_target:');
  });

  it('serializes writes to main rather than cancelling an active landing', () => {
    expect(workflow).toContain('group: remote-land-main');
    expect(workflow).toContain('cancel-in-progress: false');
  });

  it('authorizes the actor and only accepts a ready same-repository PR to main', () => {
    expect(workflow).toContain('getCollaboratorPermissionLevel');
    expect(workflow).toContain("['admin', 'maintain', 'write']");
    expect(workflow).toContain("pr.state !== 'open'");
    expect(workflow).toContain('pr.draft');
    expect(workflow).toContain("pr.base.ref !== 'main'");
    expect(workflow).toContain("pr.head.repo.full_name !== `${owner}/${repo}`");
  });

  it('checks out the exact authorized head with full history, then restores its branch name', () => {
    expect(workflow).toContain('ref: ${{ steps.pr.outputs.head_sha }}');
    expect(workflow).toContain('fetch-depth: 0');
    expect(workflow).toContain('git switch -c "$HEAD_REF" "$HEAD_SHA"');
  });

  it('runs the one landing command rather than hand-copying its checks', () => {
    expect(workflow).toContain('run: npm run land');
    expect(workflow, 'remote landing must not substitute the incomplete npm run check').not.toContain('run: npm run check');
    expect(workflow, 'the workflow must not bypass land.mjs with its own direct main push').not.toMatch(/run:\s*git push[^\n]*:main/);
  });

  it('reports failures too, because a failed landing may already have pushed', () => {
    expect(workflow).toContain("if: always() && steps.pr.outcome == 'success'");
    expect(workflow).toContain('steps.landing.outcome');
    expect(workflow).toContain('A landing can fail before or after its push');
  });
});
