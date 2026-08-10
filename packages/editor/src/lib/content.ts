import { parse, stringify } from 'yaml';
import { assembleBundle, indexContent, type Content, type ContentBundle } from '@ed/schema';

/**
 * Browser-side content loader. Its whole job is to hand the files over as text
 * — what a bundle IS lives in `@ed/schema`'s CONTENT_LAYOUT, which the node
 * loader in `@ed/content` reads from too.
 *
 * The two loaders used to carry a copy of that table each. When they drifted
 * nothing threw: the editor simply simulated a different game to the harness.
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

export function loadBundle(): ContentBundle {
  return assembleBundle(rawFiles, parse);
}

/** The bundle with its indexes built. What the simulation actually wants. */
export function loadContent(): Content {
  return indexContent(loadBundle());
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

export function toYaml(value: unknown): string {
  return stringify(value, { lineWidth: 78, defaultStringType: 'PLAIN', defaultKeyType: 'PLAIN' });
}
