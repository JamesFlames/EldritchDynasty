import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import type { Rung } from '@ed/schema';
import {
  RUNGS, eldritchPower, maxExpressiblePower, newGame, place, rungIndex, rungTitle,
  standingOf, testWorld,
} from '@ed/core';

const bundle = loadContent();

/**
 * THE ASCENSION LADDER (concept §22) — six rungs that were not in the code.
 *
 * Grepping `core` for a tier, a rung or a gate returned comments and test
 * fixtures. The player's only answer to "am I winning?" was a Respect tier
 * that landed on exalted anyway and a clause count that filled itself.
 */
describe('the ladder is a ladder', () => {
  it('runs from the ground to God, in order, with no gaps', () => {
    expect(RUNGS[0]).toBe('none');
    expect(RUNGS[RUNGS.length - 1]).toBe('god');
    expect(RUNGS.length).toBe(7);
    for (const r of RUNGS) expect(rungTitle(r).length).toBeGreaterThan(2);
    expect(rungIndex('demigod')).toBeGreaterThan(rungIndex('hierophant'));
  });

  it('never puts anyone who cannot express on it, at any rung', () => {
    // INVARIANT 1. Capability is the only gate, and it is not sex — a mundane
    // son is exactly as barred as any woman, and for the same reason.
    const ctx = testWorld(bundle, 8080);
    for (const p of ctx.world.people.all()) {
      if (standingOf(ctx, p).rung === 'none') continue;
      expect(p.sex, `${p.name} stands on the ladder`).toBe('male');
    }
  });

  it('says what is in the way, not merely that something is', () => {
    const ctx = testWorld(bundle, 8081);
    const boy = place(ctx, { sex: 'male', age: 20 });
    const standing = standingOf(ctx, boy);
    if (standing.rung !== 'god') {
      expect(standing.blocked, 'a rung was refused without a reason').toBeTruthy();
      expect(standing.blocked!.length).toBeGreaterThan(8);
    }
  });
});

/**
 * THE SCALE. §22's gates are written 10 / 25 / 50 / 70 / 85 / 98, and the
 * genetics produce a raw quantity that tops out around 22 in practice against
 * an arithmetic ceiling of 66. Two normalisations were wrong before this one:
 * the raw scale (rung 2 of 6 unreachable in principle) and the arithmetic
 * ceiling (rung 2 a coin flip, rungs 3-6 unreachable).
 */
describe('eldritch power, on the scale the gates are written in', () => {
  it('is derived from the locus table, not hardcoded', () => {
    const ctx = testWorld(bundle, 8082);
    expect(maxExpressiblePower(ctx)).toBeGreaterThan(0);
  });

  it('gives an ordinary expresser a real distance still to climb', () => {
    const ctx = testWorld(bundle, 8083);
    const expressers = ctx.world.people.all()
      .filter((p) => eldritchPower(ctx, p) > 0);
    expect(expressers.length, 'the founding cast has nobody who can express').toBeGreaterThan(0);
    for (const p of expressers) {
      // Nobody starts at the top, and nobody is at zero who can express at all.
      expect(eldritchPower(ctx, p)).toBeLessThan(100);
    }
  });
});

describe('where the ladder actually lands, across a run', () => {
  it('gets a house past Touched, and does not hand it the top', () => {
    // A BATCH, not three seeds. Adept lands in about two chronicler runs in
    // five, and the first cut of this test sampled three of them and reported
    // the sample — which is the mistake `record.slow.test.ts` has now made
    // three times and `CLAUDE.md` names twice ("never pin a test to one seed
    // reaching one state").
    const content = loadContent();
    const reached: Rung[] = [];
    for (let s = 0; s < 12; s += 1) {
      const g = newGame(content, { seed: 3000 + s, decider: 'chronicler' });
      g.advance(1000);
      reached.push(g.ctx.world.ascension.best);
    }
    const adepts = reached.filter((r) => rungIndex(r) >= rungIndex('adept')).length;

    // Adept is §22's "typical generation 3-5" rung and it was arithmetically
    // impossible: the highest expressed power in eight runs was 17.6 against a
    // gate of 25, and the most books anybody read was one.
    expect(adepts, `${reached.join(',')}`).toBeGreaterThan(1);
    // And nothing hands a chronicler-driven house a Demigod. The top of the
    // ladder is meant to be built for, over centuries, on purpose — a player
    // who never opens the table should not arrive there by waiting.
    expect(reached.every((r) => rungIndex(r) < rungIndex('demigod')), reached.join(','))
      .toBe(true);
  });

  it('lets a man who meets every gate actually hold the rung', () => {
    // The mechanism, built rather than simulated, so this says something even
    // in a batch where nobody happens to get there.
    const ctx = testWorld(bundle, 8085);
    const him = ctx.world.people.household(ctx.world.playerHouse, ctx.world.year)
      .find((p) => eldritchPower(ctx, p) > 0);
    expect(him, 'the founding cast has nobody who can express').toBeTruthy();

    him!.awakening = { awakened: true, year: ctx.world.year, age: 20, forced: false, declaredMundane: false };
    expect(standingOf(ctx, him!).rung).toBe('touched');
  });

  it('remembers the high-water mark after the man holding it dies', () => {
    const g = newGame(loadContent(), { seed: 3003, decider: 'chronicler' });
    g.advance(1000);
    const w = g.ctx.world;
    expect(rungIndex(w.ascension.best)).toBeGreaterThanOrEqual(rungIndex(w.ascension.rung));
    if (w.ascension.best !== 'none') {
      expect(w.ascension.reachedAt[w.ascension.best]).toBeGreaterThan(1042);
    }
  });

  it('puts the rung on the view, which is the whole point of building it', () => {
    const g = newGame(loadContent(), { seed: 3000, decider: 'chronicler' });
    g.advance(300);
    const v = g.view();
    expect(RUNGS).toContain(v.ascension.rung as never);
    expect(v.ascension.title.length).toBeGreaterThan(2);
  });
});
