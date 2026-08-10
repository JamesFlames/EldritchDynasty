import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { assembleBundle, indexContent, type Content, type ContentBundle } from '@ed/schema';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Node-side content loader, for tests and the headless harness.
 *
 * Its whole job is to hand the files over as text. What a bundle IS — which
 * collection lives in which file, under which key — is declared once in
 * `@ed/schema`'s `CONTENT_LAYOUT`, which the editor's browser loader reads
 * from too. The two loaders used to carry a copy each, and when they drifted
 * the editor simply simulated a different game.
 */
export function contentFiles(root = ROOT): Record<string, string> {
  const out: Record<string, string> = {};

  const walk = (dir: string): void => {
    let entries: string[];
    try { entries = readdirSync(join(root, dir)); } catch { return; }
    for (const entry of entries) {
      const rel = dir ? `${dir}/${entry}` : entry;
      if (statSync(join(root, rel)).isDirectory()) walk(rel);
      else if (entry.endsWith('.yaml')) out[rel] = readFileSync(join(root, rel), 'utf8');
    }
  };

  walk('');
  return out;
}

export function loadBundle(root = ROOT): ContentBundle {
  return assembleBundle(contentFiles(root), parse);
}

/** The bundle with its indexes built. What the simulation actually wants. */
export function loadContent(root = ROOT): Content {
  return indexContent(loadBundle(root));
}

export { ROOT as CONTENT_ROOT };
