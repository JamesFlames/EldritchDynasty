import { z } from 'zod';

/**
 * FREQUENCY
 * =========
 * Common · Uncommon · Rare · Mythic.
 *
 * The temptation is to make this a weight multiplier and stop. That would be
 * `weight` with nicer names. Instead frequency is a **rationing tier** that
 * reaches into four systems at once:
 *
 *   1. SCHEDULING  — weight, per-run caps, global cooldowns, an earliest
 *                    generation, and a drought counter. A Mythic event is not
 *                    "unlikely"; it is *rationed*. The player is close to
 *                    guaranteed a few per run and can never have many.
 *   2. PRESENTATION— how the chronicle renders it. A Common event is a line.
 *                    A Mythic event is an illuminated page and is named in the
 *                    chronicle forever. In a game whose artefact IS the
 *                    chronicle, frequency is a typographic signal (concept §24).
 *   3. FOLKLORE    — whether the world remembers. Common events never become
 *                    Rumours; Rare and Mythic always do (concept §19). This is
 *                    the picaresque-to-legend pipeline given a throttle.
 *   4. THE RECORD  — which events force a Record / Omit / Embellish choice
 *                    (concept §6). The authoring budget was ~30% of templates
 *                    carrying a Record block, without saying which 30%.
 *                    Frequency answers that: Rare and Mythic always, Common
 *                    never — enforced by `validateBundle`.
 *
 * Everything below is authored data, validated at boot, and tunable by the
 * headless harness rather than by argument.
 */
export const FrequencyS = z.enum(['common', 'uncommon', 'rare', 'mythic']);
export type Frequency = z.infer<typeof FrequencyS>;

export const FREQUENCY_ORDER: Frequency[] = ['common', 'uncommon', 'rare', 'mythic'];

export const ChronicleWeightS = z.enum(['line', 'paragraph', 'page', 'illuminated']);
export type ChronicleWeight = z.infer<typeof ChronicleWeightS>;

export interface FrequencyProfile {
  /** Base draw weight before per-event weight, presence modifiers and drought. */
  weight: number;
  /** Hard cap on how many events of this tier may fire in an entire run. */
  perRunCap: number | null;
  /** No two events of this tier within this many years. Rationing, not luck. */
  cooldownYears: number;
  /** You do not get a Mythic event in generation two. The house must earn it. */
  minGeneration: number;
  /** May a template of this tier carry a Record block? (concept §6) */
  record: 'forbidden' | 'optional' | 'required';
  /** Does the world turn this into a story? (concept §19) */
  rumour: 'never' | 'optional' | 'always';
  /** How the chronicle renders it (concept §24). */
  chronicle: ChronicleWeight;
  /** Is this permanently named in the chronicle, like a Historic Age? */
  named: boolean;
  /**
   * Drought pressure. Each year past the cooldown with no event of this tier,
   * its weight grows by this much per century. Stops a run of pure oatmeal
   * without ever making a Mythic event feel scheduled.
   */
  droughtGainPerCentury: number;
  /** Each specific template of this tier may fire at most this many times. */
  maxFiresPerTemplate: number;
}

