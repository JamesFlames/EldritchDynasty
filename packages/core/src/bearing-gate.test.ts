import { describe, expect, it } from 'vitest';
import { verdictOver, type BearingRun, type Carriage } from './tools/bearing-gate.js';

/**
 * ISSUE #45'S ACCEPTANCE, AS A JUDGMENT.
 *
 * `gate:bearing` plays 252 thousand-year runs and then makes one reading over
 * them: does the house the world remembers as carrying itself climb higher
 * than the house that kept its head down? Playing that batch is a
 * half-hour instrument, and none of it is what could go wrong with the
 * reading — so the reading is a function over runs, and this hands it two
 * distributions it must tell apart.
 *
 * That split is the whole reason `verdictOver` exists. A gate nobody has
 * watched fail is indistinguishable from a gate that cannot fail, and the
 * ladder gate's trick — hand it a declawed bundle — is not available here:
 * bearing's consequence lives in `marketAppetite`, in the engine, so there is
 * no authored charge to take away.
 */

let n = 0;

/**
 * One synthetic run. Only two of its fields are the subject — how the world
 * came to read the house, and how far up the ladder it got — and the rest are
 * plausible constants, because the reading under test is a comparison of those
 * two across bins and nothing else in the row can move it.
 */
function run(
  carriage: Carriage,
  meanCarriage: number,
  bestRungIndex: number,
  /**
   * What the book could hold up. Defaults to what the house achieved, which
   * is the honest house: for a record nobody has to discount, the ladder and
   * the outcome are the same number.
   */
  substantiatedRungIndex = bestRungIndex,
): BearingRun {
  n += 1;
  return {
    seed: 4000 + n,
    carriage,
    peakCarriage: meanCarriage,
    meanCarriage,
    finalCarriage: meanCarriage,
    handsDealt: 40,
    cardsPerHand: 2.5,
    handsDeclined: 10,
    cousinsTaken: 5,
    bestRung: 'adept',
    bestRungIndex,
    attestedRungIndex: bestRungIndex,
    substantiatedRungIndex,
    rungsWithheld: bestRungIndex - substantiatedRungIndex,
    unsupportable: (bestRungIndex - substantiatedRungIndex) * 18,
    ending: substantiatedRungIndex >= 3 ? 'devoured' : 'forgotten',
    warningsHeard: 2,
    warningsWithheld: 2,
    respectTierIndex: 3,
    clausesRecovered: 8,
    householdAtEnd: 60,
    regencyYears: 0,
  };
}

