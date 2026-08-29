import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { bootstrap } from './sim.js';
import { framePool } from './events/frame.js';

const bundle = loadContent();

/**
 * THE PAGE, NOT THE LIE (issue #41's coverage failure).
 *
 * A `chronicled` read asks whether one named event left an entry in the
 * chronicle — whatever that entry ended up saying. It exists because
 * `{ discrepancy: regalia_lie }` reaches 5.6% of runs (36 runs measured: the
 * arc gets to `seal_the_regalia_incomplete` in 11, the chronicler embellishes
 * 2) while the page itself is written in all 11, and the frame going quiet is
 * invisible from outside.
 */
describe('a frame read on the record itself', () => {
  const INTERLUDE = 'frame_the_missing_third_returns';
  const SOURCE = 'seal_the_regalia_incomplete';

  const inPool = (ctx: ReturnType<typeof bootstrap>) => framePool(ctx).some((e) => e.id === INTERLUDE);

  it('holds the interlude back until the page exists', () => {
    const ctx = bootstrap(bundle, 4242, 1042);
    expect(inPool(ctx), 'nothing has been written yet').toBe(false);

    ctx.world.chronicle.push({
      year: 1200, weight: 'page', text: 'Two of three, and everyone present saw it.',
      eventId: SOURCE, named: true, record: 'record',
    });
    expect(inPool(ctx)).toBe(true);
  });

  /**
   * The whole reason this is a read on the RECORD and not a flag on the
   * world: an omission is a dated blank line, and the blank is an artefact
   * the guardian reads as readily as a sentence.
   */
  it('counts a dated blank as a page', () => {
    const ctx = bootstrap(bundle, 4242, 1042);
    ctx.world.chronicle.push({
      year: 1200, weight: 'page', text: null, eventId: SOURCE, named: false, record: 'omit',
    });
    expect(inPool(ctx)).toBe(true);
  });

  it('is not satisfied by some other event writing a page', () => {
    const ctx = bootstrap(bundle, 4242, 1042);
    ctx.world.chronicle.push({
      year: 1200, weight: 'page', text: 'Something else entirely.',
      eventId: 'seal_aftermath', named: false, record: 'record',
    });
    expect(inPool(ctx)).toBe(false);
  });
});
