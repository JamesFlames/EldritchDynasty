import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import {
  TUTOR_FEE, TUTOR_GAIN, TUTOR_YEARS, newGame, onTheMarket, order, phase, place, resumeGame,
  testWorld,
} from '@ed/core';

const bundle = loadContent();
/**
 * THE TABLE, MEASURED OVER WHOLE RUNS.
 *
 * The steward's two tests and the read model's first each play a full run to
 * ask whether a house left alone still gets books off the shelf and stays
 * solvent. That is the shape of a healthy run and it belongs here; the verbs
 * themselves are tested against a built world in `table.test.ts`, which is now
 * 10s cheaper for it.
 */
describe('the steward, when the player has not spoken', () => {
  it('gets books off the shelf and into people, which nothing did before', () => {
    const g = newGame(loadContent(), { seed: 3001, decider: 'chronicler' });
    g.advance(1000);
    const best = Math.max(0, ...g.ctx.world.people.all().map((p) => p.spellsKnown.length));
    // It was 1, in every run measured, because study began only from an
    // authored effect and there are a handful of those in 124 templates.
    expect(best, 'nobody in a thousand years read more than one book').toBeGreaterThan(2);
  });

  it('buys a place, and nothing else', () => {
    // A commission is bought, not earned (§13, and `careers.yaml` says so
    // too), and nothing charged for one — which was harmless while placement
    // came only from authored effects at three a run, and stopped being
    // harmless the moment the steward filled six posts at a time and held them
    // for life. The treasury ran to twenty thousand crowns by 2042.
    //
    // What the steward must NOT do is spend on the things that are decisions:
    // tutoring, and the market.
    const ctx = testWorld(bundle, 7005);
    ctx.world.treasury = 1000;
    for (let i = 0; i < 60; i += 1) {
      phase('table', ctx);
      ctx.world.year += 1;
    }
    expect(ctx.world.tutoring, 'the steward paid for a term of tutoring').toEqual([]);
    expect(ctx.world.withheld, 'the steward touched the marriage market').toEqual({});
    // And never on credit.
    expect(ctx.world.treasury).toBeGreaterThan(0);
  });

  it('keeps a house solvent enough to keep placing people', () => {
    const g = newGame(loadContent(), { seed: 3002, decider: 'chronicler' });
    g.advance(1000);
    // §13's price table has to keep meaning something in 1900. A treasury in
    // the tens of thousands makes 40 crowns of tutoring and a 200-crown
    // spellbook into rounding errors, which is the finding this whole pass
    // began with.
    expect(g.ctx.world.treasury).toBeLessThan(6000);
  });

});

describe('what the table shows', () => {

  it('names the books, who could read them, and what a term costs', () => {
    const g = newGame(loadContent(), { seed: 3000, decider: 'chronicler' });
    g.advance(400);
    const t = g.table();
    expect(t.tutorFee).toBe(TUTOR_FEE);
    expect(typeof t.canTutor).toBe('boolean');
    expect(t.treasury).toBe(Math.round(g.ctx.world.treasury));
    for (const book of t.shelf) {
      expect(book.name.length).toBeGreaterThan(2);
      for (const r of book.readers) expect(r.name.length).toBeGreaterThan(1);
    }
  });


});
