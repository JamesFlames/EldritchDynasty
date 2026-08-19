import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import type { Decider, EventTemplate, Person } from '@ed/schema';
import { decideBranch, place, testRng, testWorld, wantsPlayerCast } from '@ed/core';

const bundle = loadContent();

/**
 * WHO TAKES THE BRANCH (`schema/src/decider.ts`, `core/src/events/deciders.ts`).
 *
 * These are direct tests of the evaluator. The properties that matter are not
 * "the right rung fires" — that is arithmetic — but the two that make the
 * feature safe to author against: EVERY PATH RESOLVES, because a decision with
 * no answer stops the clock permanently (invariant 9); and the player's path
 * and the chronicler's use the same evaluator, so a delegated decision cannot
 * mean one thing in the game and another in the harness.
 */

/** INVARIANT 6: a direct write to `acquired` has to dirty the cached phenotype. */
function setAcquired(p: Person, key: string, value: number): void {
  p.acquired[key] = value;
  if (p.phenotype) p.phenotype.dirty = true;
}

/** A two-branch event, with everything but the decider held constant. */
function twoBranch(decidedBy: Decider): EventTemplate {
  return {
    id: 'test_two_branch',
    title: 'Two Ways About It',
    tier: 'family',
    frequency: 'uncommon',
    weight: 100,
    repeatable: true,
    cooldownYears: 0,
    tags: [],
    purposes: ['change_standing', 'change_relationship', 'buy_patience'],
    slots: {},
    checks: [],
    reads: [],
    body: 'A body long enough to be a body and not a note, which the shape rule asks for.',
    accounts: [],
    interaction: {
      kind: 'choice',
      decidedBy,
      choices: [
        { id: 'pay', label: 'Pay it', requires: [], outcomes: [{ id: 'paid', weight: 100, text: 'Paid.', tags: ['costly'], effects: [] }] },
        { id: 'refuse', label: 'Refuse', requires: [], outcomes: [{ id: 'refused', weight: 100, text: 'Refused.', tags: [], effects: [] }] },
      ],
    },
  } as EventTemplate;
}

describe('the player decides', () => {
  it('asks, and names no branch itself', () => {
    const ctx = testWorld(bundle);
    const d = decideBranch(ctx, twoBranch('player'), {}, testRng());
    expect(d.asks).toBe(true);
    expect(d.choice).toBeUndefined();
  });
});

describe('chance decides', () => {
  it('takes a branch without asking', () => {
    const ctx = testWorld(bundle);
    const d = decideBranch(ctx, twoBranch('chance'), {}, testRng());
    expect(d.asks).toBe(false);
    expect(['pay', 'refuse']).toContain(d.choice?.id);
  });
});

describe('the family\'s condition decides', () => {
  it('takes the first rung whose guard holds', () => {
    const ctx = testWorld(bundle);
    ctx.world.treasury = 5;
    const e = twoBranch({
      state: [
        { when: { treasury: { op: 'lt', value: 100 } }, take: 'refuse', because: 'the coffer is empty' },
        { take: 'pay' },
      ],
    });
    const d = decideBranch(ctx, e, {}, testRng());
    expect(d.choice?.id).toBe('refuse');
    expect(d.why).toBe('the coffer is empty');
    expect(d.asks).toBe(false);
  });

  it('falls past a rung whose guard fails, to the unguarded else', () => {
    const ctx = testWorld(bundle);
    ctx.world.treasury = 5000;
    const e = twoBranch({
      state: [
        { when: { treasury: { op: 'lt', value: 100 } }, take: 'refuse' },
        { take: 'pay' },
      ],
    });
    expect(decideBranch(ctx, e, {}, testRng()).choice?.id).toBe('pay');
  });

  it('still resolves when no rung holds at all', () => {
    // A ladder every rung of which is guarded, and none of which holds. This
    // must not return nothing: invariant 9 means an unanswered decision stops
    // the clock for good, so the fallback is a weighted draw, not a stall.
    const ctx = testWorld(bundle);
    ctx.world.treasury = 5000;
    const e = twoBranch({ state: [{ when: { treasury: { op: 'lt', value: 100 } }, take: 'refuse' }] });
    const d = decideBranch(ctx, e, {}, testRng());
    expect(d.asks).toBe(false);
    expect(d.choice).toBeDefined();
    expect(d.why).toContain('no rung');
  });

  it('skips a rung naming a branch the house is not able to take', () => {
    // The ladder says what the house WOULD do. It cannot do what `requires`
    // bars it from, so that rung is not an answer — the next one is.
    const ctx = testWorld(bundle);
    const weakling = place(ctx, { sex: 'male', age: 30 });
    setAcquired(weakling, 'strength', -200);

    const e = twoBranch({ state: [{ take: 'pay' }, { take: 'refuse' }] });
    e.slots = { CHAMPION: { role: 'family_member', castBy: 'engine', optional: false, filters: [], bind: 'event' } };
    if (e.interaction.kind === 'choice') {
      e.interaction.choices[0]!.requires = [{ slot: 'CHAMPION', attr: 'strength', op: 'gte', value: 500 }];
    }
    expect(decideBranch(ctx, e, { CHAMPION: weakling.id }, testRng()).choice?.id).toBe('refuse');
  });
});

