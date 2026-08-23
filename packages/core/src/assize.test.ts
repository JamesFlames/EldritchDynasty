import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import {
  ASSIZE_RESPONSES, armOf, assizeFavour, assizePressure, measureFortune,
  newGame, phase, place, resumeGame, testWorld,
} from '@ed/core';

const bundle = loadContent();

/**
 * THE ASSIZE (`assize.ts`) — the world's opinion of the house, and what it
 * does about it.
 *
 * The failure it answers: across fourteen thousand-year runs of the shipped
 * game, no house died out, none fell below ten people, every player-driven run
 * recovered nine of nine clauses, and standing landed on exalted almost every
 * time. Nothing in the world reacted to the house, so the run had feedback of
 * neither sign.
 */
describe('how the world reads the house', () => {
  it('reads a rich, respected, populous house as ahead', () => {
    const ctx = testWorld(bundle, 4242);
    ctx.world.treasury = 6000;
    ctx.world.respect = 'exalted';
    for (let i = 0; i < 24; i++) place(ctx, { sex: i % 2 ? 'male' : 'female', age: 20 + i });

    expect(measureFortune(ctx).score).toBeGreaterThan(0.6);
    expect(assizePressure(ctx)).toBeGreaterThan(0.4);
  });

  it('reads a broke, unknown, dwindling house as behind', () => {
    const ctx = testWorld(bundle, 4243);
    ctx.world.treasury = -100;
    ctx.world.respect = 'unknown';
    // A house with a living expresser and a hall of people is never at the
    // floor, however empty the strongbox. What matters is that it is far
    // enough under for the steadying arm to reach it — see `STEADIES_AT`.
    expect(assizePressure(ctx)).toBeLessThan(-0.26);
  });

  it('raises the bar as the centuries pass', () => {
    // Merely surviving in 1042 is doing well. Merely surviving in 1900 has
    // wasted nine hundred years, and the reading has to say so.
    const early = testWorld(bundle, 4244);
    early.world.treasury = 700;
    const late = testWorld(bundle, 4244);
    late.world.treasury = 700;
    late.world.year = 1942;

    expect(assizePressure(late)).toBeLessThan(assizePressure(early));
  });
});

describe('what the world does about it', () => {
  it('says so out loud, every time', () => {
    // A hidden rubber band is a lie the player can feel and cannot name. Every
    // response writes a line naming who did what.
    for (const r of ASSIZE_RESPONSES) {
      expect(r.line.length, `${r.id} acts silently`).toBeGreaterThan(30);
      expect(armOf(r)).toBe(r.arm);
    }
  });

  it('offers both arms, and enough of each to not be read by the fourth century', () => {
    const resents = ASSIZE_RESPONSES.filter((r) => r.arm === 'resents');
    const steadies = ASSIZE_RESPONSES.filter((r) => r.arm === 'steadies');
    expect(resents.length).toBeGreaterThanOrEqual(6);
    expect(steadies.length).toBeGreaterThanOrEqual(6);
    expect(new Set(ASSIZE_RESPONSES.map((r) => r.id)).size).toBe(ASSIZE_RESPONSES.length);
  });

  it('charges a house that is plainly doing well', () => {
    const ctx = testWorld(bundle, 4245);
    ctx.world.treasury = 9000;
    ctx.world.respect = 'exalted';
    for (let i = 0; i < 26; i++) place(ctx, { sex: i % 2 ? 'male' : 'female', age: 22 + (i % 30) });
    ctx.world.assize.lastSitting = ctx.world.year - 40;

    const before = ctx.world.treasury;
    // Long enough for a sitting to land; the interval is twelve years.
    for (let i = 0; i < 30; i++) {
      phase('assize', ctx);
      ctx.world.year += 1;
    }
    expect(ctx.world.treasury, 'nothing was ever asked of a house with nine thousand crowns')
      .toBeLessThan(before);
  });

  it('steadies a house that is plainly failing', () => {
    const ctx = testWorld(bundle, 4246);
    ctx.world.treasury = -110;
    ctx.world.respect = 'unknown';
    ctx.world.assize.lastSitting = ctx.world.year - 40;

    let helped = false;
    for (let i = 0; i < 40 && !helped; i++) {
      phase('assize', ctx);
      ctx.world.year += 1;
      helped = ctx.world.treasury > -110
        || assizeFavour(ctx, 'favour')
        || assizeFavour(ctx, 'mercy');
    }
    expect(helped, 'the world watched a house starve and did nothing').toBe(true);
  });
});

describe('across a whole run', () => {
  it('acts about once a generation, from the whole range of what it can do', () => {
    const g = newGame(loadContent(), { seed: 3000, decider: 'chronicler' });
    let sittings = 0;
    const used = new Set<string>();
    for (let y = 0; y < 1000; y++) {
      const acted = g.advance(1).years[0]?.assize?.acted;
      if (!acted) continue;
      sittings += 1;
      used.add(acted.id);
    }
    // A world that acts twice a millennium is not reacting to anything.
    expect(sittings).toBeGreaterThan(15);
    // A world with three moves is one the player has read by the fourth century.
    expect(used.size).toBeGreaterThan(7);
  });

  it('survives the round trip, cooldowns and all', () => {
    const g = newGame(loadContent(), { seed: 3003, decider: 'chronicler' });
    g.advance(400);
    const save = g.save();
    expect(save.assize.fired).toEqual(g.ctx.world.assize.fired);
    expect(save.assize.openedAt).toBe(1042);

    // A load that forgot the cooldowns would let a reloaded run be assessed
    // twice in one decade, and would drop any physician still in the house.
    const back = resumeGame(save, loadContent());
    expect(back.ctx.world.assize).toEqual(g.ctx.world.assize);
  });
});
