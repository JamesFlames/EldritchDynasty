import type { Gamete, GenePool, Genome, MutationRecord, Sex } from '@ed/schema';
import type { Rng } from '../rng.js';
import { drawAllele, type LocusTable } from './loci.js';

const CM_PER_CROSSOVER = 100;
const MUTATION_RATE = 0.0004;
/** Font loci mutate up more often than down: "rare upward mutation in progeny". */
const FONT_UPWARD_BIAS = 0.75;

/**
 * Build a gamete. Per chromosome: draw a crossover count from a Poisson over
 * the map length, place crossovers uniformly in cM space, then walk the loci
 * emitting from alternating haplotypes.
 *
 * Linkage is not decoration. It means nearby loci travel together, so a strong
 * font allele placed next to a deleterious recessive produces a haplotype that
 * is a genuine bargain — the blessing arrives chained to the curse, and
 * separating them needs a specific crossover a family may wait generations for.
 */
export function meiosis(g: Genome, table: LocusTable, sex: Sex, rng: Rng, year: number): Gamete {
  const mutations: MutationRecord[] = [];
  const autosomal = recombine(g.autosomal[0], g.autosomal[1], table.autosomal, rng);

  let x: Int16Array | null;
  if (sex === 'female') {
    // Her two X's recombine. A daughter's X is a mosaic of her mother's pair.
    x = recombine(g.sex[0], g.sex[1] ?? g.sex[0], table.x, rng);
  } else {
    // A man gives either his single X (-> daughter) or a Y (-> son).
    // Consequence: a son's font comes ONLY from his mother, and a father
    // passes his single X INTACT to every daughter. Both are real biology and
    // both are the reason cousin marriage is the mechanism, not a mechanism.
    x = rng.bool(0.5) ? Int16Array.from(g.sex[0]) : null;
  }

  mutate(autosomal, table, 'autosomal', rng, year, mutations);
  if (x) mutate(x, table, 'x', rng, year, mutations);

  return { autosomal, x, mutations };
}

function recombine(a: Int16Array, b: Int16Array, loci: { chromosome: unknown; position: number }[], rng: Rng): Int16Array {
  const out = new Int16Array(a.length);
  if (a.length === 0) return out;

  // Group by chromosome so crossovers do not leak across them.
  let start = 0;
  while (start < loci.length) {
    let end = start;
    const chrom = loci[start]!.chromosome;
    while (end < loci.length && loci[end]!.chromosome === chrom) end++;

    const span = loci[end - 1]!.position - loci[start]!.position;
    const nCross = rng.poisson(Math.max(0.5, span / CM_PER_CROSSOVER));
    const points: number[] = [];
    for (let i = 0; i < nCross; i++) points.push(rng.range(loci[start]!.position, loci[end - 1]!.position));
    points.sort((x, y) => x - y);

    let current = rng.bool(0.5) ? 0 : 1;
    let nextPoint = 0;
    for (let i = start; i < end; i++) {
      while (nextPoint < points.length && loci[i]!.position >= points[nextPoint]!) {
        current ^= 1;
        nextPoint++;
      }
      out[i] = current === 0 ? a[i]! : b[i]!;
    }
    start = end;
  }
  return out;
}

function mutate(
  hap: Int16Array,
  table: LocusTable,
  where: 'autosomal' | 'x',
  rng: Rng,
  year: number,
  sink: MutationRecord[],
): void {
  const loci = where === 'autosomal' ? table.autosomal : table.x;
  const alleles = where === 'autosomal' ? table.autosomalAlleles : table.xAlleles;
  for (let i = 0; i < hap.length; i++) {
    const locus = loci[i]!;
    const isFont = locus.kind === 'eldritch_font';
    const rate = isFont ? MUTATION_RATE * 3 : MUTATION_RATE;
    if (!rng.bool(rate)) continue;

    const pool = alleles[i]!;
    const currentEffect = pool[hap[i]!]?.effect ?? 0;
    let candidates = pool.map((a, idx) => ({ a, idx }));
    if (isFont) {
      const up = candidates.filter((c) => c.a.effect > currentEffect);
      const down = candidates.filter((c) => c.a.effect < currentEffect);
      const useUp = up.length > 0 && (down.length === 0 || rng.bool(FONT_UPWARD_BIAS));
      candidates = useUp ? up : (down.length ? down : candidates);
    }
    if (!candidates.length) continue;
    const chosen = rng.pick(candidates);
    sink.push({
      locus: locus.id as unknown as string,
      from: (pool[hap[i]!]?.id as unknown as string) ?? '?',
      to: chosen.a.id as unknown as string,
      year,
    });
    hap[i] = chosen.idx;
  }
}

/** Fertilise. The father's gamete decides the child's sex. */
export function conceive(
  motherGamete: Gamete,
  fatherGamete: Gamete,
  table: LocusTable,
): { genome: Genome; sex: Sex } {
  const sex: Sex = fatherGamete.x === null ? 'male' : 'female';
  const genome: Genome = {
    autosomal: [motherGamete.autosomal, fatherGamete.autosomal],
    sex: sex === 'female'
      ? [motherGamete.x!, fatherGamete.x!]
      : [motherGamete.x!, null],
    // Something new entered the blood. It belongs to the child, not the parent,
    // and the chronicle should be able to say which child it was.
    mutations: [...motherGamete.mutations, ...fatherGamete.mutations],
  };
  void table;
  return { genome, sex };
}

/** Roll a fresh genome for an outsider from a house's allele pool. */
export function randomGenome(table: LocusTable, pool: GenePool | undefined, sex: Sex, rng: Rng): Genome {
  const auto0 = new Int16Array(table.autosomal.length);
  const auto1 = new Int16Array(table.autosomal.length);
  for (let i = 0; i < table.autosomal.length; i++) {
    auto0[i] = drawAllele(table.autosomalAlleles[i]!, table.autosomal[i]!, pool, rng);
    auto1[i] = drawAllele(table.autosomalAlleles[i]!, table.autosomal[i]!, pool, rng);
  }
  const x0 = new Int16Array(table.x.length);
  for (let i = 0; i < table.x.length; i++) {
    x0[i] = drawAllele(table.xAlleles[i]!, table.x[i]!, pool, rng);
  }
  let x1: Int16Array | null = null;
  if (sex === 'female') {
    x1 = new Int16Array(table.x.length);
    for (let i = 0; i < table.x.length; i++) {
      x1[i] = drawAllele(table.xAlleles[i]!, table.x[i]!, pool, rng);
    }
  }
  return { autosomal: [auto0, auto1], sex: [x0, x1], mutations: [] };
}
