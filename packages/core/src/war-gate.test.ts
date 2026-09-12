import { describe, expect, it } from 'vitest';
import { verdictOver, type WarRun } from './tools/war-gate.js';

/**
 * ISSUE #99'S ACCEPTANCE, AS A JUDGMENT — the same split `bearing-gate.test.ts`
 * makes for the same reason. Playing 24+ seeds is the expensive, non-
 * deterministic-to-inspect half of `gateWar`; the statistics over the rows it
 * produces are what a test can hand a fixture to.
 *
 * A REAL rejecting-bundle test — the shape every other gate in `gates.test.ts`
 * uses — does not work here. The shortest war `arc_the_muster` can complete
 * runs longer than the two-seeds-five-years scale those tests reject a bundle
 * at: `the_muster_is_called` needs the Wars Age active before it can even
 * fire, and completing a call, a company, a position and a settlement takes
 * decades. At five years NOTHING can happen, on a broken bundle or a healthy
 * one, so that scale proves nothing about THIS gate specifically. `verdictOver`
 * is what actually has teeth, and this is where they get tested.
 */

let n = 0;

/** One synthetic settled-war entry. */
function war(respectAtBegin: number, respectAtSettle: number, attritionShare: number) {
  return { respectAtBegin, respectAtSettle, attritionShare };
}

/** One synthetic run. Only `settledWars` and `treasuryFinal` are the subject; the rest are plausible constants. */
function run(settledWars: WarRun['settledWars'], treasuryFinal: number): WarRun {
  n += 1;
  return {
    seed: 4000 + n,
    policy: 'commit',
    treasuryFinal,
    yearsAtWar: 30 * Math.max(1, settledWars.length),
    commitmentsBegun: settledWars.length,
    commitmentsSettled: settledWars.length,
    positionsBought: settledWars.length ? { serjeanty: settledWars.length } : {},
    settledWars,
  };
}

/** `abstain` never musters — every fixture's control column looks like this. */
function abstainRun(treasuryFinal: number): WarRun {
  return run([], treasuryFinal);
}

describe('the war gate', () => {
  it('passes a batch where committing pays and later wars cost more attrition', () => {
    const commit = [
      run([war(2, 4, 0.10), war(4, 5, 0.20)], 900),
      run([war(1, 2, 0.08), war(2, 4, 0.22)], 850),
      run([war(3, 5, 0.12), war(5, 6, 0.24)], 920),
      run([war(0, 2, 0.09)], 1000),
      run([war(2, 3, 0.11)], 980),
      run([war(1, 3, 0.10), war(3, 4, 0.19)], 870),
    ];
    const abstain = commit.map((_, i) => abstainRun(1300 + i * 5));

    const { ok, lines } = verdictOver(commit, abstain);
    expect(ok, lines.join('\n')).toBe(true);
    // Claim 2 is reported, never asserted — the line exists either way.
    expect(lines.some((l) => l.includes('NOT asserted'))).toBe(true);
  });

  it('fails a batch where committing does not pay — Respect does not rise per war', () => {
    const commit = [
      run([war(2, 2, 0.10)], 900),
      run([war(1, 0, 0.08)], 850),
      run([war(3, 3, 0.12)], 920),
      run([war(0, 0, 0.09)], 1000),
      run([war(2, 1, 0.11)], 980),
      run([war(1, 1, 0.10)], 870),
    ];
    const abstain = commit.map((_, i) => abstainRun(1300 + i * 5));

    const { ok, lines } = verdictOver(commit, abstain);
    expect(ok, `the gate passed a game where the Muster does not pay:\n${lines.join('\n')}`).toBe(false);
    expect(lines.some((l) => l.includes('FAIL (it pays)'))).toBe(true);
  });

  it('fails a batch where a house\'s later wars do not cost more attrition than its first', () => {
    // Claim 1 passes cleanly here (every war gains Respect) so the failure is
    // isolated to claim 3 alone — the same isolation `bearing-gate.test.ts`
    // insists on for its own two rules.
    const commit = [
      run([war(2, 4, 0.20), war(4, 6, 0.10)], 900),
      run([war(1, 3, 0.22), war(3, 5, 0.09)], 850),
      run([war(3, 5, 0.24), war(5, 7, 0.11)], 920),
      run([war(0, 2, 0.21), war(2, 4, 0.08)], 1000),
      run([war(2, 4, 0.19), war(4, 6, 0.10)], 980),
      run([war(1, 3, 0.20), war(3, 5, 0.09)], 870),
    ];
    const abstain = commit.map((_, i) => abstainRun(1300 + i * 5));

    const { ok, lines } = verdictOver(commit, abstain);
    expect(lines.some((l) => l.includes('FAIL (it pays)')), 'claim 1 should hold in this fixture').toBe(false);
    expect(ok, `the gate passed a game where the Muster does not escalate:\n${lines.join('\n')}`).toBe(false);
    expect(lines.some((l) => l.includes('FAIL (the gap widens)'))).toBe(true);
  });

  it('reports too few settled wars rather than asserting on an empty sample', () => {
    const commit = [run([], 1000), run([], 950)];
    const abstain = commit.map((_, i) => abstainRun(1300 + i * 5));

    const { ok, lines } = verdictOver(commit, abstain);
    expect(ok).toBe(false);
    expect(lines.some((l) => l.includes('FAIL (it pays)') && l.includes('war(s) settled'))).toBe(true);
  });

  it('never asserts claim 2, whichever way the treasury actually leans', () => {
    const healthy = [
      run([war(2, 4, 0.10), war(4, 5, 0.20)], 400),
      run([war(1, 2, 0.08), war(2, 4, 0.22)], 350),
    ];
    const abstainPoorer = healthy.map((_, i) => abstainRun(100 + i * 5));

    const { lines } = verdictOver(healthy, abstainPoorer);
    expect(lines.some((l) => l.startsWith('FAIL (it costs)')), 'claim 2 must never appear as a FAIL line').toBe(false);
    expect(lines.some((l) => l.includes('treasury advantage'))).toBe(true);
  });
});
