import type { AttributeDef, EldritchProfile, Genome, LocusDef, Sex } from '@ed/schema';
import type { LocusTable } from './loci.js';

export const OVERFLOW_RATE = 0.85;

/**
 * Fertility option B (issue #26), prototyped behind a single constant rather
 * than shipped: `fecundity_drag` loci (linked to font on the X, see
 * `gen-loci.mjs`) are authored at full strength, and this is the dial that
 * decides how much of that strength actually reaches the `fecundity`
 * attribute. Zero means the loci are drawn, inherited and recombined like
 * any other locus — the harness and the editor can already show them — but
 * contribute NOTHING to a body's fertility, which is what "prototyped
 * behind a constant defaulted to zero" means: inert until a human decides
 * otherwise, not a flag that disables a feature.
 *
 * A genuine constant, not a runtime setting — INVARIANT 8 rules out
 * module-scope mutable state, and a coupling strength that could drift
 * between simulations in the same process is exactly the bug that
 * invariant exists to prevent. Turning it up is a harness decision made by
 * editing this line and re-running batches, watching for the death spiral
 * (issue #26's own gate) before ever shipping it past zero.
 * `dragFecundityContribution` below is the testable seam: it takes an
 * explicit coupling rather than reading this constant, so a test can prove
 * the MECHANISM works at a nonzero value without the simulation itself
 * ever running at anything but the shipped default.
 */
export const FECUNDITY_DRAG_COUPLING = 0;

function couplingFor(kind: LocusDef['kind']): number {
  return kind === 'fecundity_drag' ? FECUNDITY_DRAG_COUPLING : 1;
}

/**
 * The fecundity contribution from `fecundity_drag` loci alone, at an
 * arbitrary coupling strength. Never called by `expressAttributes` or the
 * simulation — this exists so issue #26's mechanism (does a font-heavy X
 * measurably drag fecundity down once the constant is nonzero) is testable
 * in isolation, without touching `FECUNDITY_DRAG_COUPLING` itself.
 */
export function dragFecundityContribution(g: Genome, table: LocusTable, coupling: number): number {
  let raw = 0;
  for (const c of table.byAttribute.get('fecundity') ?? []) {
    if (c.locus.kind !== 'fecundity_drag') continue;
    const alleles = table.xAlleles[c.index]!;
    const a = alleles[g.sex[0][c.index]!]?.effect ?? 0;
    const b = g.sex[1] ? (alleles[g.sex[1][c.index]!]?.effect ?? 0) : null;
    raw += expressLocus(a, b, c.locus.dominance) * c.weight * coupling;
  }
  return raw;
}

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
// INVARIANT 4: Eldritch Power. THE canExpress gate is computed here and nowhere else.
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

/**
 * BLOOD THAT ENTERS THE MAN AND NOT THE LINE (concept §22, issue #43).
 *
 * The acquired key the Vessel rite writes. It is deliberately not a locus and
 * deliberately not part of the genome: §22's rule for the whole rite is that
 * *"what the ascendant gains, he cannot pass on — his own children inherit
 * exactly what they would have inherited had the rite never happened"*, which
 * is the only thing standing between the ladder and a family that ascends by
 * consuming its way upward. `conceiveChild` reads the GENOME and nothing else,
 * so blood held in the acquired layer is unheritable by construction rather
 * than by a rule somebody has to remember.
 */
export const ELDRITCH_GIFT = 'eldritch_gift';

/**
 * THE ROOM THE GREAT RITE MAKES (concept §22, issue #43).
 *
 * The second acquired key, and the one that moves the wall rather than what is
 * behind it. `MADNESS_OVERFLOW_YEARS` in `factory.ts` states the wall exactly:
 *
 *   > Madness from the blood is `font - ceiling` and power is
 *   > `min(font, ceiling)`, so the man who has fifty of the one has none of
 *   > the other by construction.
 *
 * That sentence is why the top of the ladder was empty. Measured over twelve
 * played runs, power 85 with three books is ZERO person-years — not rare,
 * none — because §22's top rungs ask one man for more expressed power than any
 * channel in the game can pass, and every extra drop of font he is bred or
 * given lands on the Madness side of the same subtraction.
 *
 * The Great Rite is what widens the channel. Not the font — the *container*.
 * A man who is being destroyed by blood he cannot hold becomes a man who can
 * hold it, and the same quantity that was ruining him is what he then wields.
 *
 * Kept in the acquired layer beside the gift, and for the same reason: §22's
 * rule is that what the ascendant gains he cannot pass on. `conceiveChild`
 * reads the GENOME, and the channel loci in it are untouched here, so a
 * widened man fathers ordinary sons — which is the only thing standing between
 * this and a family that ascends once and stays ascended for six centuries.
 */
export const ELDRITCH_REACH = 'eldritch_reach';

