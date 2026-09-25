import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GAME_PACKAGE,
  MOD_EDITOR_PACKAGE,
  builderOverrides,
  packageTarget,
} from './package-target.mjs';

const SHELL = join(import.meta.dirname, '..');

describe('the two Windows package targets', () => {
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
