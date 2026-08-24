import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { asId, CONTENT_RULES, runRule, validateBundle, type ContentBundle } from '@ed/schema';

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

  /**
   * A career or a book named by a typo fails silently in three different ways
   * downstream — the placement is declined, the volume resolves to nothing, the
   * slot matches nobody — and all three look like content that was authored and
   * simply never came up.
   */
  it('catches an outcome assigning a career that does not exist', () => {
    const b = withEvents((x) => {
      const e = x.events.find((ev) => ev.interaction.kind === 'narration')!;
      if (e.interaction.kind !== 'narration') throw new Error('unreachable');
      e.interaction.outcomes[0]!.effects.push({
        kind: 'career', target: { slot: 'NOBODY' }, op: 'assign', career: 'no_such_career',
      });
    });
    expect(runRule('refs/known', b).some((i) => i.message.includes('no_such_career'))).toBe(true);
  });

  it('catches an outcome studying a spellbook that does not exist', () => {
    const b = withEvents((x) => {
      const e = x.events.find((ev) => ev.interaction.kind === 'narration')!;
      if (e.interaction.kind !== 'narration') throw new Error('unreachable');
      e.interaction.outcomes[0]!.effects.push({
        kind: 'spellbook', op: 'study', target: { slot: 'NOBODY' }, book: 'no_such_book',
      });
    });
    expect(runRule('refs/known', b).some((i) => i.message.includes('no_such_book'))).toBe(true);
  });

  it('catches a slot filtering on a career that does not exist', () => {
    const b = withEvents((x) => {
      const e = x.events.find((ev) => Object.keys(ev.slots).length > 0)!;
      const slot = Object.keys(e.slots)[0]!;
      e.slots[slot]!.filters.push({ career: ['no_such_post'] });
    });
    expect(runRule('refs/known', b).some((i) => i.message.includes('no_such_post'))).toBe(true);
  });

  it('catches a tale whose about names an event that does not exist', () => {
    const b = withEvents((x) => { x.tales[0]!.about = 'no_such_event'; });
    expect(runRule('refs/known', b).some((i) => i.level === 'error' && i.message.includes('no_such_event'))).toBe(true);
  });

  // ── Who decides, and trees of events ─────────────────────────────────

  /** The first choice event in the shipped content, whatever it happens to be. */
  const aChoiceEvent = (b: ContentBundle) => b.events.find((e) => e.interaction.kind === 'choice')!;

  it('catches a state ladder taking a branch the event does not have', () => {
    const b = withEvents((x) => {
      const e = aChoiceEvent(x);
      if (e.interaction.kind === 'narration') throw new Error('unreachable');
      e.interaction.decidedBy = { state: [{ take: 'a_branch_that_is_not_here' }] };
    });
    expect(runRule('decider/wiring', b).some((i) => i.level === 'error' && i.message.includes('a_branch_that_is_not_here'))).toBe(true);
  });

  it('warns about a ladder with no unguarded rung, because it silently falls through to weight', () => {
    const b = withEvents((x) => {
      const e = aChoiceEvent(x);
      if (e.interaction.kind === 'narration') throw new Error('unreachable');
      e.interaction.decidedBy = {
        state: [{ when: { treasury: { op: 'lt', value: 1 } }, take: e.interaction.choices[0]!.id }],
      };
    });
    expect(runRule('decider/wiring', b).some((i) => i.level === 'warning' && i.message.includes('else'))).toBe(true);
  });

  it('catches a party decider with nobody for the player to send', () => {
    // The point of delegating is that the player picks who goes. Without a
    // player-cast slot it is a check wearing a decision's clothes.
    const b = withEvents((x) => {
      const e = aChoiceEvent(x);
      if (e.interaction.kind === 'narration') throw new Error('unreachable');
      e.interaction.decidedBy = { party: { check: 'never_declared' } };
    });
    const issues = runRule('decider/wiring', b);
    expect(issues.some((i) => i.message.includes('never_declared'))).toBe(true);
    expect(issues.some((i) => i.message.includes('castBy: player'))).toBe(true);
  });

  it('catches a check asked to name both a branch and an outcome', () => {
    const b = withEvents((x) => {
      const e = aChoiceEvent(x);
      if (e.interaction.kind === 'narration') throw new Error('unreachable');
      const branch = e.interaction.choices[0]!;
      e.checks = [{
        id: 'double_duty',
        pool: { kind: 'family_max', attr: 'strength' },
        difficulty: 10,
        variance: 'narrow',
        bands: [{ atLeast: 0, outcome: branch.outcomes[0]!.id }],
      }];
      branch.check = 'double_duty';
      e.interaction.decidedBy = { party: { check: 'double_duty' } };
    });
    expect(runRule('checks/wiring', b).some((i) => i.message.includes('cannot name choices and outcomes at once'))).toBe(true);
  });

  it('catches an event claiming to be a node of an arc that does not know it', () => {
    // The reverse of the check that already existed, and the worse direction:
    // an event with an `arc` block leaves the ambient pool, so if the arc never
    // calls it, it is authored, validated and unreachable in every run.
    const b = withEvents((x) => {
      x.events[0]!.arc = { of: x.arcs[0]!.id, node: 'a_node_that_is_not_there' };
    });
    expect(runRule('arcs/wiring', b).some((i) => i.message.includes('a_node_that_is_not_there'))).toBe(true);
  });

  it('catches an inline follow-up keeping a slot the follow-up does not declare', () => {
    // `keep` is the only thing that carries the cast forward. A slot the
    // follow-up never declares is a person the author thinks is still in the
    // room and who is silently recast.
    const b = withEvents((x) => {
      const e = x.events.find((ev) => ev.interaction.kind === 'narration' && Object.keys(ev.slots).length)!;
      if (e.interaction.kind !== 'narration') throw new Error('unreachable');
      const slot = Object.keys(e.slots)[0]!;
      const target = x.events.find((ev) => ev.id !== e.id && !ev.slots[slot])!;
      e.interaction.outcomes[0]!.next = { event: target.id, after: 'immediate', keep: [slot] };
    });
    expect(runRule('arcs/wiring', b).some((i) => i.message.includes('does not declare'))).toBe(true);
  });

  it('catches an inline follow-up naming an event that does not exist', () => {
    const b = withEvents((x) => {
      const e = x.events.find((ev) => ev.interaction.kind === 'narration')!;
      if (e.interaction.kind !== 'narration') throw new Error('unreachable');
      e.interaction.outcomes[0]!.next = { event: 'no_such_followup', after: 'immediate', keep: [] };
    });
    expect(runRule('arcs/wiring', b).some((i) => i.message.includes('no_such_followup'))).toBe(true);
  });

  it('catches two inline chains leading to the same follow-up', () => {
    // An event carries one `arc` block, so it can be a node of one chain. Two
    // means one chain quietly ends there and the other does not.
    const b = withEvents((x) => {
      const [a, c] = x.events.filter((ev) => ev.interaction.kind === 'narration').slice(0, 2);
      const target = x.events.find((ev) => ev.id !== a!.id && ev.id !== c!.id)!;
      for (const e of [a!, c!]) {
        if (e.interaction.kind !== 'narration') throw new Error('unreachable');
        e.interaction.outcomes[0]!.next = { event: target.id, after: 'immediate', keep: [] };
      }
    });
    expect(runRule('arcs/inline', b).some((i) => i.message.includes('only be a node of one chain'))).toBe(true);
  });

  it('catches an arc_flag written by an event that is in no substory', () => {
    const b = withEvents((x) => {
      const e = x.events.find((ev) => ev.interaction.kind === 'narration' && !ev.arc)!;
      if (e.interaction.kind !== 'narration') throw new Error('unreachable');
      e.interaction.outcomes[0]!.effects.push({ kind: 'arc_flag', flag: 'nobody_will_read_this', set: true });
    });
    expect(runRule('arcs/flags', b).some((i) => i.level === 'error' && i.message.includes('nothing can read it'))).toBe(true);
  });

  it('catches a successor guarding on an outcome its parent cannot produce', () => {
    const b = withEvents((x) => {
      const node = x.arcs[0]!.nodes.find((n) => n.successors.length)!;
      node.successors[0]!.fromOutcome = 'an_ending_that_never_happens';
    });
    expect(runRule('arcs/wiring', b).some((i) => i.message.includes('an_ending_that_never_happens'))).toBe(true);
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
  it('catches a triple carrying far more than its share of the library', () => {
    // The allowance is proportional now, not a flat three. A fixed cap of
    // three walled the library at 168 templates — the nine-purpose vocabulary
    // forms 84 triples — against §25's own budget of 300-500, and what that
    // produces is not fewer duplicate scenes but authors picking whichever
    // triple the validator will still accept, which inverts the rule.
    const b = withEvents((x) => {
      const shared = ['change_relationship', 'change_standing', 'worldbuild_through_action'] as const;
      for (const e of x.events) e.purposes = [...shared];
    });
    const issues = runRule('event/purpose-overlap', b);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.level).toBe('error');
    expect(issues[0]!.message).toContain('against an allowance of');
  });

  it('leaves a triple used a handful of times alone', () => {
    // Three templates about the same three things is a subject revisited. The
    // failure §25 names is "the event whose only job is *the family is
    // formidable*", and that is a triple carrying many times its share.
    const b = withEvents((x) => {
      const shared = ['change_relationship', 'change_standing', 'worldbuild_through_action'] as const;
      for (let i = 0; i < 3; i++) x.events[i]!.purposes = [...shared];
    });
    expect(runRule('event/purpose-overlap', b)).toHaveLength(0);
  });

  // ── The attention floor ─────────────────────────────────────────────────

  /**
   * The rule that guards what the player is actually asked. Handed a bundle
   * where every template resolves itself, it must object; handed the shipped
   * one, it must not — and the second half matters as much, because a floor
   * set where the content already sits is a floor that fails the next author
   * for no reason.
   */
  it('catches a library that has stopped asking the player anything', () => {
    const b = withEvents((x) => {
      for (const e of x.events) {
        delete e.record;
        for (const spec of Object.values(e.slots)) spec.castBy = 'engine';
        if (e.interaction.kind !== 'narration') e.interaction.decidedBy = 'chance';
      }
    });
    const issues = runRule('events/player-share', b);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.level).toBe('error');
    expect(issues[0]!.message).toContain('against a floor of 25%');
  });

  it('counts each of the four shapes that ask, on its own', () => {
    // Start from a library that has gone entirely silent, then give back one
    // shape at a time. Each has to clear the floor by itself, which is what
    // says the rule counts four things rather than one thing four ways.
    const silent = () => withEvents((x) => {
      for (const e of x.events) {
        delete e.record;
        for (const spec of Object.values(e.slots)) spec.castBy = 'engine';
        if (e.interaction.kind !== 'narration') e.interaction.decidedBy = 'chance';
      }
    });
    expect(runRule('events/player-share', silent())).toHaveLength(1);

    const docket = silent();
    for (const e of docket.events) {
      if (e.interaction.kind !== 'narration') e.interaction.decidedBy = 'player';
    }
    expect(runRule('events/player-share', docket), 'a docketed choice asks').toHaveLength(0);

    const party = silent();
    for (const e of party.events) {
      if (e.interaction.kind !== 'narration') e.interaction.decidedBy = { party: { check: 'x' } };
    }
    expect(runRule('events/player-share', party), 'a party cast asks — WHO GOES is the decision')
      .toHaveLength(0);

    const cast = silent();
    for (const e of cast.events) {
      const first = Object.values(e.slots)[0];
      if (first) first.castBy = 'player';
    }
    expect(runRule('events/player-share', cast), 'a player-cast slot asks').toHaveLength(0);

    // And the Record block on its own carries a third of the shipped library
    // without any other shape in the game — which is the thesis stated as a
    // number rather than as a claim (concept §6).
    const records = withEvents((x) => {
      for (const e of x.events) {
        for (const spec of Object.values(e.slots)) spec.castBy = 'engine';
        if (e.interaction.kind !== 'narration') e.interaction.decidedBy = 'chance';
      }
    });
    expect(runRule('events/player-share', records), 'Record / Omit / Embellish asks')
      .toHaveLength(0);
  });

  it('leaves the shipped library alone, and by a wide margin', () => {
    expect(runRule('events/player-share', content)).toHaveLength(0);
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

  /**
   * A secret on a contract becomes a Discrepancy under its own id the year it
   * is told, so an id with a second owner has two origins and one state.
   */
  it('catches a secret that content also creates as a Discrepancy', () => {
    const b = withEvents((x) => {
      const e = x.events.find((ev) => ev.interaction.kind === 'narration')!;
      if (e.interaction.kind !== 'narration') throw new Error('unreachable');
      e.interaction.outcomes[0]!.effects.push({
        kind: 'discrepancy', op: 'create', id: 'what_the_archive_holds', severity: 'minor', provableBy: ['commons'],
      });
    });
    const issues = runRule('secrets/wiring', b);
    expect(issues.some((i) => i.level === 'error' && i.message.includes('what_the_archive_holds'))).toBe(true);
  });

  it('catches a secret that is also granted as knowledge', () => {
    const b = withEvents((x) => {
      const e = x.events.find((ev) => ev.interaction.kind === 'narration')!;
      if (e.interaction.kind !== 'narration') throw new Error('unreachable');
      e.interaction.outcomes[0]!.effects.push({
        kind: 'knowledge', op: 'grant', flag: 'what_the_archive_holds',
      });
    });
    const issues = runRule('secrets/wiring', b);
    expect(issues.some((i) => i.level === 'error' && i.message.includes('granted as knowledge'))).toBe(true);
  });

  it('passes the shipped contracts, which name secrets nothing else owns', () => {
    expect(runRule('secrets/wiring', content).filter((i) => i.level === 'error')).toHaveLength(0);
  });
});

