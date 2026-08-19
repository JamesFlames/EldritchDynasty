import { describe, expect, it } from 'vitest';
import { conceptionSeed, hashSeed, makeRng, streamFor } from '@ed/core';

/**
 * THE DETERMINISM CONTRACT.
 *
 * Save/load, replay, the golden digests and the whole headless harness rest on
 * this file behaving. When it stops, nothing throws — a loaded run simply
 * continues into a different century than the one it was saved from, and the
 * only symptom is a golden that moved for no reason anyone can name.
 *
 * These assertions are about the STREAM, not about any number it happens to
 * produce. Nothing here pins a seed to a value, because a retune of sfc32 is
 * allowed and a break in reproducibility is not.
 */

const draws = (rng: { next(): number }, n = 8) => Array.from({ length: n }, () => rng.next());

describe('hashSeed', () => {
  it('is a stable unsigned 32-bit number for the same parts', () => {
    const h = hashSeed('year', 1042, 'births');
    expect(h).toBe(hashSeed('year', 1042, 'births'));
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });

  it('reads a number and its own digits as the same part, and cares about order', () => {
    expect(hashSeed(1042)).toBe(hashSeed('1042'));
    expect(hashSeed('a', 'b')).not.toBe(hashSeed('b', 'a'));
  });

  it('keeps the parts apart, so two joins of the same letters differ', () => {
    // Without a separator these collide, and every seed built from
    // (house, name) pairs starts sharing streams with its neighbours.
    expect(hashSeed('ab', 'c')).not.toBe(hashSeed('a', 'bc'));
    expect(hashSeed('a', '')).not.toBe(hashSeed('a'));
  });
});

describe('the stream itself', () => {
  it('replays exactly from the same seed, and diverges from a different one', () => {
    expect(draws(makeRng(99))).toEqual(draws(makeRng(99)));
    expect(draws(makeRng(99))).not.toEqual(draws(makeRng(100)));
  });

  it('stays inside the ranges every caller assumes', () => {
    const rng = makeRng(7);
    for (let i = 0; i < 2000; i++) {
      const n = rng.next();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);

      const k = rng.int(6);
      expect(Number.isInteger(k)).toBe(true);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThan(6);

      const r = rng.range(-5, 5);
      expect(r).toBeGreaterThanOrEqual(-5);
      expect(r).toBeLessThan(5);
    }
  });

  it('treats certainty as certainty at both ends of bool', () => {
    const rng = makeRng(3);
    for (let i = 0; i < 200; i++) {
      expect(rng.bool(1)).toBe(true);
      expect(rng.bool(0)).toBe(false);
    }
  });

  it('picks only from what it was given', () => {
    const rng = makeRng(11);
    const xs = ['a', 'b', 'c'];
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) seen.add(rng.pick(xs));
    expect([...seen].sort()).toEqual(xs);
    expect(rng.pick(['only'])).toBe('only');
  });
});

describe('weighted choice', () => {
  it('declines rather than guessing when nothing has any weight', () => {
    const rng = makeRng(5);
    expect(rng.weighted(['a', 'b'], () => 0)).toBeUndefined();
    expect(rng.weighted([], () => 1)).toBeUndefined();
  });

  it('never returns an option nobody weighted', () => {
    // Every rationing decision in the game is a weighted pick over templates,
    // and a zero-weight template is one content has switched off.
    const rng = makeRng(13);
    const xs = [{ id: 'off', w: 0 }, { id: 'on', w: 3 }];
    for (let i = 0; i < 500; i++) expect(rng.weighted(xs, (x) => x.w)!.id).toBe('on');
  });

  it('treats a negative weight as no weight rather than as a subtraction', () => {
    const rng = makeRng(17);
    const xs = [{ id: 'bad', w: -100 }, { id: 'good', w: 1 }];
    for (let i = 0; i < 200; i++) expect(rng.weighted(xs, (x) => x.w)!.id).toBe('good');
  });

  it('follows the weights it was given', () => {
    const rng = makeRng(23);
    const xs = ['rare', 'common'];
    const weight = (x: string) => (x === 'common' ? 9 : 1);
    let common = 0;
    for (let i = 0; i < 4000; i++) if (rng.weighted(xs, weight) === 'common') common += 1;
    expect(common / 4000).toBeGreaterThan(0.85);
    expect(common / 4000).toBeLessThan(0.95);
  });
});

