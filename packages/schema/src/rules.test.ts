import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { CONTENT_RULES, runRule, validateBundle, type ContentBundle } from '@ed/schema';

const content = loadContent();

/**
 * Validation used to be one function, so testing a rule meant running every
 * rule against the whole game and grepping the output for a phrase. These run
 * one rule against a bundle built to break it, which is the point of the
 * registry.
 */
describe('the content rules', () => {
  it('all have a distinct id and a sentence saying what they are for', () => {
    const ids = CONTENT_RULES.map((r) => r.id);
    expect(new Set(ids).size, `duplicate rule id in ${ids.join(', ')}`).toBe(ids.length);
    for (const rule of CONTENT_RULES) {
      expect(rule.about.length, rule.id).toBeGreaterThan(20);
      expect(rule.id, 'rule ids are slash-cased so they group').toMatch(/^[a-z]+\/[a-z-]+$/);
    }
  });

  it('stamp every issue with the rule that raised it', () => {
    for (const issue of validateBundle(content)) {
      expect(CONTENT_RULES.some((r) => r.id === issue.rule), issue.message).toBe(true);
    }
  });

  it('pass the shipped content with no errors', () => {
    const errors = validateBundle(content).filter((i) => i.level === 'error');
    expect(errors, errors.map((e) => `${e.rule} ${e.where}: ${e.message}`).join('\n')).toHaveLength(0);
  });

  it('runs one rule alone, and refuses a name it does not know', () => {
    expect(() => runRule('no/such-rule', content)).toThrow(/no validation rule/);
    expect(runRule('ids/unique', content)).toHaveLength(0);
  });

  // ── Rules that must actually fire ───────────────────────────────────────

  /**
   * A bundle with two events sharing an id. Built by mutating the real one,
   * because a rule that only passes against a toy bundle has not been tested
   * against anything the game would load.
   */
  const withEvents = (mutate: (b: ContentBundle) => void): ContentBundle => {
    const b = structuredClone(content.bundle);
    mutate(b);
    return b;
  };

  it('catches a duplicated event id', () => {
    const b = withEvents((x) => { x.events.push(structuredClone(x.events[0]!)); });
    const issues = runRule('ids/unique', b);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.level).toBe('error');
  });

  it('catches a body naming a slot that does not exist', () => {
    const b = withEvents((x) => { x.events[0]!.body += ' And then {NOBODY} spoke.'; });
    const issues = runRule('slots/references', b);
    expect(issues.some((i) => i.message.includes('{NOBODY}'))).toBe(true);
  });

  it('catches an arc pointing at a node that is not there', () => {
    const b = withEvents((x) => { x.arcs[0]!.entry = 'no_such_node'; });
    expect(runRule('arcs/wiring', b).some((i) => i.message.includes('no_such_node'))).toBe(true);
  });

  it('catches an effect naming content that does not exist', () => {
    const b = withEvents((x) => {
      const e = x.events.find((ev) => ev.interaction.kind === 'narration')!;
      if (e.interaction.kind !== 'narration') throw new Error('unreachable');
      e.interaction.outcomes[0]!.effects.push({ kind: 'clause', reveal: 'clause_that_is_not' });
    });
    expect(runRule('refs/known', b).some((i) => i.message.includes('clause_that_is_not'))).toBe(true);
  });

  /** Issue #14: the ballad content already names thirteen dangling tale ids before this file exists. */
  it('catches an event accounting for a tale that does not exist', () => {
    const b = withEvents((x) => { x.events[0]!.accounts = ['no_such_tale']; });
    expect(runRule('refs/known', b).some((i) => i.level === 'error' && i.message.includes('no_such_tale'))).toBe(true);
  });

  it('catches a tale whose about names an event that does not exist', () => {
    const b = withEvents((x) => { x.tales[0]!.about = 'no_such_event'; });
    expect(runRule('refs/known', b).some((i) => i.level === 'error' && i.message.includes('no_such_event'))).toBe(true);
  });

  /** CI gate 8 (issue #14): two accounts that agree are one account written twice. */
  it('catches two accounts on one event sharing the same bias', () => {
    const b = withEvents((x) => {
      const t = x.tales[0]!;
      x.tales.push({ ...t, id: 'a_second_tale_with_the_same_bias' });
      x.events[0]!.accounts = [t.id, 'a_second_tale_with_the_same_bias'];
    });
    const issues = runRule('tales/accounts', b);
    expect(issues.some((i) => i.level === 'error' && i.where === `event:${b.events[0]!.id}`)).toBe(true);
  });

  it('does not complain when an event\'s two accounts already contradict', () => {
    const b = withEvents((x) => {
      const t = x.tales[0]!;
      x.tales.push({ ...t, id: 'a_second_tale_with_a_different_bias', bias: `not_${t.bias}` });
      x.events[0]!.accounts = [t.id, 'a_second_tale_with_a_different_bias'];
    });
    const issues = runRule('tales/accounts', b).filter((i) => i.where === `event:${b.events[0]!.id}`);
    expect(issues).toHaveLength(0);
  });

  it('passes the shipped content with no account-gate errors', () => {
    expect(runRule('tales/accounts', content).filter((i) => i.level === 'error')).toHaveLength(0);
  });

  /**
   * Invariant 1, checked at authoring time. An effect that would deal Madness
   * to a target nothing has gated is an error, not a silent no-op at runtime.
   */
  it('catches Madness dealt to an ungated target', () => {
    const b = withEvents((x) => {
      const e = x.events.find((ev) => ev.interaction.kind === 'narration')!;
      if (e.interaction.kind !== 'narration') throw new Error('unreachable');
      e.slots.ANYONE = {
        role: 'family_member', castBy: 'engine', optional: false,
        filters: [], bind: 'event',
      };
      e.interaction.outcomes[0]!.effects.push({ kind: 'madness', target: { slot: 'ANYONE' }, delta: 10 });
    });
    const issues = runRule('madness/gate', b);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.level).toBe('error');
  });

  it('catches outcome weights that can never resolve', () => {
    const b = withEvents((x) => {
      const e = x.events.find((ev) => ev.interaction.kind === 'narration')!;
      if (e.interaction.kind !== 'narration') throw new Error('unreachable');
      for (const o of e.interaction.outcomes) o.weight = 0;
    });
    expect(runRule('outcomes/weights', b).some((i) => i.level === 'error')).toBe(true);
  });

  /** CI gate 6: a cluster of three or more identical purpose-triples is an error, not advice. */
  it('catches three templates sharing all three purposes', () => {
    const b = withEvents((x) => {
      const shared = ['change_relationship', 'change_standing', 'worldbuild_through_action'] as const;
      for (let i = 0; i < 3; i++) x.events[i]!.purposes = [...shared];
    });
    const issues = runRule('event/purpose-overlap', b);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.level).toBe('error');
  });

  /** CI gate 7 (issue #4): a clause pinned to fewer than two Ages is one some runs never see. */
  it('catches a clause assigned to fewer than two Ages', () => {
    const b = withEvents((x) => { x.clauses[0]!.ages = [x.clauses[0]!.ages[0]!]; });
    const issues = runRule('clause/ages', b);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.level).toBe('error');
  });

  /** Issue #9: this is exactly the bug `the_thin_papers` shipped with. */
  it('catches a Discrepancy proved or buried without ever being created', () => {
    const b = withEvents((x) => {
      const e = x.events.find((ev) => ev.interaction.kind === 'narration')!;
      if (e.interaction.kind !== 'narration') throw new Error('unreachable');
      e.interaction.outcomes[0]!.effects.push({ kind: 'discrepancy', op: 'prove', id: 'never_created_xyz' });
    });
    const issues = runRule('discrepancy/wiring', b);
    expect(issues.some((i) => i.level === 'error' && i.message.includes('never_created_xyz'))).toBe(true);
  });

  it('catches provableBy naming a house that does not exist', () => {
    const b = withEvents((x) => {
      const e = x.events.find((ev) => ev.interaction.kind === 'narration')!;
      if (e.interaction.kind !== 'narration') throw new Error('unreachable');
      e.interaction.outcomes[0]!.effects.push({
        kind: 'discrepancy', op: 'create', id: 'a_fresh_lie', severity: 'minor', provableBy: ['house_that_is_not_real'],
      });
    });
    const issues = runRule('discrepancy/wiring', b);
    expect(issues.some((i) => i.level === 'error' && i.message.includes('house_that_is_not_real'))).toBe(true);
  });

  it('passes the shipped content with no wiring errors', () => {
    expect(runRule('discrepancy/wiring', content).filter((i) => i.level === 'error')).toHaveLength(0);
  });
});
