import type { PrologueDef } from '@ed/schema';
import type { SimCtx } from './world.js';
import { grantHeirloom } from './people/heirlooms.js';
import { addGrudge } from './people/relationships.js';

/**
 * THE SIGNING (concept §3, issue #38).
 *
 * Twelve to eighteen frame interludes a run refer back to a night the player
 * never saw. The frame is the promise every generation is played against, and
 * it was a promise about an event that happened off-screen to nobody.
 *
 * Two things make this more than a title card, and both are the reason it is
 * here rather than in the client:
 *
 * - **The two choices are simulation inputs.** The founding heirloom goes into
 *   `world.heirlooms`, where the ladder's Regalia gate, the auction and every
 *   `heirloom` condition can see it. The first grudge is a `Relationship`
 *   edge, and `grudgeAgainstUs` reads it for a thousand years.
 * - **The epilogue has to replay it.** §23's ring is this triad restated with
 *   exactly one element changed, which is only possible if the triad is data
 *   that both ends read.
 *
 * A world nobody founded is still a legal world. The harness bootstraps
 * hundreds a minute and answers no prologue, and every default is already
 * there: the house has a name in `houses.yaml`, holds its Regalia, and starts
 * with whatever grudges the seed cast brought with them. What the prologue
 * adds is the player's fingerprint on all three, kept in `world.founding` so
 * that in 2042 the ending can say which of them the thousand years changed.
 */

export interface PrologueView {
  id: string;
  opening: string;
  triad: { given: string; owed: string }[];
  housePrompt: string;
  /** The founding gift, with the object's own name and blurb beside the ask. */
  heirlooms: { heirloom: string; name: string; blurb: string; line: string }[];
  /** The first grudge, with the house that will hold it. */
  grudges: { house: string; houseName: string; line: string }[];
  thesis: string;
  /** What was chosen, once it has been. The prologue is a once-only screen. */
  founded?: { houseName: string; heirloom: string; grudge: string; year: number };
}

export interface FoundingChoice {
  houseName: string;
  heirloom: string;
  grudge: string;
}

/** A house name is a line on a page, not an essay. */
export const HOUSE_NAME_MAX = 48;

export function prologueDef(ctx: SimCtx): PrologueDef | undefined {
  return ctx.content.prologue;
}

/**
 * The prologue as plain values. Undefined where the bundle has no prologue —
 * a hand-built test bundle, which is allowed to be a bundle of two events.
 */
export function prologueView(ctx: SimCtx): PrologueView | undefined {
  const def = prologueDef(ctx);
  if (!def) return undefined;
  const w = ctx.world;

  const view: PrologueView = {
    id: def.id,
    opening: def.opening,
    triad: def.triad.map((b) => ({ given: b.given, owed: b.owed })),
    housePrompt: def.housePrompt,
    heirlooms: def.heirlooms.flatMap((h) => {
      const object = ctx.content.heirloom(String(h.heirloom));
      // Content edited out from under a save — the same shrug `tickTales`
      // makes. An option pointing at nothing is not an option.
      if (!object) return [];
      return [{
        heirloom: String(h.heirloom),
        name: object.name,
        blurb: object.blurb ?? '',
        line: h.line,
      }];
    }),
    grudges: def.grudges.flatMap((g) => {
      const house = ctx.content.house(String(g.house));
      if (!house) return [];
      return [{ house: String(g.house), houseName: house.name, line: g.line }];
    }),
    thesis: def.thesis,
  };
  if (w.founding) view.founded = { ...w.founding };
  return view;
}

export interface FoundingResult {
  ok: boolean;
  reason?: string;
}

/**
 * Answer the prologue. Once, in 1042, and never again.
 *
 * The two choices are checked against the AUTHORED options rather than against
 * the content at large: a client may not found the house on an heirloom the
 * prologue never offered, and may not hand the first grudge to the Commons.
 * That is not defensiveness about a hostile client — it is that the ending
 * names what was chosen, and an ending naming something the prologue never
 * said is a ring with a hole in it.
 */
