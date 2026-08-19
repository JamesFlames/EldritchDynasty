import { z } from 'zod';

/**
 * Who an `Effect` or a `Claim` lands on. Split out of `event.ts` so `Claim`
 * (in `claim.ts`) can share it without the two files importing each other.
 */
export const TargetS = z.union([
  z.object({ slot: z.string() }),
  z.object({ all: z.string() }),
  z.enum(['head', 'household', 'all_blood', 'children_of_head']),
]);
export type Target = z.infer<typeof TargetS>;
