import { parse } from 'yaml';
import { assembleBundle, type ContentBundle } from '@ed/schema';

/**
 * The content, as text, handed to the one assembler.
 *
 * What a bundle IS — which collection lives in which file, under which key —
 * is `CONTENT_LAYOUT` in `@ed/schema`, which the node loader in `@ed/content`
 * and the editor's browser loader both read from as well. Three loaders, one
 * table: when the editor and the harness each kept a copy of the table nothing
 * threw, the editor simply simulated a different game.
 *
 * The client only ever reads. The editor's loader has a write half beside this
 * one, over a dev-server middleware; a game that can write to the content
 * directory is a game that can corrupt the thing it is playing.
 */
const files = import.meta.glob('../../../content/**/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const rawFiles: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([k, v]) => [k.replace(/^.*\/content\//, ''), v]),
);

export function loadBundle(): ContentBundle {
  return assembleBundle(rawFiles, parse);
}
