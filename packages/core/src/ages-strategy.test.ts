import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import {
  AGE_STRATEGIES, activeMatchPriorities, activeRecordPriorities, ageCareerFactor, ageRecordFactor,
  strategicPressures, testWorld,
} from '@ed/core';

const bundle = loadContent();

function inAge(id: string) {
  const ctx = testWorld(bundle);
  ctx.world.age.active = [{
    age: id,
    began: ctx.world.year - 5,
    named: false,
    paid: { standing: false },
  }];
  return ctx;
}

describe('Age strategic identity', () => {
  it('covers every shipped Age with two date/name-stripped player priorities', () => {
    expect(Object.keys(AGE_STRATEGIES).sort()).toEqual(bundle.ages.map((a) => a.id).sort());

    for (const def of bundle.ages) {
      const ctx = inAge(def.id);
      const pressures = strategicPressures(ctx);
      expect(pressures, def.id).toHaveLength(2);
      expect(new Set(pressures).size, def.id).toBe(2);
      const diagnostic = pressures.join(' ').toLowerCase();
      expect(diagnostic).not.toContain(def.id.toLowerCase());
      expect(diagnostic).not.toContain(def.name.toLowerCase());
      expect(diagnostic).not.toContain(String(ctx.world.year));
    }
  });

  it('changes Match desirability in several different directions', () => {
    expect(activeMatchPriorities(inAge('the_long_peace'))).toEqual(['continuity']);
    expect(activeMatchPriorities(inAge('the_crusade'))).toEqual(['standing']);
    expect(activeMatchPriorities(inAge('the_withering'))).toEqual(['blood']);
  });

  it('changes which careers are valuable rather than scaling every post', () => {
    const wars = inAge('the_wars');
    expect(ageCareerFactor(wars, 'military')).toBe(1.5);
    expect(ageCareerFactor(wars, 'scholar')).toBe(1);

    const withering = inAge('the_withering');
    expect(ageCareerFactor(withering, 'scholar')).toBe(1.5);
    expect(ageCareerFactor(withering, 'military')).toBe(1);
  });

  it('changes recurring Record temptation without removing any option', () => {
    const crusade = inAge('the_crusade');
    expect(ageRecordFactor(crusade, 'omit')).toBe(2);
    expect(ageRecordFactor(crusade, 'record')).toBe(1);
    expect(ageRecordFactor(crusade, 'embellish')).toBe(1);
    expect(activeRecordPriorities(crusade)).toEqual(['omit']);

    const quickening = inAge('the_quickening');
    expect(ageRecordFactor(quickening, 'embellish')).toBe(2);
    expect(ageRecordFactor(quickening, 'record')).toBe(1);
    expect(ageRecordFactor(quickening, 'omit')).toBe(1);
    expect(activeRecordPriorities(quickening)).toEqual(['embellish']);
  });

  it('combines overlapping Ages as distinct pressures, not a late-game multiplier', () => {
    const ctx = inAge('the_wars');
    ctx.world.age.active.push({
      age: 'the_crusade',
      began: ctx.world.year - 3,
      named: false,
      paid: { standing: false },
    });
    expect(activeMatchPriorities(ctx)).toEqual(['continuity', 'standing']);
    expect(strategicPressures(ctx)).toHaveLength(4);
  });
});
