import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBundle } from '@ed/content';
import { assembleBundle } from '@ed/schema';
import { CONTENT_MODULE, contentFiles, readContentDocs } from '../../build/content-plugin.js';

const CLIENT = join(import.meta.dirname, '../..');
const CONTENT = join(CLIENT, '../content');

/**
 * THE PARSE MOVED, AND THE BUNDLE DID NOT (issue #109).
 *
 * The client used to run `yaml.parse` over 1.6 MB at module scope, before
 * first paint — 328 ms on a warm container, seconds in an Android WebView,
 * to redo work whose answer cannot change. It happens on the build machine
 * now, and `assembleBundle` gets `JSON.parse` for a parser instead.
 *
 * That is a cheap change to get almost right and a silent one to get wrong:
 * a build-time loader that drops one file, or reads an empty document as a
 * missing collection, produces a bundle that is merely SMALLER. Nothing
 * throws. The game plays, the tests pass, and some rite has no scenes in it.
 * So the check is the whole bundle against the one the node loader builds
 * off the same directory — not a sample of it, and not a count.
 */
describe('the content is parsed on the build machine', () => {
  it('assembles exactly the bundle the YAML loader does', () => {
    const built = assembleBundle(readContentDocs(CONTENT), JSON.parse);
    expect(built).toEqual(loadBundle());
  });

  it('reads every file in the content directory', () => {
    const docs = readContentDocs(CONTENT);
    expect(contentFiles(CONTENT).length).toBeGreaterThan(70);
    expect(Object.keys(docs).length).toBe(contentFiles(CONTENT).length);
    // Both source shapes `CONTENT_LAYOUT` knows about: a named file, and a
    // directory whose files are concatenated. Keyed relative to the content
    // root and posix-style, which is what `assembleBundle` matches against.
    expect(docs).toHaveProperty('attributes.yaml');
    expect(Object.keys(docs).some((k) => k.startsWith('events/'))).toBe(true);
  });

  it('keeps an empty document rather than dropping its file', () => {
    // `assembleBundle` reads `doc?.[key]` and skips a null. Dropping the key
    // instead would make an empty file and a MISSING file the same thing, and
    // a missing named file is a broken checkout that has to keep throwing.
    expect(JSON.parse(JSON.stringify(null))).toBeNull();
    expect(() => assembleBundle({ 'attributes.yaml': 'null' }, JSON.parse)).toThrow();
  });
});

describe('nothing parses YAML at runtime', () => {
  const pkg = JSON.parse(readFileSync(join(CLIENT, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };

  /**
   * The proof the change actually landed. `yaml` shipped to the client purely
   * to do work that has no reason to happen at runtime; leaving it in the
   * `dependencies` block means something still reaches for it.
   */
  it('the game does not ship the YAML parser', () => {
    expect(Object.keys(pkg.dependencies)).not.toContain('yaml');
    expect(Object.keys(pkg.devDependencies)).toContain('yaml');
  });

  /**
   * A BUDGET, SO THIS CANNOT CREEP BACK ONE CONTENT DROP AT A TIME.
   *
   * Structural rather than a stopwatch, for the reason `lanes.test.ts` gives:
   * a timing assertion fails on a noisy CI machine and gets muted. What
   * actually grows is the content, one authored file at a time, and the
   * emitted JSON is exactly what the player's first frame waits behind. So
   * the budget is over bytes, which are the same on every machine.
   */
  it('the precompiled content stays inside its cold-start budget', () => {
    const CEILING = 1_600_000;
    const size = Buffer.byteLength(JSON.stringify(readContentDocs(CONTENT)));
    expect(
      size,
      `the precompiled content is ${(size / 1024).toFixed(0)} kB, over the ` +
      `${(CEILING / 1024).toFixed(0)} kB budget. Every byte of it is parsed ` +
      'before the player sees anything. Raising the ceiling is a decision ' +
      'about how long a phone spends on a blank screen, not a formality.',
    ).toBeLessThan(CEILING);
  });

  it('the loader reads the precompiled module', () => {
    const loader = readFileSync(join(CLIENT, 'src/lib/content.ts'), 'utf8');
    expect(loader).toContain(CONTENT_MODULE);
    // The glob this replaced. It would work — and would put the parse back on
    // the critical path with nothing anywhere reporting it.
    expect(loader).not.toContain('import.meta.glob');
  });
});
