/**
 * TYPES FOR `shards.mjs`, BECAUSE A TEST IN `packages/` IMPORTS IT.
 *
 * `tools/` is JavaScript by rule — AGENTS.md: "Every operating script is
 * `.mjs`, spawned with `node`" — and `vitest.config.ts` is outside the
 * typecheck's include, so nothing here needed types until `lanes.test.ts`
 * started asserting the packing. It is inside the include, and an untyped
 * import there is an implicit `any` that the strict config refuses.
 *
 * Hand-written and deliberately thin: it describes the five things the test
 * uses and nothing else, so it cannot drift far enough to matter. The
 * alternative — moving the packing into `packages/` — would put a module the
 * vite config imports behind the alias resolution the vite config sets up.
 *
 * `.d.mts`, NOT `.d.ts`. Under `moduleResolution: Bundler` an import of
 * `./shards.mjs` is resolved against `shards.mts` and `shards.d.mts`; a
 * `.d.ts` sibling is never consulted and the import stays an implicit `any`,
 * which the strict config then refuses with a message that names neither fact.
 */
export const DURATIONS_FILE: string;
export const UNMEASURED_MS: number;
export function readDurations(repo: string): Record<string, number>;
export function packShards(
  files: string[],
  count: number,
  durations?: Record<string, number>,
  unmeasured?: number,
): string[][];
export function shardCosts(
  files: string[],
  count: number,
  durations?: Record<string, number>,
  unmeasured?: number,
): number[];
export class DurationSequencer {
  constructor(ctx: unknown);
}
