import type { AttributeDef, EldritchProfile, Genome, Sex } from '@ed/schema';
import type { LocusTable } from './loci.js';

export const OVERFLOW_RATE = 0.85;

/** Combine two alleles under a dominance coefficient d ∈ [-1, 1]. */
export function expressLocus(effectA: number, effectB: number | null, d: number): number {
  if (effectB === null) return effectA;             // hemizygous — males at X loci
  const mid = (effectA + effectB) / 2;
  const hi = Math.max(effectA, effectB);
  return mid + d * (hi - mid);
}

function sumLocusGroup(g: Genome, table: LocusTable, indices: number[], where: 'autosomal' | 'x'): number {
  let total = 0;
  for (const i of indices) {
    const loci = where === 'autosomal' ? table.autosomal : table.x;
    const alleles = where === 'autosomal' ? table.autosomalAlleles : table.xAlleles;
    const locus = loci[i]!;
    const pool = alleles[i]!;
    const a = pool[(where === 'autosomal' ? g.autosomal[0] : g.sex[0])[i]!]?.effect ?? 0;
    const second = where === 'autosomal' ? g.autosomal[1] : g.sex[1];
    const b = second ? (pool[second[i]!]?.effect ?? 0) : null;
    const dom = pool[(where === 'autosomal' ? g.autosomal[0] : g.sex[0])[i]!]?.dominanceOverride ?? locus.dominance;
    total += expressLocus(a, b, dom);
  }
  return total;
}

/**
 * Throughput ceiling. The slope is THE tuning surface for how often the blood
 * ruins people: too steep and nobody ever overflows, so Madness never happens
 * and the central tension of the design never fires; too shallow and every
 * expressing man is mad by thirty. Measured in the harness, not argued about.
 */
export function channelCeiling(channel: number): number {
  return 4 + channel * 0.8;
}

/**
 * ONE gate governs Madness, and it is capability rather than sex — which is
 * what lets a mundane son be exactly as safe as any woman.
 *
 * There is no `if (female) madness = 0` clamp anywhere. A clamp is something a
 * later feature bypasses by accident; an unentered branch stays unentered.
 */
export function eldritch(g: Genome, sex: Sex, table: LocusTable): EldritchProfile {
  const font = sumLocusGroup(g, table, table.fontIndices, 'x');
  const channel = sumLocusGroup(g, table, table.channelIndices, 'autosomal');
  const ceiling = channelCeiling(channel);

  // Capability, not achievement: a boy of hot blood is exposed from birth,
  // years before he wakes. A woman never is, and neither is a son whose X
  // carries nothing — the ordinary result of marrying outward.
  const canExpress = sex === 'male' && font > 0;

  if (!canExpress) {
    return { carriedFont: font, canExpress: false, expressedPower: 0, overflowMadness: 0, ceiling };
  }
  return {
    carriedFont: font,
    canExpress: true,
    expressedPower: Math.min(font, ceiling),
    overflowMadness: Math.max(0, font - ceiling) * OVERFLOW_RATE,
    ceiling,
  };
}

/** The Mystic restriction. Separate system, no Madness consequence. */
export { canLearn } from '@ed/schema';

export function expressAttributes(
  g: Genome,
  sex: Sex,
  table: LocusTable,
  attributes: AttributeDef[],
  opts: { awakened: boolean },
): Map<string, number> {
  const out = new Map<string, number>();
  for (const def of attributes) {
    const key = def.id;
    if (def.kind === 'eldritch' || def.kind === 'derived') continue;

    const contribs = table.byAttribute.get(key) ?? [];
    let raw = 0;
    for (const c of contribs) {
      const alleles = c.where === 'autosomal' ? table.autosomalAlleles[c.index]! : table.xAlleles[c.index]!;
      const hapA = c.where === 'autosomal' ? g.autosomal[0] : g.sex[0];
      const hapB = c.where === 'autosomal' ? g.autosomal[1] : g.sex[1];
      const a = alleles[hapA[c.index]!]?.effect ?? 0;
      const b = hapB ? (alleles[hapB[c.index]!]?.effect ?? 0) : null;
      raw += expressLocus(a, b, c.locus.dominance) * c.weight;
    }

    // Mind only develops after Awakening (concept §10).
    if (def.gatedBy === 'awakening' && !opts.awakened) raw *= 0.35;

    // Sexual dimorphism, applied as ±half so the population mean is unmoved.
    // It shifts a distribution; it does not replace one. The overlap is the
    // design: a strong woman beating an ordinary man should be a thing that
    // happens and is worth writing down.
    if (def.dimorphism) raw += (sex === 'male' ? 1 : -1) * def.dimorphism / 2;

    out.set(key, clamp(raw, def.range.min, def.range.max));
  }
  return out;
}

/**
 * The population mean of an attribute, computed from allele frequencies and
 * dominance rather than measured from a run.
 *
 * Anything that maps an attribute onto a real quantity — completed family size
 * is the first — needs to know where the middle of the distribution is. A
 * hardcoded 24 is a number that silently stops being true the next time
 * someone changes `LOCI_PER_CORE` in `gen-loci.mjs`, and the symptom would be
 * every family in the game quietly gaining or losing a child.
 */
export function expectedAttribute(table: LocusTable, attr: string): number {
  let total = 0;
  for (const c of table.byAttribute.get(attr) ?? []) {
    const alleles = c.where === 'autosomal' ? table.autosomalAlleles[c.index]! : table.xAlleles[c.index]!;
    const mass = alleles.reduce((s, a) => s + a.p, 0) || 1;

    // Exact over the allele pair, which is cheap: loci carry two to four.
    let expected = 0;
    for (const a of alleles) {
      for (const b of alleles) {
        const d = a.dominanceOverride ?? c.locus.dominance;
        expected += (a.p / mass) * (b.p / mass) * expressLocus(a.effect, b.effect, d);
      }
    }
    total += expected * c.weight;
  }
  return total;
}

/**
 * Realized homozygosity, measured from the actual genome. This is what the
 * simulation resolves on. Pedigree F — computed from CLAIMED parents, and
 * therefore wrong whenever the documents are forged — is what the UI shows.
 * The two disagreeing is the forged-dowry economy working as designed.
 */
export function realizedHomozygosity(g: Genome): number {
  let same = 0;
  const n = g.autosomal[0].length;
  for (let i = 0; i < n; i++) if (g.autosomal[0][i] === g.autosomal[1][i]) same++;
  return n === 0 ? 0 : same / n;
}

/** Homozygous deleterious alleles, expressed. The founder's own curses. */
export function deleteriousLoad(g: Genome, table: LocusTable): { count: number; names: string[] } {
  const names: string[] = [];
  for (let i = 0; i < table.autosomal.length; i++) {
    if (table.autosomal[i]!.kind !== 'deleterious') continue;
    const a = g.autosomal[0][i]!;
    const b = g.autosomal[1][i]!;
    if (a !== b) continue;
    const allele = table.autosomalAlleles[i]![a];
    if (allele?.tags.includes('deleterious') || allele?.tags.includes('lethal_homozygous')) {
      names.push(allele.name ?? allele.id);
    }
  }
  return { count: names.length, names };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
