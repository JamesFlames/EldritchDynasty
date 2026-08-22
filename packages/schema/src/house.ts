import { z } from 'zod';
import { GenePoolS } from './genome.js';
import { RespectTierS } from './conditions.js';

export const HouseDefS = z.object({
  id: z.string(),
  name: z.string(),
  isPlayerHouse: z.boolean().default(false),
  genePool: GenePoolS,
  respect: RespectTierS.default('known'),
  wealth: z.number().default(0),
  /**
   * What this house already owns in 1042, by heirloom id. There was nowhere to
   * say this, so the Regalia — three named objects that four content files and
   * the Age One script all talk about, and that Demigod requires held at once
   * — were owned by nobody: `world.heirlooms` started empty and the only ways
   * in were an auction lot and three authored `grant` effects. A house's
   * founding possessions are content, and this is where content says so.
   * Honoured for the player house at `bootstrap`; ignored elsewhere, because
   * `HeirloomState` has no owner field and a rival house holding a thing is
   * that thing's own story to tell.
   */
  heirlooms: z.array(z.string()).default([]),
  /** Drives auction bidding, marriage terms and hostility (concept §14). */
  motives: z.array(z.object({
    wants: z.array(z.string()).default([]),
    refuses: z.array(z.string()).default([]),
    bidsUpTo: z.number().default(0),
  })).default([]),
  blurb: z.string().optional(),
});
export type HouseDef = z.infer<typeof HouseDefS>;

export const HouseFileS = z.object({ houses: z.array(HouseDefS) });

/** Enemies are not a type. Hostility is an edge. */
export interface Relationship {
  from: string;
  to: string;
  sentiment: number;
  kinds: ('rival' | 'debt' | 'obligation' | 'affection' | 'fear' | 'patronage')[];
  grudges: Grudge[];
}

export interface Grudge {
  id: string;
  originEvent: string;
  originYear: number;
  severity: number;
  /** One enum is why the prologue's grudge echoes for a thousand years. */
  inheritance: 'none' | 'heir_only' | 'all_blood' | 'house_wide';
  decayPerYear: number;
}
