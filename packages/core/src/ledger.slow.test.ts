import { beforeAll, describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import type { RespectTier } from '@ed/schema';
import { RESPECT_ORDER } from '@ed/schema';
import type { ChronicleEntry } from '@ed/core';
import {
  bootstrap, runYears, stepYear, applyEffect, makeRng, mint, previewTemplate,
  tickRelationships, tickRespect,
  expectMean,
} from '@ed/core';

const bundle = loadContent();
/**
 * SIXTEEN, AND ONE PASS OVER THEM. Three tests below asked the same six seeds
 * the same thousand-year question and each ran it again — eighteen runs for
 * one batch of numbers. Sharing the pass buys ten more seeds for less time
 * than the file already spent, and every assertion here is a batch statistic
 * that was being answered by six draws.
 */
const SEEDS = [
  1042, 77, 909, 5150, 8080, 31,
  1000, 1037, 1074, 1111, 1148, 1185, 1222, 1259, 1296, 1333,
];

/**
 * THE SILENT SUBSYSTEMS.
 *
 * Every assertion in this file covers something that was declared in the
 * schema, referenced by authored content or named in the concept brief, and
 * implemented by nothing. None of them threw. Each one looked, from the
 * outside, exactly like a working feature that happened not to have come up.
 */
describe('the Ledger pays out (concept §18)', () => {
  it('starts the player knowing exactly one clause', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    expect(ctx.world.clausesRecovered.size).toBe(1);
    expect(bundle.clauses.filter((c) => c.known)).toHaveLength(1);
  });

  it('has nine clauses and never reveals one twice', () => {
    expect(bundle.clauses).toHaveLength(9);
    const ctx = bootstrap(bundle, 1042, 1042);
    runYears(ctx, 1000);
    const revealed = ctx.world.chronicle.filter((c) => bundle.clauses.some((x) => x.name === c.title));
    expect(new Set(revealed.map((c) => c.title)).size).toBe(revealed.length);
  });

  /**
   * The failure this replaces: a measured thousand-year run recovered TWO
   * clauses of nine, from the three authored events that happen to grant one.
   * The God rung requires seven, so the ending the whole game points at was
   * unreachable and nothing said so.
   */
  type Run = { seed: number; recovered: number; entries: ChronicleEntry[] };
  let batch: Run[] = [];
  let counts: number[] = [];
  const said = () => counts.join(',');

  beforeAll(() => {
    batch = SEEDS.map((seed) => {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 1000);
      return {
        seed,
        recovered: ctx.world.clausesRecovered.size,
        entries: ctx.world.chronicle.filter((c) => bundle.clauses.some((x) => x.name === c.title)),
      };
    });
    counts = batch.map((r) => r.recovered);
  }, 600_000);

  it('recovers most of the contract over a run', () => {
    expectMean({ values: counts, floor: 4, what: `clauses recovered per run — ${said()}` });
    expect(counts.some((c) => c >= 7), 'no run reached the God gate of seven clauses').toBe(true);
  });

  /**
   * And the other half of §18: "a run that reaches 2042 having recovered three
   * clauses has a genuinely worse endgame than one that recovered eight." If
   * every run recovers all nine, that sentence describes nothing.
   *
   * This was a `min` over six seeds, and a `min` over six seeds is a coin when
   * two runs in three recover all nine. Measured over forty-eight
   * thousand-year runs, seventeen fall short — 29% in one batch of
   * twenty-four and 42% in the other — so the shortfall is real and its rate
   * is not something six draws can see. It went red on a change that moved no
   * die in this subsystem and, on the wider batch, moved the number the other
   * way: mean 8.42 to 8.33, shortfalls 7 of 24 to 10 of 24.
   *
   * What survives that spread is the sentence in the title and the spread
   * itself. That two runs in three saturate at all is §18's own worry and is
   * filed as #42 — the run must be losable — not something this assertion can
   * fix by being stricter.
   */
  it('does not hand every run the whole contract', () => {
    expect(counts.some((c) => c < 9), `every run recovered ${said()}`).toBe(true);
    // "A genuinely worse endgame than one that recovered eight" needs the
    // batch to actually span. Measured spread across two batches of 24: 4 and 3.
    expect(Math.max(...counts) - Math.min(...counts), `no spread at all: ${said()}`)
      .toBeGreaterThanOrEqual(2);
  });

  /**
   * Over the seed set, not one seed for six hundred years. Whether any
   * PARTICULAR run has hired an archivist and named an Age by 1642 is exactly
   * the variance the two tests above exist to protect; this one is about what a
   * reveal LOOKS like when it happens, and it should not be able to fail
   * because a house was slow to hire.
   */
  it('writes the clause into the chronicle in the contract\'s own hand', () => {
    let seen = 0;
    for (const { entries } of batch) {
      for (const e of entries) {
        seen += 1;
        expect(e.weight).toBe('illuminated');
        // Nobody in the family wrote it, so no Record choice was ever offered.
        expect(e.record).toBeUndefined();
        expect(bundle.clauses.some((x) => x.text === e.text)).toBe(true);
      }
    }
    expect(seen, 'no clause was revealed in any run').toBeGreaterThan(0);
  });
});

