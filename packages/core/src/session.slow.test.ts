import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { newGame, resumeGame, digestOf } from '@ed/core';

const content = loadContent();

/**
 * THE CLIENT'S VIEW OF THE GAME.
 *
 * The game client is not built yet, which is exactly why this surface is worth
 * testing now: it is the contract whoever writes it will be handed. Everything
 * here is written the way a client would write it — no reaching into
 * `ctx.world`, no picking an RNG seed, no knowing what a phase is.
 */
describe('a session plays the game', () => {
  it('stops the clock on a decision and says so', () => {
    const game = newGame(content, { seed: 1042, decider: 'ask' });

    let stopped = game.advance(400);
    expect(stopped.stoppedBy, 'nothing ever asked the player anything').toBe('decision');

    const year = game.year;
    // Advancing again does nothing at all, and reports the same block.
    stopped = game.advance(50);
    expect(stopped.years).toHaveLength(0);
    expect(game.year).toBe(year);
  });

  it('lets the player answer, and moves on', () => {
    const game = newGame(content, { seed: 909, decider: 'ask' });
    game.advance(400);

    const decision = game.pending[0]!;
    if (decision.kind === 'choice') {
      const open = decision.choices.find((c) => c.available) ?? decision.choices[0]!;
      const cast: Record<string, string> = {};
      for (const req of decision.cast) {
        const who = req.candidates[0];
        if (who) cast[req.slot] = who.id;
      }
      expect(game.choose(decision.id, open.id, cast).ok).toBe(true);
    } else {
      expect(game.record(decision.id, 'omit')).toBe(true);
    }

    game.letHimDecide();
    expect(game.pending).toHaveLength(0);
    expect(game.advance(1).years).toHaveLength(1);
  });

  /**
   * ISSUE #49. `advance` reported every one of these years from the day it was
   * written, in `years`, carrying live people a client cannot hold — and the
   * client dropped the lot, so a thousand years of births and deaths reached
   * nobody. `passages` is the same account as values, and this is the
   * assertion that it is actually being taken.
   */
  it('says what a thousand years did, as values', () => {
    const game = newGame(content, { seed: 1042, decider: 'chronicler' });
    const { passages } = game.advance(1000);

    // A house cannot pass a thousand years without burying anybody. If this
    // is empty, either the fold is not running or the demography has stopped,
    // and both of those look like a quiet century from the outside.
    expect(passages.length).toBeGreaterThan(0);
    expect(passages.length).toBeLessThan(1000);  // quiet years are absent, not empty
    expect(passages.some((p) => p.lines.some((l) => l.kind === 'death'))).toBe(true);
    expect(passages.some((p) => p.lines.some((l) => l.kind === 'birth'))).toBe(true);

    // In the order the years happened, each one carrying its own year, and
    // never a dated row with nothing on it.
    const years = passages.map((p) => p.year);
    expect([...years].sort((a, b) => a - b)).toEqual(years);
    expect(passages.every((p) => p.lines.length > 0)).toBe(true);
    expect(passages.every((p) => p.lines.every((l) => l.text.length > 0 && l.person))).toBe(true);
  });

  it('runs to 2042 with the chronicler holding the pen, and stops there', () => {
    const game = newGame(content, { seed: 1042, decider: 'chronicler' });
    const result = game.advance(1000);
    expect(result.years).toHaveLength(1000);
    expect(result.stoppedBy).toBeUndefined();
    expect(game.year).toBe(2042);

    // The term. `stepYear` used to run past it forever; now the ledger closes
    // on the next turn of the handle and the clock does not move again.
    expect(game.view().ending).toBeUndefined();
    game.advance(5);
    expect(game.year).toBe(2042);

    const ending = game.view().ending!;
    expect(ending.year).toBe(2042);

    // And there is something to show for it, assembled from the book this run
    // actually wrote — an auto-resolved run writes one too.
    const epilogue = game.epilogue()!;
    expect(epilogue.id).toBe(ending.id);
    expect(epilogue.reckoning.pages).toBeGreaterThan(100);
    expect(epilogue.ring.filter((b) => b.changed !== undefined)).toHaveLength(1);
  });

  /**
   * A view is a VALUE. If any of it is a live reference into the world, a
   * client that keeps two views to compare years is quietly holding the same
   * object twice — the bug the editor's version counter exists to work around.
   */
  it('renders a view that is plain data and does not move under you', () => {
    const game = newGame(content, { seed: 77, decider: 'chronicler' });
    game.advance(300);

    const before = game.view();
    const json = JSON.stringify(before);
    expect(json).toBeTypeOf('string');

    game.advance(60);
    expect(JSON.stringify(before), 'the old view changed when the world did').toBe(json);
    expect(game.view().year).toBe(before.year + 60);
  });

  it('shows the house through the view alone', () => {
    const game = newGame(content, { seed: 5150, decider: 'chronicler' });
    game.advance(250);
    const v = game.view();

    expect(v.halls.length).toBeGreaterThan(0);
    expect(v.halls.filter((h) => h.isSeat)).toHaveLength(1);
    expect(v.halls.flatMap((h) => h.members).length).toBeGreaterThan(0);
    expect(v.clausesTotal).toBe(9);
    expect(v.clausesRecovered).toBeGreaterThan(0);
    expect(v.chronicle.length).toBeGreaterThan(0);

    // Invariant 1, seen from the outside: nobody carries Madness who could not
    // have earned it.
    for (const m of v.halls.flatMap((h) => h.members)) {
      if (m.sex === 'female') expect(m.madness, m.name).toBe(0);
    }
  });

  it('saves and resumes without changing the run', () => {
    const game = newGame(content, { seed: 31, decider: 'chronicler' });
    game.advance(200);

    const resumed = resumeGame(JSON.parse(JSON.stringify(game.save())), content, { decider: 'chronicler' });
    game.advance(100);
    resumed.advance(100);

    expect(digestOf(resumed.ctx)).toBe(digestOf(game.ctx));
  });

  it('names a child, or leaves the chronicler\'s name standing', () => {
    const game = newGame(content, { seed: 1042, decider: 'chronicler' });
    while (game.view().namesWanted.length === 0 && game.year < 1100) game.advance(1);

    const wanted = game.view().namesWanted[0];
    expect(wanted, 'no child was born in sixty years').toBeDefined();
    expect(game.name(wanted!.person, 'Aelinor')).toBe(true);
    expect(game.view().namesWanted.some((n) => n.person === wanted!.person)).toBe(false);

    game.advance(20);
    game.keepSuggestedNames();
    expect(game.view().namesWanted).toHaveLength(0);
  });
});
