import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadContent } from '@ed/content';
import { bootstrap, digestOf, loadGame, runYears, saveGame } from '@ed/core';
import { resolveSavePath, SaveSlotError, slotOfFile } from '../tools/save-slot.mjs';
import { deleteSave, listSaves, readSave, saveRoot, writeSave } from './saves.mjs';

/**
 * WRITING A RUN DOWN.
 *
 * `saveGame`/`loadGame` have round-tripped a run exactly for as long as the
 * format has existed, and until now nothing chose a slot or a directory —
 * which is the difference between a save format and saving. The bridge itself
 * needs Electron and is covered by `npm run smoke`; everything below it is
 * plain node and is covered here.
 *
 * A slot name is the second untrusted string this application takes from
 * outside itself, and a guard is mostly refusals: the table below is mostly
 * the things it exists to stop.
 */

const ROOT = '/saves';

const rejects = (slot: unknown) => expect(() => resolveSavePath(ROOT, slot)).toThrow(SaveSlotError);

describe('a slot is a name, not a path', () => {
  it('takes an ordinary name and gives it our extension', () => {
    expect(resolveSavePath(ROOT, 'the autumn run')).toBe(join(ROOT, 'the autumn run.edsave.json'));
  });

  it('refuses anything with a separator or a dot in it', () => {
    rejects('../escaped');
    rejects('..');
    rejects('a/b');
    rejects('a\\b');
    rejects('/etc/passwd');
    // No dot at all, which is what makes `..` unreachable rather than refused.
    rejects('notes.txt');
    rejects('.hidden');
  });

  it('refuses a name that is not one', () => {
    rejects('');
    rejects(undefined);
    rejects(42);
    rejects(' leading space');
    rejects('trailing space ');
    rejects('x'.repeat(65));
  });

  it('reads its own files back out of a listing and ignores everything else', () => {
    expect(slotOfFile('the autumn run.edsave.json')).toBe('the autumn run');
    expect(slotOfFile('notes.txt')).toBeUndefined();
    expect(slotOfFile('../escaped.edsave.json')).toBeUndefined();
    expect(slotOfFile('.edsave.json')).toBeUndefined();
  });
});

describe('the save directory', () => {
  let userData = '';
  let root = '';

  beforeEach(() => {
    userData = mkdtempSync(join(tmpdir(), 'ed-saves-'));
    root = saveRoot(userData);
  });
  afterEach(() => rmSync(userData, { recursive: true, force: true }));

  const aSave = (over: Record<string, unknown> = {}) => ({ format: 6, year: 1442, savedAt: '2026-08-22T00:00:00.000Z', ...over });

  it('writes, lists, reads back and deletes a slot', () => {
    writeSave(root, 'the autumn run', aSave());
    expect(listSaves(root).map((s) => s.slot)).toEqual(['the autumn run']);
    expect(listSaves(root)[0]).toMatchObject({ year: 1442, format: 6 });
    expect(readSave(root, 'the autumn run')).toMatchObject({ year: 1442 });

    deleteSave(root, 'the autumn run');
    expect(listSaves(root)).toEqual([]);
  });

  it('lists newest first', () => {
    writeSave(root, 'older', aSave({ savedAt: '2020-01-01T00:00:00.000Z' }));
    writeSave(root, 'newer', aSave({ savedAt: '2026-01-01T00:00:00.000Z' }));
    expect(listSaves(root).map((s) => s.slot)).toEqual(['newer', 'older']);
  });

  it('leaves nothing half-written behind', () => {
    // The scratch file is renamed into place, never written over the slot. A
    // `writeFileSync` interrupted half way leaves a file with the right name
    // that will never parse again — which the player finds out about the next
    // time they open the only copy of a nine-hour game.
    writeSave(root, 'the autumn run', aSave());
    expect(readdirSync(root)).toEqual(['the autumn run.edsave.json']);
  });

  it('reports a corrupt slot rather than dropping it out of the listing', () => {
    // A save list that silently omits the run somebody spent nine hours on is
    // this codebase's own failure mode with a filesystem attached.
    writeFileSync(join(root, 'ruined.edsave.json'), '{ not json', 'utf8');
    const [entry] = listSaves(root);
    expect(entry?.slot).toBe('ruined');
    expect(entry?.unreadable).toBeTruthy();
  });

  it('ignores whatever else is in the directory', () => {
    writeFileSync(join(root, 'notes.txt'), 'a list of names', 'utf8');
    writeSave(root, 'kept', aSave());
    expect(listSaves(root).map((s) => s.slot)).toEqual(['kept']);
  });

  it('refuses a blob that is not a save at all', () => {
    expect(() => writeSave(root, 'nope', 'a string' as never)).toThrow(TypeError);
    expect(() => writeSave(root, 'nope', {} as never)).toThrow(TypeError);
    expect(() => writeSave(root, 'nope', [] as never)).toThrow(TypeError);
    expect(listSaves(root)).toEqual([]);
  });

  it('refuses to delete outside the save directory', () => {
    expect(() => deleteSave(root, '../..')).toThrow(SaveSlotError);
  });

  /**
   * The point of all of it. Not "the file exists" — a run that comes off the
   * disk and continues bit-identically, which is the promise `save.test.ts`
   * makes about the format and nothing has ever made about a file.
   */
  it('round-trips a real run through the disk and continues identically', () => {
    const bundle = loadContent();
    const played = bootstrap(bundle, 1042, 1042);
    runYears(played, 200);

    writeSave(root, 'the autumn run', saveGame(played));
    const reloaded = loadGame(readSave(root, 'the autumn run'), bundle);

    runYears(played, 40);
    runYears(reloaded, 40);
    // `digestOf`, not `JSON.stringify`: property insertion order is not state,
    // and a record Zod rebuilt in schema order serialises differently from the
    // identical record the run built field by field.
    expect(digestOf(reloaded)).toBe(digestOf(played));
  });

  it('is a directory under userData, and not the repository', () => {
    expect(root).toBe(join(userData, 'saves'));
    expect(root.includes('packages')).toBe(false);
  });
});
