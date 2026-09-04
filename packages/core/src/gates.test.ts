import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadContent } from '@ed/content';
import { SlotSpecS, type ContentBundle } from '@ed/schema';
import {
  GATES, gateClauses, gateFireRate, gateOutcomeReach, gatePurposes, gateSlotFillability, judgeZeroReach,
} from './tools/gates.js';

const content = loadContent();

/**
 * WHO GUARDS THE GUARDS.
 *
 * Every gate in `tools/gates.ts` has passed on every commit it has ever run
 * on, which is exactly what a gate that cannot fail looks like from outside.
 * These hand each one a bundle it must reject.
 *
 * The two slow gates are run here at a sample size that means nothing about
 * the game — two seeds, five years — and everything about the gate: a run that
 * short cannot possibly recover six clauses or fire every event, so a gate
 * with its teeth in says so, and a gate whose measurement has quietly stopped
 * measuring says it is fine.
 */

const broken = (mutate: (b: ContentBundle) => void): ContentBundle => {
  const b = structuredClone(content.bundle);
  mutate(b);
  return b;
};

describe('the gates pass the shipped game', () => {
  it('gate 2 — every event can cast against at least one test family', () => {
    const { ok, lines } = gateSlotFillability(content);
    expect(ok, lines.join('\n')).toBe(true);
  });

  it('gate 6 — purposes', () => {
    const { ok, lines } = gatePurposes(content);
    expect(ok, lines.join('\n')).toBe(true);
  });

  it('every gate is addressable by name from the CLI table', () => {
    expect(Object.keys(GATES).sort()).toEqual(
      ['clauses', 'fire-rate', 'ladder', 'outcome-reach', 'purposes', 'slot-fillability'],
    );
  });
});

describe('the gates fail when they should', () => {
  /**
   * A slot nobody in any of the six households can fill. The role is real and
   * the filter is ordinary — it just demands an age no living person reaches,
   * which is the shape of the starvation this gate exists to catch.
   */
  it('gate 2 catches a template that cannot cast against any household', () => {
    const bundle = broken((b) => {
      const e = b.events.find((x) => !x.arc && Object.keys(x.slots).length)!;
      e.slots.IMPOSSIBLE = SlotSpecS.parse({
        role: 'family_member',
        filters: [{ age: { op: 'gte', value: 900 } }],
      });
    });

    const { ok, lines } = gateSlotFillability(bundle);
    expect(ok).toBe(false);
    expect(lines.join('\n')).toMatch(/cannot cast against any test family/);
  });

  it('gate 6 catches a template that does not name three purposes', () => {
    const bundle = broken((b) => { b.events[0]!.purposes = ['change_standing'] as typeof b.events[0]['purposes']; });

    const { ok, lines } = gatePurposes(bundle);
    expect(ok).toBe(false);
    expect(lines.join('\n')).toMatch(/event\/purposes/);
  });

  /**
   * Five years recovers no clauses at all, so a gate still counting them
   * reports a median of 0 and fails. If this ever passes, the gate has stopped
   * reading `clausesRecovered`.
   */
  it('gate 7 fails a run too short to recover anything', () => {
    const { ok, lines } = gateClauses(content, { seeds: [1000, 1007], years: 5 });
    expect(ok, lines.join('\n')).toBe(false);
    expect(lines.join('\n')).toMatch(/median must be at least/);
  });

  it('gate 4 fails a run too short for the content to fire', () => {
    const { ok, lines } = gateFireRate(content, { runs: 2, years: 5 });
    expect(ok, lines.join('\n')).toBe(false);
    expect(lines.join('\n')).toMatch(/fire in under/);
  });

  it('gate 8 fails a run too short for the branches to be reached', () => {
    const { ok, lines } = gateOutcomeReach(content, { runs: 2, years: 5 });
    expect(ok, lines.join('\n')).toBe(false);
    expect(lines.join('\n')).toMatch(/never resolve/);
  });

  /**
   * The failure gate 8 exists for, built on purpose: a choice whose `requires`
   * no living person can satisfy. Gate 4 passes this bundle — the event still
   * fires at its usual rate — and `outcomes/weights` passes it too, because
   * nothing about it is statically impossible. Only a run can see it.
   */
  it('gate 8 catches a branch gated behind a threshold nobody reaches', () => {
    const bundle = broken((b) => {
      const e = b.events.find((x) => x.interaction.kind === 'choice')!;
      if (e.interaction.kind === 'narration') throw new Error('picked the wrong event');
      e.interaction.choices[0]!.requires = [{ slot: Object.keys(e.slots)[0] ?? 'HEAD', attr: 'mind', op: 'gte', value: 10_000 }];
    });

    const { ok, lines } = gateOutcomeReach(bundle, { runs: 3, years: 400 });
    expect(ok).toBe(false);
    expect(lines.join('\n')).toMatch(/never resolve/);
  });

  /**
   * WHAT A ZERO IS ALLOWED TO MEAN (issue #80).
   *
   * Gate 8 spent its whole life treating `pct === 0` as proof, and the comment
   * above its own run count already knew better: *"a one-in-a-hundred outcome
   * shows zero about one time in twelve."* It failed a build on
   * `the_match_that_never_comes/counter -> opened` — weight 20 of 100, under a
   * choice reached seven times in 250 runs. Seven chances at one in five is a
   * 21% chance of showing zero, and the same outcome reaches 1.2% on the
   * commit before; the only thing between them was 177 lines of unrelated
   * content re-rolling every draw in the game.
   *
   * These are the three readings, given directly as numbers. The middle one is
   * the reason `judgeZeroReach` is exported at all: an outcome with plenty of
   * chances that takes none of them cannot be built out of content, because
   * weights are authored and a choice that fires often lands on everything
   * under it unless the roller is broken. It is a guard against an engine bug,
   * so the only way to watch it fail is to hand it the numbers.
   */
  describe('gate 8 sorts a zero by what it can support', () => {
    it('convicts an outcome whose choice nobody was ever offered', () => {
      const v = judgeZeroReach(0, 0.5, 250);
      expect(v.kind).toBe('dead');
      expect(v.why).toMatch(/never fired/);
    });

    it('convicts an outcome that had the chances and took none of them', () => {
      // 100 firings at one in five is twenty expected. Zero is not a draw.
      const v = judgeZeroReach(100, 0.2, 250);
      expect(v.kind).toBe('dead');
      expect(v.why).toMatch(/expected ~20\.0 of 100 firings/);
    });

    /** The exact shape of the build this gate failed for no reason. */
    it('refuses to convict on seven chances at one in five, and says what would', () => {
      const v = judgeZeroReach(7, 0.2, 250);
      expect(v.kind).toBe('unproven');
      // The prescription, not a shrug: `expectRate`'s contract, which is that
      // a claim the batch cannot carry fails with the batch size that could.
      expect(v.why).toMatch(/would need ~893 runs to prove/);
    });

    /**
     * The boundary is a real edge and not a preference — five expected is
     * under a one per cent chance of a spurious zero, which is what makes
     * 872 simultaneous judgements survivable.
     */
    it('convicts exactly at the proof threshold and not below it', () => {
      expect(judgeZeroReach(10, 0.5, 250).kind).toBe('dead');
      expect(judgeZeroReach(10, 0.49, 250).kind).toBe('unproven');
    });
  });
});