/**
 * The same profile, with a Vessel's blood in it and the room a Great Rite made.
 *
 * `carriedFont` is left alone on purpose — it is what his body carries and
 * therefore what the marriage market prices and what a mother's meiosis draws
 * from. What the rite moves is what he can WIELD, and only as far as his own
 * channel allows: blood past the ceiling is not power, it is Madness, which is
 * §22's whole account of why consuming the most gifted relative in the family
 * is the strongest play and the worst idea.
 *
 * `reach` is the one thing that moves that ceiling, and it is why the two
 * rites compose into a decision rather than stacking into a number. The Vessel
 * hands a man more than he can hold and the excess is pure ruin; the Great
 * Rite turns the ruin he took on into the power he took it on for. Taken in
 * the other order it buys an empty room.
 *
 * The widened ceiling is RETURNED rather than applied privately, because
 * `standingOf`, `succession.ts` and the client all read `ceiling` to say what
 * a man can bear — and a ceiling that is true in one place and stale in
 * another is the invariant 6 failure this codebase keeps finding.
 *
 * INVARIANT 1 and 4: neither key can make an expresser. `canExpress` is
 * computed from the genome above and is not touched here, so a woman or a
 * mundane son handed the whole blood of the house still expresses nothing,
 * still cannot go mad, and gains nothing from any room made for him.
 */
export function withGift(base: EldritchProfile, gift: number, reach = 0): EldritchProfile {
  if (!base.canExpress) return base;
  if (gift <= 0 && reach <= 0) return base;
  const held = base.carriedFont + Math.max(0, gift);
  const ceiling = base.ceiling + Math.max(0, reach);
  return {
    ...base,
    ceiling,
    expressedPower: Math.min(held, ceiling),
    overflowMadness: Math.max(0, held - ceiling) * OVERFLOW_RATE,
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
      raw += expressLocus(a, b, c.locus.dominance) * c.weight * couplingFor(c.locus.kind);
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
export function expectedAttribute(
  table: LocusTable,
  attr: string,
  /**
   * The range a real body is clamped to. Optional only so the tools that ask
   * about a locus table alone still can; every caller inside the simulation
   * passes it, because without it this returns a number nobody can be.
   */
  range?: { min: number; max: number },
): number {
  // The per-locus distribution first: value -> probability, exact over the
  // allele pair, which is cheap because loci carry two to four alleles.
  const perLocus: Map<number, number>[] = [];
  for (const c of table.byAttribute.get(attr) ?? []) {
    const alleles = c.where === 'autosomal' ? table.autosomalAlleles[c.index]! : table.xAlleles[c.index]!;
    const mass = alleles.reduce((s, a) => s + a.p, 0) || 1;
    const scale = c.weight * couplingFor(c.locus.kind);

    const dist = new Map<number, number>();
    for (const a of alleles) {
      for (const b of alleles) {
        const d = a.dominanceOverride ?? c.locus.dominance;
        const v = expressLocus(a.effect, b.effect, d) * scale;
        const key = Math.round(v * 1e6) / 1e6;
        dist.set(key, (dist.get(key) ?? 0) + (a.p / mass) * (b.p / mass));
      }
    }
    perLocus.push(dist);
  }

  const unclamped = perLocus.reduce(
    (sum, d) => sum + [...d].reduce((s, [v, p]) => s + v * p, 0),
    0,
  );
  if (!range) return unclamped;

  // THE CLAMP IS PART OF THE DISTRIBUTION (invariant 10, issue #26).
  //
  // `expressAttributes` clamps every body to the authored range, and this used
  // to compute the mean as though it never did. While the distribution sits
  // inside its range the two agree and everything that reads "how far above
  // average is this person" works. Push it onto a bound — one strong one-sided
  // group of loci is enough — and they come apart silently: the centre keeps
  // falling, the bodies stop, and every family in the game reads as ABOVE
  // average.
  //
  // That is not hypothetical. `gate:drag` reached coupling 4 with the computed
  // fecundity centre at -18 while 63% of mothers sat on a floor of zero, and
  // the measured effect was BIRTHS RISING with the strength of a locus group
  // named "drag". A cap is not an effect, and neither is a floor: what matters
  // is whether it binds, and here it bound for two thirds of the population.
  //
  // So the mean is taken over the CLAMPED distribution, convolved exactly.
  // Exactly rather than by clamping the expectation, because those are
  // different numbers whenever mass piles against a bound — which is precisely
  // the case this exists for.
  let dist = new Map<number, number>([[0, 1]]);
  for (const locus of perLocus) {
    const next = new Map<number, number>();
    for (const [v, p] of dist) {
      for (const [dv, dp] of locus) {
        const key = Math.round((v + dv) * 1e6) / 1e6;
        next.set(key, (next.get(key) ?? 0) + p * dp);
      }
    }
    // A guard rather than a promise. Six loci of three or four alleles keep
    // this in the thousands; an attribute authored with many more could grow
    // it without bound, and a bootstrap that hangs is worse than a centre that
    // is merely bounded rather than exact.
    if (next.size > CONVOLUTION_CAP) {
      return clamp(unclamped, range.min, range.max);
    }
    dist = next;
  }

  let mean = 0;
  for (const [v, p] of dist) mean += clamp(v, range.min, range.max) * p;
  return mean;
}

/** Distinct sums past which the convolution falls back to a bounded estimate. */
const CONVOLUTION_CAP = 200_000;

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
