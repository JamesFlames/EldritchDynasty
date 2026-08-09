import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { bootstrap, runYears, attr, buildLocusTable, expectedAttribute } from '@ed/core';

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
  it('does not move the population mean', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    runYears(ctx, 300);
    const all = adults(ctx);
    const men = all.filter(({ p }) => p.sex === 'male').map(({ p, at }) => attr(p, 'strength', ctx.genetics, at));
    const women = all.filter(({ p }) => p.sex === 'female').map(({ p, at }) => attr(p, 'strength', ctx.genetics, at));
    expect(Math.abs(mean([...men, ...women]) - expectedAttribute(buildLocusTable(bundle.loci), 'strength')))
      .toBeLessThan(8);
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

  /** Seventy-thirty. A thin husband is a disappointment; a thin wife is the marriage. */
  it('weights the mother above the father', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
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
    expect(corr((c) => c.mother), 'the mother should be the stronger predictor')
      .toBeGreaterThan(corr((c) => c.father));
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
    runYears(ctx, 200);
    const measured = mean(adults(ctx).map(({ p, at }) => attr(p, 'fecundity', ctx.genetics, at)));
    expect(Math.abs(measured - expectedAttribute(table, 'fecundity'))).toBeLessThan(5);
    expect(ctx.genetics.expected.get('fecundity')).toBeCloseTo(expectedAttribute(table, 'fecundity'), 6);
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
