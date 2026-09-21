import type { ArcDef, Schedule } from './arc.js';

/**
 * HOW LONG AN ARC CAN TAKE, WALKED BOTH WAYS.
 *
 * Split out of `rules.ts` (issue #131's `longestArcPath`, built for its own
 * `arcs/expiry` rule) so `core` can read the SAME walk at runtime rather than
 * a second copy of it — `schema` cannot depend on `core`, which depends on
 * `schema`, so the one-way dependency only works with the shared function
 * living here. Two definitions of "how long can this arc take" is exactly
 * the class of drift this repository's own rules exist to refuse.
 *
 * `longestArcPath` answers "can this arc's own declared expiry ever be too
 * short" (#131). `shortestArcPath` answers a different question issue #91's
 * Stage H names explicitly: "can this arc even START and still have time to
 * finish" — the derived start window a scene that begins a multi-generation
 * substory gates on, so a house near the campaign's end is never offered a
 * story it cannot complete. Both walk the same successor graph; only the
 * direction of the fold and each node's own worst/best-case delay differ.
 */

/**
 * How many years a node's OWN schedule can cost, worst case — the same three
 * branches `scheduleNext` (`core/src/events/arcs.ts`) draws from, read as an
 * upper bound instead of a roll. `next_generation`'s `20 + rng.int(12)` tops
 * out at 31.
 *
 * That number now lives in two packages with no import between them to keep
 * it honest — `schema` cannot depend on `core`, which depends on `schema` —
 * so a change to `scheduleNext`'s own bounds has to be brought here by hand.
 * `rules.test.ts`'s synthetic-arc tests pin the CURRENT value (31) rather
 * than importing it, which is the best a one-way dependency allows; it will
 * not itself notice the two drifting apart.
 */
function longestNodeDelay(schedule: Schedule): number {
  if (schedule === 'immediate') return 0;
  if (schedule === 'next_generation') return 31;
  return schedule.maxYears;
}

/** The floor of the same three branches — `next_generation`'s `20 + rng.int(12)` bottoms out at 20. */
function shortestNodeDelay(schedule: Schedule): number {
  if (schedule === 'immediate') return 0;
  if (schedule === 'next_generation') return 20;
  return schedule.minYears;
}

/**
 * The longest an arc can possibly take from `entry` to any `end` — the sum,
 * along the worst branch, of every node's own `longestNodeDelay`. A cycle (a
 * successor pointing back at a node already on the current path) makes this
 * `Infinity` — `arc_the_muster`'s `word` node is its own successor "on
 * purpose... the middle of a war is the part that repeats" (`muster.yaml`),
 * so an unbounded arc is a real, shipped shape and not a wiring mistake.
 * `arcs/expiry` (`rules.ts`) reads that `Infinity` as "this rule's
 * finite-path model does not apply here" rather than as a failure.
 */
export function longestArcPath(arc: ArcDef): number {
  const byId = new Map(arc.nodes.map((n) => [n.id, n]));
  const memo = new Map<string, number>();
  const onPath = new Set<string>();

  function from(nodeId: string): number {
    const cached = memo.get(nodeId);
    if (cached !== undefined) return cached;
    const node = byId.get(nodeId);
    if (!node) return 0; // an unknown node is `arcs/wiring`'s finding, not this walk's
    if (onPath.has(nodeId)) return Infinity;

    onPath.add(nodeId);
    // No successors ends the story here (`desugar.ts`'s own reading of an
    // empty list), so the node's own delay is the whole of its contribution.
    let downstream = 0;
    for (const s of node.successors) {
      downstream = Math.max(downstream, s.to === 'end' ? 0 : from(s.to));
    }
    onPath.delete(nodeId);

    const total = longestNodeDelay(node.schedule) + downstream;
    memo.set(nodeId, total);
    return total;
  }

  return from(arc.entry);
}

/**
 * THE FASTEST an arc can possibly finish — the sum, along the BEST branch,
 * of every node's own `shortestNodeDelay`. A cycle is `Infinity` here too,
 * and for the reason a minimum needs: a successor that loops back onto the
 * path already walked can never be part of the SHORTEST route to an end, so
 * marking it unusable (rather than zero) is what lets `Math.min` correctly
 * prefer whichever other successor actually reaches one. A node all of
 * whose successors loop has no finite shortest route at all, which is a
 * true fact about that arc and not a bug in the walk.
 *
 * Issue #91, Stage H (ruled 2026-09-07): "the shortest path is the hard
 * floor, because those instances are PROVABLY dead" — a house whose time
 * remaining is under this number cannot complete the arc under ANY roll,
 * not merely an unlucky one, which is what makes the shortest path (rather
 * than a softer average) the right threshold for refusing to start one.
 */
export function shortestArcPath(arc: ArcDef): number {
  const byId = new Map(arc.nodes.map((n) => [n.id, n]));
  const memo = new Map<string, number>();
  const onPath = new Set<string>();

  function from(nodeId: string): number {
    const cached = memo.get(nodeId);
    if (cached !== undefined) return cached;
    const node = byId.get(nodeId);
    if (!node) return 0;
    if (onPath.has(nodeId)) return Infinity;

    onPath.add(nodeId);
    // Unlike the longest walk, a childless node is the whole story ending
    // HERE — zero downstream — while a node whose every successor loops has
    // no finite way onward, hence starting `downstream` at `Infinity` when
    // there ARE successors to weigh and letting `Math.min` do the rest.
    let downstream = node.successors.length === 0 ? 0 : Infinity;
    for (const s of node.successors) {
      downstream = Math.min(downstream, s.to === 'end' ? 0 : from(s.to));
    }
    onPath.delete(nodeId);

    const total = shortestNodeDelay(node.schedule) + downstream;
    memo.set(nodeId, total);
    return total;
  }

  return from(arc.entry);
}