/** Nine runs across the whole bearing range, with the rung set by the caller. */
function batch(rungAt: (meanCarriage: number) => number): BearingRun[] {
  const carriages: Carriage[] = ['unattended', 'modest', 'proud'];
  return [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
    .map((meanCarriage, i) => run(carriages[i % 3]!, meanCarriage, rungAt(meanCarriage)));
}

describe('the bearing gate', () => {
  /**
   * THE COLUMN THE SPREAD CLAUSE IS READ OFF.
   *
   * §29.7 asks for higher variance IN OUTCOME, and this gate reported that
   * spread off `bestRungIndex` — the ladder, out of `world.ascension`, which
   * the last night never consults. §29.3's third bite moves what a house can
   * PROVE and by construction leaves what it achieved alone, so the column was
   * incapable of moving however hard the mechanism bit. Two conclusions were
   * published off it before anybody noticed.
   *
   * So: two batches that agree on every rung the houses reached and differ
   * only in what their books could hold up. An instrument reading the ladder
   * prints the same line twice.
   *
   * The discounted batch is shaped as a TAIL rather than as a uniform drop,
   * because that is the shape the mechanism actually has — it charges a rung
   * to some proud houses and not to others — and because a bin whose runs all
   * carry the same number has no variance to report either way. The first cut
   * of this test dropped the whole top bin to the same rung and printed
   * +0.00 twice, which is a fixture that cannot fail rather than a gate that
   * cannot see.
   */
  it('reads the spread off what the house could prove, not off what it reached', () => {
    const carriages: Carriage[] = ['unattended', 'modest', 'proud'];
    // Twelve runs, four to a bin, every one of them reaching the third rung.
    const make = (proved: (i: number) => number) =>
      Array.from({ length: 12 }, (_, i) => run(carriages[i % 3]!, 0.05 * (i + 1), 3, proved(i)));

    const honest = verdictOver(make(() => 3));
    // The top bin is indices 8-11: two houses show it and two cannot.
    const discounted = verdictOver(make((i) => (i >= 10 ? 1 : 3)));

    const spreadOf = (v: { lines: string[] }) => v.lines.find((l) => l.includes('spread IN OUTCOME'));
    expect(spreadOf(honest), 'the spread in outcome is not reported at all').toBeTruthy();
    expect(
      spreadOf(discounted),
      'the same ladder with a different reading printed the same spread — the column the'
      + ' acceptance is judged on cannot see what the last night does',
    ).not.toBe(spreadOf(honest));

    // And the ladder half is untouched in both, which is the point: rule 2 is
    // judged on what the house climbed, and it climbed the same either way.
    expect(honest.ok).toBe(discounted.ok);
  });

  it('passes a game where the house that carried itself climbed higher', () => {
    // §29 rule 2: pride must usually be CORRECT. Two rungs at the bottom of
    // the range, three at the top.
    const { ok, lines } = verdictOver(batch((c) => (c > 0.6 ? 3 : 2)));
    expect(ok, lines.join('\n')).toBe(true);
  });

  it('fails a game where carrying itself only ever costs the house', () => {
    // The failure the issue names in as many words: *if they are simply
    // worse, this is a difficulty setting and players will play around it
    // rather than feel it.*
    const { ok, lines } = verdictOver(batch((c) => (c > 0.6 ? 1 : 3)));
    expect(ok, `the gate passed a game where pride is a tax:\n${lines.join('\n')}`).toBe(false);
  });

  it('fails a game where the carriage changes nothing at all', () => {
    // Flat is not a moral either. It is a system the player cannot feel, which
    // is what §29 was written to avoid.
    const { ok } = verdictOver(batch(() => 2));
    expect(ok).toBe(false);
  });

  /**
   * The spread is reported and NOT judged, and the line has to say so.
   *
   * This used to assert that the line named the mechanism still owed — the
   * record read back, which was the last of §29.3's three bites left unbuilt.
   * It is built, so that assertion is retired rather than reworded: an
   * assertion kept alive past the thing it was about is how a test starts
   * describing a game nobody is playing.
   *
   * What survives is the durable half. A bare number reads as a result, and
   * this one is not one: a single bin's variance swings by up to 0.10 from
   * nothing but the seed set, which is three times the gap the first
   * measurement on this issue credited to a content drop. So the line must
   * still warn what it takes to believe it.
   */
  it('reports the spread rather than judging it, and says what it takes to believe it', () => {
    const climbs = (c: number) => (c > 0.6 ? 3 : 2);
    const spreadLine = (rs: BearingRun[]) =>
      verdictOver(rs).lines.find((l) => l.includes('spread IN OUTCOME'));

    const line = spreadLine(batch(climbs));
    expect(line, 'the open half of the acceptance is not reported at all').toBeTruthy();
    expect(line, 'the spread is printed as a bare number, with nothing said about what it takes')
      .toMatch(/seed sets|not gated/i);

    // And it genuinely is not judged: a batch whose books all hold up and one
    // where the proud houses cannot show a thing agree on the verdict, because
    // the verdict is rule 2 and rule 2 is about the ladder.
    const carriages: Carriage[] = ['unattended', 'modest', 'proud'];
    const proud = Array.from({ length: 12 }, (_, i) =>
      run(carriages[i % 3]!, 0.05 * (i + 1), climbs(0.05 * (i + 1)), i >= 10 ? 0 : 3));
    expect(verdictOver(proud).ok).toBe(true);
  });
});
