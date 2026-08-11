import { beforeAll, describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { bootstrap, stepYear } from '@ed/core';

const bundle = loadContent();

/**
 * THE AGE SCHEDULER, MEASURED RATHER THAN PRINTED (issue #3, phase 0).
 *
 * The harness prints min/median/max span per Age and how many runs saw one,
 * but compares none of it to what the content authored. This file asserts
 * three claims the design makes about the scheduler in `ages/scheduler.ts`.
 *
 * A statistical claim about a hazard process needs more samples than the
 * six-seed suites elsewhere use to settle down, so this uses the same scale
 * the harness itself measures at — 12 runs x 1000 years
 * (`npm run harness -- 12 1000`) — rather than the demographic regression
 * suites' six-seed set. Because the sim is fully seeded, this is still
 * exactly reproducible; it costs samples, not flakiness.
 */
const SEEDS = Array.from({ length: 12 }, (_, i) => 1000 + i * 7);
const YEARS = 1000;

interface RunAges {
  spans: { age: string; span: number }[];
  agesOccurred: Set<string>;
  /** Longest run of consecutive years with `world.age.active` empty. */
  longestDeadStretch: number;
}

let runs: RunAges[];

beforeAll(() => {
  runs = SEEDS.map((seed) => {
    const ctx = bootstrap(bundle, seed, 1042);
    let deadStretch = 0;
    let longestDeadStretch = 0;
    for (let i = 0; i < YEARS; i++) {
      stepYear(ctx);
      if (ctx.world.age.active.length === 0) {
        deadStretch += 1;
        longestDeadStretch = Math.max(longestDeadStretch, deadStretch);
      } else {
        deadStretch = 0;
      }
    }
    const w = ctx.world;
    return {
      spans: w.age.ended.map((e) => ({ age: e.age, span: e.ended - e.began })),
      agesOccurred: new Set([...w.age.ended.map((e) => e.age), ...w.age.active.map((a) => a.age)]),
      longestDeadStretch,
    };
  });
});

describe('the Age scheduler holds the shape the content authored', () => {
  /**
   * `tickAges` only rolls a termination once `elapsed >= minYears` (§1), so
   * no observed span can fall under the authored floor — that half is a hard
   * invariant. The other half is the design's own claim (concept §20): "a
   * twelve-year Wars and a hundred-year Wars must both be possible or the
   * player will learn the band and plan against it." A tail that never
   * reaches near the floor, or never clears the median by much, is a band
   * the player CAN learn.
   */
  it('realised duration matches the authored shape', () => {
    const spansByAge = new Map<string, number[]>();
    for (const run of runs) {
      for (const s of run.spans) spansByAge.set(s.age, [...(spansByAge.get(s.age) ?? []), s.span]);
    }

    for (const def of bundle.ages) {
      const spans = spansByAge.get(def.id) ?? [];
      const { minYears, medianYears } = def.duration;

      for (const span of spans) {
        expect(span, `${def.id} ended after ${span}y, under its authored ${minYears}y minimum`)
          .toBeGreaterThanOrEqual(minYears);
      }

      // Too few occurrences to say anything about the shape of the tail.
      if (spans.length < 5) continue;

      const shortest = Math.min(...spans);
      const longest = Math.max(...spans);
      const band = medianYears - minYears;

      expect(
        shortest,
        `${def.id}: shortest of ${spans.length} runs was ${shortest}y — no run came close to the ${minYears}y floor`,
      ).toBeLessThanOrEqual(minYears + band * 0.6);
      expect(
        longest,
        `${def.id}: longest of ${spans.length} runs was ${longest}y — no run ran meaningfully past the ${medianYears}y median`,
      ).toBeGreaterThanOrEqual(medianYears + band * 0.3);
    }
  });

  /**
   * "An Age appearing in 4% of runs is an Age whose content will never be
   * seen" (issue #3). Measured 2026-08-11 at this same scale: all seven Ages
   * occur in 92-100% of runs. The floor here sits well under that measured
   * range, so it only trips on real starvation, not on ordinary variance.
   */
  it('every Age occurs in enough runs to justify authoring exclusive content', () => {
    for (const def of bundle.ages) {
      const seen = runs.filter((r) => r.agesOccurred.has(def.id)).length;
      const pct = (100 * seen) / runs.length;
      expect(pct, `${def.id} occurred in only ${pct}% of ${runs.length} runs`).toBeGreaterThanOrEqual(50);
    }
  });

  /**
   * The register alternation in `isEligible` bars a register that just ended
   * AND a register already active, across three registers with
   * `MAX_CONCURRENT = 2`. Occurrence rates above cannot catch a scheduler
   * that has excluded every eligible Age — a run can see all seven Ages and
   * still contain a dead century; the symptom is a hundred flat years, not
   * a crash.
   *
   * Onset is also an independent 3.5%/year roll even once something is
   * eligible, so ordinary variance alone produces long gaps sometimes —
   * measured max across these 12 seeds is 169y, and a single Age's own
   * cooldown runs as high as 220y. The floor below sits comfortably past
   * that natural tail; it is there to catch a genuine eligibility deadlock
   * (every register locked out at once for a run of centuries), not to
   * penalise bad luck on the die.
   */
  it('never leaves a run with no active Age for an unreasonable stretch', () => {
    const MAX_REASONABLE_GAP = 250;
    runs.forEach((run, i) => {
      expect(
        run.longestDeadStretch,
        `seed ${SEEDS[i]}: ${run.longestDeadStretch}y in a row with no active Age`,
      ).toBeLessThanOrEqual(MAX_REASONABLE_GAP);
    });
  });
});
