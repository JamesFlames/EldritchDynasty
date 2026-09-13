import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { AlleleIdS, LocusIdS, type AlleleDef, type GenePool, type LocusDef, type LocusKind } from '@ed/schema';
import { drawAllele, effectiveAlleleWeights, hashSeed, makeRng, type Rng } from '@ed/core';
import { expectMean } from './testing.js';

/**
 * THE ONE FUNCTION BOTH SIDES READ (issue #113).
 *
 * `drawAllele` samples an allele for one person's pool; `expectedAttribute`
 * (`attributes.slow.test.ts`) sums the same numbers across every pool in play
 * to find the population's centre. Before `effectiveAlleleWeights` existed,
 * only the first of those knew a font or a deleterious locus is drawn at a
 * pool-specific rate rather than at the authored `allele.p` — so the centre
 * the game measured couples against was computed from frequencies nobody was
 * actually drawn at. See `docs/FAILURES.md`, "a locus that is drawn by its
 * own rule".
 *
 * These are the pure-function claims: what the weights ARE, for each locus
 * kind, given a pool. The slow suite (`attributes.slow.test.ts`) is where a
 * real bootstrap's Monte Carlo mean is checked against them.
 */

function allele(
  over: Omit<Partial<AlleleDef>, 'id'> & { id: string; effect: number; p: number },
): AlleleDef {
  return { tags: [], ...over, id: AlleleIdS.parse(over.id) };
}

function locus(
  over: Omit<Partial<LocusDef>, 'id'> & { id: string; kind: LocusKind; alleles: AlleleDef[] },
): LocusDef {
  return {
    chromosome: 1, position: 0, dominance: 0, drive: 0.5, contributes: [],
    ...over, id: LocusIdS.parse(over.id),
  };
}

function pool(over: Partial<GenePool> = {}): GenePool {
  return { house: 'test', frequencies: {}, fontCarrierRate: 0, deleteriousLoad: 0.1, ...over };
}

const sum = (ws: number[]) => ws.reduce((a, b) => a + b, 0);

