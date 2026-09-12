import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { buildLocusTable, deleteriousLoad, expressLocus } from '@ed/core';
import type { AlleleDef, Genome, LocusDef } from '@ed/schema';

/**
 * THE CURSES MUST COST SOMETHING (issue #112).
 *
 * Every named curse in the game granted **+3.5 Strength** for as long as the
 * deleterious loci had existed. `expressAttributes` computes
 * `expressLocus(...) * weight`, the bad allele was authored `effect: -7`, and
 * the contribution was authored `weight: -0.5`. A negative times a negative.
 * The thin bone made you stronger. So did the Ashen mark.
 *
 * Nothing failed. There is no assertion anywhere that a thing called a curse
 * is bad for you, so the whole of Strength's inbreeding story ran with its
 * sign inverted for five loci at `p: 0.07` each — the more curses a line had
 * concentrated, the stronger its bodies read — and it looked exactly like a
 * working simulation from the outside.
 *
 * That is this repository's characteristic failure and it wants this
 * repository's characteristic guard: not "does `expressAttributes` return",
 * but the SHAPE the shipped table has to have. So the three claims below are
 * quantified over `kind === 'deleterious'` rather than over the five ids that
 * happen to exist today, and a sixth curse authored next year is covered by
 * them the moment it is added, without anybody remembering to come back here.
 */

const bundle = loadContent();
const table = buildLocusTable(bundle.loci);

const isBad = (a: AlleleDef) =>
  a.tags.includes('deleterious') || a.tags.includes('lethal_homozygous');

/** The deleterious loci as (locus, clean allele, bad allele) triples. */
const curses: { locus: LocusDef; clean: AlleleDef; bad: AlleleDef }[] = table.autosomal
  .filter((l) => l.kind === 'deleterious')
  .map((locus) => ({
    locus,
    clean: locus.alleles.find((a) => !isBad(a))!,
    bad: locus.alleles.find(isBad)!,
  }));

/** What one copy / two copies of the curse do to an attribute it feeds. */
function contribution(c: (typeof curses)[number], copies: 1 | 2, attr: string): number {
  const w = c.locus.contributes.find((x) => x.attr === attr);
  if (!w) return 0;
  const b = copies === 2 ? c.bad.effect : c.clean.effect;
  return expressLocus(c.bad.effect, b, c.locus.dominance) * w.weight;
}

describe('deleterious loci', () => {
  it('the shipped table actually has curses in it', () => {
    // The control. Every claim below is vacuously true of an empty list, and
    // an empty list is exactly what a renamed `kind` would produce.
    expect(curses.length).toBeGreaterThanOrEqual(5);
    for (const c of curses) {
      expect(c.clean, `${c.locus.id} has no clean allele`).toBeDefined();
      expect(c.bad, `${c.locus.id} has no deleterious allele`).toBeDefined();
      expect(c.locus.contributes.length, `${c.locus.id} contributes to nothing`).toBeGreaterThan(0);
    }
  });

  it('costs the homozygote and never pays anybody', () => {
    for (const c of curses) {
      for (const { attr } of c.locus.contributes) {
        const carrier = contribution(c, 1, attr);
        const afflicted = contribution(c, 2, attr);

        // The bug, stated as the assertion that would have caught it.
        expect(afflicted, `${c.locus.id} pays ${attr} ${afflicted} when homozygous`).toBeLessThan(0);
        // And a curse must never be an improvement in the carrier either.
        expect(carrier, `${c.locus.id} pays ${attr} ${carrier} to a carrier`).toBeLessThanOrEqual(0);
      }
    }
  });

  it('is recessive — one copy is not enough, which is what makes it inheritable', () => {
    // The second half of the bug, and the quieter one. `dominance: -1` made
    // `expressLocus` return the LOWER allele, so a heterozygote expressed the
    // full effect and the game held two different answers to "is this curse
    // expressed": the attribute path said yes on one copy, while
    // `deleteriousLoad` and `vitality.ts` counted only homozygotes.
    //
    // Inbreeding depression IS this: silent in the carrier, paid by the
    // descendant who inherits it from both sides. A curse that costs on one
    // copy is just a bad attribute roll.
    for (const c of curses) {
      for (const { attr } of c.locus.contributes) {
        expect(contribution(c, 1, attr), `${c.locus.id} charges a carrier for ${attr}`).toBe(0);
        expect(contribution(c, 2, attr)).toBeLessThan(contribution(c, 1, attr));
      }
    }
  });

  it('agrees with deleteriousLoad about who is afflicted', () => {
    // The two readers, on the same genome. `deleteriousLoad` is what
    // `vitality.ts` charges health against and what the chronicle names, so a
    // person the attribute path charges and this function does not is a
    // person the game is telling two stories about.
    const n = table.autosomal.length;
    const clean = () => new Int16Array(n);

    for (let i = 0; i < n; i++) {
      const locus = table.autosomal[i]!;
      if (locus.kind !== 'deleterious') continue;
      const c = curses.find((x) => x.locus.id === locus.id)!;
      const badIdx = locus.alleles.indexOf(c.bad);

      const carrier: Genome = { autosomal: [clean(), clean()], sex: [clean(), null], mutations: [] };
      carrier.autosomal[0][i] = badIdx;
      expect(deleteriousLoad(carrier, table).count, `${locus.id}: a carrier is counted afflicted`).toBe(0);

      const afflicted: Genome = { autosomal: [clean(), clean()], sex: [clean(), null], mutations: [] };
      afflicted.autosomal[0][i] = badIdx;
      afflicted.autosomal[1][i] = badIdx;
      expect(deleteriousLoad(afflicted, table).count, `${locus.id}: a homozygote is not counted`).toBe(1);
    }
  });
});
