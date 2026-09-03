import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { beget, place, testWorld } from '../testing.js';
import { emptyReport } from './report.js';
import { passageOf } from './passage.js';

const bundle = loadContent();

/**
 * WHAT THE YEARS DID (issue #49).
 *
 * The failure being guarded is not a crash and never was. `stepYear` has
 * reported every birth, death and awakening since it was written, and for the
 * whole life of the client every one of them went into `g.advance(1)` and was
 * dropped on the floor — which looks, from outside, precisely like a family
 * that had a quiet century.
 *
 * So these assert that a year which did something SAYS something, and that
 * what it says is about the people it actually happened to.
 */
describe('a year, as lines', () => {
  it('says nothing about a year that did nothing', () => {
    const ctx = testWorld(bundle, 4401);
    // The quiet is the common case — a thousand-year run is mostly this — and
    // a log with nine hundred empty dated rows in it is a log nobody reads.
    expect(passageOf(ctx, emptyReport(ctx.world.year))).toBeUndefined();
  });

  it('gives a death the age and the cause it was killed with', () => {
    const ctx = testWorld(bundle, 4402);
    const w = ctx.world;
    const p = place(ctx, { sex: 'male', age: 61, name: 'Tamsin' });
    w.people.kill(p.id, w.year, 'the blood, overflowing');

    const report = emptyReport(w.year);
    report.deaths.push(p);

    const passage = passageOf(ctx, report)!;
    expect(passage.year).toBe(w.year);
    expect(passage.lines).toHaveLength(1);
    expect(passage.lines[0]!.kind).toBe('death');
    expect(passage.lines[0]!.text).toBe('Tamsin died at 61 — the blood, overflowing.');
    // The line is about somebody, and says which somebody, so a client can
    // take a click on it back to the person.
    expect(passage.lines[0]!.person).toBe(p.id);
  });

  it('leaves off a cause that says nothing', () => {
    const ctx = testWorld(bundle, 4403);
    const w = ctx.world;
    const p = place(ctx, { sex: 'female', age: 30, name: 'Osla' });
    w.people.kill(p.id, w.year, 'unrecorded');

    const report = emptyReport(w.year);
    report.deaths.push(p);
    expect(passageOf(ctx, report)!.lines[0]!.text).toBe('Osla died at 30.');
  });

  /**
   * THE STALE-NAME GUARD, which is the whole reason a birth names the mother.
   *
   * A newborn arrives carrying the chronicler's suggestion and sits in the
   * naming queue until the player answers it. A line written at birth with
   * the child's name in it would still say Rowan after the player named him
   * Aldous — a permanent, plausible, unfalsifiable wrong fact about a person,
   * in the one panel that is supposed to be the record that cannot lie.
   */
  it('names the mother of a newborn and never the newborn', () => {
    const ctx = testWorld(bundle, 4404);
    const mother = place(ctx, { sex: 'female', age: 28, name: 'Eilwen' });
    const child = place(ctx, { sex: 'female', age: 0, name: 'Rowan' });
    beget(ctx, child, mother);

    const report = emptyReport(ctx.world.year);
    report.births.push(child);

    const text = passageOf(ctx, report)!.lines[0]!.text;
    expect(text).toBe('A daughter born to Eilwen.');
    expect(text).not.toContain('Rowan');
  });

  it('still reports a birth to a mother the house cannot name', () => {
    const ctx = testWorld(bundle, 4405);
    const child = place(ctx, { sex: 'male', age: 0, name: 'Nobody' });

    const report = emptyReport(ctx.world.year);
    report.births.push(child);
    expect(passageOf(ctx, report)!.lines[0]!.text).toBe('A son born.');
  });

  /**
   * The order the phases produced them in — `lifecycle` wakes and kills, and
   * `births` bears afterwards. A log that sorted these would be telling the
   * year differently from the way the year went.
   */
  it('tells the year in the order the year happened', () => {
    const ctx = testWorld(bundle, 4406);
    const w = ctx.world;
    const woken = place(ctx, { sex: 'male', age: 19, name: 'Aldous' });
    const dead = place(ctx, { sex: 'male', age: 70, name: 'Osric' });
    const babe = place(ctx, { sex: 'female', age: 0, name: 'Tamsin' });
    w.people.kill(dead.id, w.year, 'in the ordinary way');

    const report = emptyReport(w.year);
    report.awakenings.push(woken);
    report.deaths.push(dead);
    report.births.push(babe);

    expect(passageOf(ctx, report)!.lines.map((l) => l.kind))
      .toEqual(['awakening', 'death', 'birth']);
    expect(passageOf(ctx, report)!.lines[0]!.text).toBe('Aldous awakened.');
  });

  /**
   * AN AWAKENING IS ONE EVENT AND TWO FACTS (issue #78).
   *
   * §11 times a daughter's Awakening by what she carries rather than by what
   * she can use, so most awakenings in the game are women's — and for the
   * whole life of this log every one of them read "she awakened", which in a
   * game about who expresses is the wrong four words about six people in ten.
   *
   * A woman is the deterministic case and the reason it matters: `canExpress`
   * is false for her at any font, on any seed, so this asserts the branch and
   * not a draw. The line stops at the fact — the houses have no word for the
   * difference (§11) and the log does not get to invent one.
   */
  it('says the second true thing about a waking the Power will not come through', () => {
    const ctx = testWorld(bundle, 4407);
    const her = place(ctx, { sex: 'female', age: 15, name: 'Selwyn' });

    const report = emptyReport(ctx.world.year);
    report.awakenings.push(her);

    expect(passageOf(ctx, report)!.lines[0]!.text)
      .toBe('Selwyn awakened, and it will not come through.');
  });
});
