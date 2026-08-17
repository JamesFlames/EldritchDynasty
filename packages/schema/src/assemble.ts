import { ContentBundleS, type ContentBundle } from './content.js';

/**
 * WHERE THE CONTENT LIVES, declared once.
 *
 * There were two loaders — a node one walking the filesystem for the tests and
 * the harness, and a browser one over `import.meta.glob` for the editor — and
 * each carried its own copy of this table. When they drifted the symptom was
 * not an error. It was the editor quietly simulating a different game: a
 * missing `characterTemplates` line meant no spouses were minted, the line died
 * out, and the preview disagreed with the harness for reasons no one could see.
 *
 * Now both loaders do one job — hand over the files as text — and the layout
 * itself is here, next to the schema that gives those files meaning. A new
 * collection is one row in this table and it appears in both loaders at once,
 * because there is only one.
 *
 *   file       exactly this path; take `key` from it.
 *   dir        every .yaml under this prefix, recursively; concatenate `key`
 *              from each. Order follows the file listing, so authors can split
 *              a collection across as many files as they like.
 */
export type CollectionSource =
  | { readonly kind: 'file'; readonly path: string }
  | { readonly kind: 'dir'; readonly prefix: string };

export interface CollectionSpec {
  /** The document key inside the YAML, and the bundle field it fills. */
  readonly key: keyof ContentBundle;
  readonly source: CollectionSource;
}

export const CONTENT_LAYOUT: readonly CollectionSpec[] = [
  { key: 'attributes', source: { kind: 'file', path: 'attributes.yaml' } },
  { key: 'loci', source: { kind: 'file', path: 'loci.yaml' } },
  { key: 'traits', source: { kind: 'file', path: 'traits.yaml' } },
  { key: 'houses', source: { kind: 'file', path: 'houses.yaml' } },
  { key: 'heirlooms', source: { kind: 'file', path: 'heirlooms.yaml' } },
  { key: 'clauses', source: { kind: 'file', path: 'clauses.yaml' } },
  { key: 'tales', source: { kind: 'file', path: 'tales.yaml' } },
  { key: 'ages', source: { kind: 'dir', prefix: 'ages/' } },
  { key: 'events', source: { kind: 'dir', prefix: 'events/' } },
  { key: 'arcs', source: { kind: 'dir', prefix: 'arcs/' } },
  { key: 'characters', source: { kind: 'dir', prefix: 'characters/' } },
  { key: 'characterTemplates', source: { kind: 'dir', prefix: 'characters/' } },
];

/** Every collection the bundle carries, derived rather than restated. */
export const BUNDLE_KEYS = CONTENT_LAYOUT.map((c) => c.key);

export type YamlParser = (text: string) => unknown;

/**
 * Files in, validated bundle out. `files` is keyed by path relative to
 * `packages/content` — the node loader gets them from the filesystem, the
 * editor from `import.meta.glob`, and a test from an object literal, which is
 * the third reason this function exists.
 *
 * The YAML parser is passed in so this file, and therefore `@ed/schema`, keeps
 * its single dependency.
 */
export function assembleBundle(files: Record<string, string>, parse: YamlParser): ContentBundle {
  const paths = Object.keys(files).sort();
  const raw: Record<string, unknown[]> = {};

  for (const spec of CONTENT_LAYOUT) {
    let matching: string[];
    if (spec.source.kind === 'file') {
      const wanted = spec.source.path;
      // A named file that is not there is a broken checkout, not an empty
      // collection. Zod accepts `attributes: []` quite happily, and a game with
      // no attributes runs — badly, silently, and for a thousand years.
      if (!(wanted in files)) throw new Error(`content: ${wanted} is missing (holds '${spec.key}')`);
      matching = [wanted];
    } else {
      const { prefix } = spec.source;
      matching = paths.filter((p) => p.startsWith(prefix) && p.endsWith('.yaml'));
    }

    const out: unknown[] = [];
    for (const path of matching) {
      const doc = parse(files[path]!) as Record<string, unknown> | null;
      const value = doc?.[spec.key as string];
      if (Array.isArray(value)) out.push(...value);
    }
    raw[spec.key as string] = out;
  }

  return ContentBundleS.parse(raw);
}
