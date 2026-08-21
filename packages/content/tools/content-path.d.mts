/** Hand-written because the implementation is `.mjs` — the Electron main process imports it directly, with no build step. */
export declare class ContentPathError extends Error {}

/** Resolve an editor-relative path against the content root, or throw `ContentPathError`. */
export declare function resolveContentPath(root: string, path: unknown): string;
