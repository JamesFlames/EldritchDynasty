import type { ContentBundle, GenePool, Person, SeedPerson } from '@ed/schema';
import { asId, recordFire } from '@ed/schema';
import { buildLocusTable } from './genetics/loci.js';
import { randomGenome } from './genetics/meiosis.js';
import {
  accrueMadness, attr, conceiveChild, genomeOf, makePerson, phenotypeOf, rollAwakening,
  type GeneticsCtx,
} from './people/factory.js';
import { createWorld, type SimCtx, type WorldState } from './world.js';
import { hashSeed, makeRng, type Rng } from './rng.js';
import { uniqueName } from './people/names.js';
import { ensureHead, maintainCast } from './people/succession.js';
import { mintForRole } from './people/minting.js';
import { tickAges } from './ages/scheduler.js';
import { selectEvents, type Candidate } from './events/selection.js';
import { applyOutcome, pickOutcome, type ResolvedEvent } from './events/effects.js';
import { advanceArc, dueArcSteps, startArc } from './events/arcs.js';
import { renderBody } from './events/slots.js';
import { tickEconomy } from './economy.js';

export function makeGeneticsCtx(bundle: ContentBundle, seed: number): GeneticsCtx {
  const pools = new Map<string, GenePool>();
  for (const h of bundle.houses) pools.set(h.id, h.genePool);
  return {
    table: buildLocusTable(bundle.loci),
    attributes: bundle.attributes,
    traits: bundle.traits,
    pools,
    runSeed: seed,
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
  /** Events awaiting player input — choices and missions. */
  pending: Candidate[];
  /** Set on the single year the Narrator stops being a person. */
  guardianCrossed?: Person;
}

const EVENT_BUDGET_PER_YEAR = 0.35;

export function stepYear(ctx: SimCtx, autoResolve = true): YearReport {
  const w = ctx.world;
  w.year += 1;
  const rng = makeRng(hashSeed(w.seed, 'year', w.year));

  const report: YearReport = {
    year: w.year,
    births: [], deaths: [], awakenings: [],
    agesBegan: [], agesEnded: [], agesNamed: [],
    resolved: [], pending: [],
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

  // ── The year's takings ──────────────────────────────────────────────────
  tickEconomy(ctx);

  // ── Succession and the recurring cast ───────────────────────────────────
  // Without this the head, tutor and rival slots go vacant within a
  // generation and the event pool silently collapses to nothing.
  ensureHead(ctx, rng);
  if (w.year % 4 === 0) maintainCast(ctx, rng);

  // ── Marriage, then births ───────────────────────────────────────────────
  if (w.year % 3 === 0) autoMarry(ctx, rng);

  for (const b of rollBirths(ctx, rng)) {
    if (!b.child) continue;
    w.people.add(b.child);
    report.births.push(b.child);

    // Offer the naming to the player. The child already has a name, so the
    // offer can be ignored without anything downstream breaking.
    if ((b.child.houseOfOrigin as unknown as string) === w.playerHouse) {
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
    if (event.interaction.kind === 'narration') {
      const outcome = pickOutcome(event.interaction.outcomes, rng);
      report.resolved.push(applyOutcome({ ...event, body }, outcome, ctx, step.fill));
      recordFire(event.id, event.frequency, w.frequency, w.year);
      advanceArc(step, outcome.id, ctx, rng);
    } else if (autoResolve) {
      const choice = rng.pick(event.interaction.choices);
      const outcome = pickOutcome(choice.outcomes, rng);
      report.resolved.push(applyOutcome({ ...event, body }, outcome, ctx, step.fill));
      recordFire(event.id, event.frequency, w.frequency, w.year);
      advanceArc(step, outcome.id, ctx, rng);
    } else {
      report.pending.push({ event, fill: step.fill, playerCast: [], source: 'forced' });
    }
  }

  const budget = rng.next() < EVENT_BUDGET_PER_YEAR ? 1 : 0;
  if (budget > 0) {
    for (const cand of selectEvents(ctx, rng, budget)) {
      const e = cand.event;
      if (e.interaction.kind === 'narration') {
        const outcome = pickOutcome(e.interaction.outcomes, rng);
        report.resolved.push(applyOutcome(e, outcome, ctx, cand.fill));
        recordFire(e.id, e.frequency, w.frequency, w.year);
        for (const eff of outcome.effects) {
          if (eff.kind === 'arc' && eff.op === 'start') {
            const arc = ctx.bundle.arcs.find((a) => a.id === eff.arc);
            if (arc) startArc(arc, ctx, rng, cand.fill);
          }
        }
      } else if (autoResolve) {
        const choice = rng.pick(e.interaction.choices);
        const outcome = pickOutcome(choice.outcomes, rng);
        report.resolved.push(applyOutcome(e, outcome, ctx, cand.fill));
        recordFire(e.id, e.frequency, w.frequency, w.year);
        for (const eff of outcome.effects) {
          if (eff.kind === 'arc' && eff.op === 'start') {
            const arc = ctx.bundle.arcs.find((a) => a.id === eff.arc);
            if (arc) startArc(arc, ctx, rng, cand.fill);
          }
        }
      } else {
        report.pending.push(cand);
      }
    }
  }

  if (w.year % 25 === 0) w.generation += 1;
  return report;
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
  let hazard = 0.004 + Math.max(0, age - 45) ** 2 * 0.00006;

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
 */
const HOUSEHOLD_SOFT_CAP = 14;

function completedFertility(motherId: string, fatherId: string, runSeed: number): number {
  return 2 + (hashSeed(runSeed, 'fertility', motherId, fatherId) % 4);
}

function crowding(size: number): number {
  if (size <= HOUSEHOLD_SOFT_CAP) return 1;
  return Math.max(0.05, 1 - (size - HOUSEHOLD_SOFT_CAP) / HOUSEHOLD_SOFT_CAP);
}

function rollBirths(ctx: SimCtx, rng: Rng) {
  const w = ctx.world;
  const results: ReturnType<typeof conceiveChild>[] = [];
  const roster = w.people.household(w.playerHouse, w.year);
  const pressure = crowding(roster.length);

  for (const mother of roster) {
    if (mother.sex !== 'female') continue;
    const age = w.year - mother.born;
    if (age < 17 || age > 44) continue;
    const marriage = mother.marriages.find((m) => !m.to);
    if (!marriage) continue;
    const father = w.people.get(marriage.spouse);
    if (!father || father.status !== 'alive') continue;

    const borne = w.people.children(mother.id).length;
    if (borne >= completedFertility(String(mother.id), String(father.id), w.seed)) continue;

    if (!rng.bool(0.16 * pressure)) continue;

    const ordinal = w.people.children(mother.id).length + 1;
    const household = w.people.householdOf(mother.id, w.year) ?? w.playerHouse;
    results.push(conceiveChild(mother, father, ordinal, w.year, ctx.genetics, ctx.takenNames, household, w));
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
    && !p.contract
    && !p.marriages.some((m) => !m.to)
    && !p.castSlots.includes('the_match')   // she can never actually be drafted
    && w.year - p.born >= 17
    && w.year - p.born <= 45;

  const roster = w.people.household(w.playerHouse, w.year);
  const pressure = crowding(roster.length);
  const household = roster.filter(eligible);

  for (const p of household) {
    if (p.marriages.some((m) => !m.to)) continue;
    // A crowded house does not find matches for everyone. Younger sons go
    // unmarried, take careers, or leave — which is what cadet branches are.
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
    const destination = w.people.householdOf(mover === p ? partner.id : p.id, w.year);
    if (!destination) continue;

    const current = mover.membership.find((m) => m.to === undefined);
    if (!current || (current.house as unknown as string) !== destination) {
      if (current) current.to = w.year;
      mover.membership.push({ house: asId(destination), kind: 'married_in', from: w.year });
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
      castSlots: p.castSlots,
      contract: p.contract,
      eldritch: ph.eldritch,
      attrs: Object.fromEntries((ph.attrs as unknown as Map<string, number>).entries()),
    };
  });
}

export type FamilyMember = ReturnType<typeof familySnapshot>[number];
export type { WorldState };
