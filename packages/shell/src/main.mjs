import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
// One implementation of the write guard, shared with the dev-server bridge.
import { resolveContentPath } from '../../content/tools/content-path.mjs';

/**
 * THE SHELL.
 *
 * Electron is a wrapper and nothing else. It owns the window, the menu bar and
 * the disk; it owns no rules. Every line of simulation in this application
 * lives in `@ed/core` and runs identically in the browser demo, in the headless
 * harness and in here — which is the only reason the editor's preview can be
 * trusted, and it stays true by keeping this file boring.
 *
 * The one thing the shell provides that the browser cannot is real file
 * access. In `npm run dev` the editor writes content back through a Vite
 * middleware; here it writes through IPC. The client API is identical on
 * purpose (`window.ed.writeContent`), so nothing above the transport changes.
 */

const HERE = fileURLToPath(new URL('.', import.meta.url));
const REPO = resolve(HERE, '../../..');
const CONTENT = join(REPO, 'packages/content');
const EDITOR_DIST = join(REPO, 'packages/editor/dist/index.html');

/** Set by `npm run shell` to the running Vite server. Absent in a built app. */
const DEV_SERVER = process.env.ED_DEV_SERVER;

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    // The chronicle is meant to be read on parchment, not on a white page.
    backgroundColor: '#141210',
    title: 'Eldritch Dynasty',
    webPreferences: {
      preload: join(HERE, 'preload.cjs'),
      // Non-negotiable. The renderer is a web page that loads YAML written by
      // whoever is authoring content; it does not get node.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (DEV_SERVER) win.loadURL(DEV_SERVER);
  else win.loadFile(EDITOR_DIST);

  // A link to a rival house's chronicle opens in the browser, not in a window
  // with no address bar and our preload attached to it.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

/**
 * Content writes, with the same guard the dev-server bridge uses: resolve the
 * path, refuse anything that escapes the content root, and read before writing
 * so the tool never creates a file it has not seen.
 */
ipcMain.handle('ed:write-content', (_event, payload) => {
  try {
    const { path, text } = payload ?? {};
    if (typeof text !== 'string') throw new Error('text required');

    const target = resolveContentPath(CONTENT, path);

    readFileSync(target, 'utf8');
    writeFileSync(target, text, 'utf8');
    return { ok: true, path };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('ed:read-content', (_event, path) => {
  try {
    const target = resolveContentPath(CONTENT, path);
    return { ok: true, text: readFileSync(target, 'utf8') };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

/**
 * `--smoke`: open the window, wait for the renderer to say it loaded, print
 * the verdict and quit.
 *
 * A shell that boots to a white page is the exact failure this codebase keeps
 * having — nothing throws, the process stays up, and the window looks like an
 * application that simply has nothing to show. This makes it say so, and it is
 * one line to run in CI.
 */
function smokeTest(win) {
  const done = (ok, why) => {
    console.log(ok ? `shell ok — ${why}` : `shell FAILED — ${why}`);
    app.exit(ok ? 0 : 1);
  };

  win.webContents.on('did-fail-load', (_e, code, desc, url) => done(false, `${desc} (${code}) loading ${url}`));
  win.webContents.on('did-finish-load', async () => {
    const mounted = await win.webContents.executeJavaScript(
      'document.querySelector("#app")?.children.length ?? 0',
    );
    if (mounted > 0) done(true, `renderer mounted from ${DEV_SERVER ?? 'editor/dist'}`);
    else done(false, 'the page loaded and #app is empty — the editor did not mount');
  });

  setTimeout(() => done(false, 'no load event in 30s'), 30_000);
}

app.whenReady().then(() => {
  const win = createWindow();
  if (process.argv.includes('--smoke')) smokeTest(win);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
