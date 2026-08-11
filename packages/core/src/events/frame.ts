import type { EventTemplate, FrameEntry, FrameRead } from '@ed/schema';
import type { SimCtx } from '../world.js';
import type { Rng } from '../rng.js';
import { evalCondition } from './conditions.js';
import { autoCast, renderBody, resolveSlots } from './slots.js';
import { pickOutcome } from './effects.js';

/**
 * THE FRAME (concept §2, Layer 1; issue #13).
 *
 * Everything else in a year draws from `ambientPool` and answers to the
 * shared Frequency ledger. The frame does neither: it is filtered out of
 * `ambientPool` on the first line, and every gate after that line assumes an
 * ambient event, so this module is the frame's own small, separate copy of
 * "what can fire, and did it."
 *
 *   framePool    everything currently eligible: tier `frame`, not fired yet,
 *                every declared `reads` currently true — a named Discrepancy
 *                in a given state, read straight off `world.discrepancies`.
 *   frameDue     the cadence — "every third or fourth generation" as a
 *                minimum gap plus a yearly roll, not a Frequency tier shared
 *                with anything ambient (invariant 7's shape: rationing that
 *                shares a ledger with an unrelated system steals from it).
 *   selectFrame  due, and something in the pool — the two checked together,
 *                because a due year with an empty pool is not a firing.
 *   presentFrame resolves the two listener slots, picks an outcome the same
 *                way ambient narration does, and writes the interlude to
 *                `world.frame.entries` — NOT `world.chronicle`. The frame is
 *                2042 reacting to the record; it is not part of the record.
 */

/** No two interludes closer than this. */
export const FRAME_MIN_GAP_YEARS = 28;

/** Rolled once per eligible year, once the minimum gap has passed. */
export const FRAME_CHANCE_PER_YEAR = 0.16;

/**
 * Does one `reads` entry hold? Reuses `evalCondition`'s own `discrepancy`
 * branch rather than a second copy of it — a read is exactly that condition,
 * just asked from a different tier for a different reason.
 */
function readHolds(ctx: SimCtx, r: FrameRead): boolean {
  return evalCondition({ discrepancy: r.discrepancy, ...(r.state !== undefined ? { state: r.state } : {}) }, ctx);
}

/**
 * Everything a frame event's own `reads` currently allows, and not shown too
 * recently. `repeatable` and `cooldownYears` get their first real reader
 * here — most interludes are one specific beat (`repeatable: false`); a few
 * are written to return for as long as the thing they react to stays true,
 * on their own cooldown, same as a rare ambient event's.
 */
export function framePool(ctx: SimCtx): EventTemplate[] {
  const w = ctx.world;
  return ctx.content.events.filter((e) => {
    if (e.tier !== 'frame') return false;
    const last = w.frame.firedAt[e.id];
    if (last !== undefined) {
      if (!e.repeatable) return false;
      if (w.year - last < e.cooldownYears) return false;
    }
    return e.reads.every((r) => readHolds(ctx, r));
  });
}

/** The cadence check alone, with no regard to what is actually in the pool. */
export function frameDue(ctx: SimCtx, rng: Rng): boolean {
  const w = ctx.world;
  if (w.frame.lastFired !== null && w.year - w.frame.lastFired < FRAME_MIN_GAP_YEARS) return false;
  return rng.next() < FRAME_CHANCE_PER_YEAR;
}

/** One frame template, weighted, or none if this is not a frame year. */
export function selectFrame(ctx: SimCtx, rng: Rng): EventTemplate | undefined {
  if (!frameDue(ctx, rng)) return undefined;
  const pool = framePool(ctx);
  if (!pool.length) return undefined;
  return rng.weighted(pool, (e) => e.weight);
}

/**
 * Show one interlude. `resolveSlots` and `renderBody` are the same functions
 * every other tier uses — the frame narrows its own two roles in
 * `events/slots.ts`, not here — so this is genuinely the whole of what
 * showing a frame scene requires beyond selection.
 */
export function presentFrame(ctx: SimCtx, e: EventTemplate, rng: Rng): FrameEntry | undefined {
  const w = ctx.world;
  if (e.interaction.kind !== 'narration') return undefined;

  const res = resolveSlots(e, ctx, rng);
  if (!res.ok) return undefined;
  const fill = autoCast(e, ctx, res.fill, res.playerCast, rng);

  const outcome = pickOutcome(e.interaction.outcomes, rng, ctx);
  const text = renderBody(outcome.text || e.body, fill, ctx);
  const entry: FrameEntry = { year: w.year, eventId: e.id, outcomeId: outcome.id, text };

  w.frame.entries.push(entry);
  w.frame.lastFired = w.year;
  w.frame.firedAt[e.id] = w.year;
  w.decisionLog.push({
    kind: 'outcome', year: w.year, event: e.id, outcomeId: outcome.id, fill: { ...fill },
  });

  return entry;
}
