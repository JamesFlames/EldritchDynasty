import type { Choice, EventTemplate, LoggedDecision, Outcome, Person, Year } from '@ed/schema';
import { compare, recordFire } from '@ed/schema';
import type { SimCtx } from '../world.js';
import type { Rng } from '../rng.js';
import { influencedAttr } from './influence.js';
import { candidatesFor, renderBody, type SlotFill } from './slots.js';
import { applyEffect, applyOutcome, type ResolvedEvent } from './effects.js';
import { resolveChoiceOutcome } from './checks.js';
import { advanceArc, startArc, type ArcStep } from './arcs.js';
import { resolveClaim } from '../record.js';

/**
 * PLAYER CHOICE.
 *
 * `stepYear(ctx, autoResolve)` used to pick a choice at random and move on,
 * which meant the single verb the design is built around — deciding — was the
 * one thing the simulation did for you. The Record block (Record / Omit /
 * Embellish) was authored in half a dozen templates and read by nothing at all.
 *
 * This module is the docket. An event that wants a decision is parked here
 * instead of being resolved, the year does not advance while it stands, and
 * the player answers it with `resolveChoice` or `resolveRecord`. Auto-resolve
 * is still there and still deterministic — it is what the harness runs, and it
 * is what "let the chronicler decide" means in the editor.
 */

export type RecordOption = 'record' | 'omit' | 'embellish';

export interface DecisionChoice {
  id: string;
  label: string;
  /**
   * Visibly unavailable choices are themselves information (concept §16), so
   * they are listed rather than filtered out, with the reason attached.
   */
  available: boolean;
  blockedBy?: string;
}

/** A slot the player fills himself. This is the whole of the mission mechanic. */
export interface CastRequest {
  slot: string;
  optional: boolean;
  candidates: { id: string; name: string; age: number }[];
}

export interface PendingChoice {
  kind: 'choice';
  id: string;
  year: Year;
  event: EventTemplate;
  /** Rendered with the slots already filled — what the player actually reads. */
  body: string;
  fill: SlotFill;
  choices: DecisionChoice[];
  cast: CastRequest[];
  /** Present when this event is a node of a running substory. */
  arcStep?: ArcStep;
}

export interface PendingRecord {
  kind: 'record';
  id: string;
  year: Year;
  event: EventTemplate;
  subject: string;
  options: { option: RecordOption; chronicle: string | null; discrepancy?: string }[];
  /** The chronicle entry this event's outcome created. See `applyRecord` (issue #8). */
  entryId: string;
  /** The cast this firing actually resolved against — claims (issue #19) target these people. */
  fill: SlotFill;
}

export type PendingDecision = PendingChoice | PendingRecord;

function decisionId(ctx: SimCtx): string {
  return `dec_${(ctx.world.counters.decision += 1).toString(36)}`;
}

// ── Availability ──────────────────────────────────────────────────────────

/**
 * `requires` reads attributes off the people already cast in the event, which
 * is why it is checked at ask time rather than at authoring time: the same
 * choice is open to one generation and closed to the next, and that difference
 * is the game.
 */
export function choiceAvailability(c: Choice, ctx: SimCtx, fill: SlotFill, event: EventTemplate): DecisionChoice {
  for (const req of c.requires) {
    const p = ctx.world.people.get(fill[req.slot] ?? '');
    if (!p) {
      return { id: c.id, label: c.label, available: false, blockedBy: `nobody stands as ${req.slot}` };
    }
    const role = event.slots[req.slot]?.role;
    const have = influencedAttr(ctx, p, req.attr, role);
    if (!compare(have, req.op, req.value)) {
      return {
        id: c.id,
        label: c.label,
        available: false,
        blockedBy: `${p.name}'s ${req.attr} is ${Math.round(have)}`,
      };
    }
  }
  return { id: c.id, label: c.label, available: true };
}

/** What the player may be asked to cast, and who is standing there to be cast. */
export function castRequests(e: EventTemplate, ctx: SimCtx, fill: SlotFill, slots: string[]): CastRequest[] {
  return slots.map((slot) => {
    const spec = e.slots[slot];
    const people: Person[] = spec ? candidatesFor(spec, ctx, fill) : [];
    return {
      slot,
      optional: spec?.optional ?? false,
      candidates: people.map((p) => ({
        id: p.id,
        name: p.name,
        age: ctx.world.year - p.born,
      })),
    };
  });
}

// ── Queueing ──────────────────────────────────────────────────────────────

export function queueChoice(
  ctx: SimCtx,
  e: EventTemplate,
  body: string,
  fill: SlotFill,
  playerCast: string[],
  arcStep?: ArcStep,
): PendingChoice {
  const choices = e.interaction.kind === 'narration' ? [] : e.interaction.choices;
  const pending: PendingChoice = {
    kind: 'choice',
    id: decisionId(ctx),
    year: ctx.world.year,
    event: { ...e, body },
    body: renderBody(body, fill, ctx),
    fill,
    choices: choices.map((c) => choiceAvailability(c, ctx, fill, e)),
    cast: castRequests(e, ctx, fill, playerCast),
    arcStep,
  };
  ctx.world.pendingDecisions.push(pending);
  return pending;
}

