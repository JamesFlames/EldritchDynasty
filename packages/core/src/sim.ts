import type { ContentBundle, EventTemplate, GenePool, Person, SeedPerson } from '@ed/schema';
import { asId } from '@ed/schema';
import { buildLocusTable } from './genetics/loci.js';
import { randomGenome } from './genetics/meiosis.js';
import {
  accrueMadness, attr, conceiveChild, genomeOf, makePerson, phenotypeOf, rollAwakening,
  type GeneticsCtx,
} from './people/factory.js';
import { expectedAttribute } from './genetics/expression.js';
import { BASELINE_MAX_AGE, coupleFertility, MOTHER_SHARE } from './people/vitality.js';
import { createWorld, type SimCtx, type WorldState } from './world.js';
import { hashSeed, makeRng, type Rng } from './rng.js';
import { uniqueName } from './people/names.js';
import { ensureHead, maintainCast } from './people/succession.js';
import { mintForRole } from './people/minting.js';
import { branchOf, halls, settleBranches, softCapFor, tickBranches } from './people/branches.js';
import { tickRelationships } from './people/relationships.js';
import { releaseContracts } from './people/succession.js';
import { grantOpeningClause, tickAges } from './ages/scheduler.js';
import { selectEvents } from './events/selection.js';
import { pickOutcome, type ResolvedEvent } from './events/effects.js';
import { dueArcSteps, type ArcStep } from './events/arcs.js';
import { autoCast, type SlotFill } from './events/slots.js';
import {
  applyRecord, autoRecordOption, commitOutcome, queueChoice, queueRecord,
  type PendingDecision,
} from './events/decisions.js';
import { tickEconomy } from './economy.js';
import { MAIN_BRANCH } from '@ed/schema';

export function makeGeneticsCtx(bundle: ContentBundle, seed: number): GeneticsCtx {
  const pools = new Map<string, GenePool>();
  for (const h of bundle.houses) pools.set(h.id, h.genePool);
  const table = buildLocusTable(bundle.loci);
  return {
    table,
    attributes: bundle.attributes,
    traits: bundle.traits,
    pools,
    runSeed: seed,
    expected: new Map(
      bundle.attributes.map((a) => {
        const key = a.id as unknown as string;
        return [key, expectedAttribute(table, key)];
      }),
    ),
  };
}

export function bootstrap(bundle: ContentBundle, seed = 1042, startYear = 1042): SimCtx {
  const world = createWorld(bundle, seed, startYear);
  const genetics = makeGeneticsCtx(bundle, seed);
  const ctx: SimCtx = { world, bundle, genetics, takenNames: new Set() };

  const byKey = new Map<string, Person>();
  const ordered = orderSeeds(bundle.characters);

  for (const s of ordered) {
    const rng = makeRng(hashSeed(seed, 'seed-person', s.key));
    const pool = genetics.pools.get(s.house);
    const genome = randomGenome(genetics.table, pool, s.sex, rng);

    // `bias` nudges an authored intent without pinning the genome: the founder
    // is meant to be formidable, but the alleles are still rolled.
    applyBias(genome, s, genetics, rng);

    // Born of one house, living in another. A wife of House Ilm who has
    // married into The Eldritch House is a daughter of Ilm AND a member of the
    // Gearithy household, and the two facts are stored separately because they
    // are two different facts: one decides her genome, one decides who feeds her.
    const attached = s.household
      ?? (s.membership === 'blood' || s.membership === 'cadet' || s.membership === 'none'
        ? s.house
        : world.playerHouse);

    const p = makePerson({
      sex: s.sex,
      born: s.born,
      house: s.house,
      name: s.name,
      epithet: s.epithet,
      genome: { kind: 'materialized', genome },
      membership: s.membership,
      seed: hashSeed(seed, s.key),
      seq: world,
    });
    p.membership = [{ house: asId(attached), kind: s.membership, from: s.born }];
    p.castSlots = [...s.castSlots];
    if (s.isHead) p.castSlots.push('head');
    if (s.becomesGuardian) p.becomesGuardian = true;
    if (s.contract) p.contract = s.contract;
    for (const t of s.traits) p.traits.add(asId(t));
    if ((s.house !== world.playerHouse)) p.tier = 'hot';

    world.people.add(p);
    ctx.takenNames.add(p.name);
    byKey.set(s.key, p);
  }

  // Second pass: parentage and marriages, now that everyone exists.
  for (const s of ordered) {
    const p = byKey.get(s.key)!;
    if (s.motherKey) p.trueParents.mother = byKey.get(s.motherKey)?.id;
    if (s.fatherKey) p.trueParents.father = byKey.get(s.fatherKey)?.id;
    p.claimedParents = { ...p.trueParents };
  }
  autoMarry(ctx, makeRng(hashSeed(seed, 'bootstrap-marriages')));

  const founder = [...byKey.values()].find((p) => p.becomesGuardian);
  world.narrator = founder ? (founder.id as unknown as string) : undefined;

  // "The player begins knowing one" (concept §18).
  grantOpeningClause(ctx);

  world.chronicle.push({
    year: startYear,
    weight: 'illuminated',
    title: 'A Debt of Three Parts',
    text: `In the year 1042 ${founder?.name ?? 'the head of the house'} signed something, `
      + 'and the house has been paying for it ever since.',
    named: true,
  });

  return ctx;
}

