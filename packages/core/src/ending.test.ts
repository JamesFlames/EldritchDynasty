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

/**
 * A page of the book that says the house stood somewhere, AND the standing it
 * is a record of.
 *
 * `tickAscension` writes the two together — the page the year the house first
 * stands somewhere new, and `world.ascension.best` in the same breath — so a
 * fixture that wrote only the page was describing a state the simulation
 * cannot produce. That went unnoticed while `attested` was the only thing read
 * off it; issue #77 made the truth underneath a page load-bearing, because
 * `substantiated` is now capped by it. Use `forge` for a page with nothing
 * under it, which is the whole of what #77 added.
 */
function attest(ctx: SimCtx, rung: Rung, year = ctx.world.year - 40): void {
  forge(ctx, rung, year);
  ctx.world.ascension.best = rung;
}

/** A page claiming a rung the house never stood on. The book, lying. */
function forge(ctx: SimCtx, rung: Rung, year = ctx.world.year - 40): void {
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

/**
 * §29.3'S THIRD BITE — THE RECORD READ BACK.
 *
 * §6's closing sentence is the specification: *a house that embellished
 * everything arrives exalted, revered, and unable to prove a single thing it
 * needs to prove.* For four hundred commits the two halves of it were both
 * true and neither was connected — `standingLies` was counted, printed on the
 * ending screen, and read by nothing that decided anything, which is invariant
 * 11 sitting in the one place the game's thesis is supposed to land.
 *
 * The tests that matter are the ones where the book claims more than it can
 * hold up, because for an honest house every number here is the same number.
 */
describe('what the book cannot hold up', () => {
  /** `n` standing lies of one severity, each with a name of its own. */
  function lie(ctx: SimCtx, n: number, severity = 'total', state = 'open'): void {
    for (let i = 0; i < n; i++) {
      ctx.world.discrepancies.set(`${severity}_${state}_${i}`, { severity, provableBy: [], state: state as never });
    }
  }

  it('takes the book at its word when the book is honest', () => {
    const ctx = atTheTerm();
    attest(ctx, 'hierophant');

    const r = readTheChronicle(ctx);
    expect(r.unsupportable).toBe(0);
    expect(r.rungsWithheld).toBe(0);
    // The two are the same number for a house that kept its record, and that
    // is the case this whole mechanism must not disturb.
    expect(r.substantiated).toBe(r.attested);
    expect(selectEnding(ctx)).toBe('devoured');
  });

  it('will not take a rung the rest of the book cannot support', () => {
    const ctx = atTheTerm();
    attest(ctx, 'hierophant');
    // Five `total` discrepancies weigh 20, which is over one rung's worth.
    lie(ctx, 5);

    const r = readTheChronicle(ctx);
    expect(r.unsupportable).toBe(20);
    expect(r.rungsWithheld).toBe(1);
    expect(r.attested).toBe('hierophant');
    expect(r.substantiated).toBe('adept');
    // The house reached the third rung and arrives at §23's worst ending. It
    // is not that it failed to climb; it is that it cannot show that it did.
    expect(selectEnding(ctx)).toBe('forgotten');
  });

  it('withholds more than one rung when the book is bad enough', () => {
    const ctx = atTheTerm();
    attest(ctx, 'god');
    lie(ctx, 9); // 36 — two rungs

    const r = readTheChronicle(ctx);
    expect(r.rungsWithheld).toBe(2);
    expect(r.substantiated).toBe('vessel');
    // Turned away from apotheosis by its own record, and it lands where a
    // house at that height lands.
    expect(selectEnding(ctx)).toBe('devoured');
  });

  it('never withholds past the ground', () => {
    const ctx = atTheTerm();
    attest(ctx, 'touched');
    lie(ctx, 40);

    expect(readTheChronicle(ctx).substantiated).toBe('none');
    expect(selectEnding(ctx)).toBe('forgotten');
  });

  it('charges a lie that stands, and not one that was caught or buried', () => {
    const ctx = atTheTerm();
    attest(ctx, 'hierophant');
    // Enough weight to cost a rung twice over, in the two states that are
    // already settled: proven is billed in the year it is caught (§6), and
    // buried is the act that answers this bill (§29.4 rule 5).
    lie(ctx, 10, 'total', 'proven');
    lie(ctx, 10, 'total', 'buried');

    const r = readTheChronicle(ctx);
    expect(r.provenLies).toBe(10);
    expect(r.unsupportable).toBe(0);
    expect(selectEnding(ctx)).toBe('devoured');
  });

  it('weighs a severity it does not recognise as the cheapest one', () => {
    const ctx = atTheTerm();
    // `grave` is not a severity any schema declares. A typo in a content file
    // must not quietly bill the house four times over.
    lie(ctx, 3, 'grave');
    expect(readTheChronicle(ctx).unsupportable).toBe(3);
  });

  it('leaves the reason in the chronicle, where the player can find it', () => {
    const ctx = atTheTerm();
    attest(ctx, 'hierophant');
    lie(ctx, 5);
    expect(closeTheLedger(ctx)).toBe('forgotten');

    // §29.3's guard rail: a cost that cannot be reconstructed is
    // indistinguishable from bad dice. The page names both readings.
    const last = ctx.world.chronicle[ctx.world.chronicle.length - 1]!;
    expect(last.text).toContain('Hierophant');
    expect(last.text).toContain('Adept');
    // And it is not itself evidence — it carries no rung, so a second reading
    // of the same book cannot find a claim this page put there.
    expect(last.rung).toBeUndefined();
  });

  it('says nothing about a reading that took the whole book', () => {
    const ctx = atTheTerm();
    attest(ctx, 'hierophant');
    closeTheLedger(ctx);
    expect(ctx.world.chronicle.some((e) => e.title === 'What Could Not Be Shown')).toBe(false);
  });

  it('tells the two Forgottens apart', () => {
    const never = atTheTerm();
    closeTheLedger(never);
    const fromBelow = endingSummary('forgotten', readTheChronicle(never));

    const fell = atTheTerm();
    attest(fell, 'hierophant');
    lie(fell, 5);
    closeTheLedger(fell);
    const fromAbove = endingSummary('forgotten', readTheChronicle(fell));

    // A house that climbed and could not prove it must not be told it never
    // passed Adept. It did; the sentence would simply be false.
    expect(fromBelow).toContain('never passed');
    expect(fromAbove).not.toContain('never passed');
    expect(fromAbove).toContain('could not hold it up');
  });
});

describe('which of the five', () => {
  it('reads to an empty room when the line is broken', () => {
    const ctx = atTheTerm();
    attest(ctx, 'god');
    for (const p of [...ctx.world.people.living()]) {
      ctx.world.people.kill(p.id, ctx.world.year, 'the overflow');
    }
    expect(readTheChronicle(ctx).livingBlood).toBe(0);
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

describe('the book may say more than the house did (issue #77)', () => {
  /**
   * §6's thesis has two halves, and until #77 the ladder carried only one of
   * them. `entry.rung` was written by `tickAscension` alone and written
   * truthfully, so the book could LOSE a claim and never MAKE one: over 120
   * measured thousand-year runs, across three pens, the number in which the
   * house reached higher than its book attests was zero, and so was the number
   * in which the book claimed more than the house reached.
   *
   * The pen can round up now. What it can never do is make the claim true.
   */
  it('attests a forged rung, and never substantiates it', () => {
    const ctx = atTheTerm();
    ctx.world.ascension.best = 'adept';
    forge(ctx, 'hierophant');

    const r = readTheChronicle(ctx);
    // The gap, running the direction it never ran before.
    expect(r.attested).toBe('hierophant');
    expect(r.substantiated).toBe('adept');
  });

  it('does not substantiate a forgery even when the rest of the book is spotless', () => {
    // THE CASE WITHHOLDING ALONE WOULD MISS. `rungsWithheld` counts what is
    // STANDING, so a house that forged a rung and then cleared every lie —
    // bought the pages, buried them, had them proven and paid for — arrives
    // with nothing outstanding. Without the cap on truth, the forgery is read
    // back to it as fact, which is the bluff working rather than being called.
    const ctx = atTheTerm();
    ctx.world.ascension.best = 'adept';
    forge(ctx, 'hierophant');

    const r = readTheChronicle(ctx);
    expect(r.unsupportable).toBe(0);
    expect(r.rungsWithheld).toBe(0);
    expect(r.substantiated).toBe('adept');
  });

  it('cannot reach Apotheosis with a pen', () => {
    // The ending the game is named for, and #77's own condition on building
    // any of this: Apotheosis fires on a SUBSTANTIATED god, so a forged god
    // must not reach it. Asserted rather than left to follow from a comment.
    const ctx = atTheTerm();
    ctx.world.ascension.best = 'demigod';
    forge(ctx, 'god');

    const r = readTheChronicle(ctx);
    expect(r.attested).toBe('god');
    expect(r.substantiated).not.toBe('god');
    expect(selectEnding(ctx)).not.toBe('apotheosis');

    // The control: the same book, over a house that actually got there.
    const real = atTheTerm();
    attest(real, 'god');
    closeTheLedger(real);
    expect(readTheChronicle(real).substantiated).toBe('god');
  });

  it('still takes an honest book at its word', () => {
    // The case this whole mechanism must not disturb, restated against the
    // cap: a house that stood where it says it stood loses nothing to it.
    const ctx = atTheTerm();
    attest(ctx, 'hierophant');
    const r = readTheChronicle(ctx);
    expect(r.attested).toBe('hierophant');
    expect(r.substantiated).toBe('hierophant');
  });
});
