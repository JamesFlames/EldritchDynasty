import { assertNever, type AlleleDef, type LocusDef, type GenePool } from '@ed/schema';
import type { Rng } from '../rng.js';

/**
 * The locus table is built once from content and shared by every genome.
 * Genomes are Int16Arrays of allele indices into this table — a genome is
 * ~500 bytes, and six thousand persons is under 3 MB.
 */
export interface LocusTable {
  /** Autosomal loci, sorted by chromosome then position. */
  autosomal: LocusDef[];
  /** X-linked loci, sorted by position. */
  x: LocusDef[];
  autosomalIndex: Map<string, number>;
  xIndex: Map<string, number>;
  /** Flat allele arrays parallel to the locus arrays. */
  autosomalAlleles: AlleleDef[][];
  xAlleles: AlleleDef[][];
  /** Which loci feed each attribute, precomputed. */
  byAttribute: Map<string, { locus: LocusDef; where: 'autosomal' | 'x'; index: number; weight: number }[]>;
  fontIndices: number[];        // indices into x
  channelIndices: number[];     // indices into autosomal
}

export function buildLocusTable(loci: LocusDef[]): LocusTable {
  const autosomal = loci
    .filter((l) => l.chromosome !== 'X')
    .sort((a, b) => (Number(a.chromosome) - Number(b.chromosome)) || (a.position - b.position));
  const x = loci.filter((l) => l.chromosome === 'X').sort((a, b) => a.position - b.position);

  const table: LocusTable = {
    autosomal,
    x,
    autosomalIndex: new Map(autosomal.map((l, i) => [l.id, i])),
    xIndex: new Map(x.map((l, i) => [l.id, i])),
    autosomalAlleles: autosomal.map((l) => l.alleles),
    xAlleles: x.map((l) => l.alleles),
    byAttribute: new Map(),
    fontIndices: [],
    channelIndices: [],
  };

  const push = (l: LocusDef, where: 'autosomal' | 'x', index: number) => {
    for (const c of l.contributes) {
      const key = c.attr;
      const list = table.byAttribute.get(key) ?? [];
      list.push({ locus: l, where, index, weight: c.weight });
      table.byAttribute.set(key, list);
    }
  };
  autosomal.forEach((l, i) => {
    push(l, 'autosomal', i);
    if (l.kind === 'eldritch_channel') table.channelIndices.push(i);
  });
  x.forEach((l, i) => {
    push(l, 'x', i);
    if (l.kind === 'eldritch_font') table.fontIndices.push(i);
  });

  return table;
}

/**
 * THE ONE PLACE AN ALLELE'S REAL DRAW FREQUENCY IS COMPUTED (issue #113).
 *
 * A locus kind with a draw rule of its own has TWO frequencies — the authored
 * `allele.p` and whatever a house's pool actually draws it at — and until
 * this function existed only `drawAllele` knew the second one.
 * `expectedAttribute` (`genetics/expression.ts`) read the first, for every
 * locus, always. That is why the population mean the game measures couples
 * against used to be computed from frequencies nobody in the world is drawn
 * at: a font locus is authored at 12% carriers and an outsider pool draws it
 * at 5% or less; a deleterious locus is authored at `p: 0.07` and a pool's
 * `deleteriousLoad` (0.04-0.31 across shipped houses) sits underneath that
 * draw, not beside it. See `docs/FAILURES.md`, "a locus that is drawn by its
 * own rule".
 *
 * Returns relative weights over `alleles`, in the SAME units as `allele.p` —
 * callers normalise by their own sum. `drawAllele` rolls one allele out of
 * them for a single person's pool; `expectedAttribute` sums them across every
 * pool in play, weighted by that pool's share of the world, to get the
 * population's real centre.
 *
 * A closed switch over `LocusKind` (invariant 5): a kind added to the schema
 * without a case here is a compile error, not a silent draw at the wrong
 * frequency.
 */
export function effectiveAlleleWeights(
  alleles: AlleleDef[],
  locus: LocusDef,
  pool: GenePool | undefined,
): number[] {
  const override = pool?.frequencies?.[locus.id];
  const base = alleles.map((a) => {
    const o = override?.find((x) => x.allele === a.id);
    return o ? o.p : a.p;
  });

  switch (locus.kind) {
    case 'additive':
    case 'major':
    case 'eldritch_channel':
    case 'fecundity_drag':
      return base;

    case 'eldritch_font': {
      // OUTSIDERS carry nulls except at their pool's carrier rate, and what
      // they carry when they carry anything is weak. This is the whole of
      // "Eldritch Power dilutes when married outward and cannot be replaced
      // from any external source". A pool with rate 1 is the family itself,
      // which draws on its own frequencies rather than being capped at the
      // outsider's weak alleles.
      if (!pool || override || pool.fontCarrierRate >= 1) return base;

      const weak = alleles
        .map((a, i) => ({ a, i }))
        .filter(({ a }) => !a.tags.includes('null') && a.effect > 0 && a.effect <= 3);
      // No weak allele to hand a carrier: the world baseline is all this
      // locus has to say, the same fallback `drawAllele` always took here.
      if (!weak.length) return base;

      const weights = alleles.map(() => 0);
      const nullIdx = alleles.findIndex((a) => a.tags.includes('null'));
      const nullSlot = nullIdx >= 0 ? nullIdx : 0;
      weights[nullSlot] = (weights[nullSlot] ?? 0) + (1 - pool.fontCarrierRate);
      const each = pool.fontCarrierRate / weak.length;
      for (const { i } of weak) weights[i] = (weights[i] ?? 0) + each;
      return weights;
    }

    case 'deleterious': {
      // Great houses have been marrying cousins too: `deleteriousLoad`
      // FORCES the bad allele at that rate, on top of whatever the world
      // baseline would have drawn it at anyway — so its real frequency is
      // `load + (1 - load) * p_bad`, not the authored `p_bad` alone.
      if (!pool) return base;
      const badIdx = alleles.findIndex((a) => a.tags.includes('deleterious'));
      if (badIdx < 0) return base;

      const total = base.reduce((s, w) => s + w, 0) || 1;
      const weights = base.map((w) => (w / total) * (1 - pool.deleteriousLoad));
      weights[badIdx] = (weights[badIdx] ?? 0) + pool.deleteriousLoad;
      return weights;
    }

    default:
      return assertNever(locus.kind, 'locus kind');
  }
}

/**
 * Draw an allele index for a locus from a house's pool, falling back to the
 * world baseline. This is what makes a rival house a genetic character rather
 * than a name: House Marrow is rich in Death alleles because its pool says so.
 */
export function drawAllele(
  alleles: AlleleDef[],
  locus: LocusDef,
  pool: GenePool | undefined,
  rng: Rng,
): number {
  const weights = effectiveAlleleWeights(alleles, locus, pool);
  let total = 0;
  for (const w of weights) total += w;
  let roll = rng.next() * (total || 1);
  for (let i = 0; i < alleles.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return i;
  }
  return 0;
}
