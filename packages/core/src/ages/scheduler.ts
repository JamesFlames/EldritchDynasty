import type { AgeDef, Register } from '@ed/schema';
import type { SimCtx } from '../world.js';
import { evalCondition } from '../events/conditions.js';
import type { Rng } from '../rng.js';

const MAX_CONCURRENT = 2;

/**
 * An Age is a HAZARD PROCESS, not a phase with a length. Terminations roll
 * first, then onsets. The same Age runs a different span every run, and the
 * player can never learn a calendar.
 */
export function tickAges(ctx: SimCtx, rng: Rng): { began: AgeDef[]; ended: AgeDef[]; named: AgeDef[] } {
  const w = ctx.world;
  const began: AgeDef[] = [];
  const ended: AgeDef[] = [];
  const named: AgeDef[] = [];

  // ── 1. Terminations ────────────────────────────────────────────────────
  for (const active of [...w.age.active]) {
    const def = ctx.bundle.ages.find((a) => a.id === active.age);
    if (!def) continue;
    const elapsed = w.year - active.began;
    if (elapsed < def.duration.minYears) continue;
    if (rng.bool(endHazard(def, elapsed))) {
      w.age.active = w.age.active.filter((a) => a !== active);
      w.age.ended.push({ age: active.age, began: active.began, ended: w.year });
      w.age.lastEndedRegister = def.register;
      ended.push(def);
    }
  }

  // ── 2. Naming (the chronicle names an Age late) ─────────────────────────
  for (const active of w.age.active) {
    const def = ctx.bundle.ages.find((a) => a.id === active.age);
    if (!def || active.named) continue;
    if (w.year - active.began >= def.namedAfterYears) {
      active.named = true;
      active.namedAt = w.year;
      named.push(def);
    }
  }

  // ── 3. Onsets ──────────────────────────────────────────────────────────
  if (w.age.active.length < MAX_CONCURRENT) {
    const eligible = ctx.bundle.ages.filter((def) => isEligible(def, ctx));
    const chosen = rng.weighted(eligible, (def) => onsetWeight(def, ctx));
    // Onset is itself a yearly chance, not a certainty: a world with no Age
    // running is a world between things, and that is allowed.
    if (chosen && rng.bool(0.035)) {
      w.age.active.push({
        age: chosen.id,
        began: w.year,
        named: false,
        paid: { standing: false },
      });
      began.push(chosen);
    }
  }

  return { began, ended, named };
}

/**
 * rising       likelier to end the longer it has run. The default feel.
 * front_loaded burns out fast. Right for the Plague.
 * flat         memoryless — the player can infer nothing from elapsed time.
 *              The most unsettling of the three. Use deliberately.
 */
export function endHazard(def: AgeDef, elapsed: number): number {
  const { medianYears, minYears, shape } = def.duration;
  const span = Math.max(1, medianYears - minYears);
  const t = (elapsed - minYears) / span;
  switch (shape) {
    case 'flat': return 1 / span;
    case 'front_loaded': return Math.min(0.5, (1 / span) * (1.9 - Math.min(1.4, t * 0.7)));
    case 'rising': return Math.min(0.5, (1 / span) * (0.45 + t * 1.1));
  }
}

function isEligible(def: AgeDef, ctx: SimCtx): boolean {
  const w = ctx.world;
  if (w.age.active.some((a) => a.age === def.id)) return false;
  if (def.onset.earliestYear !== undefined && w.year < def.onset.earliestYear) return false;

  const last = [...w.age.ended].reverse().find((e) => e.age === def.id);
  if (last && w.year - last.ended < def.onset.cooldownYears) return false;

  // Alternate the register: never two Ages of the same texture consecutively.
  if (w.age.lastEndedRegister && w.age.lastEndedRegister === def.register && w.age.active.length === 0) return false;
  if (w.age.active.some((a) => ctx.bundle.ages.find((d) => d.id === a.age)?.register === def.register)) return false;

  return evalCondition(def.onset.conditions, ctx);
}

function onsetWeight(def: AgeDef, ctx: SimCtx): number {
  let weight = def.onset.weight;
  // Ages are the difficulty curve: the last two centuries draw from the harsh
  // table (concept §20 r3).
  const late = ctx.world.year > 1842;
  const harsh: Register[] = ['cold', 'institutional'];
  if (late && harsh.includes(def.register)) weight *= 3;
  if (late && def.register === 'warm') weight *= 0.3;
  return weight;
}

export function activeAgeIds(ctx: SimCtx): string[] {
  return ctx.world.age.active.map((a) => a.age);
}
