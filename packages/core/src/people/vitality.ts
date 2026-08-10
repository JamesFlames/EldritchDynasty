import type { Sex } from '@ed/schema';

/**
 * HEALTH and FERTILITY — the two derived attributes.
 *
 * Fecundity is what a body was BORN with: six loci, inherited from both
 * parents, unchanged from the day of conception to the day of death. It is a
 * potential, and a potential is not a rate. A woman of famous stock is not
 * equally likely to conceive at nineteen, at thirty-one and at forty-three, and
 * she is not equally likely to conceive well-fed and half-dead of the winter
 * cough. Fertility is what is left of that potential once the body it lives in
 * has been taken into account:
 *
 *     fertility  =  fecundity  x  what age and sex allow  x  what condition allows
 *
 * Both are `kind: derived` in `attributes.yaml`, which means `expressAttributes`
 * skips them — they have no loci and are not inherited. They are computed here,
 * on every phenotype recompute, from the expressed layer plus the acquired one.
 * That is deliberate and it is invariant 6: nothing writes a fertility number
 * into a person. There is nowhere to write it.
 *
 * The derived list is short and it is engine code, unlike the polygenic list
 * which is open and lives entirely in data. A derived attribute is a RULE about
 * bodies, and a rule needs a formula; adding one costs a function here.
 */

/** Fertility index: 100 is the reference body, so the couple maths is a ratio. */
export const FERTILITY_REFERENCE = 100;

/**
 * The health of a body with nothing wrong with it — mean strength for its sex,
 * grown, not yet old, no curse expressed, no Madness. Deliberately below the
 * ceiling of 100 so that being unusually robust has somewhere to go: a baseline
 * AT the cap would clamp every strong person back to average and quietly make
 * the strength term one-sided, which is the same class of mistake as a
 * dimorphism that shifts only the women.
 */
export const SOUND_BODY = 88;

/** Health per point of strength above (or below) the mean FOR THAT SEX. */
const HEALTH_PER_STRENGTH = 0.5;
/** Health lost per homozygous deleterious allele actually expressed. */
const HEALTH_PER_CURSE = 7;
/** Health lost per point of Madness carried beyond the Mind that holds it. */
const HEALTH_PER_OVERFLOW = 0.5;
const MAX_OVERFLOW_TOLL = 40;

/** Infants are frail, and it is gone by the time it could matter to fertility. */
const CHILD_FRAILTY = 22;
const CHILD_FRAILTY_ENDS = 12;
/** Senescence begins five years before the mortality curve notices it. */
const SENESCENCE_FROM = 40;
const SENESCENCE_RATE = 0.035;

/**
 * SEVENTY-THIRTY TOWARD THE MOTHER, in two places and for two reasons.
 *
 * As a weight on inherited fecundity it decides how much of a couple's
 * completed family comes from her line rather than his. As an exponent on the
 * pair's fertility it decides how much of their annual chance is hers — and
 * there it is a weighted GEOMETRIC mean rather than an arithmetic one, which is
 * the whole difference between a model of a couple and a model of two people
 * averaged. A barren wife and a hale husband are not a half-fertile couple.
 * They are a childless one, and only the product says so.
 */
export const MOTHER_SHARE = 0.7;

/**
 * Per point of fecundity away from the population mean. The band is what stops
 * one very lucky genome from being worth six children: an exceptional line is
 * roughly twice as fertile as an average one, not ten times.
 */
const FECUNDITY_SLOPE = 0.03;
const FECUNDITY_BAND = { min: 0.35, max: 1.9 };

/** Condition cannot make a body better than sound by more than a little. */
const HEALTH_FACTOR_MAX = 1.15;

/**
 * THE AGE CURVES, relative to each sex's own peak.
 *
 * Shaped after natural-fertility populations — societies with no contraception,
 * which is the only kind this game has. Two facts do most of the work, and both
 * of them are things the player will eventually feel:
 *
 *   A WOMAN'S CURVE HAS A CLIFF.  Flat through the twenties, bending at thirty,
 *   halved by thirty-seven, and effectively over by forty-five. Marrying a
 *   daughter late is not a neutral decision, and holding a bride back three
 *   years to win a better match costs real children.
 *
 *   A MAN'S CURVE HAS A SLOPE.  It declines and it never quite ends; men father
 *   children into their sixties in every parish register we have. An old
 *   husband is a mild loss, an old wife is the marriage — which is exactly the
 *   asymmetry `MOTHER_SHARE` states, arrived at from the other direction.
 *
 * Piecewise linear on purpose. A closed-form curve would be prettier and nobody
 * could argue with a number in it; this is a table, and a table can be checked
 * against a demographer's.
 */
