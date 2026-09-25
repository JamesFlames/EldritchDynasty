/**
 * WHICH WINDOWS APPLICATION ARE WE PACKAGING? (#75 B2)
 *
 * There is one Electron shell and one electron-builder configuration. The
 * target changes only four packaging facts:
 *
 * - which already-built renderer is staged,
 * - where the artefacts are written,
 * - the installed application's identity,
 * - and which main entrypoint selects the shell mode.
 *
 * Keeping those differences here prevents a second builder YAML drifting from
 * the game's signing, NSIS and resource rules.
 */

export const GAME_PACKAGE = Object.freeze({
  mode: 'game',
  renderer: 'client',
  output: 'release',
});

export const MOD_EDITOR_PACKAGE = Object.freeze({
  mode: 'mod-editor',
  renderer: 'editor',
  output: 'release-mod-editor',
  appId: 'nz.eldritchdynasty.modeditor',
  productName: 'Eldritch Dynasty Mod Editor',
  main: 'src/mod-editor-main.mjs',
});

export function packageTarget(args = []) {
  return args.includes('--mod-editor') ? MOD_EDITOR_PACKAGE : GAME_PACKAGE;
}

/**
 * The game deliberately supplies no identity overrides: electron-builder.yml
 * remains its authority. Only the second target overrides the facts that are
 * actually different.
 */
export function builderOverrides(target, electronVersion) {
  if (target.mode === 'game') return { electronVersion };

  return {
    electronVersion,
    appId: target.appId,
    productName: target.productName,
    directories: { output: target.output },
    extraMetadata: { main: target.main },
  };
}