export const FREQUENCY_PROFILES: Record<Frequency, FrequencyProfile> = {
  common: {
    weight: 1000,
    perRunCap: null,
    cooldownYears: 0,
    minGeneration: 0,
    record: 'forbidden',
    rumour: 'never',
    chronicle: 'line',
    named: false,
    droughtGainPerCentury: 0,
    maxFiresPerTemplate: Infinity,
  },
  uncommon: {
    /**
     * 400, raised from 240 the same way rare was raised below: measured, after
     * a content drop, against what the tier actually fired before it.
     *
     * A tier's share of the yearly draw is not a property of the tier. It is
     * the tier's weight times how many templates carry it times their own
     * weights, divided by the same product summed over every other tier — so
     * adding twenty-eight COMMON templates rations uncommon and rare without
     * touching a line of their content, and nothing anywhere reports it. That
     * drop measured, over sixty thousand-year runs: uncommon 93.1 firings a
     * run to 75.0, rare 24.0 to 14.1, and `the_coat_hung_up` — an event gated
     * behind a commission bought a generation earlier and still being held —
     * from 13.3% of runs to zero, which is how gate 4 found it.
     *
     * At 400 the same measurement puts the commission back at 67% (68.3%
     * before), the coat at 10%, and `the_millers_boy` and
     * `the_turn_of_the_stave` — the two thinnest things in the last outcome
     * sweep — above where they were. The uncommon RATION is untouched: still
     * one firing per twelve years, still no per-run cap. This buys back the
     * tier's share of the draw, not its allowance.
     *
     * 800 now, and the third raise is the second one at the next scale, with
     * one new fact in it. Fifty new COMMON templates (the_hall, feasts,
     * the_turning_year, bramme, the_young, neighbours) took the common pool
     * from 55 templates to 105 and cut uncommon from 79.6 firings a run to
     * 65.8 and rare from 15.5 to 11.8, measured over 24 thousand-year runs
     * with nothing else changed. Sweeping the weight back over 32 runs:
     *
     *     400 -> uncommon 66.0  rare 11.5
     *     700 -> uncommon 71.4  rare 13.5
     *    1000 -> uncommon 73.7  rare 13.8
     *
     * THE CURVE FLATTENS AND DOES NOT REACH. That is not the weight failing;
     * it is the TWELVE-YEAR COOLDOWN, which caps this tier at about 83
     * firings a run and had it at 79.6 — within four per cent of the ceiling
     * — before the drop. A tier already pressed against its ration cannot be
     * given its old share back by weight alone, because the years it wants
     * are years it is barred from. 800 recovers about three quarters of the
     * loss and the last quarter is the cooldown's, and the cooldown is the
     * ration and is not for sale. The gates decide whether that quarter
     * matters; gate 4 and gate 8 were both green at 800.
     */
    /**
     * 1100 now, and the fourth raise says the same thing a third time and is
     * written down because it keeps being forgotten. A hundred new COMMON
     * templates took that pool from 105 to 205 and cut uncommon from 71.3
     * firings a run to 62.5. Sweeping over 24 thousand-year runs:
     * 800 -> 62.5, 1100 -> 64.2, 1500 -> 64.5. The knob is worth about two
     * firings and then stops, because the twelve-year cooldown caps this
     * tier near 83 and every year it wants is a year it is barred from. 1100
     * takes the cheap part of that; the rest is the cooldown's and is the
     * ration.
     */
    weight: 1100,
    perRunCap: null,
    cooldownYears: 12,
    minGeneration: 1,
    record: 'optional',
    rumour: 'optional',
    chronicle: 'paragraph',
    named: false,
    droughtGainPerCentury: 0.5,
    maxFiresPerTemplate: Infinity,
  },
  rare: {
    /**
     * 70, raised from 40 and measured rather than argued.
     *
     * A tier's draw weight is what actually rations it — the 22-a-run cap and
     * the 55-year cooldown almost never bind, because a rare template at 40
     * against common's 1000 loses the yearly draw long before either does. The
     * whole rare tier fired about 6.6 times in a thousand years, shared by
     * every rare template in the game, so each of the set-pieces this tier
     * exists for — the Drowning, the Burning, the Seal pressed — reached only
     * about 15% of runs, and every one of their five-or-so endings sat at one
     * to three expected hits in the hundred runs gate 8 measures. That is a
     * gate deciding a coin flip, and it is why three consecutive content
     * changes each made a different one of those endings "never resolve".
     *
     * This is the knob the manual says to reach for ("tune the profile and
     * measure in the harness; never tune by nudging a per-template weight"),
     * and it was still at the value it had when the game held a third as much
     * rare content as it did then.
     *
     * 150 now, and the second raise is the same lesson at the next scale.
     * The content drop that added twenty-eight common templates in one go
     * cut rare from 24.0 firings a run to 14.1 without any rare content
     * changing, because a rare template at 70 against a common pool that had
     * just doubled loses the yearly draw even more comprehensively than it did
     * at 40. At 150 it comes back to about 16 and then STOPS MOVING: 180 buys
     * 0.4 of a firing over 150. That is the fifty-five-year cooldown finally
     * binding instead of the draw weight, which is where this tier was always
     * supposed to sit — "a Mythic event is not unlikely; it is rationed", and
     * rare is the same argument one tier down. The knob has reached the end of
     * what it does, and the next lever for rare reach is the cooldown.
     *
     * 320 now, for the reason set out under uncommon above and with the same
     * shape to it. The fifty-template common drop cut rare from 15.5 firings
     * a run to 11.8; the sweep gives 150 -> 11.5, 280 -> 13.5, 400 -> 13.8,
     * and the flattening is the fifty-five-year cooldown, which caps the tier
     * near 18 and had it at 15.5. 320 sits at the knee. Everything past it
     * buys a fraction of a firing and moves this number further from every
     * other number in this file for nothing.
     *
     * AND THEN THE POOL GREW, AND THE KNOB STOPPED MATTERING ALTOGETHER.
     *
     * Every number above was measured when the AMBIENT rare pool was NINE
     * templates. That is the number that matters and it is not the number
     * `frequency: rare` returns: of the rare templates then in the game, ten
     * were arc nodes (excluded from the ambient pool by construction, see
     * `recordTemplateFire` below) and twenty-five were `tier: frame` (rationed
     * off `world.frame`, not off this ledger). Nine templates shared 7.25
     * ambient firings a run, and every raise of this weight from 40 to 320 was
     * buying share for those nine.
     *
     * Fifty new rare templates took the ambient pool from 9 to 59, and the
     * tier's whole behaviour changed character. Measured over 24 thousand-year
     * runs, sweeping this weight and nothing else:
     *
     *     320 -> 14.0 ambient firings a run
     *     220 -> 13.6
     *     150 -> 12.7
     *
     * A factor of two on the weight moves the tier by ten per cent, because a
     * pool of 59 templates wins the yearly draw whenever it is ELIGIBLE, and
     * eligibility is the fifty-five-year cooldown, which caps this tier near
     * 18 a run. The ration is now the only thing rationing rare — which is
     * what "a Mythic event is not unlikely; it is rationed" has always said
     * this tier should look like, one tier down, and it took a content drop
     * rather than a knob to get there. 320 stays because at 320 nothing else
     * is crowded (common 274 against 275 at 150, uncommon 70.0 against 71.1)
     * and per-template reach is best there; it stays as a number that no
     * longer does much, and the next person to reach for it should reach for
     * the cooldown instead — which is the next paragraph.
     */
    /**
     * 400 after the hundred-template common drop, which cut this tier from
     * 21.5 firings a run to 19.8 — a much smaller dent than uncommon took,
     * because with 59 templates in the pool this tier is held by its
     * cooldown and its per-run cap rather than by the draw. 400 puts it back
     * to 20.4 and 500 to 21.1, and the difference between those two is not
     * worth moving this number further from every other number in the file.
     */
    weight: 400,
    perRunCap: 22,
    /**
     * 30, down from 55, and this is the lever the comment above has been
     * pointing at for two content drops.
     *
     * The cooldown IS the ration and is what a tier is for, so it is not moved
     * to make a gate quiet. It is moved because the ration and the tier's own
     * stated cadence stopped agreeing. `rites.yaml` opens by defining this
     * tier as "a few per century"; at 55 years with an ambient pool of nine
     * templates it delivered 0.7 a century, and every raise of the weight
     * above was an attempt to reach a cadence the cooldown would not allow.
     *
     * With the ambient pool at 59 the weight has stopped mattering (above) and
     * the cooldown is the only thing left holding the tier down. Measured over
     * 24 thousand-year runs, sweeping it and nothing else:
     *
     *     cd 55 -> 14.0 firings a run, median template reached in 17% of runs
     *     cd 40 -> 18.1                                          25%
     *     cd 30 -> 21.8                                          33%
     *     cd 22 -> 22.0                                          33%
     *
     * It stops at 30 because `perRunCap` takes over there — 22 is 22 — which
     * is the correct place for a rationed tier to stop: on its explicit cap
     * rather than on an interval nobody chose for this pool size. 2.2 a
     * century is "a few per century" as the tier has always described itself,
     * and the cost is eight common firings a run (274 -> 266) and nothing at
     * all from uncommon (70.0 -> 70.6) or mythic (1.0 -> 1.0).
     */
    cooldownYears: 30,
    minGeneration: 4,
    record: 'required',
    rumour: 'always',
    chronicle: 'page',
    named: true,
    droughtGainPerCentury: 3,
    maxFiresPerTemplate: 2,
  },
  mythic: {
    /**
     * 9, up from 5, and this is the first time this number has been touched.
     *
     * Mythic is rationed by its CAP and its DROUGHT CURVE — three a run, a
     * 170-year cooldown, and the steepest drought gain in the game, because
     * "a run WILL get its mythic moments". It has never needed draw weight,
     * and at 5 it had almost none: the whole tier fired about 1.1 times a
     * run against a cap of 3, and every common drop pushed it further down.
     * A hundred new common templates took it to 0.67, which is most runs
     * seeing none at all.
     *
     * Measured over 24 thousand-year runs, moving only this: 5 -> 0.67,
     * 9 -> 1.13, 14 -> 1.17. The drought curve is doing the work in all
     * three and 9 is where it gets to finish before the year is spent on
     * something else. The RATION is untouched — still three a run, still
     * 170 years apart, still generation eight before the first one.
     */
    weight: 9,
    perRunCap: 3,
    cooldownYears: 170,
    minGeneration: 8,
    record: 'required',
    rumour: 'always',
    chronicle: 'illuminated',
    named: true,
    /** Steepest drought curve in the game: a run WILL get its mythic moments. */
    droughtGainPerCentury: 14,
    /** Once ever. A Mythic event that can repeat is not mythic. */
    maxFiresPerTemplate: 1,
  },
};

