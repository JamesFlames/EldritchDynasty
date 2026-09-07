import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import type { Filter } from '@ed/schema';
import { evalFilter, place, testWorld } from '@ed/core';

const bundle = loadContent();

/**
 * ── EVERY FILTER PREDICATE, ASKED A QUESTION IT MUST ANSWER BOTH WAYS ──────
 *
 * `docs/TEST-COVERAGE.md` records this exact survey for CONDITIONS: nine of
 * twenty-five predicates had never been evaluated by a test or by a line of
 * content, and `conditions.test.ts` now asks each of them a question it must
 * answer TRUE and one it must answer FALSE, because "a predicate stuck on
 * `true` gates nothing, and content gated on nothing fires in every run
 * forever".
 *
 * FILTERS ARE THE OTHER HALF OF THAT CHAIN and nobody had done it for them.
 * Conditions gate whether an event fires; filters gate WHO it can be cast on
 * — `sex`, `age`, `status`, `membership`, `career`, `trait`. A filter stuck
 * on `true` does not stop the event; it casts the wrong person into it.
 *
 * This file exists because the mutation probe found it. Inverting the sex
 * filter — `p.sex === f.sex` to `!==`, one character — survived the entire
 * fast lane. A filter that selects the opposite sex would cast daughters into
 * every role written for a son, and 1,653 tests had nothing to say about it.
 *
 * The predicates are still asked one at a time, in the style
 * `conditions.test.ts` established, rather than through a played run: a run
 * exercises whichever filters its content happens to reach, which is how this
 * gap survived in the first place.
 */
function house() {
  const ctx = testWorld(bundle);
  const man = place(ctx, { sex: 'male', age: 40, name: 'A Man' });
  const woman = place(ctx, { sex: 'female', age: 22, name: 'A Woman' });
  return { ctx, man, woman };
}

describe('the filter predicates answer both ways', () => {
  it('sex — the one the mutation probe caught', () => {
    const { ctx, man, woman } = house();
    const male: Filter = { sex: 'male' };
    const female: Filter = { sex: 'female' };

    expect(evalFilter(male, man, ctx, {})).toBe(true);
    expect(evalFilter(male, woman, ctx, {})).toBe(false);
    expect(evalFilter(female, woman, ctx, {})).toBe(true);
    expect(evalFilter(female, man, ctx, {})).toBe(false);
  });

  it('age — a band, at both edges', () => {
    const { ctx, man, woman } = house();
    const grown: Filter = { age: { op: 'gte', value: 30 } };
    expect(evalFilter(grown, man, ctx, {})).toBe(true);
    expect(evalFilter(grown, woman, ctx, {})).toBe(false);
  });

  it('status — the living and the rest', () => {
    const { ctx, man, woman } = house();
    const alive: Filter = { status: ['alive'] };
    expect(evalFilter(alive, man, ctx, {})).toBe(true);

    ctx.world.people.kill(woman.id, ctx.world.year, 'a test');
    expect(evalFilter(alive, woman, ctx, {})).toBe(false);
  });

  it('membership — and it means the OPEN record, not any record', () => {
    const { ctx, man } = house();
    const blood: Filter = { membership: ['blood'] };
    expect(evalFilter(blood, man, ctx, {})).toBe(true);

    // Close it. He was of the house; he is not now, and a filter that reads
    // the record without reading its end would still say yes.
    for (const m of man.membership) m.to = ctx.world.year;
    expect(
      evalFilter(blood, man, ctx, {}),
      'a closed membership record still matched — the filter is not reading `to`',
    ).toBe(false);
  });

  it('tag — a cast role somebody holds', () => {
    const { ctx, man, woman } = house();
    const head: Filter = { tag: 'head', has: true };
    man.castSlots.push('head');
    expect(evalFilter(head, man, ctx, {})).toBe(true);
    expect(evalFilter(head, woman, ctx, {})).toBe(false);
  });

  it('trait — carried and not', () => {
    const { ctx, man, woman } = house();
    const trait = [...bundle.traits][0]?.id;
    if (!trait) throw new Error('no traits in the content to filter on');
    const carries: Filter = { trait, has: true };

    man.traits.add(trait as never);
    expect(evalFilter(carries, man, ctx, {})).toBe(true);
    expect(evalFilter(carries, woman, ctx, {})).toBe(false);
  });

  /**
   * Issue #126: `taught` reads a DURABLE mark set only where a tutor's term
   * completed, never `acquired` — a child boosted by an ordinary event effect
   * must not read as schooled.
   */
  it('taught — a durable mark, not a proxy for a raised attribute', () => {
    const { ctx, man, woman } = house();
    expect(evalFilter({ taught: {} }, man, ctx, {})).toBe(false);

    man.acquired.mind = (man.acquired.mind ?? 0) + 50;
    expect(evalFilter({ taught: {} }, man, ctx, {}), 'an ordinary attribute gain is not a term').toBe(false);

    man.taught.push('mind');
    expect(evalFilter({ taught: {} }, man, ctx, {})).toBe(true);
    expect(evalFilter({ taught: { attr: 'mind' } }, man, ctx, {})).toBe(true);
    expect(evalFilter({ taught: { attr: 'charm' } }, man, ctx, {})).toBe(false);
    expect(evalFilter({ taught: {} }, woman, ctx, {})).toBe(false);
  });

  /**
   * Issue #128: `inTerm` reads `world.tutoring` directly — mid-term, as
   * against `taught`'s "has ever completed one". A person can be neither,
   * either, or (once the term ends) `taught` without still being `inTerm`.
   */
  it('inTerm — mid-term right now, not the same question as taught', () => {
    const { ctx, man } = house();
    expect(evalFilter({ inTerm: true }, man, ctx, {})).toBe(false);
    expect(evalFilter({ inTerm: false }, man, ctx, {})).toBe(true);

    ctx.world.tutoring.push({ person: man.id, attr: 'mind', completes: ctx.world.year + 8 });
    expect(evalFilter({ inTerm: true }, man, ctx, {})).toBe(true);
    expect(evalFilter({ taught: {} }, man, ctx, {}), 'starting a term is not the same as finishing one').toBe(false);
  });

  /**
   * The combinators, because `not` inverting nothing is the same bug one
   * level up: it would make every negated filter pass.
   */
  it('all, any and not combine what they are given', () => {
    const { ctx, man, woman } = house();
    const male: Filter = { sex: 'male' };
    const grown: Filter = { age: { op: 'gte', value: 30 } };

    expect(evalFilter({ all: [male, grown] }, man, ctx, {})).toBe(true);
    expect(evalFilter({ all: [male, grown] }, woman, ctx, {})).toBe(false);
    expect(evalFilter({ any: [male, grown] }, woman, ctx, {})).toBe(false);
    expect(evalFilter({ any: [{ sex: 'female' }, grown] }, woman, ctx, {})).toBe(true);
    expect(evalFilter({ not: male }, woman, ctx, {})).toBe(true);
    expect(evalFilter({ not: male }, man, ctx, {})).toBe(false);
  });
});
