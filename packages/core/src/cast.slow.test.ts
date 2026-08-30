import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { CAST_MAX, castOf, type CastRole } from './cast.js';
import { bootstrap } from './sim.js';
import { stepYear } from './year/step.js';

const bundle = loadContent();
const SEEDS = [7001, 7014, 7027, 7040, 7053, 7066];

/**
 * THE SHAPE OF A HEALTHY CAST, over whole runs.
 *
 * The fast tests build one household and ask whether the reading finds what
 * is in it. This asks the question that actually decides whether issue #44
 * shipped: across a thousand years of a real run, is there ALWAYS somebody to
 * care about, is it ever the same seventy people again, and does every role on
 * the list ever get filled — because a role that never fills is a row nobody
 * has seen, which is the failure this repository specialises in.
 */
describe('who the generation is about, across whole runs', () => {
  const filled = new Map<CastRole, number>();
  let emptyYears = 0;
  let overCap = 0;
  let deadNamed = 0;
  let sizeSum = 0;
  let samples = 0;

  for (const seed of SEEDS) {
    const ctx = bootstrap(bundle, seed, 1042);
    const w = ctx.world;
    for (let i = 0; i < 1000; i++) {
      stepYear(ctx, true);
      // Sampled rather than every year: the answer changes on the scale of a
      // life, and a per-year read of a six-run batch is six thousand of them.
      if (i % 25) continue;
      const cast = castOf(ctx);
      samples += 1;
      sizeSum += cast.length;
      if (cast.length > CAST_MAX) overCap += 1;
      const living = new Set(w.people.household(w.playerHouse, w.year).map((p) => String(p.id)));
      if (!cast.length && living.size) emptyYears += 1;
      for (const c of cast) {
        filled.set(c.role, (filled.get(c.role) ?? 0) + 1);
        if (!living.has(c.person)) deadNamed += 1;
      }
    }
  }

  it('always has somebody, while the house has anybody at all', () => {
    expect(emptyYears, 'a living house with nobody to care about').toBe(0);
  });

  it('never grows back into a roster', () => {
    expect(overCap).toBe(0);
    const mean = sizeSum / samples;
    expect(mean, `mean cast size ${mean.toFixed(2)}`).toBeGreaterThanOrEqual(3);
    expect(mean, `mean cast size ${mean.toFixed(2)}`).toBeLessThanOrEqual(CAST_MAX);
  });

  it('never names anybody who is not living in the house', () => {
    expect(deadNamed).toBe(0);
  });

  /**
   * Every role, at least sometimes. `aggrieved` needs a cadet hall with a
   * wound, `married_in` needs somebody to have married in and stayed, and
   * `at_risk` needs the blood to be hurting somebody — all three are ordinary
   * in a run and none of them is guaranteed in a given spring.
   */
  it('fills every role it declares, somewhere in the batch', () => {
    const roles: CastRole[] = ['head', 'heir', 'at_risk', 'carrier', 'aggrieved', 'married_in', 'foremost'];
    const never = roles.filter((r) => !(filled.get(r) ?? 0));
    expect(never, `never filled: ${never.join(', ')}`).toEqual([]);
  });
});
