import { z } from 'zod';
import { ConditionS } from './conditions.js';

/**
 * A substory. A parent event triggers children and EXACTLY ONE happens — which
 * the engine guarantees structurally by returning a single NodeId, not by
 * convention.
 */
export const SuccessorS = z.object({
  to: z.string(),                     // NodeId, or 'end'
  when: ConditionS.optional(),
  /** Branch on what actually happened in the parent. */
  fromOutcome: z.string().optional(),
  weight: z.number().default(100),
});
export type Successor = z.infer<typeof SuccessorS>;

export const ArcNodeS = z.object({
  id: z.string(),
  event: z.string(),
  selection: z.enum(['first_match', 'weighted']).default('first_match'),
  successors: z.array(SuccessorS).default([]),
  schedule: z.union([
    z.literal('immediate'),
    z.literal('next_generation'),
    z.object({ minYears: z.number(), maxYears: z.number() }),
  ]).default('next_generation'),
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
});
export type ArcDef = z.infer<typeof ArcDefS>;

export const ArcFileS = z.object({ arcs: z.array(ArcDefS) });

export interface ArcInstance {
  id: string;
  arc: string;
  node: string;
  /** The persistent cast. This is what makes it a story and not three events. */
  bindings: Record<string, string>;
  localFlags: Record<string, string | number | boolean>;
  startedYear: number;
  dueYear?: number;
  history: { node: string; outcome: string; year: number }[];
  status: 'active' | 'ended' | 'cancelled' | 'expired';
}
