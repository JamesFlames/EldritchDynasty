import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { applyEffect, bootstrap, phenotypeOf, place, runYears, testWorld } from '@ed/core';

const bundle = loadContent();
const SEEDS = [1042, 77, 909, 5150, 8080, 31];

/**
 * THE EXPRESSION GATE (issue #2, phase 0).
 *
 * `harness.ts` computed `madWomen` and `madIncapable` and printed them with
 * "(both must be 0)" — a claim nobody enforced. Three later phases (checks,
 * careers, the Library) each add a new path by which Madness can move, and
 * this has to be a gate before them or it is documenting a regression rather
 * than preventing one.
 *
 * `canExpress` is computed in exactly one place — `eldritch()` in
 * `genetics/expression.ts` — and is capability, not sex: male AND nonzero
 * X-linked font. There is deliberately no `if (female) madness = 0` clamp
 * anywhere, so this is the only thing that would catch a new Madness source
 * written without the gate.
 */
describe('the expression gate holds over full runs', () => {
  it('no incapable character ever holds Madness or expressed Power', () => {
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 1000);
      const w = ctx.world;

      for (const p of w.people.all()) {
        const ph = phenotypeOf(p, ctx.genetics, w.year);
        if (ph.eldritch.canExpress) continue;

        expect(p.madness, `seed ${seed}, person ${p.id} (${p.sex}, incapable) carries Madness`).toBe(0);
        expect(
          ph.eldritch.expressedPower,
          `seed ${seed}, person ${p.id} (${p.sex}, incapable) has expressed Power`,
        ).toBe(0);
      }
    }
  });

  /**
   * The full-run assertion above holds today because every authored `madness`
   * effect targets a slot already filtered to `canExpress: true` — enforced
   * separately, at content-authoring time, by `madness/gate` in
   * `schema/src/rules.ts`. That means a full random run cannot exercise the
   * RUNTIME half of the gate, in `applyEffect`'s `madness` case, without a
   * second bug in content validation to let it through.
   *
   * This calls `applyEffect` directly, the way a slot-cast event does
   * internally, bypassing content validation entirely — so it is this test,
   * not the one above, that fails if the `canExpress` check named in the
   * issue is removed from `effects.ts`.
   */
  it('applyEffect refuses madness on an incapable target even off authored content', () => {
    const ctx = testWorld(bundle, 1042, 1042);
    const woman = place(ctx, { sex: 'female', age: 30 });
    const mundaneSon = place(ctx, { sex: 'male', age: 20, name: 'MundaneSonTest' });

    applyEffect({ kind: 'madness', target: { slot: 'TARGET' }, delta: 40 }, ctx, { TARGET: woman.id });
    expect(woman.madness).toBe(0);

    if (!phenotypeOf(mundaneSon, ctx.genetics, ctx.world.year).eldritch.canExpress) {
      applyEffect({ kind: 'madness', target: { slot: 'TARGET' }, delta: 40 }, ctx, { TARGET: mundaneSon.id });
      expect(mundaneSon.madness).toBe(0);
    }
  });
});
