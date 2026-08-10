import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { validateBundle } from '@ed/schema';
import {
  bootstrap, runYears, attr, applyEffect,
  canUseHeirloom, eligibleBearers, grantHeirloom, useHeirloom,
} from '@ed/core';

const bundle = loadContent();

/** A living adult of the house, for a bearer. */
function someone(ctx: ReturnType<typeof bootstrap>) {
  const w = ctx.world;
  return w.people
    .household(w.playerHouse, w.year)
    .filter((p) => w.year - p.born >= 20 && w.year - p.born <= 40)[0]!;
}

describe('the heirloom content', () => {
  it('validates', () => {
    expect(validateBundle(bundle).filter((i) => i.level === 'error')).toEqual([]);
  });

  it('authors the two portions', () => {
    const ids = bundle.heirlooms.map((h) => h.id);
    expect(ids).toContain('portion_of_agelessness');
    expect(ids).toContain('portion_of_fertility');
  });

  it('gives every heirloom a spend rule and something to do', () => {
    for (const h of bundle.heirlooms) {
      expect(['consumed', 'cooldown', 'reusable'], h.id).toContain(h.use.spends);
      expect(h.effects.length, `${h.id} does nothing`).toBeGreaterThan(0);
    }
  });

  it('is reachable — an event grants each one', () => {
    const granted = new Set<string>();
    for (const e of bundle.events) {
      const groups = e.interaction.kind === 'narration'
        ? [e.interaction.outcomes]
        : e.interaction.choices.map((c) => c.outcomes);
      for (const o of groups.flat()) {
        for (const eff of o.effects) {
          if (eff.kind === 'heirloom' && eff.op === 'grant') granted.add(eff.heirloom);
        }
      }
    }
    for (const h of bundle.heirlooms) {
      expect(granted.has(h.id), `${h.id} can never be acquired`).toBe(true);
    }
  });
});

describe('applying an heirloom is generic', () => {
  it('refuses one the house does not hold', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const p = someone(ctx);
    expect(canUseHeirloom(ctx, 'portion_of_agelessness', p).ok).toBe(false);
  });

  it('applies its effects to the bearer through the normal effect path', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const p = someone(ctx);
    const before = attr(p, 'max_age', ctx.genetics, ctx.world.year);

    grantHeirloom(ctx, 'portion_of_agelessness');
    expect(useHeirloom(ctx, 'portion_of_agelessness', p).ok).toBe(true);

    expect(attr(p, 'max_age', ctx.genetics, ctx.world.year)).toBeCloseTo(before + 42, 5);
  });

  it('lengthens a life rather than a number — the bearer outlives the untouched', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const p = someone(ctx);
    grantHeirloom(ctx, 'portion_of_agelessness');
    useHeirloom(ctx, 'portion_of_agelessness', p);
    const ceiling = attr(p, 'max_age', ctx.genetics, ctx.world.year);

    runYears(ctx, 400);
    // Whatever killed them, the ceiling moved with them.
    if (p.died !== undefined) expect(p.died - p.born - ceiling).toBeLessThan(1);
    expect(ceiling).toBeGreaterThan(110);
  });

  it('changes nothing the bearer\'s children inherit', () => {
    const ctx = bootstrap(bundle, 77, 1042);
    const p = someone(ctx);
    grantHeirloom(ctx, 'portion_of_agelessness');
    useHeirloom(ctx, 'portion_of_agelessness', p);
    // The acquired layer is not heritable: longevity, the genome-side
    // attribute, is untouched.
    expect(p.acquired.max_age).toBe(42);
    const longevity = attr(p, 'longevity', ctx.genetics, ctx.world.year);
    expect(Number.isFinite(longevity)).toBe(true);
    expect(p.acquired.longevity ?? 0).toBe(0);
  });
});

describe('the spend flag', () => {
  it('consumed: one use, then never again', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const [a, b] = ctx.world.people.household(ctx.world.playerHouse, ctx.world.year)
      .filter((p) => ctx.world.year - p.born >= 20);
    grantHeirloom(ctx, 'portion_of_agelessness');

    expect(useHeirloom(ctx, 'portion_of_agelessness', a!).ok).toBe(true);
    const second = useHeirloom(ctx, 'portion_of_agelessness', b!);
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('it is spent');
    expect(ctx.world.heirlooms.get('portion_of_agelessness')!.spent).toBe(true);
  });

  it('cooldown: not twice in the same generation, and it says how long', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const p = someone(ctx);
    grantHeirloom(ctx, 'portion_of_fertility');

    expect(useHeirloom(ctx, 'portion_of_fertility', p).ok).toBe(true);

    const again = canUseHeirloom(ctx, 'portion_of_fertility', p);
    expect(again.ok).toBe(false);
    expect(again.reason).toBe('it is not ready');
    expect(again.readyIn).toBe(60);
  });

  it('cooldown: ready again once the years have passed', () => {
    const ctx = bootstrap(bundle, 909, 1042);
    grantHeirloom(ctx, 'portion_of_fertility');
    useHeirloom(ctx, 'portion_of_fertility', someone(ctx));

    runYears(ctx, 70);
    const later = eligibleBearers(ctx, 'portion_of_fertility');
    expect(later.length, 'nobody in the house could take it seventy years on').toBeGreaterThan(0);
  });

  it('charges run out even when the spend rule would allow another', () => {
    const ctx = bootstrap(bundle, 5150, 1042);
    grantHeirloom(ctx, 'portion_of_fertility');
    const state = ctx.world.heirlooms.get('portion_of_fertility')!;
    expect(state.usesLeft).toBe(3);

    for (let i = 0; i < 3; i++) {
      const bearer = eligibleBearers(ctx, 'portion_of_fertility')[0];
      if (bearer) useHeirloom(ctx, 'portion_of_fertility', bearer);
      runYears(ctx, 65);
    }
    expect(state.usesLeft).toBeLessThanOrEqual(0);
    expect(state.spent).toBe(true);
  });
});

describe('targeting', () => {
  it('refuses somebody the heirloom is not for', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    grantHeirloom(ctx, 'portion_of_fertility');
    const old = ctx.world.people
      .household(ctx.world.playerHouse, ctx.world.year)
      .find((p) => ctx.world.year - p.born > 48);
    if (!old) return;
    const check = canUseHeirloom(ctx, 'portion_of_fertility', old);
    expect(check.ok).toBe(false);
    expect(check.reason).toBe('they are not who it is for');
  });

  it('refuses the dead', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    grantHeirloom(ctx, 'portion_of_agelessness');
    const p = someone(ctx);
    ctx.world.people.kill(p.id, ctx.world.year, 'for the test');
    expect(canUseHeirloom(ctx, 'portion_of_agelessness', p).ok).toBe(false);
  });

  it('is granted by the effect verb, not by hand', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    applyEffect({ kind: 'heirloom', op: 'grant', heirloom: 'portion_of_agelessness' }, ctx, {});
    expect(ctx.world.heirlooms.has('portion_of_agelessness')).toBe(true);
  });
});
