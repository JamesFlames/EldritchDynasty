/**
 * THE DEATH-SPIRAL GATE for fertility option B (issue #26).
 *
 *   npm run gate:drag -- [runs] [years] [coupling ...] [--phased]
 *   npm run gate:drag -- 200 1000 0 0.5 1 2 4
 *
 * Issue #26 ships `FECUNDITY_DRAG_COUPLING` at zero and names the condition
 * for ever moving it: "turn the constant up in the harness, in batches of two
 * hundred runs, and look for the death spiral before anyone plays it. If a
 * house that concentrates its blood cannot reach 2042 more than half the
 * time, the constant is wrong — not the idea." This file is that batch.
 *
 * HOW IT REACHES A NONZERO COUPLING WITHOUT A DIAL.
 * `FECUNDITY_DRAG_COUPLING` is a `const` on purpose (INVARIANT 8: no
 * module-scope mutable state a second simulation in the same process could
 * see differently), so a sweep cannot turn it up — and an env var read at
 * import time would be worse, because then a saved game would replay
 * differently on a machine whose shell disagreed.
 *
 * So the sweep does not touch the constant at all. It builds a synthetic
 * CONTENT bundle per coupling: every `fecundity_drag` locus is relabelled
 * `additive` — the kind `couplingFor` multiplies by one — and its authored
 * weight is multiplied by k instead. Nothing else about the locus moves:
 * same id, same X, same position, same dominance, same alleles, same
 * frequencies. `drawAllele` and `meiosis` special-case neither kind, so the
 * genome layout and the whole RNG cascade are identical to the shipped run;
 * the only difference reaching the simulation is the number
 * `expressAttributes` multiplies by. That makes k a per-world property of
 * content rather than a global, which is what the invariant actually asks for.
 *
 * `fecundity-drag.slow.test.ts` pins the fidelity claim: the k=0 bundle this
 * file builds must produce a bit-identical run to the shipped content.
 *
 * WHAT IT MEASURES, and why each column is here.
 *  - survive: the gate's own pass/fail line.
 *  - squeeze: children borne by high-font women against low-font women. A
 *    coupling that does not separate those two columns has not implemented
 *    the design, whatever it does to the loci.
 *  - font 1st/last: carried font of the house's first daughters against its
 *    last. The death spiral is not only extinction — a house that reaches
 *    2042 having quietly bred its font away has lost a slower way, and the
 *    survival column cannot see it.
 *  - centre, floored: the two diagnostics the first batch turned out to
 *    need. `centre` is `expectedAttribute('fecundity')`, the theoretical
 *    mean `completedFertility` measures every couple against; `floored` is
 *    the share of real mothers sitting on the attribute's own zero. When
 *    those two disagree — a negative centre and a floored population — every
 *    family in the game reads as ABOVE average and the drag hands out
 *    children instead of taking them.
 */
import { indexContent, type Content, type ContentBundle, type LocusDef } from '@ed/schema';
import { loadBundle } from '@ed/content';
import { bootstrap, runYears } from '../sim.js';
import type { SimCtx } from '../world.js';
import { attr, genomeOf, phenotypeOf } from '../people/factory.js';
import { expectedAttribute } from '../genetics/expression.js';
import { buildLocusTable } from '../genetics/loci.js';

/** The sweep's whole mechanism: option B's loci, re-weighted by k. */
export function coupledBundle(bundle: ContentBundle, coupling: number): ContentBundle {
  const loci: LocusDef[] = bundle.loci.map((l) => {
    if (l.kind !== 'fecundity_drag') return l;
    return {
      ...l,
      kind: 'additive' as const,
      contributes: l.contributes.map((c) => ({ ...c, weight: c.weight * coupling })),
    };
  });
  return { ...bundle, loci };
}

/**
 * PHASE THE FOUNDERS — the variant the first batch proved this gate needs.
 *
 * Issue #26 reasons that putting the drag loci on the X, linked to the font,
 * makes "a daughter who carries deep font tend to carry low fecundity."
 * Linkage does not do that. Linkage PRESERVES a pairing; it cannot create
 * one, and the pairing the founders were rolled with is random — measured at
 * r = -0.07 between carried font and drag load, which is nothing. Sharing a
 * chromosome makes two loci travel together; it says nothing about which
 * alleles set out together in the first place.
 *
 * So this is the same experiment with the missing premise supplied: on every
 * founding genome of the player's house, each drag locus is set to match the
 * font locus it is paired with, on the SAME haplotype — a hot X carries the
 * drag, a cold X does not. From there the simulation is untouched: meiosis
 * splits the pair at whatever rate the authored centiMorgans allow, and the
 * jackpot the issue describes (deep font, split loose from the drag) is a
 * thing recombination has to hand you rather than a thing set up in advance.
 *
 * It is deliberately a property of THIS TOOL and not of `bootstrap`. Shipping
 * it would mean authoring the founder's haplotypes in content, which is a
 * design decision the gate exists to inform, not one it should pre-empt.
 */
