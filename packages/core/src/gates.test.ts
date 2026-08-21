import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { SlotSpecS, type ContentBundle } from '@ed/schema';
import {
  GATES, gateClauses, gateFireRate, gateOutcomeReach, gatePurposes, gateSlotFillability,
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
      ['clauses', 'fire-rate', 'outcome-reach', 'purposes', 'slot-fillability'],
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
});
