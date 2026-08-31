import { beforeAll, describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { newGame } from '@ed/core';

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

  it('deals the Match about once a generation, not once every six years', () => {
    // Forty generations, one chapter each (concept §5). It was 171.
    for (const { seed, b } of runs) {
      expect(b.match, `seed ${seed} dealt ${b.match} hands`).toBeGreaterThan(15);
      expect(b.match, `seed ${seed} dealt ${b.match} hands`).toBeLessThan(80);
    }
  });

  /**
   * Both lines are measurements rather than round numbers, which is the whole
   * repair. Twelve thousand-year runs: the choice share means 53%, the largest
   * kind in every run is `choice`, and no run in twelve went past 57.8%. So a
   * BATCH over 58% is a kind eating the run, and a SEED at 58% is a Tuesday —
   * and the old assertion could not tell those apart because it only ever saw
   * one seed.
   */
  it('never lets one kind of prompt own the run', () => {
    for (const kind of ['choice', 'match', 'record', 'name']) {
      const mean = shares.reduce((a, s) => a + s.of(kind), 0) / shares.length;
      expect(mean, `${kind} is ${Math.round(100 * mean)}% of everything asked, across the batch`)
        .toBeLessThan(0.58);
      for (const s of shares) {
        expect(s.of(kind), `seed ${s.seed}: ${kind} is ${Math.round(100 * s.of(kind))}% of its run`)
          .toBeLessThan(0.65);
      }
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
