import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import {
  branchReport, describeDecision, frequencyReport, hallOf, heldBooks, loseLibraryCopy,
  newGame, place, resumeGame, spellbookDef, gainSpellbook, viewOf,
  type GameSession,
} from '@ed/core';

const content = loadContent();

/**
 * THE FAÇADE, DRIVEN THE WAY A CLIENT DRIVES IT.
 *
 * The simulation underneath is well covered. The API over it was not: one
 * function in five on `GameSession` had never been called by anything, and the
 * gaps were not scattered — they were the verbs a UI needs and the harness's
 * own diagnostics. `declineHand` is a real move a player can make. `hallOf`,
 * `branchReport` and `frequencyReport` are what the editor's Instruments tab
 * reads. `describeDecision` is what the harness prints when it is bisecting a
 * run, which is to say the thing you reach for when something is already
 * wrong — the worst possible moment to find out it throws.
 *
 * This drives a short game through the public surface and asserts each verb
 * returns something coherent. It is deliberately not a balance test: it does
 * not care what happens, only that asking produces an answer.
 */

/** Turn years until the docket has something of `kind` on it, or give up. */
function advanceUntil(g: GameSession, kind: 'choice' | 'record' | 'match', limit = 400) {
  for (let i = 0; i < limit; i++) {
    const found = g.pending.find((p) => p.kind === kind);
    if (found) return found;
    const before = g.year;
    g.advance(1);
    // A docket that stops the clock means `advance` returned without turning
    // the year. Answer nothing here — the caller decides what to do with it.
    if (g.year === before && !g.pending.length) return undefined;
  }
  return undefined;
}
/**
 * THE READ MODEL AND THE DIAGNOSTICS, OVER WHOLE RUNS.
 *
 * Both of these describes need centuries of accumulated world before there is
 * anything to report on — halls that have died out, every frequency tier
 * fired, every kind of decision in the log. The API contract itself does not,
 * and stays in `session-api.test.ts`.
 *
 * The line between the two files: a test whose cost is the SIMULATION moves
 * here; a test whose cost is the CALL stays there, even when it turns a few
 * dozen years to get something to call about.
 */
describe('the read model is plain data', () => {
  it('viewOf survives JSON, which is the actual requirement', () => {
    const g = newGame(content, { seed: 1042, decider: 'chronicler' });
    g.advance(200);

    const view = viewOf(g.ctx);
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
  });

  it('viewOf takes how much chronicle to hand back', () => {
    const g = newGame(content, { seed: 1042, decider: 'chronicler' });
    g.advance(200);

    expect(viewOf(g.ctx, 3).chronicle.length).toBeLessThanOrEqual(3);
  });
});

describe('the diagnostics answer', () => {
  it('hallOf names the household a person is living in, and nothing for a stranger', () => {
    const g = newGame(content, { seed: 1042, decider: 'chronicler' });
    g.advance(200);

    const anyone = g.ctx.world.people.living()[0]!;
    expect(typeof hallOf(g.ctx, anyone.id)).toBe('string');
    expect(hallOf(g.ctx, 'per_nonesuch')).toBeUndefined();
  });

  it('branchReport describes every hall, living and extinct alike', () => {
    const g = newGame(content, { seed: 1042, decider: 'chronicler' });
    g.advance(400);

    const report = branchReport(g.ctx);
    expect(Array.isArray(report)).toBe(true);
    for (const b of report) {
      expect(typeof b.id).toBe('string');
      expect(typeof b.name).toBe('string');
      expect(b.members).toBeGreaterThanOrEqual(0);
      expect(b.grievance).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(b.grievance), 'rounded for display').toBe(true);
    }
  });

  it('frequencyReport covers every tier, with a pool and a fired count', () => {
    const g = newGame(content, { seed: 1042, decider: 'chronicler' });
    g.advance(300);

    const report = frequencyReport(g.ctx);
    const tiers = Object.keys(report);
    expect(tiers.length).toBeGreaterThan(0);

    let pooled = 0;
    for (const tier of tiers) {
      const row = report[tier as keyof typeof report]!;
      expect(row.pool).toBeGreaterThanOrEqual(0);
      expect(row.fired).toBeGreaterThanOrEqual(0);
      expect(typeof row.barred).toBe('boolean');
      pooled += row.pool;
    }
    expect(pooled, 'every authored event sits in exactly one tier').toBe(g.ctx.content.events.length);
  });

  /** What the harness prints to bisect a run. One line per decision, all four kinds. */
  it('describeDecision renders every kind the log can hold', () => {
    const g = newGame(content, { seed: 1042, decider: 'chronicler' });
    g.advance(400);

    const log = g.ctx.world.decisionLog;
    expect(log.length).toBeGreaterThan(0);

    const kinds = new Set<string>();
    for (const d of log) {
      const line = describeDecision(d);
      expect(line.length).toBeGreaterThan(0);
      expect(line).toContain(String(d.year));
      kinds.add(d.kind);
    }
    expect(kinds.size, 'a long run exercises more than one kind of decision').toBeGreaterThan(1);
  });

  it('describeDecision refuses a kind it does not know, rather than printing nothing', () => {
    expect(() => describeDecision({ kind: 'invented', year: 1200 } as never))
      .toThrow(/logged decision/);
  });
});
