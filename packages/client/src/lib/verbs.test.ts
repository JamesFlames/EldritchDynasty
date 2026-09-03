import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadContent } from '@ed/content';
import { GameSession } from '@ed/core';
import { createGame } from './game.js';

const SRC = join(import.meta.dirname, '..');

/**
 * EVERY VERB THE PLAYER HAS, REACHABLE FROM SOMETHING THEY CAN CLICK.
 *
 * This repository fails by doing nothing, and a client is the best place in it
 * to fail that way: a verb that is never wired looks exactly like a verb
 * nobody happened to use. `send` is the one to picture — name the party and
 * let what they are between them decide the branch. Leave it unwired and every
 * `party` decider in the content resolves through `letHimDecide` instead, the
 * game plays, nothing throws, and the finding arrives in month four.
 *
 * So the chain is checked in two links, and neither end of it is a list
 * anybody maintains:
 *
 *   GameSession's methods  →  called in `game.ts`  →  an action a template calls
 *
 * The first list comes off the prototype and the second off the store itself,
 * so adding a verb to `session.ts` or an action to the store fails this until
 * it is wired all the way through.
 */
function walk(dir: string, ext: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, ext, out);
    else if (entry.endsWith(ext)) out.push(path);
  }
  return out;
}

const templates = walk(SRC, '.vue');
const clientSource = [...walk(SRC, '.ts'), ...templates]
  .filter((p) => !p.endsWith('.test.ts'))
  .map((path) => ({ path, text: readFileSync(path, 'utf8') }));

const store = readFileSync(join(SRC, 'lib/game.ts'), 'utf8');

/** Block comments, line comments, and an HTML comment in a template. */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * The methods, not the getters. `year` and `pending` are read off the view as
 * values — `view()` is values only by contract, and a client that read the
 * live getters instead would be holding two clocks.
 */
const VERBS = Object.getOwnPropertyNames(GameSession.prototype).filter((name) => {
  if (name === 'constructor') return false;
  const d = Object.getOwnPropertyDescriptor(GameSession.prototype, name);
  return typeof d?.value === 'function';
});

describe('every verb reaches the player', () => {
  it('GameSession has the verbs the client was written against', () => {
    // A sanity check on the reflection above: if this ever comes back empty
    // the two tests below would pass by vacuum.
    expect(VERBS).toContain('send');
    expect(VERBS.length).toBeGreaterThan(8);
  });

  it.each(VERBS)('the store calls session.%s', (verb) => {
    expect(store).toContain(`.${verb}(`);
  });

  it.each(Object.keys(createGame(loadContent()).actions))(
    'a template calls actions.%s',
    (action) => {
      expect(templates.some((path) => readFileSync(path, 'utf8').includes(`actions.${action}(`)))
        .toBe(true);
    },
  );
});

describe('the client stays on its side of the seam', () => {
  /**
   * `session.ctx` is reachable on purpose — the editor needs it for previews —
   * and that makes it the shortcut a client reaches for the first time the
   * read model is missing something. It is not a shortcut. It is live
   * simulation state that changes under the render, which is what the
   * editor's version counter exists to work around, and a client that reads
   * it has quietly stopped being written against the seam.
   *
   * If the UI needs something it cannot get here, the missing thing is a verb
   * on `session.ts`.
   */
  it('nothing reaches into ctx', () => {
    // Comments off first: two files explain WHY they do not do this, and a
    // rule that fails on its own reasoning gets deleted rather than obeyed.
    const offenders = clientSource.filter((f) => /\.ctx\b/.test(stripComments(f.text)));
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it('only the store imports the simulation for anything but a type', () => {
    const offenders = clientSource
      .filter((f) => !f.path.endsWith('lib/game.ts') && !f.path.endsWith('lib/content.ts'))
      .filter((f) => /^\s*import\s+(?!type\b)[^;]*from\s+'@ed\/(core|schema)'/m.test(f.text));
    expect(offenders.map((f) => f.path)).toEqual([]);
  });
});

describe('the store drives a game', () => {
  it('begins a run and turns the clock through the read model', () => {
    const game = createGame(loadContent());
    game.actions.begin(1042);

    expect(game.view.value?.year).toBe(1042);
    expect(game.table.value).not.toBeNull();
    expect(game.view.value?.halls.some((h) => h.members.length > 0)).toBe(true);

    // Twenty years, answering whatever stops the clock the way the escape
    // hatch does. Enough to prove the loop turns; the whole run is in
    // `run.slow.test.ts`, where a suite that plays a game belongs.
    for (let i = 0; i < 20; i++) {
      game.actions.advance(1);
      if (game.docket.value.length) game.actions.letHimDecide();
      if (game.view.value?.namesWanted.length) game.actions.keepSuggestedNames();
    }

    expect(game.view.value!.year).toBeGreaterThan(1042);
    expect(game.view.value!.chronicle.length).toBeGreaterThan(0);
  });

  /**
   * The reason, AND which panel asked for it (issue #55). One shared string was
   * drawn in one panel while refusals came from nine, so an order refused from
   * The Papers printed its reason about 1,500px above the button just pressed
   * — off-screen, and indistinguishable from nothing having happened.
   */
  it('refuses an order the house cannot carry out, and says which panel asked', () => {
    const game = createGame(loadContent());
    game.actions.begin(1042);

    const result = game.actions.order({ kind: 'study', person: 'nobody', book: 'nothing' });

    expect(result.ok).toBe(false);
    expect(game.refusal.value?.reason).toBeTruthy();
    expect(game.refusal.value?.kind, 'the refusal cannot be drawn beside its own control').toBe('study');
    // And it is cleared by an order that works, rather than standing until
    // something else happens to fail.
    game.actions.order({ kind: 'marriages', policy: 'as_it_falls' });
    expect(game.refusal.value).toBeNull();
  });
});
