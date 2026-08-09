import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadContent, CONTENT_ROOT } from '@ed/content';
import { ContentBundleS } from '@ed/schema';

/**
 * The bundle is loaded twice by two different implementations: `@ed/content`
 * reads from the filesystem for tests and the harness, and the editor globs
 * the same YAML in the browser. They are two implementations of one contract.
 *
 * When they drift the symptom is not an error. The editor simply simulates a
 * different game — which is exactly what happened: the browser loader never
 * collected `characterTemplates`, so no spouses were minted, every line died
 * out by 1150, and the tree view disagreed with the harness for a whole
 * session before anyone noticed.
 */
describe('the content contract', () => {
  const bundle = loadContent();

  it('populates every collection the schema declares', () => {
    const keys = Object.keys(ContentBundleS.shape) as (keyof typeof bundle)[];
    for (const key of keys) {
      const value = bundle[key];
      expect(Array.isArray(value), `${String(key)} is not an array`).toBe(true);
      expect((value as unknown[]).length, `${String(key)} is empty`).toBeGreaterThan(0);
    }
  });

  it('is collected identically by the editor loader', () => {
    // The editor's key list is the shared definition of "every collection".
    const editorSrc = readFileSync(
      join(CONTENT_ROOT, '..', 'editor', 'src', 'lib', 'content.ts'),
      'utf8',
    );
    for (const key of Object.keys(ContentBundleS.shape)) {
      expect(editorSrc.includes(`${key}:`), `editor loader never reads '${key}'`).toBe(true);
    }
  });

  it('round-trips through its own schema', () => {
    expect(() => ContentBundleS.parse(bundle)).not.toThrow();
  });
});
