import { existsSync } from 'node:fs';
import { cp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { build, Platform } from 'electron-builder';
import { smokePackagedApp } from './packaged-smoke.mjs';
import { builderOverrides, packageTarget } from './package-target.mjs';

/**
 * PACKAGE @ed/shell INTO A WINDOWS INSTALLER (issues #67 and #75).
 *
 * There is one builder configuration and two renderer targets. The ordinary
 * invocation packages the game. `--mod-editor` packages the already-built
 * authoring tool with its own app identity and main entrypoint, while keeping
 * the same NSIS/signing/resource rules.
 *
 * Both targets stage their renderer into `.renderer` first. That is the seam
 * that lets electron-builder.yml stay singular: packaging never has to know
 * whether `client/dist` or `editor/dist` was selected, and the installed
 * shell always reads `resources/renderer/index.html`.
 *
 * This script does not build either renderer. Root `build:shell` and
 * `build:mod-editor` deliberately order that first, and a missing build fails
 * here with the exact workspace to build.
 *
 * After packaging on Windows, this script boots the freshly-created
 * `win-unpacked` application with `--smoke`. For the game that proves the
 * packaged client/save bridge; for the Mod Editor it additionally proves the
 * second entrypoint selected `mode: mod-editor` rather than silently opening
 * the game under a different product name.
 *
 * DELIBERATELY NEVER INVOKED AS `npm run <script>` FROM check.yml.
 * `tools/land.mjs` derives ordinary landing work from workflow npm scripts;
 * packaging a Windows installer must remain tag/local work, not something
 * every prose landing pays for.
 */
const HERE = fileURLToPath(new URL('.', import.meta.url));
const SHELL = resolve(HERE, '..');
const target = packageTarget(process.argv.slice(2));
const RELEASE = resolve(SHELL, target.output);
const STAGED_RENDERER = resolve(SHELL, '.renderer');
const RENDERER_SOURCE = resolve(SHELL, '..', target.renderer, 'dist');

/**
 * electron-builder demands a FIXED electron version and refuses `^38.0.0`
 * outright. Resolve the installed package instead of keeping a second version
 * number beside package.json.
 */
const electronVersion = createRequire(import.meta.url)('electron/package.json').version;

try {
  const entry = join(RENDERER_SOURCE, 'index.html');
  if (!existsSync(entry)) {
    throw new Error(
      `no built ${target.renderer} renderer at ${entry}; run ` +
      `npm run build --workspace @ed/${target.renderer} first`,
    );
  }

  await rm(STAGED_RENDERER, { recursive: true, force: true });
  await cp(RENDERER_SOURCE, STAGED_RENDERER, { recursive: true });

  await build({
    projectDir: SHELL,
    targets: Platform.WINDOWS.createTarget(),
    config: builderOverrides(target, electronVersion),
  });

  const smoke = await smokePackagedApp(RELEASE);
  if (smoke.skipped) {
    console.log(`packaged ${target.mode} smoke skipped — the Windows executable cannot run on this platform`);
  } else {
    console.log(`packaged ${target.mode} smoke ok — ${smoke.executable}`);
  }
} catch (e) {
  console.error(e?.stack ?? String(e));
  process.exitCode = 1;
} finally {
  await rm(STAGED_RENDERER, { recursive: true, force: true });
}
