import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import {
  END_YEAR, GOD_RITE_FAILED, closeTheLedger, endingSummary, epilogueOf, foundHouse,
  readTheChronicle, selectEnding, stepYear, testWorld,
} from '@ed/core';
import { ENDING_ORDER, type Rung } from '@ed/schema';
import type { SimCtx } from './world.js';

const content = loadContent();

/** A house sitting at the term, with the founding cast in it and nothing written. */
function atTheTerm(seed = 9001): SimCtx {
  return testWorld(content, seed, END_YEAR);
}

/** A page of the book that says the house stood somewhere. */
function attest(ctx: SimCtx, rung: Rung, year = ctx.world.year - 40): void {
  ctx.world.chronicle.push({
    year,
    weight: 'paragraph',
    title: 'A Rung',
    text: `Somebody stood where nobody of the blood had stood before, and they called it ${rung}.`,
    named: false,
    rung,
  });
}

/**
 * THE CREDITOR READS THE CHRONICLE, NOT THE WORLD.
 *
 * §6 is explicit and it is the whole thesis of the game, and it is exactly the
 * kind of rule that gets implemented as `world.ascension.best` by accident and
 * then passes every test anybody thinks to write — because for a house that
 * wrote everything down the two numbers are the same.
 *
 * So the tests that matter here are the ones where they differ.
 */
describe('the last night reads the book', () => {
  it('ignores what the house became and asks what the book can show', () => {
    const ctx = atTheTerm();
    // The house genuinely made a god. The book does not mention it.
    ctx.world.ascension.best = 'god';
    ctx.world.ascension.rung = 'god';

    expect(readTheChronicle(ctx).attested).toBe('none');
    expect(selectEnding(ctx)).toBe('forgotten');

    // One page, and the same world ends four rungs away.
    attest(ctx, 'god');
    expect(readTheChronicle(ctx).attested).toBe('god');
    expect(selectEnding(ctx)).toBe('apotheosis');
  });

  it('does not count a page that is known to have existed and gone', () => {
    const ctx = atTheTerm();
    attest(ctx, 'hierophant');
    expect(selectEnding(ctx)).toBe('devoured');

    // Greyed: the entry is still in the book as a thing that WAS (concept §6),
    // and it is no longer evidence of anything.
    ctx.world.chronicle[ctx.world.chronicle.length - 1]!.greyed = true;
    expect(selectEnding(ctx)).toBe('forgotten');
  });

  it('counts the blanks as pages read, and never as evidence', () => {
    const ctx = atTheTerm();
    ctx.world.chronicle.push({ year: 1500, weight: 'paragraph', text: null, named: false, record: 'omit' });

    const r = readTheChronicle(ctx);
    expect(r.blanks).toBe(1);
    expect(r.attested).toBe('none');
  });
});

describe('which of the five', () => {
  it('reads to an empty room when the line is broken', () => {
    const ctx = atTheTerm();
    attest(ctx, 'god');
    for (const p of [...ctx.world.people.living()]) {
      ctx.world.people.kill(p.id, ctx.world.year, 'the overflow');
    }
    expect(readTheChronicle(ctx).atTheTable).toBe(0);
    expect(selectEnding(ctx)).toBe('broken_line');
  });

  it('takes the rite failing at the last step over everything the book says', () => {
    const ctx = atTheTerm();
    attest(ctx, 'god');
    ctx.world.flags.set(GOD_RITE_FAILED, true);
    expect(selectEnding(ctx)).toBe('unmade');
  });

  it('is devoured at Hierophant and above, and forgotten at Adept and below', () => {
    for (const rung of ['hierophant', 'vessel', 'demigod'] as Rung[]) {
      const ctx = atTheTerm();
      attest(ctx, rung);
      expect(selectEnding(ctx), rung).toBe('devoured');
    }
    for (const rung of ['none', 'touched', 'adept'] as Rung[]) {
      const ctx = atTheTerm();
      attest(ctx, rung);
      expect(selectEnding(ctx), rung).toBe('forgotten');
    }
  });

  it('names every one of the five, exhaustively', () => {
    const r = readTheChronicle(atTheTerm());
    for (const id of ENDING_ORDER) {
      expect(endingSummary(id, r).length).toBeGreaterThan(20);
    }
  });
});

