// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import Start from './Start.vue';
import type { GameActions } from '../lib/game';
import type { SaveSummary } from '../platform';

/**
 * ── THE FRONT DOOR (issue #67) ────────────────────────────────────────────
 *
 * The acceptance line is "nobody sees the word seed unless they go looking
 * for it", and that is only testable if the field is actually absent from
 * the DOM by default rather than merely styled out of sight — a `v-if`
 * toggle rather than a native `<details>`, because a test has no layout
 * engine to hide it for.
 */

function spyActions(saves: SaveSummary[] = []) {
  return {
    begin: vi.fn(),
    resume: vi.fn(async () => true),
    load: vi.fn(async () => true),
    listSaves: vi.fn(async () => saves),
    importSave: vi.fn(async () => true),
    exportSave: vi.fn(async () => true),
  } as unknown as GameActions;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the front door hides the seed behind Advanced', () => {
  it('shows no seed field or word by default', async () => {
    const w = mount(Start, { props: { actions: spyActions(), resumable: false } });
    await flush();

    expect(w.find('#seed').exists(), 'the seed input is in the default DOM').toBe(false);
    expect(w.text().toLowerCase()).not.toContain('seed');
  });

  it('reveals the seed field once Advanced is opened', async () => {
    const w = mount(Start, { props: { actions: spyActions(), resumable: false } });
    await flush();

    const toggle = w.findAll('button').find((b) => b.text() === 'Advanced');
    expect(toggle, 'no control opens the advanced section').toBeTruthy();
    await toggle!.trigger('click');

    expect(w.find('#seed').exists()).toBe(true);
    expect(w.text().toLowerCase()).toContain('seed');
  });

  it('still begins with the seed once it has been changed there', async () => {
    const actions = spyActions();
    const w = mount(Start, { props: { actions, resumable: false } });
    await flush();

    const toggle = w.findAll('button').find((b) => b.text() === 'Advanced');
    await toggle!.trigger('click');
    await w.get('#seed').setValue(77);

    await w.get('button.primary').trigger('click');
    expect(actions.begin).toHaveBeenCalledWith(77, 'short');
  });
});

describe('campaign choice (#66)', () => {
  it('defaults to A Short Line and lets the player explicitly choose Long', async () => {
    const actions = spyActions();
    const w = mount(Start, { props: { actions, resumable: false } });
    await flush();

    expect(w.text()).toContain('A Short Line');
    expect(w.text()).toContain('A Long Line');
    expect(w.text()).toContain('three-clause Ledger');
    expect(w.text()).toContain('Apotheosis belongs to A Long Line');

    const long = w.findAll('input[type="radio"]').find((input) => input.attributes('value') === 'long');
    expect(long, 'the Long Line is not selectable').toBeTruthy();
    await long!.setValue(true);
    await w.get('button.primary').trigger('click');

    expect(actions.begin).toHaveBeenCalledWith(expect.any(Number), 'long');
  });
});

describe('Continue leads when a run can be resumed', () => {
  it('offers Continue first and calls resume, not begin, when pressed', async () => {
    const actions = spyActions();
    const w = mount(Start, { props: { actions, resumable: true } });
    await flush();

    const continueBtn = w.findAll('button').find((b) => b.text() === 'Continue the last sitting');
    expect(continueBtn, 'no Continue control when a run is resumable').toBeTruthy();
    await continueBtn!.trigger('click');
    expect(actions.resume).toHaveBeenCalled();
    expect(actions.begin).not.toHaveBeenCalled();
  });

  it('offers only Begin, as the primary action, with nothing to continue', async () => {
    const w = mount(Start, { props: { actions: spyActions(), resumable: false } });
    await flush();

    expect(w.findAll('button').some((b) => b.text() === 'Continue the last sitting')).toBe(false);
    const begin = w.get('button.primary');
    expect(begin.text()).toBe('Begin the signing');
  });
});

describe('named saves', () => {
  it('lists a written-down run and exports it on request', async () => {
    const saves: SaveSummary[] = [{ slot: 'chapter-1-1080', year: 1080 }];
    const actions = spyActions(saves);
    const w = mount(Start, { props: { actions, resumable: false } });
    await flush();

    expect(w.text()).toContain('chapter-1-1080');
    const copyOut = w.findAll('button').find((b) => b.text() === 'Copy out');
    await copyOut!.trigger('click');
    expect(actions.exportSave).toHaveBeenCalledWith('chapter-1-1080');
  });

  it('does not duplicate the autosave slot once Continue already offers it', async () => {
    const saves: SaveSummary[] = [{ slot: 'autosave', year: 1090 }];
    const w = mount(Start, { props: { actions: spyActions(saves), resumable: true } });
    await flush();

    expect(w.find('section.saved').exists(), 'autosave listed twice').toBe(false);
  });

  it('still offers the autosave slot from the list when resumable lags behind it', async () => {
    const saves: SaveSummary[] = [{ slot: 'autosave', year: 1090 }];
    const w = mount(Start, { props: { actions: spyActions(saves), resumable: false } });
    await flush();

    expect(w.text()).toContain('The last sitting');
  });
});
