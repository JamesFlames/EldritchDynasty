import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { SAVE_FORMAT, SavedGameS } from '@ed/schema';
import {
  bootstrap, digest, digestOf, loadGame, runYears, saveGame, SaveFormatError, stepYear,
} from '@ed/core';

const content = loadContent();

/**
 * A PLAYTHROUGH IS TEN HOURS AND HAD NO SAVE.
 *
 * These tests are about the thing that makes one possible: the world being a
 * value. The failure mode they exist for is not a crash — it is a field that
 * quietly does not persist, so a house loads with its grudges forgotten, its
 * frequency ration reset, or its docket empty, and plays on looking perfectly
 * healthy.
 */
describe('a run survives being written down', () => {
  it('round-trips a fresh world exactly', () => {
    const before = bootstrap(content, 1042, 1042);
    const after = loadGame(JSON.parse(JSON.stringify(saveGame(before))), content);
    expect(digestOf(after)).toBe(digestOf(before));
  });

  it('round-trips a run four hundred years in', () => {
    const before = bootstrap(content, 909, 1042);
    runYears(before, 400);
    const after = loadGame(JSON.parse(JSON.stringify(saveGame(before))), content);
    expect(digestOf(after)).toBe(digestOf(before));
  });

  /**
   * The one that matters. A save that restores every FIELD but not the
   * generative state — id counters, the taken-name set, the frequency ledgers —
   * reloads into a world that looks right and then diverges, which is the same
   * class of bug as the module-level id counter in invariant 8.
   */
  it('continues identically after loading', () => {
    const original = bootstrap(content, 5150, 1042);
    runYears(original, 300);

    const reloaded = loadGame(JSON.parse(JSON.stringify(saveGame(original))), content);
    runYears(original, 120);
    runYears(reloaded, 120);

    expect(digestOf(reloaded)).toBe(digestOf(original));
  });

  it('keeps the pedigree walkable after a load', () => {
    const before = bootstrap(content, 77, 1042);
    runYears(before, 250);
    const after = loadGame(JSON.parse(JSON.stringify(saveGame(before))), content);

    // The kin index is rebuilt on load, not saved, so this is the assertion
    // that the rebuild actually happens.
    for (const p of before.world.people.all()) {
      const kids = before.world.people.children(p.id).length;
      expect(after.world.people.children(p.id).length, `${p.name}'s children`).toBe(kids);
    }
    const anyParent = before.world.people.all().find((p) => before.world.people.children(p.id).length > 1);
    expect(anyParent, 'nobody in 250 years had two children').toBeDefined();
  });

  it('carries an open docket across the save', () => {
    const ctx = bootstrap(content, 1042, 1042);
    // Ask rather than auto-resolve, until something is actually standing open.
    for (let i = 0; i < 400 && !ctx.world.pendingDecisions.length; i++) stepYear(ctx, false);
    expect(ctx.world.pendingDecisions.length, 'no decision was ever raised').toBeGreaterThan(0);

    const after = loadGame(JSON.parse(JSON.stringify(saveGame(ctx))), content);
    expect(after.world.pendingDecisions.map((d) => d.id))
      .toEqual(ctx.world.pendingDecisions.map((d) => d.id));

    // And it still blocks the clock on the other side.
    const year = after.world.year;
    const report = stepYear(after, false);
    expect(report.blocked?.length).toBeGreaterThan(0);
    expect(after.world.year).toBe(year);
  });

  it('validates against its own schema', () => {
    const ctx = bootstrap(content, 31, 1042);
    runYears(ctx, 150);
    expect(() => SavedGameS.parse(JSON.parse(JSON.stringify(saveGame(ctx))))).not.toThrow();
  });

  it('refuses a save it cannot read, and says which field', () => {
    const ctx = bootstrap(content, 1042, 1042);
    const save = JSON.parse(JSON.stringify(saveGame(ctx)));

    expect(() => loadGame({ ...save, format: 99 }, content))
      .toThrow(new SaveFormatError(`save format 99, expected ${SAVE_FORMAT}`));

    delete save.counters;
    expect(() => loadGame(save, content)).toThrow(/counters/);
  });

  it('gives different runs different digests', () => {
    const a = bootstrap(content, 1042, 1042);
    const b = bootstrap(content, 1043, 1042);
    runYears(a, 60);
    runYears(b, 60);
    expect(digest(saveGame(a))).not.toBe(digest(saveGame(b)));
  });
});
