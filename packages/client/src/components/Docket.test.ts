// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadContent } from '@ed/content';
import { PendingDecisionS } from '@ed/schema';
import type { PendingDecision } from '@ed/core';
import Docket from './Docket.vue';
import type { GameActions } from '../lib/game';

const content = loadContent();

/**
 * ── THE FIRST TEST THAT RENDERS ANYTHING ──────────────────────────────────
 *
 * `packages/client` is 3,350 lines of Vue and every guard over it was a
 * text-level one. `verbs.test.ts` greps the templates to prove each verb on
 * `GameSession` reaches something a player can click — a real and valuable
 * check, and one that cannot tell whether the click does the right thing,
 * because nothing had ever been rendered.
 *
 * `Docket.vue` is where that matters most. It draws THREE SHAPES — choice,
 * match, record — and `run.slow.test.ts` says why in its own comment: "a kind
 * that never fires is a branch of that template nobody has ever rendered —
 * the failure this repository has shipped four times, one layer up". That
 * suite drives a whole run and checks each kind is RAISED. Whether the
 * template then draws it has been nobody's assertion.
 *
 * ── THE FIXTURES GO THROUGH THE REAL SCHEMA ───────────────────────────────
 *
 * Every decision below is built with real content and parsed by
 * `PendingDecisionS` before it reaches the component. A hand-written fixture
 * that the schema would reject is a test asserting against a shape the game
 * cannot produce, which is worse than no test: it passes forever while the
 * thing it claims to cover changes underneath it.
 */

/**
 * A real authored choice event with at least two branches.
 *
 * The first cut of this also demanded a SLOTLESS event and found none — every
 * one of the 324 choice events in the game casts at least one role. It does
 * not matter: what the panel draws a cast control for is `decision.cast`, the
 * roles the PLAYER is asked to fill, and that is empty here on purpose so
 * these tests are about branches rather than about casting.
 */
function anyChoiceEvent() {
  const e = content.bundle.events.find((x) => x.interaction.kind === 'choice'
    && x.interaction.choices.length >= 2);
  if (!e) throw new Error('no choice event with two branches in the content');
  return e;
}

/**
 * THE SAVE SCHEMA VALIDATES THE PERSISTED HALF; THE VIEW ADDS THE REST.
 *
 * `decidedBy` and `choicesAreOpen` live on the VIEW type in `decisions.ts`,
 * not on `PendingDecisionS` — the save carries what a run needs to resume,
 * and "is the branch yours to take" is recomputed. So the fixture is parsed
 * by the real schema (which is what stops it drifting into a shape the game
 * cannot produce) and then given the view-only fields explicitly.
 *
 * Finding that out is itself the test doing its job: the first cut set
 * neither, the branch buttons did not render, and the reason is a field a
 * grep-level guard has no way to know about.
 */
function choiceDecision(open = true): PendingDecision {
  const event = anyChoiceEvent();
  if (event.interaction.kind !== 'choice') throw new Error('picked the wrong event');
  const persisted = PendingDecisionS.parse({
    kind: 'choice',
    id: 'dec_1',
    year: 1100,
    event,
    body: 'The body of the thing, as the player reads it.',
    fill: {},
    cast: [],
    choices: event.interaction.choices.map((c) => ({
      id: c.id,
      label: c.label,
      available: true,
    })),
  });
  return {
    ...persisted,
    decidedBy: open ? 'player' : 'party',
    choicesAreOpen: open,
  } as unknown as PendingDecision;
}

function recordDecision(): PendingDecision {
  const event = anyChoiceEvent();
  return PendingDecisionS.parse({
    kind: 'record',
    id: 'dec_2',
    year: 1200,
    event,
    subject: 'p_1',
    entryId: 'chr_1',
    fill: {},
    options: [
      { option: 'record', chronicle: 'It happened, and it is written down.' },
      { option: 'omit', chronicle: null },
      { option: 'embellish', chronicle: 'It happened rather better than that.' },
    ],
  }) as PendingDecision;
}

/** Every action stubbed, so a click can be caught wherever it lands. */
function spyActions() {
  const names = [
    'begin', 'found', 'enter', 'resume', 'restart', 'advance', 'choose', 'send',
    'match', 'declineHand', 'record', 'dismissOutcome', 'dismissInterlude',
    'letHimDecide', 'name', 'order', 'view', 'epilogue', 'save',
  ] as const;
  const actions = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const n of names) actions[n] = vi.fn();
  return actions as unknown as Record<keyof GameActions, ReturnType<typeof vi.fn>>
    & { readonly __brand?: GameActions };
}

