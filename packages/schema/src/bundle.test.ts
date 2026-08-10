import { describe, expect, it } from 'vitest';
import { loadBundle, loadContent } from '@ed/content';
import { assembleBundle, ContentBundleS, CONTENT_LAYOUT } from '@ed/schema';
import { parse } from 'yaml';

/**
 * The bundle used to be loaded twice by two different implementations —
 * `@ed/content` off the filesystem for tests and the harness, the editor over
 * `import.meta.glob` in the browser — and each carried its own copy of the
 * table saying which collection lived in which file.
 *
 * When they drifted the symptom was not an error. The editor simply simulated a
 * different game: the browser loader never collected `characterTemplates`, so
 * no spouses were minted, every line died out by 1150, and the tree view
 * disagreed with the harness for a whole session before anyone noticed.
 *
 * There is one table now — `CONTENT_LAYOUT` — and both loaders do nothing but
 * hand over files as text. These tests guard the table itself.
 */
describe('the content contract', () => {
  const bundle = loadBundle();

  it('gives every collection the schema declares a place to come from', () => {
    const declared = new Set(Object.keys(ContentBundleS.shape));
    const sourced = new Set(CONTENT_LAYOUT.map((c) => String(c.key)));
    for (const key of declared) {
      expect(sourced.has(key), `no CONTENT_LAYOUT row loads '${key}'`).toBe(true);
    }
    for (const key of sourced) {
      expect(declared.has(key), `CONTENT_LAYOUT loads '${key}', which is not in the bundle`).toBe(true);
    }
  });

  it('populates every one of them', () => {
    for (const key of Object.keys(ContentBundleS.shape) as (keyof typeof bundle)[]) {
      const value = bundle[key];
      expect(Array.isArray(value), `${String(key)} is not an array`).toBe(true);
      expect((value as unknown[]).length, `${String(key)} is empty`).toBeGreaterThan(0);
    }
  });

  it('says so out loud when a named file is missing', () => {
    // Silence is this codebase's failure mode. An absent attributes.yaml
    // produces `attributes: []`, which Zod accepts and a run survives — badly,
    // for a thousand years, with nothing to say what went wrong.
    expect(() => assembleBundle({ 'houses.yaml': 'houses: []' }, parse))
      .toThrow(/attributes\.yaml is missing/);
  });

  it('round-trips through its own schema', () => {
    expect(() => ContentBundleS.parse(bundle)).not.toThrow();
  });

  it('resolves ids through the index, and names the ones it cannot', () => {
    const content = loadContent();
    const first = content.events[0]!;
    expect(content.event(first.id)).toBe(first);
    expect(content.event('no_such_event')).toBeUndefined();
    expect(() => content.mustEvent('no_such_event', 'a test'))
      .toThrow(/no event 'no_such_event' \(wanted by a test\)/);
  });
});
