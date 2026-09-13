import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { SAVE_FORMAT, SavedGameS } from '@ed/schema';
import {
  END_YEAR, bootstrap, closeTheLedger, digest, digestOf, foundHouse, loadGame, runYears,
  saveGame, SaveFormatError, stepYear,
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

  /**
   * A rite is an ACT, recorded on the man who took it (issue #43), and rungs
   * four to six read it as their last requirement. A field that does not
   * persist would reload a Vessel as a Hierophant with no way to become one
   * again — the ladder falling a rung on a load, silently, centuries in.
   */
  it('carries the rites a man has taken', () => {
    const before = bootstrap(content, 4242, 1042);
    const him = before.world.people.living().find((p) => p.castSlots.includes('head'))!;
    him.rites.push('vessel');

    const after = loadGame(JSON.parse(JSON.stringify(saveGame(before))), content);
    expect(after.world.people.get(him.id)?.rites).toEqual(['vessel']);
  });

  /**
   * Issue #126: `taught` is the durable mark a tutor's term leaves, distinct
   * from `acquired` — a save that dropped it would reload a schooled child as
   * an unschooled one with no way to tell the two apart again.
   */
  it('carries which attributes a term has actually completed on', () => {
    const before = bootstrap(content, 4242, 1042);
    const her = before.world.people.living()[0]!;
    her.taught.push('mind');

    const after = loadGame(JSON.parse(JSON.stringify(saveGame(before))), content);
    expect(after.world.people.get(her.id)?.taught).toEqual(['mind']);
  });

  it('carries the rent term and this year\'s parcel risk across a save', () => {
    const before = bootstrap(content, 4242, 1042);
    before.world.rentsPolicy = 'rack';
    const parcel = [...before.world.parcels.values()][0]!;
    parcel.yieldFactor = 0.37;

    const after = loadGame(JSON.parse(JSON.stringify(saveGame(before))), content);
    expect(after.world.rentsPolicy).toBe('rack');
    expect(after.world.parcels.get(parcel.id)?.yieldFactor).toBe(0.37);
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

  /**
   * Issue #8's own warning about itself: "decisionLog goes into SavedGameS.
   * Omitting it does not fail; it resets silently on load." The digest tests
   * above would catch that too, but an aggregate hash mismatch does not say
   * WHICH field reset — this does.
   */
  it('round-trips the decision log', () => {
    const before = bootstrap(content, 1042, 1042);
    runYears(before, 300);
    expect(before.world.decisionLog.length, 'nothing was logged in 300 years').toBeGreaterThan(0);

    const after = loadGame(JSON.parse(JSON.stringify(saveGame(before))), content);
    expect(after.world.decisionLog).toEqual(before.world.decisionLog);
  });

  /**
   * THE ONE THE DIGEST CANNOT SEE.
   *
   * Every test above compares two digests, and `digest` is computed from
   * `saveGame`'s output — so it covers "every field the format knows about",
   * exactly as its own comment says. That is the whole hole. Add a field to
   * `WorldState` and to `createWorld`, and forget `SavedGameS`/`saveGame`, and
   * the field is not in the format, so it is not in the digest, so every
   * round-trip test above still passes — while the field silently resets to
   * its starting value on load. CLAUDE.md names this failure by name ("it
   * makes the field reset silently on load, which looks exactly like a
   * subsystem that stopped working two centuries in") and nothing tested it.
   *
   * So this compares the world against the save by KEY rather than by value,
   * on a world old enough to have set its optional fields. It is a tripwire,
   * not a proof: it fires when someone adds state to the world and does not
   * carry it across the boundary, and the fix is either to save the field or
   * to add it to `DERIVED` below with a reason.
   */
  describe('every field on the world crosses the boundary', () => {
    /**
     * Fields that live on the world and are deliberately NOT saved, because
     * they are rebuilt from content on load. Invariant 6's rule at the save
     * boundary: derived state is not storage, and a save carrying it could
     * disagree with the content it was loaded against.
     */
    const DERIVED: Record<string, string> = {
      houses: 'rebuilt from `content.houses` by createWorld — authored data, not run state',
    };

    /** On the save and not on the world: the envelope, and state that lives on `SimCtx`. */
    const SAVE_ONLY: Record<string, string> = {
      format: 'the format version — the envelope, not the world',
      savedAt: 'a timestamp — the envelope, not the world',
      takenNames: 'lives on SimCtx beside the world, not on it',
    };

    /** Old enough that `narrator`, `guardianSince`, `headSince` and `respectChanged` are all set. */
    function agedWorld() {
      const ctx = bootstrap(content, 1042, 1042);
      runYears(ctx, 400);
      return ctx;
    }

    it('persists every key the world carries, or declares why not', () => {
      const ctx = agedWorld();
      const saved = new Set(Object.keys(saveGame(ctx)));

      const unsaved = Object.keys(ctx.world).filter((k) => !saved.has(k) && !(k in DERIVED));
      expect(
        unsaved,
        'these fields are on the world and in no save: they will reset to their starting '
          + 'value on load, silently, and the run will look healthy while they do. Add them to '
          + '`SavedGameS` and `saveGame`/`loadGame`, or to DERIVED above with a reason.',
      ).toEqual([]);
    });

    it('carries nothing in the save that is neither world state nor envelope', () => {
      const ctx = agedWorld();
      const onWorld = new Set(Object.keys(ctx.world));

      const stray = Object.keys(saveGame(ctx)).filter((k) => !onWorld.has(k) && !(k in SAVE_ONLY));
      expect(stray, 'the save carries a key that is not on the world — it will load into nothing')
        .toEqual([]);
    });

    it('holds the derived list to its word: it really is rebuilt, not restored', () => {
      const ctx = agedWorld();
      const after = loadGame(JSON.parse(JSON.stringify(saveGame(ctx))), content);

      for (const key of Object.keys(DERIVED)) {
        expect(after.world[key as keyof typeof after.world], `${key} came back empty from a load`)
          .toBeDefined();
      }
      // `houses` specifically: same houses, rebuilt from the content passed in.
      expect([...after.world.houses.keys()].sort()).toEqual([...ctx.world.houses.keys()].sort());
    });

    /**
     * The optional fields are the half a key comparison can miss: one that is
     * never set is simply absent from the object, so nothing notices it is
     * also absent from the save. This pins the sample the tripwire runs on —
     * if a future change stops setting one of these in four hundred years,
     * this fails and says the guard above went blind rather than green.
     */
    it('runs on a world that has actually set its optional fields', () => {
      const w = agedWorld().world as unknown as Record<string, unknown>;
      for (const key of ['narrator', 'guardianSince', 'headSince', 'respectChanged']) {
        expect(key in w, `${key} was never set in 400 years — the guard above no longer covers it`)
          .toBe(true);
      }
    });

    /**
     * The two ends of the run are optional for the same reason and covered by
     * nothing above: a world nobody founded never sets `founding`, and a world
     * that has not reached 2042 never sets `ending`, so four hundred years of
     * ordinary simulation leaves the tripwire blind to both. This is the
     * sample that has them — and issue #38's acceptance is precisely that they
     * are still there when the save comes back.
     */
    it('carries the two ends of the run across the boundary', () => {
      const ctx = bootstrap(content, 1042, 1042);
      foundHouse(ctx, {
        houseName: 'The House of Salt',
        heirloom: 'portion_of_agelessness',
        grudge: 'house_marrow',
      });
      ctx.world.year = END_YEAR;
      closeTheLedger(ctx);

      const after = loadGame(JSON.parse(JSON.stringify(saveGame(ctx))), content);

      expect(after.world.founding).toEqual(ctx.world.founding);
      expect(after.world.ending).toEqual(ctx.world.ending);
      expect(after.world.ending?.year).toBe(END_YEAR);
    });
  });

  it('gives different runs different digests', () => {
    const a = bootstrap(content, 1042, 1042);
    const b = bootstrap(content, 1043, 1042);
    runYears(a, 60);
    runYears(b, 60);
    expect(digest(saveGame(a))).not.toBe(digest(saveGame(b)));
  });
});