describe('effectiveAlleleWeights', () => {
  for (const kind of ['additive', 'major', 'eldritch_channel', 'fecundity_drag'] as LocusKind[]) {
    it(`${kind}: is the raw authored frequency, pool or no pool`, () => {
      const l = locus({ id: 'l', kind, alleles: [
        allele({ id: 'a', effect: 0, p: 0.7 }),
        allele({ id: 'b', effect: 5, p: 0.3 }),
      ] });
      expect(effectiveAlleleWeights(l.alleles, l, undefined)).toEqual([0.7, 0.3]);
      expect(effectiveAlleleWeights(l.alleles, l, pool())).toEqual([0.7, 0.3]);
    });
  }

  describe('eldritch_font', () => {
    const l = locus({ id: 'font_x', kind: 'eldritch_font', alleles: [
      allele({ id: 'null', effect: 0, p: 0.88, tags: ['null'] }),
      allele({ id: 'faint', effect: 2, p: 0.06 }),
      allele({ id: 'deep', effect: 6, p: 0.04 }),
      allele({ id: 'burning', effect: 11, p: 0.02 }),
    ] });

    it('no pool: the authored world baseline', () => {
      expect(effectiveAlleleWeights(l.alleles, l, undefined)).toEqual([0.88, 0.06, 0.04, 0.02]);
    });

    it('the family itself (rate 1): draws its own frequencies, not the outsider cap', () => {
      const weights = effectiveAlleleWeights(l.alleles, l, pool({ fontCarrierRate: 1 }));
      expect(weights).toEqual([0.88, 0.06, 0.04, 0.02]);
    });

    it('an outsider pool: null except at the carrier rate, and only the weak allele when it carries', () => {
      const weights = effectiveAlleleWeights(l.alleles, l, pool({ fontCarrierRate: 0.05 }));
      expect(weights[0], 'null').toBeCloseTo(0.95, 9);
      expect(weights[1], 'the one weak allele (effect <= 3)').toBeCloseTo(0.05, 9);
      expect(weights[2], 'deep never reaches an outsider').toBe(0);
      expect(weights[3], 'burning never reaches an outsider').toBe(0);
      expect(sum(weights)).toBeCloseTo(1, 9);
    });

    it('an explicit frequency override on the pool is respected instead', () => {
      const overridden = pool({
        fontCarrierRate: 0.05,
        frequencies: { font_x: [{ allele: 'null', p: 0.5 }, { allele: 'deep', p: 0.5 }] },
      });
      expect(effectiveAlleleWeights(l.alleles, l, overridden)).toEqual([0.5, 0.06, 0.5, 0.02]);
    });

    it('no weak allele on the locus: falls back to the authored baseline, same as no pool', () => {
      const noWeak = locus({ id: 'font_y', kind: 'eldritch_font', alleles: [
        allele({ id: 'null', effect: 0, p: 0.9, tags: ['null'] }),
        allele({ id: 'deep', effect: 6, p: 0.1 }),
      ] });
      expect(effectiveAlleleWeights(noWeak.alleles, noWeak, pool({ fontCarrierRate: 0.05 })))
        .toEqual([0.9, 0.1]);
    });
  });

  describe('deleterious', () => {
    const l = locus({ id: 'del_x', kind: 'deleterious', dominance: 1, alleles: [
      allele({ id: 'clean', effect: 0, p: 0.93 }),
      allele({ id: 'bad', effect: -7, p: 0.07, tags: ['deleterious'] }),
    ] });

    it('no pool: the authored world baseline', () => {
      expect(effectiveAlleleWeights(l.alleles, l, undefined)).toEqual([0.93, 0.07]);
    });

    it('the load is forced ON TOP OF the authored draw, not instead of it', () => {
      const weights = effectiveAlleleWeights(l.alleles, l, pool({ deleteriousLoad: 0.22 }));
      // q_effective = load + (1 - load) * p_bad — the arithmetic issue #113 names.
      expect(weights[1], 'bad').toBeCloseTo(0.22 + 0.78 * 0.07, 9);
      expect(weights[0], 'clean').toBeCloseTo(0.78 * 0.93, 9);
      expect(sum(weights)).toBeCloseTo(1, 9);
    });

    it('a heavier pool draws the curse more often than a lighter one', () => {
      const light = effectiveAlleleWeights(l.alleles, l, pool({ deleteriousLoad: 0.04 }));
      const heavy = effectiveAlleleWeights(l.alleles, l, pool({ deleteriousLoad: 0.31 }));
      expect(heavy[1]!).toBeGreaterThan(light[1]!);
    });

    it('a locus with no deleterious-tagged allele is untouched by the load', () => {
      const untagged = locus({ id: 'del_y', kind: 'deleterious', alleles: [
        allele({ id: 'a', effect: 0, p: 0.6 }),
        allele({ id: 'b', effect: -3, p: 0.4 }),
      ] });
      expect(effectiveAlleleWeights(untagged.alleles, untagged, pool({ deleteriousLoad: 0.5 })))
        .toEqual([0.6, 0.4]);
    });
  });

  it('rejects a locus kind it does not recognise, rather than silently drawing it at the wrong frequency', () => {
    const bogus = locus({ id: 'l', kind: 'not_a_real_kind' as LocusKind, alleles: [
      allele({ id: 'a', effect: 0, p: 1 }),
    ] });
    expect(() => effectiveAlleleWeights(bogus.alleles, bogus, pool())).toThrow(/unhandled locus kind/);
  });
});

