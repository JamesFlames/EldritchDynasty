import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import {
  ASSIZE_RESPONSES, armOf, assizeFavour, assizePressure, measureFortune,
  newGame, phase, place, resumeGame, testWorld,
} from '@ed/core';

const bundle = loadContent();
/**
 * THE ASSIZE, MEASURED OVER WHOLE RUNS.
 *
 * Whether the world acts about once a generation, and from its whole range,
 * is only answerable by running one. How it reads a house and what it does
 * about it are answerable against a built world, and stay in `assize.test.ts`.
 */
describe('across a whole run', () => {
  it('acts about once a generation, from the whole range of what it can do', () => {
    const g = newGame(loadContent(), { seed: 3000, decider: 'chronicler' });
    let sittings = 0;
    const used = new Set<string>();
    for (let y = 0; y < 1000; y++) {
      const acted = g.advance(1).years[0]?.assize?.acted;
      if (!acted) continue;
      sittings += 1;
      used.add(acted.id);
    }
    // A world that acts twice a millennium is not reacting to anything.
    expect(sittings).toBeGreaterThan(15);
    // A world with three moves is one the player has read by the fourth century.
    expect(used.size).toBeGreaterThan(7);
  });

  it('survives the round trip, cooldowns and all', () => {
    const g = newGame(loadContent(), { seed: 3003, decider: 'chronicler' });
    g.advance(400);
    const save = g.save();
    expect(save.assize.fired).toEqual(g.ctx.world.assize.fired);
    expect(save.assize.openedAt).toBe(1042);

    // A load that forgot the cooldowns would let a reloaded run be assessed
    // twice in one decade, and would drop any physician still in the house.
    const back = resumeGame(save, loadContent());
    expect(back.ctx.world.assize).toEqual(g.ctx.world.assize);
  });
});
