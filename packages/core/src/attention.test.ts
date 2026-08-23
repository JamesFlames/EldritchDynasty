import { describe, expect, it } from 'vitest';
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
        if (g.ctx.world.pendingDecisions[0] === d) {
          if (!g.letHimDecide(d.id)) g.ctx.world.pendingDecisions.shift();
        }
      }
      counts.name! += g.ctx.world.pendingNames.length;
      for (const n of [...g.ctx.world.pendingNames]) g.name(n.person, n.suggested);
    }
    return counts;
  }

  it('deals the Match about once a generation, not once every six years', () => {
    // Forty generations, one chapter each (concept §5). It was 171.
    for (const seed of [4101, 4102]) {
      const b = budget(seed);
      expect(b.match, `seed ${seed} dealt ${b.match} hands`).toBeGreaterThan(15);
      expect(b.match, `seed ${seed} dealt ${b.match} hands`).toBeLessThan(80);
    }
  });

  it('never lets one kind of prompt own the run', () => {
    const b = budget(4103);
    const total = Object.values(b).reduce((a, n) => a + n, 0);
    for (const [kind, n] of Object.entries(b)) {
      expect(n / total, `${kind} is ${Math.round((100 * n) / total)}% of everything asked`)
        .toBeLessThan(0.55);
    }
  });

  it('asks about the record often enough to be the thesis it claims to be', () => {
    // Once a generation or better. Record / Omit / Embellish is the mechanical
    // form of "the chronicle is evidence and the player is falsifying it".
    const b = budget(4104);
    expect(b.record).toBeGreaterThan(25);
  });
});