export function phaseFounders(ctx: SimCtx, bundle: ContentBundle): void {
  const table = ctx.genetics.table;
  const pairs: { drag: number; font: number }[] = [];
  // Matched by id rather than by kind: the sweep's own bundle has relabelled
  // these loci `additive`, and the pristine one has not. The pairing is the
  // same either way.
  for (const l of bundle.loci) {
    if (!l.id.startsWith('fecundity_drag_')) continue;
    const n = l.id.replace('fecundity_drag_', '');
    const drag = table.xIndex.get(l.id);
    const font = table.xIndex.get(`font_${n}`);
    if (drag !== undefined && font !== undefined) pairs.push({ drag, font });
  }

  for (const p of ctx.world.people.blood(ctx.world.playerHouse)) {
    const g = genomeOf(p, ctx.genetics);
    for (const { drag, font } of pairs) {
      const fontAlleles = table.xAlleles[font]!;
      const dragAlleles = table.xAlleles[drag]!;
      const strong = dragAlleles.reduce(
        (best: number, a, i) => (a.effect > (dragAlleles[best]?.effect ?? -Infinity) ? i : best),
        0,
      );
      const none = dragAlleles.findIndex((a) => a.tags.includes('null'));
      for (const hap of [g.sex[0], g.sex[1]]) {
        if (!hap) continue;
        const carries = (fontAlleles[hap[font]!]?.effect ?? 0) > 0;
        hap[drag] = carries ? strong : (none >= 0 ? none : 0);
      }
    }
    if (p.phenotype) p.phenotype.dirty = true;
  }
}

interface DragRun {
  seed: number;
  survived: boolean;
  living: number;
  births: number;
  generations: number;
  /** Carried font of the house's first and last cohorts of blood women. */
  fontEarly: number;
  fontLate: number;
  /** Completed families, split by the mother's own carried font. */
  hotMothers: number;
  hotChildren: number;
  coldMothers: number;
  coldChildren: number;
  /** Mothers sitting on the fecundity attribute's own floor of zero. */
  mothers: number;
  floored: number;
}

const COMPLETED_AT = 45;

function runOnce(
  content: Content,
  seed: number,
  years: number,
  startYear: number,
  phase: ContentBundle | undefined,
): DragRun {
  const ctx = bootstrap(content, seed, startYear);
  if (phase) phaseFounders(ctx, phase);
  runYears(ctx, years);
  const w = ctx.world;

  // Every woman of the blood whose childbearing is over, with what she
  // carried and what she bore. Women who died young are excluded on both
  // sides: they measure mortality, not fertility.
  const mothers: { font: number; children: number; born: number; fecundity: number }[] = [];
  let births = 0;
  for (const p of w.people.blood(w.playerHouse)) {
    if (p.born > startYear) births += 1;
    if (p.sex !== 'female') continue;
    const end = p.died ?? w.year;
    if (end - p.born < COMPLETED_AT) continue;
    mothers.push({
      font: phenotypeOf(p, ctx.genetics, w.year).eldritch.carriedFont,
      children: w.people.children(p.id).length,
      born: p.born,
      fecundity: attr(p, 'fecundity', ctx.genetics, w.year),
    });
  }

  // The squeeze, as the marriage market would feel it: the top third of the
  // house's women by carried font against the bottom third. A median split
  // hides the effect the design is actually about, which lives at the ends.
  const byFont = [...mothers].sort((a, b) => a.font - b.font);
  const third = Math.floor(byFont.length / 3);
  const cold = byFont.slice(0, third);
  const hot = byFont.slice(byFont.length - third);

  // The trajectory: the first and last quarter of the house's daughters by
  // birth year. Erosion shows up here long before it shows up in extinction.
  const byBirth = [...mothers].sort((a, b) => a.born - b.born);
  const quarter = Math.max(1, Math.floor(byBirth.length / 4));
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  return {
    seed,
    survived: w.people.household(w.playerHouse, w.year).length > 0,
    living: w.people.living().length,
    births,
    generations: w.generation,
    fontEarly: mean(byBirth.slice(0, quarter).map((m) => m.font)),
    fontLate: mean(byBirth.slice(byBirth.length - quarter).map((m) => m.font)),
    hotMothers: hot.length,
    hotChildren: hot.reduce((a, m) => a + m.children, 0),
    coldMothers: cold.length,
    coldChildren: cold.reduce((a, m) => a + m.children, 0),
    mothers: mothers.length,
    floored: mothers.filter((m) => m.fecundity <= 0).length,
  };
}