/**
 * THE RULES THAT HAD NEVER CAUGHT ANYTHING.
 *
 * Twenty-two rules raise issues from seventy-two call sites, and thirty-five of
 * those had never executed. The rule ran, found the shipped content clean, and
 * returned — which is what a rule that cannot fire looks like from outside, and
 * indistinguishable from one that works.
 *
 * That matters more here than in most codebases. `npm run validate` is the
 * whole of what stands between an author and a broken build, and a validator
 * nothing has ever been rejected by is a validator nobody has any reason to
 * trust. `frame/shape` was the sharpest case: AGENTS.md says a frame event
 * "carries no effects, Record block or rumour by construction (`frame/shape`
 * fails the build otherwise)", and nothing had ever demonstrated that it does.
 *
 * Every fixture below mutates the REAL bundle, for the reason the file already
 * gives: a rule that only fires against a toy bundle has not been tested
 * against anything the game would load.
 */
describe('the rules that had never caught anything', () => {
  const withEvents = (mutate: (b: ContentBundle) => void): ContentBundle => {
    const b = structuredClone(content.bundle);
    mutate(b);
    return b;
  };

  const anEvent = (b: ContentBundle, freq?: string) =>
    b.events.find((e) => e.tier !== 'frame' && (freq === undefined || e.frequency === freq))!;

  /** The first choice event in the shipped content, whatever it happens to be. */
  const aChoiceEvent = (b: ContentBundle) => b.events.find((e) => e.interaction.kind === 'choice')!;

  const messages = (rule: string, b: ContentBundle) => runRule(rule, b).map((i) => i.message).join('\n');

  // ── frequency/obligations: a tier is a set of duties ───────────────────

  describe('frequency/obligations', () => {
    it('catches a rare event with no Record block, because the tier requires one', () => {
      const b = withEvents((x) => {
        const e = anEvent(x, 'rare');
        e.record = undefined;
      });
      expect(messages('frequency/obligations', b)).toMatch(/must carry a record block/);
    });

    it('catches a common event that carries one, because a routine Record choice means nothing', () => {
      const b = withEvents((x) => {
        const donor = x.events.find((e) => e.record)!;
        const e = anEvent(x, 'common');
        e.record = structuredClone(donor.record);
      });
      expect(messages('frequency/obligations', b)).toMatch(/must not carry a record block/);
    });

    it('warns when a rare event seeds no rumour, and when a common one does', () => {
      const noRumour = withEvents((x) => { anEvent(x, 'rare').rumour = undefined; });
      expect(messages('frequency/obligations', noRumour)).toMatch(/should seed a rumour/);

      const tooTalkative = withEvents((x) => {
        anEvent(x, 'common').rumour = { id: 'rumour_of_nothing', accuracy: 0.5, spread: 1 };
      });
      expect(messages('frequency/obligations', tooTalkative)).toMatch(/do not enter folklore/);
    });

    it('catches a mythic event that can repeat, which is a contradiction in terms', () => {
      const b = withEvents((x) => { anEvent(x, 'mythic').repeatable = true; });
      const issues = runRule('frequency/obligations', b);
      expect(issues.some((i) => i.level === 'error' && /not mythic/.test(i.message))).toBe(true);
    });

    it('warns when a named tier carries fewer than two contradicting accounts', () => {
      const b = withEvents((x) => { anEvent(x, 'rare').accounts = []; });
      expect(messages('frequency/obligations', b)).toMatch(/fewer than two contradicting accounts/);
    });
  });

  // ── slots/arc-bound ────────────────────────────────────────────────────

  describe('slots/arc-bound', () => {
    it('warns about an arc-bound slot on an event that belongs to no arc', () => {
      const b = withEvents((x) => {
        const e = x.events.find((ev) => !ev.arc && Object.keys(ev.slots).length)!;
        Object.values(e.slots)[0]!.bind = 'arc';
      });
      expect(messages('slots/arc-bound', b)).toMatch(/belongs to no arc/);
    });

    /** A token for a man forty years in the ground, which is the message's own phrase. */
    it('catches continue_absent with no absentBody to render instead', () => {
      const b = withEvents((x) => {
        const e = x.events.find((ev) => ev.arc && Object.keys(ev.slots).length)
          ?? x.events.find((ev) => Object.keys(ev.slots).length)!;
        const spec = Object.values(e.slots)[0]!;
        spec.bind = 'arc';
        spec.onMissing = 'continue_absent';
        e.absentBody = undefined;
      });
      const issues = runRule('slots/arc-bound', b);
      expect(issues.some((i) => i.level === 'error' && /continue_absent requires absentBody/.test(i.message))).toBe(true);
    });
  });

  // ── event/shape ────────────────────────────────────────────────────────

  describe('event/shape', () => {
    it('catches a choice event with only one option, which is narration wearing a hat', () => {
      const b = withEvents((x) => {
        const e = aChoiceEvent(x);
        if (e.interaction.kind === 'narration') throw new Error('unreachable');
        e.interaction.choices = [e.interaction.choices[0]!];
      });
      const issues = runRule('event/shape', b);
      expect(issues.some((i) => i.level === 'error' && /at least two options/.test(i.message))).toBe(true);
    });

    it('warns about a body short enough to be a stub', () => {
      const b = withEvents((x) => { x.events[0]!.body = 'Something happened.'; });
      expect(messages('event/shape', b)).toMatch(/body under 25 words/);
    });
  });

  // ── frame/shape: the rule AGENTS.md promises and nothing had proved ────

  describe('frame/shape', () => {
    const aFrameEvent = (b: ContentBundle) => b.events.find((e) => e.tier === 'frame')!;

    it('the shipped content has frame events to hold to this', () => {
      expect(content.bundle.events.some((e) => e.tier === 'frame')).toBe(true);
    });

    it("catches 'reads' on an event that is not the frame", () => {
      const b = withEvents((x) => { anEvent(x).reads = aFrameEvent(x).reads; });
      const issues = runRule('frame/shape', b);
      expect(issues.some((i) => i.level === 'error' && /frame-only/.test(i.message))).toBe(true);
    });

    it('catches a frame event with nothing to react to', () => {
      const b = withEvents((x) => { aFrameEvent(x).reads = []; });
      expect(messages('frame/shape', b)).toMatch(/declares no reads/);
    });

    it('catches a frame event gating on live household state', () => {
      const b = withEvents((x) => { aFrameEvent(x).conditions = { year: { op: 'gte', value: 1200 } }; });
      expect(messages('frame/shape', b)).toMatch(/gates on reads, not conditions/);
    });

    it('catches a frame event carrying a Record block or a rumour', () => {
      const withRecord = withEvents((x) => {
        aFrameEvent(x).record = structuredClone(x.events.find((e) => e.record)!.record);
      });
      expect(messages('frame/shape', withRecord)).toMatch(/never dispenses systems information/);

      const withRumour = withEvents((x) => {
        aFrameEvent(x).rumour = { id: 'rumour_of_nothing', accuracy: 0.5, spread: 1 };
      });
      expect(messages('frame/shape', withRumour)).toMatch(/does not enter folklore/);
    });

    it('catches a frame event that asks the player anything', () => {
      const b = withEvents((x) => {
        const donor = aChoiceEvent(x);
        if (donor.interaction.kind === 'narration') throw new Error('unreachable');
        aFrameEvent(x).interaction = structuredClone(donor.interaction);
      });
      expect(messages('frame/shape', b)).toMatch(/narration only/);
    });

    it('catches a frame event casting anyone but the two listeners', () => {
      const b = withEvents((x) => {
        const e = aFrameEvent(x);
        const spec = Object.values(e.slots)[0];
        if (!spec) throw new Error('the frame event under test casts nobody');
        spec.role = 'head';
      });
      expect(messages('frame/shape', b)).toMatch(/casts only the two listener roles/);
    });

    /** The frame reacts. An effect on it would make the interlude change the game. */
    it('catches an effect on a frame outcome', () => {
      const b = withEvents((x) => {
        const e = aFrameEvent(x);
        if (e.interaction.kind !== 'narration') throw new Error('a frame event is narration');
        e.interaction.outcomes[0]!.effects.push({ kind: 'treasury', delta: 50 });
      });
      expect(messages('frame/shape', b)).toMatch(/it does not change anything/);
    });
  });

  // ── traits/mystic-restriction (invariant 4) ────────────────────────────

  describe('traits/mystic-restriction', () => {
    it('catches a female-tagged trait keyed to an affinity women cannot learn', () => {
      const b = withEvents((x) => {
        const t = x.traits.find((tr) => tr.acquisition.kind === 'threshold')!;
        t.acquisition = { kind: 'threshold', attr: asId('fluid'), atLeast: 40 };
        t.tags = [...t.tags, 'female'] as typeof t.tags;
      });
      expect(messages('traits/mystic-restriction', b)).toMatch(/female-tagged trait keyed to an elemental affinity/);
    });

    it('says nothing about the same trait keyed to a Threshold affinity, which women do practise', () => {
      const b = withEvents((x) => {
        const t = x.traits.find((tr) => tr.acquisition.kind === 'threshold')!;
        t.acquisition = { kind: 'threshold', attr: asId('life'), atLeast: 40 };
        t.tags = [...t.tags, 'female'] as typeof t.tags;
      });
      expect(runRule('traits/mystic-restriction', b)).toHaveLength(0);
    });
  });

  // ── houses/alleles ─────────────────────────────────────────────────────

  describe('houses/alleles', () => {
    /**
     * The failure it exists for: a gene pool override naming an allele that is
     * not in the locus is DROPPED. The house then rolls the world baseline,
     * which is a perfectly good genome, so nothing anywhere reports that the
     * house's whole characterisation — "soldiers", "they can count" — never
     * reached a single person. Two houses shipped that way in one afternoon.
     */
    it('catches a gene pool naming an allele the locus does not have', () => {
      const b = withEvents((x) => {
        const h = x.houses.find((house) => Object.keys(house.genePool.frequencies).length)!;
        const locus = Object.keys(h.genePool.frequencies)[0]!;
        h.genePool.frequencies[locus] = [{ allele: 'no_such_allele', p: 0.3 }];
      });
      expect(messages('houses/alleles', b)).toMatch(/unknown allele 'no_such_allele'/);
    });

    it('catches a gene pool overriding a locus that does not exist', () => {
      const b = withEvents((x) => {
        const h = x.houses.find((house) => Object.keys(house.genePool.frequencies).length)!;
        h.genePool.frequencies['no_such_locus'] = [{ allele: 'whatever', p: 0.3 }];
      });
      expect(messages('houses/alleles', b)).toMatch(/unknown locus 'no_such_locus'/);
    });

    it('says nothing about the shipped houses', () => {
      expect(runRule('houses/alleles', content)).toHaveLength(0);
    });
  });

  // ── ages/coverage ──────────────────────────────────────────────────────

  it('ages/coverage warns about a clause-bearing Age too short to carry one', () => {
    const b = withEvents((x) => {
      const age = x.ages.find((a) => a.clauseBearing)!;
      age.duration.medianYears = 10;
    });
    expect(messages('ages/coverage', b)).toMatch(/clause-bearing Age with a short median span/);
  });

  // ── The partially-covered rules, on the halves nothing reached ─────────

  describe('slots/references', () => {
    it('catches a relation filter naming a slot the event does not declare', () => {
      const b = withEvents((x) => {
        const e = x.events.find((ev) => Object.keys(ev.slots).length)!;
        Object.values(e.slots)[0]!.filters.push({ relation: 'not', of: 'NO_SUCH_SLOT' });
      });
      expect(messages('slots/references', b)).toMatch(/NO_SUCH_SLOT/);
    });
  });

  describe('refs/known', () => {
    const narrationEvent = (b: ContentBundle) => {
      const e = b.events.find((ev) => ev.interaction.kind === 'narration' && ev.tier !== 'frame')!;
      if (e.interaction.kind !== 'narration') throw new Error('unreachable');
      return e.interaction.outcomes[0]!;
    };

    it('catches an outcome starting an arc that does not exist', () => {
      const b = withEvents((x) => {
        narrationEvent(x).effects.push({ kind: 'arc', op: 'start', arc: 'arc_that_is_not' });
      });
      expect(messages('refs/known', b)).toMatch(/arc_that_is_not/);
    });

    it('catches an outcome scheduling an event that does not exist', () => {
      const b = withEvents((x) => {
        narrationEvent(x).effects.push({ kind: 'schedule', event: 'event_that_is_not', inYears: 5 });
      });
      expect(messages('refs/known', b)).toMatch(/schedules unknown event 'event_that_is_not'/);
    });

    it('catches an outcome granting an heirloom that does not exist', () => {
      const b = withEvents((x) => {
        narrationEvent(x).effects.push({ kind: 'heirloom', op: 'grant', heirloom: 'heirloom_that_is_not' });
      });
      expect(messages('refs/known', b)).toMatch(/heirloom_that_is_not/);
    });

    /** A knowledge gate nothing grants is an event that can never fire, silently. */
    it('catches a knowledge condition no event grants', () => {
      const b = withEvents((x) => {
        anEvent(x).conditions = { knowledge: 'knows_a_thing_nobody_teaches', has: true };
      });
      expect(messages('refs/known', b)).toMatch(/knows_a_thing_nobody_teaches/);
    });
  });

  describe('arcs/wiring', () => {
    it('catches a node running an event that does not exist', () => {
      const b = withEvents((x) => { x.arcs[0]!.nodes[0]!.event = 'event_that_is_not'; });
      expect(messages('arcs/wiring', b)).toMatch(/unknown event 'event_that_is_not'/);
    });

    it('catches a successor pointing at a node that is not in the arc', () => {
      const b = withEvents((x) => {
        const node = x.arcs[0]!.nodes.find((n) => n.successors?.length)!;
        node.successors![0]!.to = 'node_that_is_not';
      });
      expect(messages('arcs/wiring', b)).toMatch(/node_that_is_not/);
    });

    it('catches a successor guarding on a choice the node event does not have', () => {
      const b = withEvents((x) => {
        const node = x.arcs[0]!.nodes.find((n) => n.successors?.length)!;
        node.successors![0]!.fromChoice = 'a_choice_that_is_not';
      });
      expect(messages('arcs/wiring', b)).toMatch(/a_choice_that_is_not/);
    });

    it('catches a successor guarding on a tag no outcome carries', () => {
      const b = withEvents((x) => {
        const node = x.arcs[0]!.nodes.find((n) => n.successors?.length)!;
        node.successors![0]!.fromTag = 'a_tag_that_is_not';
      });
      expect(messages('arcs/wiring', b)).toMatch(/a_tag_that_is_not/);
    });

    it('catches an event claiming to be a node of an arc that does not exist', () => {
      const b = withEvents((x) => {
        const e = x.events.find((ev) => ev.arc)!;
        e.arc = { of: 'arc_that_is_not', node: e.arc!.node };
      });
      expect(messages('arcs/wiring', b)).toMatch(/unknown arc 'arc_that_is_not'/);
    });

    /** The two-way binding, disagreeing. The node says one event, the event says another. */
    it('catches a node and an event that disagree about which is which', () => {
      const b = withEvents((x) => {
        const e = x.events.find((ev) => ev.arc)!;
        const arc = x.arcs.find((a) => a.id === e.arc!.of)!;
        const node = arc.nodes.find((n) => n.id === e.arc!.node)!;
        const other = x.events.find((ev) => ev.id !== e.id && !ev.arc)!;
        node.event = String(other.id);
      });
      expect(messages('arcs/wiring', b)).toMatch(/not this event/);
    });
  });

  describe('arcs/inline', () => {
    const withNext = (b: ContentBundle) => {
      for (const e of b.events) {
        const outcomes = e.interaction.kind === 'narration'
          ? e.interaction.outcomes
          : e.interaction.choices.flatMap((c) => c.outcomes);
        const o = outcomes.find((x) => x.next);
        if (o) return { event: e, outcome: o };
      }
      throw new Error('the shipped content authors no inline follow-up');
    };

    /**
     * `next` compiles into `triggers`, and desugar leaves an authored
     * `triggers` alone — so an outcome carrying both silently drops the
     * follow-up. Saying so beats picking a winner nobody asked for.
     */
    it('catches an outcome declaring both a next and its own triggers', () => {
      const b = withEvents((x) => {
        const { outcome } = withNext(x);
        outcome.triggers = { arc: String(x.arcs[0]!.id), op: 'start' };
      });
      expect(messages('arcs/inline', b)).toMatch(/the follow-up would be discarded/);
    });

    /** A chain nothing leads into can never start, and sits there looking authored. */
    it('catches a chain of follow-ups with no beat that can start it', () => {
      const b = withEvents((x) => {
        const { event, outcome } = withNext(x);
        // Point the chain back at the event that starts it: now every event
        // carrying a `next` is itself somebody's follow-up.
        const target = x.events.find((e) => String(e.id) === outcome.next!.event);
        if (!target) throw new Error('the follow-up names an event that is not there');
        const targetOutcomes = target.interaction.kind === 'narration'
          ? target.interaction.outcomes
          : target.interaction.choices.flatMap((c) => c.outcomes);
        targetOutcomes[0]!.next = { event: String(event.id), after: 'next_generation', keep: [] };
      });
      expect(messages('arcs/inline', b)).toMatch(/a cycle with no beat that can start it/);
    });
  });

  describe('arcs/flags', () => {
    /** Ambient selection has no arc in scope, so the condition is always false. */
    it('warns about an arcFlag condition on an event, which can never be true there', () => {
      const b = withEvents((x) => {
        anEvent(x).conditions = { arcFlag: 'paid', is: true };
      });
      expect(messages('arcs/flags', b)).toMatch(/always false/);
    });

    it('catches a successor asking whether a node of some OTHER arc was visited', () => {
      const b = withEvents((x) => {
        const arc = x.arcs.find((a) => a.nodes.some((n) => n.successors?.length))!;
        const node = arc.nodes.find((n) => n.successors?.length)!;
        node.successors![0]!.when = { arcVisited: 'a_node_of_no_arc' };
      });
      expect(messages('arcs/flags', b)).toMatch(/a_node_of_no_arc/);
    });
  });

  describe('checks/wiring', () => {
    const eventWithCheck = (b: ContentBundle) => b.events.find((e) => e.checks.length)!;

    it('catches bands that are not strictly descending, which makes one unreachable', () => {
      const b = withEvents((x) => {
        const c = eventWithCheck(x).checks[0]!;
        c.bands = [...c.bands].sort((p, q) => p.atLeast - q.atLeast);
        if (c.bands.length < 2) throw new Error('need a check with two bands to scramble');
      });
      expect(messages('checks/wiring', b)).toMatch(/strictly descending/);
    });

    it('catches a choice naming a check its event does not declare', () => {
      const b = withEvents((x) => {
        const e = aChoiceEvent(x);
        if (e.interaction.kind === 'narration') throw new Error('unreachable');
        e.interaction.choices[0]!.check = 'check_that_is_not';
      });
      expect(messages('checks/wiring', b)).toMatch(/check_that_is_not/);
    });

    /**
     * A band naming an outcome the branch does not have resolves to nothing.
     * `evalCheck` falls back to the last band, so the check silently produces
     * the wrong ending rather than failing.
     */
    it('catches a band naming an outcome the choice does not have', () => {
      const b = withEvents((x) => {
        const e = x.events.find((ev) => {
          if (ev.interaction.kind === 'narration') return false;
          return ev.interaction.choices.some((c) => c.check && ev.checks.some((k) => k.id === c.check));
        })!;
        if (e.interaction.kind === 'narration') throw new Error('unreachable');
        const choice = e.interaction.choices.find((c) => c.check)!;
        const check = e.checks.find((k) => k.id === choice.check)!;
        check.bands[0]!.outcome = 'an_outcome_this_branch_does_not_have';
      });
      expect(messages('checks/wiring', b)).toMatch(/an_outcome_this_branch_does_not_have/);
    });
  });

  describe('slots/references, on the cycle nothing had built', () => {
    /**
     * Two slots whose relation filters point at each other: whichever fills
     * first compares against nobody, so one of them narrows nothing. The rule
     * is a topological sort, and this is the input it exists to reject.
     */
    it('catches relation filters that form a cycle', () => {
      const b = withEvents((x) => {
        const e = x.events.find((ev) => Object.keys(ev.slots).length >= 2)!;
        const [a, c] = Object.keys(e.slots);
        e.slots[a!]!.filters.push({ relation: 'not', of: c! });
        e.slots[c!]!.filters.push({ relation: 'not', of: a! });
      });
      expect(messages('slots/references', b)).toMatch(/form a cycle/);
    });
  });

  describe('arcs/wiring, on the inline-link halves nothing reached', () => {
    it('catches a next that keeps a slot the event it leaves does not cast', () => {
      const b = withEvents((x) => {
        for (const e of x.events) {
          const outcomes = e.interaction.kind === 'narration'
            ? e.interaction.outcomes
            : e.interaction.choices.flatMap((c) => c.outcomes);
          const o = outcomes.find((y) => y.next);
          if (!o) continue;
          o.next!.keep = ['A_SLOT_NOBODY_CASTS'];
          return;
        }
        throw new Error('the shipped content authors no inline follow-up');
      });
      expect(messages('arcs/wiring', b)).toMatch(/A_SLOT_NOBODY_CASTS/);
    });

    it('catches a next pointing at its own event', () => {
      const b = withEvents((x) => {
        for (const e of x.events) {
          const outcomes = e.interaction.kind === 'narration'
            ? e.interaction.outcomes
            : e.interaction.choices.flatMap((c) => c.outcomes);
          const o = outcomes.find((y) => y.next);
          if (!o) continue;
          o.next!.event = String(e.id);
          return;
        }
        throw new Error('the shipped content authors no inline follow-up');
      });
      expect(messages('arcs/wiring', b)).toMatch(/next points at its own event/);
    });
  });
});
