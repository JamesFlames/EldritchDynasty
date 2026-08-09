import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { bootstrap, runYears } from '@ed/core';

const bundle = loadContent();

function fireCounts(seeds: number[], years = 1000): Map<string, number> {
  const fires = new Map<string, number>();
  for (const seed of seeds) {
    const ctx = bootstrap(bundle, seed, 1042);
    runYears(ctx, years);
    for (const [id, n] of Object.entries(ctx.world.frequency.templateFires)) {
      fires.set(id, (fires.get(id) ?? 0) + n);
    }
  }
  return fires;
}

const SEEDS = Array.from({ length: 12 }, (_, i) => 1000 + i * 13);

/**
 * Events that never fire are the silent failure mode of this entire genre.
 * Nothing errors; the content simply is not in the game. Two arc bugs were
 * found this way, and neither was visible any other route.
 */
describe('every authored event can actually happen', () => {
  const fires = fireCounts(SEEDS);

  it('fires every non-frame event at least once across the batch', () => {
    const dead = bundle.events
      .filter((e) => e.tier !== 'frame')
      .filter((e) => (fires.get(e.id) ?? 0) === 0)
      .map((e) => e.id);
    expect(dead).toEqual([]);
  });

  it('reaches the last node of a multi-generation arc', () => {
    // seal_the_regalia_incomplete is three nodes and ~two centuries deep.
    expect(fires.get('seal_the_regalia_incomplete') ?? 0).toBeGreaterThan(0);
  });

  it('keeps the tiers in their intended proportion', () => {
    const total = (freq: string) => bundle.events
      .filter((e) => e.frequency === freq)
      .reduce((n, e) => n + (fires.get(e.id) ?? 0), 0);
    expect(total('common')).toBeGreaterThan(total('uncommon'));
    expect(total('uncommon')).toBeGreaterThan(total('rare'));
    expect(total('rare')).toBeGreaterThan(total('mythic'));
  });
});

describe('arc bindings', () => {
  /**
   * BUG 1: a node that does not declare the arc's bound slot was treated as
   * having an unfillable one, so the whole arc cancelled. The seal feud's
   * final scene never fired in twenty thousand simulated years.
   */
  it('does not cancel an arc for a binding the node never uses', () => {
    const arc = bundle.arcs.find((a) => a.id === 'arc_the_given_seal')!;
    const bound = arc.bindings[0]!;
    const lastNode = arc.nodes.find((n) => n.id === 'counted')!;
    const lastEvent = bundle.events.find((e) => e.id === lastNode.event)!;

    // The shape that used to break it: bound arc-wide, unused by this node.
    expect(arc.bindings).toContain(bound);
    expect(Object.keys(lastEvent.slots)).not.toContain(bound);

    const fires = fireCounts([1042, 77, 909, 5150, 8080, 31]);
    expect(fires.get(lastEvent.id) ?? 0).toBeGreaterThan(0);
  });

  /**
   * BUG 2: `inherit` returned the requested relation or nothing, and nothing
   * cancelled the arc — so a man dying childless ended the feud. It should
   * fall through to his closest blood and then to his house.
   */
  it('passes a grudge down past a childless death', () => {
    const fires = fireCounts(SEEDS);
    // Node two sits 45-120 years after node one, so its cast is reliably dead.
    const started = fires.get('seal_aftermath') ?? 0;
    const continued = fires.get('seal_the_grandson_presses') ?? 0;
    expect(started).toBeGreaterThan(0);
    // Before the fix this ratio was 3/27. Feuds should usually survive.
    expect(continued / started).toBeGreaterThan(0.4);
  });

  it('never runs two instances of a single-instance arc at once', () => {
    for (const seed of [1042, 77, 909]) {
      const ctx = bootstrap(bundle, seed, 1042);
      runYears(ctx, 800);
      for (const def of bundle.arcs) {
        const active = [...ctx.world.arcs.values()]
          .filter((a) => a.arc === def.id && a.status === 'active');
        expect(active.length, `${def.id} seed ${seed}`).toBeLessThanOrEqual(def.maxConcurrentInstances);
      }
    }
  });

  it('never leaves an arc pointing at a node that does not exist', () => {
    const ctx = bootstrap(bundle, 4242, 1042);
    runYears(ctx, 800);
    for (const inst of ctx.world.arcs.values()) {
      const arc = bundle.arcs.find((a) => a.id === inst.arc)!;
      expect(arc.nodes.some((n) => n.id === inst.node), `${inst.arc}/${inst.node}`).toBe(true);
    }
  });
});
