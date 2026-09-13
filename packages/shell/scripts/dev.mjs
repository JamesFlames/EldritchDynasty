import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/**
 * Vite, then Electron, then clean up after both.
 *
 * Deliberately a script rather than a `concurrently` dependency: it is twenty
 * lines, it has to kill the dev server when the window closes (a stray Vite on
 * 5173 is a confusing morning), and a build tool that needs a build tool is
 * how a two-command project becomes a five-command one.
 */

const HERE = fileURLToPath(new URL('.', import.meta.url));
const REPO = resolve(HERE, '../../..');
const URL_ = process.env.ED_DEV_SERVER ?? 'http://localhost:5174';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const vite = spawn(npm, ['run', 'dev', '--workspace', '@ed/client'], {
  cwd: REPO,
  stdio: ['ignore', 'pipe', 'inherit'],
});

let started = false;
vite.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  if (started || !String(chunk).includes('Local:')) return;
  started = true;
  launchShell();
});

function launchShell() {
  const electron = spawn(npm, ['run', 'start', '--workspace', '@ed/shell'], {
    cwd: REPO,
    stdio: 'inherit',
    env: { ...process.env, ED_DEV_SERVER: URL_ },
  });
  electron.on('exit', (code) => {
    vite.kill();
    process.exit(code ?? 0);
  });
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { vite.kill(); process.exit(0); });
}

// If Vite never comes up, say so rather than hanging on a blank terminal.
setTimeout(() => {
  if (!started) {
    console.error('vite did not report a dev server in 30s — start it yourself and run `npm run start --workspace @ed/shell`');
    vite.kill();
    process.exit(1);
  }
}, 30_000);
