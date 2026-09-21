import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { indexContent } from '@ed/schema';
import { bootstrap, runYears } from './sim.js';
import { END_YEAR } from './ending.js';
import { expectRate } from './testing.js';

/**
 * THE MOTIF BUDGET, MEASURED (concept §27, issue #46).
 *
 * A motif is structural rather than decorative only if its meaning becomes
 * progressively more disturbing, and there is exactly one way for that to fail
 * silently: one of the readings never fires. The run then contains a founder
 * being hung and a wall going full centuries later with nothing in
 * between, which reads as two unrelated scenes rather than as one thing
 * darkening — and every other check in the build passes.
 *
 * So this asserts the two things the issue's acceptance is about: each reading
 * arrives, and they arrive IN ORDER. The order is the motif.
 *
 * Measured over the twelve seeds below, chronicler-driven to 2042:
 *
 *   the_gallery_is_begun     11 of 12   years 1044-1218 (mean 1101)
 *   no_room_on_the_wall      12 of 12   years 1255-1515 (mean 1372)
 *   somebody_taken_down      11 of 12   years 1659-2006 (mean 1813)
 *   frame_the_long_gallery    9 of 12
 *
 * A run lives through 21.7 Ages (min 19, max 25), which is why the bands are
 * `agesElapsed <= 3`, `4-12` and `>= 13` rather than the 1-2 / 3-5 / 6-8 the
 * issue's table names: those are the same thirds counted in the Ages a run
 * actually has. See the header of `events/the_long_gallery.yaml`.
 */

const content = indexContent(loadContent());
// Was `Array.from({ length: 12 }, (_, i) => 4000 + i * 13)`. Under the
// corrected blood-membership count (issue #42) eight of those twelve broke
// their own line in the founding century — a batch this file needs mostly
// alive to see LATE readings at all. Kept the four that survive (4013,
// 4026, 4065, 4091) and replaced the rest with seeds confirmed to survive
// the full thousand years elsewhere in this suite.
/**
 * SIXTY, NOT TWELVE (issue #61) — and the floor below moved with it, because
 * the old pair could not both be right.
 *
 * `shows every reading, in most runs` was a bare `>= 6 of 12`, which is the
 * anti-pattern AGENTS.md names: a threshold read off one sample of a rate. At
 * n=12 the standard error on a 40% rate is 14 points, so 4 of 12 and 6 of 12
 * are ONE standard error apart — the test could not tell the two apart and was
 * deciding builds on which twelve seeds it happened to hold.
 *
 * Measured on 60 chronicler runs, the same probe either side of Stage E5:
 *
 *                           main    this branch
 *   the_gallery_is_begun    83.3%      83.3%
 *   no_room_on_the_wall     65.0%      60.0%
 *   somebody_taken_down     40.0%      45.0%
 *   runs reaching 13 Ages   68.3%      65.0%
 *
 * So the floor of "half" had been ABOVE what the game does for as long as
 * `somebody_taken_down` has been at 40%, and `main` was passing on a lucky
 * twelve. The E stages did not cause this and did not make it worse — this
 * branch measures HIGHER on the reading that failed. It is a latent flake that
 * an unlucky draw finally showed, which is the same story this file's
 * neighbours in `docs/FAILURES.md` tell.
 */
// Widened 60 -> 120 (issue #91). This session's land content re-rolled the
// draw enough that `no_room_on_the_wall` measured 21/60 (35%), 1.6 SE above
// the quarter floor rather than clear of it — `expectRate`'s own diagnostic
// named ~110 runs as what would carry it; 120 keeps a round margin.
const SEEDS = Array.from({ length: 120 }, (_, i) => 700 + i * 7);

/** The three tale-layer readings, in the order they are meant to arrive. */
const READINGS = ['the_gallery_is_begun', 'no_room_on_the_wall', 'somebody_taken_down'] as const;

interface Run {
  /** First year each reading was seen, if it was. */
  at: Partial<Record<string, number>>;
  frame?: number;
}

function play(seed: number): Run {
  const ctx = bootstrap(content, seed, 1042);
  runYears(ctx, END_YEAR - ctx.world.year);
  const w = ctx.world;
  const out: Run = { at: {} };
  for (const e of w.chronicle) {
    if (!e.eventId || out.at[e.eventId] !== undefined) continue;
    if (READINGS.includes(e.eventId as never)) out.at[e.eventId] = e.year;
  }
  const frame = w.frame.entries.find((f) => f.eventId === 'frame_the_long_gallery');
  if (frame) out.frame = frame.year;
  return out;
}

describe('the long gallery, over a batch', () => {
  const runs = SEEDS.map(play);

  /**
   * A QUARTER, and it is a floor rather than a target — set the way gate 4's
   * fire-rate floor is: far enough below where the content stands that it
   * never argues with an author, close enough to matter before a reading
   * quietly leaves the game. A red here means the motif has a hole in the
   * middle of it, which is the one failure that looks like nothing.
   *
   * The rarest reading measures 40-45% and its own gate (`agesElapsed >= 13`)
   * is only reached by about two runs in three, so 65% is the ceiling this
   * reading could ever have. A quarter clears the measurement by better than
   * two standard errors at sixty runs, which is what `expectRate` checks and
   * what the old bare threshold did not.
   */
  it('shows every reading, in a real share of runs', () => {
    for (const id of READINGS) {
      const seen = runs.filter((r) => r.at[id] !== undefined).length;
      expectRate({ hits: seen, n: runs.length, floor: 0.25, what: `the gallery shows ${id}` });
    }
  });

  /**
   * THE ORDER IS THE MOTIF. Bands that overlap, or a reading whose window is
   * open for the whole run, produce a gallery that goes full before the cadet
   * has noticed he is not on it — the same four scenes, in an order that means
   * nothing.
   */
  it('darkens in order, in every run that sees more than one of them', () => {
    for (const [i, r] of runs.entries()) {
      const years = READINGS.map((id) => r.at[id]).filter((y): y is number => y !== undefined);
      const sorted = [...years].sort((a, b) => a - b);
      expect(years, `seed ${SEEDS[i]} read the gallery out of order: ${years.join(', ')}`).toEqual(sorted);
    }
  });

  /**
   * The fourth reading is the frame's, and the frame reacts to the record: it
   * reads the PAGE the third reading leaves — true whether the house wrote the
   * name down, wrote the damp down, or left the dated blank.
   */
  it('closes at the term, and never before the page it reads exists', () => {
    const seen = runs.filter((r) => r.frame !== undefined);
    expect(seen.length, `the last reading was seen in ${seen.length} of ${runs.length} runs`)
      .toBeGreaterThanOrEqual(4);
    for (const [i, r] of runs.entries()) {
      if (r.frame === undefined) continue;
      const premise = r.at.somebody_taken_down;
      expect(premise, `seed ${SEEDS[i]} showed the frame reading with no page under it`).toBeDefined();
      expect(r.frame).toBeGreaterThanOrEqual(premise!);
    }
  });
});
