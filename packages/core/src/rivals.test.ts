import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import type { RivalPerson } from '@ed/schema';
import {
  RIVAL_LINEAGE_HOUSES, findRivalPerson, growRivalLineage, mintRecipe, pickRivalCandidate,
  rollRecipe, testRng, testWorld, tickRivals,
} from '@ed/core';

const bundle = loadContent();

/**
 * RIVAL-HOUSE DESCENT (issue #24 item 6).
 *
 * The design accepted for this item is that every person's genome is already
 * materialized from their OWN house's real gene pool (`people/factory.ts`),
 * so what needed proving is DESCENT: that a rival bride dealt to the Match
 * traces to a named rival ancestor through real meiosis, rather than being an
 * independent draw every time. That is what these tests assert — the
 * mechanism, not a seed.
 */

function genomesEqual(a: RivalPerson['genome'], b: RivalPerson['genome']): boolean {
  const same = (x: Int16Array, y: Int16Array) => x.length === y.length && x.every((v, i) => v === y[i]);
  return same(a.autosomal[0], b.autosomal[0]) && same(a.autosomal[1], b.autosomal[1])
    && same(a.sex[0], b.sex[0])
    && (a.sex[1] === null ? b.sex[1] === null : b.sex[1] !== null && same(a.sex[1], b.sex[1]));
}

describe('a rival house grows its own shadow lineage', () => {
  it('seeds two founding couples, drawn from the house\'s own pool, the first time it grows', () => {
    const ctx = testWorld(bundle, 501, 1042);
    growRivalLineage(ctx, 'house_marrow');

    const lineage = ctx.world.rivalLineages.get('house_marrow');
    expect(lineage?.people.length).toBe(4);
    expect(lineage?.people.filter((p) => p.sex === 'male').length).toBe(2);
    expect(lineage?.people.filter((p) => p.sex === 'female').length).toBe(2);
    // Paired, and paired with each other — no founder arrives unmarried.
    for (const p of lineage!.people) {
      expect(p.spouse, `${p.id} has no spouse`).toBeDefined();
      const spouse = lineage!.people.find((q) => q.id === p.spouse);
      expect(spouse?.spouse).toBe(p.id);
    }
  });

  it('is deterministic: the same seed and year seed identical founders', () => {
    const a = testWorld(bundle, 777, 1042);
    const b = testWorld(bundle, 777, 1042);
    growRivalLineage(a, 'house_marrow');
    growRivalLineage(b, 'house_marrow');

    const pa = a.world.rivalLineages.get('house_marrow')!.people;
    const pb = b.world.rivalLineages.get('house_marrow')!.people;
    expect(pa.map((p) => p.id)).toEqual(pb.map((p) => p.id));
    for (let i = 0; i < pa.length; i++) {
      expect(genomesEqual(pa[i]!.genome, pb[i]!.genome), `founder ${i} diverged`).toBe(true);
    }
  });

  it('produces children who trace to two named rival ancestors through real meiosis', () => {
    const ctx = testWorld(bundle, 909, 1042);
    for (let i = 0; i < 200; i++) {
      ctx.world.year += 1;
      growRivalLineage(ctx, 'house_marrow');
    }

    const lineage = ctx.world.rivalLineages.get('house_marrow')!;
    const byId = new Map(lineage.people.map((p) => [p.id, p]));
    const children = lineage.people.filter((p) => p.mother && p.father);
    expect(children.length, 'two hundred years produced no births at all').toBeGreaterThan(0);

    for (const child of children) {
      const mother = byId.get(child.mother!);
      const father = byId.get(child.father!);
      expect(mother, `${child.id}'s mother ${child.mother} is not in the lineage`).toBeDefined();
      expect(father, `${child.id}'s father ${child.father} is not in the lineage`).toBeDefined();
      expect(mother!.sex).toBe('female');
      expect(father!.sex).toBe('male');
    }

    // The shadow demography stays bounded rather than growing without limit.
    const living = lineage.people.filter((p) => p.died === undefined && p.left === undefined);
    expect(living.length).toBeLessThanOrEqual(40);
  });

  it('draws each configured house from its own stream, so houses cannot move each other', () => {
    const alone = testWorld(bundle, 314, 1042);
    growRivalLineage(alone, 'house_marrow');

    const together = testWorld(bundle, 314, 1042);
    growRivalLineage(together, 'house_ilm');
    growRivalLineage(together, 'house_marrow');

    const a = alone.world.rivalLineages.get('house_marrow')!.people;
    const b = together.world.rivalLineages.get('house_marrow')!.people;
    // Ids differ — `house_ilm` grew first in `together` and spent its own
    // share of the shared id counter, same as `WorldState.counters.person`
    // does for real people. What must NOT differ is what the dice drew: sex,
    // age and genome, in the same order.
    expect(a.map((p) => p.sex)).toEqual(b.map((p) => p.sex));
    expect(a.map((p) => p.born)).toEqual(b.map((p) => p.born));
    for (let i = 0; i < a.length; i++) {
      expect(genomesEqual(a[i]!.genome, b[i]!.genome), `house_marrow founder ${i} moved when house_ilm also grew`).toBe(true);
    }
  });

  it('does nothing at all when no house is configured to grow one', () => {
    const ctx = testWorld(bundle, 1234, 1042);
    tickRivals(ctx, []);
    expect(ctx.world.rivalLineages.size).toBe(0);
    expect(ctx.world.counters.rival).toBe(0);
  });

  it('names at least one house, and every named house has a gene pool to draw from', () => {
    expect(RIVAL_LINEAGE_HOUSES.length).toBeGreaterThan(0);
    for (const houseId of RIVAL_LINEAGE_HOUSES) {
      expect(bundle.houses.some((h) => h.id === houseId), houseId).toBe(true);
    }
  });
});

