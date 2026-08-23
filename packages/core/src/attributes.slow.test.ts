import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import {
  bootstrap, runYears, attr, buildLocusTable, expectedAttribute, expressAttributes, genomeOf,
  BASELINE_MAX_AGE, deriveMaxAge, bodyYears,
  coupleFertility, deriveVitality, fertilityByAge, FERTILITY_REFERENCE, SOUND_BODY,
  makeRng, mint,
  type VitalityInput,
} from '@ed/core';

const bundle = loadContent();
const SEEDS = [1042, 77, 909, 5150, 8080, 31];

/** Everyone who lived long enough to be measured, with the year to measure at. */
function adults(ctx: ReturnType<typeof bootstrap>) {
  const w = ctx.world;
  return w.people.all()
    .map((p) => ({ p, at: p.died ?? w.year }))
    .filter(({ p, at }) => at - p.born >= 17);
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

/**
 * A TEMPLATE'S `bias` HAS TO REACH THE PERSON IT MINTED.
 *
 * It did not, for as long as the field existed: `applyBias` lived in `sim.ts`
 * and ran over the founding cast alone, so every `bias` block on a character
 * template was authored, validated, saved and read by nothing. Four recipes
 * described a person the world then rolled at random.
 *
 * The Match is what makes it load-bearing rather than merely wrong — a card
 * that promises a scholar's daughter has to deal one.
 */
describe('a minted person is the person their recipe describes', () => {
  it('gives a scholar\'s daughter the mind the recipe says she has', () => {
    const template = bundle.characterTemplates.find((t) => t.id === 'suitor_of_ilm')!;
    const plain = bundle.characterTemplates.find((t) => t.id === 'suitor_common_stock')!;
    expect(Object.keys(template.bias).length, 'the recipe carries no bias to test').toBeGreaterThan(0);

    const roll = (t: typeof template, key: string): number[] => {
      const out: number[] = [];
      for (let i = 0; i < 40; i++) {
        const ctx = bootstrap(bundle, 5000 + i, 1042);
        const p = mint(t, ctx, makeRng(9000 + i), {});
        out.push(attr(p, key, ctx.genetics, 1042));
      }
      return out;
    };

    for (const key of Object.keys(template.bias)) {
      expect(mean(roll(template, key)), `${key} is no higher than an unbiased recipe's`)
        .toBeGreaterThan(mean(roll(plain, key)) + 2);
    }
  });
});

describe('sexual dimorphism', () => {
  /**
   * Men are almost always the stronger. "Almost" is the whole specification:
   * a shift that SORTED the population — every man above every woman — would
   * be a different claim about the world and a worse one, and it is what a
   * multiplier or a clamp would have produced.
   */
  it('makes a man stronger than a woman about nineteen times in twenty', () => {
    const men: number[] = [];
    const women: number[] = [];
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 300);
      for (const { p, at } of adults(ctx)) {
        (p.sex === 'male' ? men : women).push(attr(p, 'strength', ctx.genetics, at));
      }
    }
    expect(men.length).toBeGreaterThan(100);
    expect(women.length).toBeGreaterThan(100);

    let stronger = 0;
    let pairs = 0;
    for (let i = 0; i < men.length; i++) {
      for (let k = 0; k < 25; k++) {
        const w = women[(i * 7 + k * 13) % women.length]!;
        pairs += 1;
        if (men[i]! > w) stronger += 1;
      }
    }
    const rate = stronger / pairs;
    expect(rate, 'men are not almost always stronger').toBeGreaterThan(0.88);
    expect(rate, 'the distributions no longer overlap — this sorts, it does not shift').toBeLessThan(0.995);
  });

  /**
   * Applied as ±half. A shift that moved the whole female distribution down
   * would raise female mortality (`hazard *= 1 - strength/220`), shrink the
   * household, and surface three systems away as a fertility bug.
   */
  /**
   * Applied as ±half. A shift that moved the whole female distribution down
   * would raise female mortality (`hazard *= 1 - strength/220`), shrink the
   * household, and surface three systems away as a fertility bug.
   *
   * Measured against the SAME genomes expressed with the dimorphism removed,
   * rather than against a population statistic — a tolerance on the population
   * mean also absorbs the founder's `bias` and survivor selection, so it moves
   * for reasons that have nothing to do with the thing under test.
   */
  it('does not move the population mean', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    runYears(ctx, 300);
    const table = buildLocusTable(bundle.loci);
    const flat = bundle.attributes.map((a) => ({ ...a, dimorphism: 0 }));

    const withIt: number[] = [];
    const without: number[] = [];
    for (const { p, at } of adults(ctx)) {
      withIt.push(attr(p, 'strength', ctx.genetics, at));
      const raw = expressAttributes(genomeOf(p, ctx.genetics), p.sex, table, flat, {
        awakened: p.awakening.awakened,
      });
      without.push(raw.get('strength') ?? 0);
    }
    expect(withIt.length).toBeGreaterThan(100);
    expect(Math.abs(mean(withIt) - mean(without)), 'dimorphism moved the mean').toBeLessThan(1.5);
  });

  it('leaves the attributes nobody declared it on alone', () => {
    const ctx = bootstrap(bundle, 77, 1042);
    runYears(ctx, 300);
    const all = adults(ctx);
    for (const key of ['charm', 'fecundity']) {
      const men = all.filter(({ p }) => p.sex === 'male').map(({ p, at }) => attr(p, key, ctx.genetics, at));
      const women = all.filter(({ p }) => p.sex === 'female').map(({ p, at }) => attr(p, key, ctx.genetics, at));
      expect(Math.abs(mean(men) - mean(women)), key).toBeLessThan(4);
    }
  });
});

