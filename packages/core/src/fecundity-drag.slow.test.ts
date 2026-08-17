import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import type { Genome, Sex } from '@ed/schema';
import {
  FECUNDITY_DRAG_COUPLING, attr, buildLocusTable, conceive, dragFecundityContribution,
  hashSeed, makeRng, meiosis, randomGenome, testWorld, place, type Rng,
} from '@ed/core';

/**
 * FERTILITY OPTION B — the X-linked drag, prototyped behind a constant
 * (issue #26).
 *
 * `FECUNDITY_DRAG_COUPLING` ships at 0, and this file's first job is proving
 * that number is load-bearing: the loci exist, are linked to font, and
 * genuinely do nothing to a body's fertility at the shipped default. Its
 * second job is proving the MECHANISM itself is correct in isolation — via
 * `dragFecundityContribution`'s explicit-coupling seam — without ever
 * running the simulation at anything but the shipped default (INVARIANT 8:
 * no module-scope mutable state that could drift between runs).
 *
 * What this file deliberately does NOT do: run the "batches of two hundred,
 * turn the constant up, watch for the death spiral" gate the issue asks
 * for before shipping this live. That is a harness exercise a human runs by
 * editing the constant and reverting it, not a checked-in test — see the
 * issue thread for the exploratory numbers from one such run.
 */

const bundle = loadContent();
const table = buildLocusTable(bundle.loci);
const YEAR = 1042;

function rngFor(...salt: (string | number)[]): Rng {
  return makeRng(hashSeed('fecundity-drag', ...salt));
}

const founder = (rng: Rng, sex: Sex): Genome => randomGenome(table, undefined, sex, rng);

function gamete(g: Genome, sex: Sex, rng: Rng, want: 'x' | 'y' | 'any' = 'any') {
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

const dragIds = table.x.filter((l) => l.kind === 'fecundity_drag').map((l) => String(l.id));
const dragIndices = dragIds.map((id) => table.xIndex.get(id)!);

describe('fecundity drag (issue #26)', () => {
  it('ships inert — the coupling constant is zero', () => {
    expect(FECUNDITY_DRAG_COUPLING).toBe(0);
  });

  it('is authored: one drag locus per font locus, each linked (a few cM away)', () => {
    const fontIds = table.x.filter((l) => l.kind === 'eldritch_font').map((l) => String(l.id));
    expect(dragIds.length, 'no fecundity_drag loci authored').toBe(fontIds.length);

    for (const fontId of fontIds) {
      const n = fontId.replace('font_', '');
      const pairedDrag = table.x.find((l) => l.id === `fecundity_drag_${n}`);
      expect(pairedDrag, `no drag locus paired with ${fontId}`).toBeDefined();

      const fontLocus = table.x.find((l) => l.id === fontId)!;
      const distance = Math.abs(pairedDrag!.position - fontLocus.position);
      expect(distance, `${fontId} and its drag locus are ${distance}cM apart — not linked`).toBeLessThan(10);
      expect(distance, `${fontId} and its drag locus occupy the same position`).toBeGreaterThan(0);
    }
  });

  it('contributes to fecundity, never to the eldritch profile', () => {
    const contribs = table.byAttribute.get('fecundity') ?? [];
    const dragContribs = contribs.filter((c) => c.locus.kind === 'fecundity_drag');
    expect(dragContribs.length, 'drag loci are not wired into fecundity at all').toBe(dragIds.length);
    for (const c of dragContribs) {
      expect(c.weight, `${c.locus.id} does not pull fecundity DOWN`).toBeLessThan(0);
    }
  });

  it('does not move a body\'s fecundity at the shipped (zero) coupling', () => {
    const ctx = testWorld(bundle, 55221, 1042);
    const person = place(ctx, { sex: 'female', age: 25, name: 'A Woman' });

    // Same person throughout — only her drag genome changes between the two reads.
    const before = attr(person, 'fecundity', ctx.genetics, ctx.world.year); // materializes

    const strongIdx = (id: string) => table.xAlleles[table.xIndex.get(id)!]!.findIndex((a) => a.id === `${id}_strong`);
    const g = person.genome.kind === 'materialized' ? person.genome.genome : undefined;
    expect(g, 'genome did not materialize').toBeDefined();
    for (const id of dragIds) {
      const idx = table.xIndex.get(id)!;
      const strong = strongIdx(id);
      g!.sex[0][idx] = strong;
      g!.sex[1]![idx] = strong;
    }
    person.phenotype!.dirty = true;

    const after = attr(person, 'fecundity', ctx.genetics, ctx.world.year);
    expect(after, 'maxing out her drag genome moved fecundity even though the coupling is zero').toBe(before);
  });

  it('drags fecundity down when the coupling is turned up (mechanism only, not the shipped path)', () => {
    const rng = rngFor('mechanism');
    const hot = founder(rng, 'female');
    const cold = founder(rng, 'female');
    for (const i of dragIndices) {
      const strong = table.xAlleles[i]!.findIndex((a) => a.id.endsWith('_strong'));
      const none = table.xAlleles[i]!.findIndex((a) => a.tags.includes('null'));
      hot.sex[0][i] = strong; hot.sex[1]![i] = strong;
      cold.sex[0][i] = none; cold.sex[1]![i] = none;
    }

    expect(dragFecundityContribution(hot, table, 0)).toBe(0);
    expect(dragFecundityContribution(cold, table, 0)).toBe(0);

    const hotAt1 = dragFecundityContribution(hot, table, 1);
    const coldAt1 = dragFecundityContribution(cold, table, 1);
    expect(hotAt1, 'a fully-strong drag genome did not pull fecundity down at coupling 1').toBeLessThan(0);
    expect(coldAt1, 'a fully-null drag genome should contribute nothing').toBe(0);
    expect(hotAt1).toBeLessThan(coldAt1);
  });

  it('sons express drag from their single maternal X; daughters from two, buffered', () => {
    // Same asymmetry as font, running the other way: a son with his mother's
    // one hot haplotype gets the full hemizygous effect; a daughter mixes it
    // with whatever her father's X carries (always cold — outsiders draw
    // font-pool frequencies here too, since fecundity_drag rides the same X).
    const rng = rngFor('sex-asymmetry');
    const hotMother = founder(rng, 'female');
    for (const i of dragIndices) {
      const strong = table.xAlleles[i]!.findIndex((a) => a.id.endsWith('_strong'));
      hotMother.sex[0][i] = strong; hotMother.sex[1]![i] = strong;
    }
    const father = founder(rng, 'male');

    const son = child(hotMother, father, rng, 'son');
    const daughter = child(hotMother, father, rng, 'daughter');

    const sonDrag = dragFecundityContribution(son.genome, table, 1);
    const daughterDrag = dragFecundityContribution(daughter.genome, table, 1);

    expect(sonDrag, 'a son of an all-strong-drag mother shows no drag at all').toBeLessThan(0);
    // The daughter's second X is a random outsider draw diluting the effect,
    // exactly as font dilutes — so her magnitude should not exceed her brother's.
    expect(Math.abs(daughterDrag)).toBeLessThanOrEqual(Math.abs(sonDrag) + 1e-9);
  });
});
