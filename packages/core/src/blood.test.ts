import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { indexContent } from '@ed/schema';
import {
  bootstrap, buildLocusTable, heldBooks, makeRng, meiosis, testWorld,
} from '@ed/core';
import type { Genome } from '@ed/schema';
import { bloodBundle } from './tools/blood-gate.js';
import { loadBundle } from '@ed/content';
import { phenotypeOf } from './people/factory.js';

const content = loadContent();
const bundle = loadBundle();

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

/**
 * THE FOUNDER'S BLOOD IS THE BLOOD HE WAS AUTHORED WITH.
 *
 * `bias: { eldritch_power }` matched nothing for as long as the field existed.
 * `applyBias` walks `table.byAttribute`, which is built from each locus's
 * `contributes` — and the font and channel loci deliberately declare none,
 * because eldritch is not an attribute and shares no code with one
 * (invariant 4). So the key had no entry, the loop ran zero times, and the
 * single most important person in the content directory was rolled at random
 * (invariant 11: a declared field nothing reads is a bug).
 *
 * Asserted against an unbiased control rather than against a number, because
 * the number is a balance decision and this is the mechanism.
 */
describe('the founder is the man his recipe describes', () => {
  const founderOf = (source: Parameters<typeof bootstrap>[0], seed: number) => {
    const ctx = bootstrap(source, seed, 1042);
    const p = ctx.world.people.all().find((q) => q.castSlots.includes('narrator'));
    return p ? { ctx, p } : undefined;
  };

  const unbiased = indexContent({
    ...bundle,
    characters: bundle.characters.map((c) => (c.key === 'founder'
      ? { ...c, bias: Object.fromEntries(Object.entries(c.bias).filter(([k]) => k !== 'eldritch_power')) }
      : c)),
  });

  it('carries more of it than the same man rolled without the bias', () => {
    const font = (source: Parameters<typeof bootstrap>[0]) => {
      let total = 0;
      for (let i = 0; i < 24; i++) {
        const found = founderOf(source, 4000 + i * 13);
        if (!found) continue;
        total += phenotypeOf(found.p, found.ctx.genetics, 1042).eldritch.carriedFont;
      }
      return total / 24;
    };
    // A batch, not a seed: a bias is a nudge toward an intent and not a pin,
    // so any one founder may roll under his own recipe.
    expect(font(content)).toBeGreaterThan(font(unbiased));
  });

  it('is given the channel to use it and not only the font to drown in', () => {
    // Power is `min(font, ceiling)` and Madness is what will not pass, so a
    // bias that reached the font alone would have authored a ruined man
    // rather than a strong one.
    let ceiling = 0;
    for (let i = 0; i < 24; i++) {
      const found = founderOf(content, 4000 + i * 13);
      if (!found) continue;
      ceiling += phenotypeOf(found.p, found.ctx.genetics, 1042).eldritch.ceiling;
    }
    let plain = 0;
    for (let i = 0; i < 24; i++) {
      const found = founderOf(unbiased, 4000 + i * 13);
      if (!found) continue;
      plain += phenotypeOf(found.p, found.ctx.genetics, 1042).eldritch.ceiling;
    }
    expect(ceiling).toBeGreaterThan(plain);
  });

  it('can express it, in every run, because the whole game rests on him', () => {
    for (let i = 0; i < 12; i++) {
      const found = founderOf(content, 4000 + i * 13);
      expect(found, `seed ${4000 + i * 13} has no narrator`).toBeTruthy();
      expect(phenotypeOf(found!.p, found!.ctx.genetics, 1042).eldritch.canExpress).toBe(true);
    }
  });
});

describe('who the house marries when nobody is asked', () => {
  it('leaves the shipped default alone', () => {
    expect(testWorld(content).world.marriagePolicy).toBe('as_it_falls');
  });
});
