import type { ArcDef, ArcInstance, ArcNode, MissingPolicy, Outcome } from '@ed/schema';
import type { SimCtx } from '../world.js';
import { evalCondition } from './conditions.js';
import { resolveSlots, type SlotFill } from './slots.js';
import type { Rng } from '../rng.js';

export function startArc(arc: ArcDef, ctx: SimCtx, rng: Rng, seedBindings: SlotFill = {}): ArcInstance | undefined {
  const existing = [...ctx.world.arcs.values()].filter((a) => a.arc === arc.id && a.status === 'active');
  if (existing.length >= arc.maxConcurrentInstances) return undefined;

  const instance: ArcInstance = {
    id: `arc_${(ctx.world.counters.arc += 1).toString(36)}`,
    arc: arc.id,
    node: arc.entry,
    bindings: { ...seedBindings },
    localFlags: {},
    startedYear: ctx.world.year,
    dueYear: ctx.world.year,
    history: [],
    status: 'active',
  };
  ctx.world.arcs.set(instance.id, instance);
  void rng;
  return instance;
}

/**
 * EXACTLY-ONE SEMANTICS.
 * Collect the successors that match what just happened, then take one. There is
 * no path on which two children fire — the function returns a single NodeId,
 * and the type says so.
 *
 * Four guards, and they AND together:
 *
 *   fromOutcome  the exact ending.
 *   fromChoice   which branch was taken. The one that matters once a `state`
 *                ladder or a `party` check takes the branch instead of the
 *                player: five outcomes can hang off one branch, and "the house
 *                paid" is a different fact from "the payment went well."
 *   fromTag      any ending carrying this tag, so one successor covers a family
 *                of them without naming each.
 *   when         a `Condition`, evaluated WITH the running instance in scope, so
 *                it can ask what this story remembers (`arcFlag`, `arcVisited`)
 *                and not only what the world looks like.
 */
export function chooseSuccessor(
  node: ArcNode,
  outcome: Outcome,
  choiceId: string | undefined,
  instance: ArcInstance,
  ctx: SimCtx,
  rng: Rng,
): string | 'end' {
  const viable = node.successors.filter((s) => {
    if (s.fromOutcome && s.fromOutcome !== outcome.id) return false;
    if (s.fromChoice && s.fromChoice !== choiceId) return false;
    if (s.fromTag && !outcome.tags.includes(s.fromTag)) return false;
    return evalCondition(s.when, ctx, { arc: instance });
  });
  if (!viable.length) return 'end';
  if (node.selection === 'first_match') return viable[0]!.to;
  return (rng.weighted(viable, (s) => s.weight) ?? viable[0]!).to;
}

export function scheduleNext(node: ArcNode, ctx: SimCtx, rng: Rng): number {
  const s = node.schedule;
  if (s === 'immediate') return ctx.world.year;
  if (s === 'next_generation') return ctx.world.year + 20 + rng.int(12);
  return ctx.world.year + Math.round(rng.range(s.minYears, s.maxYears));
}

export interface ArcStep {
  instance: ArcInstance;
  node: ArcNode;
  fill: SlotFill;
  /** True when a bound cast member is gone and the node must render absent. */
  absent: boolean;
}

/**
 * Bindings outlive people. In a game whose time unit is a generation, an arc
 * finding its cast dead is the NORMAL case, not an edge case — which is why
 * this function exists at all.
 */
