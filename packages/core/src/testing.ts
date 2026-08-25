import type { Content, ContentBundle, Person, Sex } from '@ed/schema';
import { asId, MAIN_BRANCH } from '@ed/schema';
import type { SimCtx } from './world.js';
import { bootstrap } from './sim.js';
import { makePerson } from './people/factory.js';
import { makeRng, hashSeed } from './rng.js';
import { emptyReport, type YearReport } from './year/report.js';
import { YEAR_PHASES } from './year/phases.js';
import { streamFor } from './rng.js';

/**
 * TEST SCAFFOLDING.
 *
 * Every test in this codebase used to reach the state it wanted by simulating
 * its way there — four hundred years to get a widow, six hundred to get a
 * cadet branch with a grievance — which is why the suite costs twenty-one
 * minutes of CPU and why a failure takes a while to localise.
 *
 * The long runs are not the problem: `demography.test.ts` and `arcs.test.ts`
 * assert the SHAPE OF A HEALTHY RUN, and there is no way to check that except
 * by running one. The problem is that a test about one function had no other
 * option. These helpers are the other option — build the world you mean, run
 * the one phase you are testing, assert.
 *
 * Real content throughout. A hand-built miniature bundle would be a second
 * definition of the game, and the second definition is always the one that
 * quietly stops matching.
 */

/** A world with the founding cast in it and nothing else having happened. */
export function testWorld(source: ContentBundle | Content, seed = 1042, year = 1042): SimCtx {
  return bootstrap(source, seed, year);
}

export interface PlacedPerson {
  sex: Sex;
  /** Age this year, which is friendlier to write than a birth year. */
  age: number;
  name?: string;
  house?: string;
  branch?: string;
  /** 'head' makes them the sitting Head; anything else is an ordinary cast tag. */
  castSlots?: string[];
  traits?: string[];
  contract?: Person['contract'];
  /**
   * A post already held, and how long they have held it. Deliberately not
   * routed through the `career` effect: scaffolding builds the state a test
   * means, including states the effect's own `minAge` guard would refuse.
   */
  career?: { career: string; heldYears?: number };
}

/**
 * Put someone in the world, fully formed.
 *
 * Their genome is lazy and derived from their name and age, so the same call
 * produces the same person every time the test runs — a test that places "a
 * forty-year-old man of the house" and gets a different Strength each run is a
 * test that will eventually fail for no reason.
 */
export function place(ctx: SimCtx, spec: PlacedPerson): Person {
  const w = ctx.world;
  const house = spec.house ?? w.playerHouse;
  const name = spec.name ?? `Test${w.counters.person + 1}`;
  const seed = hashSeed(w.seed, 'placed', name, spec.age);

  const p = makePerson({
    sex: spec.sex,
    born: w.year - spec.age,
    house,
    name,
    genome: { kind: 'lazy', pool: house, seed },
    seed,
    seq: w,
  });

  p.castSlots = [...(spec.castSlots ?? [])];
  for (const t of spec.traits ?? []) p.traits.add(asId(t));
  if (spec.contract) p.contract = spec.contract;
  if (spec.career) {
    p.career = { career: asId(spec.career.career), from: w.year - (spec.career.heldYears ?? 0) };
  }
  if (spec.branch && spec.branch !== MAIN_BRANCH && p.membership[0]) {
    p.membership[0].branch = spec.branch;
  }

  ctx.takenNames.add(name);
  w.people.add(p);
  return p;
}

/** Marry two people as of this year, on both sides, the way `kill` expects. */
export function marry(ctx: SimCtx, a: Person, b: Person): void {
  a.marriages.push({ spouse: b.id, from: ctx.world.year });
  b.marriages.push({ spouse: a.id, from: ctx.world.year });
}

/** Give a child two parents after the fact, keeping the kin index honest. */
export function beget(ctx: SimCtx, child: Person, mother?: Person, father?: Person): void {
  ctx.world.people.setParents(child.id, {
    ...(mother ? { mother: mother.id } : {}),
    ...(father ? { father: father.id } : {}),
  });
  child.claimedParents = { ...child.trueParents };
}

/**
 * Run one named phase of the year, with that phase's own stream, and hand back
 * what it reported. The year does NOT advance — the point is to exercise one
 * system against a state you built by hand.
 */
export function phase(name: string, ctx: SimCtx, autoResolve = true): YearReport {
  const found = YEAR_PHASES.find((p) => p.name === name);
  if (!found) {
    throw new Error(`no year phase '${name}'; there are ${YEAR_PHASES.map((p) => p.name).join(', ')}`);
  }
  const report = emptyReport(ctx.world.year);
  found.run({ ctx, rng: streamFor(ctx.world, found.name), report, autoResolve });
  return report;
}

/** A throwaway stream, for calling an engine function directly. */
export function testRng(...salt: (string | number)[]) {
  return makeRng(hashSeed('test', ...salt));
}
