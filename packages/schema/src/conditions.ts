import { z } from 'zod';
import { RungS, type Rung } from './rung.js';

export const CompareOpS = z.enum(['lt', 'lte', 'eq', 'gte', 'gt', 'ne']);
export type CompareOp = z.infer<typeof CompareOpS>;

export function compare(a: number, op: CompareOp, b: number): boolean {
  switch (op) {
    case 'lt': return a < b;
    case 'lte': return a <= b;
    case 'eq': return a === b;
    case 'gte': return a >= b;
    case 'gt': return a > b;
    case 'ne': return a !== b;
  }
}

export const RespectTierS = z.enum(['unknown', 'known', 'regarded', 'eminent', 'exalted']);
export type RespectTier = z.infer<typeof RespectTierS>;
export const RESPECT_ORDER: RespectTier[] = ['unknown', 'known', 'regarded', 'eminent', 'exalted'];

export const RegisterS = z.enum(['warm', 'cold', 'institutional']);
export type Register = z.infer<typeof RegisterS>;

export const DiscrepancyStateS = z.enum(['open', 'proven', 'buried']);
export type DiscrepancyState = z.infer<typeof DiscrepancyStateS>;

/**
 * Conditions gate on world state. Slot fillability is checked separately and
 * later, because it is far more expensive (see core/events/selection.ts).
 */
export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { flag: string; is?: boolean }
  | { knowledge: string; has: boolean }
  | { respect: { op: CompareOp; tier: RespectTier } }
  | { year: { op: CompareOp; value: number } }
  | { generation: { op: CompareOp; value: number } }
  | { treasury: { op: CompareOp; value: number } }
  | { clausesRecovered: { op: CompareOp; value: number } }
  | { familyAny: { attr: string; atLeast: number } }
  | { familySize: { op: CompareOp; value: number } }
  | { inRegency: boolean }
  | { hasExpressingHead: boolean }
  // ── Cadet branches (concept §16, §22) ────────────────────────────────
  /** Living cadet branches. A house with none is a house with one household. */
  | { cadetBranches: { op: CompareOp; value: number } }
  /** The angriest branch's grievance, 0–100. */
  | { branchGrievance: { op: CompareOp; value: number } }
  | { discontent: { op: CompareOp; value: number } }
  /** The worst live grudge anyone holds against the player's house, 0–100. */
  | { grudgeAgainstUs: { op: CompareOp; value: number } }
  // ── Age gating (concept §20) ─────────────────────────────────────────
  | { ageActive: string }
  | { ageRegister: Register }
  | { ageElapsed: { op: CompareOp; years: number } }
  | { ageStacked: { op: CompareOp; count: number } }
  | { ageNamed: boolean }
  /**
   * HOW MANY AGES THE HOUSE HAS LIVED THROUGH — the run's own clock, in the
   * unit §20 measures a run in (issue #46).
   *
   * `year` and `generation` both answer "how far in are we" and both answer it
   * in the wrong unit for a motif: an Age is a hazard process, so two runs at
   * year 1400 may have seen three Ages or nine, and a reading assigned to the
   * house's third Age has to arrive in its third Age rather than in its third
   * century. Counted off `world.age.ended`, so the Age currently running is
   * not counted until the house is out of it.
   */
  | { agesElapsed: { op: CompareOp; value: number } }
  // ── Discrepancies (concept §6, §19; issue #9) ────────────────────────
  /** One named Discrepancy's state. Omit `state` to ask only whether it exists at all. */
  | { discrepancy: string; state?: DiscrepancyState }
  /** How many are currently open — the PRESSURE pass's own signal. */
  | { openDiscrepancies: { op: CompareOp; value: number } }
  /**
   * THE ASSIZE (`core/src/assize.ts`) — how the world currently reads the
   * house, in [-1, 1]. Positive is ahead of where a house should be by now,
   * negative is behind, and the bar it is measured against rises across the
   * run. Gate content on it to write the scenes only a house in trouble gets,
   * and the ones only a house everybody resents gets.
   */
  | { assize: { op: CompareOp; value: number } }
  /**
   * BEARING (`core/src/bearing.ts`, concept §29) — how the house has carried
   * itself, in [0, 1], as distinct from how it is doing. Read off acts the
   * player took at least two generations ago, plus the halls it has left
   * angry and the seat it has sat on.
   *
   * Content gated on this must obey §29's first rule: NEVER NAME IT. There is
   * no player-facing word for this number, `prose/bearing` fails the build on
   * the four that would be, and a scene that gates on it says what the world
   * DID and never why. Nobody in the house knows this is being read.
   */
  | { bearing: { op: CompareOp; value: number } }
  /**
   * HOW MANY TIMES SOMEBODY HAD SOMETHING TO SAY AND DID NOT SAY IT (§29
   * stage 3, issue #45).
   *
   * The trace, and the only thing that makes the suppression fair: a player
   * who is never told, and can never afterwards find out that they were not
   * told, is a player being handed bad dice. Content gates on this to put the
   * fact in front of them years later — in somebody else's account, which is
   * §29 rule 4's own channel.
   */
  | { unheard: { op: CompareOp; value: number } }
  /**
   * THE ASCENSION LADDER (`core/src/ascension.ts`, concept §22). Gate content
   * on how far up the house has actually got. `best: true` asks the high-water
   * mark — what the family ever reached — rather than where it stands now,
   * which is what a scene about a dead Hierophant needs.
   */
  | { ascension: { atLeast: Rung; best?: boolean } }
  // ── Arc memory ────────────────────────────────────────────────────────
  /**
   * A flag this run of the substory set on itself, via the `arc_flag` effect.
   * Only meaningful where an arc is in scope — a successor's `when`, or the
   * conditions of an event firing as one of its nodes. Asked anywhere else it
   * is FALSE, never true: the permissive default is the expensive one, and a
   * story-local memory that answers yes to the ambient pool would fire content
   * for a story that is not running.
   */
  | { arcFlag: string; is?: boolean | number | string }
  /** Has this run of the substory already resolved that node? */
  | { arcVisited: string }
  // ── Unlocks (issue #11) ───────────────────────────────────────────────
  /**
   * Does anyone in the household hold a trait whose `unlock` modifier grants
   * this string? Presence only — reads the household live, same as every
   * other presence effect, so there is no world state to save or drift.
   */
  | { unlocked: string };

