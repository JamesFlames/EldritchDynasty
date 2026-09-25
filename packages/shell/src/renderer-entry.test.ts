import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { rendererEntry } from './renderer-entry.mjs';

/**
 * THE PACKAGED PATH, WITHOUT ELECTRON.
 *
 * `main.mjs` imports `electron` at module scope and cannot be loaded outside
 * an Electron process — the same reason `saves.mjs` was split out of it. This
 * is a pure function over plain values, so the two readings are assertable
 * with nothing but node.
 */
describe('resolving where the renderer lives', () => {
  const REPO = '/repo';
  const RESOURCES = '/Program Files/Eldritch Dynasty/resources';

  it('reads the client build out of the repository in dev', () => {
    expect(rendererEntry({ isPackaged: false, resourcesPath: RESOURCES, repo: REPO }))
      .toBe(join(REPO, 'packages/client/dist/index.html'));
  });

  it('reads it out of the packaged resources once installed', () => {
    expect(rendererEntry({ isPackaged: true, resourcesPath: RESOURCES, repo: REPO }))
      .toBe(join(RESOURCES, 'client', 'index.html'));
  });

  it('can select the editor without changing the default game target', () => {
    expect(rendererEntry({ isPackaged: false, resourcesPath: RESOURCES, repo: REPO, target: 'editor' }))
      .toBe(join(REPO, 'packages', 'editor', 'dist', 'index.html'));
    expect(rendererEntry({ isPackaged: true, resourcesPath: RESOURCES, repo: REPO, target: 'editor' }))
      .toBe(join(RESOURCES, 'editor', 'index.html'));
  });

  it('never reaches into the repository once packaged', () => {
    // The failure this guards: an installed app with no monorepo beside it,
    // silently loading a path that only ever existed on the machine it was
    // built on.
    const entry = rendererEntry({ isPackaged: true, resourcesPath: RESOURCES, repo: REPO });
    expect(entry.startsWith(REPO)).toBe(false);
  });

  it('never reads the packaged resources path while still in dev', () => {
    const entry = rendererEntry({ isPackaged: false, resourcesPath: RESOURCES, repo: REPO });
    expect(entry.startsWith(RESOURCES)).toBe(false);
  });
});
