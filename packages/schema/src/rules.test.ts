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
});
