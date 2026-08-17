import type { Person } from '@ed/schema';
import { asId, MAIN_BRANCH } from '@ed/schema';
import type { SimCtx } from '../world.js';
import { hashSeed, type Rng } from '../rng.js';
import { attr, conceiveChild, genomeOf, phenotypeOf } from './factory.js';
import { BASELINE_MAX_AGE, coupleFertility, MOTHER_SHARE } from './vitality.js';
import { branchOf, halls, softCapFor } from './branches.js';
import { mintForRole } from './minting.js';
import { careerMortality, inBreedingPool } from './careers.js';
import { deleteriousLoad } from '../genetics/expression.js';

/**
 * WHO DIES, WHO MARRIES, WHO IS BORN.
 *
 * The three population processes, in one file, because they share their brakes
 * and their constants and were tuned against each other. They used to sit in
 * the middle of `sim.ts` between the year loop and the player's verbs, which
 * meant every change to the shape of a year read like a change to fertility.
 */

// ── Death ─────────────────────────────────────────────────────────────────

// INVARIANT 1 + 2: Madness overflow reads canExpress; every death goes through kill().
export function rollDeath(p: Person, ctx: SimCtx, rng: Rng): boolean {
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

  // Military: kills people. A career's own extra hazard, read from content
  // rather than hardcoded — see `people/careers.ts` (issue #16).
  hazard += careerMortality(ctx, p);

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

// ── Births ────────────────────────────────────────────────────────────────

/**
 * A house is not a population. Left alone, every adult marrying and breeding
 * for twenty-seven years doubles the household every generation and the tree
 * becomes unreadable by year 1200. Two brakes, both deterministic:
 *
 *   COMPLETED FERTILITY  each couple has a target number of children, derived
 *                        from their inherited fecundity and their ids, so it is
 *                        stable across save and load.
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
 *
 * COMPLETED FERTILITY IS INHERITED. It was `2 + hash(seed, mother, father) % 4`
 * — stable across save and load, and inherited by nothing. Every marriage
 * decision in the game was a bet on WHAT a couple's children would be and never
 * on HOW MANY, so a house that married a famously fruitful line got precisely
 * nothing for it, and the only demographic dial we had was a constant the
 * player could not see. Three details worth keeping:
 *
 *   THE MOTHER CARRIES IT.  Seventy-thirty, not fifty-fifty. A man of a thin
 *   line is a mild disappointment; a woman of one is the whole marriage. This
 *   is what puts fertility into the same economy as the font — you are reading
 *   a bride's mother and her sisters for two different things at once — and it
 *   is why a daughter married outward costs the house twice. The ratio lives in
 *   `people/vitality.ts` and is used twice: as a weight on the inherited cap
 *   here, and as an exponent on the pair's fertility there. One rule about
 *   whose fertility it mostly is, not two constants that drift.
 *
 *   CENTRED, NOT HARDCODED.  The mapping is relative to the attribute's
 *   population mean, computed from the locus table at bootstrap. Retune
 *   `LOCI_PER_CORE` and family sizes stay where they are instead of drifting.
 *
 *   STILL JITTERED.  A couple keeps a small id-derived wobble, so two
 *   brothers who married two sisters do not complete identical families.
 */

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
export const CONCEPTION_PEAK = 0.22;

/**
 * The biological window, wide on purpose. What actually ends a woman's
 * childbearing is the curve going to zero at fifty, not this — a hard cutoff at
 * forty-four made thirteen percent of all births happen in the four years
 * before it and then none at all, which is a cliff no population has.
 */
export const CHILDBEARING = { from: 15, to: 50 };

/**
 * 3.1, not 3.5. The old hash produced a flat 2–5, and matching its MEAN
 * overshot the house by a sixth — `Math.round` sends every .5 upward, so a
 * symmetric jitter around 3.5 completes families of 3.67. Tuned instead
 * against the household at 600 years (~63 living, six halls), which is the
 * number that has to stay put: heritable fertility was meant to change what
 * family size MEANS, not how big the house is on the day it lands.
 */
export const FERTILITY_BASE = 3.1;
/** Children per point of fecundity. One standard deviation ≈ one child. */
export const FERTILITY_SLOPE = 0.09;
export const FERTILITY_MAX = 9;

/**
 * Fertility option D (issue #25): a named recessive rather than a gradient.
 * `del_hollow_year` is harmless carried and near-sterile homozygous — this is
 * the whole implementation, because fecundity already exists as an attribute
 * with something to clamp. Below the population's observed floor (0, see
 * `demography.slow.test.ts`), so whichever parent carries it drags the pair
 * down regardless of what the other parent's own fecundity would have been.
 */
const HOLLOW_YEAR = 'the hollow year';
const HOLLOW_YEAR_FLOOR = -5;

function isHollowYearHomozygote(p: Person, ctx: SimCtx): boolean {
  return deleteriousLoad(genomeOf(p, ctx.genetics), ctx.genetics.table).names.includes(HOLLOW_YEAR);
}

/** The couple's inherited fecundity, weighted toward the mother. */
export function pairFecundity(mother: Person, father: Person, ctx: SimCtx): number {
  const y = ctx.world.year;
  const combined = attr(mother, 'fecundity', ctx.genetics, y) * MOTHER_SHARE
    + attr(father, 'fecundity', ctx.genetics, y) * (1 - MOTHER_SHARE);
  if (isHollowYearHomozygote(mother, ctx) || isHollowYearHomozygote(father, ctx)) {
    return Math.min(combined, HOLLOW_YEAR_FLOOR);
  }
  return combined;
}

/**
 * The annual chance, from what the two bodies can do THIS year. Fertility is
 * fecundity read through age, sex and condition; `coupleFertility` combines the
 * pair multiplicatively, so either one of them being finished finishes both.
 */
export function conceptionChance(mother: Person, father: Person, ctx: SimCtx): number {
  const y = ctx.world.year;
  return CONCEPTION_PEAK * coupleFertility(
    attr(mother, 'fertility', ctx.genetics, y),
    attr(father, 'fertility', ctx.genetics, y),
  );
}

export function completedFertility(pair: number, mother: Person, father: Person, ctx: SimCtx): number {
  const w = ctx.world;
  const centre = ctx.genetics.expected.get('fecundity') ?? 0;
  const jitter = (hashSeed(w.seed, 'fertility', String(mother.id), String(father.id)) % 3) / 2 - 0.5;
  const target = FERTILITY_BASE + (pair - centre) * FERTILITY_SLOPE + jitter;
  return Math.max(0, Math.min(FERTILITY_MAX, Math.round(target)));
}

export function crowding(size: number, cap: number): number {
  if (size <= cap) return 1;
  return Math.max(0.05, 1 - (size - cap) / cap);
}

export interface Conception {
  birth: ReturnType<typeof conceiveChild>;
  branch: string;
  /** Two contracted parents: a servant family, of the household but not the blood. */
  servants: boolean;
}

export function rollBirths(ctx: SimCtx, rng: Rng): Conception[] {
  const w = ctx.world;
  const results: Conception[] = [];

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

      // Clergy: removed from the breeding pool entirely (issue #16).
      if (!inBreedingPool(ctx, mother) || !inBreedingPool(ctx, father)) continue;

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

// ── Marriage ──────────────────────────────────────────────────────────────

/**
 * PLACEHOLDER PAIRING. The shipped game replaces this entirely with the suitor
 * draft — draw one of three cards, each with blood, politics, a dowry and one
 * secret revealed later. What it must do here is grow a real pedigree so the
 * genetics has something to act on, and dilute the font when the house marries
 * outward, because that is the pressure the whole design turns on.
 */
export function autoMarry(ctx: SimCtx, rng: Rng): void {
  const w = ctx.world;
  const eligible = (p: Person) =>
    p.status === 'alive'
    && !p.marriages.some((m) => !m.to)
    && !p.castSlots.includes('the_match')   // she can never actually be drafted
    && inBreedingPool(ctx, p)                // Clergy do not marry (issue #16)
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
    //
    // The sitting Head is never the mover, whichever side of the pair she is.
    // `ensureHead` recalls a new head to the main hall the day she is seated;
    // without this guard, a REIGNING head marrying a cousin who already lives
    // in a cadet branch got physically relocated to his hall by this same
    // pass — silently, since nothing here knew or cared that `p` held the
    // seal. A Head who rules from the smaller house is a Head whose own hall
    // is somebody else's, the same failure `recallToMain` exists to prevent.
    const mover = p.castSlots.includes('head')
      ? partner
      : partner.castSlots.includes('head')
        ? p
        : (p.sex === 'female' && partner.houseOfOrigin !== w.playerHouse)
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
      && current.house === destination
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