function orderSeeds(seeds: SeedPerson[]): SeedPerson[] {
  const out: SeedPerson[] = [];
  const placed = new Set<string>();
  let remaining = [...seeds];
  let guard = 0;
  while (remaining.length && guard++ < 50) {
    const ready = remaining.filter(
      (s) => (!s.motherKey || placed.has(s.motherKey)) && (!s.fatherKey || placed.has(s.fatherKey)),
    );
    if (!ready.length) { out.push(...remaining); break; }
    for (const s of ready) { out.push(s); placed.add(s.key); }
    remaining = remaining.filter((s) => !placed.has(s.key));
  }
  return out;
}

function applyBias(genome: ReturnType<typeof randomGenome>, s: SeedPerson, ctx: GeneticsCtx, rng: Rng): void {
  for (const [attrKey, strength] of Object.entries(s.bias)) {
    const contribs = ctx.table.byAttribute.get(attrKey) ?? [];
    for (const c of contribs) {
      if (!rng.bool(Math.min(0.95, Math.abs(strength)))) continue;
      const alleles = c.where === 'autosomal' ? ctx.table.autosomalAlleles[c.index]! : ctx.table.xAlleles[c.index]!;
      const best = alleles
        .map((a, i) => ({ a, i }))
        .sort((x, y) => (strength >= 0 ? y.a.effect - x.a.effect : x.a.effect - y.a.effect))[0];
      if (!best) continue;
      if (c.where === 'autosomal') genome.autosomal[rng.int(2)]![c.index] = best.i;
      else genome.sex[0][c.index] = best.i;
    }
  }
}

export interface YearReport {
  year: number;
  births: Person[];
  deaths: Person[];
  awakenings: Person[];
  agesBegan: string[];
  agesEnded: string[];
  agesNamed: string[];
  resolved: ResolvedEvent[];
  /** Decisions raised this year: choices, missions, and Record blocks. */
  pending: PendingDecision[];
  /**
   * Set when the year did NOT turn because the docket was not empty. A silent
   * no-op is the failure mode this codebase actually has, so it is said out
   * loud rather than inferred from the year not changing.
   */
  blocked?: PendingDecision[];
  /** Cadet branches founded this year (concept §16). */
  branchesFounded: string[];
  /** Set on the single year the Narrator stops being a person. */
  guardianCrossed?: Person;
}

const EVENT_BUDGET_PER_YEAR = 0.35;

