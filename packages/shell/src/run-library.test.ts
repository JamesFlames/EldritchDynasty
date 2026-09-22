import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readRunLibrary, writeRunLibrary } from './run-library.mjs';

describe('the installation library on disk', () => {
  let userData = '';

  beforeEach(() => { userData = mkdtempSync(join(tmpdir(), 'ed-library-')); });
  afterEach(() => rmSync(userData, { recursive: true, force: true }));

  it('is a second store beside saves and round-trips atomically', () => {
    const library = { format: 1, runs: [{ id: 'house-one' }] };
    const path = writeRunLibrary(userData, library);
    expect(path).toBe(join(userData, 'library.json'));
    expect(readRunLibrary(userData)).toEqual(library);
  });

  it('has no value before a house has finished', () => {
    expect(readRunLibrary(userData)).toBeNull();
  });

  it('leaves malformed JSON for the caller to reject rather than inventing data', () => {
    writeFileSync(join(userData, 'library.json'), '{not json', 'utf8');
    expect(() => readRunLibrary(userData)).toThrow();
  });
});
