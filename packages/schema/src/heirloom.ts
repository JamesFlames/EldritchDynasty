import { z } from 'zod';
import { FilterS } from './conditions.js';
import { EffectS } from './event.js';

/**
 * HEIRLOOMS — things the house owns, and applies to a person.
 *
 * The application mechanism is GENERIC. An heirloom declares who it may be
 * used on (the same `Filter` vocabulary slots use) and what it does (the same
 * closed `Effect` union events use), and `people/heirlooms.ts` applies it. No
 * heirloom carries code, so adding one is a YAML edit — which is the same
 * bargain the rest of the content pipeline makes: content is open, the verb
 * list is closed.
 *
 * What differs between heirlooms is what USING one costs the heirloom, and
 * that is the `spends` flag:
 *
 *   consumed   gone afterwards. A portion of something, drunk once.
 *   cooldown   usable again after `cooldownYears`. A thing that must refill.
 *   reusable   no cost, no wait. A focus, a rod, a mirror.
 *
 * `charges` composes with all three: an heirloom with three charges and a
 * sixty-year cooldown is used three times across two centuries and is then
 * an ornament. That combination is why this is two fields rather than one
 * enum with five members.
 */
export const HeirloomSpendS = z.enum(['consumed', 'cooldown', 'reusable']);
export type HeirloomSpend = z.infer<typeof HeirloomSpendS>;

export const HeirloomKindS = z.enum(['instrument', 'regalia', 'burden', 'portion']);
export type HeirloomKind = z.infer<typeof HeirloomKindS>;

export const HeirloomUseS = z.object({
  spends: HeirloomSpendS,
  /** Years before it may be used again. Only read when `spends` is cooldown. */
  cooldownYears: z.number().default(0),
  /** Total uses before it is spent, whatever `spends` says. Omit for unlimited. */
  charges: z.number().int().positive().optional(),
});
export type HeirloomUse = z.infer<typeof HeirloomUseS>;

export const HeirloomDefS = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string(),
  kind: HeirloomKindS,
  use: HeirloomUseS,

  /**
   * Who it may be used on. Empty means anyone living in the house. The bearer
   * is bound to the slot token `BEARER`, so effects address them the same way
   * an event addresses a cast member.
   */
  target: z.array(FilterS).default([]),

  /** What it does to the bearer. Same closed union the events use. */
  effects: z.array(EffectS).default([]),

  /** Written when it is used. `{BEARER}` renders the person's name. */
  chronicle: z.string().optional(),
  blurb: z.string().optional(),
  /** A Burden wants something, and cannot be sold (concept §15). */
  cannotBeSold: z.boolean().default(false),
});
export type HeirloomDef = z.infer<typeof HeirloomDefS>;

export const HeirloomFileS = z.object({ heirlooms: z.array(HeirloomDefS) });

/** What the world remembers about one the house actually holds. */
export interface HeirloomState {
  id: string;
  acquiredYear: number;
  /** Undefined when the def sets no `charges`. */
  usesLeft?: number;
  lastUsedYear?: number;
  /** Consumed, or out of charges. Kept in the ledger — the house remembers. */
  spent: boolean;
  usedOn: { person: string; year: number }[];
}
