import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import type { Gamete, Genome, Sex } from '@ed/schema';
import {
  buildLocusTable, conceive, deleteriousLoad, eldritch, expressAttributes,
  hashSeed, makeRng, meiosis, randomGenome, realizedHomozygosity,
  type Rng,
} from '@ed/core';

/**
 * THE STATISTICAL PASS OVER THE GENETICS (unbuilt brief §9).
 *
 * The rest of the slow suite asserts the shape of a healthy RUN. This file
 * asserts the shape of the DISTRIBUTION, and it needs no run at all: every
 * claim below is about meiosis, conception and expression, so pedigrees are
 * built straight out of `randomGenome` and `conceive` and ten thousand of them
 * cost less than one simulated century.
 *
 * The brief's own summary of why this file is first: "If those hold, the
 * genetics is correct and everything downstream is tuning."
 *
 * TWO HABITS THROUGHOUT, both earned from `docs/FAILURES.md`:
 *
 *   Every cohort carries a CONTROL. "No son of a null-font mother has font" is
 *   also true of a build where font is broken everywhere, and it would stay
 *   green forever. So the null-font cohort is asserted against a cohort of
 *   ordinary mothers, which must show the opposite.
 *
 *   Mutation is not tolerance. Two of these claims are absolute except for the
 *   one thing that genuinely breaks them, and a gamete records its own
 *   mutations — so rather than allowing a fudge factor, the exceptions are
 *   asserted to be exactly the children whose genome names a mutation at the
 *   locus in question.
 */

const bundle = loadContent();
const table = buildLocusTable(bundle.loci);
const attributes = bundle.attributes;
const YEAR = 1042;

/** Ten thousand, as specified. Pure meiosis is cheap enough to mean it. */
const PEDIGREES = 10_000;
/** Full-sib pedigrees cost four conceptions each rather than one. */
const SIB_PEDIGREES = 3_000;

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

function rngFor(...salt: (string | number)[]): Rng {
  return makeRng(hashSeed('genetics', ...salt));
}

const founder = (rng: Rng, sex: Sex): Genome => randomGenome(table, undefined, sex, rng);

/**
 * A gamete of the wanted kind. A man's gamete carries either his X or a Y, so
 * asking for a son is a matter of drawing until the Y turns up.
 */
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

describe('offspring regress toward the mid-parent', () => {
  /**
   * An attribute chosen by its properties rather than by name, so that renaming
   * one in `attributes.yaml` cannot quietly empty this test. Dimorphism and the
   * Awakening gate are both excluded: each is a constant shift applied after
   * expression, and neither says anything about inheritance.
   */
  const def = attributes.find((a) =>
    a.kind === 'core' && a.heritable && !a.dimorphism && !a.gatedBy
    && (table.byAttribute.get(String(a.id))?.length ?? 0) >= 4);

  it('has a polygenic attribute to measure', () => {
    expect(def, 'no undimorphic core attribute with four or more loci').toBeDefined();
  });

  const key = String(def?.id);
  const valueOf = (g: Genome, sex: Sex) =>
    expressAttributes(g, sex, table, attributes, { awakened: true }).get(key) ?? 0;

  const rng = rngFor('regression');
  const mids: number[] = [];
  const kids: number[] = [];
  for (let i = 0; i < PEDIGREES; i++) {
    const mother = founder(rng, 'female');
    const father = founder(rng, 'male');
    const c = child(mother, father, rng);
    mids.push((valueOf(mother, 'female') + valueOf(father, 'male')) / 2);
    kids.push(valueOf(c.genome, c.sex));
  }

  const mu = mean(mids);

  it('carries the mid-parent through to the child, at slope one', () => {
    // Least squares through the cloud.
    //
    // The measured slope is 0.993, and one is the RIGHT answer rather than a
    // suspiciously round one: these loci are near-additive, and for an additive
    // polygenic trait the expected child IS the mid-parent. That makes this a
    // sharp instrument — a meiosis that biased transmission, dropped a
    // haplotype, or sampled the wrong parent would move it off one immediately,
    // so the band is tight on purpose. A slope near zero would mean the child
    // is drawn independently of who made it; well above one would mean each
    // generation amplifies its parents and every line pins to a range bound
    // inside ten generations.
    let num = 0, den = 0;
    const kbar = mean(kids);
    for (let i = 0; i < mids.length; i++) {
      num += (mids[i]! - mu) * (kids[i]! - kbar);
      den += (mids[i]! - mu) ** 2;
    }
    const slope = num / den;
    expect(slope, `mid-parent slope ${slope.toFixed(4)} — transmission is biased`)
      .toBeGreaterThan(0.85);
    expect(slope, `mid-parent slope ${slope.toFixed(4)} — children exceed their parents`)
      .toBeLessThan(1.15);
  });

  it('does not clone the mid-parent — one pair produces varied children', () => {
    // The other half, and the half that makes breeding a gamble rather than
    // arithmetic. Slope one with no scatter would mean every child of a pair is
    // identical, which is what a meiosis that stopped recombining would produce
    // — and the slope test above would not notice.
    //
    // Deliberately NOT the regression-to-the-mean assertion this file first
    // carried. Children of top-decile parents came in +13.30 against their
    // parents' +13.46: a 1% pullback, inside sampling noise, which would have
    // been a coin-flip failure dressed up as a law of inheritance.
    const r = rngFor('segregation');
    const mother = founder(r, 'female');
    const father = founder(r, 'male');
    const brood: number[] = [];
    for (let i = 0; i < 2_000; i++) {
      const c = child(mother, father, r);
      brood.push(valueOf(c.genome, c.sex));
    }

    const sd = (xs: number[]) => {
      const m = mean(xs);
      return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
    };
    const sibSd = sd(brood);
    const popSd = sd(kids);

    expect(sibSd, 'every child of one pair is identical — recombination is not running')
      .toBeGreaterThan(popSd * 0.25);
    expect(sibSd, `siblings vary as much as strangers (sib ${sibSd.toFixed(2)}, population ${popSd.toFixed(2)})`)
      .toBeLessThan(popSd);
  });
});

