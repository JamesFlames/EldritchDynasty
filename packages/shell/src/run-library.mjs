import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The Library of Houses is installation/profile data, not a save slot. The
 * shell treats it as opaque JSON exactly as it treats saves; schema validation
 * belongs above this transport boundary.
 */
export function readRunLibrary(userData) {
  const path = join(userData, 'library.json');
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Atomic for the same reason save writes are atomic. */
export function writeRunLibrary(userData, library) {
  if (library === null || typeof library !== 'object' || Array.isArray(library)) {
    throw new TypeError('the library is a JSON object');
  }
  const target = join(userData, 'library.json');
  const scratch = `${target}.writing`;
  writeFileSync(scratch, JSON.stringify(library), 'utf8');
  renameSync(scratch, target);
  return target;
}
