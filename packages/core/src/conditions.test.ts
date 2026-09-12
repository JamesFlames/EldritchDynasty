import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import type { ActiveAge, Condition, Filter } from '@ed/schema';
import { MAIN_BRANCH } from '@ed/schema';
import {
  addGrudge, bootstrap, evalCondition, evalFilter, marry, phenotypeOf, place, standingOf, type SimCtx,
} from '@ed/core';
import { ELDRITCH_GIFT } from './genetics/expression.js';

const content = loadContent();

/**
 * THE CONDITION VOCABULARY, ASKED BOTH WAYS.
 *
 * Twenty-five predicates, and nine of them had never been evaluated once — not
 * by a test, not by a line of shipped content. They are authoring vocabulary:
 * the first time somebody wrote `{ hasExpressingHead: true }` into a YAML file
 * would have been the first time the expression ran in the history of the
 * project.
 *
 * Line coverage could not see it and would not have. The evaluator is a chain
 * of single-line guards —
 *
 *     if ('familySize' in c) return compare(...);
 *
 * — so v8 marks the statement covered the moment ANY condition is evaluated,
 * because the `in` test runs every time. The file reported 84.9% while a third
 * of it had never returned an answer. The only instrument that sees this is
 * asking each predicate a question it must answer TRUE and one it must answer
 * FALSE, which is what this file is.
 *
 * Both directions matter, and the false one matters more: a predicate stuck on
 * `true` gates nothing, and content gated on nothing fires in every run
 * forever, looking exactly like content that was meant to be common.
 */

const world = (): SimCtx => bootstrap(content, 1042, 1042);

/** Assert a predicate answers both ways, so neither direction can be stuck. */
function bothWays(ctx: SimCtx, yes: Condition, no: Condition): void {
  expect(evalCondition(yes, ctx), `expected TRUE: ${JSON.stringify(yes)}`).toBe(true);
  expect(evalCondition(no, ctx), `expected FALSE: ${JSON.stringify(no)}`).toBe(false);
}

const activeAge = (age: string, began: number, named = true): ActiveAge =>
  ({ age, began, named, paid: { standing: false } });

describe('the combinators, and the empty condition', () => {
  it('no condition at all is TRUE — an ungated event is not a broken one', () => {
    expect(evalCondition(undefined, world())).toBe(true);
  });

  it('all / any / not', () => {
    const ctx = world();
    const t: Condition = { year: { op: 'gte', value: 1000 } };
    const f: Condition = { year: { op: 'lt', value: 1000 } };

    expect(evalCondition({ all: [t, t] }, ctx)).toBe(true);
    expect(evalCondition({ all: [t, f] }, ctx)).toBe(false);
    expect(evalCondition({ any: [f, t] }, ctx)).toBe(true);
    expect(evalCondition({ any: [f, f] }, ctx)).toBe(false);
    expect(evalCondition({ not: f }, ctx)).toBe(true);
    expect(evalCondition({ not: t }, ctx)).toBe(false);
  });

  it('an empty all is TRUE and an empty any is FALSE, which is what every/some mean', () => {
    const ctx = world();
    expect(evalCondition({ all: [] }, ctx)).toBe(true);
    expect(evalCondition({ any: [] }, ctx)).toBe(false);
  });
});

