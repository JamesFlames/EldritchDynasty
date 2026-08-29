import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import {
  applyEffect, beginStudy, bootstrap, effectiveStudyYears, loadGame, phase, place,
  runYears, saveGame, spellbookDef,
} from '@ed/core';
import { asId } from '@ed/schema';

const content = loadContent();

/**
 * THE WAIT, AND THE PIPELINE UNDER IT.
 *
 * The auction has bought books since the auction existed. Nothing read one:
 * `gainSpellbook` was reachable only through a `spellbook` effect no content
 * authored, so a thousand-year run ended with sixty-odd volumes on the shelf,
 * degrading, and `Person.spellsKnown` empty in every house that ever lived.
 * Eleven books carried `studyYears` and the Scholar carried `studySpeed: 0.7`,
 * and both measured a wait nobody was having. `effectiveStudyYears` had zero
 * callers.
 *
 * `op: study` is the door in, and these are the mechanics under it: the years
 * are spent when the book comes down, not when it goes back.
 */

const LIFE = 'lesser_workings_of_life';
const book = (ctx: Parameters<typeof spellbookDef>[0]) => spellbookDef(ctx, LIFE)!;

/**
 * THIS reader's study, and never the whole list. The house opens holding two
 * books now (issue #41), so the steward has somebody on one of them from the
 * first year — `world.studies` is no longer a list of one thing a test put
 * there, and a length assertion on it stopped being about the mechanism.
 */
const studyOf = (ctx: { world: { studies: { person: string; completes: number }[] } }, id: string) =>
  ctx.world.studies.filter((x) => x.person === id);

