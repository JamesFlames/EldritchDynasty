import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadContent } from '@ed/content';
import { createGame } from './lib/game.js';
import { browserPlatform, platformForWindow, type Platform } from './platform.js';

function bridge(): Platform {
  return {
    listSaves: async () => [], readSave: async () => null, writeSave: async () => undefined,
    deleteSave: async () => undefined, exportSave: async () => undefined, importSave: async () => null,
    onPause: () => () => undefined, onBack: () => () => undefined,
  };
}

function memoryPlatform(): Platform & { saves: Map<string, unknown> } {
  const saves = new Map<string, unknown>();
  return {
    saves,
    listSaves: async () => [...saves].map(([slot, save]) => ({ slot, ...(save as { year?: number }) })),
    readSave: async (slot) => saves.get(slot) ?? null,
    writeSave: async (slot, save) => { saves.set(slot, save); },
    deleteSave: async (slot) => { saves.delete(slot); },
    exportSave: async () => undefined, importSave: async () => null,
    onPause: () => () => undefined, onBack: () => () => undefined,
  };
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if ((path.endsWith('.ts') || path.endsWith('.vue')) && !path.endsWith('.test.ts')) out.push(path);
  }
  return out;
}

describe('the platform seam', () => {
  it('takes an injected host whole, rather than detecting one below composition', async () => {
    const injected = bridge();
    const platform = platformForWindow({ edPlatform: injected } as Window);
    expect(platform).toBe(injected);
    await expect(platform.readSave('autosave')).resolves.toBeNull();
  });

  it('gives the browser durable named saves when no host bridge exists', async () => {
    const values = new Map<string, string>();
    const storage = {
      get length() { return values.size; },
      key: (i: number) => [...values.keys()][i] ?? null,
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    } as Storage;
    const prior = globalThis.window;
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } });
    try {
      const platform = browserPlatform();
      await platform.writeSave('first', { format: 15, year: 1111, savedAt: '2026-09-13T00:00:00.000Z' });
      await platform.writeSave('second', { format: 15, year: 1200, savedAt: '2026-09-14T00:00:00.000Z' });
      await expect(platform.readSave('first')).resolves.toMatchObject({ year: 1111 });
      await expect(platform.listSaves()).resolves.toMatchObject([{ slot: 'second' }, { slot: 'first' }]);
      await platform.deleteSave('first');
      await expect(platform.readSave('first')).resolves.toBeNull();
    } finally {
      Object.defineProperty(globalThis, 'window', { configurable: true, value: prior });
    }
  });

  it('round-trips the same snapshot through separate host implementations', async () => {
    const first = memoryPlatform();
    const source = loadContent();
    const game = createGame(source, first);
    game.actions.begin(1042);
    game.actions.advance(1);
    await Promise.resolve();
    const saved = first.saves.get('autosave');
    expect(saved).toMatchObject({ format: expect.any(Number), year: 1043 });

    const second = memoryPlatform();
    second.saves.set('from elsewhere', saved!);
    const resumed = createGame(source, second);
    await expect(resumed.actions.load('from elsewhere')).resolves.toBe(true);
    expect(resumed.view.value?.year).toBe(1043);
  });

  it('does not name a host anywhere in the client', () => {
    const forbidden = /userAgent|capacitor|electron|isAndroid|process\.platform/i;
    const offenders = sourceFiles(join(import.meta.dirname))
      .filter((path) => forbidden.test(readFileSync(path, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
