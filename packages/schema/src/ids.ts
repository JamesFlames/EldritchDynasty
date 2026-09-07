import { z } from 'zod';

/**
 * Branded IDs. Costs nothing at runtime and stops the entire class of bug where
 * a PersonId is passed where a HouseId is expected. In a codebase where nearly
 * every value is a string key, this is not optional.
 */
const id = <T extends string>(brand: T) => z.string().min(1).brand<T>();

export const PersonIdS = id('Person');
export const HouseIdS = id('House');
export const BranchIdS = id('Branch');
export const AttributeIdS = id('Attribute');
export const TraitIdS = id('Trait');
export const LocusIdS = id('Locus');
export const AlleleIdS = id('Allele');
export const EventIdS = id('Event');
export const ArcIdS = id('Arc');
export const NodeIdS = id('Node');
export const SlotIdS = id('Slot');
export const OutcomeIdS = id('Outcome');
export const ChoiceIdS = id('Choice');
export const FlagIdS = id('Flag');
export const HeirloomIdS = id('Heirloom');
export const SpellbookIdS = id('Spellbook');
export const AgeIdS = id('Age');
export const ClauseIdS = id('Clause');
export const RumourIdS = id('Rumour');
export const TaleIdS = id('Tale');
export const CareerIdS = id('Career');
export const GrudgeIdS = id('Grudge');
export const DiscrepancyIdS = id('Discrepancy');
export const TagS = id('Tag');
export const ParcelIdS = id('Parcel');

export type PersonId = z.infer<typeof PersonIdS>;
export type HouseId = z.infer<typeof HouseIdS>;
export type BranchId = z.infer<typeof BranchIdS>;
export type AttributeId = z.infer<typeof AttributeIdS>;
export type TraitId = z.infer<typeof TraitIdS>;
export type LocusId = z.infer<typeof LocusIdS>;
export type AlleleId = z.infer<typeof AlleleIdS>;
export type EventId = z.infer<typeof EventIdS>;
export type ArcId = z.infer<typeof ArcIdS>;
export type NodeId = z.infer<typeof NodeIdS>;
export type SlotId = z.infer<typeof SlotIdS>;
export type OutcomeId = z.infer<typeof OutcomeIdS>;
export type ChoiceId = z.infer<typeof ChoiceIdS>;
export type FlagId = z.infer<typeof FlagIdS>;
export type HeirloomId = z.infer<typeof HeirloomIdS>;
export type SpellbookId = z.infer<typeof SpellbookIdS>;
export type AgeId = z.infer<typeof AgeIdS>;
export type ClauseId = z.infer<typeof ClauseIdS>;
export type RumourId = z.infer<typeof RumourIdS>;
export type TaleId = z.infer<typeof TaleIdS>;
export type CareerId = z.infer<typeof CareerIdS>;
export type GrudgeId = z.infer<typeof GrudgeIdS>;
export type DiscrepancyId = z.infer<typeof DiscrepancyIdS>;
export type Tag = z.infer<typeof TagS>;
export type ParcelId = z.infer<typeof ParcelIdS>;

/** Unbranded helper for the many places we build IDs from strings. */
export const asId = <T>(s: string): T => s as unknown as T;

export type Year = number;
export const YearS = z.number().int();