describe('drawAllele draws from the same weights effectiveAlleleWeights reports', () => {
  it('an outsider pool draws the font locus at its own weights, not the authored ones', () => {
    const l = locus({ id: 'font_x', kind: 'eldritch_font', alleles: [
      allele({ id: 'null', effect: 0, p: 0.88, tags: ['null'] }),
      allele({ id: 'faint', effect: 2, p: 0.06 }),
      allele({ id: 'deep', effect: 6, p: 0.04 }),
      allele({ id: 'burning', effect: 11, p: 0.02 }),
    ] });
    const p = pool({ fontCarrierRate: 0.2 });
    const rng = makeRng(hashSeed('allele-draw-test', 'font-outsider'));

    const draws = Array.from({ length: 4000 }, () => drawAllele(l.alleles, l, p, rng));
    const isNull = draws.map((i) => (i === 0 ? 1 : 0));
    const isDeepOrBurning = draws.map((i) => (i === 2 || i === 3 ? 1 : 0));

    expectMean({ values: isDeepOrBurning, ceiling: 0.01, what: 'an outsider drawing deep or burning font at all' });
    // Effective weight of null at this rate is exactly 0.8.
    expectMean({ values: isNull, floor: 0.7, what: 'null draws, against an effective weight of 0.8' });
    expectMean({ values: isNull, ceiling: 0.9, what: 'null draws, against an effective weight of 0.8' });
  });

  it('a pool with no deleterious tag on the locus draws the authored frequency', () => {
    const l = locus({ id: 'plain', kind: 'additive', alleles: [
      allele({ id: 'a', effect: 0, p: 0.5 }),
      allele({ id: 'b', effect: 1, p: 0.5 }),
    ] });
    const rng = makeRng(hashSeed('allele-draw-test', 'plain-additive'));
    const draws = Array.from({ length: 2000 }, () => drawAllele(l.alleles, l, pool(), rng)).map((i) => i);
    expectMean({ values: draws, floor: 0.4, what: 'draws of allele b (index 1)' });
    expectMean({ values: draws, ceiling: 0.6, what: 'draws of allele b (index 1)' });
  });
});

/**
 * THE REFACTOR MOVED THE CURSOR, NOT THE GENETICS (issue #113).
 *
 * `drawAllele` used to sample a font locus with `rng.bool(carrierRate)` and
 * then, on a carrier, `rng.pick(weak)`; a deleterious locus with
 * `rng.bool(deleteriousLoad)` and then, on a miss, the generic weighted roll.
 * It is now ONE weighted roll over `effectiveAlleleWeights`. That is a
 * deliberate behaviour change in exactly one respect — how many numbers a
 * draw takes out of the stream — and it must be a change in NO other: the
 * probability of drawing any given allele, from any given pool, has to be
 * what it always was.
 *
 * This is the assertion that separates those two. The old procedure is
 * reproduced verbatim below and run against the shipped loci and the shipped
 * pools; its empirical frequencies are compared against the weights the new
 * one samples from. If these ever disagree, the genetics moved and no amount
 * of "it is only the draw order" is true.
 *
 * Three slow suites re-rolled when this landed — `attention.slow`,
 * `demography.slow` and `world-health.slow`, all three pinned to specific
 * seeds — and this test is why it was possible to say the cause was the
 * cursor rather than the distribution. See `docs/BALANCE-LOG.md`.
 */
