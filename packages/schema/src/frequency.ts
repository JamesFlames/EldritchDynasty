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
    weight: 240,
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
     * rare content as it does now.
     */
    weight: 70,
    perRunCap: 22,
    cooldownYears: 55,
    minGeneration: 4,
    record: 'required',
    rumour: 'always',
    chronicle: 'page',
    named: true,
    droughtGainPerCentury: 3,
    maxFiresPerTemplate: 2,
  },
  mythic: {
    weight: 5,
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
}

export function emptyFrequencyLedger(): FrequencyLedger {
  return {
    firedThisRun: { common: 0, uncommon: 0, rare: 0, mythic: 0 },
    lastFiredYear: { common: null, uncommon: null, rare: null, mythic: null },
    templateFires: {},
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

export function recordFire(eventId: string, freq: Frequency, ledger: FrequencyLedger, year: number): void {
  ledger.firedThisRun[freq] += 1;
  ledger.lastFiredYear[freq] = year;
  recordTemplateFire(eventId, ledger);
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
export function recordTemplateFire(eventId: string, ledger: FrequencyLedger): void {
  ledger.templateFires[eventId] = (ledger.templateFires[eventId] ?? 0) + 1;
}
