import type { EventTemplate, Filter, Person, SlotSpec } from '@ed/schema';
import { assertNever } from '@ed/schema';
import type { SimCtx } from '../world.js';
import { evalFilter } from './conditions.js';
import { foremostOf } from '../ascension.js';
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

  const entries = fillOrder(e.slots);

  for (const [sid, spec] of entries) {
    if (fill[sid]) continue;
    if (spec.castBy === 'player') { playerCast.push(sid); continue; }

    const candidates = candidatesFor(spec, ctx, fill);
    if (!candidates.length) {
      if (spec.optional) continue;
      return { ok: false, fill, playerCast, missing: sid };
    }
    const chosen = rng.pick(candidates);
    fill[sid] = chosen.id;
  }

  return { ok: true, fill, playerCast };
}

/**
 * WHAT ORDER SLOTS FILL IN, and why it is not alphabetical.
 *
 * A `relation` filter — "not the same man as HEAD", "a child of MOTHER" —
 * compares its candidate against whoever is already cast in another slot, and
 * `evalFilter` PASSES when that slot is still empty, because a comparison
 * with nobody is not a comparison it can judge. So a filter evaluated before
 * its counterpart is cast does not narrow anything at all.
 *
 * This used to sort alphabetically, with a comment claiming relation filters
 * would therefore see the slots they refer to. They saw them only when the
 * author happened to name them in alphabetical order, and four authored
 * events in the shipped content did not: `CHALLENGER` asking not to be
 * `HEAD`, `PUPIL` asking not to be `TUTOR`, `HEAD` asking not to be `SON`.
 * All four read as constraints and all four were inert — invariant 11's exact
 * shape, invisible without knowing the fill order.
 *
 * Dependency order fixes the constraint rather than the naming. Slots that
 * others point at are filled first; alphabetical order breaks every tie, so
 * resolution stays reproducible. A cycle (`A` not `B`, `B` not `A`) cannot be
 * ordered and falls back to alphabetical for the slots caught in it — one of
 * the two filters is then inert, which is what a cycle means, and
 * `slots/references` fails the build on one.
 */
export function fillOrder(slots: Record<string, SlotSpec>): [string, SlotSpec][] {
  const names = Object.keys(slots).sort((a, b) => a.localeCompare(b));
  const deps = new Map(names.map((n) => [n, relationTargets(slots[n]!).filter((t) => t in slots && t !== n)]));

  const out: [string, SlotSpec][] = [];
  const placed = new Set<string>();

  // Kahn's algorithm, taking ready slots in alphabetical order so the result
  // is a single fixed sequence rather than any valid topological one.
  for (let pass = 0; pass < names.length && placed.size < names.length; pass++) {
    const ready = names.filter((n) => !placed.has(n) && deps.get(n)!.every((d) => placed.has(d)));
    if (!ready.length) break;
    for (const n of ready) { out.push([n, slots[n]!]); placed.add(n); }
  }

  // Whatever a cycle left behind, in alphabetical order.
  for (const n of names) if (!placed.has(n)) out.push([n, slots[n]!]);
  return out;
}

/** Every slot a spec's filters compare against, through `all`/`any`/`not`. */
function relationTargets(spec: SlotSpec): string[] {
  const out: string[] = [];
  const walk = (fs: Filter[]) => {
    for (const f of fs) {
      if ('relation' in f) out.push(f.of);
      else if ('all' in f) walk(f.all);
      else if ('any' in f) walk(f.any);
      else if ('not' in f) walk([f.not]);
    }
  };
  walk(spec.filters);
  return out;
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
      pool = w.people.living().filter((p) => p.houseOfOrigin !== w.playerHouse);
      break;
    case 'unwoken':
      pool = w.people.household(w.playerHouse, w.year).filter((p) => !p.awakening.awakened);
      break;
    case 'cadet':
      // CURRENT membership only. `some(kind === 'cadet')` also matched a man
      // who founded a branch in 1240 and was called back to hold the house in
      // 1268 — so the head of the family kept turning up in the cadet slot.
      pool = w.people
        .household(w.playerHouse, w.year)
        .filter((p) => p.membership.find((m) => m.to === undefined)?.kind === 'cadet');
      break;
    case 'tutor':
    case 'rival':
    case 'fragile':
    case 'the_match':
      pool = w.people.living().filter((p) => p.castSlots.includes(spec.role));
      break;
    /**
     * THE MAN WHO IS CLIMBING. One person or nobody, and `foremostOf` is the
     * only definition of which — the same reading the cast panel draws and
     * `world.ascension` is measured from, so an event that charges him and a
     * client that names him cannot disagree about who he is.
     */
    case 'foremost': {
      const top = foremostOf(ctx);
      pool = top ? [top.person] : [];
      break;
    }
    case 'child':
      pool = w.people.household(w.playerHouse, w.year).filter((p) => w.year - p.born < 20);
      break;
    case 'spouse':
      pool = w.people.household(w.playerHouse, w.year).filter((p) => p.marriages.some((m) => !m.to));
      break;

    /**
     * The frame's two figures at the long table (concept §2, issue #13): one
     * is the last of the blood, one is not a person. `listener_blood` is the
     * sitting Head, same pool as `head`. `listener_record` is the guardian —
     * Daveed, after he crosses over — same pool as `guardian`, which is also
     * why a frame event cannot fire before he does: there is nobody yet who
     * is "not a person" for it to seat at the table.
     */
    case 'listener_blood':
      pool = w.people.living().filter((p) => p.castSlots.includes('head'));
      break;
    case 'listener_record': {
      const g = w.people.guardian();
      pool = g ? [g] : [];
      break;
    }

    /**
     * The unnarrowed roles, listed rather than swept into a `default`.
     *
     * All four draw the whole household and let the spec's own filters do the
     * work, which is right for `family_member`, and is a STATED GAP for the
     * other three: `sibling` ignores siblinghood, and `heirloom` and
     * `spellbook` name a thing rather than a person, so casting one gets you
     * an arbitrary relative. No authored content uses any of the three —
     * checked, not assumed — and when one does, the fix is a case here rather
     * than a discovery in a chronicle.
     */
    case 'family_member':
    case 'sibling':
    case 'heirloom':
    case 'spellbook':
      pool = w.people.household(w.playerHouse, w.year);
      break;

    default:
      // A role added to the schema and not given a pool here used to fall
      // through to "everybody", which reads as a working cast and is not one.
      return assertNever(spec.role, 'slot role');
  }

  return pool.filter((p) => spec.filters.every((f) => evalFilter(f, p, ctx, bound, spec.role)));
}

/**
 * Fill the slots the player would have cast, for a run where nobody is asked.
 * Without this a dispatch event resolved in auto mode renders `{SCOUT}` into
 * the chronicle — a raw token, in the artefact the entire game is about.
 */
export function autoCast(
  e: EventTemplate,
  ctx: SimCtx,
  fill: SlotFill,
  playerCast: string[],
  rng: Rng,
): SlotFill {
  if (!playerCast.length) return fill;
  const out: SlotFill = { ...fill };
  for (const sid of playerCast) {
    const spec = e.slots[sid];
    if (!spec) continue;
    const chosen = rng.pick(candidatesFor(spec, ctx, out));
    if (chosen) out[sid] = chosen.id;
  }
  return out;
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
