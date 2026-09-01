import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { indexContent } from '@ed/schema';
import { bootstrap, runYears } from './sim.js';
import { foundHouse, prologueView } from './prologue.js';
import { END_YEAR } from './ending.js';
import { MAX_FRIENDS, type FriendName } from './people/friends.js';

/**
 * DO THE FIVE NAMES ACTUALLY ARRIVE? (`people/friends.ts`)
 *
 * Everything in `friends.test.ts` is about the verb and runs in half a second.
 * This is the other half, and it is the half this repo exists to check: a
 * roster that is asked for at the signing, validated, stored, saved, loaded
 * and never once handed to a living person is a feature that fails by doing
 * nothing. Every test passes. The run is healthy. The names simply never come.
 *
 * Measured over the twelve seeds below, played to 2042 with the five names
 * given at the founding:
 *
 *   names spent            5.0 of 5, in every seed
 *   first arrival          1045-1064   (mean 1052)
 *   last arrival           1064-1137   (mean 1100)
 *   where they landed      55% born into the house, 27% minted outside it,
 *                          18% dealt to the Match on a card the house declined
 *
 * AND A HEADLESS RUN IS UNTOUCHED, PROVEN RATHER THAN ASSERTED. `npm run
 * digest -- 8 400` moves by exactly thirteen bytes a seed against the commit
 * before this feature, and thirteen bytes is the length of `"friends":[]`. Drop
 * that one key from the save and all eight digests are identical, hash for
 * hash, to the block main printed. The simulation did not move: `claimFriendName`
 * returns on an empty bag before it touches the stream, which is the whole
 * reason it is written to check the bag first and flip the coin second.
 *
 * THE PACING IS THE 10%, AND IT IS EARLY. A run produces roughly two new
 * people a year between births and mints, so a one-in-ten coin empties a
 * five-name bag inside the first century — all five arrive within the
 * lifetimes of the founder's grandchildren and none ever again. That is what
 * `events`-side prose in `prologue.yaml` now says, because it is what happens.
 * It is also the window in which a player is reading names most closely, which
 * is the argument for leaving it where the number was set. If the five should
 * instead be spread across the thousand years, `FRIEND_NAME_CHANCE` is the one
 * constant to move and this block is the measurement to re-take.
 */

const content = indexContent(loadContent());
const SEEDS = Array.from({ length: 12 }, (_, i) => 4000 + i * 13);

/** Names no `uniqueName` pool contains, so an arrival cannot be a coincidence. */
const FIVE = [
  { name: 'Marisol', sex: 'female' as const },
  { name: 'Tobias', sex: 'male' as const },
  { name: 'Priya', sex: 'female' as const },
  { name: 'Kwame', sex: 'male' as const },
  { name: 'Ines', sex: 'female' as const },
];

interface Run {
  seed: number;
  spent: FriendName[];
  /** The five, as they were found in the world: who ended up wearing each. */
  worn: { name: string; sex: string; ours: boolean }[];
}

function play(seed: number): Run {
  const ctx = bootstrap(content, seed, 1042);
  const view = prologueView(ctx)!;
  const founded = foundHouse(ctx, {
    houseName: 'Vayne',
    heirloom: view.heirlooms[0]!.heirloom,
    grudge: view.grudges[0]!.house,
    friends: FIVE,
  });
  expect(founded.ok, founded.reason).toBe(true);

  runYears(ctx, END_YEAR - ctx.world.year);
  const w = ctx.world;
  const worn = w.people.all()
    .filter((p) => FIVE.some((f) => f.name === p.name))
    .map((p) => ({ name: p.name, sex: p.sex as string, ours: p.houseOfOrigin === w.playerHouse }));
  return { seed, spent: w.friends.filter((f) => f.spentIn !== undefined), worn };
}

describe('the five names, over a played batch', () => {
  const runs = SEEDS.map(play);

  /**
   * THE WHOLE POINT, AND THE ONLY THING THAT CANNOT BE INFERRED FROM THE UNIT
   * TESTS. A floor of one per run against a measurement of five in every run:
   * far enough below where it stands that it never argues with a balance
   * change, close enough to matter before the feature quietly leaves the game.
   */
  it('hands out names the player gave, in every run', () => {
    for (const r of runs) {
      expect(r.spent.length, `seed ${r.seed} spent none of the five in a thousand years`)
        .toBeGreaterThanOrEqual(1);
    }
    const total = runs.reduce((a, r) => a + r.spent.length, 0);
    expect(total / runs.length, 'the bag barely empties across a whole run')
      .toBeGreaterThanOrEqual(3);
  });

  it('never spends a name twice, and never invents a sixth', () => {
    for (const r of runs) {
      expect(r.spent.length).toBeLessThanOrEqual(MAX_FRIENDS);
      expect(new Set(r.spent.map((f) => f.name)).size).toBe(r.spent.length);
      for (const f of r.spent) expect(FIVE.some((g) => g.name === f.name)).toBe(true);
    }
  });

  /**
   * SAME SEX, EVERY TIME. This is the half a player notices instantly and no
   * unit test can prove over real content: the name goes on somebody of the
   * friend's sex, wherever in the world the person came from.
   */
  it('puts each name on somebody of that friend’s sex', () => {
    let checked = 0;
    for (const r of runs) {
      for (const p of r.worn) {
        const friend = FIVE.find((f) => f.name === p.name)!;
        expect(p.sex, `seed ${r.seed}: ${p.name} arrived as a ${p.sex}`).toBe(friend.sex);
        checked += 1;
      }
    }
    expect(checked, 'not one of the five was ever found in a world').toBeGreaterThan(0);
  });

  /**
   * BOTH DOORS. A friend can be born into the house or arrive from outside it,
   * because there are two naming hooks — `conceiveChild` and `rollRecipe` —
   * and one of them silently not calling through is exactly the shape of bug
   * this file is for. Over twelve runs both must be seen.
   */
  it('arrives by birth and by arrival, not only one of the two', () => {
    const worn = runs.flatMap((r) => r.worn);
    expect(worn.filter((p) => p.ours).length, 'not one of the five was ever born into the house')
      .toBeGreaterThan(0);
    expect(worn.filter((p) => !p.ours).length, 'not one of the five ever came from outside')
      .toBeGreaterThan(0);
  });

  /**
   * AND A RUN NOBODY FOUNDED IS UNTOUCHED. The bag is empty, so
   * `claimFriendName` returns before it draws — and a headless run is the run
   * it was before this feature existed, digest for digest. The harness, every
   * gate and most of this suite depend on that.
   */
  it('leaves an unfounded run alone', () => {
    const ctx = bootstrap(content, 4000, 1042);
    runYears(ctx, 200);
    expect(ctx.world.friends).toEqual([]);
  });
});
