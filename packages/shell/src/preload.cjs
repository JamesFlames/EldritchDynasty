const { contextBridge, ipcRenderer } = require('electron');

/**
 * The whole bridge. Two calls, both about content on disk, both validated in
 * the main process — the renderer gets no path handling of its own and no node.
 *
 * `@ed/editor`'s content module checks for `window.ed` and falls back to the
 * Vite dev-server endpoint when it is absent, so the same editor build runs in
 * a browser tab and inside the shell without knowing which it is in.
 */
contextBridge.exposeInMainWorld('ed', {
  isShell: true,
  writeContent: (path, text) => ipcRenderer.invoke('ed:write-content', { path, text }),
  readContent: (path) => ipcRenderer.invoke('ed:read-content', path),
});