/** Runtime bookkeeping the scheduler needs to enforce all of the above. */
export interface FrequencyLedger {
  firedThisRun: Record<Frequency, number>;
  lastFiredYear: Record<Frequency, number | null>;
  /** eventId -> times fired. Enforces maxFiresPerTemplate. */
  templateFires: Record<string, number>;
  /**
   * eventId -> the year it last fired, which is what a TEMPLATE'S OWN ration
   * needs: `repeatable` and `cooldownYears` are authored on every event and
   * were read by nothing outside the frame lane (invariant 11). Nine shipped
   * templates say `repeatable: false` and seventeen carry a cooldown, and
   * every one of those twenty-six declarations was inert.
   */
  templateLastFired: Record<string, number>;
}

export function emptyFrequencyLedger(): FrequencyLedger {
  return {
    firedThisRun: { common: 0, uncommon: 0, rare: 0, mythic: 0 },
    lastFiredYear: { common: null, uncommon: null, rare: null, mythic: null },
    templateFires: {},
    templateLastFired: {},
  };
}

/**
 * The whole rationing rule in one function, so there is exactly one place to
 * read and exactly one place to tune. Returns 0 when the tier is barred.
 */
export function frequencyWeight(
  freq: Frequency,
  ledger: FrequencyLedger,
  year: number,
  generation: number,
): number {
  const p = FREQUENCY_PROFILES[freq];

  if (generation < p.minGeneration) return 0;
  if (p.perRunCap !== null && ledger.firedThisRun[freq] >= p.perRunCap) return 0;

  const last = ledger.lastFiredYear[freq];
  if (last !== null && year - last < p.cooldownYears) return 0;

  // Drought: years past the cooldown with nothing of this tier.
  const since = last === null ? year : year - last;
  const drought = Math.max(0, since - p.cooldownYears);
  const multiplier = 1 + (p.droughtGainPerCentury * drought) / 100;

  return p.weight * multiplier;
}