describe('hostility is an edge (concept §7)', () => {
  /**
   * Four authored outcomes emit `kind: relationship`, including the seal
   * feud's own grudge — severity 60, inheritance all_blood. The effect switch
   * listed the case, commented that it was handled by its own subsystem, and
   * broke. There was no subsystem, and every one of those effects discarded
   * itself in silence.
   */
  it('records a grudge that authored content asks for', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const [a, b] = ctx.world.people.living();
    applyEffect(
      {
        kind: 'relationship',
        from: { slot: 'A' },
        to: { slot: 'B' },
        sentiment: -30,
        grudge: { severity: 60, inheritance: 'all_blood' },
      },
      ctx,
      { A: a!.id, B: b!.id },
    );
    expect(ctx.world.relationships.size).toBeGreaterThan(0);
    const held = [...ctx.world.relationships.values()].flatMap((r) => r.grudges);
    expect(held).toHaveLength(1);
    expect(held[0]!.inheritance).toBe('all_blood');
  });

  /** A feud whose parties are both dead within forty years is not a feud. */
  it('outlives the people who took it', () => {
    let oldest = 0;
    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      for (let i = 0; i < 800; i++) {
        stepYear(ctx);
        for (const rel of ctx.world.relationships.values()) {
          for (const g of rel.grudges) oldest = Math.max(oldest, ctx.world.year - g.originYear);
        }
      }
    }
    expect(oldest, 'no grudge ever outlived a generation').toBeGreaterThan(40);
  });

  it('lets a quarrel end rather than accumulating edges forever', () => {
    const ctx = bootstrap(bundle, 1042, 1042);
    const [a, b] = ctx.world.people.living();
    applyEffect(
      { kind: 'relationship', from: { slot: 'A' }, to: { slot: 'B' }, sentiment: -4 },
      ctx,
      { A: a!.id, B: b!.id },
    );
    expect(ctx.world.relationships.size).toBe(1);
    for (let i = 0; i < 400; i++) tickRelationships(ctx);
    expect(ctx.world.relationships.size, 'sentiment never cooled').toBe(0);
  });

  /**
   * The bug this guards is an ACCUMULATOR — a relationship map that only ever
   * grows, because nothing prunes an edge whose people are dead and whose
   * sentiment has cooled. A single ceiling checked once at 2042 turned out to
   * be a poor way to say that: it reads as a claim about a LEVEL, and the
   * level is a property of how much of the content moves sentiment rather
   * than of whether anything is pruned. A hundred common templates that each
   * note what the household thought took the count at 2042 from about 7 to
   * about 35, with a worst seed of 77 against a ceiling of 60, and nothing
   * about pruning had changed at all.
   *
   * So sample it across the run instead. Sentiment cools at 0.995 a year and
   * an edge with no grudge on it dies with either of its people, so a real
   * map SAWTOOTHS — it fills up over a generation and collapses when the
   * household turns over. Measured on three seeds it runs 72, 65, 5, 2, 73
   * across the millennium. A map that never comes back down is the bug; a
   * map that peaks high and empties is the system working.
   */
  it('prunes the edge map instead of accumulating it', () => {
    const ctx = bootstrap(bundle, 77, 1042);
    const seen: number[] = [];
    for (let i = 0; i < 10; i++) {
      runYears(ctx, 100);
      seen.push(ctx.world.relationships.size);
    }
    expect(Math.max(...seen), 'the edge map grew without bound').toBeLessThan(160);
    expect(Math.min(...seen), 'the edge map never emptied — nothing is being pruned')
      .toBeLessThan(12);
  });
});
