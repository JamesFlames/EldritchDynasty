import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { indexContent, type Rung } from '@ed/schema';
import { bootstrap, clearNamingQueue } from './sim.js';
import { stepYear } from './year/step.js';
import { makeRng, hashSeed } from './rng.js';
import {
  autoResolveAll, resolveChoice, type PendingChoice,
} from './events/decisions.js';
import { rungIndex, standingOf } from './ascension.js';
import { phenotypeOf } from './people/factory.js';
import { END_YEAR } from './ending.js';

/**
 * DOES THE RITE HAPPEN, AND DOES IT BUY THE RUNG? (issue #43)
 *
 * Everything in `rites.test.ts` is about the verb and is built by hand in a
 * millisecond. This file is about the other half of the question, which no
 * hand-built world can answer: whether a house playing a thousand years is
 * ever ASKED, and whether answering moves the ladder.
 *
 * It has to be a played batch. `runYears` lets the chronicler answer, and the
 * chronicler taking the largest decision in the game at random is not the
 * question — the question is what a player who says yes gets that a player who
 * says no does not. So the docket is parked and one policy answers the rite,
 * exactly as `gate:blood` and `gate:ladder` do, and the two columns differ by
 * one verb.
 *
 * The measurement this was written against — the twelve seeds below, and the
 * same shape over twenty:
 *
 *                offered   taken   best >= hierophant   best >= vessel
 *   take (12)       6        6           4 of 12            2 of 12
 *   refuse (12)     9        0           4 of 12            0 of 12
 *   take (20)       7        7           6 of 20            2 of 20
 *   refuse (20)    12        0           6 of 20            0 of 20
 *   take (24)       8        8           7 of 24            1 of 24
 *   refuse (24)     8        0           7 of 24            0 of 24
 *
 * Note the shape rather than the numbers. Six runs in twenty ever stand a man
 * at Hierophant, and the rite was offered in every one of them — the CAST is
 * what rations this event, not its tier, which is the argument written at the
 * top of `events/rites.yaml`. A third of the houses that get that far take the
 * fourth rung, which is §22's "the rung nobody expects" behaving like one.
 *
 * The refusing column is offered the rite MORE often, and that is not noise:
 * a house that takes it gets a man carrying blood he cannot hold, who dies
 * sooner, which is fewer Hierophant-years left to be asked in.
 */

const content = indexContent(loadContent());

/** Twelve seeds, spaced like every other batch in this repo. */
const SEEDS = Array.from({ length: 12 }, (_, i) => 4000 + i * 13);

interface RiteRun {
  offered: number;
  taken: number;
  best: Rung;
  /** Every ascendant the rite was offered to, and where he stood when it was. */
  castAt: Rung[];
  vesselYears: number;
  /** People of the house, living or archived, who took the Vessel rite. */
  riteHolders: number;
}

function play(seed: number, policy: 'take' | 'refuse'): RiteRun {
  const ctx = bootstrap(content, seed, 1042);
  const w = ctx.world;
  // The one standing order both columns share: without it the auction never
  // spends and the columns separate on the shelf rather than on the rite.
  w.bidCeiling = 600;

  const out: RiteRun = { offered: 0, taken: 0, best: 'none', castAt: [], vesselYears: 0, riteHolders: 0 };

  for (let y = 0; y < 1000; y++) {
    if (w.year >= END_YEAR) break;
    stepYear(ctx, false);

    // WHERE HE STOOD WHEN HE WAS ASKED, read before anything else this year is
    // resolved. It used to be read at the moment the Vessel docket was
    // answered, which was the same instant until the Great Rite existed: that
    // rite charges its toll to the same `foremost` man, and a toll that pushes
    // him past his own `mind` drops him a rung. Answered later in the same
    // year, he then read as an Adept the rite had supposedly been offered to —
    // a true fact about a different moment, and the gate was never loose.
    for (const d of w.pendingDecisions) {
      if (d.kind !== 'choice' || d.event.id !== 'the_vessel_rite') continue;
      const asked = w.people.get(d.fill.ASCENDANT ?? '');
      if (asked) out.castAt.push(standingOf(ctx, asked).rung);
    }

    let guard = 0;
    while (w.pendingDecisions.length && guard++ < 200) {
      const rng = makeRng(hashSeed(seed, 'rite-batch', w.year, guard));
      const pending = w.pendingDecisions.find((d): d is PendingChoice => d.kind === 'choice');

      if (pending?.event.id === 'the_vessel_rite') {
        out.offered += 1;

        // §22: named, chosen by the player from the tree. A player chasing the
        // rung names the deepest carrier standing in front of him, which is
        // also the family's vault — that is the bargain, not an oversight.
        let named: string | undefined;
        let deepest = -1;
        for (const c of pending.cast.find((r) => r.slot === 'VESSEL')?.candidates ?? []) {
          const q = w.people.get(c.id);
          if (!q) continue;
          const font = phenotypeOf(q, ctx.genetics, w.year).eldritch.carriedFont;
          if (font > deepest) { deepest = font; named = c.id; }
        }

        const choice = policy === 'take' ? 'speak_the_name' : 'send_them_out_of_the_room';
        const res = resolveChoice(ctx, pending.id, choice, rng, named ? { VESSEL: named } : {});
        if (res.ok && policy === 'take') out.taken += 1;
        if (res.ok) continue;
      }

      // The climbing policy for everything else, so both columns arrive at the
      // Hierophant gate the same way: `gate:ladder`'s own rule, which is what
      // gets a man high enough to be asked at all.
      if (pending?.choicesAreOpen) {
        const costly = pending.choices.filter((c) => c.available && charges(pending, c.id));
        if (costly[0] && resolveChoice(ctx, pending.id, costly[0].id, rng).ok) continue;
      }
      autoResolveAll(ctx, rng);
    }
    clearNamingQueue(ctx);

    if (rungIndex(w.ascension.rung) >= rungIndex('vessel')) out.vesselYears += 1;
  }

  out.best = w.ascension.best;
  out.riteHolders = w.people.all().filter((p) => p.rites.includes('vessel')).length;
  return out;
}