export function queueRecord(ctx: SimCtx, e: EventTemplate, entryId: string, fill: SlotFill = {}): PendingRecord | undefined {
  if (!e.record) return undefined;
  const o = e.record.options;
  const pending: PendingRecord = {
    kind: 'record',
    id: decisionId(ctx),
    year: ctx.world.year,
    event: e,
    subject: e.record.subject,
    options: [
      { option: 'record', chronicle: o.record.chronicle },
      { option: 'omit', chronicle: null },
      { option: 'embellish', chronicle: o.embellish.chronicle, discrepancy: o.embellish.discrepancy.id },
    ],
    entryId,
    fill,
  };
  ctx.world.pendingDecisions.push(pending);
  return pending;
}

// ── Resolution ────────────────────────────────────────────────────────────

/**
 * The one commit path. Auto-resolve and the player both come through here, so
 * there is exactly one place that applies an outcome, spends the event's
 * frequency ration, starts substories and advances the arc it belongs to.
 *
 * Two of those used to happen only on the ambient path: an arc node that
 * started another arc did nothing at all, and it did it silently.
 *
 * `choiceId` is `undefined` for narration, which has nothing to choose. It
 * exists on the signature (issue #8) because this is where the decision log
 * is written, and without it a log entry could not say WHICH choice a
 * multi-choice event resolved without reverse-searching the template for an
 * outcome id that may not even be unique across its choices.
 */
// INVARIANT 9: the ONE commit path. Player and chronicler both come through here.
export function commitOutcome(
  ctx: SimCtx,
  e: EventTemplate,
  outcome: Outcome,
  fill: SlotFill,
  choiceId: string | undefined,
  rng: Rng,
  arcStep?: ArcStep,
): ResolvedEvent {
  const resolved = applyOutcome(e, outcome, ctx, fill);
  recordFire(e.id, e.frequency, ctx.world.frequency, ctx.world.year);

  const entry: LoggedDecision = {
    kind: 'outcome',
    year: ctx.world.year,
    event: e.id,
    ...(choiceId !== undefined ? { choiceId } : {}),
    outcomeId: outcome.id,
    fill: { ...fill },
  };
  ctx.world.decisionLog.push(entry);

  const arcOps = [
    ...outcome.effects.filter((eff) => eff.kind === 'arc' && eff.op === 'start').map((eff) => (eff as { arc: string }).arc),
    ...(outcome.triggers?.op === 'start' ? [outcome.triggers.arc] : []),
  ];
  for (const id of arcOps) {
    const arc = ctx.content.arc(id);
    if (arc) startArc(arc, ctx, rng, fill);
  }

  if (arcStep) advanceArc(arcStep, outcome.id, ctx, rng);
  return resolved;
}

export interface ChoiceResolution {
  ok: boolean;
  reason?: string;
  resolved?: ResolvedEvent;
}

/**
 * Answer a pending choice. `cast` supplies the people for any `castBy: player`
 * slots; a missing non-optional cast is a refusal, not a silent default.
 */
export function resolveChoice(
  ctx: SimCtx,
  decision: string,
  choiceId: string,
  rng: Rng,
  cast: SlotFill = {},
): ChoiceResolution {
  const pending = ctx.world.pendingDecisions.find((d) => d.id === decision);
  if (!pending || pending.kind !== 'choice') return { ok: false, reason: 'no such decision' };

  const e = pending.event;
  if (e.interaction.kind === 'narration') return { ok: false, reason: 'narration takes no choice' };

  const choice = e.interaction.choices.find((c) => c.id === choiceId);
  if (!choice) return { ok: false, reason: `no choice '${choiceId}'` };

  const availability = choiceAvailability(choice, ctx, pending.fill, e);
  if (!availability.available) return { ok: false, reason: availability.blockedBy ?? 'unavailable' };

  const fill: SlotFill = { ...pending.fill };
  for (const req of pending.cast) {
    const chosen = cast[req.slot];
    if (chosen && req.candidates.some((c) => c.id === chosen)) fill[req.slot] = chosen;
    else if (!req.optional) return { ok: false, reason: `nobody cast as ${req.slot}` };
  }

  drop(ctx, decision);
  const outcome = resolveChoiceOutcome(ctx, e, choice, fill, rng);
  const resolved = commitOutcome(ctx, e, outcome, fill, choice.id, rng, pending.arcStep);
  queueRecord(ctx, e, resolved.entryId, fill);
  return { ok: true, resolved };
}

