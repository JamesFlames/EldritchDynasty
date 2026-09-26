import type { EventTemplate } from '@ed/schema';
import type { SimCtx } from './world.js';
import { resolveChoice, resolveRecord, type PendingChoice, type PendingDecision, type PendingRecord, type RecordOption } from './events/decisions.js';
import { streamFor } from './rng.js';

export interface DelegationPreferences {
  choices: Record<string, string>;
  records: Record<string, RecordOption>;
}

export const EMPTY_DELEGATION: DelegationPreferences = { choices: {}, records: {} };

export type DelegationGuard =
  | 'rare'
  | 'cast'
  | 'arc'
  | 'heir'
  | 'sacrifice'
  | 'rite'
  | 'discrepancy'
  | 'ambition'
  | 'ending'
  | 'ambiguous';

function peopleNamed(d: PendingChoice | PendingRecord): string[] {
  const ids = Object.values(d.fill).flatMap((v) => Array.isArray(v) ? v : [v]).filter((v): v is string => typeof v === 'string');
  if (d.kind === 'choice') {
    for (const req of d.cast) ids.push(...req.candidates.map((c) => c.id));
  }
  return ids;
}

function authoredText(e: EventTemplate): string {
  return JSON.stringify({
    id: e.id,
    title: e.title,
    tags: e.tags,
    conditions: e.conditions,
    interaction: e.interaction,
  }).toLowerCase();
}

/**
 * The one interruption guard for delegated decisions (#219).
 *
 * Delegation is fail-safe: a case we cannot prove routine is surfaced. The
 * policy never invents an answer; it only reuses an answer the player explicitly
 * asked to reuse for this exact event.
 */
export function mustSurface(ctx: SimCtx, d: PendingDecision): DelegationGuard | undefined {
  if (d.kind === 'match') return 'ambiguous';
  const e = d.event;
  if (e.frequency === 'rare' || e.frequency === 'mythic') return 'rare';

  if (d.kind === 'choice') {
    if (d.arcStep) return 'arc';
    if (d.cast.length || !d.choicesAreOpen) return 'cast';
  }

  // A remembered Record answer can be standing just as easily as a remembered
  // branch answer. If the page is ABOUT the Head, Scion or named heir, it is
  // not harmless merely because the consequential event already resolved.
  const important = new Set([ctx.world.scion, ctx.world.scionHeir].filter((x): x is string => Boolean(x)));
  const head = ctx.world.people.living().find((p) => p.castSlots.includes('head'));
  if (head) important.add(head.id);
  if (peopleNamed(d).some((id) => important.has(id))) return 'heir';

  const text = authoredText(e);
  if (/sacrific|\bkill\b|\bdead\b|\bdeath\b/.test(text)) return 'sacrifice';
  if (/great_rite|vessel|unmaking|\brite\b/.test(text)) return 'rite';
  if (/discrepanc/.test(text)) return 'discrepancy';
  if (ctx.world.houseAmbition && /ambition/.test(text)) return 'ambition';
  if (/ending|ledger|ascension|hierophant|demigod|\bgod\b/.test(text)) return 'ending';

  // Record delegation is deliberately narrower: only "write it as it happened"
  // is routine. Omission and embellishment are authored moral choices.
  if (d.kind === 'record') {
    const policy = ctx.world.delegation.records[e.id];
    if (policy !== 'record') return 'ambiguous';
  }

  return undefined;
}

export function delegatedChoice(ctx: SimCtx, d: PendingChoice): string | undefined {
  const choice = ctx.world.delegation.choices[d.event.id];
  if (!choice || mustSurface(ctx, d)) return undefined;
  return d.choices.some((c) => c.id === choice && c.available) ? choice : undefined;
}

export function delegatedRecord(ctx: SimCtx, d: PendingRecord): RecordOption | undefined {
  const option = ctx.world.delegation.records[d.event.id];
  if (!option || mustSurface(ctx, d)) return undefined;
  return d.options.some((o) => o.option === option) ? option : undefined;
}

export function markDelegated(ctx: SimCtx, eventId: string, policy: string): void {
  for (let i = ctx.world.chronicle.length - 1; i >= 0; i--) {
    const entry = ctx.world.chronicle[i];
    if (entry?.eventId !== eventId || entry.year !== ctx.world.year) continue;
    entry.delegated = policy;
    return;
  }
}


/**
 * Drain only consecutive decisions proven safe to delegate. Kept outside
 * GameSession so it is an implementation seam, not a new player verb.
 */
export function resolveDelegated(ctx: SimCtx): void {
  for (;;) {
    const pending = ctx.world.pendingDecisions[0];
    if (!pending) return;
    if (pending.kind === 'choice') {
      const choice = delegatedChoice(ctx, pending);
      if (!choice) return;
      const result = resolveChoice(ctx, pending.id, choice, streamFor(ctx.world, 'decision', pending.id));
      if (!result.ok) return;
      markDelegated(ctx, pending.event.id, `choice:${choice}`);
      continue;
    }
    if (pending.kind === 'record') {
      const option = delegatedRecord(ctx, pending);
      if (!option) return;
      const eventId = pending.event.id;
      const result = resolveRecord(ctx, pending.id, option);
      if (!result.ok) return;
      markDelegated(ctx, eventId, `record:${option}`);
      continue;
    }
    return;
  }
}