describe('world state', () => {
  it('flag — set, unset, and explicitly asked for false', () => {
    const ctx = world();
    ctx.world.flags.set('the_door_was_opened', true);

    bothWays(ctx, { flag: 'the_door_was_opened' }, { flag: 'never_set' });
    expect(evalCondition({ flag: 'never_set', is: false }, ctx)).toBe(true);
    expect(evalCondition({ flag: 'the_door_was_opened', is: false }, ctx)).toBe(false);
  });

  it('knowledge — and `has: false` is a real question, not a typo', () => {
    const ctx = world();
    ctx.world.knowledge.add('knows_the_river_road');

    bothWays(ctx, { knowledge: 'knows_the_river_road', has: true }, { knowledge: 'knows_nothing', has: true });
    expect(evalCondition({ knowledge: 'knows_nothing', has: false }, ctx)).toBe(true);
  });

  it('respect compares by TIER ORDER, not alphabetically', () => {
    const ctx = world();
    ctx.world.respect = 'regarded';

    bothWays(ctx, { respect: { op: 'gte', tier: 'known' } }, { respect: { op: 'gte', tier: 'eminent' } });
    // 'eminent' sorts before 'regarded' as a string and after it as a tier.
    expect(evalCondition({ respect: { op: 'lt', tier: 'eminent' } }, ctx)).toBe(true);
  });

  it('year, generation, treasury', () => {
    const ctx = world();
    ctx.world.generation = 4;
    ctx.world.treasury = 500;

    bothWays(ctx, { year: { op: 'eq', value: 1042 } }, { year: { op: 'gt', value: 1042 } });
    bothWays(ctx, { generation: { op: 'gte', value: 4 } }, { generation: { op: 'gt', value: 4 } });
    bothWays(ctx, { treasury: { op: 'gte', value: 500 } }, { treasury: { op: 'lt', value: 0 } });
  });

  it('treasury reads a DEBT as the negative number it is', () => {
    const ctx = world();
    ctx.world.treasury = -80;

    bothWays(ctx, { treasury: { op: 'lt', value: 0 } }, { treasury: { op: 'gte', value: 0 } });
  });

  /**
   * Never once evaluated before: no content asks it and no test did. A run
   * starts with the Clause of the Term already in hand, so this counts from
   * where the game actually begins rather than from zero.
   */
  it('clausesRecovered counts the Ledger, and counts a clause once', () => {
    const ctx = world();
    const start = ctx.world.clausesRecovered.size;
    expect(start).toBeGreaterThan(0);

    ctx.world.clausesRecovered.add('clause_of_substitution');
    ctx.world.clausesRecovered.add('clause_of_substitution');

    bothWays(
      ctx,
      { clausesRecovered: { op: 'eq', value: start + 1 } },
      { clausesRecovered: { op: 'gte', value: start + 2 } },
    );
  });
});

describe('the household', () => {
  /** Never once evaluated before. */
  it('familySize counts the living household', () => {
    const ctx = world();
    const before = ctx.world.people.household(ctx.world.playerHouse, ctx.world.year).length;
    place(ctx, { sex: 'male', age: 30, name: 'One More Mouth' });

    bothWays(
      ctx,
      { familySize: { op: 'gte', value: before + 1 } },
      { familySize: { op: 'gt', value: before + 1 } },
    );
  });

  /** Never once evaluated before. */
  it('familyAny asks whether ANYONE clears the bar, including acquired points', () => {
    const ctx = world();
    const prodigy = place(ctx, { sex: 'male', age: 25, name: 'The Prodigy' });
    prodigy.acquired.mind = (prodigy.acquired.mind ?? 0) + 500;
    if (prodigy.phenotype) prodigy.phenotype.dirty = true;

    bothWays(ctx, { familyAny: { attr: 'mind', atLeast: 100 } }, { familyAny: { attr: 'mind', atLeast: 10_000 } });
  });

  /**
   * THE FILTER THAT IS NOT THE CONDITION (§22, issue #43).
   *
   * `ascension` asks where the HOUSE stood when the ladder was last measured,
   * which is the second-to-last phase of the year; this asks where one man
   * stands right now. The difference is a whole year, and it is reachable: a
   * scene gated on the house and cast on `foremost` was measurably handed to
   * men who had never climbed, once the man who had was charged past his own
   * mind earlier in the same year.
   */
  it('the rung filter reads one man now, not the house last autumn', () => {
    const ctx = world();
    const him = ctx.world.people.living().find((p) => p.castSlots.includes('head'))!;

    // Built to the rung rather than bred to it: this is a test about the
    // filter, and simulating four centuries to reach a Hierophant is a wait.
    ctx.world.respect = 'eminent';
    him.awakening.awakened = true;
    him.acquired[ELDRITCH_GIFT] = 400;
    him.acquired.mind = 200;
    him.madness = 25;
    for (const b of content.spellbooks.slice(0, 8)) him.spellsKnown.push(b.id);
    him.phenotype = undefined;
    expect(standingOf(ctx, him).rung).toBe('hierophant');

    expect(evalFilter({ rung: { atLeast: 'hierophant' } }, him, ctx, {})).toBe(true);
    expect(evalFilter({ rung: { atLeast: 'vessel' } }, him, ctx, {})).toBe(false);

    // And the case the filter exists for: the same man, charged past his own
    // mind, is no longer a candidate — while `world.ascension` still says the
    // house has a Hierophant, because nothing has re-measured it.
    him.madness = 500;
    him.phenotype = undefined;
    expect(evalFilter({ rung: { atLeast: 'hierophant' } }, him, ctx, {})).toBe(false);
  });

  it('familyAny is FALSE for an attribute nobody has, rather than throwing', () => {
    expect(evalCondition({ familyAny: { attr: 'no_such_attribute', atLeast: 1 } }, world())).toBe(false);
  });

  /**
   * Never once evaluated before, and the one most likely to be reached for:
   * whether the person in the seal room can go mad is the hinge of the whole
   * Madness design.
   */
  it('hasExpressingHead reads the sitting Head, both ways', () => {
    const ctx = world();
    const head = ctx.world.people.living().find((p) => p.castSlots.includes('head'))!;
    expect(phenotypeOf(head, ctx.genetics, ctx.world.year).eldritch.canExpress).toBe(true);

    bothWays(ctx, { hasExpressingHead: true }, { hasExpressingHead: false });
  });

  it('hasExpressingHead is FALSE with no Head at all, and says so rather than throwing', () => {
    const ctx = world();
    for (const p of ctx.world.people.living()) p.castSlots = p.castSlots.filter((s) => s !== 'head');

    expect(evalCondition({ hasExpressingHead: true }, ctx)).toBe(false);
    expect(evalCondition({ hasExpressingHead: false }, ctx)).toBe(true);
  });

  it('inRegency is the sex of whoever holds the seal', () => {
    const ctx = world();
    for (const p of ctx.world.people.living()) p.castSlots = p.castSlots.filter((s) => s !== 'head');
    place(ctx, { sex: 'female', age: 38, name: 'She Who Holds It', castSlots: ['head'] });

    bothWays(ctx, { inRegency: true }, { inRegency: false });
  });

  it('unlocked reads a trait somebody in the house is carrying', () => {
    const ctx = world();

    expect(evalCondition({ unlocked: 'gate_watch' }, ctx)).toBe(false);
    place(ctx, { sex: 'male', age: 30, name: 'The Watchman', traits: ['keeps_a_night_watch'] });

    bothWays(ctx, { unlocked: 'gate_watch' }, { unlocked: 'nothing_grants_this' });
  });
});