export function foundHouse(ctx: SimCtx, choice: FoundingChoice): FoundingResult {
  const w = ctx.world;
  const def = prologueDef(ctx);
  if (!def) return { ok: false, reason: 'this bundle has no prologue' };
  if (w.founding) return { ok: false, reason: 'the house has already been founded' };

  const houseName = choice.houseName.trim().replace(/\s+/g, ' ');
  if (!houseName) return { ok: false, reason: 'the house needs a name' };
  if (houseName.length > HOUSE_NAME_MAX) return { ok: false, reason: 'that is a paragraph, not a name' };

  const heirloom = def.heirlooms.find((h) => String(h.heirloom) === choice.heirloom);
  if (!heirloom) return { ok: false, reason: 'he did not ask for that' };
  const grudge = def.grudges.find((g) => String(g.house) === choice.grudge);
  if (!grudge) return { ok: false, reason: 'nobody was wronged in that direction' };

  const object = ctx.content.heirloom(String(heirloom.heirloom));
  const house = ctx.content.house(String(grudge.house));
  if (!object || !house) return { ok: false, reason: 'the content no longer holds that' };

  grantHeirloom(ctx, String(heirloom.heirloom));

  // HELD BY A PERSON, AGAINST A PERSON. Both ends of a grudge are people —
  // every authored `relationship` effect in the content is person to person,
  // `grudgeAgainstUs` looks the target up in the person store, and
  // `tickRelationships` re-points each end down the generations as its holders
  // die. An edge with a HOUSE id on the end of it reads as an edge whose
  // holder is dead, and is deleted the first year it is ticked unless it is
  // house-wide — which is a founding grudge that quietly lasts one generation,
  // and looks exactly like one that lasts a thousand years.
  const holder = eldestOf(ctx, String(grudge.house));
  const head = ours(ctx);
  addGrudge(
    ctx,
    holder ?? String(grudge.house),
    head ?? w.playerHouse,
    {
      severity: grudge.severity,
      // Nobody of that house is currently alive to hold it — a hand-built
      // bundle, or a house the seed cast does not staff. House-wide is then
      // the only policy that survives: `tickRelationships` lets an
      // institutional feud go dormant and waits, and deletes every other kind.
      inheritance: holder ? grudge.inheritance : 'house_wide',
    },
    def.id,
  );

  w.founding = {
    houseName,
    heirloom: String(heirloom.heirloom),
    grudge: String(grudge.house),
    year: w.year,
  };

  // The chronicle, in the chronicle's own voice — plain, and from inside the
  // house. The frame's register stops at the prologue screen; this is the
  // family writing down what it did, and it is what the creditor reads in
  // 2042, which is why both choices have to be legible in it.
  w.chronicle.push({
    year: w.year,
    weight: 'page',
    title: 'What Was Asked For',
    text: `${object.name} was asked for by name, and given. ${house.name} paid for part of `
      + 'that night and has not been paid back, and the house has known it the whole time.',
    named: true,
  });

  return { ok: true };
}

/**
 * Who of that house takes it up. The eldest living member, so the founding
 * grudge is held by somebody who was there rather than by a child — and
 * chosen by birth year with the id as a tie-break, so it is the same person
 * on every run of a seed.
 */
function eldestOf(ctx: SimCtx, house: string): string | undefined {
  const them = ctx.world.people.living()
    .filter((p) => p.houseOfOrigin === house)
    .sort((a, b) => a.born - b.born || (a.id < b.id ? -1 : 1));
  return them[0]?.id;
}

/** Whoever holds the seal, or anybody of the house if the seal is between hands. */
function ours(ctx: SimCtx): string | undefined {
  const w = ctx.world;
  const household = w.people.household(w.playerHouse, w.year);
  return (household.find((p) => p.castSlots.includes('head')) ?? household[0])?.id;
}