export function sweep(
  runs: number,
  years: number,
  couplings: number[],
  opts: { startYear?: number; phased?: boolean } = {},
): void {
  const startYear = opts.startYear ?? 1042;
  const bundle = loadBundle();
  const drag = bundle.loci.filter((l) => l.kind === 'fecundity_drag');
  console.log(`fecundity drag: ${drag.length} loci, authored weight `
    + `${drag[0]?.contributes[0]?.weight ?? 0}/locus`
    + `${opts.phased ? ', PHASED onto the founders\' font haplotypes' : ', as authored (founder phase random)'}`);
  console.log(`${runs} runs x ${years} years per coupling; seeds ${startYear === 1042 ? '1000, 1007, ...' : 'as given'}\n`);

  const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)]! : 0;
  };

  const head = ['coupling', 'survive', 'living', 'births', 'gens', 'kids/hot', 'kids/cold',
    'squeeze', 'font 1st', 'font last', 'centre', 'floored'];
  console.log(head.map((h, i) => (i ? h.padStart(10) : h.padEnd(10))).join(''));

  for (const k of couplings) {
    const coupled = coupledBundle(bundle, k);
    const content = indexContent(coupled);
    const all: DragRun[] = [];
    for (let i = 0; i < runs; i++) {
      all.push(runOnce(content, 1000 + i * 7, years, startYear, opts.phased ? bundle : undefined));
    }

    const survived = all.filter((r) => r.survived).length;
    const sum = (f: (r: DragRun) => number) => all.reduce((a, r) => a + f(r), 0);
    const hotKids = sum((r) => r.hotChildren) / Math.max(1, sum((r) => r.hotMothers));
    const coldKids = sum((r) => r.coldChildren) / Math.max(1, sum((r) => r.coldMothers));
    const centre = expectedAttribute(buildLocusTable(coupled.loci), 'fecundity');

    const cells = [
      round(k).toString().padEnd(10),
      `${Math.round((100 * survived) / all.length)}%`.padStart(10),
      round(mean(all.map((r) => r.living)), 1).toString().padStart(10),
      round(mean(all.map((r) => r.births)), 1).toString().padStart(10),
      round(median(all.map((r) => r.generations)), 1).toString().padStart(10),
      round(hotKids).toString().padStart(10),
      round(coldKids).toString().padStart(10),
      round(hotKids - coldKids).toString().padStart(10),
      round(mean(all.map((r) => r.fontEarly)), 1).toString().padStart(10),
      round(mean(all.map((r) => r.fontLate)), 1).toString().padStart(10),
      round(centre, 1).toString().padStart(10),
      `${Math.round((100 * sum((r) => r.floored)) / Math.max(1, sum((r) => r.mothers)))}%`.padStart(10),
    ];
    console.log(cells.join(''));
  }

  console.log('\n  survive   the gate: a coupling under 50% is wrong, per issue #26.');
  console.log('  squeeze   children per completed mother, top third of the house by carried');
  console.log('            font minus the bottom third. Negative is the design working:');
  console.log('            the blood you concentrate is the blood that breeds least.');
  console.log('  font      carried font of the first quarter of the house\'s daughters');
  console.log('            against the last. Falling is the slow half of the spiral.');
  console.log('  centre    expectedAttribute(fecundity) — the mean completedFertility');
  console.log('            measures a couple against. floored: mothers on the attribute\'s');
  console.log('            own zero. A negative centre with a floored population means');
  console.log('            every family reads as above average and the drag pays out.');
}

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('drag-gate.ts');
if (isMain) {
  const args = process.argv.slice(2);
  const phased = args.includes('--phased');
  const [runsArg, yearsArg, ...ks] = args.filter((a) => !a.startsWith('--'));
  sweep(
    Number(runsArg ?? 200),
    Number(yearsArg ?? 1000),
    ks.length ? ks.map(Number) : [0, 0.5, 1, 2, 4],
    { phased },
  );
}