describe('cadet branches', () => {
  const withBranch = (ctx: SimCtx, id: string, grievance: number, extinct?: number) => {
    const founder = place(ctx, { sex: 'male', age: 40, name: `Founder of ${id}`, branch: id });
    ctx.world.branches.set(id, {
      id: id as never,
      name: id,
      house: ctx.world.playerHouse as never,
      founder: founder.id,
      splitFrom: MAIN_BRANCH,
      foundedYear: ctx.world.year,
      grievance,
      ...(extinct !== undefined ? { extinct } : {}),
    });
  };

  /** Never once evaluated before. */
  it('cadetBranches counts the LIVING halls, not the extinct ones', () => {
    const ctx = world();
    expect(evalCondition({ cadetBranches: { op: 'eq', value: 0 } }, ctx)).toBe(true);

    withBranch(ctx, 'second_hall', 10);
    withBranch(ctx, 'third_hall', 20);
    withBranch(ctx, 'burnt_hall', 90, ctx.world.year - 5);

    bothWays(ctx, { cadetBranches: { op: 'eq', value: 2 } }, { cadetBranches: { op: 'gte', value: 3 } });
  });

  it('branchGrievance reports the ANGRIEST live branch', () => {
    const ctx = world();
    withBranch(ctx, 'second_hall', 12);
    withBranch(ctx, 'third_hall', 47);

    bothWays(ctx, { branchGrievance: { op: 'gte', value: 47 } }, { branchGrievance: { op: 'gt', value: 47 } });
  });

  it('branchGrievance ignores an extinct branch, however aggrieved it died', () => {
    const ctx = world();
    withBranch(ctx, 'burnt_hall', 100, ctx.world.year - 5);

    expect(evalCondition({ branchGrievance: { op: 'gte', value: 1 } }, ctx)).toBe(false);
  });

  it('discontent is the house-wide number', () => {
    const ctx = world();
    ctx.world.discontent = 33;

    bothWays(ctx, { discontent: { op: 'gte', value: 33 } }, { discontent: { op: 'gt', value: 33 } });
  });

  /** Never once evaluated before. */
  it('grudgeAgainstUs finds the worst live grudge pointed at the house', () => {
    const ctx = world();
    expect(evalCondition({ grudgeAgainstUs: { op: 'gt', value: 0 } }, ctx)).toBe(false);

    const ours = ctx.world.people.living().find((p) => p.castSlots.includes('head'))!;
    const outsider = place(ctx, { sex: 'male', age: 40, name: 'A Man Who Remembers', house: 'house_ilm' });
    addGrudge(ctx, outsider.id, ours.id, { severity: 60, inheritance: 'none' });

    bothWays(ctx, { grudgeAgainstUs: { op: 'gte', value: 60 } }, { grudgeAgainstUs: { op: 'gt', value: 60 } });
  });
});