describe('fertility is inherited', () => {
  /**
   * The failure this replaces: completed family size was a hash of the
   * parents' ids, so every couple in every branch was drawn from one flat
   * distribution and no marriage decision could ever be about how many.
   */
  it('gives fecund couples more children than thin ones', () => {
    const highs: number[] = [];
    const lows: number[] = [];
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 500);
      const w = ctx.world;
      const mothers = w.people.all().filter(
        (p) => p.sex === 'female' && (p.died ?? w.year) - p.born > 45 && p.marriages.length > 0,
      );
      const scored = mothers.map((m) => ({
        fec: attr(m, 'fecundity', ctx.genetics, m.died ?? w.year),
        born: w.people.children(m.id).length,
      }));
      const sorted = [...scored].sort((a, b) => a.fec - b.fec);
      const cut = Math.floor(sorted.length / 3);
      lows.push(...sorted.slice(0, cut).map((x) => x.born));
      highs.push(...sorted.slice(-cut).map((x) => x.born));
    }
    expect(lows.length).toBeGreaterThan(50);
    expect(mean(highs), 'the top third of mothers bore no more than the bottom third')
      .toBeGreaterThan(mean(lows) + 0.4);
  });

  /**
   * Seventy-thirty. A thin husband is a disappointment; a thin wife is the
   * marriage.
   *
   * POOLED ACROSS `SEEDS`, like its neighbour above, and it did not used to be.
   * It ran one seed and compared two sample correlations, which is the trap
   * `CLAUDE.md` names twice ("never pin a test to one seed reaching one state.
   * Two did, and both broke the day the RNG streams were split, on behaviour
   * that was demonstrably intact").
   *
   * It came due on a merge: two changesets that each passed on their own — a
   * content drop adding four gene pools, and a pass that changed who the Match
   * puts in front of whom — together tipped seed 1042 and nothing else.
   * Measured across ten seeds at the moment it failed, the mother was the
   * stronger predictor in NINE, pooled r = 0.220 against the father's 0.086, a
   * factor of two and a half. `MOTHER_SHARE` had not been touched by either
   * side. The mechanism was intact; the test was reporting its sample.
   */
  it('weights the mother above the father', () => {
    const mothers: number[] = [];
    const fathers: number[] = [];

    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 500);
      const w = ctx.world;

      const couples = w.people.all()
        .filter((p) => p.sex === 'female' && (p.died ?? w.year) - p.born > 45)
        .flatMap((m) => {
          const spouse = m.marriages[0] ? w.people.get(m.marriages[0].spouse) : undefined;
          if (!spouse) return [];
          const at = m.died ?? w.year;
          return [{
            mother: attr(m, 'fecundity', ctx.genetics, at),
            father: attr(spouse, 'fecundity', ctx.genetics, at),
            born: w.people.children(m.id).length,
          }];
        });
      expect(couples.length).toBeGreaterThan(40);

      const corr = (pick: (c: (typeof couples)[number]) => number) => {
        const xs = couples.map(pick);
        const ys = couples.map((c) => c.born);
        const mx = mean(xs), my = mean(ys);
        const cov = mean(couples.map((_, i) => (xs[i]! - mx) * (ys[i]! - my)));
        return cov / ((sd(xs) * sd(ys)) || 1);
      };
      mothers.push(corr((c) => c.mother));
      fathers.push(corr((c) => c.father));
    }

    // The weighting, not one afternoon's draw of it.
    expect(mean(mothers), 'the mother should be the stronger predictor')
      .toBeGreaterThan(mean(fathers));
    // And it should be a difference worth having a rule about, not a nose.
    expect(mean(mothers)).toBeGreaterThan(mean(fathers) * 1.5);
  });

  /**
   * The mapping centres on the attribute's population mean, computed from the
   * locus table. A hardcoded centre silently stops being true the next time
   * anyone changes `LOCI_PER_CORE`, and every family in the game gains or
   * loses a child without a line of the diff saying so.
   */
  it('centres on a mean derived from the loci, not a constant', () => {
    const table = buildLocusTable(bundle.loci);
    const ctx = bootstrap(bundle, 1042, 1042);
    expect(ctx.genetics.expected.get('fecundity')).toBeCloseTo(expectedAttribute(table, 'fecundity'), 6);

    /**
     * Measured against the FOUNDING cast, which is the only population the
     * centre is meant to describe.
     *
     * Selection is immediate and strong here, not a slow drift: a fecund
     * couple both conceives faster and completes a larger family, so the very
     * first child cohort is already over-weighted toward fecund parents and
     * sits ~6 points above its own parents. Sampling anything later measures
     * that instead, and would fail for entirely the right reason.
     */
    const cast: number[] = [];
    for (const seed of SEEDS) {
      const c = bootstrap(bundle, seed, 1042);
      for (const p of c.world.people.all()) cast.push(attr(p, 'fecundity', c.genetics, 1042));
    }
    expect(cast.length).toBeGreaterThan(50);
    expect(Math.abs(mean(cast) - expectedAttribute(table, 'fecundity'))).toBeLessThan(5);
  });

  /**
   * THE CENTRE AND THE CLAMP MUST DESCRIBE THE SAME POPULATION.
   *
   * `expectedAttribute` is derived from allele frequencies and is unclamped;
   * the number a real body carries is clamped to the authored range. While the
   * distribution sits inside its range those two agree, and every system that
   * reads "how far above average is this person" works. Push the distribution
   * onto a bound — a strong one-sided group of loci is all it takes — and they
   * come apart silently: the centre keeps falling, the bodies stop, and every
   * family in the game starts reading as above average.
   *
   * That is not hypothetical. `npm run gate:drag` (issue #26) reaches coupling
   * 4 with the computed fecundity centre at -18 while 59% of mothers sit on
   * the attribute's floor of zero, and the effect of that is BIRTHS PER RUN
   * RISING from 748 to 1,009 — a locus group named "drag" handing out children.
   * See docs/FAILURES.md. This is the assertion that says so at the founding,
   * before a thousand years of it.
   */
  it('does not pin the founding cast against the ends of its own range', () => {
    // Core only. An affinity SHOULD pile up on zero — most people have no
    // gift for the tide at all, and that is the attribute working. A Core
    // attribute is read as a deviation from its mean by everything that
    // touches it, and has no such excuse.
    for (const def of bundle.attributes) {
      if (def.kind !== 'core') continue;
      const values: number[] = [];
      for (const seed of SEEDS) {
        const c = bootstrap(bundle, seed, 1042);
        for (const p of c.world.people.all()) values.push(attr(p, String(def.id), c.genetics, 1042));
      }
      const pinned = values.filter((v) => v <= def.range.min || v >= def.range.max).length;
      expect(pinned / values.length, `${def.id}: ${pinned}/${values.length} on a bound`)
        .toBeLessThan(0.05);
    }
  });

  /** Heritable, but not so heritable that the house runs away or dies out. */
  it('keeps completed families inside a livable band', () => {
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 400);
      const w = ctx.world;
      const borne = w.people.all()
        .filter((p) => p.sex === 'female' && (p.died ?? w.year) - p.born > 45)
        .map((p) => w.people.children(p.id).length);
      expect(Math.max(...borne), `seed ${seed}`).toBeLessThanOrEqual(9);
      expect(mean(borne), `seed ${seed}`).toBeGreaterThan(0.5);
    }
  });

  it('is deterministic — the same seed completes the same families', () => {
    const a = bootstrap(bundle, 4242, 1042);
    const b = bootstrap(bundle, 4242, 1042);
    runYears(a, 250);
    runYears(b, 250);
    const families = (ctx: typeof a) => ctx.world.people.all()
      .map((p) => `${p.name}:${ctx.world.people.children(p.id).length}`);
    expect(families(a)).toEqual(families(b));
  });
});

