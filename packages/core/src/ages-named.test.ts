import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { loadGame, makeRng, saveGame, testWorld, tickAges } from '@ed/core';
import type { SimCtx } from '@ed/core';

const bundle = loadContent();

/**
 * AN ENDED AGE REMEMBERS WHETHER IT WAS EVER NAMED (issue #81).
 *
 * §20's first rule: an Age is named only where the chronicle has named it, and
 * *"the family finds out what these years were afterwards, like everyone
 * else."* `ActiveAge` carried the flag; `ended` did not. Over a thousand years
 * nearly every Age is a finished one, so any screen drawing them could name
 * all of them or none — and naming all of them is §20's rule inverted, on the
 * one screen whose whole job is showing what the house actually wrote down.
 *
 * The failure mode if it were done carelessly is this repository's usual one:
 * it would look completely correct. Every Age with a name, every rule at a
 * real boundary, and the game telling the player things the family never knew.
 *
 * BOTH DIRECTIONS ARE ASSERTED, and the unnamed one takes finding. Every Age
 * in the content today has `namedAfterYears <= duration.minYears`, so an Age
 * that runs its minimum has already been named. The gap is that terminations
 * roll BEFORE namings within a tick (`scheduler.ts`), so an Age can close on
 * the very year it would have got a word — which is what `the_plague` does at
 * seed 1, and it is the only path by which a finished Age is anonymous.
 * Without that case a field hard-coded to `true` passes everything here.
 */
function withAge(id: string, named: boolean, seed: number): { ctx: SimCtx; age: string } {
  const ctx = testWorld(bundle, seed, 1042);
  const def = ctx.content.ages.find((d) => d.id === id)!;
  ctx.world.age.active = [{
    // Already eligible to end, so the hazard gets a roll on the first tick.
    age: def.id,
    began: ctx.world.year - def.duration.minYears,
    named,
    ...(named ? { namedAt: ctx.world.year - 1 } : {}),
    paid: { standing: false },
  }];
  return { ctx, age: def.id };
}

/**
 * Turn years until the hazard closes ours. It is a hazard process, not a
 * length — and `tickAges` starts other Ages while it runs, any of which can
 * begin and end inside the window, so the record is found by ID rather than
 * taken off the front of the list.
 */
function runOut(ctx: SimCtx, age: string, seed: number) {
  for (let i = 0; i < 40; i += 1) {
    if (!ctx.world.age.active.some((a) => a.age === age)) break;
    ctx.world.year += 1;
    tickAges(ctx, makeRng(ctx.world.year * 31 + seed));
  }
  return ctx.world.age.ended.find((e) => e.age === age);
}

describe('a finished Age remembers whether it was named', () => {
  it('carries named and namedAt out of active when it closes', () => {
    const { ctx, age } = withAge('the_withering', true, 1);
    const namedAt = ctx.world.age.active[0]!.namedAt;
    const done = runOut(ctx, age, 1);

    expect(done, 'the Age never closed, so this asserts nothing').toBeDefined();
    expect(done!.named).toBe(true);
    expect(done!.namedAt).toBe(namedAt);
  });

  it('records an Age that closed before it was named as unnamed', () => {
    const { ctx, age } = withAge('the_plague', false, 1);
    const done = runOut(ctx, age, 1);

    expect(done, 'the Age never closed, so this asserts nothing').toBeDefined();
    // It ran its four years and went. Nobody had a word for it, and the book
    // must not supply one afterwards.
    expect(done!.named).toBe(false);
    expect(done!.namedAt).toBeUndefined();
  });

  /**
   * The round trip is where a field of this shape actually goes missing. Per
   * CLAUDE.md, skipping the save format does not fail — it makes the field
   * reset silently on load, which would look exactly like a house whose older
   * Ages were all anonymous.
   */
  it('survives a save and a load', () => {
    const { ctx, age } = withAge('the_withering', true, 1);
    const before = runOut(ctx, age, 1);
    expect(before).toBeDefined();

    const back = loadGame(saveGame(ctx), bundle);

    expect(back.world.age.ended.find((e) => e.age === age)).toEqual(before);
  });

  /**
   * A save written before the field existed. The safe reading is UNNAMED: it
   * withholds a name rather than inventing one, which is the only migration
   * §20 permits.
   */
  it('reads an older save\'s ended Ages as unnamed rather than guessing', () => {
    const { ctx, age } = withAge('the_withering', true, 1);
    expect(runOut(ctx, age, 1)).toBeDefined();

    const saved = JSON.parse(JSON.stringify(saveGame(ctx)));
    for (const e of saved.age.ended) {
      delete e.named;
      delete e.namedAt;
    }

    const back = loadGame(saved, bundle);
    const done = back.world.age.ended.find((e) => e.age === age)!;
    expect(done.named).toBe(false);
    expect(done.namedAt).toBeUndefined();
  });
});
