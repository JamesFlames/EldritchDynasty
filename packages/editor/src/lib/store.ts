import { parse, parseDocument, type Document } from 'yaml';
import { reactive } from 'vue';
import type { ContentBundle } from '@ed/schema';
import { assembleBundle } from '@ed/schema';
import { rawFiles, readFile, writeFile } from './content.js';

/**
 * THE WRITE-BACK STORE (issue #20).
 *
 * `writeFile` and `toYaml` existed with zero callers. Every editing surface
 * kept its own local `ref` copy of its slice of content, rebuilt fresh from
 * `props.content` on every mount — which is exactly what `App.vue`'s
 * `v-if`/`v-else-if` tab chain does to a component on every switch. An edit
 * therefore survived until the next click.
 *
 * The fix is a module-level singleton. `reactive(bundle)` hands every
 * importer the SAME proxy, so `EventEditor` and `CharacterEditor` read and
 * write one shared model instead of three private ones, and `App.vue`'s
 * `content` (built by `indexContent`-ing this same `bundle`) sees every edit
 * immediately because it is the identical array, not a snapshot of it.
 *
 * SAVING is comment-preserving AT THE FILE LEVEL. Each content file is
 * parsed once into a `yaml.Document` — not just plain JSON — kept alongside
 * the reactive model. A save patches ONLY the changed item's node
 * (`doc.setIn`) rather than re-stringifying the whole file, so the file's
 * header comments and every OTHER entry in it survive untouched.
 *
 * The edited item itself re-serializes from its live, Zod-parsed state —
 * which means every field on it, not just the one a click actually changed:
 * optional fields Zod filled in with their schema default become explicit,
 * and arrays that were authored in flow style (`tags: [a, b]`) come back
 * block-style. The diff view (issue #21) exists largely BECAUSE of this —
 * it shows the author the real write, including the reformatting, before
 * anything reaches disk, rather than promising a minimal diff this design
 * cannot honestly make. A surgical single-field patch would need the live
 * model to track original source order and style per field; that is a
 * larger change than write-back itself and is left for a later pass.
 */

interface FileEntry {
  path: string;
  doc: Document;
  /** The text this file had the moment the editor loaded it — the base a diff (issue #21) is drawn against. */
  loadedText: string;
}

const files = new Map<string, FileEntry>();
for (const [path, text] of Object.entries(rawFiles)) {
  files.set(path, { path, doc: parseDocument(text), loadedText: text });
}

/** Which collections (bundle key -> YAML top-level key) a file can hold an editable item in. */
const COLLECTION_YAML_KEY: Record<string, string> = {
  events: 'events',
  characterTemplates: 'characterTemplates',
};

function locate(collectionKey: string, id: string): { path: string; index: number } | undefined {
  const yamlKey = COLLECTION_YAML_KEY[collectionKey] ?? collectionKey;
  for (const [path, f] of files) {
    const seq = f.doc.get(yamlKey, true) as { items?: unknown[] } | undefined;
    if (!seq?.items) continue;
    for (let i = 0; i < seq.items.length; i++) {
      if (f.doc.getIn([yamlKey, i, 'id']) === id) return { path, index: i };
    }
  }
  return undefined;
}

/** Which file an item lives in, for display (issue #20's `fileOfEvent`, generalised). */
export function fileOf(collectionKey: string, id: string): string | undefined {
  return locate(collectionKey, id)?.path;
}

export interface WriteResult {
  ok: boolean;
  error?: string;
}

export const store = reactive({
  bundle: assembleBundle(rawFiles, parse) as ContentBundle,
  /** File paths with edits not yet written to disk. */
  dirty: new Set<string>(),
  saving: new Set<string>(),
  errors: {} as Record<string, string>,
});

/** Strip Vue's reactive proxy so `yaml`'s Document gets a plain value to serialize. */
function plain<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

const STRINGIFY_OPTS = { lineWidth: 78, defaultStringType: 'PLAIN', defaultKeyType: 'PLAIN' } as const;

/** The text a save WOULD write, without writing it — what the diff view (issue #21) renders. */
export function pendingText(collectionKey: string, id: string): { path: string; before: string; after: string } | undefined {
  const located = locate(collectionKey, id);
  if (!located) return undefined;
  const file = files.get(located.path)!;
  const yamlKey = COLLECTION_YAML_KEY[collectionKey] ?? collectionKey;
  const items = (store.bundle as unknown as Record<string, { id: string }[]>)[collectionKey];
  const item = items?.find((x) => x.id === id);
  if (!item) return undefined;

  // Clone the document so previewing a diff never mutates the file the way a
  // save does — the whole point of a preview is that looking at it costs nothing.
  const preview = file.doc.clone();
  preview.setIn([yamlKey, located.index], plain(item));
  return { path: located.path, before: file.loadedText, after: preview.toString(STRINGIFY_OPTS) };
}

/**
 * Has the file on disk moved since the editor loaded it? Checked against
 * `loadedText`, not against `writeFile`'s own read-before-write guard, which
 * only protects the instant of the write itself — this is what lets the UI
 * say so BEFORE a save is even attempted (issue #21, "git-adjacent").
 */
export async function externalChange(path: string): Promise<{ changed: boolean; text?: string }> {
  const file = files.get(path);
  if (!file) return { changed: false };
  const res = await readFile(path);
  if (!res.ok || res.text === undefined) return { changed: false };
  return { changed: res.text !== file.loadedText, text: res.text };
}

/** Mark an item's file dirty. Called on every edit; cheap enough (files × items) at content-directory scale. */
export function markDirty(collectionKey: string, id: string): void {
  const located = locate(collectionKey, id);
  if (located) store.dirty.add(located.path);
}

export function isDirty(collectionKey: string, id: string): boolean {
  const located = locate(collectionKey, id);
  return located ? store.dirty.has(located.path) : false;
}

/** Write one item's current state back to its file, preserving everything around it. */
export async function saveItem(collectionKey: string, id: string): Promise<WriteResult> {
  const located = locate(collectionKey, id);
  if (!located) return { ok: false, error: `'${id}' is not in any loaded file` };
  const file = files.get(located.path)!;
  const yamlKey = COLLECTION_YAML_KEY[collectionKey] ?? collectionKey;
  const items = (store.bundle as unknown as Record<string, { id: string }[]>)[collectionKey];
  const item = items?.find((x) => x.id === id);
  if (!item) return { ok: false, error: `'${id}' is not in the live model` };

  file.doc.setIn([yamlKey, located.index], plain(item));
  const text = file.doc.toString(STRINGIFY_OPTS);

  store.saving.add(located.path);
  const res = await writeFile(located.path, text);
  store.saving.delete(located.path);

  if (res.ok) {
    file.loadedText = text;
    store.dirty.delete(located.path);
    delete store.errors[located.path];
  } else {
    store.errors[located.path] = res.error ?? 'write failed';
  }
  return res;
}

export function saveEvent(id: string): Promise<WriteResult> {
  return saveItem('events', id);
}

export function saveCharacterTemplate(id: string): Promise<WriteResult> {
  return saveItem('characterTemplates', id);
}