describe('Age gating', () => {
  it('ageActive names one', () => {
    const ctx = world();
    ctx.world.age.active = [activeAge('the_wars', 1040)];

    bothWays(ctx, { ageActive: 'the_wars' }, { ageActive: 'the_long_peace' });
  });

  /** Never once evaluated before — and it reads the AgeDef, not the ActiveAge. */
  it('ageRegister asks what KIND of Age is running', () => {
    const ctx = world();
    ctx.world.age.active = [activeAge('the_wars', 1040)];
    expect(content.age('the_wars')?.register).toBe('cold');

    bothWays(ctx, { ageRegister: 'cold' }, { ageRegister: 'warm' });
  });

  it('ageRegister is FALSE for an Age the content does not define, rather than throwing', () => {
    const ctx = world();
    ctx.world.age.active = [activeAge('no_such_age', 1040)];

    expect(evalCondition({ ageRegister: 'cold' }, ctx)).toBe(false);
  });

  it('ageElapsed measures from the year it began', () => {
    const ctx = world();
    ctx.world.age.active = [activeAge('the_wars', 1030)];

    bothWays(ctx, { ageElapsed: { op: 'gte', years: 12 } }, { ageElapsed: { op: 'gte', years: 13 } });
  });

  /** Never once evaluated before. */
  it('ageStacked counts how many are running at once', () => {
    const ctx = world();
    ctx.world.age.active = [activeAge('the_wars', 1040), activeAge('the_plague', 1041)];

    bothWays(ctx, { ageStacked: { op: 'eq', count: 2 } }, { ageStacked: { op: 'gte', count: 3 } });
  });

  /** Never once evaluated before. An Age is unnamed until it has run long enough to earn one. */
  it('ageNamed asks whether ANY running Age has been named yet', () => {
    const ctx = world();
    ctx.world.age.active = [activeAge('the_wars', 1040, false)];

    bothWays(ctx, { ageNamed: false }, { ageNamed: true });

    ctx.world.age.active.push(activeAge('the_plague', 1041, true));
    expect(evalCondition({ ageNamed: true }, ctx)).toBe(true);
  });

  it('every Age condition is FALSE when no Age is running', () => {
    const ctx = world();
    ctx.world.age.active = [];

    expect(evalCondition({ ageActive: 'the_wars' }, ctx)).toBe(false);
    expect(evalCondition({ ageRegister: 'cold' }, ctx)).toBe(false);
    expect(evalCondition({ ageElapsed: { op: 'gte', years: 0 } }, ctx)).toBe(false);
    expect(evalCondition({ ageNamed: true }, ctx)).toBe(false);
    expect(evalCondition({ ageNamed: false }, ctx)).toBe(false);
    expect(evalCondition({ ageStacked: { op: 'eq', count: 0 } }, ctx)).toBe(true);
  });
});

describe('posts and schooling (issue #126)', () => {
  /** Never once evaluated before. */
  it('posts counts the household, optionally narrowed to named careers', () => {
    const ctx = world();
    place(ctx, { sex: 'male', age: 40, name: 'A Man At Court', career: { career: 'court' } });
    place(ctx, { sex: 'male', age: 40, name: 'A Soldier', career: { career: 'military' } });

    bothWays(ctx, { posts: { op: 'gte', value: 2 } }, { posts: { op: 'gte', value: 3 } });
    bothWays(
      ctx,
      { posts: { op: 'eq', value: 1, career: ['court'] } },
      { posts: { op: 'eq', value: 0, career: ['court'] } },
    );
  });

  it('posts is FALSE for a career nobody holds, both narrowed and unnarrowed to zero', () => {
    const ctx = world();
    expect(evalCondition({ posts: { op: 'gte', value: 1, career: ['clergy'] } }, ctx)).toBe(false);
  });

  /** Never once evaluated before. */
  it('postHeldFor reads the LONGEST current tenure of that post', () => {
    const ctx = world();
    place(ctx, { sex: 'male', age: 40, name: 'New To It', career: { career: 'court', heldYears: 2 } });
    place(ctx, { sex: 'male', age: 60, name: 'Old Hand', career: { career: 'court', heldYears: 20 } });

    bothWays(
      ctx,
      { postHeldFor: { career: 'court', op: 'gte', years: 20 } },
      { postHeldFor: { career: 'court', op: 'gt', years: 20 } },
    );
  });

  it('postHeldFor is FALSE when nobody holds the post at all, rather than comparing against nothing', () => {
    const ctx = world();
    expect(evalCondition({ postHeldFor: { career: 'clergy', op: 'gte', years: 0 } }, ctx)).toBe(false);
  });
});

