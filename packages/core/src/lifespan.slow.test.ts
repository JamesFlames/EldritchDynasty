import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import {
  bootstrap, runYears, attr, BASELINE_MAX_AGE, bodyYears, deriveMaxAge, fertilityByAge,
  expectMean, expectRate,
} from '@ed/core';

const bundle = loadContent();
const SEEDS = [1042, 77, 909, 5150];

/**
 * MAX AGE IS A CEILING, NOT A CENTRE.
 *
 * It was neither for a while. The curves were merely SCALED by it and nothing
 * enforced it, so a body built for a hundred and thirty-seven died at a
 * hundred and forty-three, and the number was quietly an average wearing the
 * word maximum. Nothing threw; the only evidence was one line of harness
 * output that read as fine.
 */
describe('max age', () => {
  it('centres a typical body on a hundred', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    runYears(ctx, 300);
    const w = ctx.world;
    const all = w.people.all().map((p) => attr(p, 'max_age', ctx.genetics, w.year));
    /**
     * The sample is the PEOPLE in one played run, not a batch of runs, and
     * the guards are told so. Bodies within a house are not independent
     * draws — they inherit from each other — so the standard error here is
     * optimistic, and the margin it reports is an upper bound on the
     * confidence rather than the confidence. It is still the difference
     * between a claim that has been checked against its own spread and one
     * that has not: at 300 years this batch runs to hundreds of people and
     * both margins clear comfortably.
     */
    expectMean({ values: all, floor: 92, what: 'a typical body is centred near a hundred' });
    expectMean({ values: all, ceiling: 108, what: 'and not above it' });
  });

  it('varies — a ceiling everybody shares is not a ceiling worth having', () => {
    const ctx = bootstrap(bundle, 909, 1042);
    runYears(ctx, 300);
    const w = ctx.world;
    const all = w.people.all().map((p) => attr(p, 'max_age', ctx.genetics, w.year));
    expect(Math.max(...all) - Math.min(...all)).toBeGreaterThan(25);
  });

  /** The assertion the whole rename was about. */
  it('is never outlived', () => {
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 600);
      const w = ctx.world;
      for (const p of w.people.all()) {
        if (p.died === undefined) continue;
        const ceiling = attr(p, 'max_age', ctx.genetics, w.year);
        // Age is integral and the ceiling is not, so a man whose ceiling is
        // 87.8 dies in the year he turns 88. Nobody sees 89.
        expect(p.died - p.born - ceiling, `${p.name} (seed ${seed})`).toBeLessThan(1);
      }
    }
  });

  it('is a ceiling most people never reach', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    runYears(ctx, 600);
    const w = ctx.world;
    const dead = w.people.all().filter((p) => p.died !== undefined);
    const atCeiling = dead.filter(
      (p) => p.died! - p.born >= attr(p, 'max_age', ctx.genetics, w.year) - 1,
    );
    expect(dead.length).toBeGreaterThan(100);
    // A wall everyone hits is the cliff the fertility curve was rewritten to
    // avoid, pointing the other way.
    expectRate({
      hits: atCeiling.length,
      n: dead.length,
      ceiling: 0.1,
      what: 'the dead who reached their own ceiling',
    });
  });

  it('scales longevity into years around the baseline', () => {
    expect(deriveMaxAge(30, 30)).toBe(BASELINE_MAX_AGE);
    expect(deriveMaxAge(40, 30)).toBeGreaterThan(BASELINE_MAX_AGE);
    expect(deriveMaxAge(20, 30)).toBeLessThan(BASELINE_MAX_AGE);
    // Acquired years — what a portion of agelessness buys — add on top.
    expect(deriveMaxAge(30, 30, 25)).toBeCloseTo(BASELINE_MAX_AGE + 25, 5);
  });
});

/**
 * And the point of the ceiling: the two age curves read age as a fraction of
 * it, so a longer-lived body is younger for longer rather than simply older.
 */
describe('the curves read age relative to the ceiling', () => {
  it('converts years into body-years', () => {
    expect(bodyYears(39, 130)).toBeCloseTo(30, 5);
    expect(bodyYears(30, 100)).toBeCloseTo(30, 5);
    expect(bodyYears(20, 50)).toBeCloseTo(40, 5);
  });

  it('keeps a long-lived woman fertile later', () => {
    const ordinary = fertilityByAge('female', 39, 100);
    const longLived = fertilityByAge('female', 39, 130);
    expect(longLived).toBeGreaterThan(ordinary * 1.5);
  });

  it('still closes childbearing — a ceiling is not immortality', () => {
    expect(fertilityByAge('female', 70, 140)).toBe(0);
    expect(fertilityByAge('female', 51, 100)).toBe(0);
  });

  it('shortens a frail body\'s curve as well as lengthening a hardy one', () => {
    expect(fertilityByAge('female', 30, 70)).toBeLessThan(fertilityByAge('female', 30, 100));
  });
});
