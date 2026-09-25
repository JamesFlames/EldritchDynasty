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
 *                       `scripts/dist-windows.mjs` stages the selected renderer into the
 *                       packaged app's `resources/renderer` directory (see
 *                       `electron-builder.yml`). The game stages `client/dist`;
 *                       #75's second target stages `editor/dist`. Electron
 *                       exposes that directory through `process.resourcesPath`
 *                       regardless of where the installer put the application.
 */
export function rendererEntry({ isPackaged, resourcesPath, repo, target = 'client' }) {
  const folder = target === 'editor' ? 'editor' : 'client';
  return isPackaged
    ? join(resourcesPath, 'renderer', 'index.html')
    : join(repo, 'packages', folder, 'dist', 'index.html');
}
