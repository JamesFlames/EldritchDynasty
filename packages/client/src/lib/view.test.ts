import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadContent } from '@ed/content';
import { bootstrap, runYears, viewOf } from '@ed/core';

const SRC = join(import.meta.dirname, '..');

/**
 * EVERY FIELD ON THE READ MODEL REACHES A TEMPLATE (issue #47).
 *
 * `verbs.test.ts` walks the verbs; this walks the other half. The epic that
 * asked for it says why:
 *
 *   > A field nothing reads is a bug, not a stub (invariant 11); a view field
 *   > nothing draws is the same bug one layer out. `ascension.best` exists
 *   > because invariant 14 insists the house remembers its high-water mark,
 *   > and no pixel anywhere prints it. Nothing throws. It looks precisely like
 *   > a working game.
 *
 * Five of that epic's twelve issues were this exact bug — `assize.pressure`,
 * `ascension.best`, `foremost.power`, `foremost.spells`, and the whole
 * chronicle beyond the last sixty lines — and every one of them was found by
 * a person reading the code months later rather than by anything mechanical.
 * This is the tripwire that would have caught them on the day they landed.
 *
 * It is a tripwire and not a proof: it asks whether the NAME appears in a
 * template, which a field could satisfy by coincidence. That is the same
 * bargain `verbs.test.ts` strikes, and it costs nothing against the failure
 * it catches, which is a field nobody drew at all.
 */
function templates(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) templates(path, out);
    else if (entry.endsWith('.vue')) out.push(path);
  }
  return out;
}

const drawn = templates(SRC).map((p) => readFileSync(p, 'utf8')).join('\n');

/**
 * A view taken off a run old enough to have filled its optional fields — a
 * guardian, an Age, a tale in circulation, a secret out of the house. A fresh
 * world would leave half of these absent and the walk would never see them.
 */
function agedView() {
  const ctx = bootstrap(loadContent(), 1042, 1042);
  runYears(ctx, 400);
  return viewOf(ctx) as unknown as Record<string, unknown>;
}

/** Every key name the read model actually carries, nested fields included. */
function keysOf(o: unknown, depth = 0, out = new Set<string>()): Set<string> {
  if (depth > 4 || o === null || typeof o !== 'object') return out;
  if (Array.isArray(o)) {
    // One element is the shape; forty of them is the same shape forty times.
    keysOf(o[0], depth, out);
    return out;
  }
  for (const [key, value] of Object.entries(o)) {
    out.add(key);
    // `attrs` maps are keyed by CONTENT ids — `mind`, `charm`, `thermal` — and
    // those are authored data, not fields of this read model. Walking into one
    // would have the test demand a template mentioning every attribute in the
    // game by name.
    if (key === 'attrs') continue;
    keysOf(value, depth + 1, out);
  }
  return out;
}

/**
 * Fields the client deliberately does not draw, each with the reason.
 *
 * It is one name long, and the list is kept honest below rather than by
 * intention: the first draft of it had twelve entries and eleven of them were
 * excusing fields the client already drew. An exceptions list nobody checks
 * grows until it is the whole read model, and then the tripwire is a comment.
 */
const NOT_DRAWN: Record<string, string> = {
  outcomeId: 'which branch of a template resolved. The player meets the prose; the id is for replay',
};

describe('every field on the read model reaches a template', () => {
  const keys = [...keysOf(agedView())].sort();

  it('walks a view with its optional fields actually set', () => {
    // A guard on the guard: if the walk ever comes back thin, everything below
    // passes by vacuum.
    expect(keys.length).toBeGreaterThan(60);
    for (const expected of ['guardian', 'ascension', 'assize', 'chronicle', 'halls']) {
      expect(keys, `the walk did not reach ${expected}`).toContain(expected);
    }
  });

  it.each([...keysOf(agedView())].sort().filter((k) => !(k in NOT_DRAWN)))(
    'a template draws `%s`',
    (key) => {
      expect(
        new RegExp(`\\b${key}\\b`).test(drawn),
        `nothing in packages/client draws \`${key}\` — draw it, or say why not in NOT_DRAWN`,
      ).toBe(true);
    },
  );

  /**
   * And the exceptions stay honest, in both directions.
   *
   * A name that leaves the read model should leave this list, and — the half
   * that matters — a name that somebody DOES draw should leave it too. An
   * excuse nobody rechecks is how a list of one becomes a list of forty, at
   * which point the tripwire above is a comment.
   */
  it('does not excuse a field the read model no longer has', () => {
    const stale = Object.keys(NOT_DRAWN).filter((k) => !keys.includes(k));
    expect(stale, 'these are excused and no longer on the view').toEqual([]);
  });

  it('does not excuse a field that is drawn anyway', () => {
    const needless = Object.keys(NOT_DRAWN).filter((k) => new RegExp(`\\b${k}\\b`).test(drawn));
    expect(needless, 'these are drawn, so the excuse is stale — delete it').toEqual([]);
  });
});