const FEMALE_BY_AGE: [number, number][] = [
  [13, 0], [15, 0.42], [17, 0.72], [19, 0.90], [22, 1.00], [25, 0.98], [28, 0.93],
  [30, 0.88], [33, 0.79], [35, 0.70], [37, 0.58], [39, 0.44], [41, 0.28], [43, 0.15],
  [45, 0.06], [47, 0.02], [50, 0],
];

const MALE_BY_AGE: [number, number][] = [
  [13, 0], [15, 0.30], [17, 0.62], [20, 0.88], [25, 1.00], [35, 0.97], [40, 0.92],
  [45, 0.84], [50, 0.74], [55, 0.63], [60, 0.51], [70, 0.30], [80, 0.15], [95, 0.05],
];

/**
 * MAX AGE, and why every curve in this file divides by it.
 *
 * A typical body is built for a hundred years. Almost nobody gets there —
 * maxAge is the ceiling a life is measured against, not a promise of one.
 *
 * The tables below were written in years for a hundred-year body, and they
 * are read in BODY-YEARS: age is scaled by 100/maxAge before the lookup, so
 * a woman built for a hundred and thirty is biologically thirty at
 * thirty-nine, and her curve stretches rather than shifting. Health does the
 * same with senescence. That is the whole of "fertility and health vary
 * relative to the character's baseline maxAge", and doing it by scaling the
 * INPUT rather than editing the tables means there is still exactly one
 * fertility curve per sex to reason about.
 *
 * Infancy is deliberately NOT scaled. A newborn is a newborn; a body built
 * to last does not spend eighteen months longer being frail.
 */
export const BASELINE_MAX_AGE = 100;

/** Per point of longevity away from the population mean. */
const MAX_AGE_PER_POINT = 1.15;
const MAX_AGE_BAND = { min: 45, max: 400 };

export function deriveMaxAge(longevity: number, longevityMean: number, acquired = 0): number {
  const raw = BASELINE_MAX_AGE + (longevity - longevityMean) * MAX_AGE_PER_POINT + acquired;
  return clamp(raw, MAX_AGE_BAND.min, MAX_AGE_BAND.max);
}

/**
 * How much of the ceiling each system is allowed to stretch by.
 *
 * Senescence and mortality stretch in FULL: a body built to last is younger
 * for longer in every way those two measure.
 *
 * Female fertility does not, and this is the one place the tidy model would
 * be wrong about bodies. Childbearing ends by DEPLETION rather than by wear —
 * a woman built for a hundred and thirty was not born with thirty percent
 * more eggs — so her curve stretches at well under half rate. Stretching it
 * in full put nearly three percent of all births past forty-five, a rate no
 * population has had, and it did it invisibly: every one of those births
 * looked entirely reasonable on its own.
 *
 * Male fertility stretches in full, because production is continuous and
 * there is nothing to deplete. That the two sexes stretch differently is the
 * same asymmetry the rest of the model already runs on, arrived at from a
 * third direction — and it is why agelessness buys a man more years of
 * getting children than it buys a woman of bearing them.
 */
const STRETCH = { senescence: 1, male: 1, female: 0.42 };

/** The ceiling one system is allowed to read, given how far it stretches. */
function effectiveCeiling(maxAge: number, stretch: number): number {
  return BASELINE_MAX_AGE + (maxAge - BASELINE_MAX_AGE) * stretch;
}

/** Age in body-years: what this age would be on a hundred-year body. */
export function bodyYears(age: number, maxAge: number, stretch = 1): number {
  return age * (BASELINE_MAX_AGE / Math.max(1, effectiveCeiling(maxAge, stretch)));
}

/** Where a body of this age and sex sits on its own curve, 0 to 1. */
export function fertilityByAge(sex: Sex, age: number, maxAge = BASELINE_MAX_AGE): number {
  const t = bodyYears(age, maxAge, sex === 'female' ? STRETCH.female : STRETCH.male);
  return interpolate(sex === 'female' ? FEMALE_BY_AGE : MALE_BY_AGE, t);
}

function interpolate(table: [number, number][], x: number): number {
  if (x <= table[0]![0]) return table[0]![1];
  const last = table[table.length - 1]!;
  if (x >= last[0]) return last[1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i]!;
    if (x > x1) continue;
    const [x0, y0] = table[i - 1]!;
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return last[1];
}

export interface Range { min: number; max: number }

