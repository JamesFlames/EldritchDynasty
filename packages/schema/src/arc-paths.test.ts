import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import type { ArcDef, ArcNode } from './arc.js';
import { longestArcPath, shortestArcPath } from './arc-paths.js';

/** A minimal node, defaulting the fields these tests never vary. */
function node(over: Partial<ArcNode> & Pick<ArcNode, 'id' | 'schedule' | 'successors'>): ArcNode {
  return { event: 'e', selection: 'first_match', ...over };
}

function arc(entry: string, nodes: ArcNode[]): ArcDef {
  return { id: 'test_arc', title: 't', entry, nodes, bindings: [], maxConcurrentInstances: 1, inline: false };
}

describe('shortestArcPath and longestArcPath (issue #91, Stage H, and #131)', () => {
  it('agree on a single immediate node ending at once', () => {
    const a = arc('a', [node({ id: 'a', schedule: 'immediate', successors: [{ to: 'end', weight: 100 }] })]);
    expect(shortestArcPath(a)).toBe(0);
    expect(longestArcPath(a)).toBe(0);
  });

  it('reads a bounded schedule at its own min and max', () => {
    const a = arc('a', [node({ id: 'a', schedule: { minYears: 5, maxYears: 20 }, successors: [{ to: 'end', weight: 100 }] })]);
    expect(shortestArcPath(a)).toBe(5);
    expect(longestArcPath(a)).toBe(20);
  });

  it('reads next_generation at 20-31, matching scheduleNext in core/src/events/arcs.ts', () => {
    const a = arc('a', [node({ id: 'a', schedule: 'next_generation', successors: [{ to: 'end', weight: 100 }] })]);
    expect(shortestArcPath(a)).toBe(20);
    expect(longestArcPath(a)).toBe(31);
  });

  it('sums along a chain', () => {
    const a = arc('a', [
      node({ id: 'a', schedule: { minYears: 5, maxYears: 10 }, successors: [{ to: 'b', weight: 100 }] }),
      node({ id: 'b', schedule: { minYears: 3, maxYears: 7 }, successors: [{ to: 'end', weight: 100 }] }),
    ]);
    expect(shortestArcPath(a)).toBe(8);
    expect(longestArcPath(a)).toBe(17);
  });

  it('takes the best branch for the shortest path and the worst for the longest, at a real fork', () => {
    const a = arc('a', [
      node({
        id: 'a', schedule: 'immediate',
        successors: [{ to: 'quick', weight: 100 }, { to: 'slow', weight: 100 }],
      }),
      node({ id: 'quick', schedule: { minYears: 1, maxYears: 2 }, successors: [{ to: 'end', weight: 100 }] }),
      node({ id: 'slow', schedule: { minYears: 50, maxYears: 90 }, successors: [{ to: 'end', weight: 100 }] }),
    ]);
    expect(shortestArcPath(a)).toBe(1);
    expect(longestArcPath(a)).toBe(90);
  });

  it('is Infinity on both ends for a node whose only successor loops back to itself', () => {
    // arc_the_muster's own shape (muster.yaml): "the middle of a war is the
    // part that repeats." No route through this node ever reaches 'end'.
    const a = arc('a', [node({ id: 'a', schedule: 'immediate', successors: [{ to: 'a', weight: 100 }] })]);
    expect(longestArcPath(a)).toBe(Infinity);
    expect(shortestArcPath(a)).toBe(Infinity);
  });

  it('finds the finite route around a loop for the shortest path, and still reports Infinity for the longest', () => {
    // A cycle back to the entry, alongside a real way out — the loop can
    // always be skipped for a MINIMUM, so the shortest path must ignore it
    // and take the other successor; the longest path is genuinely unbounded
    // because the loop can be taken any number of times first.
    const a = arc('a', [
      node({
        id: 'a', schedule: { minYears: 10, maxYears: 10 },
        successors: [{ to: 'a', weight: 100 }, { to: 'end', weight: 100 }],
      }),
    ]);
    expect(shortestArcPath(a)).toBe(10);
    expect(longestArcPath(a)).toBe(Infinity);
  });

  it('an unknown node contributes nothing — arcs/wiring\'s finding, not this walk\'s', () => {
    const a = arc('a', [node({ id: 'a', schedule: { minYears: 5, maxYears: 5 }, successors: [{ to: 'ghost', weight: 100 }] })]);
    expect(shortestArcPath(a)).toBe(5);
    expect(longestArcPath(a)).toBe(5);
  });

  it('every shipped arc\'s shortest path never exceeds its own longest — a sanity floor on the real content', () => {
    const bundle = loadContent();
    for (const a of bundle.arcs) {
      const shortest = shortestArcPath(a);
      const longest = longestArcPath(a);
      expect(shortest, a.id).toBeLessThanOrEqual(longest);
    }
  });
});
