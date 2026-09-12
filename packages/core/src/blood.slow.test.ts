import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { bootstrap, expectMean, phenotypeOf, rungIndex, runYears } from '@ed/core';

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
    // A WIDER BLOCK for this one claim, on the same grounds `branches-
    // grievance.slow.test.ts` states for its own: the statistic is heavy-
    // tailed and five seeds cannot carry a threshold.
    //
    // Measured over the twenty seeds below, `hotPairs` runs 0 to 45 with a
    // standard deviation of about 12 — so the standard error on a FIVE-seed
    // mean is around 5.8, against a threshold of 5. The narrow batch had been
    // passing at 5.40, a margin smaller than one part in ten of its own
    // error, and it was one re-rolled trajectory away from failing on any
    // change at all. It duly did: the library fix two commits along moves no
    // seed's genetics and leaves the twenty-seed mean statistically where it
    // was (11.15 before, 10.50 after — a fifth of one standard error), while
    // dropping the five-seed mean to 4.40.
    //
    // Twenty seeds cost about 55 seconds and buy a mean of 10.5 against the
    // same threshold of 5. The claim is unchanged; only the sample is honest.
    // This is the fifth time this lesson has been learned here.
    //
    // THE SIXTH (issue #61). Normalising §22's mind and Madness onto the scale
    // §22 writes them on opens the upper ladder, which re-rolls every
    // trajectory downstream of it — and twenty seeds turned out to be carrying
    // this claim by 1.9 standard errors, just under the two `expectMean`
    // insists on. It said so itself, and said what to do:
    //
    //   the claim holds at mean 10.70 of 20 runs (sd 13.67), but only by 1.9
    //   standard errors — under 2, so an unrelated commit re-rolling the draw
    //   flips it. This is a finding about the TEST, not the game. Widen the
    //   batch (about 28 runs would carry it), or lower the floor.
    //
    // THE SEVENTH TIME (issue #97). Muster stage 3 rewired five outcomes in an
    // existing arc and forked its settlement — no genetics touched, but adding
    // any effect re-rolls which scene wins every draw for a thousand years,
    // the same mechanism as the sixth time above, and thirty-two seeds was
    // again just past its own edge:
    //
    //   the claim holds at mean 7.94 of 32 runs (sd 9.06), but only by 1.8
    //   standard errors — under 2. Widen the batch (about 46 runs would
    //   carry it), or move the floor to what the game actually does.
    //
    // Sixty, not forty-six, because forty-six is again the width that *just*
    // carries and this is the second time "just past the prescribed width"
    // has been the reason back here within one issue's worth of commits. The
    // floor is untouched: the claim about the game has not moved.
    const wide = Array.from({ length: 60 }, (_, i) => 4000 + i * 13).map((seed) => {
      const ctx = bootstrap(content, seed, 1042);
      runYears(ctx, 1000);
      const w = ctx.world;
      const font = (id: string) => {
        const p = w.people.get(id);
        return p ? phenotypeOf(p, ctx.genetics, w.year).eldritch.carriedFont : 0;
      };
      let hotPairs = 0;
      const seen = new Set<string>();
      for (const p of w.people.all()) {
        if (p.houseOfOrigin !== w.playerHouse) continue;
        for (const m of p.marriages) {
          const key = [p.id, m.spouse].sort().join('>');
          if (seen.has(key)) continue;
          seen.add(key);
          if (font(p.id) > 0 && font(m.spouse) > 0) hotPairs += 1;
        }
      }
      return { seed, hotPairs };
    });

    // `expectMean` rather than a bare average: this statistic's standard
    // deviation is larger than its own mean, which is the case where eyeballing
    // a batch goes wrong — the eye reads the median (about 3) and the assertion
    // reads the mean (about 10). The helper checks the margin as well as the
    // claim, so if a later drop pulls the two together the failure says which
    // of the two is the problem.
    expectMean({
      values: wide.map((r) => r.hotPairs),
      floor: 5,
      what: `the pairing the design turns on (${wide.map((r) => `${r.seed}:${r.hotPairs}`).join(' ')})`,
    });
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

  /**
   * And the house is still a house at the end of it — as a BATCH claim, which
   * is what it always was pretending to be.
   *
   * This read `for (const r of runs) expect(r.alive).toBeGreaterThan(10)` and
   * passed for months on a margin of ONE: seed 4052 finished with eleven
   * people. Rationing four burying scenes re-rolled every draw downstream for
   * a thousand years and it came back with eight — on a change that has
   * nothing whatever to do with how many people live in the hall.
   *
   * Measured over twelve seeds, the same run, across that change:
   *
   *   before  73 79 55 68 [11] 59 65 64 51 76 72 62   mean 61.3
   *   after   71 51 61 76  [8] 68 66 61 65 48 74 55   mean 58.7
   *
   * Eleven of the twelve land between 48 and 79 in both trees. 4052 is a
   * house that nearly dies, and it nearly dies either way.
   *
   * SO THE PER-SEED FLOOR WAS ASSERTING SOMETHING NOBODY MEANT: that no such
   * house exists. That is the opposite of what #42 is for — a run that cannot
   * be lost is not a run — and it is the fifth time a threshold set just under
   * a measurement has failed on a commit that did not touch what it measures.
   *
   * What is asserted instead: nobody's house is EMPTY, which is a real claim
   * and a different one, and the batch keeps a household worth the name.
   */
  it('does not empty the halls doing it', () => {
    for (const r of runs) expect(r.alive, `${r.seed} ended with nobody at all`).toBeGreaterThan(0);
    expectMean({
      values: runs.map((r) => r.alive),
      floor: 20,
      what: `the house at the term (${runs.map((r) => `${r.seed}:${r.alive}`).join(' ')})`,
    });
  });
});
