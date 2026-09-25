/** Hand-written because the implementation is `.mjs` — `main.mjs` imports it directly, with no build step. */

export interface RendererEntryOptions {
  /** `app.isPackaged`: false under `npm run shell`/`shell:preview`, true in an installed app. */
  isPackaged: boolean;
  /** `process.resourcesPath`. Read only when `isPackaged` is true. */
  resourcesPath: string;
  /** The repository root. Read only when `isPackaged` is false. */
  repo: string;
  /** Which repository build to load in dev. Packaged builds use the renderer staged for that installer. */
  target?: 'client' | 'editor';
}

/** Where `index.html` lives, in dev/repository and once packaged. */
export declare function rendererEntry(options: RendererEntryOptions): string;