/** `gate:ladder`'s rule for a branch that costs the climbing man his mind. */
function charges(pending: PendingChoice, choiceId: string): boolean {
  const e = pending.event;
  if (e.interaction.kind === 'narration') return false;
  const choice = e.interaction.choices.find((c) => c.id === choiceId);
  if (!choice) return false;
  const ladder = new Set(
    Object.entries(e.slots).filter(([, s]) => s.role === 'foremost').map(([id]) => id),
  );
  if (!ladder.size) return false;
  return choice.outcomes.some((o) => o.effects.some(
    (f) => (f.kind === 'madness' && f.delta > 0
      && typeof f.target === 'object' && 'slot' in f.target && ladder.has(f.target.slot))
      || (f.kind === 'rite' && ladder.has(f.ascendant)),
  ));
}

describe('the Vessel rite, over a played batch', () => {
  const taking = SEEDS.map((s) => play(s, 'take'));
  const refusing = SEEDS.map((s) => play(s, 'refuse'));

  it('is offered at all — an event that never fires is not in the game', () => {
    const offers = taking.reduce((a, r) => a + r.offered, 0);
    expect(offers, 'no house in twelve thousand years was ever asked for a Vessel').toBeGreaterThan(0);
  });

  /**
   * The cast is the ration (`events/rites.yaml`). If this ever goes red the
   * event has come loose from the ladder and is being offered to houses that
   * have no use for it, which is how it read before issue #43 — measured, the
   * old mythic version cast men standing at rung `none` with power 6.7.
   */
  it('is only ever offered to a man who is already standing at Hierophant', () => {
    const cast = [...taking, ...refusing].flatMap((r) => r.castAt);
    expect(cast.length).toBeGreaterThan(0);
    for (const rung of cast) {
      expect(rungIndex(rung), `offered to a man at ${rung}`).toBeGreaterThanOrEqual(rungIndex('hierophant'));
    }
  });

  /**
   * THE MECHANISM, NOT THE TAIL. The first cut of this asserted that at least
   * one run in the batch reached rung four, which was measured at 2 of 12 the
   * day it was written and at 1 of 24 one content drop later — a floor with a
   * one-in-three chance of going red on content that is working perfectly.
   * This repo's own rule: *assert the mechanism, never a seed*.
   *
   * So what is asserted is the half that cannot be a coin. A house that takes
   * the rite has men who took it; a house that refuses has none and CANNOT
   * stand on rung four, because the rite is that rung's last requirement and
   * there is no other way to answer it. `rites.test.ts` holds the rung itself,
   * deterministically, where it cannot flake.
   *
   * The tail is measured rather than gated. Across the columns above the
   * Vessel is reached in roughly one run in twelve to twenty-four — about one
   * in seven of the runs that ever stand a man at Hierophant, which is the
   * quantity actually driving it, and which is issue #41's remaining half
   * rather than this one's.
   */
  it('is what buys rung four, and refusing it never does', () => {
    expect(taking.reduce((a, r) => a + r.riteHolders, 0),
      'no house in twelve played runs has a man who took the rite').toBeGreaterThan(0);
    expect(refusing.reduce((a, r) => a + r.riteHolders, 0),
      'a house that refused the rite has somebody carrying it anyway').toBe(0);

    const reached = (rs: RiteRun[]) => rs.filter((r) => rungIndex(r.best) >= rungIndex('vessel')).length;
    expect(reached(refusing), 'a house that refused the rite still became the Vessel').toBe(0);
    expect(refusing.every((r) => r.vesselYears === 0)).toBe(true);
    // And taking never costs a rung: the columns are level below four.
    expect(reached(taking)).toBeGreaterThanOrEqual(reached(refusing));
  });

  /**
   * Both columns climb the same way and are asked the same question, so a
   * house that says no is not being punished for saying no — it simply stops
   * where §22 says it stops. Keeping the two columns level up to Hierophant is
   * what makes the line above mean the rite rather than the policy.
   */
  it('leaves the two columns level everywhere below the rung it buys', () => {
    const hierophants = (rs: RiteRun[]) => rs.filter((r) => rungIndex(r.best) >= rungIndex('hierophant')).length;
    expect(hierophants(refusing)).toBe(hierophants(taking));
  });
});
