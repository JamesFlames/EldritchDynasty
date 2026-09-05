import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix, sep } from 'node:path';
import { parse } from 'yaml';
import type { Plugin } from 'vite';

/**
 * THE CONTENT, PARSED AT BUILD TIME (issue #109).
 *
 * The client used to glob 83 YAML files as raw text and run `parse()` over
 * 1.6 MB of them at module scope — 328 ms on a warm four-core container,
 * ahead of first paint, on the critical path, every single boot. On a
 * mid-range Android WebView that is seconds. It bought nothing: content is
 * loaded once and never changes again during a run, so the parse can happen
 * on the build machine instead of on the player's phone.
 *
 * The seam it goes through is the one `assembleBundle` already had. That
 * function takes its parser as an argument, so this is not a second way to
 * build a bundle — it is the same walk over the same `CONTENT_LAYOUT`, handed
 * a cheaper parser. Nothing here knows which file holds which collection, and
 * nothing here may learn: two loaders each carrying a copy of that table is
 * the bug `@ed/schema`'s assemble.ts exists to have fixed, and a build-time
 * third copy would be the same bug wearing a hat.
 *
 * The emitted values are JSON TEXT rather than object literals. `JSON.parse`
 * of one big string is the fastest way a JS engine can be handed structured
 * data — measurably faster than evaluating the equivalent literal — and it
 * keeps `assembleBundle(files, parse)` typed exactly as it already is.
 */
export const CONTENT_MODULE = 'virtual:ed-content';
const RESOLVED = `\0${CONTENT_MODULE}`;

/** Every `.yaml` under `dir`, keyed by its path relative to it, posix-style. */
export function contentFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (at: string): void => {
    for (const entry of readdirSync(at).sort()) {
      const path = join(at, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (entry.endsWith('.yaml')) out.push(path);
    }
  };
  walk(dir);
  return out;
}

/**
 * Path → the document's JSON, ready for `JSON.parse`.
 *
 * A file that parses to nothing becomes `null` rather than vanishing:
 * `assembleBundle` reads `doc?.[key]` and skips it, which is what the runtime
 * parse did with the same file. Dropping the key instead would make an empty
 * file and a missing file the same thing, and a missing named file is a broken
 * checkout that must still throw.
 */
export function readContentDocs(dir: string): Record<string, string> {
  const docs: Record<string, string> = {};
  for (const path of contentFiles(dir)) {
    const key = path.slice(dir.length + 1).split(sep).join(posix.sep);
    docs[key] = JSON.stringify(parse(readFileSync(path, 'utf8')) ?? null);
  }
  return docs;
}

/**
 * A Vite plugin serving `virtual:ed-content`.
 *
 * In dev the docs are re-read on every load and the module is invalidated when
 * any content file changes, so authoring in the editor on 5173 and playing on
 * 5174 still works the way it did when the client read the directory itself.
 */
export function edContent(dir: string): Plugin {
  return {
    name: 'ed:content',
    resolveId(id) {
      return id === CONTENT_MODULE ? RESOLVED : null;
    },
    load(id) {
      if (id !== RESOLVED) return null;
      for (const path of contentFiles(dir)) this.addWatchFile(path);
      const docs = readContentDocs(dir);
      return `export default JSON.parse(${JSON.stringify(JSON.stringify(docs))});\n`;
    },
    handleHotUpdate({ file, server, modules }) {
      if (!file.endsWith('.yaml') || !file.startsWith(dir)) return;
      const mod = server.moduleGraph.getModuleById(RESOLVED);
      if (!mod) return;
      server.moduleGraph.invalidateModule(mod);
      return [...modules, mod];
    },
  };
}
