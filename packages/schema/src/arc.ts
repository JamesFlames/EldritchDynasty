import { z } from 'zod';
import { ConditionS } from './conditions.js';

/**
 * WHEN THE NEXT BEAT COMES DUE.
 *
 * Lifted out of `ArcNodeS` because an inline follow-up (`Outcome.next`) needs
 * exactly the same vocabulary, and two spellings of "in forty to ninety years"
 * is one spelling too many.
 */
export const ScheduleS = z.union([
  z.literal('immediate'),
  z.literal('next_generation'),
  z.object({ minYears: z.number(), maxYears: z.number() }),
]);
export type Schedule = z.infer<typeof ScheduleS>;

/**
 * A substory. A parent event triggers children and EXACTLY ONE happens — which
 * the engine guarantees structurally by returning a single NodeId, not by
 * convention.
 *
 * Four ways to ask what happened in the parent, and they AND together:
 *
 *   fromOutcome  the exact outcome id.
 *   fromChoice   which branch was taken. Load-bearing the moment something
 *                other than the player takes it — a `state` ladder or a `party`
 *                check names a CHOICE, and the outcome underneath it may be one
 *                of five.
 *   fromTag      any outcome carrying this tag, so one successor covers a family
 *                of endings instead of listing their ids.
 *   when         a `Condition`, evaluated with the running arc in scope — so it
 *                can read `arcFlag` and `arcVisited` and branch on what the
 *                story remembers rather than only on what just happened.
 */
export const SuccessorS = z.object({
  to: z.string(),                     // NodeId, or 'end'
  when: ConditionS.optional(),
  /** Branch on what actually happened in the parent. */
  fromOutcome: z.string().optional(),
  /** Branch on which option was taken, whoever took it. */
  fromChoice: z.string().optional(),
  /** Branch on an outcome TAG, so one successor covers many outcomes. */
  fromTag: z.string().optional(),
  weight: z.number().default(100),
});
export type Successor = z.infer<typeof SuccessorS>;

export const ArcNodeS = z.object({
  id: z.string(),
  event: z.string(),
  selection: z.enum(['first_match', 'weighted']).default('first_match'),
  successors: z.array(SuccessorS).default([]),
  schedule: ScheduleS.default('next_generation'),
});
export type ArcNode = z.infer<typeof ArcNodeS>;

export const ArcDefS = z.object({
  id: z.string(),
  title: z.string(),
  entry: z.string(),
  nodes: z.array(ArcNodeS).min(1),
  /** Slots that persist across the entire substory. */
  bindings: z.array(z.string()).default([]),
  expiresAfterYears: z.number().optional(),
  maxConcurrentInstances: z.number().default(1),
  /**
   * Compiled from an `Outcome.next` chain rather than authored (see
   * `desugar.ts`). Never present in `Content.bundle.arcs`, so the editor never
   * writes one back to YAML and renders it read-only instead.
   */
  inline: z.boolean().default(false),
});
export type ArcDef = z.infer<typeof ArcDefS>;

export const ArcFileS = z.object({ arcs: z.array(ArcDefS) });

export interface ArcInstance {
  id: string;
  arc: string;
  node: string;
  /** The persistent cast. This is what makes it a story and not three events. */
  bindings: Record<string, string>;
  /**
   * What this run of the story remembers. Written by the `arc_flag` effect and
   * read by the `arcFlag` condition — which is what lets a successor two
   * centuries downstream branch on something a node decided in the first beat,
   * without that fact having to be a world flag every other event can see.
   */
  localFlags: Record<string, string | number | boolean>;
  startedYear: number;
  dueYear?: number;
  /** `choice` is which branch was taken; absent for a node that was narration. */
  history: { node: string; outcome: string; choice?: string; year: number }[];
  status: 'active' | 'ended' | 'cancelled' | 'expired';
}