describe('the shaped draws', () => {
  it('centres normal() on its mean and spreads it by its sd', () => {
    const rng = makeRng(31);
    const xs = Array.from({ length: 5000 }, () => rng.normal(50, 10));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
    expect(mean).toBeGreaterThan(49);
    expect(mean).toBeLessThan(51);
    expect(sd).toBeGreaterThan(9);
    expect(sd).toBeLessThan(11);
  });

  it('gives poisson() a mean near lambda and never a negative count', () => {
    const rng = makeRng(37);
    const xs = Array.from({ length: 5000 }, () => rng.poisson(2.5));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(xs.every(Number.isInteger)).toBe(true);
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean).toBeGreaterThan(2.3);
    expect(mean).toBeLessThan(2.7);
  });
});

describe('forking', () => {
  it('gives the same salt the same substream, and different salts different ones', () => {
    expect(draws(makeRng(41).fork('a'))).toEqual(draws(makeRng(41).fork('a')));
    expect(draws(makeRng(41).fork('a'))).not.toEqual(draws(makeRng(41).fork('b')));
  });

  it('does not spend the parent\'s draws', () => {
    const plain = makeRng(43);
    const forking = makeRng(43);
    forking.fork('somewhere else');
    expect(draws(forking)).toEqual(draws(plain));
  });

  it('does not simply hand back the parent\'s own numbers', () => {
    expect(draws(makeRng(47).fork('child'))).not.toEqual(draws(makeRng(47)));
  });
});

describe('a conception derives its stream from the parents, not from a cursor', () => {
  it('is the same seed however many times you ask for it', () => {
    expect(conceptionSeed(1042, 'p_1', 'p_2', 3)).toBe(conceptionSeed(1042, 'p_1', 'p_2', 3));
  });

  it('moves when the run, either parent, or the birth order moves', () => {
    const base = conceptionSeed(1042, 'p_1', 'p_2', 1);
    expect(conceptionSeed(9999, 'p_1', 'p_2', 1)).not.toBe(base);
    expect(conceptionSeed(1042, 'p_9', 'p_2', 1)).not.toBe(base);
    expect(conceptionSeed(1042, 'p_1', 'p_9', 1)).not.toBe(base);
    // Save-scumming a birth means re-rolling the same child. This is why it fails.
    expect(conceptionSeed(1042, 'p_1', 'p_2', 2)).not.toBe(base);
  });

  it('knows which parent is which', () => {
    expect(conceptionSeed(1042, 'p_1', 'p_2', 1)).not.toBe(conceptionSeed(1042, 'p_2', 'p_1', 1));
  });
});

describe('one stream per system per year', () => {
  const world = { seed: 1042, year: 1200 };

  it('hands the same system the same dice however often it is asked', () => {
    expect(draws(streamFor(world, 'births'))).toEqual(draws(streamFor(world, 'births')));
  });

  it('gives two systems in one year unrelated dice', () => {
    expect(draws(streamFor(world, 'births'))).not.toEqual(draws(streamFor(world, 'mortality')));
  });

  it('gives one system unrelated dice from one year to the next', () => {
    expect(draws(streamFor(world, 'births'))).not.toEqual(draws(streamFor({ ...world, year: 1201 }, 'births')));
  });

  it('gives two runs of different seeds unrelated dice in the same year', () => {
    expect(draws(streamFor(world, 'births'))).not.toEqual(draws(streamFor({ ...world, seed: 7 }, 'births')));
  });

  it('is unmoved by how many draws any other system took', () => {
    // THE POINT OF THE WHOLE SPLIT. Adding one roll to the mortality pass must
    // not shift marriages, births, arcs and events for the rest of the run.
    const mortality = streamFor(world, 'mortality');
    for (let i = 0; i < 1000; i++) mortality.next();
    expect(draws(streamFor(world, 'births'))).toEqual(draws(streamFor(world, 'births')));
  });

  it('separates the extra salt a system passes for a sub-stream', () => {
    expect(draws(streamFor(world, 'events', 'p_1'))).not.toEqual(draws(streamFor(world, 'events', 'p_2')));
    expect(draws(streamFor(world, 'events', 'p_1'))).toEqual(draws(streamFor(world, 'events', 'p_1')));
  });
});
