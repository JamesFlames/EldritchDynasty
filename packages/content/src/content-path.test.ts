import { describe, expect, it } from 'vitest';
import { join, resolve } from 'node:path';
import { ContentPathError, resolveContentPath } from '../tools/content-path.mjs';

/**
 * THE GUARD ON THE ONE WRITABLE DIRECTORY.
 *
 * Written out four times across two transports and never once tested, which is
 * how three of the four copies came to disagree with each other. The weak one
 * was on the WRITE half of the dev-server bridge, and it let a sibling
 * directory through — `packages/content-x/` starts with `packages/content`.
 *
 * The table below is mostly refusals, because a guard is mostly refusals, and
 * the only way to know one works is to hand it the things it exists to stop.
 */

const ROOT = resolve('/repo/packages/content');

const rejects = (path: unknown) => expect(() => resolveContentPath(ROOT, path)).toThrow(ContentPathError);

describe('resolveContentPath admits content files', () => {
  it('takes an ordinary path under the root', () => {
    expect(resolveContentPath(ROOT, 'events/portions.yaml')).toBe(join(ROOT, 'events/portions.yaml'));
  });

  it('takes a file sitting directly in the root', () => {
    expect(resolveContentPath(ROOT, 'careers.yaml')).toBe(join(ROOT, 'careers.yaml'));
  });

  it('normalises a path that goes down and back up without leaving', () => {
    expect(resolveContentPath(ROOT, 'events/../careers.yaml')).toBe(join(ROOT, 'careers.yaml'));
  });
});

describe('resolveContentPath refuses everything else', () => {
  /**
   * THE DRIFT, as a test. `resolve` lands this at `packages/content-x/a.yaml`,
   * which `startsWith('/repo/packages/content')` answers TRUE for. The read
   * half caught it; the write half did not.
   */
  it('refuses a sibling directory that merely shares the root prefix', () => {
    rejects('../content-x/a.yaml');
    rejects('../contentx/a.yaml');
    rejects('../content-evil/events/a.yaml');
  });

  it('refuses a climb out of the repo', () => {
    rejects('../../../etc/passwd.yaml');
    rejects('../../schema/src/rules.yaml');
  });

  it('refuses an absolute path', () => {
    rejects('/etc/passwd.yaml');
    rejects(join(ROOT, '..', 'elsewhere.yaml'));
  });

  it('refuses the root directory itself', () => {
    rejects('');
    rejects('.');
    rejects('events/..');
  });

  /**
   * The shell refused non-YAML and the dev server did not, so the same editor
   * could write `.env` through one transport and not the other. The stricter
   * of the two is the correct one.
   */
  it('refuses anything that is not YAML, on both transports now', () => {
    rejects('events/portions.yml');
    rejects('.env');
    rejects('events/notes.md');
    rejects('events/');
  });

  it('refuses a path that is not a string at all', () => {
    rejects(undefined);
    rejects(null);
    rejects(42);
    rejects({ path: 'events/portions.yaml' });
  });

  it('says which rule refused, so the transport can report it', () => {
    expect(() => resolveContentPath(ROOT, '../content-x/a.yaml')).toThrow(/escapes content root/);
    expect(() => resolveContentPath(ROOT, 'events/notes.md')).toThrow(/YAML/);
  });
});
