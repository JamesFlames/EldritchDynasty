import type { EventTemplate, Person, SlotSpec } from '@ed/schema';
import type { SimCtx } from '../world.js';
import { evalFilter } from './conditions.js';
import type { Rng } from '../rng.js';

export type SlotFill = Record<string, string>;

export interface SlotResolution {
  ok: boolean;
  fill: SlotFill;
  /** Slots the player must cast himself. This is the mission mechanic. */
  playerCast: string[];
  missing?: string;
}

/**
 * If a required slot cannot be filled, the event does not fire. This is the
 * primary reason 400 templates produce different content for different
 * families: a house full of scholars sees a different game to a house full of
 * soldiers.
 */
export function resolveSlots(
  e: EventTemplate,
  ctx: SimCtx,
  rng: Rng,
  preset: SlotFill = {},
): SlotResolution {
  const fill: SlotFill = { ...preset };
  const playerCast: string[] = [];

  // Deterministic order so resolution is reproducible and relation filters
  // referring to earlier slots actually see them.
  const entries = Object.entries(e.slots).sort(([a], [b]) => a.localeCompare(b));

  for (const [sid, spec] of entries) {
    if (fill[sid]) continue;
    if (spec.castBy === 'player') { playerCast.push(sid); continue; }

    const candidates = candidatesFor(spec, ctx, fill);
    if (!candidates.length) {
      if (spec.optional) continue;
      return { ok: false, fill, playerCast, missing: sid };
    }
    const chosen = rng.pick(candidates);
    fill[sid] = chosen.id as unknown as string;
  }

  return { ok: true, fill, playerCast };
}

export function candidatesFor(spec: SlotSpec, ctx: SimCtx, bound: SlotFill): Person[] {
  const w = ctx.world;
  let pool: Person[];

  switch (spec.role) {
    case 'head':
      pool = w.people.living().filter((p) => p.castSlots.includes('head'));
      break;
    case 'guardian': {
      // Not `living()`. He is not alive, and he is available regardless.
      const g = w.people.guardian();
      pool = g ? [g] : [];
      break;
    }
    case 'retainer':
      pool = w.people.living().filter((p) => p.contract !== undefined);
      break;
    case 'outsider':
    case 'rival_house':
      pool = w.people.living().filter((p) => (p.houseOfOrigin as unknown as string) !== w.playerHouse);
      break;
    case 'unwoken':
      pool = w.people.household(w.playerHouse, w.year).filter((p) => !p.awakening.awakened);
      break;
    case 'cadet':
      pool = w.people.household(w.playerHouse, w.year).filter((p) => p.membership.some((m) => m.kind === 'cadet'));
      break;
    case 'tutor':
    case 'rival':
    case 'fragile':
    case 'the_match':
      pool = w.people.living().filter((p) => p.castSlots.includes(spec.role));
      break;
    case 'child':
      pool = w.people.household(w.playerHouse, w.year).filter((p) => w.year - p.born < 20);
      break;
    case 'spouse':
      pool = w.people.household(w.playerHouse, w.year).filter((p) => p.marriages.some((m) => !m.to));
      break;
    default:
      pool = w.people.household(w.playerHouse, w.year);
  }

  return pool.filter((p) => spec.filters.every((f) => evalFilter(f, p, ctx, bound)));
}

/** Live match count for the editor's slot builder. */
export function matchCount(spec: SlotSpec, ctx: SimCtx): number {
  return candidatesFor(spec, ctx, {}).length;
}

const TOKEN = /\{([A-Z_][A-Z0-9_]*)\}/g;

export function renderBody(body: string, fill: SlotFill, ctx: SimCtx): string {
  return body.replace(TOKEN, (_m, name: string) => {
    const id = fill[name];
    if (!id) return `{${name}}`;
    const p = ctx.world.people.get(id);
    if (!p) return `{${name}}`;
    return p.epithet ?? p.name;
  });
}
