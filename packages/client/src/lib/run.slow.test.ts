import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { createGame, COLLECTION_YEAR } from './game.js';

/**
 * A WHOLE RUN, DRIVEN THE WAY THE CLIENT DRIVES IT.
 *
 * Not a balance test — the simulation has thirty of those. What this asserts
 * is the shape of a played game as the UI sees it: that the clock reaches
 * 2042 and stops there, that the docket actually raises each of its kinds at
 * some point in a thousand years, and that the tree and the book are not
 * empty at the end.
 *
 * The docket kinds are the reason it exists. `Docket.vue` draws three shapes,
 * and a kind that never fires is a branch of that template nobody has ever
 * rendered — the failure this repository has shipped four times, one layer
 * up. Answering everything through `letHimDecide` is exactly what a player
 * who has stopped reading does, and the run has to survive that too.
 */
const content = loadContent();

/**
 * One whole run, driven the way a player who has stopped reading drives it:
 * press on, answer whatever stops the clock, dismiss whatever is shown.
 */
function playARun(seed: number) {
  const game = createGame(content);
  game.actions.begin(seed);
  game.actions.found({
    houseName: 'The House of Salt',
    heirloom: 'portion_of_agelessness',
    grudge: 'house_marrow',
  });

  const kinds = new Set<string>();
  let interludes = 0;

  // The store's `advance` stops of its own accord at a decision, a child
  // waiting to be named, and 2042 — so this loop is what the player pressing
  // "on" does, plus an answer each time it stops.
  for (let guard = 0; guard < 4000 && !game.ended.value; guard++) {
    game.actions.advance(50);
    for (const d of game.docket.value) kinds.add(d.kind);
    if (game.docket.value.length) game.actions.letHimDecide();
    else if (game.view.value?.namesWanted.length) game.actions.keepSuggestedNames();
    if (game.interlude.value) {
      interludes += 1;
      game.actions.dismissInterlude();
    }
  }
  return { game, kinds, interludes };
}

describe('a run played through the client', () => {
  const { game, kinds, interludes } = playARun(1042);
  const view = game.view.value!;

  it('stops at the year the other party comes to collect, and is read', () => {
    expect(view.year).toBe(COLLECTION_YEAR);
    expect(game.ended.value).toBe(true);

    // And there is an ending, assembled from the book this run wrote — not a
    // screen that says the run is over.
    const epilogue = game.epilogue.value!;
    expect(epilogue.id).toBe(view.ending!.id);
    expect(epilogue.ring.filter((b) => b.changed !== undefined)).toHaveLength(1);
    expect(epilogue.reckoning.pages).toBeGreaterThan(0);
    expect(epilogue.closing.length).toBeGreaterThan(0);
  });

  /**
   * ISSUE #38's OTHER HALF: a prologue answered in 1042 and still legible on
   * the last night, through nine hundred years of simulation and whatever the
   * run did to the house in between.
   */
  it('still knows what was chosen in 1042', () => {
    expect(game.epilogue.value!.founding).toEqual({
      houseName: 'The House of Salt',
      heirloom: 'portion_of_agelessness',
      heirloomName: 'A Portion of Agelessness',
      grudge: 'house_marrow',
      grudgeName: 'House Marrow',
    });
    expect(view.houseName).toBe('The House of Salt');
  });

  /**
   * THREE RUNS FOR THIS ONE ASSERTION, AND ONE FOR EVERYTHING ELSE.
   *
   * A `record` decision arises in about nine runs in ten — measured, 27 of 30
   * — because Record blocks live on the rare and uncommon tiers and a
   * thousand years draws only a couple of them. So one seed answered "does
   * `Docket.vue` ever draw its third shape" with a nine-in-ten coin, and it
   * came up tails the first time an unrelated change moved the event stream.
   *
   * Three seeds put that at about one in a thousand. It is the one assertion
   * here that is about a RATE rather than a shape, so it is the only one that
   * pays for the extra runs; the rest stay on the primary run above.
   */
  it('raised every kind of decision the docket draws', () => {
    const seen = new Set(kinds);
    for (const seed of [77, 909]) for (const k of playARun(seed).kinds) seen.add(k);
    expect([...seen].sort()).toEqual(['choice', 'match', 'record']);
  });

  it('held at least one interlude, and kept the rest as a record', () => {
    expect(interludes).toBeGreaterThan(0);
    expect(game.frame.value.length).toBeGreaterThan(0);
  });

  it('ends with a house and a book, not an empty screen', () => {
    expect(view.chronicle.length).toBeGreaterThan(0);
    expect(view.halls.reduce((n, h) => n + h.members.length, 0)).toBeGreaterThan(0);
  });
});
