import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { indexContent } from '@ed/schema';
import {
  bootstrap, buildLocusTable, heldBooks, makeRng, meiosis, testWorld,
} from '@ed/core';
import type { Genome } from '@ed/schema';
import { bloodBundle } from './tools/blood-gate.js';

const content = loadContent();

/**
 * THE THREE LEVERS OF ISSUE #41, each tested where it acts.
 *
 * The measured finding, in one line: an oracle player who always took the card
 * whose person really carried the most font watched the family's blood fall
 * from 31 to 4 inside four generations, and no verb the game offered touched
 * it. `npm run gate:blood` is the instrument and `docs/BALANCE-LOG.md` carries
 * the tables. These are the mechanisms those tables are about — asserted the
 * way this repository asks for, on the mechanism and never on a seed.
 */

/** A woman with one X carrying everything and one carrying nothing. */
function twoXWoman(table: ReturnType<typeof buildLocusTable>, hot: boolean[]): Genome {
  const x0 = new Int16Array(table.x.length);
  const x1 = new Int16Array(table.x.length);
  table.fontIndices.forEach((i, n) => {
    const alleles = table.xAlleles[i]!;
    const burning = alleles.reduce((best, a, idx) => (a.effect > (alleles[best]?.effect ?? -1) ? idx : best), 0);
    const empty = Math.max(0, alleles.findIndex((a) => a.tags.includes('null')));
    x0[i] = hot[n] ? burning : empty;
    x1[i] = empty;
  });
  return {
    autosomal: [new Int16Array(table.autosomal.length), new Int16Array(table.autosomal.length)],
    sex: [x0, x1],
    mutations: [],
  };
}

function transmitted(table: ReturnType<typeof buildLocusTable>, g: Genome, draws: number): number {
  let total = 0;
  for (let i = 0; i < draws; i++) {
    const gamete = meiosis(g, table, 'female', makeRng(1000 + i), 1200);
    for (const idx of table.fontIndices) {
      total += table.xAlleles[idx]![gamete.x![idx]!]?.effect ?? 0;
    }
  }
  return total / draws;
}

describe('the blood is not passed on fairly', () => {
  const hot = [true, true, true, true, true, true];

  it('is a fair coin where no locus declares a drive', () => {
    const table = buildLocusTable(indexContent(bloodBundle(content.bundle, { drive: 0.5 })).loci);
    const mother = twoXWoman(table, hot);

    // Half of everything she carries, which is exactly the decay the batch
    // measured: four generations of this and the founding haplotype is gone.
    const mean = transmitted(table, mother, 400);
    const full = table.fontIndices.reduce((sum, i) => {
      const alleles = table.xAlleles[i]!;
      return sum + Math.max(...alleles.map((a) => a.effect));
    }, 0);

    expect(mean).toBeGreaterThan(full * 0.35);
    expect(mean).toBeLessThan(full * 0.65);
  });

  it('hands on the hotter X more often when the font loci drive', () => {
    const fair = buildLocusTable(indexContent(bloodBundle(content.bundle, { drive: 0.5 })).loci);
    const driven = buildLocusTable(indexContent(bloodBundle(content.bundle, { drive: 0.9 })).loci);

    const evenly = transmitted(fair, twoXWoman(fair, hot), 400);
    const driving = transmitted(driven, twoXWoman(driven, hot), 400);

    expect(driving).toBeGreaterThan(evenly);
  });

  /**
   * The drive is a bias on WHICH X a child is handed, and nothing else. A
   * mother with two identical X's has nothing to be biased about, and a woman
   * whose cold X is the one with more font on it drives toward THAT — the
   * mechanism knows about font and not about the family.
   */
  it('drives toward whichever X carries more, and stays a coin when they match', () => {
    const table = buildLocusTable(indexContent(bloodBundle(content.bundle, { drive: 0.9 })).loci);

    const both = twoXWoman(table, [true, true, true, true, true, true]);
    both.sex[1] = Int16Array.from(both.sex[0]);
    const identical = transmitted(table, both, 200);
    const full = table.fontIndices.reduce((sum, i) => {
      const alleles = table.xAlleles[i]!;
      return sum + Math.max(...alleles.map((a) => a.effect));
    }, 0);
    expect(identical).toBeCloseTo(full, 0);

    // The same genome with the haplotypes swapped drives the other way, and
    // hands on about the same amount. Not exactly the same: the walk starts on
    // the other side of every crossover, so the mosaics differ — what has to
    // hold is that the mechanism reads the font and not the index.
    const one = twoXWoman(table, [true, true, true, false, false, false]);
    const flipped = twoXWoman(table, [true, true, true, false, false, false]);
    [flipped.sex[0], flipped.sex[1]] = [flipped.sex[1]!, flipped.sex[0]];

    const a = transmitted(table, one, 300);
    const b = transmitted(table, flipped, 300);
    expect(Math.abs(a - b) / a).toBeLessThan(0.15);
    // And both are well above the fair-coin half, which is the whole claim.
    expect(Math.min(a, b)).toBeGreaterThan(full * 0.5 * 0.5);
  });
});

describe('the house has been reading since before the signing', () => {
  it('puts the founding library on the shelf', () => {
    const ctx = bootstrap(content, 1042, 1042);
    const home = content.houses.find((h) => h.isPlayerHouse)!;

    expect(home.library.length).toBeGreaterThan(0);
    expect(heldBooks(ctx).map((b) => b.id).sort()).toEqual([...home.library].sort());
  });

  it('is a shelf and not a gift: nobody has read any of it', () => {
    const ctx = bootstrap(content, 1042, 1042);
    for (const p of ctx.world.people.household(ctx.world.playerHouse, ctx.world.year)) {
      expect(p.spellsKnown).toHaveLength(0);
    }
  });
});

describe('who the house marries when nobody is asked', () => {
  it('leaves the shipped default alone', () => {
    expect(testWorld(content).world.marriagePolicy).toBe('as_it_falls');
  });
});
