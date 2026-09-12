import docs from 'virtual:ed-content';
import { assembleBundle, type ContentBundle } from '@ed/schema';

/**
 * The content, pre-parsed at build time, handed to the one assembler.
 *
 * What a bundle IS — which collection lives in which file, under which key —
 * is `CONTENT_LAYOUT` in `@ed/schema`, which the node loader in `@ed/content`
 * and the editor's browser loader both read from as well. Three loaders, one
 * table: when the editor and the harness each kept a copy of the table nothing
 * threw, the editor simply simulated a different game.
 *
 * The YAML parse happens on the build machine (`build/content-plugin.ts`,
 * issue #109), not here. It cost 328 ms of the player's cold start, before
 * first paint, to redo work whose answer cannot change: content is indexed
 * once and never changes again during a run. `assembleBundle` takes its parser
 * as an argument, so this is the same walk with a cheaper one — the game
 * cannot assemble a different bundle than the harness does, and
 * `content.test.ts` checks that it does not.
 *
 * The editor keeps parsing YAML at runtime, and must: it authors the files and
 * has to read what is on disk. The client only ever reads, and a game that
 * could write to the content directory is a game that can corrupt the thing it
 * is playing.
 */
export function loadBundle(): ContentBundle {
  return assembleBundle(docs, JSON.parse);
}
