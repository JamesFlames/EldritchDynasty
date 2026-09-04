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

  /**
   * ISSUE #49. The clock offers to move twenty-five years at a stroke, and
   * until the passage log it moved them in silence: births, deaths and
   * awakenings are reported by `stepYear` and written to the chronicle by
   * nothing, so a jump that buried four people looked exactly like a jump
   * that buried none.
   *
   * This run presses "on" in fifty-year strides, which is the hardest case —
   * if the fold is dropped anywhere in the store's loop, the log is empty and
   * the panel silently stops existing.
   */
  it('kept a record of what the years did while the player was pressing on', () => {
    const passages = game.passages.value;
    expect(passages.length).toBeGreaterThan(0);

    // Newest first, the way the chronicle beside it reads.
    const years = passages.map((p) => p.year);
    expect([...years].sort((a, b) => b - a)).toEqual(years);

    // The demography, which is the whole reason this panel exists: none of it
    // is in the book unless an authored event happened to mention it.
    const kinds = new Set(passages.flatMap((p) => p.lines.map((l) => l.kind)));
    expect(kinds.has('death')).toBe(true);
    expect(kinds.has('birth')).toBe(true);

    // A tail, not an archive. The chronicle is the archive.
    expect(passages.length).toBeLessThanOrEqual(200);
  });
});

/**
 * THE MIDDLE BEAT (issue #84).
 *
 * Decide → see what it did → decide again. The middle beat was not
 * implemented: `resolveChoice` returned the rendered outcome prose and the
 * store dropped it, so answering a five-sentence dilemma replaced the panel
 * with the next dilemma and the consequence went to the far right of the
 * board as one unhighlighted line among that year's births, deaths and assize
 * responses.
 *
 * Played rather than built, because the claim is about every kind of thing
 * the docket raises over a thousand years, answered one control at a time —
 * which is what `letHimDecide` (the way every other suite here drives a run)
 * deliberately does not do.
 */
describe('answering a decision says what it did', () => {
  const game = createGame(content);
  game.actions.begin(4242);

  const held: string[] = [];
  const kinds = new Set<string>();
  let answered = 0;
  let stacked = 0;

  for (let guard = 0; guard < 3000 && !game.ended.value; guard += 1) {
    if (game.outcome.value) {
      // The next decision waits behind it. If the docket were allowed
      // through, the outcome would be a panel the player never sees.
      if (game.docket.value.length) stacked += 1;
      held.push(game.outcome.value.text ?? '');
      game.actions.dismissOutcome();
      continue;
    }

    const d = game.docket.value[0];
    if (!d) {
      game.actions.advance(25);
      if (game.view.value?.namesWanted.length) game.actions.keepSuggestedNames();
      continue;
    }

    kinds.add(d.kind);
    answered += 1;
    if (d.kind === 'choice') {
      if (!d.choicesAreOpen) { game.actions.letHimDecide(); continue; }
      const open = d.choices.find((c) => c.available);
      if (!open || d.cast.some((r) => !r.optional)) { game.actions.letHimDecide(); continue; }
      game.actions.choose(d.id, open.id, {}, open.label);
    } else if (d.kind === 'match') {
      const card = d.cards.find((c) => c.available);
      if (card) game.actions.match(d.id, card.id, card.name);
      else game.actions.declineHand(d.id);
    } else {
      game.actions.record(d.id, 'record', 'Write it as it happened');
    }
  }

  it('answered a run\'s worth of decisions of every kind', () => {
    expect(answered).toBeGreaterThan(40);
    expect([...kinds].sort()).toEqual(['choice', 'match', 'record']);
  });

  it('held an outcome with real words in it, over and over', () => {
    // Not "at least one": the bug was that this fired 304 times a run and was
    // shown zero times, so a single hit would be indistinguishable from the
    // one path that happens to work.
    expect(held.length).toBeGreaterThan(20);
    expect(held.every((t) => t.length > 0)).toBe(true);
  });

  it('stood in front of the next decision rather than beside it', () => {
    // The panel replaces the docket. Every one of these was a moment where a
    // decision was standing and the player was reading what the last one did.
    expect(stacked).toBeGreaterThan(0);
  });

  it('cleared itself when the clock moved on', () => {
    expect(game.outcome.value).toBeNull();
  });
});