export function canTemplateFire(eventId: string, freq: Frequency, ledger: FrequencyLedger): boolean {
  const fires = ledger.templateFires[eventId] ?? 0;
  return fires < FREQUENCY_PROFILES[freq].maxFiresPerTemplate;
}

/**
 * THE TEMPLATE'S OWN RATION, as opposed to its tier's.
 *
 * `repeatable` and `cooldownYears` are fields the AUTHOR writes on the event —
 * "this happens once to a family", "not again for forty years" — and until
 * issue #41 the only lane that read them was the frame's. Everywhere else
 * they typechecked, validated, saved, and did nothing: `portions.yaml`,
 * `corran.yaml` and `regalia.yaml` each declare a one-shot that could fire
 * twice, and seventeen Age templates declare cooldowns of twelve to sixty
 * years that never held anything back.
 *
 * It is kept separate from `canTemplateFire` because they ration different
 * things and are owed to different people: that one is the TIER's ceiling and
 * belongs to this file, this one is the author's and belongs to the YAML.
 * Arc nodes never reach either — they are excluded from both pools by
 * construction and fire because their substory came due.
 */
export function templateRationAllows(
  e: { id: string; repeatable: boolean; cooldownYears: number },
  ledger: FrequencyLedger,
  year: number,
): boolean {
  const last = ledger.templateLastFired[e.id];
  if (last === undefined) return true;
  if (!e.repeatable) return false;
  return year - last >= e.cooldownYears;
}

export function recordFire(eventId: string, freq: Frequency, ledger: FrequencyLedger, year: number): void {
  ledger.firedThisRun[freq] += 1;
  ledger.lastFiredYear[freq] = year;
  recordTemplateFire(eventId, ledger, year);
}

/**
 * A firing that counts as ITSELF and does not spend the tier's ration.
 *
 * INVARIANT An event that never draws from a ration must not spend it.
 *
 * The tier ration — `firedThisRun` against `perRunCap`, `lastFiredYear`
 * against `cooldownYears` — is the scheduler's, and the scheduler only ever
 * consults it for events drawn from the ambient and pressure pools. An event
 * carrying an `arc` block is excluded from those pools by construction
 * (`selection.ts`: `if (e.arc) return false`); it fires because its substory
 * came due, and no cooldown is ever asked about it.
 *
 * Recording one as a tier firing anyway was invariant 7's failure one level
 * down: rare is capped at 22 a run with a 55-year global cooldown, so every
 * rare climax of every substory silently barred every AMBIENT rare set-piece
 * in the game for fifty-five years and ate the run's cap. The more substories
 * a version of this game had, the less of its own authored rare content any
 * player would ever see, and nothing anywhere reported it — the events simply
 * stopped being drawn.
 *
 * `templateFires` is different and is still written: it is per-template
 * bookkeeping, it enforces `maxFiresPerTemplate`, and both reach gates read it.
 */
export function recordTemplateFire(eventId: string, ledger: FrequencyLedger, year: number): void {
  ledger.templateFires[eventId] = (ledger.templateFires[eventId] ?? 0) + 1;
  ledger.templateLastFired[eventId] = year;
}