export function dueArcSteps(ctx: SimCtx, rng: Rng): ArcStep[] {
  const out: ArcStep[] = [];

  for (const inst of ctx.world.arcs.values()) {
    if (inst.status !== 'active') continue;
    if ((inst.dueYear ?? 0) > ctx.world.year) continue;

    const arc = ctx.content.arc(inst.arc);
    if (!arc) { inst.status = 'cancelled'; continue; }

    if (arc.expiresAfterYears && ctx.world.year - inst.startedYear > arc.expiresAfterYears) {
      inst.status = 'expired';
      continue;
    }

    const node = arc.nodes.find((n) => n.id === inst.node);
    const event = node && ctx.content.event(node.event);
    if (!node || !event) { inst.status = 'cancelled'; continue; }

    // Repair bindings before resolving anything else.
    let absent = false;
    let cancelled = false;
    for (const slotId of arc.bindings) {
      const boundId = inst.bindings[slotId];
      if (!boundId) continue;
      const person = ctx.world.people.get(boundId);
      if (person && person.status === 'alive') continue;

      const spec = event.slots[slotId];

      // A binding this node does not reference cannot be missing from its
      // point of view. Treating an undeclared slot as an unfillable one meant
      // any node that simply did not need the arc's cast cancelled the whole
      // arc — which is why the seal feud's final scene never fired once in
      // twenty thousand simulated years.
      if (!spec) continue;

      const policy = spec.onMissing ?? 'cancel_arc';

      if (policy === 'cancel_arc') { cancelled = true; break; }
      if (policy === 'continue_absent') { absent = true; continue; }
      if (policy === 'recast') {
        const res = resolveSlots({ ...event, slots: { [slotId]: spec! } } as never, ctx, rng);
        if (res.ok && res.fill[slotId]) inst.bindings[slotId] = res.fill[slotId]!;
        else { cancelled = true; break; }
        continue;
      }
      // `inherit` is the policy that earns its keep: a rival dies mid-feud and
      // his son takes it up, so the grudge, the arc and the binding all move
      // down one generation together.
      const heir = inheritFrom(boundId, policy.inherit, ctx);
      if (heir) inst.bindings[slotId] = heir;
      else { cancelled = true; break; }
    }

    if (cancelled) { inst.status = 'cancelled'; continue; }

    const res = resolveSlots(event, ctx, rng, inst.bindings);
    if (!res.ok) { inst.dueYear = ctx.world.year + 5; continue; }

    out.push({ instance: inst, node, fill: res.fill, absent });
  }

  return out;
}

/**
 * Who takes up his quarrel.
 *
 * This used to return the requested relation or nothing, and nothing cancelled
 * the arc. Measured over twenty thousand simulated years, that killed the seal
 * feud at its second node in twenty-four of twenty-seven runs — because most
 * men die without a surviving child — and its third node never fired once.
 *
 * A grudge does not evaporate because one man died childless. Fall through:
 * his heir, then his closest blood, then his house. Only a vanished house ends
 * it, which is the correct way for a feud to end.
 */
type InheritMode = Extract<MissingPolicy, { inherit: string }>['inherit'];

function inheritFrom(personId: string, mode: InheritMode, ctx: SimCtx): string | undefined {
  const store = ctx.world.people;
  const p = store.get(personId);
  if (!p) return undefined;

  const byAge = <T extends { born: number }>(xs: T[]) => [...xs].sort((a, b) => a.born - b.born);
  const alive = <T extends { status: string }>(xs: T[]) => xs.filter((x) => x.status === 'alive');

  const heir = () => byAge(alive(store.children(p.id)))[0];
  const closestBlood = () => heir() ?? byAge(alive(store.siblings(p.id)))[0];
  const houseSuccessor = () => byAge(
    store.living().filter((q) => q.houseOfOrigin === p.houseOfOrigin && q.id !== p.id),
  )[0];

  const chain = mode === 'house_successor'
    ? [houseSuccessor]
    : mode === 'closest_blood'
      ? [closestBlood, houseSuccessor]
      : [heir, closestBlood, houseSuccessor];

  for (const step of chain) {
    const found = step();
    if (found) return found.id;
  }
  return undefined;
}

export function advanceArc(
  step: ArcStep,
  outcome: Outcome,
  choiceId: string | undefined,
  ctx: SimCtx,
  rng: Rng,
): void {
  const { instance, node } = step;
  const arc = ctx.content.mustArc(instance.arc, `arc instance ${instance.id}`);

  // History is written BEFORE the successor is chosen, so `arcVisited` can name
  // the node that just resolved. A guard that could not see the beat it is
  // reacting to would be reading the story one step stale.
  instance.history.push({
    node: node.id,
    outcome: outcome.id,
    ...(choiceId !== undefined ? { choice: choiceId } : {}),
    year: ctx.world.year,
  });
  for (const slotId of arc.bindings) {
    if (step.fill[slotId]) instance.bindings[slotId] = step.fill[slotId]!;
  }

  const next = chooseSuccessor(node, outcome, choiceId, instance, ctx, rng);
  if (next === 'end') { instance.status = 'ended'; return; }

  const nextNode = arc.nodes.find((n) => n.id === next);
  if (!nextNode) { instance.status = 'ended'; return; }

  instance.node = next;
  instance.dueYear = scheduleNext(nextNode, ctx, rng);
}