/**
 * FERTILITY — fecundity read through the body carrying it.
 *
 * Fecundity is a potential and a potential is not a rate. These assert the two
 * things that turn one into the other: an age curve with a woman's cliff and a
 * man's slope, and a health term that neither sex pays more of than the other.
 */
describe('fertility is fecundity, modified by age, sex and health', () => {
  /** The ranges the CONTENT declares. If the yaml loses them, this test says so. */
  const ranges = () => {
    const def = (id: string) => {
      const d = bundle.attributes.find((a) => a.id === id);
      expect(d, `${id} is not declared in attributes.yaml`).toBeDefined();
      expect(d!.kind, `${id} must be derived — it has no loci`).toBe('derived');
      return d!.range;
    };
    return { health: def('health'), fertility: def('fertility') };
  };

  const body = (over: Partial<VitalityInput> = {}): VitalityInput => ({
    sex: 'female',
    age: 22,
    maxAge: BASELINE_MAX_AGE,
    strength: 30,
    strengthMean: 30,
    fecundity: 26,
    fecundityMean: 26,
    madness: 0,
    mind: 20,
    curses: 0,
    acquiredHealth: 0,
    acquiredFertility: 0,
    ...over,
  });

  const vitality = (over: Partial<VitalityInput> = {}) => deriveVitality(body(over), ranges());

  it('gives a woman a cliff and a man a slope', () => {
    // Hers: flat through the twenties, bending at thirty, gone by fifty.
    expect(fertilityByAge('female', 22)).toBeCloseTo(1, 2);
    expect(fertilityByAge('female', 28)).toBeGreaterThan(0.85);
    expect(fertilityByAge('female', 35)).toBeLessThan(0.75);
    expect(fertilityByAge('female', 42)).toBeLessThan(0.25);
    expect(fertilityByAge('female', 50)).toBe(0);
    expect(fertilityByAge('female', 61)).toBe(0);

    // His: shallower, later, and never quite closed.
    expect(fertilityByAge('male', 30)).toBeGreaterThan(0.95);
    expect(fertilityByAge('male', 50)).toBeGreaterThan(0.6);
    expect(fertilityByAge('male', 65)).toBeGreaterThan(0.3);

    // At fifty he is many times the man she is a woman. That asymmetry is the
    // whole reason an old husband is survivable and an old wife is not.
    expect(fertilityByAge('male', 50)).toBeGreaterThan(fertilityByAge('female', 50) + 0.6);

    // Nobody is fertile before they are grown, whichever they are.
    expect(fertilityByAge('female', 8)).toBe(0);
    expect(fertilityByAge('male', 8)).toBe(0);
  });

  /**
   * The reference body reads exactly 100, which is what makes `coupleFertility`
   * a ratio rather than a number needing a scale factor.
   */
  it('puts a sound body of mean stock at its peak on the reference mark', () => {
    const v = vitality({ age: 22 });
    expect(v.health).toBeCloseTo(SOUND_BODY, 5);
    expect(v.fertility).toBeCloseTo(FERTILITY_REFERENCE, 5);
  });

  it('costs a sick body children a healthy one keeps', () => {
    const sound = vitality();
    const cursed = vitality({ curses: 2 });
    const starved = vitality({ acquiredHealth: -30 });

    expect(cursed.health).toBeLessThan(sound.health);
    expect(cursed.fertility).toBeLessThan(sound.fertility);
    expect(starved.fertility).toBeLessThan(cursed.fertility);

    // Proportional to condition, and nothing left at the bottom of it.
    expect(starved.fertility / sound.fertility).toBeCloseTo(starved.health / sound.health, 5);
    expect(vitality({ acquiredHealth: -SOUND_BODY }).fertility).toBe(0);
  });

  /**
   * THE DIMORPHISM TRAP. Strength is 26 points male-minus-female. If health
   * measured a woman against the whole population's mean instead of her own
   * sex's, every woman alive would be six health short and the species would
   * quietly lose seven percent of its births to a units error — invariant 10's
   * "surfaces three systems away as a fertility bug", arriving on schedule.
   */
  it('does not make women less healthy than men by construction', () => {
    const man = deriveVitality(body({ sex: 'male', strength: 43, strengthMean: 43 }), ranges());
    const woman = deriveVitality(body({ sex: 'female', strength: 17, strengthMean: 17 }), ranges());
    expect(woman.health).toBeCloseTo(man.health, 5);

    // And within a sex it still reads strength: robust is healthier than frail.
    expect(vitality({ strength: 45, strengthMean: 30 }).health)
      .toBeGreaterThan(vitality({ strength: 15, strengthMean: 30 }).health);
  });

  it('measures the same population mean of health for men and women', () => {
    const men: number[] = [];
    const women: number[] = [];
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 300);
      for (const { p, at } of adults(ctx)) {
        if (at - p.born > 45) continue;             // senescence, not sex
        (p.sex === 'male' ? men : women).push(attr(p, 'health', ctx.genetics, at));
      }
    }
    expect(men.length).toBeGreaterThan(50);
    expect(Math.abs(mean(men) - mean(women)), 'one sex is systematically sicker').toBeLessThan(8);
  });

  /**
   * A COUPLE IS A PRODUCT, NOT AN AVERAGE. This is the difference between a
   * model of a marriage and a model of two people filed next to each other:
   * an arithmetic mean would hand a woman of fifty-two thirty percent of her
   * husband's fertility and give her children.
   */
  it('ends a marriage when either half of it is finished', () => {
    expect(coupleFertility(0, 140)).toBe(0);
    expect(coupleFertility(140, 0)).toBe(0);
    expect(coupleFertility(100, 100)).toBeCloseTo(1, 5);

    // Costs compound: two at eighty percent are worse than either alone reads.
    expect(coupleFertility(80, 80)).toBeCloseTo(0.8, 5);
    expect(coupleFertility(80, 80)).toBeLessThan(0.85);

    // Seventy-thirty. Her half of a shortfall costs more than his.
    expect(coupleFertility(60, 100)).toBeLessThan(coupleFertility(100, 60));
  });

  /**
   * The whole point of a derived attribute is that it reaches the phenotype.
   * A formula nothing reads is invariant 11's bug, not a stub.
   */
  it('reaches the phenotype, and changes as the body does', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    runYears(ctx, 60);
    const w = ctx.world;

    const women = w.people.living().filter((p) => p.sex === 'female');
    const young = women.find((p) => w.year - p.born >= 20 && w.year - p.born <= 28);
    const child = w.people.living().find((p) => w.year - p.born < 8);
    expect(young, 'no woman of childbearing age in sixty years').toBeDefined();
    expect(child, 'no children in sixty years').toBeDefined();

    expect(attr(young!, 'fertility', ctx.genetics, w.year)).toBeGreaterThan(0);
    expect(attr(young!, 'health', ctx.genetics, w.year)).toBeGreaterThan(0);
    expect(attr(child!, 'fertility', ctx.genetics, w.year)).toBe(0);

    // The same woman, thirty years on. Derived means derived: the cache is
    // recomputed against the year, so the number moves when the body does.
    const now = attr(young!, 'fertility', ctx.genetics, w.year);
    const later = attr(young!, 'fertility', ctx.genetics, w.year + 30);
    expect(later, 'fertility did not move with age — the cache is being reused')
      .toBeLessThan(now / 2);
  });

  /**
   * And the shape of it in a real run. The old flat window put thirteen percent
   * of all births in the four years before it slammed shut; a curve should put
   * the mass in the twenties and thin out from there.
   */
  it('puts childbearing where a real population puts it', () => {
    const byBand = new Map<string, number>();
    let total = 0;
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 400);
      const store = ctx.world.people;
      for (const p of store.all()) {
        const mum = p.trueParents.mother ? store.get(p.trueParents.mother) : undefined;
        if (!mum) continue;
        const band = `${Math.floor((p.born - mum.born) / 5) * 5}`;
        byBand.set(band, (byBand.get(band) ?? 0) + 1);
        total += 1;
      }
    }
    expect(total).toBeGreaterThan(400);
    const share = (band: string) => (byBand.get(band) ?? 0) / total;

    expect(share('20') + share('25'), 'the twenties are not the peak').toBeGreaterThan(0.4);
    expect(share('40'), 'too many children born to mothers past forty').toBeLessThan(0.1);
    expect(share('40'), 'the curve does not reach past forty at all').toBeGreaterThan(0.005);
    expect(share('20')).toBeGreaterThan(share('35'));
  });
});