describe('inbreeding', () => {
  /**
   * F is not raw homozygosity. A genome drawn from any real allele pool is
   * homozygous at a good fraction of its loci by chance alone, so the quantity
   * with a predicted value is the RISE over an outbred baseline:
   *
   *   F = (H_sib - H_outbred) / (1 - H_outbred)
   *
   * Full-sib mating predicts 0.25, and that number is not a tuning knob — it
   * falls out of the pedigree. If this drifts, meiosis is wrong.
   */
  const rng = rngFor('inbreeding');
  const outbred: Genome[] = [];
  const sibs: Genome[] = [];

  for (let i = 0; i < SIB_PEDIGREES; i++) {
    const gm = founder(rng, 'female');
    const gf = founder(rng, 'male');
    outbred.push(child(gm, gf, rng).genome);

    // Two full siblings of the same pair, then their child.
    const son = child(gm, gf, rng, 'son').genome;
    const daughter = child(gm, gf, rng, 'daughter').genome;
    sibs.push(child(daughter, son, rng).genome);
  }

  const h0 = mean(outbred.map(realizedHomozygosity));
  const h1 = mean(sibs.map(realizedHomozygosity));
  const f = (h1 - h0) / (1 - h0);

  it('realises F ≈ 0.25 under full-sib mating', () => {
    expect(h0, 'the outbred baseline is already fixed — the pool has no variation')
      .toBeLessThan(0.95);
    expect(f, `realised F ${f.toFixed(3)} (H outbred ${h0.toFixed(3)}, H sib ${h1.toFixed(3)})`)
      .toBeGreaterThan(0.18);
    expect(f, `realised F ${f.toFixed(3)} (H outbred ${h0.toFixed(3)}, H sib ${h1.toFixed(3)})`)
      .toBeLessThan(0.32);
  });

  it('expresses more of the founder curses as F rises', () => {
    // The whole reason inbreeding is a decision rather than a stat. Deleterious
    // alleles are recessive, so concentrating the blood is what brings them out
    // — and the cost has to be visible in the same cohort the F rise is.
    expect(table.autosomal.some((l) => l.kind === 'deleterious'),
      'no deleterious loci authored — this test proves nothing').toBe(true);

    const bad0 = mean(outbred.map((g) => deleteriousLoad(g, table).count));
    const bad1 = mean(sibs.map((g) => deleteriousLoad(g, table).count));

    expect(bad0, 'no outbred child expressed any curse — the load is too low to measure')
      .toBeGreaterThan(0);
    expect(bad1, `curses per child: outbred ${bad0.toFixed(3)}, full-sib ${bad1.toFixed(3)}`)
      .toBeGreaterThan(bad0);
  });
});

