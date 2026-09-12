import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { expectMean } from './testing.js';
import { indexContent } from '@ed/schema';
import { bootstrap, runYears } from './sim.js';
import { foundHouse, prologueView } from './prologue.js';
import { END_YEAR } from './ending.js';
import {
  FRIEND_SPAN_YEARS, MAX_FRIENDS, applyFriendBlessing, friendBlessing, type FriendName,
} from './people/friends.js';
import { attr } from './people/factory.js';

/** What `generation` counts by, and what "by a generation" means below. */
const A_GENERATION = 25;
import type { SimCtx } from './world.js';

/**
 * DO THE FIVE NAMES ACTUALLY ARRIVE? (`people/friends.ts`)
 *
 * Everything in `friends.test.ts` is about the verb and runs in half a second.
 * This is the other half, and it is the half this repo exists to check: a
 * roster that is asked for at the signing, validated, stored, saved, loaded
 * and never once handed to a living person is a feature that fails by doing
 * nothing. Every test passes. The run is healthy. The names simply never come.
 *
 * Measured over the twelve seeds below, played to 2042 with the five names
 * given at the founding:
 *
 *   names spent            5.0 of 5, in every seed
 *   first arrival          1062-1153  (mean 1110)
 *   last arrival           1476-1569  (mean 1520)
 *   lag from due to found  mean 14.5 years, max 53
 *   lift carried           1.43 attributes each, +7.2 points (+2.9 to +12.0)
 *   worth, in percentile   +22 points among their own sex on the lifted attribute
 *
 * AND A HEADLESS RUN IS UNTOUCHED, PROVEN RATHER THAN ASSERTED. `npm run
 * digest -- 8 400` moves by exactly thirteen bytes a seed against the commit
 * before this feature, and thirteen bytes is the length of `"friends":[]`. Drop
 * that one key from the save and all eight digests are identical, hash for
 * hash, to the block main printed. The simulation did not move: `claimFriendName`
 * returns on an empty bag before it touches the stream, which is the whole
 * reason it is written to check the bag first and flip the coin second.
 *
 * THE PACING IS THE BANDS, NOT THE COIN. The first cut of this was a flat ten
 * percent against a run that produces about two new people a year, and it
 * emptied the bag inside the first century — measured, first arrival 1052 and
 * last 1100, then nine hundred years of nothing. `dealWindows` gives each name
 * a century of its own across `FRIEND_SPAN_YEARS`, and the coin still decides
 * who inside it: the lag above says a name lands about fourteen years after it
 * comes due, so the bands are what the player actually experiences.
 *
 * AND MIND IS THE ONE TO WATCH. The lift is a fraction of each attribute's
 * population mean (invariant 10), but Mind's realised spread among the living
 * is far tighter than its unclamped mean suggests — p10 8, p50 12, p90 25 — so
 * the same +8.7 points is worth +46 points of percentile there against +13 on
 * Strength. Mind is also the ladder's currency. One exceptional mind a century
 * is the intended shape rather than an accident, but `FRIEND_BLESSING_LIFT` is
 * the knob if it ever reads as more than that, and this is the measurement.
 */

const content = indexContent(loadContent());
const SEEDS = Array.from({ length: 12 }, (_, i) => 4000 + i * 13);

/** Names no `uniqueName` pool contains, so an arrival cannot be a coincidence. */
const FIVE = [
  { name: 'Marisol', sex: 'female' as const },
  { name: 'Tobias', sex: 'male' as const },
  { name: 'Priya', sex: 'female' as const },
  { name: 'Kwame', sex: 'male' as const },
  { name: 'Ines', sex: 'female' as const },
];

interface Run {
  seed: number;
  spent: FriendName[];
  /** The five, as they were found in the world: who ended up wearing each. */
  worn: { name: string; sex: string; ours: boolean }[];
  /** Every attribute lift actually carried by somebody wearing one of the five. */
  lifts: { attr: string; points: number }[];
}

