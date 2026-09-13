import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { attr, expectMean, expectRate, marry, phase, place, testWorld } from '@ed/core';
import { nutrition, spacing } from './people/condition.js';
import { ACQUIRED_SPACING } from './people/factory.js';

const content = loadContent();
// Eight is the issue's minimum; twenty-four carries the measured margin.
const SEEDS = Array.from({ length: 24 }, (_, i) => 1000 + i * 7);
const FORTUNES = [-120, 0, 500, 5_000];

describe('fortune compounds through acquired condition', () => {
  it('leaves the poorest house-years with smaller completed families without saturating', () => {
    const differences: number[] = [];
    let fertilePersonYears = 0;
    let clampedPersonYears = 0;
    let maxAcquiredFertility = 0;

    for (const seed of SEEDS) {
      const familyByFortune: number[] = [];

      // Four identical couples make literal quartiles of house-years. Running
      // the birth phase alone isolates the condition mechanism from the Match,
      // standing, mortality and the reverse pressure of a larger hall.
      for (const treasury of FORTUNES) {
        const ctx = testWorld(content, seed, 1042);
        const mother = place(ctx, { sex: 'female', age: 17, name: 'Mother' });
        const father = place(ctx, { sex: 'male', age: 19, name: 'Father' });
        marry(ctx, mother, father);

        for (let year = 0; year < 29; year++) {
          ctx.world.treasury = treasury;
          nutrition(ctx);
          spacing(ctx, mother);
          phase('births', ctx);

          const fertility = attr(mother, 'fertility', ctx.genetics, ctx.world.year);
          fertilePersonYears += 1;
          if (fertility <= 0 || fertility >= 200) clampedPersonYears += 1;
          maxAcquiredFertility = Math.max(
            maxAcquiredFertility,
            Math.abs((mother.acquired.fertility ?? 0) + (mother.acquired[ACQUIRED_SPACING] ?? 0)),
          );
          ctx.world.year += 1;
        }
        familyByFortune.push(ctx.world.people.children(mother.id).length);
      }

      differences.push(familyByFortune.at(-1)! - familyByFortune[0]!);
    }

    expectMean({
      values: differences,
      floor: 0.1,
      what: 'richest minus poorest quartile completed-family size',
    });
    expectRate({
      hits: fertilePersonYears - clampedPersonYears,
      n: fertilePersonYears,
      floor: 0.95,
      what: 'reproductive person-years away from the fertility clamps',
    });
    expect(maxAcquiredFertility, 'the acquired fertility channel ran away').toBeLessThanOrEqual(45);
  });
});
