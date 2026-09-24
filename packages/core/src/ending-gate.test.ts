import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import type { EndingId } from '@ed/schema';
import {
  ALL_ENDINGS, CATASTROPHES, ENDING_JUDGEABLE_BATCH, verdictOver, type EndingPolicy, type EndingRun,
} from './tools/ending-gate.js';
import { recordOptionForPolicy, unmakingReadyForAscendant } from './tools/ladder-policy.js';
import { testWorld } from './testing.js';

/**
 * THE GATE THAT GRADES THE ENDINGS (issue #42, and issue #61's Stage D).
 *
 * A gate nobody has ever seen fail is indistinguishable from a gate that
 * cannot fail, and this one can never be shown its own failing case by the
 * real bundle: the state it exists to catch is *the shipped game could not be
 * lost*, which is a property of a distribution rather than of any content it
 * could be handed. So the judgement is a pure function over runs, and these
 * hand it both worlds.
 */

function run(ending: EndingId, seed: number, policy: EndingPolicy = 'chronicler'): EndingRun {
  return {
    seed, policy, ending, attested: 'adept', clauses: 8, survivors: 22, householdLow: 11, bloodLeft: 14, bloodLow: 6,
  };
}

/** A batch shaped like the target: a third catastrophes, all five present. */
function losable(n = 100): EndingRun[] {
  const out: EndingRun[] = [];
  for (let i = 0; i < n; i++) {
    const id: EndingId = i % 10 === 0 ? 'broken_line'
      : i % 10 === 1 ? 'devoured'
        : i % 10 === 2 ? 'unmade'
          : i % 10 === 3 ? 'apotheosis'
            : 'forgotten';
    out.push(run(id, i));
  }
  return out;
}

/** An `ascendant` batch where `share` of runs reach apotheosis, the rest forgotten. */
function ascendant(share: number, n = 100): EndingRun[] {
  const apo = Math.round(share * n);
  return Array.from({ length: n }, (_, i) => run(i < apo ? 'apotheosis' : 'forgotten', 9000 + i, 'ascendant'));
}


describe('the ascendant composite policy', () => {
  it('spends the Record only at the final Respect wall', () => {
    const bundle = loadContent();
    const ctx = testWorld(bundle, 8132);

    // Before Eminent, the ordinary chronicler still owns the pen. The
    // ascendant policy only takes over where an embellishment can buy the
    // final tier the God gate needs.
    expect(recordOptionForPolicy(ctx, 'ascendant')).toBeUndefined();
    ctx.world.respect = 'regarded';
    expect(recordOptionForPolicy(ctx, 'ascendant')).toBeUndefined();
    ctx.world.respect = 'eminent';
    expect(recordOptionForPolicy(ctx, 'ascendant')).toBe('embellish');
    ctx.world.respect = 'exalted';
    expect(recordOptionForPolicy(ctx, 'ascendant')).toBe('record');

    // A successful Unmaking costs two Respect tiers before its Record block.
    // The composite policy deliberately does NOT force an embellishment from
    // Regarded: the measured version that did so created a total standing lie,
    // did not add a world-state God, and caused the creditor to withhold the
    // one God rung the 100-run batch had previously substantiated.
    const recipient = ctx.world.people.household(ctx.world.playerHouse, ctx.world.year)
      .find((p) => p.status === 'alive')!;
    recipient.rites.push('unmaking');
    ctx.world.respect = 'regarded';
    expect(recordOptionForPolicy(ctx, 'ascendant')).toBeUndefined();

    for (const policy of ['chronicler', 'climb', 'spare', 'scion', 'pair', 'pair_climb'] as const) {
      expect(recordOptionForPolicy(ctx, policy), policy).toBeUndefined();
    }
  });

  it('spends the Unmaking elder only after the fragile household working and standing are assembled', () => {
    const bundle = loadContent();
    const ctx = testWorld(bundle, 8133);
    const reader = ctx.world.people.household(ctx.world.playerHouse, ctx.world.year)[0]!;
    reader.spellsKnown.push(...bundle.spellbooks.map((book) => book.id));

    // Reading alone is not preparation: the family's public standing is a
    // gate the rite itself will spend. The persistent Ledger is deliberately
    // NOT a precondition — the calibration policy preserves the living reading
    // circle first, then lets the book continue paying while a viable
    // post-Unmaking recipient can stand at Demigod without ageing.
    expect(unmakingReadyForAscendant(ctx)).toBe(false);
    const clausesBefore = ctx.world.clausesRecovered.size;
    ctx.world.respect = 'exalted';
    expect(unmakingReadyForAscendant(ctx)).toBe(true);
    expect(ctx.world.clausesRecovered.size).toBe(clausesBefore);
  });
});

