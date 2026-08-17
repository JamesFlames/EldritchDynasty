import { z } from 'zod';
import { AlleleIdS, AttributeIdS, LocusIdS } from './ids.js';

/**
 * Genotype and phenotype are separate layers. Characters do not inherit their
 * stats; they inherit ALLELES, and stats are computed. Regression to the mean,
 * silent recessives, throwbacks, dilution by outward marriage and madness from
 * concentration are all consequences of this and are special-cased nowhere.
 */

export const LocusKindS = z.enum([
  'additive',          // ordinary polygenic contribution
  'major',             // large effect, rare — prodigies and cripples
  'deleterious',       // harmless heterozygous, costly homozygous
  'eldritch_font',     // X-linked, family-exclusive. Capacity.
  'eldritch_channel',  // autosomal, present worldwide. Throughput.
  /**
   * Fertility option B (issue #26), prototyped behind a coupling constant
   * defaulted to zero — see `expression.ts`'s `FECUNDITY_DRAG_COUPLING`.
   * X-linked, each locus placed a few cM from one font locus so the two are
   * linked, not correlated by construction: whatever pairing a family's
   * founders happen to carry persists across generations until a crossover
   * splits it, the same way font itself concentrates and dilutes.
   */
  'fecundity_drag',
]);
export type LocusKind = z.infer<typeof LocusKindS>;

export const ChromosomeS = z.union([z.number().int().min(0), z.literal('X')]);
export type Chromosome = z.infer<typeof ChromosomeS>;

export const LocusDefS = z.object({
  id: LocusIdS,
  chromosome: ChromosomeS,
  /** centiMorgans. Drives linkage: nearby loci travel together. */
  position: z.number(),
  kind: LocusKindS,
  /** Pleiotropy is allowed and encouraged: one locus, several attributes. */
  contributes: z.array(z.object({ attr: AttributeIdS, weight: z.number() })).default([]),
  /** -1 = lower allele dominant, 0 = purely additive, +1 = higher dominant. */
  dominance: z.number().min(-1).max(1).default(0),
  /** Allele pool for this locus, with world-baseline frequencies. */
  alleles: z.array(
    z.object({
      id: AlleleIdS,
      effect: z.number(),
      p: z.number().min(0).max(1),
      dominanceOverride: z.number().min(-1).max(1).optional(),
      tags: z.array(z.enum(['null', 'deleterious', 'lethal_homozygous', 'eldritch'])).default([]),
      /** Named alleles are chronicle content: "the Ashen mark". */
      name: z.string().optional(),
    }),
  ),
});
export type LocusDef = z.infer<typeof LocusDefS>;
export type AlleleDef = LocusDef['alleles'][number];

/**
 * Runtime genome. Typed arrays of allele indices into a shared locus table.
 * ~200-300 Int16 values, about 500 bytes. Six thousand persons is under 3 MB;
 * there is no performance argument for cutting corners here.
 */
export interface Genome {
  /** Two autosomal haplotypes, indexed by the flattened autosomal locus table. */
  autosomal: [Int16Array, Int16Array];
  /**
   * Sex chromosomes. Females hold two X haplotypes. Males hold one X and null
   * for the Y — the Y carries nothing here. It is a coin flip with a name.
   */
  sex: [Int16Array, Int16Array | null];
  mutations: MutationRecord[];
}

export interface MutationRecord {
  locus: string;
  from: string;
  to: string;
  year: number;
}

/** A person's genome may not exist yet. Most of the world never breeds in. */
export type GenomeRef =
  | { kind: 'materialized'; genome: Genome }
  | { kind: 'lazy'; pool: string; seed: number };

export interface Gamete {
  autosomal: Int16Array;
  /** The X haplotype, or null when the gamete carries a Y. */
  x: Int16Array | null;
  /** Mutations that happened IN THIS GAMETE. They belong to the child. */
  mutations: MutationRecord[];
}

/**
 * Eldritch expression. ONE gate governs everything, and it is capability
 * rather than sex — which is what lets a mundane son be as safe as any woman.
 */
export interface EldritchProfile {
  /** X-linked total. Computed for BOTH sexes. Never shown to the player. */
  carriedFont: number;
  /** THE gate. Every Madness source in the game reads this and only this. */
  canExpress: boolean;
  expressedPower: number;
  overflowMadness: number;
  /** Throughput ceiling from the autosomal channel loci. */
  ceiling: number;
}

/** A house is, mechanically, an allele frequency distribution. */
export const GenePoolS = z.object({
  house: z.string(),
  /** Per-locus overrides of the world-baseline allele frequencies. */
  frequencies: z.record(z.string(), z.array(z.object({ allele: z.string(), p: z.number() }))).default({}),
  /** Rare, weak font alleles. This is what the market calls "deep blood". */
  fontCarrierRate: z.number().min(0).max(1).default(0),
  /** Great houses have been marrying cousins too. */
  deleteriousLoad: z.number().min(0).max(1).default(0.1),
});
export type GenePool = z.infer<typeof GenePoolS>;