describe('the new weights are the old procedure\'s own marginals', () => {
  const bundle = loadContent();
  const pools = bundle.houses.map((h) => ({ id: h.id, pool: h.genePool }));

  /** `drawAllele` exactly as it was before `effectiveAlleleWeights` existed. */
  function legacyDraw(alleles: AlleleDef[], locus: LocusDef, pool: GenePool | undefined, rng: Rng): number {
    const override = pool?.frequencies?.[locus.id];
    const weights = alleles.map((a) => {
      const o = override?.find((x) => x.allele === a.id);
      return o ? o.p : a.p;
    });

    if (locus.kind === 'eldritch_font' && pool && !override && pool.fontCarrierRate < 1) {
      const carries = rng.bool(pool.fontCarrierRate);
      if (!carries) {
        const nullIdx = alleles.findIndex((a) => a.tags.includes('null'));
        return nullIdx >= 0 ? nullIdx : 0;
      }
      const weak = alleles
        .map((a, i) => ({ a, i }))
        .filter(({ a }) => !a.tags.includes('null') && a.effect > 0 && a.effect <= 3);
      if (weak.length) return rng.pick(weak).i;
    }

    if (locus.kind === 'deleterious' && pool) {
      const badIdx = alleles.findIndex((a) => a.tags.includes('deleterious'));
      if (badIdx >= 0 && rng.bool(pool.deleteriousLoad)) return badIdx;
    }

    let total = 0;
    for (const w of weights) total += w;
    let roll = rng.next() * (total || 1);
    for (let i = 0; i < alleles.length; i++) {
      roll -= weights[i]!;
      if (roll <= 0) return i;
    }
    return 0;
  }

  /** The two kinds that have a draw rule of their own, plus a control of ones that do not. */
  const overridden = bundle.loci.filter((l) => l.kind === 'eldritch_font' || l.kind === 'deleterious');
  const plain = bundle.loci.filter((l) => l.kind !== 'eldritch_font' && l.kind !== 'deleterious').slice(0, 3);

  const DRAWS = 8_000;
  /** Roughly four standard errors at this batch size — tight enough to catch a load applied wrongly. */
  const TOLERANCE = 0.025;

  it('the shipped content actually has both overridden kinds in it', () => {
    // The control: every claim below is vacuously true of an empty list.
    expect(overridden.some((l) => l.kind === 'eldritch_font')).toBe(true);
    expect(overridden.some((l) => l.kind === 'deleterious')).toBe(true);
    expect(pools.length).toBeGreaterThanOrEqual(8);
  });

  for (const kind of ['eldritch_font', 'deleterious'] as const) {
    it(`${kind}: every shipped pool draws it at the frequency the new weights report`, () => {
      for (const locus of overridden.filter((l) => l.kind === kind)) {
        for (const { id, pool } of pools) {
          const alleles = locus.alleles;
          const weights = effectiveAlleleWeights(alleles, locus, pool);
          const mass = weights.reduce((s, w) => s + w, 0) || 1;

          const rng = makeRng(hashSeed('legacy-vs-new', String(locus.id), id));
          const seen = alleles.map(() => 0);
          for (let i = 0; i < DRAWS; i++) seen[legacyDraw(alleles, locus, pool, rng)]! += 1;

          for (let i = 0; i < alleles.length; i++) {
            const was = seen[i]! / DRAWS;
            const now = weights[i]! / mass;
            expect(
              Math.abs(was - now),
              `${locus.id} in ${id}, allele ${alleles[i]!.id}: the old procedure drew it `
              + `${(was * 100).toFixed(1)}% of the time, the new weights say ${(now * 100).toFixed(1)}%`,
            ).toBeLessThan(TOLERANCE);
          }
        }
      }
    });
  }

  /**
   * A kind with no draw rule of its own gets the authored frequency — EXCEPT
   * where the pool declares one for that locus itself, which is the oldest
   * and most ordinary way a house differs and applies to every kind alike
   * ("a house is, mechanically, an allele frequency distribution",
   * `houses.yaml`). `house_hesk` does exactly this to `strength_2`, and the
   * first cut of this test asserted the raw `a.p` and went red on it.
   */
  it('a locus with no draw rule of its own is its authored frequency, or the pool\'s own override of it', () => {
    let overridesSeen = 0;
    for (const locus of plain) {
      for (const { id, pool } of pools) {
        const declared = pool.frequencies?.[String(locus.id)];
        if (declared) overridesSeen += 1;
        const want = locus.alleles.map((a) => {
          const o = declared?.find((x) => x.allele === String(a.id));
          return o ? o.p : a.p;
        });
        expect(effectiveAlleleWeights(locus.alleles, locus, pool), `${locus.id} in ${id}`)
          .toEqual(want);
      }
    }
    // The control's own control: if no pool in the shipped content overrode
    // anything here, this test would pass while saying nothing about
    // overrides at all.
    expect(overridesSeen, 'no shipped pool overrides any of these loci').toBeGreaterThan(0);
  });
});