describe('a book takes the years it says it takes', () => {
  it('study delivers nothing now and the knowledge later', () => {
    const ctx = bootstrap(content, 1042, 1042);
    const reader = place(ctx, { sex: 'female', age: 20, name: 'A Reader' });
    const def = book(ctx);

    expect(beginStudy(ctx, reader, def)).toBe(true);
    expect(reader.spellsKnown).toHaveLength(0);
    expect(studyOf(ctx, reader.id)).toHaveLength(1);
    expect(studyOf(ctx, reader.id)[0]!.completes).toBe(1042 + def.studyYears);

    runYears(ctx, def.studyYears);

    expect(reader.spellsKnown.map(String)).toContain(LIFE);
    expect(studyOf(ctx, reader.id)).toHaveLength(0);
  });

  it('and not a year before', () => {
    const ctx = bootstrap(content, 1042, 1042);
    const reader = place(ctx, { sex: 'female', age: 20, name: 'Not Yet' });
    const def = book(ctx);
    beginStudy(ctx, reader, def);

    runYears(ctx, def.studyYears - 1);

    expect(reader.spellsKnown).toHaveLength(0);
    expect(studyOf(ctx, reader.id)).toHaveLength(1);
  });

  /** The Scholar's entire perk, and the reason `effectiveStudyYears` exists. */
  it('a Scholar reads it faster, and the years are fixed when the book comes down', () => {
    const ctx = bootstrap(content, 1042, 1042);
    const def = book(ctx);
    const plain = place(ctx, { sex: 'female', age: 20, name: 'Plain Reader' });
    const scholar = place(ctx, { sex: 'female', age: 20, name: 'The Scholar' });
    scholar.career = { career: asId('scholar'), from: 1042 };

    expect(effectiveStudyYears(ctx, scholar, def))
      .toBeLessThan(effectiveStudyYears(ctx, plain, def));

    beginStudy(ctx, plain, def);
    beginStudy(ctx, scholar, def);

    const wait = (p: { id: string }) => ctx.world.studies.find((s) => s.person === p.id)!.completes;
    expect(wait(scholar)).toBeLessThan(wait(plain));
  });

  it('never rounds a study down to nothing, however fast the reader', () => {
    const ctx = bootstrap(content, 1042, 1042);
    const p = place(ctx, { sex: 'female', age: 20, name: 'Very Quick' });
    p.career = { career: asId('scholar'), from: 1042 };

    for (const def of content.spellbooks) {
      expect(effectiveStudyYears(ctx, p, def), String(def.id)).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('who may begin, and who may not', () => {
  /** INVARIANT 4: the Mystic restriction. Women study the Threshold four only. */
  it('refuses a woman an elemental book, and allows her a Threshold one', () => {
    const ctx = bootstrap(content, 1042, 1042);
    const her = place(ctx, { sex: 'female', age: 25, name: 'She Who Reads' });

    expect(beginStudy(ctx, her, spellbookDef(ctx, 'lesser_workings_of_fluid')!)).toBe(false);
    expect(beginStudy(ctx, her, book(ctx))).toBe(true);
  });

  /**
   * Asked at the START, not on completion. A man who cannot learn a thing does
   * not spend six years failing to.
   */
  it('refuses on the spot rather than quietly in 1183', () => {
    const ctx = bootstrap(content, 1042, 1042);
    const her = place(ctx, { sex: 'female', age: 25, name: 'Refused' });

    beginStudy(ctx, her, spellbookDef(ctx, 'lesser_workings_of_fluid')!);

    expect(ctx.world.studies).toHaveLength(0);
  });

  it('picking the same book up twice is one study, not two', () => {
    const ctx = bootstrap(content, 1042, 1042);
    const p = place(ctx, { sex: 'female', age: 20, name: 'Halfway Through' });

    expect(beginStudy(ctx, p, book(ctx))).toBe(true);
    expect(beginStudy(ctx, p, book(ctx))).toBe(false);
    expect(ctx.world.studies).toHaveLength(1);
  });

  it('refuses a book the reader already knows', () => {
    const ctx = bootstrap(content, 1042, 1042);
    const p = place(ctx, { sex: 'female', age: 20, name: 'Knows It' });
    beginStudy(ctx, p, book(ctx));
    runYears(ctx, book(ctx).studyYears);

    expect(beginStudy(ctx, p, book(ctx))).toBe(false);
  });

  /** Six years is long enough that this happens. The entry leaves the list either way. */
  it('a reader who dies mid-book drops out without stalling the queue', () => {
    const ctx = bootstrap(content, 1042, 1042);
    const doomed = place(ctx, { sex: 'female', age: 20, name: 'Dies Reading' });
    const def = book(ctx);
    beginStudy(ctx, doomed, def);

    ctx.world.people.kill(doomed.id, 1043, 'a fever');
    runYears(ctx, def.studyYears + 1);

    expect(studyOf(ctx, doomed.id)).toHaveLength(0);
    expect(doomed.spellsKnown).toHaveLength(0);
  });
});

describe('the effect verb, and the year phase', () => {
  it('the study op begins one through the normal effect path', () => {
    const ctx = bootstrap(content, 1042, 1042);
    const p = place(ctx, { sex: 'female', age: 20, name: 'Through The Effect' });

    applyEffect({ kind: 'spellbook', op: 'study', target: { slot: 'R' }, book: LIFE }, ctx, { R: p.id });

    expect(ctx.world.studies).toHaveLength(1);
    expect(p.spellsKnown).toHaveLength(0);
  });

  it('the library phase finishes it and says so in the report and the chronicle', () => {
    const ctx = bootstrap(content, 1042, 1042);
    const p = place(ctx, { sex: 'female', age: 20, name: 'Finishes This Year' });
    beginStudy(ctx, p, book(ctx));
    ctx.world.year = ctx.world.studies[0]!.completes;

    const report = phase('library', ctx);

    expect(report.studiesFinished).toHaveLength(1);
    expect(report.studiesFinished[0]!.person).toBe('Finishes This Year');
    expect(ctx.world.chronicle.some((c) => c.text?.includes('Finishes This Year'))).toBe(true);
  });

  it('a study in flight survives a save', () => {
    const ctx = bootstrap(content, 1042, 1042);
    const p = place(ctx, { sex: 'female', age: 20, name: 'Mid Book' });
    beginStudy(ctx, p, book(ctx));

    const resumed = loadGame(saveGame(ctx), content);

    expect(resumed.world.studies).toHaveLength(1);
    expect(resumed.world.studies[0]!.book).toBe(LIFE);
    expect(resumed.world.studies[0]!.completes).toBe(ctx.world.studies[0]!.completes);

    runYears(resumed, book(ctx).studyYears);
    expect(resumed.world.people.get(p.id)!.spellsKnown.map(String)).toContain(LIFE);
  });
});

/**
 * THE OTHER HALF OF THE DEAD FEATURE.
 *
 * `world.scheduled` is written only by the `schedule` effect and read only by
 * `forcedCandidates`. No content used the effect, so the reader's loop body had
 * never executed — including `SCHEDULE_PATIENCE` and the five-year requeue, and
 * including the remove-before-resolve fix that `selection.ts` documents as a
 * bug this project already shipped once. A scene that was scheduled and never
 * arrived is the exact silence this codebase specialises in.
 */
describe('a scheduled event actually arrives', () => {
  const anAmbientEvent = () => content.events.find((e) => e.tier !== 'frame' && !e.arc)!;

  it('the schedule effect puts it on the calendar for the year it names', () => {
    const ctx = bootstrap(content, 1042, 1042);
    const target = anAmbientEvent();

    applyEffect({ kind: 'schedule', event: String(target.id), inYears: 7 }, ctx, {});

    expect(ctx.world.scheduled).toEqual([{ event: String(target.id), year: 1049 }]);
  });

  it('it does not fire early, and it is off the calendar once it has', () => {
    const ctx = bootstrap(content, 1042, 1042);
    const target = anAmbientEvent();
    applyEffect({ kind: 'schedule', event: String(target.id), inYears: 3 }, ctx, {});

    runYears(ctx, 2);
    expect(ctx.world.scheduled.some((s) => s.event === String(target.id))).toBe(true);

    runYears(ctx, 6);
    // Either it fired, or it could not be cast and was requeued — never simply
    // dropped, which is the failure the patience counter exists to prevent.
    const stillWaiting = ctx.world.scheduled.filter((s) => s.event === String(target.id));
    const fired = ctx.world.decisionLog.some((d) => d.kind === 'outcome' && d.event === String(target.id));
    expect(fired || stillWaiting.length === 1).toBe(true);
  });

  /**
   * A scheduled event that cannot be cast waits rather than vanishing, and
   * gives up after `SCHEDULE_PATIENCE` rather than waiting forever. Both halves
   * matter: the first is the bug, the second is the loop it would otherwise be.
   */
  it('one that can never cast requeues, then gives up instead of looping forever', () => {
    const ctx = bootstrap(content, 1042, 1042);
    const uncastable = content.events.find((e) => Object.keys(e.slots).length && !e.arc)!;
    ctx.world.scheduled.push({ event: String(uncastable.id), year: 1043 });

    // Empty the house: nobody left to cast anything.
    for (const p of ctx.world.people.living()) ctx.world.people.kill(p.id, 1042, 'the test');

    runYears(ctx, 20);
    const waiting = ctx.world.scheduled.filter((s) => s.event === String(uncastable.id));
    expect(waiting.length, 'still waiting, with its original due year remembered').toBe(1);
    expect(waiting[0]!.first).toBe(1043);

    runYears(ctx, 60);
    expect(
      ctx.world.scheduled.some((s) => s.event === String(uncastable.id)),
      'past SCHEDULE_PATIENCE it stops asking',
    ).toBe(false);
  });
});
