import { describe, expect, it } from 'vitest';
import { verdictOver, type FoundingRun } from './tools/bottleneck-gate.js';

/**
 * THE GATE THAT GRADES THE FOUNDING BOTTLENECK'S RECOVERY (issue #132,
 * Stage 2). A gate nobody has ever seen fail is indistinguishable from a
 * gate that cannot fail, and this one's own trail is the reason it has to be
 * shown failing on purpose: three separate real measurements, after three
 * separate real bugs, each came back 0 of 37, 0 of 45, 0 of 60 — the exact
 * shape `verdictOver` is handed below, synthetically, so the gate would have
 * caught every one of them.
 */

function run(seed: number, touched2: boolean, recovered: boolean): FoundingRun {
  return { seed, touched2, recovered };
}

/** A batch shaped like the measured one: 46 of 150 touch it, 3 of those recover. */
function measured(): FoundingRun[] {
  const out: FoundingRun[] = [];
  for (let i = 0; i < 150; i++) {
    const touched2 = i % 150 < 46;
    const recovered = touched2 && i % 50 === 0; // 3 of the first 46
    out.push(run(i, touched2, recovered));
  }
  return out;
}

describe('the founding bottleneck recovery gate', () => {
  it('passes a batch shaped like the one measured after all three Stage 2 fixes', () => {
    const v = verdictOver(measured());
    expect(v.ok, v.lines.join('\n')).toBe(true);
    expect(v.lines.join('\n')).toMatch(/recovery rate/);
  });

  /**
   * THE EXACT SHAPE OF EVERY MEASUREMENT BEFORE THE THIRD FIX. Plenty of
   * runs touched the bottleneck; not one of them ever recovered — a
   * mechanism that exists in the schema and does nothing at runtime, which
   * is invariant 11's whole subject.
   */
  it('fails a batch where the bottleneck is touched often and never once recovered', () => {
    const runs = Array.from({ length: 100 }, (_, i) => run(i, i < 50, false));
    const v = verdictOver(runs);
    expect(v.ok).toBe(false);
    expect(v.lines.join('\n')).toMatch(/ever recovered/);
  });

  it('asserts nothing but validity when too few runs ever touch the bottleneck', () => {
    // A healthy batch where the bottleneck is simply rare this time — five
    // touches is not enough to tell "never recovers" from "got unlucky".
    const runs = Array.from({ length: 100 }, (_, i) => run(i, i < 5, i === 0));
    const v = verdictOver(runs);
    expect(v.ok).toBe(true);
    expect(v.lines.join('\n')).toMatch(/cannot see whether recovery is/);
  });

  it('never counts a run that recovered without ever touching the bottleneck', () => {
    // Shape-invalid input (recovered implies touched2 in the real player),
    // and the gate should read it by touched2 alone rather than trust the
    // flag combination a caller handed it.
    const runs = [
      ...Array.from({ length: 45 }, (_, i) => run(i, true, false)),
      run(9999, false, true),
    ];
    const v = verdictOver(runs);
    // 45 touched, 0 of THOSE recovered — the stray record must not rescue it.
    expect(v.lines.join('\n')).toMatch(/45 touched 1-2 living blood/);
    expect(v.lines.join('\n')).toMatch(/0 recovered/);
  });
});