describe('the term', () => {
  it('stops the clock, once, and does not turn another year', () => {
    const ctx = atTheTerm();
    const before = ctx.world.chronicle.length;

    stepYear(ctx);
    expect(ctx.world.year).toBe(END_YEAR);
    expect(ctx.world.ending?.id).toBe('forgotten');
    const after = ctx.world.chronicle.length;

    // Again, and again. 2042 happens to a house once.
    stepYear(ctx);
    stepYear(ctx);
    expect(ctx.world.year).toBe(END_YEAR);
    expect(ctx.world.chronicle.length).toBe(after);
    expect(after).toBe(before + 1);
  });

  it('keeps the ending it chose when the ledger is closed twice', () => {
    const ctx = atTheTerm();
    attest(ctx, 'god');
    expect(closeTheLedger(ctx)).toBe('apotheosis');

    // The house is wiped out afterwards; the run still ended the way it ended.
    for (const p of [...ctx.world.people.living()]) {
      ctx.world.people.kill(p.id, ctx.world.year, 'after the fact');
    }
    expect(closeTheLedger(ctx)).toBe('apotheosis');
  });
});

/**
 * THE RING (concept §23). Same cadence, same three parts, one substitution —
 * and the substitution has to actually land in the text a player reads, which
 * `ending/ring` cannot check because it validates content and this renders it.
 */
describe('the epilogue rings the prologue', () => {
  it('says nothing at all until there has been a last night', () => {
    const ctx = atTheTerm();
    expect(epilogueOf(ctx)).toBeUndefined();
  });

  it('replays the prologue with exactly one element changed, for every ending', () => {
    const prologue = content.prologue!;

    for (const id of ENDING_ORDER) {
      const ctx = atTheTerm();
      ctx.world.ending = { id, year: END_YEAR };
      const epilogue = epilogueOf(ctx)!;

      expect(epilogue.ring, id).toHaveLength(prologue.triad.length);
      const changed = epilogue.ring.filter((b) => b.changed !== undefined);
      expect(changed, `${id} changed ${changed.length} elements`).toHaveLength(1);

      // Every OTHER beat is the prologue's own, word for word.
      epilogue.ring.forEach((beat, i) => {
        if (beat.changed) return;
        expect(beat.given).toBe(prologue.triad[i]!.given);
        expect(beat.owed).toBe(prologue.triad[i]!.owed);
      });
      // And the changed one is not.
      const at = epilogue.ring.findIndex((b) => b.changed);
      const original = prologue.triad[at]!;
      const half = epilogue.ring[at]!.changed!;
      expect(epilogue.ring[at]![half]).not.toBe(original[half]);

      expect(epilogue.closing.length).toBeGreaterThan(0);
      expect(epilogue.thesis).toBe(prologue.thesis);
    }
  });

  it('quotes the book back, blanks included, and names what was founded', () => {
    const ctx = atTheTerm();
    foundHouse(ctx, {
      houseName: 'The House of Salt',
      heirloom: 'portion_of_agelessness',
      grudge: 'house_marrow',
    });
    ctx.world.chronicle.push({ year: 1700, weight: 'paragraph', text: null, named: false, record: 'omit' });
    ctx.world.chronicle.push({
      year: 1701, weight: 'paragraph', text: 'A thing that did not happen.', named: false, record: 'embellish',
    });
    closeTheLedger(ctx);

    const epilogue = epilogueOf(ctx)!;
    expect(epilogue.read.some((e) => e.text === null)).toBe(true);
    expect(epilogue.read.some((e) => e.record === 'embellish')).toBe(true);
    expect(epilogue.founding?.houseName).toBe('The House of Salt');
    expect(epilogue.founding?.heirloomName).toBe('A Portion of Agelessness');
    expect(epilogue.founding?.grudgeName).toBe('House Marrow');
    expect(epilogue.reckoning.blanks).toBeGreaterThan(0);
  });

  it('reports what the house could and could not prove', () => {
    const ctx = atTheTerm();
    ctx.world.discrepancies.set('a_lie', { severity: 'grave', provableBy: [], state: 'open' });
    ctx.world.discrepancies.set('a_caught_lie', { severity: 'grave', provableBy: [], state: 'proven' });
    closeTheLedger(ctx);

    const r = epilogueOf(ctx)!.reckoning;
    expect(r.standingLies).toBe(1);
    expect(r.provenLies).toBe(1);
    // Whoever holds the seal, described by the rung the BOOK grants them —
    // the creditor is reading about the man, not appraising him.
    const seated = ctx.world.people.household(ctx.world.playerHouse, ctx.world.year)
      .find((p) => p.castSlots.includes('head'));
    expect(r.head?.name).toBe(seated?.name);
    expect(r.head?.rung).toBe(r.attested);
    expect(r.clausesTotal).toBe(content.clauses.length);
  });
});
