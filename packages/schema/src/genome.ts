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
  /**
   * MEIOTIC DRIVE (issue #41): the chance that the haplotype carrying MORE of
   * this locus is the one a female meiosis starts from. 0.5 is a fair coin and
   * is what every ordinary locus gets.
   *
   * It exists because the blood is *given* rather than inherited fairly. A
   * son's font comes only from his mother, and a mother passes a mosaic of her
   * two X's — so on a fair coin the family's founding haplotype halves every
   * generation and is gone inside four, which is measured and is what
   * `gate:blood` was written to show. A drive above a half is the only thing
   * in the model that pushes back, and it pushes without ever making the gift
   * reliable or schedulable (invariant 4): it changes which X a child is
   * likely to be handed, and nothing about whether that X does anything.
   */
  drive: z.number().min(0).max(1).default(0.5),
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
  /**
   * Not yet rolled. `pool` decides the frequencies and `seed` decides the
   * draw, so the genome exists the moment anybody reads it and would have
   * been the same genome had it been rolled the day this person arrived.
   *
   * `bias` is the authored intent from the character template that minted
   * them — "a scholar's daughter" is meant to be worth marrying for her
   * mind. It travels ON THE REF rather than being applied at mint time,
   * because a lazy genome has no genome to apply it to yet, and because a
   * suitor who is never married must cost twelve bytes and not a rolled
   * chromosome.
   */
  | { kind: 'lazy'; pool: string; seed: number; bias?: Record<string, number> };

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
