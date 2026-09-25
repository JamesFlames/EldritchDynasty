import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GAME_PACKAGE,
  MOD_EDITOR_PACKAGE,
  builderOverrides,
  packageTarget,
} from '../scripts/package-target.mjs';
import { desktopUserData } from './profile-root.mjs';
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

  it('reads the staged renderer out of packaged resources once installed', () => {
    expect(rendererEntry({ isPackaged: true, resourcesPath: RESOURCES, repo: REPO }))
      .toBe(join(RESOURCES, 'renderer', 'index.html'));
  });

  it('selects the editor in a checkout, while packaging reads the staged target', () => {
    expect(rendererEntry({ isPackaged: false, resourcesPath: RESOURCES, repo: REPO, target: 'editor' }))
      .toBe(join(REPO, 'packages', 'editor', 'dist', 'index.html'));
    expect(rendererEntry({ isPackaged: true, resourcesPath: RESOURCES, repo: REPO, target: 'editor' }))
      .toBe(join(RESOURCES, 'renderer', 'index.html'));
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


describe('the two Windows package targets', () => {
  it('shares one packaged profile even though the installed names differ', () => {
    expect(desktopUserData(join('C:', 'Users', 'Ada', 'AppData', 'Roaming')))
      .toBe(join('C:', 'Users', 'Ada', 'AppData', 'Roaming', 'Eldritch Dynasty'));
  });

  const SHELL = join(import.meta.dirname, '..');

  it('keeps the game as the default target', () => {
    expect(packageTarget([])).toBe(GAME_PACKAGE);
    expect(packageTarget(['--anything-else'])).toBe(GAME_PACKAGE);
    expect(builderOverrides(GAME_PACKAGE, '38.0.0')).toEqual({
      electronVersion: '38.0.0',
    });
  });

  it('selects the editor only when explicitly requested', () => {
    expect(packageTarget(['--mod-editor'])).toBe(MOD_EDITOR_PACKAGE);
    expect(MOD_EDITOR_PACKAGE.renderer).toBe('editor');
    expect(MOD_EDITOR_PACKAGE.output).toBe('release-mod-editor');
  });

  it('gives the second installer its own identity and entrypoint', () => {
    expect(builderOverrides(MOD_EDITOR_PACKAGE, '38.0.0')).toEqual({
      electronVersion: '38.0.0',
      appId: 'nz.eldritchdynasty.modeditor',
      productName: 'Eldritch Dynasty Mod Editor',
      directories: { output: 'release-mod-editor' },
      extraMetadata: { main: 'src/mod-editor-main.mjs' },
    });
  });

  it('has one builder resource slot for whichever renderer was staged', () => {
    const yaml = readFileSync(join(SHELL, 'electron-builder.yml'), 'utf8');
    expect(yaml).toMatch(/from:\s*\.renderer[\s\S]*?to:\s*renderer/);
    expect(yaml).not.toMatch(/from:\s*\.\.\/(?:client|editor)\/dist/);
    expect(yaml).toContain("- '!.renderer/**'");
  });

  it('selects Mod Editor mode before importing the shared shell', () => {
    const entry = readFileSync(join(SHELL, 'src/mod-editor-main.mjs'), 'utf8');
    expect(entry.indexOf("process.env.ED_MOD_EDITOR = '1'"))
      .toBeLessThan(entry.indexOf("import('./main.mjs')"));
  });
});
