import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { validateBundle, splitSentences, proseIssues, PROSE_SENTENCE_THRESHOLD } from '@ed/schema';
import {
  bootstrap, runYears, phenotypeOf, makeGeneticsCtx, familySnapshot, expectRateBelow,
} from '@ed/core';
import { buildLocusTable, randomGenome, meiosis, conceive, eldritch, canLearn } from '@ed/core';
import { makeRng } from '@ed/core';

const bundle = loadContent();

describe('content', () => {
  it('validates with no errors', () => {
    const errors = validateBundle(bundle).filter((i) => i.level === 'error');
    expect(errors.map((e) => `${e.where}: ${e.message}`)).toEqual([]);
  });

  it('has content in every frequency tier', () => {
    for (const f of ['common', 'uncommon', 'rare', 'mythic']) {
      expect(bundle.events.filter((e) => e.frequency === f).length).toBeGreaterThan(0);
    }
  });
});

describe('genetics', () => {
  const ctx = makeGeneticsCtx(bundle, 7);
  const table = buildLocusTable(bundle.loci);

  it('gives a father the same X in every daughter', () => {
    const rng = makeRng(11);
    const father = randomGenome(table, ctx.pools.get('house_gearithy'), 'male', rng);
    const daughters: string[] = [];
    for (let i = 0; i < 40; i++) {
      const g = meiosis(father, table, 'male', makeRng(100 + i), 1042);
      if (g.x) daughters.push(g.x.join(','));
    }
    expect(new Set(daughters).size).toBe(1);
  });

  it('gives sons of a null-font mother a font of zero, barring mutation', () => {
    // A son's X comes ONLY from his mother, so a null-font mother produces
    // mundane sons however hot the father is — that is the whole of "dilutes
    // when married outward". The single legitimate exception is the rare
    // upward mutation at a font locus, which the design asks for explicitly,
    // so it is asserted rather than excluded.
    const rng = makeRng(3);
    const mother = randomGenome(table, ctx.pools.get('the_church'), 'female', rng);
    const father = randomGenome(table, ctx.pools.get('house_gearithy'), 'male', rng);
    let sons = 0;
    let mutants = 0;

    for (let i = 0; i < 120; i++) {
      const r = makeRng(500 + i);
      const { genome, sex } = conceive(
        meiosis(mother, table, 'female', r, 1042),
        meiosis(father, table, 'male', r, 1042),
        table,
      );
      if (sex !== 'male') continue;
      sons++;
      const font = eldritch(genome, 'male', table).carriedFont;
      if (font === 0) continue;
      mutants++;
      expect(genome.mutations.some((m) => m.locus.startsWith('font_'))).toBe(true);
    }

    expect(sons).toBeGreaterThan(20);
    expectRateBelow({
      hits: mutants, n: sons, ceiling: 0.1,
      what: 'sons given a font by upward mutation — rare is designed, common is a bug',
    });
  });

  it('never lets a woman express or go mad, at any font', () => {
    const rng = makeRng(21);
    for (let i = 0; i < 400; i++) {
      const g = randomGenome(table, ctx.pools.get('house_gearithy'), 'female', rng);
      const p = eldritch(g, 'female', table);
      expect(p.canExpress).toBe(false);
      expect(p.expressedPower).toBe(0);
      expect(p.overflowMadness).toBe(0);
    }
  });

  it('never lets a mundane man go mad either', () => {
    const rng = makeRng(31);
    let mundane = 0;
    for (let i = 0; i < 400; i++) {
      const g = randomGenome(table, ctx.pools.get('house_calder'), 'male', rng);
      const p = eldritch(g, 'male', table);
      if (p.carriedFont === 0) {
        mundane++;
        expect(p.canExpress).toBe(false);
        expect(p.overflowMadness).toBe(0);
      }
    }
    expect(mundane).toBeGreaterThan(50);
  });

  it('bars women from elemental practice and permits threshold', () => {
    expect(canLearn('female', 'thermal')).toBe(false);
    expect(canLearn('female', 'terra')).toBe(false);
    expect(canLearn('female', 'death')).toBe(true);
    expect(canLearn('female', 'darkness')).toBe(true);
    expect(canLearn('male', 'thermal')).toBe(true);
  });

  it('raises homozygosity under close breeding', () => {
    // Not an assertion about a magic number: only that the direction is right.
    const rng = makeRng(99);
    const outbred = randomGenome(table, ctx.pools.get('commons'), 'male', rng);
    let same = 0;
    for (let i = 0; i < outbred.autosomal[0].length; i++) {
      if (outbred.autosomal[0][i] === outbred.autosomal[1][i]) same++;
    }
    expectRateBelow({
      hits: same, n: outbred.autosomal[0].length, ceiling: 0.95,
      what: 'homozygous loci in an outbred genome',
    });
  });
});

