import type { EventTemplate, Frequency } from '@ed/schema';
import { FREQUENCY_PROFILES, canTemplateFire, frequencyWeight } from '@ed/schema';
import type { SimCtx } from '../world.js';
import { evalCondition } from './conditions.js';
import { resolveSlots, type SlotFill } from './slots.js';
import type { Rng } from '../rng.js';
import { activeAgeIds } from '../ages/scheduler.js';

export interface Candidate {
  event: EventTemplate;
  fill: SlotFill;
  playerCast: string[];
  source: 'forced' | 'pressure' | 'ambient';
}

/**
 * SELECTION
 * =========
 * Three passes, in order:
 *
 *   1. FORCED   arc continuations that are due, scheduled follow-ups, and
 *               clause reveals owed by the current Age. These consume the
 *               generation's event budget before anything else is considered.
 *   2. PRESSURE state-driven demands — high discontent, madness near overflow,
 *               an open Discrepancy near proof. Weighted, but drawn from a pool
 *               that only exists because the family is in that state.
 *   3. AMBIENT  weighted random from everything eligible, gated by FREQUENCY.
 *
 * Eligibility is two-phase for cost. The condition prefilter is cheap and runs
 * over the whole pool; slot resolution is expensive and runs only on sampled
 * candidates. A candidate whose slots cannot fill is discarded and the sample
 * is redrawn.
 */
export function selectEvents(ctx: SimCtx, rng: Rng, budget: number): Candidate[] {
  const out: Candidate[] = [];

  for (const c of forcedCandidates(ctx, rng)) {
    if (out.length >= budget) break;
    out.push(c);
  }

  const pool = ambientPool(ctx);
  let guard = 0;
  while (out.length < budget && guard < 60) {
    guard += 1;
    const remaining = pool.filter((e) => !out.some((c) => c.event.id === e.id));
    if (!remaining.length) break;

    const chosen = rng.weighted(remaining, (e) => drawWeight(e, ctx));
    if (!chosen) break;

    const res = resolveSlots(chosen, ctx, rng);
    if (!res.ok) {
      // Unfillable: discard and redraw. This is the single largest source of
      // between-run variety, so it must be cheap and it must be silent.
      pool.splice(pool.indexOf(chosen), 1);
      continue;
    }
    out.push({ event: chosen, fill: res.fill, playerCast: res.playerCast, source: 'ambient' });
  }

  return out;
}

/** Everything that passes the cheap gates. Slots are NOT resolved here. */
export function ambientPool(ctx: SimCtx): EventTemplate[] {
  const w = ctx.world;
  const active = activeAgeIds(ctx);

  return ctx.bundle.events.filter((e) => {
    if (e.tier === 'frame') return false;
    if (e.arc) return false;                       // arc nodes fire via the arc
    if (!canTemplateFire(e.id, e.frequency, w.frequency)) return false;

    // Age scoping is a declarative field precisely so it can be checked first:
    // it is the cheapest possible prefilter and it skips whole buckets.
    if (e.ages?.only && !e.ages.only.some((a) => active.includes(a))) return false;
    if (e.ages?.never && e.ages.never.some((a) => active.includes(a))) return false;
    if (e.ages?.register) {
      const regs = active.map((a) => ctx.bundle.ages.find((d) => d.id === a)?.register);
      if (!e.ages.register.some((r) => regs.includes(r))) return false;
    }

    if (frequencyWeight(e.frequency, w.frequency, w.year, w.generation) <= 0) return false;
    return evalCondition(e.conditions, ctx);
  });
}

/**
 * Final draw weight. Frequency is the heavy lifter; the per-template `weight`
 * is a nudge WITHIN its tier, not across tiers.
 */
export function drawWeight(e: EventTemplate, ctx: SimCtx): number {
  const w = ctx.world;
  let weight = frequencyWeight(e.frequency, w.frequency, w.year, w.generation) * (e.weight / 100);

  // An Age's own scenes are the entire reason it has a name. Without this
  // boost, a twenty-year Age never shows the player anything specific to it.
  if (e.ages?.only?.length) weight *= AGE_EXCLUSIVE_BOOST;

  // Presence influence: traits held by living members reweight the pool.
  weight *= presenceMultiplier(e, ctx);
  return weight;
}

export const AGE_EXCLUSIVE_BOOST = 4;

function presenceMultiplier(e: EventTemplate, ctx: SimCtx): number {
  let mult = 1;
  const w = ctx.world;
  const household = w.people.household(w.playerHouse, w.year);

  for (const p of household) {
    for (const tid of p.traits) {
      const trait = ctx.bundle.traits.find((t) => (t.id as unknown as string) === (tid as unknown as string));
      if (!trait) continue;
      for (const pres of trait.presence) {
        for (const m of pres.modifiers) {
          if (m.kind === 'suppress' && matches(m.match, e)) return 0;
          if (m.kind === 'event_weight' && matches(m.match, e)) {
            if (m.multiply !== undefined) mult *= m.multiply;
            if (m.add !== undefined) mult += m.add;
          }
        }
      }
    }
  }
  return Math.max(0, mult);
}

function matches(match: { tags?: unknown[]; ids?: string[]; tier?: string[]; frequency?: string[] }, e: EventTemplate): boolean {
  if (match.ids?.length && !match.ids.includes(e.id)) return false;
  if (match.tier?.length && !match.tier.includes(e.tier)) return false;
  if (match.frequency?.length && !match.frequency.includes(e.frequency)) return false;
  if (match.tags?.length) {
    const tags = match.tags as string[];
    if (!tags.some((t) => e.tags.includes(t))) return false;
  }
  return true;
}

function forcedCandidates(ctx: SimCtx, rng: Rng): Candidate[] {
  const w = ctx.world;
  const out: Candidate[] = [];

  for (const s of [...w.scheduled]) {
    if (s.year > w.year) continue;
    const e = ctx.bundle.events.find((x) => x.id === s.event);
    w.scheduled = w.scheduled.filter((x) => x !== s);
    if (!e) continue;
    const res = resolveSlots(e, ctx, rng);
    if (res.ok) out.push({ event: e, fill: res.fill, playerCast: res.playerCast, source: 'forced' });
  }

  return out;
}

/** Diagnostics for the editor: what does each tier actually look like? */
export function frequencyReport(ctx: SimCtx): Record<Frequency, { pool: number; fired: number; barred: boolean; weight: number }> {
  const w = ctx.world;
  const out = {} as Record<Frequency, { pool: number; fired: number; barred: boolean; weight: number }>;
  for (const f of Object.keys(FREQUENCY_PROFILES) as Frequency[]) {
    const weight = frequencyWeight(f, w.frequency, w.year, w.generation);
    out[f] = {
      pool: ctx.bundle.events.filter((e) => e.frequency === f).length,
      fired: w.frequency.firedThisRun[f],
      barred: weight <= 0,
      weight,
    };
  }
  return out;
}