export function stepYear(ctx: SimCtx, autoResolve = true): YearReport {
  const w = ctx.world;

  // The docket blocks the clock. A choice answered three years after the event
  // is not a choice, so the year does not turn while one is standing open.
  if (w.pendingDecisions.length) {
    return {
      year: w.year,
      births: [], deaths: [], awakenings: [],
      agesBegan: [], agesEnded: [], agesNamed: [],
      resolved: [], pending: [], branchesFounded: [],
      blocked: [...w.pendingDecisions],
    };
  }

  w.year += 1;
  const rng = makeRng(hashSeed(w.seed, 'year', w.year));

  const report: YearReport = {
    year: w.year,
    births: [], deaths: [], awakenings: [],
    agesBegan: [], agesEnded: [], agesNamed: [],
    resolved: [], pending: [], branchesFounded: [],
  };

  // ── Ages ────────────────────────────────────────────────────────────────
  const ages = tickAges(ctx, rng);
  report.agesBegan = ages.began.map((a) => a.id);
  report.agesEnded = ages.ended.map((a) => a.id);
  report.agesNamed = ages.named.map((a) => a.id);
  for (const a of ages.named) {
    w.chronicle.push({ year: w.year, weight: 'page', title: a.name, text: a.blurb ?? `They began to call it ${a.name}.`, named: true });
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────
  for (const p of w.people.living()) {
    if (rollAwakening(p, w.year, ctx.genetics, rng)) report.awakenings.push(p);
    accrueMadness(p, ctx.genetics, w.year);
    if (rollDeath(p, ctx, rng)) report.deaths.push(p);
  }

  // The Narrator crossing over. Not a death — a change of state, and the one
  // moment in the run where the voice of the chronicle changes hands.
  if (!w.guardianSince) {
    const g = w.people.guardian();
    if (g) {
      w.guardianSince = w.year;
      report.guardianCrossed = g;
      w.chronicle.push({
        year: w.year,
        weight: 'illuminated',
        title: 'The House Does Not Empty',
        text: `They buried ${g.name} in the spring and the house did not feel emptier for it, `
          + 'which everyone noticed and nobody said. The fires were laid before anyone laid them. '
          + 'The accounts stayed balanced through a year in which nobody balanced them. '
          + 'He had not gone anywhere. He had only stopped being someone they had to feed.',
        named: true,
      });
    }
  }

  // ── Old quarrels, and who is left holding them ──────────────────────────
  tickRelationships(ctx);
  releaseContracts(ctx);

  // ── The year's takings ──────────────────────────────────────────────────
  tickEconomy(ctx);

  // ── Succession and the recurring cast ───────────────────────────────────
  // Without this the head, tutor and rival slots go vacant within a
  // generation and the event pool silently collapses to nothing.
  ensureHead(ctx, rng);
  if (w.year % 4 === 0) maintainCast(ctx, rng);

  // ── The house divides ───────────────────────────────────────────────────
  // Step six of the core loop: name an heir, and everyone else becomes a cadet
  // branch. It runs after succession because it is downstream of it — a son
  // leaves the year his brother takes the seal, and not before.
  report.branchesFounded = settleBranches(ctx).map((b) => b.id as unknown as string);
  tickBranches(ctx);

  // ── Marriage, then births ───────────────────────────────────────────────
  if (w.year % 3 === 0) autoMarry(ctx, rng);

  for (const { birth: b, branch, servants } of rollBirths(ctx, rng)) {
    if (!b.child) continue;

    // Born into the hall their mother lives in, not into the seat. This is
    // what makes a branch a lineage rather than a list of exiles.
    if (branch !== MAIN_BRANCH && b.child.membership[0]) b.child.membership[0].branch = branch;

    // A servant family. Two contracted parents make a child of the household
    // and NOT of the blood — otherwise the steward's grandchildren turn up in
    // the succession list, which is a much worse bug than the one this fixes.
    // The steward's own blurb says his contract is hereditary and that servant
    // dynasties need real lineage too; this is that lineage.
    if (servants && b.child.membership[0]) b.child.membership[0].kind = 'retainer';

    w.people.add(b.child);
    report.births.push(b.child);

    // Offer the naming to the player. The child already has a name, so the
    // offer can be ignored without anything downstream breaking.
    // The naming offer is about the bloodline. Nobody asks the Head to name
    // the steward's daughter.
    if (!servants && (b.child.houseOfOrigin as unknown as string) === w.playerHouse) {
      w.pendingNames.push({
        person: b.child.id as unknown as string,
        born: w.year,
        suggested: b.child.name,
        sex: b.child.sex,
      });
    }
  }

  // ── Arcs, then ambient events ───────────────────────────────────────────
  for (const step of dueArcSteps(ctx, rng)) {
    const event = ctx.bundle.events.find((e) => e.id === step.node.event)!;
    const body = step.absent && event.absentBody ? event.absentBody : event.body;
    present(ctx, { ...event, body }, step.fill, [], rng, report, autoResolve, step);
  }

  // Called every year, not only on years the ambient budget lands. Selection
  // returns forced candidates — arc follow-ups and scheduled events — before
  // it spends any budget, and skipping the call on the two years in three
  // where the budget is zero meant a follow-up scheduled for 1204 arrived in
  // 1207 whenever the dice said so.
  const budget = rng.next() < EVENT_BUDGET_PER_YEAR ? 1 : 0;
  for (const cand of selectEvents(ctx, rng, budget)) {
    present(ctx, cand.event, cand.fill, cand.playerCast, rng, report, autoResolve);
  }

  if (w.year % 25 === 0) w.generation += 1;
  return report;
}

/**
 * Put an event in front of whoever is deciding.
 *
 * Narration resolves on the spot — there is nothing to ask. A choice event
 * either goes on the docket or is answered by the chronicler, and the Record
 * block that follows it works the same way. One function, so the two modes
 * cannot drift apart: everything the player can decide, auto-resolve can
 * decide, and neither path is the special case.
 */
function present(
  ctx: SimCtx,
  e: EventTemplate,
  fill: SlotFill,
  playerCast: string[],
  rng: Rng,
  report: YearReport,
  autoResolve: boolean,
  arcStep?: ArcStep,
): void {
  if (e.interaction.kind === 'narration') {
    const outcome = pickOutcome(e.interaction.outcomes, rng);
    const cast = autoCast(e, ctx, fill, playerCast, rng);
    report.resolved.push(commitOutcome(ctx, e, outcome, cast, rng, arcStep));
    afterRecord(ctx, e, rng, report, autoResolve);
    return;
  }

  if (!autoResolve) {
    report.pending.push(queueChoice(ctx, e, e.body, fill, playerCast, arcStep));
    return;
  }

  const cast = autoCast(e, ctx, fill, playerCast, rng);
  const choice = rng.pick(e.interaction.choices);
  const outcome = pickOutcome(choice.outcomes, rng);
  report.resolved.push(commitOutcome(ctx, e, outcome, cast, rng, arcStep));
  afterRecord(ctx, e, rng, report, autoResolve);
}

function afterRecord(
  ctx: SimCtx,
  e: EventTemplate,
  rng: Rng,
  report: YearReport,
  autoResolve: boolean,
): void {
  if (!e.record) return;
  if (autoResolve) applyRecord(ctx, e, autoRecordOption(rng));
  else {
    const q = queueRecord(ctx, e);
    if (q) report.pending.push(q);
  }
}

export function runYears(ctx: SimCtx, n: number): YearReport[] {
  const out: YearReport[] = [];
  for (let i = 0; i < n; i++) out.push(stepYear(ctx));
  return out;
}

// ── Lifecycle helpers ─────────────────────────────────────────────────────

function rollDeath(p: Person, ctx: SimCtx, rng: Rng): boolean {
  const w = ctx.world;
  const age = w.year - p.born;
  const strength = attr(p, 'strength', ctx.genetics, w.year);

  // `Math.max(0, (age - 45) ** 2)` was the bug that emptied every house: the
  // square is ALWAYS positive, so the clamp did nothing and the curve ran
  // backwards — a one-year-old carried a 12% annual hazard and almost no child
  // reached seventeen. The clamp belongs INSIDE the square.
  //
  // Everything below reads age as a FRACTION of this body's own ceiling, so a
  // body built for a hundred and thirty starts dying later and on the same
  // shape. Without it, agelessness would buy a longer fertile life and not a
  // longer one.
  const maxAge = attr(p, 'max_age', ctx.genetics, w.year) || BASELINE_MAX_AGE;
  const spent = age / maxAge;

  // MAX AGE IS A CEILING, NOT A CENTRE. It was neither for a while: the curve
  // was merely scaled by it and nothing enforced it, so a man built for a
  // hundred and thirty-seven died at a hundred and forty-three and the number
  // was quietly an average. Nobody outlives their maximum.
  if (age >= maxAge) {
    return w.people.kill(p.id, w.year, 'of the years, all of them having been used');
  }

  // And the wall is approached rather than hit. Without the terminal term the
  // hazard at the ceiling is about 18% a year, so a fifth of every cohort
  // would piles up and die exactly ON their maxAge — the same cliff the
  // fertility curve was rewritten to avoid, in the other direction.
  let hazard = 0.004 + 0.6 * Math.max(0, spent - 0.45) ** 2;
  if (spent > 0.8) hazard += 0.5 * ((spent - 0.8) / 0.2) ** 3;

  // Deliberate infant mortality, tapering to nothing by five. Period-correct,
  // and it gives the midwife's presence effect something to actually suppress.
  if (age < 5) hazard += 0.03 * (1 - age / 5);

  hazard *= 1 - Math.min(0.5, strength / 220);

  // Madness overflow takes people. Only ever those who could express.
  const ph = phenotypeOf(p, ctx.genetics, w.year);
  const mind = attr(p, 'mind', ctx.genetics, w.year);
  if (ph.eldritch.canExpress && p.madness > mind) {
    hazard += Math.min(0.2, (p.madness - mind) / 260);
  }

  if (!rng.bool(hazard)) return false;

  // kill() returns false for the Narrator: his death is redirected, not
  // applied, so he never appears in the year's death list.
  return w.people.kill(p.id, w.year, p.madness > mind ? 'the blood, overflowing' : 'in the ordinary way');
}

/**
 * A house is not a population. Left alone, every adult marrying and breeding
 * for twenty-seven years doubles the household every generation and the tree
 * becomes unreadable by year 1200. Two brakes, both deterministic:
 *
 *   COMPLETED FERTILITY  each couple has a target number of children, derived
 *                        from their ids so it is stable across save/load.
 *   HOUSEHOLD PRESSURE   past a soft cap, births and marriages fall away. A
 *                        great house with sixty mouths and one seal is a house
 *                        with a succession problem, not a bigger house.
 *
 * Pressure is measured PER HALL, not per house. That is the whole demographic
 * consequence of cadet branches: the crowding brake used to be the only thing
 * standing between the family and forty people in one room, so it had to be
 * brutal, and the family stayed tiny for a thousand years as a result. Split
 * the roof and each hall has its own headroom — the house grows sideways,
 * which is how real ones did it.
 */
/**
 * COMPLETED FERTILITY, inherited.
 *
 * This was `2 + hash(seed, mother, father) % 4` — stable across save and load,
 * and inherited by nothing. Every marriage decision in the game was a bet on
 * WHAT a couple's children would be and never on HOW MANY, so a house that
 * married a famously fruitful line got precisely nothing for it, and the only
 * demographic dial we had was a constant the player could not see.
 *
 * Fecundity is now a heritable attribute, expressed from the genome like
 * Strength. Both parents count and the mother counts for far more.
 *
 * Three details worth keeping:
 *
 *   THE MOTHER CARRIES IT.  Seventy-thirty, not fifty-fifty. A man of a thin
 *   line is a mild disappointment; a woman of one is the whole marriage. This
 *   is what puts fertility into the same economy as the font — you are reading
 *   a bride's mother and her sisters for two different things at once — and it
 *   is why a daughter married outward costs the house twice.
 *
 *   CENTRED, NOT HARDCODED.  The mapping is relative to the attribute's
 *   population mean, computed from the locus table at bootstrap. Retune
 *   `LOCI_PER_CORE` and family sizes stay where they are instead of drifting.
 *
 *   STILL JITTERED.  A couple keeps a small id-derived wobble, so two
 *   brothers who married two sisters do not complete identical families.
 */
// Seventy-thirty lives in `people/vitality.ts` and is used twice: as a weight
// on the inherited cap here, and as an exponent on the pair's fertility there.
// One rule about whose fertility it mostly is, not two constants that drift.

/**
 * A CEILING IS NOT ENOUGH, which the first cut of this got wrong.
 *
 * Completed fertility is a cap on a couple's children, and measured over four
 * hundred years most couples never reach theirs — crowding, a husband dead at
 * fifty, and a 16% annual chance get there first. So making the cap heritable
 * changed almost nothing about who actually had children: the top third of
 * mothers by fecundity bore very slightly FEWER than the bottom third, which
 * is noise, which is the same as saying the attribute was decorative.
 *
 * Fecundity therefore drives the annual chance as well. That is also what the
 * word means: not how many you may have, but how readily they come.
 *
 * It drives it through FERTILITY now rather than directly — the same inherited
 * number, read through the body carrying it. See `people/vitality.ts`. The
 * constant below is what a REFERENCE couple gets: mean fecundity, sound health,
 * both at the peak of their curves. Everyone else is a fraction of it, and that
 * fraction is why this number is higher than the flat 0.16 it replaced without
 * the house being any larger — a curve averaging about seven tenths over a
 * fertile lifetime has to be paid for at the peak.
 *
 * TUNED AGAINST THE TREASURY, not the household. Twenty seeds to 2042: the
 * house lands at 66 living against 64 before the change, which is noise, and
 * the two numbers downstream of it are not. A house one child larger per
 * generation is a house that spends its surplus on kin upkeep, stops being able
 * to keep an archivist, and stops recovering the Ledger — 0.23 cost eight
 * points of staffed years and a clause per run, all of it invisible from the
 * demography. Anyone retuning this measures `years with staff` and `clauses
 * recovered`, not just how many Gearithys are standing in 2042.
 */
const CONCEPTION_PEAK = 0.22;

/**
 * The biological window, wide on purpose. What actually ends a woman's
 * childbearing is the curve going to zero at fifty, not this — a hard cutoff at
 * forty-four made thirteen percent of all births happen in the four years
 * before it and then none at all, which is a cliff no population has.
 */
const CHILDBEARING = { from: 15, to: 50 };

/** The couple's inherited fecundity, weighted toward the mother. */
function pairFecundity(mother: Person, father: Person, ctx: SimCtx): number {
  const y = ctx.world.year;
  return attr(mother, 'fecundity', ctx.genetics, y) * MOTHER_SHARE
    + attr(father, 'fecundity', ctx.genetics, y) * (1 - MOTHER_SHARE);
}

/**
 * The annual chance, from what the two bodies can do THIS year. Fertility is
 * fecundity read through age, sex and condition; `coupleFertility` combines the
 * pair multiplicatively, so either one of them being finished finishes both.
 */
function conceptionChance(mother: Person, father: Person, ctx: SimCtx): number {
  const y = ctx.world.year;
  return CONCEPTION_PEAK * coupleFertility(
    attr(mother, 'fertility', ctx.genetics, y),
    attr(father, 'fertility', ctx.genetics, y),
  );
}
/**
 * 3.1, not 3.5. The old hash produced a flat 2–5, and matching its MEAN
 * overshot the house by a sixth — `Math.round` sends every .5 upward, so a
 * symmetric jitter around 3.5 completes families of 3.67. Tuned instead
 * against the household at 600 years (~63 living, six halls), which is the
 * number that has to stay put: heritable fertility was meant to change what
 * family size MEANS, not how big the house is on the day it lands.
 */
const FERTILITY_BASE = 3.1;
/** Children per point of fecundity. One standard deviation ≈ one child. */
const FERTILITY_SLOPE = 0.09;
const FERTILITY_MAX = 9;

function completedFertility(pair: number, mother: Person, father: Person, ctx: SimCtx): number {
  const w = ctx.world;
  const centre = ctx.genetics.expected.get('fecundity') ?? 0;
  const jitter = (hashSeed(w.seed, 'fertility', String(mother.id), String(father.id)) % 3) / 2 - 0.5;
  const target = FERTILITY_BASE + (pair - centre) * FERTILITY_SLOPE + jitter;
  return Math.max(0, Math.min(FERTILITY_MAX, Math.round(target)));
}

function crowding(size: number, cap: number): number {
  if (size <= cap) return 1;
  return Math.max(0.05, 1 - (size - cap) / cap);
}

function rollBirths(ctx: SimCtx, rng: Rng) {
  const w = ctx.world;
  const results: { birth: ReturnType<typeof conceiveChild>; branch: string; servants: boolean }[] = [];

  for (const [branch, members] of halls(w, w.year)) {
    const pressure = crowding(members.length, softCapFor(branch));

    for (const mother of members) {
      if (mother.sex !== 'female') continue;
      const age = w.year - mother.born;
      if (age < CHILDBEARING.from || age > CHILDBEARING.to) continue;
      const marriage = mother.marriages.find((m) => !m.to);
      if (!marriage) continue;
      const father = w.people.get(marriage.spouse);
      if (!father || father.status !== 'alive') continue;

      const pair = pairFecundity(mother, father, ctx);
      const borne = w.people.children(mother.id).length;
      if (borne >= completedFertility(pair, mother, father, ctx)) continue;

      if (!rng.bool(conceptionChance(mother, father, ctx) * pressure)) continue;

      const ordinal = borne + 1;
      const household = w.people.householdOf(mother.id, w.year) ?? w.playerHouse;
      results.push({
        birth: conceiveChild(mother, father, ordinal, w.year, ctx.genetics, ctx.takenNames, household, w),
        branch,
        servants: Boolean(mother.contract && father.contract),
      });
    }
  }
  return results;
}

/**
 * PLACEHOLDER PAIRING. The shipped game replaces this entirely with the suitor
 * draft — draw one of three cards, each with blood, politics, a dowry and one
 * secret revealed later. What it must do here is grow a real pedigree so the
 * genetics has something to act on, and dilute the font when the house marries
 * outward, because that is the pressure the whole design turns on.
 */
function autoMarry(ctx: SimCtx, rng: Rng): void {
  const w = ctx.world;
  const eligible = (p: Person) =>
    p.status === 'alive'
    && !p.marriages.some((m) => !m.to)
    && !p.castSlots.includes('the_match')   // she can never actually be drafted
    && w.year - p.born >= 17
    && w.year - p.born <= 45;

  const byHall = halls(w, w.year);
  const pressureOf = new Map<string, number>();
  for (const [branch, members] of byHall) {
    pressureOf.set(branch, crowding(members.length, softCapFor(branch)));
  }
  const household = [...byHall].flatMap(([branch, members]) =>
    members.filter(eligible).map((p) => ({ p, branch })));

  for (const { p, branch } of household) {
    if (p.marriages.some((m) => !m.to)) continue;
    // A crowded hall does not find matches for everyone. Younger sons go
    // unmarried, take careers, or leave — and leaving is now a real place to
    // go, so a full house pushes people into the branches rather than nowhere.
    const pressure = pressureOf.get(branch) ?? 1;
    if (pressure < 1 && !rng.bool(pressure)) continue;

    // Prefer somebody who already exists — cousins included, since cousin
    // marriage is the mechanism rather than a temptation.
    const inWorld = w.people.living().filter(
      (q) => eligible(q)
        && q.sex !== p.sex
        && q.id !== p.id
        && Math.abs(q.born - p.born) < 16
        && !(q.trueParents.mother && q.trueParents.mother === p.trueParents.mother)
        && !q.marriages.some((m) => !m.to),
    );

    let partner = inWorld[0];

    // Otherwise mint one from a character template. Their house decides their
    // gene pool, and therefore whether they carry anything at all — which is
    // why marrying out is a gamble on a hidden allele rather than a known loss.
    //
    // Note a GROOM is minted for a daughter too. A house whose living blood is
    // all female must practise matrilineal marriage or end, and a family whose
    // power runs through its women would obviously have invented it. Everyone
    // else finds it scandalous, which is content.
    if (!partner) {
      const household = w.people.householdOf(p.id, w.year) ?? w.playerHouse;
      partner = mintForRole(ctx, p.sex === 'male' ? 'suitor' : 'groom', rng, {
        household,
        membership: 'married_in',
      });
    }

    if (!partner) continue;
    p.marriages.push({ spouse: partner.id, from: w.year });
    partner.marriages.push({ spouse: p.id, from: w.year });

    // Whoever married IN moves household. Ordinarily that is the wife; in a
    // matrilineal match it is the husband, and the difference is exactly what
    // decides whether the next generation belongs to this house or leaves it.
    const mover = (p.sex === 'female' && (partner.houseOfOrigin as unknown as string) !== w.playerHouse)
      ? partner            // he joins her — matrilineal
      : (p.sex === 'male' ? partner : p);
    const stayer = mover === p ? partner : p;
    const destination = w.people.householdOf(stayer.id, w.year);
    if (!destination) continue;

    // And into the right HALL. A bride marrying a cadet joins his branch, not
    // the seat — otherwise every marriage quietly refilled the main house and
    // the branches never grew a second generation.
    const destBranch = destination === w.playerHouse ? branchOf(w, stayer, w.year) : MAIN_BRANCH;

    const current = mover.membership.find((m) => m.to === undefined);
    const sameHall = current
      && (current.house as unknown as string) === destination
      && (current.branch ?? MAIN_BRANCH) === destBranch;
    if (!sameHall) {
      if (current) current.to = w.year;
      const record: Person['membership'][number] = {
        house: asId(destination),
        kind: 'married_in',
        from: w.year,
      };
      if (destination === w.playerHouse && destBranch !== MAIN_BRANCH) record.branch = destBranch;
      mover.membership.push(record);
    }
  }
}

/**
 * NAMING THE CHILDREN.
 *
 * Every newborn of the player's household is given a generated name so nothing
 * downstream can hold a nameless person, and is queued for the player to
 * rename. Naming is one of the few things the player does directly to an
 * individual rather than to the bloodline, and it should feel like it.
 *
 * The queue drains on rename or on `clearNamingQueue`. Ignoring it is a valid
 * way to play: the chronicler picked a name, and the chronicler is not you.
 */
export function renameChild(ctx: SimCtx, personId: string, name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;

  const p = ctx.world.people.get(personId);
  if (!p) return false;

  const pending = ctx.world.pendingNames.find((n) => n.person === personId);
  if (!pending) return false;

  ctx.takenNames.delete(p.name);
  p.name = trimmed;
  ctx.takenNames.add(trimmed);
  pending.chosen = trimmed;

  ctx.world.pendingNames = ctx.world.pendingNames.filter((n) => n.person !== personId);
  ctx.world.chronicle.push({
    year: ctx.world.year,
    weight: 'line',
    text: `${trimmed} was born, and named.`,
    named: false,
  });
  return true;
}

export function clearNamingQueue(ctx: SimCtx): void {
  ctx.world.pendingNames = [];
}

export function familySnapshot(ctx: SimCtx) {
  const w = ctx.world;
  return w.people.all().map((p) => {
    const ph = phenotypeOf(p, ctx.genetics, w.year);
    return {
      id: p.id as unknown as string,
      name: p.name,
      epithet: p.epithet,
      sex: p.sex,
      born: p.born,
      died: p.died,
      status: p.status,
      generation: w.people.generationOf(p.id),
      mother: p.trueParents.mother as unknown as string | undefined,
      father: p.trueParents.father as unknown as string | undefined,
      house: p.houseOfOrigin as unknown as string,
      awakened: p.awakening.awakened,
      madness: p.madness,
      sigilSeed: p.sigilSeed,
      branch: p.status === 'alive' ? branchOf(w, p, w.year) : undefined,
      castSlots: p.castSlots,
      contract: p.contract,
      eldritch: ph.eldritch,
      attrs: Object.fromEntries((ph.attrs as unknown as Map<string, number>).entries()),
    };
  });
}

export type FamilyMember = ReturnType<typeof familySnapshot>[number];
export type { WorldState };
