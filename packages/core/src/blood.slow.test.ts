import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { bootstrap, phenotypeOf, rungIndex, runYears } from '@ed/core';

const content = loadContent();
const SEEDS = [4000, 4013, 4026, 4039, 4052];

/**
 * THE SHAPE OF A RUN WITH BLOOD IN IT (issue #41).
 *
 * Three things shipped out of that issue's measured session — the font loci's
 * meiotic drive, a founding library, and a standing order on marriage — and
 * all three fail the way everything in this repository fails: silently, over
 * centuries, in a run that still looks like a run. `npm run gate:blood` is the
 * instrument and `docs/BALANCE-LOG.md` holds the tables; this is the floor
 * under them, so that a later change cannot quietly put the game back to where
 * the whole session started.
 *
 * The chronicler plays these. That is deliberate: what is asserted here is
 * what the game does when NOBODY is playing well, which is the only thing a
 * test can pin — the played columns are strategy, and strategy belongs in the
 * instrument.
 */
describe('the blood, over a thousand years', () => {
  const runs = SEEDS.map((seed) => {
    const ctx = bootstrap(content, seed, 1042);
    runYears(ctx, 1000);
    const w = ctx.world;

    let hotPairs = 0;
    const seen = new Set<string>();
    const font = (id: string) => {
      const p = w.people.get(id);
      return p ? phenotypeOf(p, ctx.genetics, w.year).eldritch.carriedFont : 0;
    };
    for (const p of w.people.all()) {
      if (p.houseOfOrigin !== w.playerHouse) continue;
      for (const m of p.marriages) {
        const key = [p.id, m.spouse].sort().join('>');
        if (seen.has(key)) continue;
        seen.add(key);
        if (font(p.id) > 0 && font(m.spouse) > 0) hotPairs += 1;
      }
    }

    return {
      seed,
      hotPairs,
      best: w.ascension.best,
      books: Math.max(0, ...w.people.blood(w.playerHouse).map((p) => p.spellsKnown.length)),
      carriers: w.people
        .household(w.playerHouse, w.year)
        .filter((p) => phenotypeOf(p, ctx.genetics, w.year).eldritch.carriedFont > 0).length,
      alive: w.people.household(w.playerHouse, w.year).length,
    };
  });

  /**
   * §7: "the only route by which carried power reaches an expressing male
   * heir". Measured before the drive shipped, chronicler-played: four such
   * marriages in a thousand years, out of 481. The drive roughly doubles it,
   * and doubling something that happens four times is the difference between
   * a mechanism and an accident.
   */
  it('makes the pairing the whole design turns on more than a handful of times', () => {
    const mean = runs.reduce((a, r) => a + r.hotPairs, 0) / runs.length;
    expect(mean, runs.map((r) => `${r.seed}:${r.hotPairs}`).join(' ')).toBeGreaterThan(5);
  });

  /**
   * The library, in the century the blood is still deep. Before the founding
   * shelf existed the modal best rung was `touched` and the block was
   * "he has read 0 of the three books it takes" while the man in question was
   * past Adept's power gate by twelve points.
   */
  it('gets somebody onto the ladder in most runs', () => {
    const adept = runs.filter((r) => rungIndex(r.best) >= rungIndex('adept')).length;
    expect(adept, runs.map((r) => `${r.seed}:${r.best}`).join(' ')).toBeGreaterThanOrEqual(3);
    expect(Math.max(...runs.map((r) => r.books))).toBeGreaterThanOrEqual(3);
  });

  /** And the house is still a house at the end of it. */
  it('does not empty the halls doing it', () => {
    for (const r of runs) expect(r.alive, `${r.seed}`).toBeGreaterThan(10);
  });
});
