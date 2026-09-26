import { describe, expect, it } from 'vitest';
import type { EventTemplate } from '@ed/schema';
import type { PendingChoice, PendingRecord } from './events/decisions.js';
import type { SimCtx } from './world.js';
import { delegatedChoice, delegatedRecord, mustSurface } from './delegation.js';

function event(overrides: Partial<EventTemplate> = {}): EventTemplate {
  return {
    id: 'the_small_account',
    title: 'The small account',
    tier: 'individual',
    frequency: 'common',
    weight: 100,
    repeatable: true,
    cooldownYears: 0,
    tags: [],
    purposes: ['change_standing', 'worldbuild_through_action', 'change_relationship'],
    slots: {},
    checks: [],
    reads: [],
    body: 'A small thing happened.',
    interaction: {
      kind: 'choice',
      decidedBy: 'player',
      choices: [
        { id: 'leave_it', label: 'Leave it', requires: [], outcomes: [{ id: 'left', weight: 100, text: 'It was left.', tags: [], effects: [] }] },
        { id: 'do_it', label: 'Do it', requires: [], outcomes: [{ id: 'done', weight: 100, text: 'It was done.', tags: [], effects: [] }] },
      ],
    },
    accounts: [],
    ...overrides,
  };
}

function ctx(): SimCtx {
  return {
    world: {
      scion: null,
      scionHeir: null,
      delegation: { choices: { the_small_account: 'do_it' }, records: { the_small_account: 'record' } },
      people: { living: () => [] },
    },
  } as unknown as SimCtx;
}

function choice(e = event()): PendingChoice {
  return {
    kind: 'choice',
    id: 'dec_1',
    year: 1200,
    event: e,
    body: e.body,
    fill: {},
    choices: [
      { id: 'leave_it', label: 'Leave it', available: true },
      { id: 'do_it', label: 'Do it', available: true },
    ],
    cast: [],
    decidedBy: 'player',
    choicesAreOpen: true,
  };
}

function record(e = event({ record: {
  subject: 'the account',
  options: {
    record: { chronicle: 'It happened.', effects: [], claims: [] },
    omit: { chronicle: null, effects: [] },
    embellish: {
      chronicle: 'It was magnificent.', effects: [], claims: [],
      discrepancy: { id: 'account_lie', severity: 'minor', provableBy: ['house_bramme'] },
    },
  },
} })): PendingRecord {
  return {
    kind: 'record',
    id: 'dec_2',
    year: 1200,
    event: e,
    subject: 'the account',
    options: [
      { option: 'record', chronicle: 'It happened.' },
      { option: 'omit', chronicle: null },
      { option: 'embellish', chronicle: 'It was magnificent.', discrepancy: 'account_lie' },
    ],
    entryId: 'chr_1',
    fill: {},
  };
}

describe('delegation interruption guard (#219)', () => {
  it('delegates only the exact available answer the player remembered', () => {
    expect(mustSurface(ctx(), choice())).toBeUndefined();
    expect(delegatedChoice(ctx(), choice())).toBe('do_it');
  });

  it.each([
    ['rare', { frequency: 'rare' as const }],
    ['sacrifice', { id: 'the_sacrifice' }],
    ['rite', { id: 'the_great_rite' }],
    ['discrepancy', { tags: ['discrepancy'] }],
    ['ambition', { tags: ['house_ambition'] }],
    ['ending', { tags: ['ascension'] }],
  ])('surfaces %s decisions', (_name, change) => {
    expect(mustSurface(ctx(), choice(event(change)))).toBeDefined();
  });

  it('surfaces a cast decision and an arc decision', () => {
    const cast = choice();
    cast.cast = [{ slot: 'CHILD', optional: false, candidates: [] }];
    expect(mustSurface(ctx(), cast)).toBe('cast');

    const arc = choice();
    arc.arcStep = {} as PendingChoice['arcStep'];
    expect(mustSurface(ctx(), arc)).toBe('arc');
  });

  it('surfaces a decision involving the Head, Scion, or named heir', () => {
    const c = ctx();
    c.world.scion = 'p_scion';
    const d = choice();
    d.fill = { SUBJECT: 'p_scion' };
    expect(mustSurface(c, d)).toBe('heir');
  });

  it('delegates only the plain Record policy; omission and embellishment surface', () => {
    const c = ctx();
    const d = record();
    // A Record block's possible embellishment is not itself an active
    // Discrepancy; choosing embellish is nevertheless never delegatable.
    expect(delegatedRecord(c, d)).toBe('record');
    c.world.delegation.records.the_small_account = 'omit';
    expect(delegatedRecord(c, d)).toBeUndefined();
  });
});
