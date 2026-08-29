import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import {
  HOUSE_NAME_MAX, foundHouse, grudgeAgainstUs, heldHeirlooms, loadGame, newGame,
  prologueView, saveGame, testWorld, viewOf,
} from '@ed/core';

const content = loadContent();

const CHOICE = {
  houseName: 'The House of Salt',
  heirloom: 'portion_of_agelessness',
  grudge: 'house_marrow',
};

/**
 * THE SIGNING (concept §3, issue #38).
 *
 * The two choices are not flavour. The founding gift goes into
 * `world.heirlooms`, where the ladder and the auction can both see it; the
 * first grudge is a `Relationship` edge that `grudgeAgainstUs` reads for a
 * thousand years. The failure this file is written against is the one this
 * repository fails by: a prologue that collects two answers, writes them into
 * a field nothing reads, and looks exactly like a prologue that works.
 */
describe('the prologue', () => {
  it('offers the triad, both choices, and the objects behind them', () => {
    const view = prologueView(testWorld(content))!;

    expect(view.triad).toHaveLength(3);
    expect(view.heirlooms.length).toBeGreaterThan(1);
    expect(view.grudges.length).toBeGreaterThan(1);
    // The option carries the object's own name and blurb, so a client never
    // has to look one up and never has to hold its own copy of the list.
    for (const option of view.heirlooms) expect(option.name.length).toBeGreaterThan(0);
    for (const option of view.grudges) expect(option.houseName.length).toBeGreaterThan(0);
    expect(view.thesis.length).toBeGreaterThan(0);
    expect(view.founded).toBeUndefined();
  });

  it('puts the founding gift in the house and the grudge in the world', () => {
    const ctx = testWorld(content);
    const before = grudgeAgainstUs(ctx.world);

    expect(foundHouse(ctx, CHOICE).ok).toBe(true);

    expect(heldHeirlooms(ctx).map((h) => h.id)).toContain('portion_of_agelessness');
    expect(grudgeAgainstUs(ctx.world)).toBeGreaterThan(before);
    // Held BY somebody of theirs, AGAINST somebody of ours — both ends
    // people, which is what makes it survive `tickRelationships`.
    const edge = [...ctx.world.relationships.values()].find(
      (r) => ctx.world.people.get(r.from)?.houseOfOrigin === 'house_marrow'
        && r.grudges.some((g) => g.originEvent === 'the_signing'),
    );
    expect(edge?.grudges.length).toBeGreaterThan(0);
    expect(ctx.world.people.get(edge!.to)?.houseOfOrigin).toBe(ctx.world.playerHouse);
  });

  it('gives the house the name the player gave it', () => {
    const ctx = testWorld(content);
    foundHouse(ctx, CHOICE);

    expect(ctx.world.founding?.houseName).toBe('The House of Salt');
    expect(viewOf(ctx).houseName).toBe('The House of Salt');
  });

  it('writes what was asked for into the book, where the creditor will read it', () => {
    const ctx = testWorld(content);
    foundHouse(ctx, CHOICE);

    const page = ctx.world.chronicle.at(-1)!;
    expect(page.year).toBe(ctx.world.year);
    expect(page.text).toContain('A Portion of Agelessness');
    expect(page.text).toContain('House Marrow');
  });

  it('refuses anything the prologue did not offer, and says why', () => {
    const ctx = testWorld(content);

    expect(foundHouse(ctx, { ...CHOICE, heirloom: 'the_ninefold_seal' }).ok).toBe(false);
    expect(foundHouse(ctx, { ...CHOICE, grudge: 'commons' }).ok).toBe(false);
    expect(foundHouse(ctx, { ...CHOICE, houseName: '   ' }).ok).toBe(false);
    expect(foundHouse(ctx, { ...CHOICE, houseName: 'x'.repeat(HOUSE_NAME_MAX + 1) }).ok).toBe(false);
    // None of the four refusals put anything in the house.
    expect(ctx.world.founding).toBeUndefined();
    expect(heldHeirlooms(ctx).map((h) => h.id)).not.toContain('portion_of_agelessness');

    const refusal = foundHouse(ctx, { ...CHOICE, heirloom: 'the_ninefold_seal' });
    expect(refusal.reason?.length).toBeGreaterThan(0);
  });

  it('happens once', () => {
    const ctx = testWorld(content);
    expect(foundHouse(ctx, CHOICE).ok).toBe(true);
    expect(foundHouse(ctx, { ...CHOICE, houseName: 'A Second Thought' }).ok).toBe(false);
    expect(ctx.world.founding?.houseName).toBe('The House of Salt');
  });

  /**
   * ISSUE #38'S ACCEPTANCE: "the two choices are readable off the save nine
   * hundred years later". A field the save format forgets resets silently on
   * load, which looks exactly like a subsystem that stopped working two
   * centuries in. The nine hundred years themselves are in
   * `prologue.slow.test.ts`, where a suite that plays a game belongs.
   */
  it('is readable off the save', () => {
    const g = newGame(content, { seed: 1042, decider: 'chronicler' });
    g.found(CHOICE);
    g.advance(200);

    const resumed = loadGame(JSON.parse(JSON.stringify(saveGame(g.ctx))), content);

    expect(resumed.world.founding).toEqual({
      houseName: 'The House of Salt',
      heirloom: 'portion_of_agelessness',
      grudge: 'house_marrow',
      year: 1042,
    });
    expect(prologueView(resumed)!.founded?.houseName).toBe('The House of Salt');
  });
});