describe('the party the player names decides', () => {
  /** A dispatch event: the player casts COMPANION, and a check over him picks the branch. */
  function partyEvent(): EventTemplate {
    const e = twoBranch({ party: { check: 'the_pull' } });
    e.slots = { COMPANION: { role: 'family_member', castBy: 'player', optional: false, filters: [], bind: 'event' } };
    e.checks = [{
      id: 'the_pull',
      pool: { kind: 'party_sum', slots: ['COMPANION'], attr: 'strength' },
      difficulty: 40,
      variance: 'none',
      // Bands name BRANCHES here, not outcomes. That is the whole difference
      // between a check that decides and a check that resolves.
      bands: [{ atLeast: 0, outcome: 'pay' }, { atLeast: -999, outcome: 'refuse' }],
    }];
    return e;
  }

  it('asks for the cast before it will decide anything', () => {
    const ctx = testWorld(bundle);
    const e = partyEvent();
    expect(wantsPlayerCast(e)).toBe(true);
    const d = decideBranch(ctx, e, {}, testRng());
    expect(d.asks).toBe(true);
    expect(d.choice).toBeUndefined();
  });

  it('picks the band the party clears, once the party is named', () => {
    const ctx = testWorld(bundle);
    const strong = place(ctx, { sex: 'male', age: 30 });
    setAcquired(strong, 'strength', 400);
    const d = decideBranch(ctx, partyEvent(), { COMPANION: strong.id }, testRng(), { castReady: true });
    expect(d.choice?.id).toBe('pay');
    expect(d.asks).toBe(false);
  });

  it('picks the lower band when the party cannot clear the bar', () => {
    const ctx = testWorld(bundle);
    const weak = place(ctx, { sex: 'female', age: 70 });
    setAcquired(weak, 'strength', -400);
    expect(decideBranch(ctx, partyEvent(), { COMPANION: weak.id }, testRng(), { castReady: true }).choice?.id)
      .toBe('refuse');
  });

  it('resolves rather than stalling when the check names nothing real', () => {
    const ctx = testWorld(bundle);
    const p = place(ctx, { sex: 'male', age: 30 });
    const e = partyEvent();
    e.checks[0]!.bands = [{ atLeast: -999, outcome: 'a_branch_that_is_not_here' }];
    const d = decideBranch(ctx, e, { COMPANION: p.id }, testRng(), { castReady: true });
    expect(d.choice).toBeDefined();
    expect(d.why).toContain('not one of the branches');
  });

  it('resolves rather than stalling when the check was never declared', () => {
    const ctx = testWorld(bundle);
    const p = place(ctx, { sex: 'male', age: 30 });
    const e = partyEvent();
    e.checks = [];
    const d = decideBranch(ctx, e, { COMPANION: p.id }, testRng(), { castReady: true });
    expect(d.choice).toBeDefined();
    expect(d.why).toContain('not declared');
  });
});

describe('narration', () => {
  it('is not a decision and does not pretend to be one', () => {
    const ctx = testWorld(bundle);
    const e = twoBranch('player');
    e.interaction = { kind: 'narration', outcomes: [{ id: 'only', weight: 100, text: 'It happened.', tags: [], effects: [] }] };
    const d = decideBranch(ctx, e, {}, testRng());
    expect(d.asks).toBe(false);
    expect(d.choice).toBeUndefined();
  });
});
