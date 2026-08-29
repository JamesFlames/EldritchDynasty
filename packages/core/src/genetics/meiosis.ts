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
    // Her two X's recombine. A daughter's X is a mosaic of her mother's pair —
    // but not a fair one. See `driveToward`.
    x = recombine(g.sex[0], g.sex[1] ?? g.sex[0], table.x, rng, driveToward(g, table));
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

/**
 * MEIOTIC DRIVE, AND WHY THE X HAS ONE (issue #41).
 *
 * A son's font comes only from his mother, and on a fair coin a mother with
 * one hot X and one cold one hands over an even mosaic of the two. Measured
 * over three thousand-year runs before this existed: the founding haplotype
 * halves every generation, the deepest blood in the house falls from 31 to 4
 * inside four generations, and from there the family is carried by mutation
 * rather than by inheritance. Every strategy the game offers — the Match, the
 * standing order, withholding a daughter — was measured against that decay and
 * none of them touched it, because none of them can: they choose WHO marries,
 * and the loss happens inside the meiosis afterwards.
 *
 * So the blood is not transmitted fairly. The haplotype carrying more font is
 * the one a female meiosis is likelier to start from, at the rate the font
 * loci themselves declare (`LocusDef.drive`). It is invisible, it is never
 * certain, and it changes nothing about whether a given X does anything —
 * which is what keeps invariant 4 intact: a gift that is likelier to be handed
 * on is not a gift that can be scheduled.
 *
 * Returned as a probability that the walk starts on haplotype 0, so a locus
 * table with no drive authored anywhere returns exactly 0.5 and the whole
 * mechanism is a fair coin again.
 */
function driveToward(g: Genome, table: LocusTable): number {
  let drive = 0.5;
  let a = 0;
  let b = 0;
  for (const i of table.fontIndices) {
    drive = Math.max(drive, table.x[i]?.drive ?? 0.5);
    const alleles = table.xAlleles[i]!;
    a += alleles[g.sex[0][i]!]?.effect ?? 0;
    b += g.sex[1] ? (alleles[g.sex[1][i]!]?.effect ?? 0) : 0;
  }
  if (drive === 0.5 || a === b) return 0.5;
  return a > b ? drive : 1 - drive;
}

function recombine(
  a: Int16Array,
  b: Int16Array,
  loci: { chromosome: unknown; position: number }[],
  rng: Rng,
  startOnFirst = 0.5,
): Int16Array {
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

    let current = rng.bool(startOnFirst) ? 0 : 1;
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
      locus: locus.id,
      from: (pool[hap[i]!]?.id) ?? '?',
      to: chosen.a.id,
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
/**
 * NUDGE A ROLLED GENOME TOWARD AN AUTHORED INTENT, without pinning it.
 *
 * `strength` is the chance per contributing locus that the best allele for
 * that attribute is placed — 0.9 is "formidable and everyone knows it", 0.4
 * is "she takes after her mother". Negative strength reaches for the worst
 * allele instead, which is how a template says "thin blood" without saying a
 * number.
 *
 * It lived in `sim.ts` and applied to the founding cast alone, so every
 * `bias` block on a CHARACTER TEMPLATE — the scholar's daughter's mind, the
 * Marrow girl's death affinity, the rival's charm — was authored, validated,
 * saved, and read by nothing. Four templates advertised a person the world
 * then rolled at random. That matters more now than it did: the Match puts
 * those templates in front of the player as cards, and a card that promises
 * a scholar's daughter has to deal one.
 */
export function applyBias(
  genome: Genome,
  bias: Record<string, number>,
  table: LocusTable,
  rng: Rng,
): void {
  for (const [attrKey, strength] of Object.entries(bias)) {
    for (const c of table.byAttribute.get(attrKey) ?? []) {
      if (!rng.bool(Math.min(0.95, Math.abs(strength)))) continue;
      const alleles = c.where === 'autosomal' ? table.autosomalAlleles[c.index]! : table.xAlleles[c.index]!;
      const best = alleles
        .map((a, i) => ({ a, i }))
        .sort((x, y) => (strength >= 0 ? y.a.effect - x.a.effect : x.a.effect - y.a.effect))[0];
      if (!best) continue;
      if (c.where === 'autosomal') genome.autosomal[rng.int(2)]![c.index] = best.i;
      else genome.sex[0][c.index] = best.i;
    }
  }
}

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
