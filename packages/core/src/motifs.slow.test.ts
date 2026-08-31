import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { indexContent } from '@ed/schema';
import { bootstrap, runYears } from './sim.js';
import { END_YEAR } from './ending.js';

/**
 * THE MOTIF BUDGET, MEASURED (concept §27, issue #46).
 *
 * A motif is structural rather than decorative only if its meaning becomes
 * progressively more disturbing, and there is exactly one way for that to fail
 * silently: one of the readings never fires. The run then contains a founder
 * being hung and a wall going full nine hundred years later with nothing in
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
const SEEDS = Array.from({ length: 12 }, (_, i) => 4000 + i * 13);

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
   * A FLOOR OF HALF, against a measurement of 11, 12 and 11 of twelve. Set the
   * way gate 4's fire-rate floor is: far enough below where the content stands
   * that it never argues with an author, close enough to matter before a
   * reading quietly leaves the game. A red here means the motif has a hole in
   * the middle of it, which is the one failure that looks like nothing.
   */
  it('shows every reading, in most runs', () => {
    for (const id of READINGS) {
      const seen = runs.filter((r) => r.at[id] !== undefined).length;
      expect(seen, `${id} was seen in ${seen} of ${runs.length} runs`).toBeGreaterThanOrEqual(6);
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
  it('closes in 2042, and never before the page it reads exists', () => {
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
