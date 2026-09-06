import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadContent } from '@ed/content';
import { SlotSpecS, type ContentBundle } from '@ed/schema';
import {
  GATES, gateClauses, gateFireRate, gateLadderScales, gateOutcomeReach, gatePurposes,
  gateSlotFillability, judgeZeroReach,
} from './tools/gates.js';
import { firedUnderClimbing } from './tools/ladder-gate.js';

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
      [
        'clauses', 'fire-rate', 'ladder', 'ladder-scales', 'outcome-reach', 'purposes',
        'slot-fillability',
      ],
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

  /**
   * THE SAME QUESTION, ASKED OF A PARTY (issue #90). `SlotSpec.count` was
   * declared and unread, so this gate could only ever ask whether ONE person
   * could be cast — a slot demanding forty men passed it, and would have been
   * starved in every real run for as long as nobody looked.
   *
   * `resolveSlots` enforces `min` now, so the gate asks the right question
   * through the same call it always made. This is the bundle that proves it:
   * a role every household can fill, at a size none of them can.
   *
   * The size is 200 rather than a round 40 because one of the six fixtures is
   * The 40-Member Sprawl and it houses sixty people — a party of forty is
   * genuinely fillable there, which is the fixture set doing its job.
   */
  it('gate 2 catches a party larger than any household can field', () => {
    const bundle = broken((b) => {
      const e = b.events.find((x) => !x.arc && Object.keys(x.slots).length)!;
      e.slots.TOO_MANY = SlotSpecS.parse({
        role: 'family_member',
        count: { min: 200, max: 200 },
      });
    });

    const { ok, lines } = gateSlotFillability(bundle);
    expect(ok).toBe(false);
    expect(lines.join('\n')).toMatch(/cannot cast against any test family/);
  });

  it('gate 2 passes the same party at a size a household can field', () => {
    const bundle = broken((b) => {
      const e = b.events.find((x) => !x.arc && Object.keys(x.slots).length)!;
      e.slots.A_FEW = SlotSpecS.parse({
        role: 'family_member',
        count: { min: 2, max: 3 },
      });
    });

    expect(gateSlotFillability(bundle).ok).toBe(true);
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

  it('gate 4 fails a run too short for the content to fire, and says it tried both policies', () => {
    const { ok, lines } = gateFireRate(content, { runs: 2, years: 5, climbRuns: 2 });
    const out = lines.join('\n');
    expect(ok, out).toBe(false);
    expect(out).toMatch(/fire in under/);
    // The acquittal pass RAN and refused to acquit. Without this the second
    // policy could quietly stop being consulted and every message would read
    // exactly as it does now (issue #64).
    expect(out).toMatch(/played for the ladder/);
  });

  /**
   * THE ACQUITTAL NEEDS SOMETHING TO ACQUIT WITH (issue #64).
   *
   * The chronicler never climbs, so an event cast on a living Hierophant is
   * unreachable to the main batch by design. All three rites were on this
   * issue's original never-fired list for that reason, while being correct
   * events doing a correct thing, and a gate convicting on them would send the
   * next person to loosen a condition that is right.
   *
   * This asserts the half that makes the acquittal worth having: a house that
   * PLAYS for the ladder reaches the rites. Asserted on the helper rather than
   * through the gate, because at a batch small enough to test, which templates
   * the chronicler happened to miss is seed noise as much as policy — and a
   * test whose subject is noise is not a test.
   */
  it('a house that plays for the ladder reaches the rites', () => {
    const fired = firedUnderClimbing(content, [4000, 4013, 4026], 600);
    expect(fired.size, 'the climbing pass played no events at all').toBeGreaterThan(100);
    expect([...fired]).toContain('the_vessel_rite');
    expect([...fired]).toContain('the_great_rite');
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
/**
 * GATE 9 — A LADDER GATE WITH NO KEY (issue #61).
 *
 * §22's mind and Madness floors were prose on a 0-100 scale, compared against
 * raw attributes topping out near 81 and 35. Nought per cent of 1,273 sampled
 * expressers cleared the Vessel's `mind >= 70`; the Demigod's and God's
 * Madness floors were above anything the simulation had ever produced. Rungs
 * four, five and six had never been held, so Apotheosis — the ending on the
 * box — had never once fired, and it all typechecked.
 */
describe('gate 9 asks whether anybody can clear the ladder', () => {
  const cheap = { runs: 2, years: 300, every: 50 } as const;

  it('passes the shipped ladder, and says what share clears each floor', () => {
    const { ok, lines } = gateLadderScales(content, cheap);
    expect(ok, lines.join('\n')).toBe(true);
    expect(lines.join('\n')).toMatch(/wants mind 70/);
  });

  /**
   * The rejection. Normalising made the real floors scale-INVARIANT — which is
   * the point of them, and also means no edit to `attributes.yaml` can produce
   * this failure, because `expected` moves with the population. So the floors
   * are the thing handed in, and the judgement is the thing under test.
   */
  it('refuses a floor nobody in the population can reach', () => {
    const { ok, lines } = gateLadderScales(content, { ...cheap, mindFloor: { hierophant: 10_000 } });
    expect(ok).toBe(false);
    expect(lines.join('\n')).toMatch(/cleared by nobody/);
  });

  /**
   * And does NOT convict a floor the ladder never got far enough to test. The
   * chain matters: Madness above Hierophant is purchased (§10) through rites
   * the upper rungs themselves unlock, so an untested floor is starved rather
   * than wrong — and failing on it would send the next person to loosen a
   * number that is right.
   */
  it('holds its tongue about a floor above a rung nobody reached', () => {
    const { ok, lines } = gateLadderScales(content, { ...cheap, madnessFloor: { god: 10_000 } });
    expect(ok, 'convicted a floor above an unreached rung').toBe(true);
    expect(lines.join('\n')).toMatch(/never got far enough to test/);
  });
});

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
