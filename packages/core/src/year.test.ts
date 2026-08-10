import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import {
  YEAR_PHASES, bootstrap, digestOf, marry, phase, place, runYears, stepYear, testWorld,
} from '@ed/core';

const content = loadContent();

/**
 * THE SHAPE OF A YEAR.
 *
 * The ordering constraints in `phases.ts` were discovered the hard way — a son
 * leaves the year his brother takes the seal, a bride joins the hall the split
 * has just decided, an arc casts from the living after the year's dead are
 * settled — and they used to exist only as comments beside the call that had to
 * come second. Now they are declared, and these tests hold the declaration and
 * the table to each other.
 */
describe('the year is a declared pipeline', () => {
  it('names something real in every `after`, and comes after it', () => {
    const seen: string[] = [];
    for (const p of YEAR_PHASES) {
      for (const dep of p.after) {
        expect(YEAR_PHASES.some((q) => q.name === dep), `${p.name} follows '${dep}', which is not a phase`)
          .toBe(true);
        expect(seen, `${p.name} claims to follow ${dep} and runs before it`).toContain(dep);
      }
      seen.push(p.name);
    }
  });

  it('says why each phase sits where it does', () => {
    for (const p of YEAR_PHASES) {
      expect(p.why.length, `${p.name} has no note saying why it is there`).toBeGreaterThan(30);
      expect(new Set(YEAR_PHASES.map((q) => q.name)).size).toBe(YEAR_PHASES.length);
    }
  });

  /**
   * The reason the streams were split. A phase's dice must depend on the seed,
   * the year and its own name — and on nothing that happened earlier in the
   * year — or no phase can ever be edited without moving every phase after it.
   */
  it('gives each phase dice that do not depend on the phases before it', () => {
    const a = bootstrap(content, 4242, 1042);
    const b = bootstrap(content, 4242, 1042);

    // Burn draws in `b` from a system outside the year pipeline entirely.
    for (let i = 0; i < 50; i++) bootstrap(content, 9000 + i, 1042);

    runYears(a, 120);
    runYears(b, 120);
    expect(digestOf(b)).toBe(digestOf(a));
  });
});

describe('a phase can be run on its own', () => {
  it('marries the people you put in front of it', () => {
    // The marriage phase acts on years divisible by three. Starting the world
    // on one is the sort of thing a test gets to decide now that a phase can be
    // called on its own.
    const ctx = testWorld(content, 7, 1044);
    const before = ctx.world.people.living().filter((p) => p.marriages.some((m) => !m.to)).length;
    place(ctx, { sex: 'male', age: 24, name: 'Testman' });
    place(ctx, { sex: 'female', age: 22, name: 'Testwoman' });

    phase('marriage', ctx);
    const after = ctx.world.people.living().filter((p) => p.marriages.some((m) => !m.to)).length;
    expect(after, 'the marriage phase paired nobody at all').toBeGreaterThan(before);
  });

  it('buries the people it should, and never the Narrator', () => {
    const ctx = testWorld(content, 11, 1042);
    const narrator = ctx.world.people.get(ctx.world.narrator!)!;

    // Old enough that the hazard curve is a certainty within a few years.
    const doomed = place(ctx, { sex: 'male', age: 200, name: 'Methuselah' });
    phase('lifecycle', ctx);

    expect(doomed.status, 'a man past his ceiling outlived it').toBe('dead');
    expect(narrator.status, 'the Narrator was allowed to die').not.toBe('dead');
  });

  it('does not turn the year', () => {
    const ctx = testWorld(content, 3, 1042);
    phase('economy', ctx);
    phase('lifecycle', ctx);
    expect(ctx.world.year).toBe(1042);
  });
});

describe('the scaffolding builds the state it claims to', () => {
  it('places the same person every time', () => {
    const one = testWorld(content, 5, 1042);
    const two = testWorld(content, 5, 1042);
    const a = place(one, { sex: 'female', age: 30, name: 'Same' });
    const b = place(two, { sex: 'female', age: 30, name: 'Same' });
    expect(a.id).toBe(b.id);
    expect(a.sigilSeed).toBe(b.sigilSeed);
  });

  it('marries on both sides, so widowing works', () => {
    const ctx = testWorld(content, 5, 1042);
    const husband = place(ctx, { sex: 'male', age: 40, name: 'He' });
    const wife = place(ctx, { sex: 'female', age: 38, name: 'She' });
    marry(ctx, husband, wife);

    ctx.world.people.kill(husband.id, ctx.world.year, 'a test');
    expect(wife.marriages.every((m) => m.to !== undefined), 'a widow still married to a dead man').toBe(true);
  });

  it('leaves the docket alone when nothing is asked', () => {
    const ctx = testWorld(content, 5, 1042);
    expect(stepYear(ctx).blocked).toBeUndefined();
  });
});
