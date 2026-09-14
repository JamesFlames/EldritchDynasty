import { describe, expect, it } from 'vitest';
import { CAST_MAX, CAST_ROLES, castOf, type CastRole } from './cast.js';
import { loadContent } from '@ed/content';
import { bootstrap } from './sim.js';
import { stepYear } from './year/step.js';
import { expectMean, expectRate } from './testing.js';

const bundle = loadContent();
/**
 * Eight, not the six this suite used to run. The ceiling claim below is made
 * fifteen times over, and `heir` — the sum of four different irregular
 * successions — carried it by 2.7 standard errors on six. Two more runs is
 * about eight seconds and buys every claim in the file a third more margin.
 */
// 7001, 7014, 7053 and 7079 replaced: under the corrected blood-membership
// count (issue #42) each of those four broke its own line well inside the
// 1193-1893 window this file samples. 910, 912, 913 and 5151 are confirmed
// to survive the full thousand years.
const SEEDS = [910, 912, 7027, 7040, 913, 7066, 5151, 7092];

/** Both are sampled years (the sample lands on 1042 + 1 + 25n), 700 apart. */
const EARLY = 1193;
const LATE = 1893;

/**
 * THE SHAPE OF A HEALTHY CAST, over whole runs.
 *
 * The fast tests build one household and ask whether the reading finds what
 * is in it. This asks the question that actually decides whether issue #44
 * shipped: across a thousand years of a real run, is there ALWAYS somebody to
 * care about, is it ever the same seventy people again, and does every role on
 * the list ever get filled — because a role that never fills is a row nobody
 * has seen, which is the failure this repository specialises in.
 *
 * It is also the instrument for #86, which is the opposite failure and the one
 * that shipped: every role filling EVERY year. Seven roles for seven slots
 * measured at `head` and `heir` in 100% of sampled generations, `married_in`
 * 95%, `aggrieved` 89%, and the same multiset of roles at 1193 as at 1893 in
 * every seed — a panel answering *who is this generation about* with the
 * constitutional offices of a household. Two claims below are that measurement
 * turned into a build failure.
 */
describe('who the generation is about, across whole runs', () => {
  const filled = new Map<CastRole, number>();
  let emptyYears = 0;
  let overCap = 0;
  let deadNamed = 0;
  let samples = 0;
  /** Every sampled cast size, kept so the claim below can see its own spread. */
  const sizes: number[] = [];
  /** Seeds whose roles at 1893 are not the same multiset as at 1193. */
  let centuriesDiffer = 0;
  let centuriesSeen = 0;
  /** The head's own sentence, which is supposed to know what year it is. */
  const headLines = new Set<string>();

  for (const seed of SEEDS) {
    const ctx = bootstrap(bundle, seed, 1042);
    const w = ctx.world;
    const era = new Map<number, string>();
    for (let i = 0; i < 1000; i++) {
      stepYear(ctx, true);
      // Sampled rather than every year: the answer changes on the scale of a
      // life, and a per-year read of a six-run batch is six thousand of them.
      if (i % 25) continue;
      const cast = castOf(ctx);
      samples += 1;
      sizes.push(cast.length);
      if (cast.length > CAST_MAX) overCap += 1;
      const living = new Set(w.people.household(w.playerHouse, w.year).map((p) => String(p.id)));
      if (!cast.length && living.size) emptyYears += 1;
      for (const c of cast) {
        filled.set(c.role, (filled.get(c.role) ?? 0) + 1);
        if (!living.has(c.person)) deadNamed += 1;
      }
      if (w.year === EARLY || w.year === LATE) {
        era.set(w.year, cast.map((c) => c.role).sort().join(','));
      }
      const head = cast.find((c) => c.role === 'head');
      if (head) headLines.add(head.because.replace(/\d+/g, '#'));
    }
    const early = era.get(EARLY);
    const late = era.get(LATE);
    if (early !== undefined && late !== undefined) {
      centuriesSeen += 1;
      if (early !== late) centuriesDiffer += 1;
    }
  }

  it('always has somebody, while the house has anybody at all', () => {
    expect(emptyYears, 'a living house with nobody to care about').toBe(0);
  });

  it('never grows back into a roster', () => {
    expect(overCap).toBe(0);
    /**
     * The bounds were `>= 3` and `<= CAST_MAX` on a bare mean, so both were
     * satisfiable by a batch sitting exactly on either — and neither could
     * see its own spread. The guards want strict comparisons, so the bounds
     * move by a hair rather than by a decision.
     */
    expectMean({ values: sizes, floor: 3 - 1e-9, what: 'the cast the player is shown' });
    expectMean({ values: sizes, ceiling: CAST_MAX + 1e-9, what: 'the cast the player is shown' });
  });

  it('never names anybody who is not living in the house', () => {
    expect(deadNamed).toBe(0);
  });

  /**
   * Every role, at least sometimes.
   *
   * Two are left out and covered by construction in `cast.test.ts` instead.
   * `papers` needs somebody in the household standing on a forged pedigree and
   * turns up in about one sampled generation in a hundred; `unwed` needs a
   * woman of the blood still unmarried at twenty-six and in about three. Both
   * are clustered — one person's life is several consecutive samples — so a
   * six-seed batch cannot carry a never-zero claim about either, and a test
   * that made one would go red on a commit that changed nothing it measured.
   */
  it('fills every role it declares, somewhere in the batch', () => {
    const byConstruction: CastRole[] = ['papers', 'unwed'];
    const never = CAST_ROLES
      .filter((r) => !byConstruction.includes(r))
      .filter((r) => !(filled.get(r) ?? 0));
    expect(never, `never filled: ${never.join(', ')}`).toEqual([]);
  });

  /**
   * MORE ROLES THAN SLOTS (#86). A role that is on the panel in four
   * generations in five is not telling the player anything about THIS
   * generation, and the first cut had four of them.
   *
   * `head` is the exception on purpose: somebody answers for the house, the
   * player is deciding for him, and a panel that sometimes forgot to say who
   * that was would be a worse panel.
   */
  it('has no role that turns up in most generations, except the seal', () => {
    for (const role of CAST_ROLES) {
      if (role === 'head') continue;
      expectRate({
        hits: filled.get(role) ?? 0,
        n: samples,
        ceiling: 0.6,
        what: `${role}, as a share of sampled generations`,
      });
    }
    expect(filled.get('head')).toBe(samples);
  });

  /**
   * THE ACCEPTANCE, and the thing the issue was actually about: a reader shown
   * two panels seven hundred years apart should be able to tell they are
   * different generations. The roles are what carries that — the names were
   * never the problem.
   */
  it('is about different things in 1893 than it was in 1193', () => {
    expectRate({
      hits: centuriesDiffer,
      n: centuriesSeen,
      floor: 0.5,
      what: 'runs whose cast is about different things seven hundred years later',
    });
  });

  /** Vary the sentence, not just the noun: the one role that is always there. */
  it('does not say the same thing about every head who ever sat', () => {
    expect(headLines.size, [...headLines].join(' | ')).toBeGreaterThan(2);
  });
});
