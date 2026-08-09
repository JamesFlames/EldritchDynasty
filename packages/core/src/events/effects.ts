import type { Effect, EventTemplate, Outcome, Person, Target } from '@ed/schema';
import { FREQUENCY_PROFILES, MAIN_BRANCH, RESPECT_ORDER, isActiveBranch } from '@ed/schema';
import type { SimCtx } from '../world.js';
import type { SlotFill } from './slots.js';
import { renderBody } from './slots.js';
import { phenotypeOf } from '../people/factory.js';
import { branchOf } from '../people/branches.js';
import type { Rng } from '../rng.js';

export function resolveTargets(t: Target, ctx: SimCtx, fill: SlotFill): Person[] {
  const w = ctx.world;
  if (typeof t === 'string') {
    switch (t) {
      case 'head': return w.people.living().filter((p) => p.castSlots.includes('head'));
      case 'household': return w.people.household(w.playerHouse, w.year);
      case 'all_blood': return w.people.blood(w.playerHouse).filter((p) => p.status === 'alive');
      case 'children_of_head': {
        const h = w.people.living().find((p) => p.castSlots.includes('head'));
        return h ? w.people.children(h.id).filter((p) => p.status === 'alive') : [];
      }
    }
  }
  if ('slot' in t) {
    const p = w.people.get(fill[t.slot] ?? '');
    return p ? [p] : [];
  }
  if ('all' in t) {
    const p = w.people.get(fill[t.all] ?? '');
    return p ? [p] : [];
  }
  return [];
}

export function applyEffect(eff: Effect, ctx: SimCtx, fill: SlotFill): void {
  const w = ctx.world;

  switch (eff.kind) {
    case 'attribute': {
      for (const p of resolveTargets(eff.target, ctx, fill)) {
        // Into the ACQUIRED layer. Writing to the phenotype cache looks like
        // it works and is discarded the moment the year ticks over.
        p.acquired[eff.attr] = (p.acquired[eff.attr] ?? 0) + eff.delta;
        if (p.phenotype) p.phenotype.dirty = true;
      }
      break;
    }
    case 'madness': {
      for (const p of resolveTargets(eff.target, ctx, fill)) {
        // The gate, enforced at runtime as well as in validation. Women and
        // mundane men cannot go mad, and no effect may make them.
        if (!phenotypeOf(p, ctx.genetics, w.year).eldritch.canExpress) continue;
        p.madness = Math.max(0, p.madness + eff.delta);
      }
      break;
    }
    case 'trait': {
      for (const p of resolveTargets(eff.target, ctx, fill)) {
        if (eff.op === 'add') p.traits.add(eff.trait as never);
        else p.traits.delete(eff.trait as never);
      }
      break;
    }
    case 'status': {
      for (const p of resolveTargets(eff.target, ctx, fill)) {
        if (eff.status === 'dead') w.people.kill(p.id, w.year, eff.cause ?? 'unrecorded');
        else p.status = eff.status as Person['status'];
      }
      break;
    }
    case 'treasury': w.treasury += eff.delta; break;
    case 'respect': {
      const i = RESPECT_ORDER.indexOf(w.respect);
      w.respect = RESPECT_ORDER[Math.max(0, Math.min(RESPECT_ORDER.length - 1, i + eff.delta))]!;
      break;
    }
    case 'flag': w.flags.set(eff.flag, eff.set); break;
    case 'knowledge':
      if (eff.op === 'grant') w.knowledge.add(eff.flag);
      else w.knowledge.delete(eff.flag);
      break;
    case 'clause': w.clausesRecovered.add(eff.reveal); break;
    case 'rumour': {
      if (eff.op === 'seed') w.rumours.set(eff.id, { accuracy: eff.accuracy ?? 0.5, spread: 1, seededYear: w.year });
      else if (eff.op === 'feed') {
        const r = w.rumours.get(eff.id);
        if (r) r.spread += 1;
      } else w.rumours.delete(eff.id);
      break;
    }
    case 'discrepancy': {
      if (eff.op === 'create') {
        w.discrepancies.set(eff.id, { severity: eff.severity ?? 'minor', provableBy: eff.provableBy ?? [], state: 'open' });
      } else {
        const d = w.discrepancies.get(eff.id);
        if (d) d.state = eff.op === 'prove' ? 'proven' : 'buried';
      }
      break;
    }
    case 'branch': {
      // Named by one of its people, or else the angriest hall in the family.
      const named = eff.slot ? w.people.get(fill[eff.slot] ?? '') : undefined;
      const key = named ? branchOf(w, named, w.year) : undefined;
      const target = key && key !== MAIN_BRANCH
        ? w.branches.get(key)
        : [...w.branches.values()]
          .filter(isActiveBranch)
          .sort((a, b) => b.grievance - a.grievance)[0];
      if (!target) break;
      const delta = eff.op === 'appease' ? -Math.abs(eff.amount) : Math.abs(eff.amount);
      target.grievance = Math.max(0, Math.min(100, target.grievance + delta));
      break;
    }
    case 'chronicle': w.chronicle.push({ year: w.year, weight: 'line', text: eff.text, named: false }); break;
    case 'schedule': w.scheduled.push({ event: eff.event, year: w.year + eff.inYears }); break;
    case 'relationship':
    case 'heirloom':
    case 'spellbook':
    case 'recast':
    case 'arc':
      // Handled by their own subsystems; listed here so the switch stays total.
      break;
  }
}

export function pickOutcome(outcomes: Outcome[], rng: Rng): Outcome {
  return rng.weighted(outcomes, (o) => o.weight) ?? outcomes[0]!;
}

export interface ResolvedEvent {
  event: EventTemplate;
  outcome: Outcome;
  text: string;
  fill: SlotFill;
}

export function applyOutcome(
  e: EventTemplate,
  outcome: Outcome,
  ctx: SimCtx,
  fill: SlotFill,
): ResolvedEvent {
  for (const eff of outcome.effects) applyEffect(eff, ctx, fill);

  const text = renderBody(outcome.text || e.body, fill, ctx);
  const profile = FREQUENCY_PROFILES[e.frequency];

  // Frequency decides how the chronicle renders it. In a game whose artefact
  // IS the chronicle, this is where the tier is felt rather than computed.
  ctx.world.chronicle.push({
    year: ctx.world.year,
    weight: profile.chronicle,
    title: profile.named ? e.title : undefined,
    text,
    eventId: e.id,
    named: profile.named,
  });

  // Rare and Mythic always enter folklore. Common never does.
  if (profile.rumour === 'always' && e.rumour) {
    ctx.world.rumours.set(e.rumour.id, { accuracy: e.rumour.accuracy, spread: e.rumour.spread, seededYear: ctx.world.year });
  }

  return { event: e, outcome, text, fill };
}