describe('the ending distribution gate', () => {
  it('passes a batch where the run is genuinely losable', () => {
    const v = verdictOver(losable());
    expect(v.ok, v.lines.join('\n')).toBe(true);
  });

  /**
   * THE STATE THIS ISSUE WAS FILED ABOUT, and the one the shipped game was in:
   * *"zero houses died out... every player-driven run finished with nine of
   * nine clauses... the simulation could not tell them apart."* Every house
   * arriving at the same place is the failure, whichever place it is.
   */
  it('fails a batch where every house arrives at the same place', () => {
    const v = verdictOver(Array.from({ length: 100 }, (_, i) => run('forgotten', i)));
    expect(v.ok).toBe(false);
    expect(v.lines.join('\n')).toMatch(/below the floor/);
  });

  it('fails a batch that cannot be lost at all', () => {
    // All five present, but the catastrophes are a rounding error — "rare and
    // memorable" rather than the recorded one-in-three.
    const runs = Array.from({ length: 200 }, (_, i): EndingRun => (
      i < 3 ? run(CATASTROPHES[i % 3]!, i) : run(i % 2 ? 'forgotten' : 'apotheosis', i)
    ));
    const v = verdictOver(runs);
    expect(v.ok).toBe(false);
    expect(v.lines.join('\n')).toMatch(/not losable enough/);
  });

  it('fails a batch that is a punishment rather than a game', () => {
    const runs = Array.from({ length: 200 }, (_, i): EndingRun => (
      i % 10 < 8 ? run(CATASTROPHES[i % 3]!, i) : run(i % 2 ? 'forgotten' : 'apotheosis', i)
    ));
    const v = verdictOver(runs);
    expect(v.ok).toBe(false);
    expect(v.lines.join('\n')).toMatch(/punishment/);
  });

  /**
   * §29's acceptance clause, which is why `forgotten` is counted separately
   * from the three catastrophes at all: the modest house has to lose too, and
   * differently. A gate that pooled them could not see this batch is wrong.
   */
  it('fails when the Forgotten stops being reachable', () => {
    const runs = Array.from({ length: 200 }, (_, i): EndingRun => (
      i % 3 === 0 ? run(CATASTROPHES[i % 3]!, i) : run(i % 7 === 0 ? 'apotheosis' : 'devoured', i)
    ));
    const v = verdictOver(runs);
    expect(v.ok).toBe(false);
    expect(v.lines.join('\n')).toMatch(/forgotten is below the floor/);
  });

  /**
   * A floor under God would be a gate demanding the rarest thing in the design
   * happen on schedule. §22 calls it the terminal outcome a family has to be
   * built for; a zero there is a finding, and this file is where that is said.
   */
  it('does not demand an apotheosis', () => {
    const runs = losable().map((r) => (r.ending === 'apotheosis' ? run('forgotten', r.seed) : r));
    const v = verdictOver(runs);
    expect(v.ok, v.lines.join('\n')).toBe(true);
    expect(v.lines.join('\n')).toMatch(/apotheosis\s+0/);
  });

  it('asserts nothing but validity on a batch too small to see a distribution', () => {
    const v = verdictOver(Array.from({ length: 12 }, (_, i) => run('forgotten', i)));
    expect(v.ok, 'a sub-judgeable batch must not pretend to grade a five-way split').toBe(true);
    expect(v.lines.join('\n')).toMatch(/cannot see a five-way distribution/);
  });

  it('starts judging at the same 100-run boundary CI uses', () => {
    const oneShort = verdictOver(
      Array.from({ length: ENDING_JUDGEABLE_BATCH - 1 }, (_, i) => run('forgotten', i)),
    );
    expect(oneShort.ok, oneShort.lines.join('\n')).toBe(true);
    expect(oneShort.lines.join('\n')).toMatch(/cannot see a five-way distribution/);

    const boundary = verdictOver(
      Array.from({ length: ENDING_JUDGEABLE_BATCH }, (_, i) => run('forgotten', i)),
    );
    expect(boundary.ok, 'the first judgeable batch must expose a collapsed ending distribution').toBe(false);
    expect(boundary.lines.join('\n')).toMatch(/below the floor|punishment/);
  });

  it('reports when broken lines ended without turning the diagnostic into a rule', () => {
    let brokenIndex = 0;
    const runs = losable().map((r) => {
      if (r.ending !== 'broken_line') return r;
      const index = brokenIndex++;
      return {
        ...r,
        yearsPlayed: index % 2 === 0 ? 80 : 240,
        physicianStayed: index % 3 === 0,
        bottleneckYears: 3,
        bottleneckFillableYears: index % 2 === 0 ? 1 : 0,
        bottleneckPriorityYears: index % 4 === 0 ? 1 : 0,
        bottleneckPriorityDeals: index % 5 === 0 ? 1 : 0,
        bottleneckViableCoupleYears: index % 2 === 0 ? 2 : 0,
        bottleneckFamilyCapYears: index % 3 === 0 ? 2 : 0,
        bottleneckOlderUnwedMaleYears: index % 4 === 0 ? 2 : 0,
        bottleneckMinorOnlyYears: index % 5 === 0 ? 2 : 0,
        bottleneckCadetOnlyYears: index % 6 === 0 ? 2 : 0,
        wardshipYears: index % 2 === 0 ? 4 : 0,
        bottleneckWardshipYears: index % 3 === 0 ? 1 : 0,
      };
    });
    const v = verdictOver(runs);
    expect(v.ok, v.lines.join('\n')).toBe(true);
    expect(v.lines.join('\n')).toMatch(/broken_line timing: 5\/10 inside first 150 years · median 240y/);
    expect(v.lines.join('\n')).toMatch(/physician ever reached 4\/10/);
    expect(v.lines.join('\n')).toMatch(
      /thin-line state among broken: 10\/10 entered 1-2 blood \(30y\).*5\/10 had a fillable recovery cast \(5y\).*priority armed 3\/10.*priority hand dealt 2\/10/,
    );
    expect(v.lines.join('\n')).toMatch(
      /thin-line alternatives among broken: viable couple 5\/10.*family cap reached 4\/10.*older unwed man 3\/10.*minors only 2\/10.*cadet-only blood 2\/10/,
    );
    expect(v.lines.join('\n')).toMatch(
      /unbought wardship: 5\/100 chronicler runs.*5\/10 broken lines.*overlapped 1-2 blood in 4\/10/,
    );
  });

  /**
   * #61 established the ascendant denominator and the owner's 29% ceiling.
   * #133 then halved the complete campaign and explicitly changed Stage 5F's
   * lower acceptance to non-zero intentional reach. The relative comparison
   * against the chronicler is the lower guard: it rejects zero without fitting
   * a new tiny percentage threshold to one noisy 500-year batch.
   */
  describe('the ascendant column (issues #61 and #133)', () => {
    it('passes when a rare Long-Line Apotheosis is non-zero and beats a zero chronicler', () => {
      const chronicler = losable().map((r) =>
        r.ending === 'apotheosis' ? run('forgotten', r.seed) : r);
      const v = verdictOver([...chronicler, ...ascendant(0.01)]);
      expect(v.ok, v.lines.join('\n')).toBe(true);
      expect(v.lines.join('\n')).toMatch(/ascendant .*100 runs.*apotheosis 1 \(1\.0%\)/);
    });

    it('fails when intentional play still reaches zero Apotheoses', () => {
      const chronicler = losable().map((r) =>
        r.ending === 'apotheosis' ? run('forgotten', r.seed) : r);
      const v = verdictOver([...chronicler, ...ascendant(0)]);
      expect(v.ok).toBe(false);
      expect(v.lines.join('\n')).toMatch(/trying for the ladder buys nothing/);
    });

    it('fails when ascendant clears the 29% ceiling', () => {
      const v = verdictOver([...losable(), ...ascendant(0.35)]);
      expect(v.ok).toBe(false);
      expect(v.lines.join('\n')).toMatch(/apotheosis is above the ascendant ceiling/);
    });

    /**
     * THE STATE THIS HALF OF THE ISSUE WAS FILED ABOUT: a house that never
     * tries for the ladder reaching God as often as one that does, which
     * would mean the whole Scion/marriage/library mechanism buys nothing.
     * `losable()`'s own chronicler apotheosis share is 10%, so an ascendant
     * column that does no BETTER must fail even though 10% remains below the
     * owner's 29% ceiling.
     */
    it('fails when the chronicler reaches apotheosis as often as ascendant does', () => {
      const v = verdictOver([...losable(), ...ascendant(0.10)]);
      expect(v.ok).toBe(false);
      expect(v.lines.join('\n')).toMatch(/trying for the ladder buys nothing/);
    });

    it('asserts nothing about apotheosis when the ascendant batch is too small', () => {
      const v = verdictOver([...losable(), ...ascendant(0.01, 12)]);
      expect(v.ok, v.lines.join('\n')).toBe(true);
      expect(v.lines.join('\n')).toMatch(/ascendant runs cannot see whether apotheosis is reachable/);
    });

    it('reports zero ascendant runs rather than silently skipping the check', () => {
      const v = verdictOver(losable());
      expect(v.lines.join('\n')).toMatch(/ascendant \(playing for the ladder\): 0 runs — none supplied/);
    });
  });

  it('prints every authored ending, so a zero is visible rather than absent', () => {
    const text = verdictOver(losable()).lines.join('\n');
    for (const id of ALL_ENDINGS) expect(text).toContain(id);
  });
});
