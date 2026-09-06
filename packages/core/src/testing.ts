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
  /**
   * Already woken, as of this year (issue #79).
   *
   * §11's learning gate means an unwoken person cannot open a book at all, so
   * a test about the LIBRARY — the shelf, a copy's condition, what a study
   * costs — has to say so, or it is a test about the gate instead. Scaffolding
   * on the same principle as `career`: it builds the state the test means,
   * without routing through `rollAwakening`, which needs a font and a die.
   */
  awakened?: boolean;
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
  if (spec.awakened) p.awakening = { ...p.awakening, awakened: true, year: w.year, age: spec.age };
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

/**
 * ─── BATCH CLAIMS, AND WHETHER THEY CAN CARRY THEIR OWN THRESHOLD ───────────
 *
 * Three tests in this suite have now broken on commits that changed nothing
 * they measured, and all three failed the same way: a threshold set by eye off
 * the same batch it was about to be tested on.
 *
 * `gives the family somewhere to quarrel with itself` is the clearest. It
 * counted feuds across twelve runs and asserted more than eight. Measured over
 * 48 seeds the underlying rate is 81%–90%, so at twelve runs that assertion
 * fails somewhere between one time in eleven and one time in four WITH NOTHING
 * WRONG. It duly went red on two household templates that fire under once a run
 * between them and create no grudges at all — because adding any template to
 * the pool re-rolls which scene wins every draw for a thousand years. That is
 * not a regression. It is what a shared draw means.
 *
 * The trouble is that a thin margin is INVISIBLE. A passing test looks exactly
 * like a well-powered one, right up until an unrelated commit spends its luck,
 * and then somebody reads a real finding into a coin landing tails.
 *
 * So the margin is asserted alongside the claim. `expectRate` fails twice over:
 * once if the claim is false, and once if the claim is true BY LUCK — if the
 * observed rate is not at least `MIN_MARGIN_SE` standard errors clear of the
 * floor. The second failure is not a bug report about the game. It is a bug
 * report about the test, and it says what to do: widen the batch.
 *
 * This is deliberately not a gate and not a lint. It runs inside the test that
 * makes the claim, on the batch that test actually ran, so it cannot drift out
 * of date and there is no second list for anybody to maintain.
 */

/**
 * How many standard errors a threshold must sit clear of the measured rate.
 *
 * Two. At two SE a claim survives about nineteen unrelated commits in twenty,
 * which is the point at which a red test is worth reading. One SE is a third of
 * builds and teaches everybody to re-run and shrug, which is worse than having
 * no test at all — a test nobody believes still costs the wall time.
 */
export const MIN_MARGIN_SE = 2;

export interface RateClaim {
  /** Runs where the thing happened. */
  hits: number;
  /** Runs in the batch. */
  n: number;
  /** The claim: the true rate is above this. */
  floor: number;
  /** What the rate is OF, for the failure message. */
  what: string;
}

/**
 * The standard error of a proportion, with a floor under it.
 *
 * A batch where everything happened gives `p = 1` and an SE of exactly zero,
 * which would report infinite confidence off a sample that has simply not seen
 * the other outcome yet. The Laplace-style floor of `1/n` is what a single
 * counter-example would cost, and it keeps a small clean batch honest: twelve
 * for twelve is good evidence, not proof.
 */
export function proportionSE(hits: number, n: number): number {
  if (n <= 0) return Infinity;
  const p = hits / n;
  return Math.max(Math.sqrt((p * (1 - p)) / n), 1 / n);
}

/**
 * Assert a rate claim AND that the batch is big enough to make it.
 *
 * Returns the margin in standard errors so a caller can print it; throws
 * through `expect` on either failure.
 */