function play(seed: number): Run {
  const ctx = bootstrap(content, seed, 1042);
  const view = prologueView(ctx)!;
  const founded = foundHouse(ctx, {
    houseName: 'Vayne',
    heirloom: view.heirlooms[0]!.heirloom,
    grudge: view.grudges[0]!.house,
    friends: FIVE,
  });
  expect(founded.ok, founded.reason).toBe(true);

  runYears(ctx, END_YEAR - ctx.world.year);
  const w = ctx.world;
  const worn = w.people.all()
    .filter((p) => FIVE.some((f) => f.name === p.name))
    .map((p) => ({ name: p.name, sex: p.sex as string, ours: p.houseOfOrigin === w.playerHouse }));
  return { seed, spent: w.friends.filter((f) => f.spentIn !== undefined), worn, lifts: liftsIn(ctx) };
}

/**
 * What the lift is worth on the bodies that actually carry it, measured by
 * TAKING IT BACK OFF and reading the attribute again. Anything else would be
 * re-deriving the number the code just computed and calling the agreement a
 * test.
 */
function liftsIn(ctx: SimCtx): { attr: string; points: number }[] {
  const w = ctx.world;
  const out: { attr: string; points: number }[] = [];
  for (const f of w.friends) {
    const p = w.people.all().find((q) => q.name === f.name);
    if (!p) continue;
    const at = Math.min(p.born + 25, p.died ?? END_YEAR);
    for (const g of friendBlessing(p.sigilSeed, ctx.genetics.attributes, ctx.genetics.expected)) {
      const withIt = attr(p, g.attr, ctx.genetics, at);
      applyFriendBlessing(p, [g], -1);
      const without = attr(p, g.attr, ctx.genetics, at);
      applyFriendBlessing(p, [g], 1);
      out.push({ attr: g.attr, points: withIt - without });
    }
  }
  return out;
}

