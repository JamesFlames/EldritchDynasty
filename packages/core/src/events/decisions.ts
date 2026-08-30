import type { Decider, EventTemplate, LoggedDecision, Outcome, Person, Year } from '@ed/schema';
import { recordFire, recordTemplateFire } from '@ed/schema';
import type { SimCtx } from '../world.js';
import type { Rng } from '../rng.js';
import { candidatesFor, renderBody, type SlotFill } from './slots.js';
import { decideBranch } from './deciders.js';
import { choiceAvailability, type DecisionChoice } from './availability.js';
import { applyEffect, applyOutcome, type ResolvedEvent } from './effects.js';
import { resolveChoiceOutcome } from './checks.js';
import { advanceArc, startArc, type ArcStep } from './arcs.js';
import { resolveClaim } from '../record.js';
import { autoTakeCard, takeCard, type MatchCard, type MatchOffer } from '../people/match.js';

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
  /**
   * Who takes the branch (`schema/src/decider.ts`). A client reads this to know
   * WHAT it is being asked for: `player` means pick a branch, `party` means name
   * the party and the branch follows from who you named, and the other two never
   * reach the docket at all.
   */
  decidedBy: Decider;
  /**
   * False when the branch is not the player's to take — the docket is only
   * stopping the clock to collect a cast. A client that draws the choice list
   * regardless would be offering an answer it will not be allowed to give.
   */
  choicesAreOpen: boolean;
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

/**
 * THE MATCH (concept §5, step 2). Three cards and one marriage, and unlike
 * the other two kinds it is not an authored event at all — the deck is dealt
 * from who is alive and what the market has, so there is no `EventTemplate`
 * behind it and nothing for the editor to open. See `people/match.ts`.
 */
export interface PendingMatch {
  kind: 'match';
  id: string;
  year: Year;
  subject: MatchOffer['subject'];
  cards: MatchCard[];
}

export type PendingDecision = PendingChoice | PendingRecord | PendingMatch;

function decisionId(ctx: SimCtx): string {
  return `dec_${(ctx.world.counters.decision += 1).toString(36)}`;
}

// ── Availability ──────────────────────────────────────────────────────────