describe('the X-linked font', () => {
  const fontLocusIds = new Set(table.fontIndices.map((i) => String(table.x[i]!.id)));

  it('has font loci with a null allele of no effect', () => {
    expect(table.fontIndices.length, 'no font loci at all').toBeGreaterThan(0);
    for (const i of table.fontIndices) {
      const idx = table.xAlleles[i]!.findIndex((a) => a.tags.includes('null'));
      expect(idx, `x locus ${table.x[i]!.id} has no null allele`).toBeGreaterThanOrEqual(0);
      expect(table.xAlleles[i]![idx]!.effect, `null allele at ${table.x[i]!.id} carries effect`).toBe(0);
    }
  });

  /** Both her X's carry nothing at every font locus. She cannot pass what she has not got. */
  function nullFontMother(rng: Rng): Genome {
    const g = founder(rng, 'female');
    for (const i of table.fontIndices) {
      const idx = table.xAlleles[i]!.findIndex((a) => a.tags.includes('null'));
      g.sex[0][i] = idx;
      g.sex[1]![i] = idx;
    }
    return g;
  }

  it('gives no son of a double-null mother any font, except by mutation', () => {
    const rng = rngFor('null-font');
    let sons = 0;
    let carriers = 0;
    let mutants = 0;

    for (let i = 0; i < PEDIGREES; i++) {
      const mother = nullFontMother(rng);
      const father = founder(rng, 'male');
      const son = child(mother, father, rng, 'son');
      sons += 1;
      if (eldritch(son.genome, 'male', table).carriedFont > 0) {
        carriers += 1;
        // Not a tolerance. A son who carries font from a mother who had none
        // is either a bug or a new allele, and the gamete knows which.
        expect(son.genome.mutations.some((m) => fontLocusIds.has(String(m.locus))),
          'a son of a null-font mother carries font with no mutation to account for it').toBe(true);
        mutants += 1;
      }
    }

    expect(sons).toBe(PEDIGREES);
    expect(carriers).toBe(mutants);
  });

  it('does give sons of ordinary mothers font — the control', () => {
    // Without this, the assertion above is also satisfied by a build in which
    // font is broken everywhere and nobody can express anything.
    const rng = rngFor('font-control');
    let carriers = 0;
    for (let i = 0; i < 2_000; i++) {
      const son = child(founder(rng, 'female'), founder(rng, 'male'), rng, 'son');
      if (eldritch(son.genome, 'male', table).carriedFont > 0) carriers += 1;
    }
    expect(carriers, 'no son of any mother carries font — the font system is dead').toBeGreaterThan(0);
  });

  it("passes a father's single X intact to every one of his daughters", () => {
    // He has one X and no way to recombine it, so every daughter gets the same
    // one. This is why cousin marriage is the mechanism rather than a
    // mechanism, and it is exact rather than statistical.
    const rng = rngFor('paternal-x');
    const father = founder(rng, 'male');
    const paternal = father.sex[0];
    let daughters = 0;
    let maternalVaried = 0;
    const firstMaternal = [] as number[];

    for (let i = 0; i < PEDIGREES; i++) {
      const d = child(founder(rng, 'female'), father, rng, 'daughter');
      daughters += 1;
      const fromFather = d.genome.sex[1]!;
      const mutatedHere = new Set(d.genome.mutations.map((m) => String(m.locus)));

      for (let j = 0; j < paternal.length; j++) {
        if (fromFather[j] === paternal[j]) continue;
        expect(mutatedHere.has(String(table.x[j]!.id)),
          `daughter ${i} differs from her father at ${table.x[j]!.id} with no mutation recorded`).toBe(true);
      }

      // Control: her OTHER X is her mother's mosaic and must not be constant.
      const fromMother = d.genome.sex[0];
      if (i === 0) firstMaternal.push(...fromMother);
      else if (firstMaternal.some((v, j) => v !== fromMother[j])) maternalVaried += 1;
    }

    expect(daughters).toBe(PEDIGREES);
    expect(maternalVaried, 'every daughter got an identical maternal X — recombination is not running')
      .toBeGreaterThan(0);
  });
});