describe('land (issue #91, Phase D — #98)', () => {
  /** Never once evaluated before. */
  it('holdsParcel asks about one named parcel, not a kind', () => {
    const ctx = world();
    bothWays(ctx, { holdsParcel: 'hallowfield' }, { holdsParcel: 'sowerhay' });
  });

  it('holdsParcel is FALSE for an id nothing authored, not a thrown error', () => {
    expect(evalCondition({ holdsParcel: 'no_such_parcel' }, world())).toBe(false);
  });

  /** Never once evaluated before. */
  it('acreage sums every currently held parcel', () => {
    const ctx = world();
    bothWays(
      ctx,
      { acreage: { op: 'gt', value: 0 } },
      { acreage: { op: 'gte', value: 1_000_000 } },
    );
  });

  it('acreage falls by exactly what is lost when a parcel is dropped', () => {
    const ctx = world();
    const at = (op: 'gte', value: number) => evalCondition({ acreage: { op, value } }, ctx);
    // Find the exact total by bisecting is overkill — read it straight off content instead.
    const total = [...ctx.world.parcels.values()]
      .reduce((sum, s) => sum + (s.defId ? content.parcel(s.defId)?.acres ?? 0 : 0), 0);
    expect(at('gte', total)).toBe(true);
    expect(at('gte', total + 1)).toBe(false);

    const [id] = [...ctx.world.parcels.entries()].find(([, s]) => s.defId === 'hallowfield')!;
    const hallowfieldAcres = content.parcel('hallowfield')!.acres;
    ctx.world.parcels.delete(id);

    expect(at('gte', total)).toBe(false);
    expect(at('gte', total - hallowfieldAcres)).toBe(true);
  });
});

describe('Discrepancies', () => {
  const open = (ctx: SimCtx, id: string, state: 'open' | 'proven' | 'buried') => {
    ctx.world.discrepancies.set(id, { severity: 'grave', provableBy: [], state });
  };

  it('discrepancy without a state asks only whether it exists', () => {
    const ctx = world();
    open(ctx, 'the_missing_third', 'buried');

    bothWays(ctx, { discrepancy: 'the_missing_third' }, { discrepancy: 'never_happened' });
  });

  it('discrepancy with a state asks for that state exactly', () => {
    const ctx = world();
    open(ctx, 'the_missing_third', 'proven');

    bothWays(
      ctx,
      { discrepancy: 'the_missing_third', state: 'proven' },
      { discrepancy: 'the_missing_third', state: 'open' },
    );
  });

  it('openDiscrepancies counts only the open ones', () => {
    const ctx = world();
    open(ctx, 'a', 'open');
    open(ctx, 'b', 'open');
    open(ctx, 'c', 'proven');
    open(ctx, 'd', 'buried');

    bothWays(ctx, { openDiscrepancies: { op: 'eq', value: 2 } }, { openDiscrepancies: { op: 'gte', value: 3 } });
  });
});

/**
 * The default that used to be `return true`. A condition kind added to the
 * schema and not handled in the evaluator would PASS, so every event carrying
 * it fired unconditionally for a thousand years and looked like content that
 * was meant to be common. Nothing proved it was loud now; this does.
 */
describe('a condition the evaluator does not know', () => {
  it('throws rather than passing', () => {
    expect(() => evalCondition({ noSuchCondition: true } as unknown as Condition, world()))
      .toThrow(/condition/);
  });

  /**
   * The same default, one function down, and the same cost: a filter kind
   * nothing handles used to pass, which means a slot spec written against it
   * cast ANYONE — the opposite of what a filter is for.
   */
  it('so does a filter kind nothing handles, and so does an unknown relation', () => {
    const ctx = world();
    const p = ctx.world.people.living()[0]!;

    expect(() => evalFilter({ noSuchFilter: true } as unknown as Filter, p, ctx, {}))
      .toThrow(/filter/);
    expect(() => evalFilter({ relation: 'cousin_of', of: 'OTHER' } as unknown as Filter, p, ctx, { OTHER: p.id }))
      .toThrow(/relation filter/);
  });
});

/** Marriage is state a condition can read; this keeps `marry` in the truth table's world. */
describe('the household predicates see people put there by the helpers', () => {
  it('a placed and married couple counts toward familySize', () => {
    const ctx = world();
    const before = ctx.world.people.household(ctx.world.playerHouse, ctx.world.year).length;
    const husband = place(ctx, { sex: 'male', age: 30, name: 'A Husband' });
    const wife = place(ctx, { sex: 'female', age: 28, name: 'A Wife' });
    marry(ctx, husband, wife);

    expect(evalCondition({ familySize: { op: 'eq', value: before + 2 } }, ctx)).toBe(true);
  });
});