export const ConditionS: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(ConditionS) }),
    z.object({ any: z.array(ConditionS) }),
    z.object({ not: ConditionS }),
    z.object({ flag: z.string(), is: z.boolean().optional() }),
    z.object({ knowledge: z.string(), has: z.boolean() }),
    z.object({ respect: z.object({ op: CompareOpS, tier: RespectTierS }) }),
    z.object({ year: z.object({ op: CompareOpS, value: z.number() }) }),
    z.object({ generation: z.object({ op: CompareOpS, value: z.number() }) }),
    z.object({ treasury: z.object({ op: CompareOpS, value: z.number() }) }),
    z.object({ clausesRecovered: z.object({ op: CompareOpS, value: z.number() }) }),
    z.object({ familyAny: z.object({ attr: z.string(), atLeast: z.number() }) }),
    z.object({ familySize: z.object({ op: CompareOpS, value: z.number() }) }),
    z.object({ inRegency: z.boolean() }),
    z.object({ hasExpressingHead: z.boolean() }),
    z.object({ cadetBranches: z.object({ op: CompareOpS, value: z.number() }) }),
    z.object({ branchGrievance: z.object({ op: CompareOpS, value: z.number() }) }),
    z.object({ discontent: z.object({ op: CompareOpS, value: z.number() }) }),
    z.object({ grudgeAgainstUs: z.object({ op: CompareOpS, value: z.number() }) }),
    z.object({ ageActive: z.string() }),
    z.object({ ageRegister: RegisterS }),
    z.object({ ageElapsed: z.object({ op: CompareOpS, years: z.number() }) }),
    z.object({ ageStacked: z.object({ op: CompareOpS, count: z.number() }) }),
    z.object({ agesElapsed: z.object({ op: CompareOpS, value: z.number() }) }),
    z.object({ ageNamed: z.boolean() }),
    z.object({ discrepancy: z.string(), state: DiscrepancyStateS.optional() }),
    z.object({ openDiscrepancies: z.object({ op: CompareOpS, value: z.number() }) }),
    z.object({ assize: z.object({ op: CompareOpS, value: z.number() }) }),
    z.object({ bearing: z.object({ op: CompareOpS, value: z.number() }) }),
    z.object({ unheard: z.object({ op: CompareOpS, value: z.number() }) }),
    z.object({ ascension: z.object({ atLeast: RungS, best: z.boolean().optional() }) }),
    z.object({ arcFlag: z.string(), is: z.union([z.boolean(), z.number(), z.string()]).optional() }),
    z.object({ arcVisited: z.string() }),
    z.object({ unlocked: z.string() }),
  ]),
);

/** Filters run against a person, not against the world. */
export type Filter =
  | { attr: string; op: CompareOp; value: number }
  | { trait: string; has: boolean }
  | { tag: string; has: boolean }
  | { sex: 'male' | 'female' }
  | { age: { op: CompareOp; value: number } }
  | { status: string[] }
  | { membership: string[] }
  | { career: string[] }
  | { awakened: boolean }
  | { canExpress: boolean }
  | { relation: 'not' | 'child_of' | 'sibling_of' | 'spouse_of' | 'blood_of'; of: string }
  | { all: Filter[] }
  | { any: Filter[] }
  | { not: Filter };

export const FilterS: z.ZodType<Filter> = z.lazy(() =>
  z.union([
    z.object({ attr: z.string(), op: CompareOpS, value: z.number() }),
    z.object({ trait: z.string(), has: z.boolean() }),
    z.object({ tag: z.string(), has: z.boolean() }),
    z.object({ sex: z.enum(['male', 'female']) }),
    z.object({ age: z.object({ op: CompareOpS, value: z.number() }) }),
    z.object({ status: z.array(z.string()) }),
    z.object({ membership: z.array(z.string()) }),
    /**
     * Holds one of these posts, by career id. Set membership on `Person.career`,
     * exactly as `status` is on `Person.status` — negate with `not`.
     *
     * There was no way to ask this, which is why `op: leave` on the `career`
     * effect could only be aimed through a proxy: the one trait a soldier earns
     * after ten years. That made leaving a post reachable in 4% of runs and
     * gated the whole verb behind a decade of survival.
     */
    z.object({ career: z.array(z.string()).min(1) }),
    z.object({ awakened: z.boolean() }),
    z.object({ canExpress: z.boolean() }),
    z.object({ relation: z.enum(['not', 'child_of', 'sibling_of', 'spouse_of', 'blood_of']), of: z.string() }),
    z.object({ all: z.array(FilterS) }),
    z.object({ any: z.array(FilterS) }),
    z.object({ not: FilterS }),
  ]),
);