describe('the docket draws what it is handed', () => {
  it('renders a choice, with a control per branch', () => {
    const decision = choiceDecision();
    const actions = spyActions();
    const w = mount(Docket, { props: { decision, actions: actions as unknown as GameActions } });

    expect(w.text()).toContain('The body of the thing');
    const buttons = w.findAll('button');
    expect(
      buttons.length,
      'a choice with branches drew no controls at all — the player cannot answer',
    ).toBeGreaterThanOrEqual(2);
  });

  /**
   * THE CLICK HAS TO REACH THE VERB. This is the half `verbs.test.ts` cannot
   * do: it proves `choose` is MENTIONED in the store and in a template, not
   * that pressing the branch calls it with the branch that was pressed.
   */
  it('and pressing a branch calls choose with that branch', async () => {
    const decision = choiceDecision();
    if (decision.kind !== 'choice') throw new Error('fixture is the wrong kind');
    const actions = spyActions();
    const w = mount(Docket, { props: { decision, actions: actions as unknown as GameActions } });

    const buttons = w.findAll('button');
    await buttons[0]!.trigger('click');

    expect(actions.choose, 'the first branch was pressed and choose was never called').toHaveBeenCalled();
    const [id, choiceId] = actions.choose.mock.calls[0]!;
    expect(id).toBe(decision.id);
    expect(decision.choices.map((c) => c.id)).toContain(choiceId);
  });

  /**
   * ── AND THE BRANCH THAT IS NOT THE PLAYER'S TO TAKE ──────────────────────
   *
   * `decidedBy: party` means the docket stopped the clock to collect a CAST,
   * and what those people are between them decides the branch. A panel that
   * drew the choice list anyway would be offering an answer the engine will
   * refuse — `session.ts` says so in as many words. So the same decision with
   * `choicesAreOpen: false` must draw no branches at all, and one send.
   */
  it('offers no branches when the branch is not the player\'s to take', async () => {
    const decision = choiceDecision(false);
    if (decision.kind !== 'choice') throw new Error('fixture is the wrong kind');
    const actions = spyActions();
    const w = mount(Docket, { props: { decision, actions: actions as unknown as GameActions } });

    const labels = decision.choices.map((c) => c.label);
    for (const label of labels) {
      expect(
        w.text().includes(label),
        `the panel offered "${label}" on a decision whose branch the player does not take`,
      ).toBe(false);
    }

    const send = w.findAll('button').find((b) => b.text().includes('Send them'));
    expect(send, 'a party decision drew no way to send anybody').toBeTruthy();
    await send!.trigger('click');
    expect(actions.send).toHaveBeenCalled();
    expect(actions.choose, 'a party decision must never call choose').not.toHaveBeenCalled();
  });

  it('renders a Record block, with its three options', () => {
    const decision = recordDecision();
    const actions = spyActions();
    const w = mount(Docket, { props: { decision, actions: actions as unknown as GameActions } });

    const text = w.text();
    // The three options are the client's own words, so this asserts that
    // something for each was drawn rather than pinning the wording.
    expect(w.findAll('button').length, 'the Record block drew no options').toBeGreaterThanOrEqual(3);
    expect(text.length, 'the Record block rendered empty').toBeGreaterThan(20);
  });

  it('and pressing a Record option calls record', async () => {
    const decision = recordDecision();
    const actions = spyActions();
    const w = mount(Docket, { props: { decision, actions: actions as unknown as GameActions } });

    await w.findAll('button')[0]!.trigger('click');
    expect(actions.record, 'a Record option was pressed and record was never called').toHaveBeenCalled();
    expect(actions.record.mock.calls[0]![0]).toBe(decision.id);
  });
});

/**
 * ── THE CLOSED UNION, ONE LAYER OUT ───────────────────────────────────────
 *
 * Invariant 5 says the verbs are enumerated and every site handling one ends
 * in `assertNever`. The compiler enforces that in `core`. A Vue template has
 * no such thing: a `v-if` chain over `decision.kind` that is missing a branch
 * renders NOTHING, silently, which is this repository's whole thesis wearing
 * a stylesheet.
 *
 * So the kinds are read off the schema — never a list in this file — and the
 * template has to name each one.
 */
describe('every docket kind has a shape in the template', () => {
  const kinds = PendingDecisionS.options.map((o) => o.shape.kind.value as string);
  const template = readFileSync(join(import.meta.dirname, 'Docket.vue'), 'utf8');

  it('finds the kinds at all', () => {
    // A reflection that returns nothing would make the loop below vacuous.
    expect(kinds.length).toBeGreaterThanOrEqual(3);
    expect(kinds).toContain('choice');
  });

  for (const kind of PendingDecisionS.options.map((o) => o.shape.kind.value as string)) {
    it(`dispatches on '${kind}' by name`, () => {
      /**
       * BY NAME, not merely mentioned. The Record block used to be a bare
       * `<template v-else>` — a catch-all, which is invariant 5's permissive
       * default wearing a stylesheet. A fourth kind would have rendered as a
       * Record block: the wrong panel, drawn confidently, with `subject`
       * undefined and three buttons calling `record` on a decision that is
       * not one. Checking only that the name appears somewhere in the file
       * would have passed against exactly that.
       */
      const dispatch = new RegExp(`v-(?:else-)?if="decision\\.kind === '${kind}'"`);
      expect(
        dispatch.test(template),
        `Docket.vue does not branch on decision.kind === '${kind}'. A template has no `
        + 'assertNever, so a kind that is not named here either renders blank or — worse — '
        + 'falls into somebody else\'s branch and draws the wrong panel as though it were '
        + 'right.',
      ).toBe(true);
    });
  }

  /**
   * And the last branch is a stated fallback rather than a silent one, so the
   * day a fourth kind arrives the player is told, instead of being shown a
   * Record block for a decision that is not a Record block.
   */
  it('and its final v-else says it does not know, rather than guessing', () => {
    const tail = template.slice(template.lastIndexOf('v-else'));
    expect(tail).toMatch(/unhandled|does not know how to draw/);
  });
});
