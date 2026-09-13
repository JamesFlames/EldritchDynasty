import { beforeAll, describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { newGame,
  expectMean,
} from '@ed/core';

/**
 * THE ATTENTION BUDGET.
 *
 * One run is eight to twelve hours. What the player is asked in that time is a
 * resource with a fixed size, and it was being spent on the two cheapest
 * questions in the game: 686 naming prompts and 171 hands of the Match, against
 * 37 Record choices — the mechanical form of the entire thesis (concept §6).
 * That is one interruption every thirty seconds, fifty-nine percent of them a
 * baby's name.
 *
 * These are shape assertions, not thresholds pinned to a seed. They say the
 * Match is a chapter beat rather than a dialog box, and that no single prompt
 * kind eats the run.
 */
describe('what the player is asked, across a thousand years', () => {
  const content = loadContent();

  /**
   * ONE BATCH, THREE QUESTIONS. Every assertion below is a batch statistic, so
   * every one of them was being asked of one or two runs and answered by a
   * coin. `never lets one kind of prompt own the run` went red the day the
   * ladder's book gates were renormalised — and measured over six seeds either
   * side of that change the mean share did not move at all (53.0% before,
   * 52.9% after). What moved was seed 4103, from 53.0 to 57.8, while seed 4108
   * moved the other way, 54.7 to 49.1. The per-seed spread is five points and
   * the line was two points above the mean.
   *
   * Running the seeds once and sharing them costs nothing: the file drew four
   * runs across three tests before and draws six for all three now.
   */
  function budget(seed: number) {
    const g = newGame(content, { seed });
    const counts: Record<string, number> = { choice: 0, match: 0, record: 0, name: 0 };
    let guard = 0;
    while (g.year < 2042 && guard++ < 100_000) {
      g.advance(2042 - g.year);
      let inner = 0;
      while (g.ctx.world.pendingDecisions.length && inner++ < 500) {
        const d = g.ctx.world.pendingDecisions[0]!;
        counts[d.kind] = (counts[d.kind] ?? 0) + 1;
        if (d.kind === 'match') {
          if (d.cards[0]) g.match(d.id, d.cards[0].id);
          else g.declineHand(d.id);
        } else if (d.kind === 'record') {
          g.record(d.id, 'record');
        } else if (!d.choicesAreOpen) {
          g.send(d.id, {});
        } else {
          g.choose(d.id, d.choices[0]!.id);
        }
        // Never leave the docket standing: a decision with no answer stops the
        // clock for good (invariant 9), and this loop would spin on it.
        if (g.ctx.world.pendingDecisions[0] === d) g.letHimDecide();
      }
      counts.name! += g.ctx.world.pendingNames.length;
      for (const n of [...g.ctx.world.pendingNames]) g.name(n.person, n.suggested);
    }
    return counts;
  }

  const SEEDS = [4101, 4102, 4103, 4104, 4105, 4106];
  let runs: { seed: number; b: Record<string, number> }[] = [];
  let shares: { seed: number; of: (kind: string) => number }[] = [];

  beforeAll(() => {
    runs = SEEDS.map((seed) => ({ seed, b: budget(seed) }));
    shares = runs.map(({ seed, b }) => {
      const total = Object.values(b).reduce((a, n) => a + n, 0);
      return { seed, of: (kind: string) => (b[kind] ?? 0) / total };
    });
  }, 600_000);

  /**
   * THE CEILING IS PER SEED; THE FLOOR IS A BATCH CLAIM (issue #113 found this).
   *
   * The ceiling is the regression this test was built for — 171 hands a run,
   * one every six years — and a single run going there is the failure, so it
   * stays an every-seed assertion. The FLOOR is a different kind of sentence:
   * "the Match is still dealt about once a generation" is a claim about the
   * game, not about seed 4104, and it was written as a bare
   * `toBeGreaterThan` on a per-seed count. AGENTS.md's rule is explicit that
   * a batch claim goes through `expectMean` or `expectRate`, and this is why:
   * an unrelated change to the allele draw ORDER (with the frequencies
   * provably unchanged — `allele-draw.test.ts`) re-rolled which people each
   * seed produces, and seed 4104 came back with 11 while the batch stayed
   * where it has always been. A floor that one seed in six can trip is
   * measuring the draw, not the design.
   */
  it('deals the Match about once a generation, not once every six years', () => {
    // Forty generations, one chapter each (concept §5). It was 171.
    for (const { seed, b } of runs) {
      expect(b.match, `seed ${seed} dealt ${b.match} hands`).toBeLessThan(80);
    }
    expectMean({
      values: runs.map(({ b }) => b.match ?? 0),
      floor: 15,
      what: 'hands dealt across a thousand years',
    });
  });

  /**
   * WHAT THE OLD CEILING WAS ACTUALLY MEASURING (issue #62).
   *
   * It read: *"the choice share means 53%, and no run in twelve went past
   * 57.8%, so a BATCH over 58% is a kind eating the run."* Both numbers were
   * honest measurements. Neither meant what the test's name says.
   *
   * Naming was 37% of the budget, and naming was a form — 189 prompts a run
   * for children who mostly died unremarked. It was padding the denominator.
   * Take it out, as #62 does, and `choice` reads 75.3% across this batch
   * without a single extra choice event firing: the counts here are 280-308,
   * where the pre-cut measurement was 285.8.
   *
   * So `choice` has always been about four-fifths of the DECISIONS in this
   * game, and the assertion that no kind owned the run passed only because a
   * form was standing in the way of noticing. That is worth knowing and it is
   * not a regression, so this no longer pretends a 58% ceiling is meaningful.
   *
   * WHAT IS GUARDED NOW, and both are measured over these six seeds:
   *
   *   `choice` at 75.3% mean and 79.5% worst seat. A batch past 82% is a
   *   choice tide rising against everything else, which is the regression
   *   this can actually catch.
   *
   *   `name` under a tenth of the budget. That is #62's rule expressed as a
   *   share rather than a count, and it is the one that would silently come
   *   undone: a new prompt reason that fires for every child restores the
   *   form without changing a single number anybody looks at.
   *
   * That choice IS three-quarters of what a player does is a real finding and
   * a live question for #65 and #66, not something this file should bless.
   */
  it('does not let the choice tide rise any further', () => {
    expectMean({
      values: shares.map((s) => s.of('choice')),
      ceiling: 0.82,
      what: "choice's share of everything asked, across the batch",
    });
    for (const s of shares) {
      expect(s.of('choice'), `seed ${s.seed}: choice is ${Math.round(100 * s.of('choice'))}% of its run`)
        .toBeLessThan(0.86);
    }
  });

  it('keeps naming a reward rather than a form', () => {
    expectMean({
      values: shares.map((s) => s.of('name')),
      ceiling: 0.1,
      what: "naming's share of everything asked, across the batch",
    });
    // And the count, because a share falls just as well by the rest of the
    // game getting noisier — which would not be this rule holding.
    for (const { seed, b } of runs) {
      expect(b.name, `seed ${seed} asked for ${b.name} names`).toBeLessThan(45);
    }
  });

  it('asks about the record often enough to be the thesis it claims to be', () => {
    // Once a generation or better. Record / Omit / Embellish is the mechanical
    // form of "the chronicle is evidence and the player is falsifying it".
    for (const { seed, b } of runs) {
      expect(b.record, `seed ${seed} asked about the record ${b.record} times`).toBeGreaterThan(25);
    }
  });
});
