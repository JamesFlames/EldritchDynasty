import type { Effect, EventTemplate, Outcome, Person, Target } from '@ed/schema';
import { assertNever, FREQUENCY_PROFILES, MAIN_BRANCH, RESPECT_ORDER, isActiveBranch } from '@ed/schema';
import type { SimCtx } from '../world.js';
import type { SlotFill } from './slots.js';
import { renderBody } from './slots.js';
import { phenotypeOf } from '../people/factory.js';
import { BEARER, grantHeirloom, transferHeirloom, useHeirloom } from '../people/heirlooms.js';
import { degradeLibraryCopy, gainSpellbook, loseSpellbookKnowledge, spellbookDef } from '../people/library.js';
import { branchOf } from '../people/branches.js';
import { addGrudge, relate } from '../people/relationships.js';
import type { Rng } from '../rng.js';
import { birthTales } from './tales.js';
import type { EvalScope } from './scope.js';

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
      default: return assertNever(t, 'target');
    }
  }
  if ('slot' in t) {
    const p = w.people.get(fill[t.slot] ?? '');
    return p ? [p] : [];
  }
  const p = w.people.get(fill[t.all] ?? '');
  return p ? [p] : [];
}

/**
 * `scope` is threaded for exactly one effect kind — `arc_flag`, which writes
 * story-local memory and therefore has to know which story. Everything else
 * ignores it. See `scope.ts`.
 */
