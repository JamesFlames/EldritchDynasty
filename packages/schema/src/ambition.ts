import { z } from 'zod';

/** One voluntary, non-mechanical plan the player asks the house to keep in view. */
export const HouseAmbitionIdS = z.enum([
  'deepen_blood',
  'raise_ascendant',
  'restore_ledger',
  'secure_branches',
]);
export type HouseAmbitionId = z.infer<typeof HouseAmbitionIdS>;
