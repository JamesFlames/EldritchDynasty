import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build, Platform } from 'electron-builder';
import { smokePackagedApp } from './packaged-smoke.mjs';

/**
 * PACKAGE @ed/shell INTO A WINDOWS INSTALLER (issue #67).
 *
 * Calls electron-builder's own Node API rather than spawning its CLI binary.
 * electron-builder's `.bin` entry is a `.cmd` shim on Windows — the exact
 * shape `tools/portable.mjs` already documents for npm itself, and the same
 * fix applies one level up: there is no shim to spawn at all if nothing spawns
 * one. `npm run build --workspace @ed/client` still runs first (this script
 * does not build the client itself; `dist:windows` and root `build:shell`
 * both order it first).
 *
 * After packaging on Windows, this script boots the freshly-created
 * `win-unpacked` application with `--smoke`. The source-tree smoke proves
 * Electron can run the client; this second smoke proves the packaged resources
 * contain the client and `app.isPackaged` resolves it from the installed
 * layout. Because the tag-only `windows-release` job already calls THIS file
 * directly, it gains packaged-app verification without adding a new CI step or
 * broadening ordinary landing work.
 *
 * DELIBERATELY NEVER INVOKED AS `npm run <script>` FROM `check.yml`.
 * `tools/land.mjs`'s `ciScripts` derives what a landing has to run from every
 * such invocation the workflow text contains, and packaging a Windows
 * installer has no part in an ordinary landing — every other landing would
 * pay for a Windows installer build over a change to a rite's flavour text.
 * The `android` job reaches its own packaging tool (`gradlew`) the same way,
 * for the same reason. `windows-release` in `check.yml` and the `dist:windows`
 * npm script both call this file directly.
 */
const HERE = fileURLToPath(new URL('.', import.meta.url));
const SHELL = resolve(HERE, '..');
const RELEASE = resolve(SHELL, 'release');

/**
 * electron-builder demands a FIXED electron version and refuses `^38.0.0`
 * outright rather than resolving it — reasonably, since it downloads a
 * platform binary for one exact release. `devDependencies` in a workspace
 * still names a range on purpose (so `npm update` moves it like every other
 * dependency here), so the exact version comes from the package actually on
 * disk instead of a second number kept in sync by hand — the same reason
 * `ctx.genetics.expected` and not a constant is invariant 10's rule for the
 * simulation side of this repository.
 */
const electronVersion = createRequire(import.meta.url)('electron/package.json').version;

try {
  await build({
    projectDir: SHELL,
    targets: Platform.WINDOWS.createTarget(),
    config: { electronVersion },
  });

  const smoke = await smokePackagedApp(RELEASE);
  if (smoke.skipped) {
    console.log('packaged smoke skipped — the Windows executable cannot run on this platform');
  } else {
    console.log(`packaged smoke ok — ${smoke.executable}`);
  }
} catch (e) {
  console.error(e?.stack ?? String(e));
  process.exit(1);
}