export function applyEffect(eff: Effect, ctx: SimCtx, fill: SlotFill, scope: EvalScope = {}): void {
  const w = ctx.world;

  switch (eff.kind) {
    // INVARIANT 6: derived state is not storage — this writes to `acquired`.
    case 'attribute': {
      for (const p of resolveTargets(eff.target, ctx, fill)) {
        // Into the ACQUIRED layer. Writing to the phenotype cache looks like
        // it works and is discarded the moment the year ticks over.
        p.acquired[eff.attr] = (p.acquired[eff.attr] ?? 0) + eff.delta;
        if (p.phenotype) p.phenotype.dirty = true;
      }
      break;
    }
    // INVARIANT 1: canExpress is the only Madness gate.
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
      const next = RESPECT_ORDER[Math.max(0, Math.min(RESPECT_ORDER.length - 1, i + eff.delta))]!;
      // Restart the decay clock whichever way it moved: doing something
      // disgraceful is still doing something, and a house nobody is talking
      // about is the only house that fades.
      if (next !== w.respect) w.respectChanged = w.year;
      w.respect = next;
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
    // INVARIANT: a proven Discrepancy is the one downstream consequence
    // Record/Omit/Embellish had none of (issue #9) — without it, Embellish
    // costs the player nothing and the thesis of the game is unwired.
    case 'discrepancy': {
      if (eff.op === 'create') {
        w.discrepancies.set(eff.id, { severity: eff.severity ?? 'minor', provableBy: eff.provableBy ?? [], state: 'open' });
        break;
      }
      const d = w.discrepancies.get(eff.id);
      if (!d) break;
      d.state = eff.op === 'prove' ? 'proven' : 'buried';
      if (eff.op === 'prove') {
        // A full tier. Being caught in the lie costs more than the truth
        // would have — that asymmetry is what makes Embellish a real bet.
        const i = RESPECT_ORDER.indexOf(w.respect);
        const next = RESPECT_ORDER[Math.max(0, i - 1)]!;
        if (next !== w.respect) w.respectChanged = w.year;
        w.respect = next;
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
    case 'relationship': {
      // This case used to say "handled by its own subsystem" and break. There
      // was no subsystem: four authored outcomes, including the seal feud's
      // inherited grudge, discarded themselves here in silence.
      const from = resolveTargets(eff.from, ctx, fill);
      const to = resolveTargets(eff.to, ctx, fill);
      for (const a of from) {
        for (const b of to) {
          if (a.id === b.id) continue;
          const x = a.id;
          const y = b.id;
          if (eff.sentiment !== undefined) relate(w, x, y, eff.sentiment);
          // A grudge is taken by the injured party, so it points back the way
          // the sentiment came: `from` wronged `to`, and `to` remembers.
          if (eff.grudge) addGrudge(ctx, y, x, eff.grudge);
        }
      }
      break;
    }
    case 'recast': {
      // Free the slot's occupant from the role so `maintainCast` refills it.
      const p = w.people.get(fill[eff.slot] ?? '');
      if (p) p.castSlots = p.castSlots.filter((s) => s !== 'head');
      break;
    }
    case 'arc': {
      // `start` is handled at commit time, where the slot fill is available to
      // seed the new instance's bindings. The other two belong here.
      if (eff.op === 'start') break;
      for (const inst of w.arcs.values()) {
        if (inst.arc !== eff.arc || inst.status !== 'active') continue;
        if (eff.op === 'cancel') inst.status = 'cancelled';
        else inst.dueYear = w.year;      // advance: due now, resolves next tick
      }
      break;
    }
    // The other half of `arcFlag`. An event firing outside an arc has nowhere
    // to write, which `arcs/flags` fails the build over rather than leaving it
    // to be discovered as a successor that never takes the branch it should.
    case 'arc_flag': {
      if (scope.arc) scope.arc.localFlags[eff.flag] = eff.set;
      break;
    }
    case 'heirloom': {
      if (eff.op === 'grant') { grantHeirloom(ctx, eff.heirloom); break; }
      if (eff.op === 'use') {
        const slot = eff.to ?? BEARER;
        const bearer = w.people.get(fill[slot] ?? '');
        if (bearer) useHeirloom(ctx, eff.heirloom, bearer);
        break;
      }
      // `transfer`: declared in the schema, handled nowhere — `op` is not the
      // discriminant `applyEffect` switches on, so `assertNever` could not
      // catch this falling through and doing nothing. The auction needs it.
      if (eff.op === 'transfer') { transferHeirloom(ctx, eff.heirloom); break; }
      assertNever(eff.op, 'heirloom op');
    }
    // The Library (§12, issue #15). `degrade` acts on the shelf copy directly —
    // wear is a property of the physical book, not of any one reader — so it
    // ignores `target`; `gain`/`lose` act on `Person.spellsKnown`.
    case 'spellbook': {
      if (eff.op === 'degrade') { degradeLibraryCopy(ctx, eff.book); break; }
      const def = spellbookDef(ctx, eff.book);
      if (!def) break;
      for (const p of resolveTargets(eff.target, ctx, fill)) {
        if (eff.op === 'gain') gainSpellbook(ctx, p, def);
        else loseSpellbookKnowledge(ctx, p, eff.book);
      }
      break;
    }
    // The forging path (issue #19, concept §7). The one place
    // `claimedParents` can diverge from `trueParents` after bootstrap — every
    // pedigree the player breeds against downstream of this reads the
    // CLAIMED line, so a false grandmother moves `pedigreeF` exactly as far
    // as the forgery claims, while `realizedHomozygosity` never moves at all.
    case 'forge_lineage': {
      const claimedId = fill[eff.claimedAs];
      if (!claimedId) break;
      for (const p of resolveTargets(eff.target, ctx, fill)) {
        p.claimedParents = { ...p.claimedParents, [eff.parent]: claimedId };
        p.lineageDocuments.push({
          generations: eff.generations,
          notarisedBy: eff.notarisedBy,
          forged: true,
          claims: `${eff.parent} of good blood, ${eff.generations} generations documented`,
        });
      }
      break;
    }
    // Careers (issue #16). Respect is bought with descendants — the costs
    // (breeding-pool exclusion, mortality) are read from `Person.career`
    // directly by `demography.ts`, not applied here.
    case 'career': {
      for (const p of resolveTargets(eff.target, ctx, fill)) {
        if (eff.op === 'leave') { p.career = undefined; continue; }
        if (!eff.career) continue;
        p.career = { career: eff.career as never, from: w.year };
      }
      break;
    }
    default:
      // Adding an Effect kind is now a compile error here, which is the whole
      // point of the union being closed. `kind: relationship` sat in this
      // switch with a comment saying another subsystem handled it; there was no
      // other subsystem, and four authored outcomes discarded themselves in
      // silence for as long as that comment was true.
      assertNever(eff, 'effect');
  }
}

/**
 * `outcome_weight` (issue #11) — a household trait can bias which outcome an
 * outcome group lands on, once it is reached, by tag. Multiplicative and
 * per-holder: two traits matching the same outcome compound.
 */
function outcomeWeightMultiplier(o: Outcome, ctx: SimCtx): number {
  let mult = 1;
  const w = ctx.world;
  for (const p of w.people.household(w.playerHouse, w.year)) {
    for (const tid of p.traits) {
      const trait = ctx.content.trait(tid);
      if (!trait) continue;
      for (const pres of trait.presence) {
        for (const m of pres.modifiers) {
          if (m.kind === 'outcome_weight' && m.match.tags.some((t) => o.tags.includes(t))) mult *= m.multiply;
        }
      }
    }
  }
  return mult;
}

export function pickOutcome(outcomes: Outcome[], rng: Rng, ctx: SimCtx): Outcome {
  return rng.weighted(outcomes, (o) => o.weight * outcomeWeightMultiplier(o, ctx)) ?? outcomes[0]!;
}

export interface ResolvedEvent {
  event: EventTemplate;
  outcome: Outcome;
  text: string;
  fill: SlotFill;
  /** The chronicle entry this outcome created. See `applyRecord` (issue #8). */
  entryId: string;
}

/** A stable id for a chronicle entry, so the record layer can find ITS entry rather than "an" entry. */
function chronicleEntryId(ctx: SimCtx): string {
  return `chr_${(ctx.world.counters.chronicle += 1).toString(36)}`;
}

export function applyOutcome(
  e: EventTemplate,
  outcome: Outcome,
  ctx: SimCtx,
  fill: SlotFill,
  scope: EvalScope = {},
): ResolvedEvent {
  for (const eff of outcome.effects) applyEffect(eff, ctx, fill, scope);

  const text = renderBody(outcome.text || e.body, fill, ctx);
  const profile = FREQUENCY_PROFILES[e.frequency];
  const entryId = chronicleEntryId(ctx);

  // Frequency decides how the chronicle renders it. In a game whose artefact
  // IS the chronicle, this is where the tier is felt rather than computed.
  ctx.world.chronicle.push({
    id: entryId,
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

  birthTales(e, ctx);

  return { event: e, outcome, text, fill, entryId };
}
