import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { asId } from '@ed/schema';
import { CAST_MAX, castOf } from './cast.js';
import { marry, place, testWorld } from './testing.js';
import type { SimCtx } from './world.js';

const bundle = loadContent();

/**
 * WHO THIS GENERATION IS ABOUT (issue #44).
 *
 * The failure this guards is not a crash. It is a list that quietly names the
 * same man four times, or names nobody, or names a person who died in 1310 —
 * all of which look like a working panel from outside, which is this
 * codebase's whole failure mode.
 */
describe('the cast of a generation', () => {
  /** A house with somebody for every role to find. */
  function aFamily(): SimCtx {
    const ctx = testWorld(bundle, 8801);
    const w = ctx.world;

    const head = place(ctx, { sex: 'male', age: 44, name: 'Head', castSlots: ['head'] });
    w.headSince = w.year - 12;
    const son = place(ctx, { sex: 'male', age: 22, name: 'Son' });
    const daughter = place(ctx, { sex: 'female', age: 17, name: 'Daughter' });
    const wife = place(ctx, { sex: 'female', age: 40, name: 'Wife', house: 'house_marrow' });
    // She lives here now: a wife of another house keeps her origin and joins
    // the household, which is exactly why she is easy to stop seeing.
    wife.membership.push({ house: asId(w.playerHouse), kind: 'married_in', from: w.year - 20 });
    marry(ctx, head, wife);

    const cousin = place(ctx, { sex: 'male', age: 38, name: 'Cousin', branch: 'branch_ash' });
    w.branches.set('branch_ash', {
      id: 'branch_ash',
      name: 'Ashfold',
      house: w.playerHouse,
      founder: cousin.id,
      splitFrom: 'main',
      foundedYear: w.year - 60,
      grievance: 41,
    } as never);

    void son;
    void daughter;
    return ctx;
  }

  it('names five to seven people, never seventy', () => {
    const cast = castOf(aFamily());
    expect(cast.length).toBeGreaterThanOrEqual(3);
    expect(cast.length).toBeLessThanOrEqual(CAST_MAX);
  });

  it('names each person once, however many roles they answer to', () => {
    const cast = castOf(aFamily());
    const ids = cast.map((c) => c.person);
    expect(new Set(ids).size, ids.join(',')).toBe(ids.length);
  });

  it('gives every one of them a reason that is only true of them', () => {
    const cast = castOf(aFamily());
    for (const c of cast) {
      expect(c.because.length, `${c.role} has nothing to say`).toBeGreaterThan(12);
    }
    // The reasons are facts about people, not a role label wearing a sentence.
    expect(new Set(cast.map((c) => c.because)).size).toBe(cast.length);
  });

  it('finds the hall with the wound, and who speaks for it', () => {
    const cast = castOf(aFamily());
    const wound = cast.find((c) => c.role === 'aggrieved');
    expect(wound, cast.map((c) => c.role).join(',')).toBeTruthy();
    expect(wound!.hall).toBe('Ashfold');
    expect(wound!.because).toMatch(/Ashfold/);
  });

  it('finds a woman who came in from another house', () => {
    const ctx = aFamily();
    const cast = castOf(ctx);
    const outsider = cast.find((c) => c.role === 'married_in');
    expect(outsider, cast.map((c) => c.role).join(',')).toBeTruthy();
    const her = ctx.world.people.get(outsider!.person)!;
    expect(her.houseOfOrigin).not.toBe(ctx.world.playerHouse);
    expect(outsider!.because).toMatch(/married in from/);
  });

  it('only ever names the living of this house', () => {
    const ctx = aFamily();
    const living = new Set<string>(
      ctx.world.people.household(ctx.world.playerHouse, ctx.world.year).map((p) => String(p.id)),
    );
    for (const c of castOf(ctx)) expect(living.has(c.person), `${c.name} is not in the house`).toBe(true);
  });

  /**
   * INVARIANT 6. A cast written into the world would be right for one spring
   * and wrong for four hundred years, and would look exactly like a panel that
   * stopped updating. So: reading it changes nothing, and reading it after the
   * world moves says something else.
   */
  it('is a reading and not storage', () => {
    const ctx = aFamily();
    const w = ctx.world;
    /**
     * What a reading is allowed to change is nothing anybody decided. A lazy
     * genome materialising is not an exception to that — it is the same genome
     * the seed always described, written out because somebody finally looked —
     * and it is why this compares the state the SIMULATION owns rather than
     * the save's bytes.
     *
     * The bug this caught on the way in: asking which hall carried the wound
     * ELECTED a speaker in every branch that did not have one, because
     * `speakerOf` records its answer. `wouldSpeakFor` is the reading now.
     */
    const state = () => JSON.stringify({
      speakers: [...w.branches.values()].map((b) => [b.id, b.speaker]),
      seats: w.people.all().map((p) => [p.id, p.castSlots.join('|'), p.status]),
      headSince: w.headSince,
      chronicle: w.chronicle.length,
      studies: w.studies.length,
      year: w.year,
    });

    const before = state();
    const first = castOf(ctx);
    expect(state(), 'reading the cast changed the world').toBe(before);
    expect(castOf(ctx)).toEqual(first);

    const head = ctx.world.people.household(ctx.world.playerHouse, ctx.world.year)
      .find((p) => p.castSlots.includes('head'))!;
    ctx.world.people.kill(head.id, ctx.world.year, 'age');
    const after = castOf(ctx);
    expect(after.some((c) => c.person === head.id), 'a dead man is still on the list').toBe(false);
  });

  it('says out loud what the daughter is carrying, when one of them is', () => {
    const ctx = aFamily();
    const her = castOf(ctx).find((c) => c.role === 'carrier');
    // Whether this seed's daughters carry anything is genetics; what is being
    // asserted is that when one does, the list says what she is carrying
    // rather than listing her as a row in a marriage table (#24 item 3).
    if (her) {
      expect(her.sex).toBe('female');
      expect(her.because).toMatch(/carries/);
    }
  });
});
