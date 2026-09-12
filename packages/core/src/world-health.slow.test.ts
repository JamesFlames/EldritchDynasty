import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { bootstrap, runYears, worldViolations, expectHealthyWorld } from '@ed/core';

const bundle = loadContent();

/**
 * IS THE WORLD STILL A WORLD AFTER A THOUSAND YEARS?
 *
 * Forty-three suites play millennia and each checks its own subsystem — did
 * the ladder move, did the record drift, did the branches grieve. Between
 * them they own no answer to "are these people internally consistent",
 * because it belongs to none of them. `docs/FAILURES.md` is largely a list of
 * times that gap shipped: children in the wrong household, widows still
 * married to dead men, cast slots never refilled, the seal out of the main
 * house twice. Every one of those is a predicate over a single world.
 *
 * The rules live in `worldViolations` (`core/src/testing.ts`) and are proven
 * able to fail in `world-health.test.ts` — hand-built worlds, one broken
 * thing each. This file asks the same questions of worlds nobody built by
 * hand, which is where the answers can surprise you.
 *
 * SAMPLED THROUGH THE RUN, NOT ONLY AT THE END. A world can be incoherent in
 * 1300 and coherent again by 2042 — the widow gets swept up, the seal gets
 * refilled — and "fine at the end" is exactly the reading that misses a
 * subsystem that stopped working for two centuries. Checking every fifty
 * years costs nothing measurable next to the years themselves.
 */
const SEEDS = Array.from({ length: 8 }, (_, i) => 2200 + i * 97);
const EVERY = 50;
const END = 2042;

/**
 * ── THE ONE THING THE WORLD IS CURRENTLY ALLOWED TO GET WRONG ─────────────
 *
 * `kill()`'s guardian branch closes only Daveed's half of his marriage, so
 * his widow keeps an open vow to a man who is now a guardian spirit. The
 * ordinary death path eight lines below it closes both sides, with a comment
 * explaining why. See `world-health.test.ts`, which pins the mechanism, and
 * `people/store.ts`, which carries the measurement.
 *
 * IT IS PINNED HERE RATHER THAN FIXED because the fix moves `npm run digest`
 * on 3 of 4 seeds — it changes how long the widow is invisible to the Match —
 * and that is a balance change wanting the harness and a BALANCE-LOG entry,
 * not a quiet correction on a test-suite branch.
 *
 * THE PIN IS TIGHT ON PURPOSE. It admits this exact complaint and no other,
 * and it fails if the count GROWS as well as if it goes to zero — an
 * allowance that only ever gets looser is how a known bug becomes the
 * specification. Measured at 2 checkpoints of 160 across these eight runs:
 * the vow opens when he dies (around 1070–1090) and something downstream
 * closes it within a century, which is why an end-of-run check sees nothing
 * and this one does.
 */
const PINNED = {
  rule: 'marriage',
  matches: /has an open marriage to .* and .* does not agree/,
  checkpoints: 2,
};

describe('a played world stays internally coherent', () => {
  /**
   * One pass, eight runs, every rule at every checkpoint. Reported as a
   * tally rather than a first failure: one broken person is a bad effect and
   * four hundred is a bad gate, and the difference is the whole diagnosis.
   */
  it('across eight millennia, sampled every fifty years', () => {
    const tally = new Map<string, { n: number; first: string; when: number }>();
    let checkpoints = 0;
    let pinned = 0;

    for (const seed of SEEDS) {
      const ctx = bootstrap(bundle, seed, 1042);
      for (let year = 1042; year < END; year += EVERY) {
        runYears(ctx, Math.min(EVERY, END - year));
        checkpoints += 1;
        for (const v of worldViolations(ctx)) {
          if (v.rule === PINNED.rule && PINNED.matches.test(v.detail)) { pinned += 1; continue; }
          const seen = tally.get(v.rule);
          if (seen) seen.n += 1;
          else tally.set(v.rule, { n: 1, first: v.detail, when: ctx.world.year });
        }
      }
    }

    // The scan has to have actually looked at something.
    expect(checkpoints).toBe(SEEDS.length * Math.ceil((END - 1042) / EVERY));

    const report = [...tally.entries()]
      .map(([rule, { n, first, when }]) => `  ${rule} × ${n} — first in ${when}: ${first}`)
      .join('\n');
    expect([...tally.keys()], `the world came apart across ${checkpoints} checkpoints:\n${report}`)
      .toEqual([]);

    /**
     * AND THE PIN IS EXACTLY AS TIGHT AS IT WAS. Both directions are
     * failures with instructions, because both mean this comment is now
     * lying about the game.
     */
    expect(
      pinned,
      pinned === 0
        ? 'The guardian redirect no longer leaves his widow married to him — somebody fixed '
          + 'it. Delete PINNED and the test in world-health.test.ts that pins the mechanism, '
          + 'and record in docs/BALANCE-LOG.md what the fix did to the run: measured, it '
          + 'moved the digest on 3 of 4 seeds.'
        : `The half-closed vow now shows up at ${pinned} checkpoints, not ${PINNED.checkpoints}. `
          + 'A pinned bug that is spreading is not pinned. Find what widened it before '
          + 'updating this number.',
    ).toBe(PINNED.checkpoints);
  });

  /**
   * The assertion form, on the run a player would actually finish. Same
   * rules; this one exists so the failure message is the readable one, and
   * so `expectHealthyWorld` itself is exercised rather than only its
   * underlying list.
   */
  it('and the world a player finishes in 2042 is coherent', () => {
    for (const seed of [2200, 2297, 2394]) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, END - 1042);
      expect(ctx.world.year).toBe(END);
      expectHealthyWorld(ctx);
    }
  });

  /**
   * A HOUSE THAT EMPTIED IS NOT A HOUSE THAT PASSED.
   *
   * Every check above is a predicate over the people who exist, so a run that
   * went extinct in 1150 satisfies all of them trivially — the failure this
   * repository is named for, arriving through the front door of the test
   * written to catch it. So the batch has to be alive as well as coherent.
   */
  it('and the runs it judged had people in them', () => {
    const sizes = SEEDS.map((seed) => {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, END - 1042);
      return ctx.world.people.household(ctx.world.playerHouse, ctx.world.year).length;
    });
    const alive = sizes.filter((n) => n > 0).length;
    expect(alive, `households at 2042: [${sizes.join(', ')}]`).toBeGreaterThan(SEEDS.length / 2);
  });
});