// `choiceAvailability` and `DecisionChoice` live in `availability.ts` — both the
// docket and `deciders.ts` ask the question, and `deciders.ts` cannot import
// this file. Re-exported so every existing importer keeps working.
export { choiceAvailability, type DecisionChoice };

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
  const decidedBy: Decider = e.interaction.kind === 'narration' ? 'chance' : e.interaction.decidedBy;
  const pending: PendingChoice = {
    kind: 'choice',
    id: decisionId(ctx),
    year: ctx.world.year,
    event: { ...e, body },
    body: renderBody(body, fill, ctx),
    fill,
    choices: choices.map((c) => choiceAvailability(c, ctx, fill, e)),
    cast: castRequests(e, ctx, fill, playerCast),
    decidedBy,
    choicesAreOpen: decidedBy === 'player',
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

export function queueMatch(ctx: SimCtx, offer: MatchOffer): PendingMatch {
  const pending: PendingMatch = {
    kind: 'match',
    id: decisionId(ctx),
    year: ctx.world.year,
    subject: offer.subject,
    cards: offer.cards,
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
  // The arc, if any, is in scope for the whole commit: `arc_flag` effects write
  // story-local memory, and a node that sets a flag its own successors read has
  // to have written it before `advanceArc` asks.
  const resolved = applyOutcome(e, outcome, ctx, fill, { arc: arcStep?.instance });

  // An arc node is FORCED: `selection.ts` keeps it out of the ambient and
  // pressure pools entirely, so no cooldown and no per-run cap is ever
  // consulted before it fires. It must not spend one either — see
  // `recordTemplateFire`. It still counts as itself.
  if (e.arc) recordTemplateFire(e.id, ctx.world.frequency, ctx.world.year);
  else recordFire(e.id, e.frequency, ctx.world.frequency, ctx.world.year);

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

  if (arcStep) advanceArc(arcStep, outcome, choiceId, ctx, rng);
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
 *
 * `choiceId` is `undefined` when the branch was never the player's to take —
 * a `party` decider parks the event here to collect a cast and then decides
 * from it (`session.send`). The cast is resolved FIRST in that case, because
 * the people the player just named are exactly what the check pools.
 */
export function resolveChoice(
  ctx: SimCtx,
  decision: string,
  choiceId: string | undefined,
  rng: Rng,
  cast: SlotFill = {},
): ChoiceResolution {
  const pending = ctx.world.pendingDecisions.find((d) => d.id === decision);
  if (!pending || pending.kind !== 'choice') return { ok: false, reason: 'no such decision' };

  const e = pending.event;
  if (e.interaction.kind === 'narration') return { ok: false, reason: 'narration takes no choice' };

  const fill: SlotFill = { ...pending.fill };
  for (const req of pending.cast) {
    const chosen = cast[req.slot];
    if (chosen && req.candidates.some((c) => c.id === chosen)) fill[req.slot] = chosen;
    else if (!req.optional) return { ok: false, reason: `nobody cast as ${req.slot}` };
  }

  // Who decides. A `player` docket takes the id it was sent; anything else
  // derives one — through the same evaluator auto-resolve uses, so a delegated
  // decision cannot mean one thing when a client answers it and another when
  // the chronicler does.
  let choice;
  if (pending.choicesAreOpen) {
    if (choiceId === undefined) return { ok: false, reason: 'this decision is the house\'s to take' };
    choice = e.interaction.choices.find((c) => c.id === choiceId);
    if (!choice) return { ok: false, reason: `no choice '${choiceId}'` };
  } else {
    const decided = decideBranch(ctx, e, fill, rng, { castReady: true, scope: { arc: pending.arcStep?.instance } });
    choice = decided.choice;
    if (!choice) return { ok: false, reason: decided.why };
  }

  const availability = choiceAvailability(choice, ctx, fill, e);
  if (!availability.available) return { ok: false, reason: availability.blockedBy ?? 'unavailable' };

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
/**
 * Take one of the cards. Logged, because this is an EXTERNAL answer in the
 * decision log's own sense — nothing about the seed says which of three
 * suitors a house took, and a run cannot be rebuilt without it.
 */
export function resolveMatch(ctx: SimCtx, decision: string, cardId: string): MatchResolution {
  const pending = ctx.world.pendingDecisions.find((d) => d.id === decision);
  if (!pending || pending.kind !== 'match') return { ok: false, reason: 'no such match' };

  const card = pending.cards.find((c) => c.id === cardId);
  if (!card) return { ok: false, reason: 'no such card' };

  const result = takeCard(ctx, pending.subject.id, card);
  // A refused card leaves the decision standing: the player still has to
  // answer, and a hand where every card has closed is answered by declining.
  if (!result.ok) return { ok: false, reason: result.reason };

  drop(ctx, decision);
  ctx.world.decisionLog.push({
    kind: 'match',
    year: ctx.world.year,
    subject: pending.subject.id,
    card: card.id,
    spouse: result.spouse?.id ?? '',
  });
  return { ok: true, spouse: result.spouse?.id };
}

/**
 * Decline the whole hand. A real answer, and sometimes the right one: nobody
 * on the table is worth the dowry, and the house waits three years for a new
 * one. Logged for the same reason taking a card is.
 */
export function declineMatch(ctx: SimCtx, decision: string): boolean {
  const pending = ctx.world.pendingDecisions.find((d) => d.id === decision);
  if (!pending || pending.kind !== 'match') return false;
  drop(ctx, decision);
  ctx.world.decisionLog.push({
    kind: 'match',
    year: ctx.world.year,
    subject: pending.subject.id,
    card: null,
    spouse: '',
  });
  return true;
}

export interface MatchResolution {
  ok: boolean;
  reason?: string;
  spouse?: string;
}

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

  // Same scope an outcome's effects get: a Record option is authored on the
  // template and may `recast` one of its slots, which needs the template to
  // know what role that slot casts for.
  for (const eff of chosen.effects) applyEffect(eff, ctx, fill, { event: e });

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
  if (decision.kind === 'match') {
    // Keyed to the decision's own id rather than drawn from `rng`, so the
    // chronicler's hand does not depend on how many decisions preceded it —
    // the same rule `GameSession.choose` follows for the player's.
    const card = autoTakeCard(decision.cards, decision.id, decision.year, ctx.world.treasury);
    if (card && resolveMatch(ctx, decision.id, card.id).ok) return;
    declineMatch(ctx, decision.id);
    return;
  }
  // The cast first — a `party` decider pools exactly these people, so who the
  // chronicler sends IS the decision he is making.
  const cast: SlotFill = {};
  for (const req of decision.cast) {
    const who = rng.pick(req.candidates);
    if (who) cast[req.slot] = who.id;
  }

  // A branch that was never the player's is not the chronicler's either. He
  // picks only where the content said a person picks; everything else goes
  // through `decideBranch` inside `resolveChoice`, which is the same evaluator
  // the docket path uses.
  let chosenId: string | undefined;
  if (decision.choicesAreOpen) {
    const open = decision.choices.filter((c) => c.available);
    const chosen = rng.pick(open.length ? open : decision.choices);
    if (!chosen) { drop(ctx, decision.id); return; }
    chosenId = chosen.id;
  }
  const res = resolveChoice(ctx, decision.id, chosenId, rng, cast);
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
