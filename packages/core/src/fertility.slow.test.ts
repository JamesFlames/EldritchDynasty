import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import type { Gamete, Genome, Sex } from '@ed/schema';
import {
  bootstrap, buildLocusTable, conceive, deleteriousLoad, genomeOf, hashSeed, makeRng, meiosis,
  pairFecundity, place, randomGenome, type Rng,
  expectRateBelow,
} from '@ed/core';

/**
 * FERTILITY OPTION D — barrenness as a named recessive (issue #25).
 *
 * `del_hollow_year` slots into the deleterious sweep every other founder
 * curse already runs through, so this file asks the same two questions
 * `genetics.slow.test.ts`'s "inbreeding" block asks of curses generally, but
 * pinned to this one named allele specifically — because "does not exceed
 * ~3% of couples" and "cousin marriage measurably surfaces it" are the two
 * claims `pairFecundity`'s floor is actually staked on.
 */

const bundle = loadContent();
const table = buildLocusTable(bundle.loci);
const YEAR = 1042;
const HOLLOW_YEAR = 'the hollow year';

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

function rngFor(...salt: (string | number)[]): Rng {
  return makeRng(hashSeed('fertility', ...salt));
}

const founder = (rng: Rng, sex: Sex): Genome => randomGenome(table, undefined, sex, rng);

function gamete(g: Genome, sex: Sex, rng: Rng, want: 'x' | 'y' | 'any' = 'any'): Gamete {
  for (let i = 0; i < 200; i++) {
    const gm = meiosis(g, table, sex, rng, YEAR);
    if (want === 'any' || (want === 'x' ? gm.x !== null : gm.x === null)) return gm;
  }
  throw new Error(`no ${want}-bearing gamete in 200 draws`);
}

function child(mother: Genome, father: Genome, rng: Rng, want: 'son' | 'daughter' | 'any' = 'any') {
  const wantX = want === 'son' ? 'y' : want === 'daughter' ? 'x' : 'any';
  return conceive(gamete(mother, 'female', rng), gamete(father, 'male', rng, wantX), table);
}

const isHollowYear = (g: Genome) => deleteriousLoad(g, table).names.includes(HOLLOW_YEAR);

describe('the hollow year (issue #25)', () => {
  it('is authored as a deleterious recessive', () => {
    const locus = table.autosomal.find((l) => l.id === 'del_hollow_year');
    expect(locus, 'del_hollow_year missing from the generated locus table').toBeDefined();
    expect(locus?.kind).toBe('deleterious');
  });

  it('appears, and stays well under 3% of an outbred population', () => {
    const rng = rngFor('outbred-prevalence');
    const N = 20_000;
    let homozygous = 0;
    for (let i = 0; i < N; i++) {
      const c = child(founder(rng, 'female'), founder(rng, 'male'), rng);
      if (isHollowYear(c.genome)) homozygous += 1;
    }
    const rate = homozygous / N;
    expect(homozygous, 'never once expressed — the allele is not reaching children').toBeGreaterThan(0);
    expectRateBelow({
      hits: homozygous, n: N, ceiling: 0.03,
      what: 'hollow-year homozygotes in an outbred population',
    });
  });

  /**
   * The mechanism the whole option is staked on: cousin marriage is what
   * surfaces the curse, because both cousins can carry the same allele from
   * their shared grandparents. A first-cousin pedigree (F ≈ 0.0625) should
   * show a measurably higher rate than two unrelated founders (F ≈ 0).
   */
  it('shows a measurably higher rate in cousin-married pedigrees than out-married ones', () => {
    const rng = rngFor('cousin-vs-outbred');
    const N = 20_000;

    let outbredHits = 0;
    for (let i = 0; i < N; i++) {
      const c = child(founder(rng, 'female'), founder(rng, 'male'), rng);
      if (isHollowYear(c.genome)) outbredHits += 1;
    }

    let cousinHits = 0;
    for (let i = 0; i < N; i++) {
      const gm = founder(rng, 'female');
      const gf = founder(rng, 'male');
      const aunt = child(gm, gf, rng, 'daughter').genome;
      const uncle = child(gm, gf, rng, 'son').genome;
      const outsiderMale = founder(rng, 'male');
      const outsiderFemale = founder(rng, 'female');
      const cousinA = child(aunt, outsiderMale, rng, 'daughter').genome;
      const cousinB = child(outsiderFemale, uncle, rng, 'son').genome;
      const grandchild = child(cousinA, cousinB, rng);
      if (isHollowYear(grandchild.genome)) cousinHits += 1;
    }

    const outbredRate = outbredHits / N;
    const cousinRate = cousinHits / N;
    expect(cousinRate, `cousin ${(cousinRate * 100).toFixed(2)}% vs outbred ${(outbredRate * 100).toFixed(2)}% `
      + '— the deleterious sweep is not reaching first-cousin pedigrees').toBeGreaterThan(outbredRate);
  });

  it('is near-sterile, not lethal — option D is a binary curse on fecundity only', () => {
    const idx = table.autosomalIndex.get('del_hollow_year');
    expect(idx).toBeDefined();
    const bad = table.autosomalAlleles[idx!]!.find((a) => a.tags.includes('deleterious'));
    expect(bad?.tags.includes('lethal_homozygous')).toBe(false);
  });

  it('floors pairFecundity for a real couple when one partner is a homozygote', () => {
    const ctx = bootstrap(bundle, 90210, 1042);
    const mother = place(ctx, { sex: 'female', age: 25, name: 'A Homozygote Mother' });
    const controlMother = place(ctx, { sex: 'female', age: 25, name: 'An Ordinary Mother' });
    const father = place(ctx, { sex: 'male', age: 27, name: 'An Ordinary Father' });

    const idx = ctx.genetics.table.autosomalIndex.get('del_hollow_year')!;
    const badAllele = ctx.genetics.table.autosomalAlleles[idx]!.findIndex((a) => a.tags.includes('deleterious'));
    expect(badAllele).toBeGreaterThanOrEqual(0);

    const g = genomeOf(mother, ctx.genetics);
    g.autosomal[0]![idx] = badAllele;
    g.autosomal[1]![idx] = badAllele;

    const floored = pairFecundity(mother, father, ctx);
    const ordinary = pairFecundity(controlMother, father, ctx);

    expect(floored, `floored pairFecundity was ${floored}`).toBeLessThanOrEqual(-5);
    expect(floored).toBeLessThan(ordinary);
  });
});
