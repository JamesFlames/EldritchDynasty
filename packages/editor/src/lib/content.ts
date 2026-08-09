import { parse, stringify } from 'yaml';
import { ContentBundleS, type ContentBundle } from '@ed/schema';

/**
 * Browser-side content loader. Mirrors the node loader in @ed/content — both
 * produce the same ContentBundle and both validate against the same schema,
 * because packages/schema is the single source of truth and there is no second
 * definition of what an event is.
 */
const files = import.meta.glob('../../../content/**/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Editor path (relative to packages/content) -> raw text. */
export const rawFiles: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([k, v]) => [k.replace(/^.*\/content\//, ''), v]),
);

function collect<T>(prefix: string, key: string): T[] {
  const out: T[] = [];
  for (const [path, text] of Object.entries(rawFiles)) {
    if (!path.startsWith(prefix)) continue;
    const doc = parse(text) as Record<string, T[]> | null;
    if (doc && Array.isArray(doc[key])) out.push(...doc[key]!);
  }
  return out;
}

function single<T>(path: string, key: string): T[] {
  const doc = parse(rawFiles[path] ?? '') as Record<string, T[]> | null;
  return (doc?.[key] ?? []) as T[];
}

export function loadBundle(): ContentBundle {
  return ContentBundleS.parse({
    attributes: single('attributes.yaml', 'attributes'),
    loci: single('loci.yaml', 'loci'),
    traits: single('traits.yaml', 'traits'),
    houses: single('houses.yaml', 'houses'),
    ages: collect('ages/', 'ages'),
    events: collect('events/', 'events'),
    arcs: collect('arcs/', 'arcs'),
    characters: collect('characters/', 'characters'),
    // Easy to forget, and the failure is silent: with no templates the sim
    // mints no spouses, so the line quietly dies out and the editor disagrees
    // with the harness. `bundleKeys` below exists to stop that recurring.
    characterTemplates: collect('characters/', 'characterTemplates'),
    clauses: single('clauses.yaml', 'clauses'),
  });
}

/** Which file did this event come from? Needed to write it back. */
export function fileOfEvent(eventId: string): string | undefined {
  for (const [path, text] of Object.entries(rawFiles)) {
    if (!path.startsWith('events/')) continue;
    const doc = parse(text) as { events?: { id: string }[] } | null;
    if (doc?.events?.some((e) => e.id === eventId)) return path;
  }
  return undefined;
}

/**
 * Two transports, one API. In the browser the dev server takes the write
 * through a Vite middleware; inside the Electron shell it goes over IPC to the
 * main process, which does its own path validation. The editor above this
 * function does not know or care which it is running in.
 */
interface ShellBridge {
  isShell: true;
  writeContent(path: string, text: string): Promise<{ ok: boolean; error?: string }>;
  readContent(path: string): Promise<{ ok: boolean; text?: string; error?: string }>;
}

export function shell(): ShellBridge | undefined {
  return (globalThis as { ed?: ShellBridge }).ed;
}

export async function writeFile(path: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const bridge = shell();
  if (bridge) return bridge.writeContent(path, text);

  const res = await fetch('/api/content', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path, text }),
  });
  return res.json();
}

/**
 * Every collection the bundle carries. The browser loader and the node loader
 * are two implementations of one contract, and when they drift the symptom is
 * not an error — it is the editor quietly simulating a different game.
 */
export const bundleKeys = [
  'attributes', 'loci', 'traits', 'houses',
  'ages', 'events', 'arcs', 'characters', 'characterTemplates', 'clauses',
] as const;

export function toYaml(value: unknown): string {
  return stringify(value, { lineWidth: 78, defaultStringType: 'PLAIN', defaultKeyType: 'PLAIN' });
}