/**
 * Record / Omit / Embellish — the mechanical form of the thesis (concept §6).
 *
 * The event already wrote itself into the chronicle when it resolved. This
 * REWRITES that entry rather than adding a second one, because the chronicle
 * is not a log of what happened: it is what the family says happened, and
 * there is only ever one line about a thing.
 */
export function resolveRecord(ctx: SimCtx, decision: string, option: RecordOption): boolean {
  const pending = ctx.world.pendingDecisions.find((d) => d.id === decision);
  if (!pending || pending.kind !== 'record') return false;
  drop(ctx, decision);
  applyRecord(ctx, pending.event, pending.entryId, option, pending.fill);
  return true;
}

/**
 * `entryId` is the chronicle entry THIS event's outcome created (issue #8) —
 * found by identity rather than by `(eventId, year)`, which rewrote the
 * wrong line the moment one template fired twice in a year (two arc steps
 * due the same year sharing a node, most plausibly).
 */
export function applyRecord(ctx: SimCtx, e: EventTemplate, entryId: string, option: RecordOption, fill: SlotFill = {}): void {
  const block = e.record;
  if (!block) return;
  const w = ctx.world;
  const chosen = block.options[option];

  for (const eff of chosen.effects) applyEffect(eff, ctx, fill);

  if (option === 'record' && block.options.record.grantsKnowledge) {
    w.knowledge.add(block.options.record.grantsKnowledge);
  }

  let discrepancyId: string | undefined;
  if (option === 'embellish') {
    const d = block.options.embellish.discrepancy;
    w.discrepancies.set(d.id, { severity: d.severity, provableBy: d.provableBy, state: 'open' });
    discrepancyId = d.id;
  }

  w.decisionLog.push({ kind: 'record', year: w.year, event: e.id, option });

  // What the option's chronicle text actually CLAIMS (issue #19), resolved
  // against the cast this firing used. `omit` writes nothing to claim
  // anything with — the blank is the artefact.
  const claims = option !== 'omit'
    ? (chosen as { claims?: typeof block.options.record.claims }).claims?.flatMap((c) => resolveClaim(c, ctx, fill)) ?? []
    : [];

  // Find THIS firing's entry and overwrite what it says. An omission is a
  // DATED BLANK LINE, not a missing line — the blank is the artefact, and it
  // is the thing players screenshot.
  const entry = w.chronicle.find((c) => c.id === entryId);
  const text = option === 'omit' ? null : chosen.chronicle;
  if (entry) {
    entry.text = text;
    entry.record = option;
    if (option === 'omit') entry.title = undefined;
    if (discrepancyId) entry.discrepancyId = discrepancyId;
    entry.claims = claims.length ? claims : undefined;
  } else {
    w.chronicle.push({
      id: entryId, year: w.year, weight: 'paragraph', text, eventId: e.id, named: false, record: option,
      ...(discrepancyId ? { discrepancyId } : {}),
      ...(claims.length ? { claims } : {}),
    });
  }
}

function drop(ctx: SimCtx, decision: string): void {
  ctx.world.pendingDecisions = ctx.world.pendingDecisions.filter((d) => d.id !== decision);
}

// ── Letting the chronicler decide ─────────────────────────────────────────

/**
 * Auto-resolution, for the harness, the tests, and the player who fast-forwards
 * a century. Weighted rather than always-honest: the man holding the pen is a
 * person with his own instincts, and the design has never had a neutral
 * narrator to fall back on.
 */
export const CHRONICLER_POLICY: { option: RecordOption; weight: number }[] = [
  { option: 'record', weight: 55 },
  { option: 'omit', weight: 25 },
  { option: 'embellish', weight: 20 },
];

export function autoRecordOption(rng: Rng): RecordOption {
  return (rng.weighted(CHRONICLER_POLICY, (p) => p.weight) ?? CHRONICLER_POLICY[0]!).option;
}

/** Resolve one pending decision without asking. */
export function autoResolveDecision(ctx: SimCtx, decision: PendingDecision, rng: Rng): void {
  if (decision.kind === 'record') {
    resolveRecord(ctx, decision.id, autoRecordOption(rng));
    return;
  }
  const open = decision.choices.filter((c) => c.available);
  const chosen = rng.pick(open.length ? open : decision.choices);
  if (!chosen) { drop(ctx, decision.id); return; }

  const cast: SlotFill = {};
  for (const req of decision.cast) {
    const who = rng.pick(req.candidates);
    if (who) cast[req.slot] = who.id;
  }
  const res = resolveChoice(ctx, decision.id, chosen.id, rng, cast);
  // A choice whose cast could not be filled is not a choice. Drop it rather
  // than leaving a decision on the docket that blocks the year forever.
  if (!res.ok) drop(ctx, decision.id);
}

export function autoResolveAll(ctx: SimCtx, rng: Rng): void {
  let guard = 0;
  while (ctx.world.pendingDecisions.length && guard++ < 200) {
    autoResolveDecision(ctx, ctx.world.pendingDecisions[0]!, rng);
  }
}