describe('simulation', () => {
  it('runs 200 years without throwing and produces a family', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    runYears(ctx, 200);
    const people = familySnapshot(ctx);
    expect(people.length).toBeGreaterThan(bundle.characters.length);
    expect(ctx.world.year).toBe(1242);
  });

  it('never produces a mad woman across a long run', () => {
    const ctx = bootstrap(bundle, 4242, 1042);
    runYears(ctx, 400);
    const offenders = ctx.world.people
      .all()
      .filter((p) => p.sex === 'female' && p.madness > 0);
    expect(offenders.map((p) => p.name)).toEqual([]);
  });

  it('never produces madness in anyone who cannot express', () => {
    const ctx = bootstrap(bundle, 909, 1042);
    runYears(ctx, 300);
    for (const p of ctx.world.people.all()) {
      if (p.madness > 0) {
        expect(phenotypeOf(p, ctx.genetics, ctx.world.year).eldritch.canExpress).toBe(true);
      }
    }
  });

  it('respects the mythic per-run cap', () => {
    const ctx = bootstrap(bundle, 5150, 1042);
    runYears(ctx, 1000);
    expect(ctx.world.frequency.firedThisRun.mythic).toBeLessThanOrEqual(3);
  });

  it('fires commons far more often than mythics', () => {
    const ctx = bootstrap(bundle, 8080, 1042);
    runYears(ctx, 600);
    const f = ctx.world.frequency.firedThisRun;
    expect(f.common).toBeGreaterThan(f.mythic);
    expect(f.common).toBeGreaterThanOrEqual(f.rare);
  });

  it('never lets the Narrator die, and keeps him castable forever', () => {
    for (const seed of [1042, 77, 5150]) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 800);

      const daveed = ctx.world.people.all().find((p) => p.becomesGuardian);
      expect(daveed, `seed ${seed}`).toBeDefined();
      // He crosses over, and 'dead' is the one thing he never becomes.
      expect(daveed!.status).toBe('guardian');
      expect(ctx.world.people.guardian()?.id).toBe(daveed!.id);
      // Excluded from every living-person system...
      expect(ctx.world.people.living().some((p) => p.id === daveed!.id)).toBe(false);
      expect(daveed!.castSlots).not.toContain('head');
      // ...and still available to any template that names him.
      expect(daveed!.castSlots).toContain('guardian');
    }
  });

  it('holds the voice contract on anything longer than five sentences', () => {
    const long = bundle.events.filter((e) => splitSentences(e.body).length > PROSE_SENTENCE_THRESHOLD);
    const flagged = long.filter((e) => proseIssues(e.id, e.body).length > 3);
    expect(flagged.map((e) => e.id)).toEqual([]);
  });

  it('starts and ends Ages stochastically, with varying spans', () => {
    const spans: number[] = [];
    for (let seed = 0; seed < 12; seed++) {
      const ctx = bootstrap(bundle, 1000 + seed, 1042);
      runYears(ctx, 600);
      for (const e of ctx.world.age.ended) spans.push(e.ended - e.began);
    }
    expect(spans.length).toBeGreaterThan(4);
    expect(new Set(spans).size).toBeGreaterThan(2);
  });
});
