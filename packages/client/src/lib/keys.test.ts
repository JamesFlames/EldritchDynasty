import { describe, expect, it } from 'vitest';
import { shortcutFor } from './keys.js';

/**
 * THE FOUR TIMES A SHORTCUT MUST NOT FIRE (issue #58).
 *
 * The wiring is the easy half. Every one of these is a bug you find by having
 * somebody name their house and watching the clock jump twenty-five years, and
 * none of them is visible in the code that adds the listener.
 */
describe('what a keypress means', () => {
  it('turns a year on Space and on Enter, and five on Shift+Enter', () => {
    expect(shortcutFor({ key: ' ' })).toEqual({ kind: 'advance', years: 1 });
    expect(shortcutFor({ key: 'Enter' })).toEqual({ kind: 'advance', years: 1 });
    expect(shortcutFor({ key: 'Enter', shift: true })).toEqual({ kind: 'advance', years: 5 });
    // Shift+Space is not five. Only one key carries the second meaning, and
    // guessing the other would turn a stray press into a jump.
    expect(shortcutFor({ key: ' ', shift: true })).toEqual({ kind: 'advance', years: 1 });
  });

  it('takes the numbered choice, counting from what the eye sees', () => {
    expect(shortcutFor({ key: '1' })).toEqual({ kind: 'take', index: 0 });
    expect(shortcutFor({ key: '9' })).toEqual({ kind: 'take', index: 8 });
    // Zero is not a choice anybody can see, so it is not one.
    expect(shortcutFor({ key: '0' })).toBeNull();
  });

  /** A player typing their house name is not steering the clock. */
  it('says nothing at all while somebody is typing', () => {
    for (const key of [' ', 'Enter', '1', '?', 'a']) {
      expect(shortcutFor({ key, inField: true }), `"${key}" fired in a text field`).toBeNull();
    }
  });

  /** Except Escape, which is how you get out of a field and out of a dialog. */
  it('still leaves, from inside a field', () => {
    expect(shortcutFor({ key: 'Escape', inField: true })).toEqual({ kind: 'dismiss' });
  });

  /**
   * The one that would be found last. Tab to "Take this one", press Enter, and
   * a stolen Enter turns a year instead of taking the card — the browser's
   * default on a focused button is the correct behaviour.
   */
  it('leaves Space and Enter to a control that already answers them', () => {
    expect(shortcutFor({ key: 'Enter', onControl: true })).toBeNull();
    expect(shortcutFor({ key: ' ', onControl: true })).toBeNull();
    // Numbers are still ours — no button answers "3".
    expect(shortcutFor({ key: '3', onControl: true })).toEqual({ kind: 'take', index: 2 });
  });

  /** Ctrl-R reloads and Cmd-L is the address bar. A game that eats those closes. */
  it('never touches a modified press', () => {
    for (const key of [' ', 'Enter', '1', '?', 'Escape']) {
      expect(shortcutFor({ key, modified: true }), `"${key}" was taken with a modifier held`).toBeNull();
    }
  });

  it('offers the list on ?', () => {
    expect(shortcutFor({ key: '?' })).toEqual({ kind: 'help' });
  });

  it('ignores everything it was not asked about', () => {
    for (const key of ['a', 'F5', 'Tab', 'ArrowLeft', 'Backspace']) {
      expect(shortcutFor({ key }), `"${key}" was claimed`).toBeNull();
    }
  });
});
