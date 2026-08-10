import type { AlleleDef, LocusDef, GenePool } from '@ed/schema';
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
  const override = pool?.frequencies?.[locus.id];
  const weights = alleles.map((a) => {
    const o = override?.find((x) => x.allele === a.id);
    return o ? o.p : a.p;
  });

  // Font loci: OUTSIDERS carry nulls except at their pool's carrier rate, and
  // what they carry when they carry anything is weak. This is the whole of
  // "Eldritch Power dilutes when married outward and cannot be replaced from
  // any external source".
  //
  // A pool with rate 1 is the family itself, which draws on its own
  // frequencies rather than being capped at the outsider's weak alleles.
  if (locus.kind === 'eldritch_font' && pool && !override && pool.fontCarrierRate < 1) {
    const carries = rng.bool(pool.fontCarrierRate);
    if (!carries) {
      const nullIdx = alleles.findIndex((a) => a.tags.includes('null'));
      return nullIdx >= 0 ? nullIdx : 0;
    }
    // A carrier gets one of the weak outsider alleles, never a family-strength one.
    const weak = alleles
      .map((a, i) => ({ a, i }))
      .filter(({ a }) => !a.tags.includes('null') && a.effect > 0 && a.effect <= 3);
    if (weak.length) return rng.pick(weak).i;
  }

  if (locus.kind === 'deleterious' && pool) {
    const badIdx = alleles.findIndex((a) => a.tags.includes('deleterious'));
    if (badIdx >= 0 && rng.bool(pool.deleteriousLoad)) return badIdx;
  }

  let total = 0;
  for (const w of weights) total += w;
  let roll = rng.next() * (total || 1);
  for (let i = 0; i < alleles.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return i;
  }
  return 0;
}