describe('the Match spends a rival card into a real person', () => {
  it('mints a candidate\'s real, already-materialized genome — not a fresh pool draw — and marks her spent', () => {
    const ctx = testWorld(bundle, 55, 1042);

    // A real founding couple, grown the ordinary way, so their genomes are
    // genuinely drawn from house_marrow's own pool — and a daughter of
    // theirs, added by hand so the test is not at the mercy of when a birth
    // happens to fall. She is the candidate the Match will be offered.
    growRivalLineage(ctx, 'house_marrow');
    const lineage = ctx.world.rivalLineages.get('house_marrow')!;
    const father = lineage.people.find((p) => p.sex === 'male')!;
    const mother = lineage.people.find((p) => p.sex === 'female')!;
    const daughter: RivalPerson = {
      id: 'riv_test_daughter', house: 'house_marrow', sex: 'female', born: 1022,
      mother: mother.id, father: father.id, genome: mother.genome,
    };
    lineage.people.push(daughter);

    const template = bundle.characterTemplates.find((t) => t.id === 'suitor_of_deep_blood');
    expect(template, 'content dropped suitor_of_deep_blood, which this test targets on purpose').toBeDefined();

    const recipe = rollRecipe(template!, ctx, testRng('rival-mint'));
    expect(recipe.rivalId, 'house_marrow has one eligible daughter and the recipe did not find her').toBe(daughter.id);
    expect(recipe.sex).toBe('female');
    expect(recipe.age).toBe(1042 - daughter.born);

    const before = findRivalPerson(ctx, 'house_marrow', daughter.id);
    expect(before?.left).toBeUndefined();

    const person = mintRecipe(recipe, template!, ctx);
    expect(person.genome.kind).toBe('materialized');
    if (person.genome.kind === 'materialized') {
      expect(genomesEqual(person.genome.genome, daughter.genome)).toBe(true);
    }

    // She has left the lineage — spent into the player's world, and not
    // eligible to be dealt, married or born from inside it again.
    const after = findRivalPerson(ctx, 'house_marrow', daughter.id);
    expect(after?.left).toBe(1042);
    expect(pickRivalCandidate(ctx, 'house_marrow', 'female', { min: 0, max: 99 }, testRng('recheck'))).toBeUndefined();
  });
});
