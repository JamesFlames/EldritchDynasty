import { join } from 'node:path';

/**
 * WHERE THE GAME LIVES, IN AND OUT OF A PACKAGED APP (issue #67).
 *
 * `main.mjs` used to resolve `packages/client/dist/index.html` relative to the
 * repository unconditionally. That is exactly right for `npm run shell` and
 * `npm run shell:preview`, run inside a checkout with the rest of the monorepo
 * beside it, and it is wrong for an installed app: electron-builder packages
 * `packages/shell` on its own, so a repository-relative path resolves to
 * nothing once there is no repository around the executable.
 *
 * Split out of `main.mjs` — which imports `electron` at module scope and so
 * cannot be loaded outside an Electron process at all — so this stays a plain
 * function over plain values, importable and testable with nothing but node.
 *
 * The two readings:
 *
 *   dev / repository   `app.isPackaged` is false. The client's own build
 *                       output, found the way it always was: relative to the
 *                       repository root.
 *   packaged            `app.isPackaged` is true. electron-builder's
 *                       `extraResources` copies the client's build into the
 *                       packaged app's `resources` directory (see
 *                       `electron-builder.yml`), which Electron exposes as
 *                       `process.resourcesPath` regardless of where the
 *                       installer put the application — this is the "a file
 *                       copied into the packaged resources" the plan asks for.
 */
export function rendererEntry({ isPackaged, resourcesPath, repo }) {
  return isPackaged
    ? join(resourcesPath, 'client', 'index.html')
    : join(repo, 'packages/client/dist/index.html');
}