/**
 * A GATE THAT RUNS NOWHERE IS NOT A GATE.
 *
 * Gate 2 (slot fillability) was written for CI and never wired into it, so for
 * its whole existence it ran on nobody's machine — it passed every test in
 * `gates.test.ts` the entire time, because those call the function directly.
 * The workflow named its gates one at a time, and the list was maintained by
 * remembering.
 *
 * It runs `npm run gate` now, which runs everything in `GATES`. This checks
 * that it still does, because the failure is silent in both directions.
 */
/**
 * ONE BATCH, TWO GATES (issue #64).
 *
 * Gate 4 and gate 8 bootstrapped the SAME seeds — `5000 + i * 7` — for the
 * same thousand years and each threw away everything the other wanted. Gate 4
 * alone measured 342 seconds.
 *
 * The sharing is a cache, and a cache that returns the wrong batch is a gate
 * answering about content it was not given — which would pass, silently, on
 * exactly the bundle it was supposed to reject.
 */
describe('the shared batch answers about the content it was handed', () => {
  it('does not carry one bundle\'s verdict over to another', () => {
    const tiny = { runs: 2, years: 5 };
    // A bundle that must FAIL, then the shipped one, then the broken one
    // again. If the cache keyed on anything but the source, the second and
    // third answers would be the first one.
    const broke = broken((b) => {
      const e = b.events.find((x) => x.interaction.kind === 'choice')!;
      if (e.interaction.kind === 'narration') throw new Error('picked the wrong event');
      e.interaction.choices[0]!.requires = [
        { slot: Object.keys(e.slots)[0] ?? 'HEAD', attr: 'mind', op: 'gte', value: 10_000 },
      ];
    });

    const first = gateOutcomeReach(broke, tiny);
    const between = gateFireRate(content, tiny);
    const again = gateOutcomeReach(broke, tiny);

    expect(again.ok, 'the second look at the same bundle disagreed with the first').toBe(first.ok);
    expect(again.lines).toEqual(first.lines);
    // And the shipped content in the middle was judged on its own terms.
    expect(between.lines.join('\n')).toContain('gate 4');
  });

  /**
   * Both gates reading one batch must still each read their OWN half of it: a
   * fire-rate answer built from outcome counts, or the reverse, would be a
   * gate that always passes.
   */
  it('gives each gate the half of the batch it asked for', () => {
    const fire = gateFireRate(content, { runs: 2, years: 5 });
    const reach = gateOutcomeReach(content, { runs: 2, years: 5 });
    expect(fire.lines[0]).toContain('non-frame events');
    expect(reach.lines[0]).toContain('authored outcomes');
    expect(fire.lines[0]).not.toEqual(reach.lines[0]);
  });
});

describe('the gates are actually run', () => {
  const workflow = readFileSync(
    join(import.meta.dirname, '../../../.github/workflows/check.yml'),
    'utf8',
  );

  it('has CI run every gate, without naming them one at a time', () => {
    expect(workflow, 'the workflow does not run `npm run gate`').toMatch(/npm run gate\b/);
  });

  it('does not let a per-gate step drift back in', () => {
    // `npm run gates -- <name>` in CI means a list maintained by hand again.
    const perGate = [...workflow.matchAll(/npm run gates\s+--\s+(\S+)/g)].map((m) => m[1]);
    expect(perGate, 'CI names individual gates; use `npm run gate` instead').toEqual([]);
  });
});
