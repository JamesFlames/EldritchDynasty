import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readUserContent, userContentRoot } from './user-content.mjs';

const roots: string[] = [];
function temp(): string {
  const root = mkdtempSync(join(tmpdir(), 'ed-user-content-'));
  roots.push(root);
  return root;
}
afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe('desktop user content', () => {
  it('uses one profile-owned root without creating it merely by reading', () => {
    const profile = temp();
    const root = userContentRoot(profile);
    expect(root).toBe(join(profile, 'mods', 'content'));
    expect(readUserContent(root)).toEqual({});
  });

  it('reads YAML recursively with content-relative keys and ignores other files', () => {
    const profile = temp();
    const root = userContentRoot(profile);
    mkdirSync(join(root, 'events'), { recursive: true });
    writeFileSync(join(root, 'events', 'my_event.yaml'), 'events: []\n');
    writeFileSync(join(root, 'readme.txt'), 'not content');
    expect(readUserContent(root)).toEqual({ 'events/my_event.yaml': 'events: []\n' });
  });
});
