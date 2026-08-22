import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { bootstrap, runYears } from '@ed/core';

const bundle = loadContent();
const SEEDS = Array.from({ length: 20 }, (_, i) => 5000 + i * 7);

/**
 * THE REGALIA, OVER REAL RUNS.
 *
 * Three objects that `story/Age-1.md` fixes, that Demigod requires held at
 * once, that `seal_the_regalia_incomplete` has the Church count, and that no
 * run of this game owned until `houses.yaml` was given somewhere to say so.
 *
 * The failure this file exists for is not a crash. `useHeirloom` checks the
 * heirloom's own `target` filters against whoever it is handed, and when they
 * do not pass it applies nothing, changes nothing and reports nothing — so an
 * event whose slot is looser than the object it hands out fires, reads
 * correctly, writes its chronicle line, and does not happen. The ring shipped
 * that way twice in one afternoon: `mind >= 62`, then `42`, against a
 * population whose expected `mind` is 30.4. Both times the arc fired in a
 * quarter of runs and the ring went onto exactly one hand in twenty-four.
 */
function runBatch(): ReturnType<typeof bootstrap>[] {
  return SEEDS.map((seed) => {
    const ctx = bootstrap(bundle, seed, 1042);
    runYears(ctx, 1000);
    return ctx;
  });
}

describe('the Regalia is held, and is used', () => {
  const batch = runBatch();

  it('is in the house\'s hands from the first year of every run', () => {
    for (const seed of [1042, 77, 909]) {
      const ctx = bootstrap(bundle, seed, 1042);
      expect([...ctx.world.heirlooms.keys()].sort(), `seed ${seed}`)
        .toEqual(['the_ninefold_seal', 'the_ring', 'the_rod']);
    }
  });

  /**
   * The guard. Every heirloom an authored `use` hands out must be received by
   * somebody, somewhere in the batch — otherwise the slot and the object
   * disagree and the effect is a no-op nothing in the pipeline can see.
   */
  it('actually lands on a person for every heirloom content tries to use', () => {
    const used = new Set<string>();
    for (const e of bundle.events) {
      const groups = e.interaction.kind === 'narration'
        ? [e.interaction.outcomes]
        : e.interaction.choices.map((c) => c.outcomes);
      for (const o of groups.flat()) {
        for (const eff of o.effects) {
          if (eff.kind === 'heirloom' && eff.op === 'use') used.add(eff.heirloom);
        }
      }
    }
    expect(used.size, 'no content uses an heirloom at all').toBeGreaterThan(0);

    for (const id of used) {
      const landed = batch.reduce((n, ctx) => n + (ctx.world.heirlooms.get(id)?.usedOn.length ?? 0), 0);
      expect(landed, `${id} is handed out by content and received by nobody in ${SEEDS.length} runs`)
        .toBeGreaterThan(0);
    }
  });

  it('reaches the far end of each of the three new substories', () => {
    const fired = new Map<string, number>();
    for (const ctx of batch) {
      for (const [id, n] of Object.entries(ctx.world.frequency.templateFires)) {
        if (n > 0) fired.set(id, (fired.get(id) ?? 0) + 1);
      }
    }
    // Last beats only. A substory whose opening fires and whose ending never
    // does is three quarters of a story and reads, from outside, like a whole
    // one — the arc simply stops and nothing says it stopped.
    for (const last of ['ring_it_fits_again', 'rod_the_correlation_was_something_else', 'eight_days_and_then_it_did']) {
      expect(fired.get(last) ?? 0, `${last} never fired in ${SEEDS.length} runs`).toBeGreaterThan(0);
    }
  });

  it('never lets the family sell what Demigod requires', () => {
    for (const id of ['the_ninefold_seal', 'the_ring', 'the_rod']) {
      expect(bundle.heirlooms.find((h) => h.id === id)!.cannotBeSold, id).toBe(true);
    }
  });
});
