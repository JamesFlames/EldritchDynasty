/**
 * Seeded, reproducible RNG. Every conception derives its stream from a stable
 * tuple rather than a global cursor, so a child is reproducible across
 * save/load, the harness can replay any run exactly, and save-scumming a birth
 * is impossible without changing the parents or the birth order.
 */
export interface Rng {
  next(): number;                    // [0,1)
  int(maxExclusive: number): number;
  range(min: number, max: number): number;
  bool(p: number): boolean;
  pick<T>(xs: readonly T[]): T;
  weighted<T>(xs: readonly T[], weight: (x: T) => number): T | undefined;
  /** Box-Muller, for attribute noise and hazard jitter. */
  normal(mean: number, sd: number): number;
  poisson(lambda: number): number;
  fork(salt: string): Rng;
}

export function hashSeed(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    const s = String(part);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    h ^= 0x9e3779b9;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function makeRng(seed: number): Rng {
  let a = (seed ^ 0xdeadbeef) >>> 0;
  let b = (seed ^ 0x41c64e6d) >>> 0;
  let c = (seed ^ 0x6c078965) >>> 0;
  let d = 1;

  // sfc32
  const next = (): number => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next();

  const rng: Rng = {
    next,
    int: (max) => Math.floor(next() * max),
    range: (min, max) => min + next() * (max - min),
    bool: (p) => next() < p,
    pick: (xs) => xs[Math.floor(next() * xs.length)]!,
    weighted(xs, weight) {
      let total = 0;
      for (const x of xs) total += Math.max(0, weight(x));
      if (total <= 0) return undefined;
      let roll = next() * total;
      for (const x of xs) {
        roll -= Math.max(0, weight(x));
        if (roll <= 0) return x;
      }
      return xs[xs.length - 1];
    },
    normal(mean, sd) {
      const u = Math.max(next(), 1e-12);
      const v = next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    poisson(lambda) {
      const l = Math.exp(-lambda);
      let k = 0;
      let p = 1;
      do { k++; p *= next(); } while (p > l);
      return k - 1;
    },
    fork: (salt) => makeRng(hashSeed(seed, salt)),
  };
  return rng;
}

/** A conception's stream. Stable across reloads by construction. */
export function conceptionSeed(runSeed: number, mother: string, father: string, ordinal: number): number {
  return hashSeed(runSeed, 'conception', mother, father, ordinal);
}

/**
 * ONE STREAM PER SYSTEM PER YEAR.
 *
 * Every phase of a year used to draw from a single `makeRng(seed, 'year', y)`.
 * That is deterministic, and it is also brittle in a way that shows up the
 * moment anyone touches the code: adding one `rng.bool()` to the mortality pass
 * shifts every subsequent draw in that year, so marriages, births, arcs and
 * events all change, in every year, for the rest of the run. No refactor could
 * be shown to preserve behaviour, and a golden run could not be trusted to mean
 * anything except "nothing at all was edited".
 *
 * Deriving each system's stream from its own NAME fixes that. Births roll the
 * same numbers whatever happened in the economy; a phase can be reordered,
 * split, or made conditional without touching anybody else's dice; and a golden
 * that does move is telling the truth about the system that moved it.
 *
 * The name is therefore part of the save format in all but name. Renaming a
 * phase reseeds it, which is fine — it is a new system — but it is not a
 * cosmetic edit and should not be made as one.
 */
export function streamFor(
  world: { seed: number; year: number },
  system: string,
  ...extra: (string | number)[]
): Rng {
  return makeRng(hashSeed(world.seed, 'year', world.year, system, ...extra));
}