export interface VitalityInput {
  sex: Sex;
  age: number;
  /** Expressed strength, and the mean for THIS SEX — see the note below. */
  strength: number;
  strengthMean: number;
  /** Inherited fecundity, and the population mean from the locus table. */
  fecundity: number;
  fecundityMean: number;
  /** Madness carried, and the Mind that is its ceiling (concept §10). */
  madness: number;
  mind: number;
  /** Homozygous deleterious alleles actually expressed. The founder's curses. */
  curses: number;
  /** The ceiling this body was built for. Both age curves divide by it. */
  maxAge: number;
  /** What life did to this body: plague, famine, a bad birth, a good midwife. */
  acquiredHealth: number;
  acquiredFertility: number;
}

export interface Vitality { health: number; fertility: number }

/**
 * Health first, then fertility, because fertility reads it.
 *
 * THE STRENGTH TERM IS MEASURED AGAINST THE PERSON'S OWN SEX, and that is not
 * a nicety. Strength carries 26 points of dimorphism. Read against the whole
 * population's mean, every woman alive would be thirteen points of strength
 * short, therefore six and a half points of health short, therefore about seven
 * percent less fertile than every man — and since it takes one of each to make
 * a child, the entire species would have quietly lost seven percent of its
 * births to a units error. Invariant 10 warns about exactly this: a strength
 * shift surfacing three systems away as a fertility bug. This is the three
 * systems away.
 */
export function deriveVitality(v: VitalityInput, ranges: { health: Range; fertility: Range }): Vitality {
  const overflow = Math.max(0, v.madness - v.mind);

  const raw = SOUND_BODY
    + (v.strength - v.strengthMean) * HEALTH_PER_STRENGTH
    - childFrailty(v.age)
    - senescence(v.age, v.maxAge)
    - v.curses * HEALTH_PER_CURSE
    - Math.min(MAX_OVERFLOW_TOLL, overflow * HEALTH_PER_OVERFLOW)
    + v.acquiredHealth;

  const health = clamp(raw, ranges.health.min, ranges.health.max);

  // A potential, scaled by what age allows and what the body allows.
  const inherited = clamp(
    1 + (v.fecundity - v.fecundityMean) * FECUNDITY_SLOPE,
    FECUNDITY_BAND.min,
    FECUNDITY_BAND.max,
  );
  const condition = clamp(health / SOUND_BODY, 0, HEALTH_FACTOR_MAX);
  const fertility = FERTILITY_REFERENCE * inherited * fertilityByAge(v.sex, v.age, v.maxAge) * condition;

  return {
    health,
    fertility: clamp(fertility + v.acquiredFertility, ranges.fertility.min, ranges.fertility.max),
  };
}

function childFrailty(age: number): number {
  if (age >= CHILD_FRAILTY_ENDS) return 0;
  return CHILD_FRAILTY * (1 - age / CHILD_FRAILTY_ENDS);
}

/**
 * Greying, in BODY-YEARS. A body built for a hundred and thirty starts
 * losing condition at fifty-two rather than forty, and loses it at the same
 * rate per body-year — which is what makes agelessness worth buying and
 * stops it being a flat bonus to a number.
 */
function senescence(age: number, maxAge: number): number {
  return Math.max(0, bodyYears(age, maxAge, STRETCH.senescence) - SENESCENCE_FROM) ** 2 * SENESCENCE_RATE;
}

/**
 * THE COUPLE, as a multiplier on the annual chance of a child.
 *
 * A weighted geometric mean of the two fertilities, seventy-thirty toward the
 * mother. Two things follow from the shape that would not follow from an
 * average, and both of them are the point:
 *
 *   EITHER PARTNER CAN END IT.  Zero times anything is zero. A husband past
 *   seventy or a wife past fifty closes the marriage, and no amount of the
 *   other's vigour reopens it. An arithmetic mean would have handed a woman of
 *   fifty-two thirty percent of her husband's fertility, which is not how any
 *   of this works.
 *
 *   THE COSTS COMPOUND.  Two people at eighty percent are a couple at eighty
 *   percent, not ninety. A late match where both are past their best is worse
 *   than either half looks on its own, which is the honest arithmetic of
 *   marrying two spare cousins to each other in a crowded year.
 */
export function coupleFertility(motherFertility: number, fatherFertility: number): number {
  if (motherFertility <= 0 || fatherFertility <= 0) return 0;
  return (motherFertility / FERTILITY_REFERENCE) ** MOTHER_SHARE
    * (fatherFertility / FERTILITY_REFERENCE) ** (1 - MOTHER_SHARE);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