describe('the five names, over a played batch', () => {
  const runs = SEEDS.map(play);

  /**
   * THE WHOLE POINT, AND THE ONLY THING THAT CANNOT BE INFERRED FROM THE UNIT
   * TESTS. A floor of one per run against a measurement of five in every run:
   * far enough below where it stands that it never argues with a balance
   * change, close enough to matter before the feature quietly leaves the game.
   */
  it('hands out names the player gave, in every run', () => {
    for (const r of runs) {
      expect(r.spent.length, `seed ${r.seed} spent none of the five in a thousand years`)
        .toBeGreaterThanOrEqual(1);
    }
    expectMean({
      values: runs.map((r) => r.spent.length),
      floor: 3 - 1e-9,
      what: 'friends spent per run — the bag barely empties across a whole run',
    });
  });

  /**
   * THE SPREAD IS THE WHOLE OF THE SECOND CUT. A flat coin put all five inside
   * the first century — the run's own measurement, before `dealWindows` — and
   * nothing in the build said so, because five names arriving is five names
   * arriving whenever they arrive. What is asserted is the shape: they land
   * across centuries rather than in one, and the last is inside the span.
   */
  it('spreads them across the centuries rather than emptying the bag at once', () => {
    for (const r of runs) {
      const years = r.spent.map((f) => f.spentIn!).sort((a, b) => a - b);
      if (years.length < 2) continue;
      const first = years[0]!;
      const last = years[years.length - 1]!;
      expect(last - first, `seed ${r.seed} spent them all inside ${last - first} years`)
        .toBeGreaterThan(FRIEND_SPAN_YEARS / 2);
      // And none of them turns up after its own window has closed by a
      // generation — the coin lands a name soon after it comes due.
      //
      // DERIVED, not a round number. It read 120 against a band of
      // `FRIEND_SPAN_YEARS / MAX_FRIENDS` = 100 plus a generation of 25,
      // which is 125 — so the bound was five years tighter than the sentence
      // above it claimed, and a content drop that re-rolled the draws landed
      // Kwame at exactly 120 and failed the build on the difference. A bound
      // that does not equal its own stated reasoning is a number waiting to
      // be argued with.
      const band = FRIEND_SPAN_YEARS / MAX_FRIENDS + A_GENERATION;
      for (const f of r.spent) {
        expect(f.spentIn! - f.dueFrom, `${f.name} came due in ${f.dueFrom} and arrived in ${f.spentIn}`)
          .toBeLessThanOrEqual(band);
      }
    }
    // Across the batch, the last arrival is in the far half of the span.
    const lasts = runs.map((r) => Math.max(...r.spent.map((f) => f.spentIn!)));
    expectMean({
      values: lasts,
      floor: 1042 + FRIEND_SPAN_YEARS * 0.6,
      what: 'the year of the last arrival, across the batch',
    });
  });

  /**
   * AND EACH OF THEM IS A LITTLE BETTER THAN THEY HAVE ANY BUSINESS BEING.
   * Measured on the body rather than recomputed: the lift is removed, the
   * attribute is read, the lift goes back. A blessing that never reaches
   * `acquired` — written into the phenotype cache, say, which looks like it
   * works — reads as exactly zero here and as nothing at all anywhere else.
   */
  it('leaves a lift on everybody wearing one of the names', () => {
    const lifts = runs.flatMap((r) => r.lifts);
    expect(lifts.length, 'not one of the five was found carrying anything').toBeGreaterThan(20);
    for (const l of lifts) {
      expect(l.points, `${l.attr} moved by ${l.points.toFixed(2)}`).toBeGreaterThan(0.5);
    }
    // A band, not a golden number: real enough to notice, small enough that a
    // friend is a good draw rather than a different kind of person.
    const points = lifts.map((l) => l.points);
    expectMean({ values: points, floor: 3, what: 'the lift a friend carries' });
    expectMean({ values: points, ceiling: 15, what: 'the lift a friend carries' });
  });

  it('never spends a name twice, and never invents a sixth', () => {
    for (const r of runs) {
      expect(r.spent.length).toBeLessThanOrEqual(MAX_FRIENDS);
      expect(new Set(r.spent.map((f) => f.name)).size).toBe(r.spent.length);
      for (const f of r.spent) expect(FIVE.some((g) => g.name === f.name)).toBe(true);
    }
  });

  /**
   * SAME SEX, EVERY TIME. This is the half a player notices instantly and no
   * unit test can prove over real content: the name goes on somebody of the
   * friend's sex, wherever in the world the person came from.
   */
  it('puts each name on somebody of that friend’s sex', () => {
    let checked = 0;
    for (const r of runs) {
      for (const p of r.worn) {
        const friend = FIVE.find((f) => f.name === p.name)!;
        expect(p.sex, `seed ${r.seed}: ${p.name} arrived as a ${p.sex}`).toBe(friend.sex);
        checked += 1;
      }
    }
    expect(checked, 'not one of the five was ever found in a world').toBeGreaterThan(0);
  });

  /**
   * BOTH DOORS. A friend can be born into the house or arrive from outside it,
   * because there are two naming hooks — `conceiveChild` and `rollRecipe` —
   * and one of them silently not calling through is exactly the shape of bug
   * this file is for. Over twelve runs both must be seen.
   */
  it('arrives by birth and by arrival, not only one of the two', () => {
    const worn = runs.flatMap((r) => r.worn);
    expect(worn.filter((p) => p.ours).length, 'not one of the five was ever born into the house')
      .toBeGreaterThan(0);
    expect(worn.filter((p) => !p.ours).length, 'not one of the five ever came from outside')
      .toBeGreaterThan(0);
  });

  /**
   * AND A RUN NOBODY FOUNDED IS UNTOUCHED. The bag is empty, so
   * `claimFriendName` returns before it draws — and a headless run is the run
   * it was before this feature existed, digest for digest. The harness, every
   * gate and most of this suite depend on that.
   */
  it('leaves an unfounded run alone', () => {
    const ctx = bootstrap(content, 4000, 1042);
    runYears(ctx, 200);
    expect(ctx.world.friends).toEqual([]);
  });
});
