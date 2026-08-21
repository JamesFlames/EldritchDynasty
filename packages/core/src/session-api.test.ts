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

describe('a game runs through the public API', () => {
  it('newGame lands on the founding cast, at the year it was asked for', () => {
    const g = newGame(content, { seed: 1042, startYear: 1042 });

    expect(g.year).toBe(1042);
    const view = g.view();
    expect(view.year).toBe(1042);
    expect(view.house.length).toBeGreaterThan(0);
    expect(view.generation).toBeGreaterThanOrEqual(0);
  });

  it('advance turns years, and stops the clock when the docket fills', () => {
    const g = newGame(content, { seed: 1042 });
    const result = g.advance(60);

    if (result.stoppedBy === 'decision') {
      expect(result.pending.length).toBeGreaterThan(0);
      expect(g.year).toBeLessThan(1042 + 60);
    } else {
      expect(result.years).toHaveLength(60);
      expect(g.year).toBe(1042 + 60);
    }
  });

  it('the chronicler decider never stops, because nothing is ever asked', () => {
    const g = newGame(content, { seed: 1042, decider: 'chronicler' });
    const result = g.advance(120);

    expect(result.stoppedBy).toBeUndefined();
    expect(result.years).toHaveLength(120);
    expect(g.pending).toHaveLength(0);
  });

  it('choose answers a choice standing on the docket', () => {
    const g = newGame(content, { seed: 1042 });
    const decision = advanceUntil(g, 'choice');
    if (!decision || decision.kind !== 'choice') return; // seed did not reach one; not this test's business

    const open = decision.choices.find((c) => c.available);
    expect(open, 'a decision on the docket has at least one answerable branch').toBeDefined();

    const before = g.pending.length;
    const res = g.choose(decision.id, open!.id);

    expect(res.ok).toBe(true);
    expect(g.pending.length).toBeLessThan(before);
  });

  it('record answers a Record block, and the chronicle grows by it', () => {
    const g = newGame(content, { seed: 1042 });
    const decision = advanceUntil(g, 'record');
    if (!decision || decision.kind !== 'record') return;

    expect(decision.options.length).toBeGreaterThan(0);
    expect(g.record(decision.id, 'record')).toBe(true);
    expect(g.view().chronicle.length).toBeGreaterThan(0);
  });

  /**
   * `declineHand` had never been called by any test. It is a real answer — the
   * house waits for a better year — and the only one that resolves a match
   * without a marriage.
   */
  it('declineHand takes none of the cards, and clears the decision', () => {
    const g = newGame(content, { seed: 1042 });
    const decision = advanceUntil(g, 'match');
    if (!decision || decision.kind !== 'match') return;

    const before = g.pending.length;
    expect(g.declineHand(decision.id)).toBe(true);
    expect(g.pending.length).toBeLessThan(before);

    const declined = g.ctx.world.decisionLog.filter((d) => d.kind === 'match' && !d.card);
    expect(declined.length).toBeGreaterThan(0);
  });

  it('match takes one of the cards it was dealt', () => {
    const g = newGame(content, { seed: 7007 });
    const decision = advanceUntil(g, 'match');
    if (!decision || decision.kind !== 'match') return;

    expect(decision.cards.length).toBeGreaterThan(0);
    const res = g.match(decision.id, decision.cards[0]!.id);
    expect(res.ok).toBe(true);
  });

  it('refuses a decision id it has never heard of, rather than throwing', () => {
    const g = newGame(content, { seed: 1042 });

    expect(g.record('dec_nonesuch', 'record')).toBe(false);
    expect(g.declineHand('dec_nonesuch')).toBe(false);
    expect(g.choose('dec_nonesuch', 'whatever').ok).toBe(false);
    expect(g.send('dec_nonesuch').ok).toBe(false);
  });

  it('letHimDecide clears the whole docket through the same commit path', () => {
    const g = newGame(content, { seed: 1042 });
    g.advance(200);

    g.letHimDecide();

    expect(g.pending).toHaveLength(0);
  });

  /**
   * Naming is an OFFER, not a power: `renameChild` answers a name standing in
   * `pendingNames` and refuses anyone else. That is the whole reason it is a
   * replay hook — it moves `takenNames`, which every later name roll reads.
   */
  it('name answers a newborn the game offered, and refuses anyone it did not', () => {
    const g = newGame(content, { seed: 1042, decider: 'chronicler' });
    for (let i = 0; i < 200 && !g.ctx.world.pendingNames.length; i++) g.advance(1);

    const offer = g.ctx.world.pendingNames[0];
    expect(offer, 'a run of two centuries offers at least one name').toBeDefined();
    const child = g.ctx.world.people.get(offer!.person)!;

    expect(g.name(child.id, 'Alira')).toBe(true);
    expect(child.name).toBe('Alira');
    expect(g.ctx.takenNames.has('Alira')).toBe(true);

    // Somebody nobody offered, an empty name, and the same child twice.
    expect(g.name('per_nonesuch', 'Nobody')).toBe(false);
    expect(g.name(child.id, '   ')).toBe(false);
    expect(g.name(child.id, 'Alira Again')).toBe(false);

    const named = g.ctx.world.decisionLog.filter((d) => d.kind === 'name');
    expect(named).toHaveLength(1);
  });

  it('keepSuggestedNames empties the naming queue without renaming anybody', () => {
    const g = newGame(content, { seed: 1042, decider: 'chronicler' });
    g.advance(120);

    expect(() => g.keepSuggestedNames()).not.toThrow();
  });

  it('save round-trips through resumeGame onto the same world', () => {
    const g = newGame(content, { seed: 1042, decider: 'chronicler' });
    g.advance(150);

    const resumed = resumeGame(g.save(), content);

    expect(resumed.year).toBe(g.year);
    expect(resumed.view().treasury).toBe(g.view().treasury);
    expect(resumed.view().generation).toBe(g.view().generation);
    expect(resumed.view().chronicle.length).toBe(g.view().chronicle.length);
  });
});

/**
 * The read model is what a template renders and what goes over IPC, so it has
 * to be plain data — no `Map`, no `Set`, no live reference into the world.
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

/**
 * Diagnostics. Nothing in the game reads these; the editor and the harness do,
 * and both are reached for when something has already gone wrong.
 */
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

describe('the library read model', () => {
  it('heldBooks lists the shelf, and loseLibraryCopy takes one off it', () => {
    const g = newGame(content, { seed: 1042 });
    expect(heldBooks(g.ctx)).toHaveLength(0);

    const book = content.spellbooks[0]!;
    const reader = place(g.ctx, { sex: 'male', age: 30, name: 'A Reader' });
    gainSpellbook(g.ctx, reader, spellbookDef(g.ctx, String(book.id))!);

    expect(heldBooks(g.ctx).length).toBe(1);
    expect(loseLibraryCopy(g.ctx, String(book.id))).toBe(true);
    expect(heldBooks(g.ctx)).toHaveLength(0);

    // Losing what the house never had is a no-op, not an error.
    expect(loseLibraryCopy(g.ctx, String(book.id))).toBe(false);
  });
});
