import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { ContentBundleS, type ContentBundle } from '@ed/schema';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function readYaml(path: string): unknown {
  return parse(readFileSync(path, 'utf8'));
}

function walk(dir: string): string[] {
  const full = join(ROOT, dir);
  let entries: string[];
  try { entries = readdirSync(full); } catch { return []; }
  const out: string[] = [];
  for (const e of entries) {
    const p = join(full, e);
    if (statSync(p).isDirectory()) out.push(...walk(join(dir, e)));
    else if (e.endsWith('.yaml')) out.push(p);
  }
  return out;
}

function collect<T>(dir: string, key: string): T[] {
  const out: T[] = [];
  for (const file of walk(dir)) {
    const doc = readYaml(file) as Record<string, T[]> | null;
    if (doc && Array.isArray(doc[key])) out.push(...doc[key]!);
  }
  return out;
}

/**
 * Node-side content loader, for tests and the headless harness. The editor has
 * its own glob-based loader; both produce the same ContentBundle and both
 * validate against the same schema, because `packages/schema` is the single
 * source of truth and there is no second definition of what an event is.
 */
export function loadContent(): ContentBundle {
  const raw = {
    attributes: (readYaml(join(ROOT, 'attributes.yaml')) as any).attributes,
    loci: (readYaml(join(ROOT, 'loci.yaml')) as any).loci,
    traits: (readYaml(join(ROOT, 'traits.yaml')) as any).traits,
    houses: (readYaml(join(ROOT, 'houses.yaml')) as any).houses,
    ages: collect('ages', 'ages'),
    events: collect('events', 'events'),
    arcs: collect('arcs', 'arcs'),
    characters: collect('characters', 'characters'),
    characterTemplates: collect('characters', 'characterTemplates'),
    heirlooms: (readYaml(join(ROOT, 'heirlooms.yaml')) as any).heirlooms,
    clauses: (readYaml(join(ROOT, 'clauses.yaml')) as any).clauses,
  };
  return ContentBundleS.parse(raw);
}

export { ROOT as CONTENT_ROOT };
