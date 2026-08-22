/** Hand-written because the implementation is `.mjs` — the Electron main process imports it directly, with no build step. */
export declare class SaveSlotError extends Error {}

export declare const SAVE_EXTENSION: string;

/** The absolute path of one save slot under `root`, or throw `SaveSlotError`. */
export declare function resolveSavePath(root: string, slot: unknown): string;

/** The slot a file name belongs to, or undefined if the file is not one of ours. */
export declare function slotOfFile(fileName: unknown): string | undefined;