export function expectRate(claim: RateClaim): number {
  const { hits, n, floor, what } = claim;
  const p = hits / n;
  const se = proportionSE(hits, n);
  const margin = (p - floor) / se;
  const seen = `${hits} of ${n} runs (${(p * 100).toFixed(0)}%)`;

  // A PLAIN THROW, not `expect`. This file is re-exported from the package
  // index — `place`, `testWorld` and `phase` are how every suite builds the
  // state it means — so importing vitest here would put the test runner into
  // the dependency graph of the client and the shell. Vitest reports a thrown
  // Error as a failure with its message, which is all that is wanted.
  if (!(p > floor)) {
    throw new Error(`${what}: ${seen}, and the claim is more than ${(floor * 100).toFixed(0)}%`);
  }

  if (margin < MIN_MARGIN_SE) {
    // The batch that would carry it, plus a fifth. `n` scales as the SQUARE of
    // the margin wanted, so the bare figure lands exactly on the bar — and a
    // recommendation that only just clears it fails as soon as the widened
    // batch's own rate drifts a run either way, which is the same mistake this
    // helper exists to catch, made by the helper. Its own test asserts the
    // advice actually works when taken.
    const wants = Math.ceil(n * (MIN_MARGIN_SE / Math.max(margin, 0.1)) ** 2 * 1.2);
    throw new Error(
      `${what}: the claim holds at ${seen}, but only by ${margin.toFixed(1)} standard errors — under `
      + `${MIN_MARGIN_SE}, so an unrelated commit re-rolling the draw flips it. This is a finding about `
      + `the TEST, not the game. Widen the batch (about ${wants} runs would carry it), or lower the floor `
      + 'to what the game actually does.',
    );
  }

  return margin;
}

export interface MeanClaim {
  /** The batch. One number per run. */
  values: number[];
  /** The claim: the true mean is above this. Exactly one of `floor`, `ceiling`. */
  floor?: number;
  /**
   * The claim: the true mean is BELOW this.
   *
   * Half the batch claims in these suites are budgets rather than floors —
   * "asks under 25 times a run", "spends under a hundred crowns" — and until
   * this existed the only helper took a floor, so every budget was written as
   * a bare `toBeLessThan` on an average, which is the exact thing `expectMean`
   * was built to stop. One of them then failed at a mean of 25.0 against a
   * threshold of 25, on a commit that changed nothing it measured.
   */
  ceiling?: number;
  what: string;
}

/**
 * The same guard for a claim about a MEAN rather than a rate.
 *
 * Proportions are not the only statistic these suites bet on, and the other
 * kind is worse behaved. `hotPairs` in `blood.slow.test.ts` runs 0 to 45 with
 * a standard deviation of about 12 — larger than its own mean — so a five-seed
 * average carried a standard error of 5.8 against a threshold of 5, and passed
 * at 5.40 until an unrelated commit re-rolled it to 4.40.
 *
 * A heavy tail is exactly where eyeballing a batch goes wrong, because the
 * eye reads the median and the assertion reads the mean.
 */
export function expectMean(claim: MeanClaim): number {
  let { values } = claim;
  const { what } = claim;
  const n = values.length;
  if (n < 2) throw new Error(`${what}: a mean claim needs at least two runs, got ${n}`);
  if ((claim.floor === undefined) === (claim.ceiling === undefined)) {
    throw new Error(`${what}: name exactly one of floor and ceiling — a claim with both is two claims`);
  }

  // A ceiling is a floor read in a mirror, so there is one piece of statistics
  // here and not two. Everything below works on `flip`ped values; only the
  // failure messages have to remember which way round the claim was made.
  const under = claim.ceiling !== undefined;
  const flip = (v: number) => (under ? -v : v);
  const floor = flip(under ? claim.ceiling! : claim.floor!);
  values = values.map(flip);

  const mean = values.reduce((a, b) => a + b, 0) / n;
  // Sample standard deviation (n-1): with n this small the population form is
  // biased low, which would flatter the margin exactly where it matters.
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  const se = Math.sqrt(variance / n);
  const margin = se === 0 ? Infinity : (mean - floor) / se;
  const seen = `mean ${flip(mean).toFixed(2)} of ${n} runs (sd ${Math.sqrt(variance).toFixed(2)})`;
  const said = `${under ? 'less' : 'more'} than ${flip(floor)}`;

  if (!(mean > floor)) throw new Error(`${what}: ${seen}, and the claim is ${said}`);

  if (margin < MIN_MARGIN_SE) {
    const wants = Math.ceil(n * (MIN_MARGIN_SE / Math.max(margin, 0.1)) ** 2 * 1.2);
    throw new Error(
      `${what}: the claim holds at ${seen}, but only by ${margin.toFixed(1)} standard errors — under `
      + `${MIN_MARGIN_SE}, so an unrelated commit re-rolling the draw flips it. This is a finding about `
      + `the TEST, not the game. Widen the batch (about ${wants} runs would carry it), or move the `
      + `${under ? 'ceiling' : 'floor'} to what the game actually does.`,
    );
  }

  return margin;
}
