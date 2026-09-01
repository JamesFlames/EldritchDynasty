import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { indexContent } from '@ed/schema';
import { makeRng } from './rng.js';
import { testWorld } from './testing.js';
import { runYears } from './sim.js';
import { renameChild } from './sim.js';
import { saveGame, loadGame } from './save.js';
import { foundHouse, prologueView } from './prologue.js';
import {
  FRIEND_NAME_CHANCE, MAX_FRIENDS, claimFriendName, normaliseFriends, releaseFriendName,
  type FriendName,
} from './people/friends.js';

/**
 * THE FIVE NAMES THE PLAYER GAVE AT THE SIGNING (`people/friends.ts`).
 *
 * The failure this file is really about is the one this repo is built around:
 * a feature that does nothing and looks exactly like a feature that works. A
 * roster that is asked for, stored, saved, and never once handed to anybody in
 * a thousand years passes every other check in the build — nothing throws, the
 * run is healthy, the names simply never arrive. So the last test here plays a
 * founded run to 2042 and looks for a stranger wearing one.
 */

const content = indexContent(loadContent());

const FIVE = [
  { name: 'Marisol', sex: 'female' as const },
  { name: 'Tobias', sex: 'male' as const },
  { name: 'Priya', sex: 'female' as const },
  { name: 'Kwame', sex: 'male' as const },
  { name: 'Ines', sex: 'female' as const },
];

function bag(): FriendName[] {
  return FIVE.map((f) => ({ ...f }));
}

describe('claiming a friend’s name', () => {
  /**
   * THE RULE THAT KEEPS EVERY OTHER RUN IN THE GAME IDENTICAL. With no free
   * name of the sex asked for, this must return before it touches the stream —
   * the harness, the digest and every gate bootstrap with an empty bag, and a
   * coin flipped and discarded there would move every number in the game by
   * one draw. `npm run digest` is the check that would catch it; this is the
   * check that says why.
   */
  it('draws no dice at all when the bag holds nothing of that sex', () => {
    const rng = makeRng(7);
    const before = rng.int(1000);
    const rngA = makeRng(7);
    rngA.int(1000);
    expect(claimFriendName([], 'female', new Set(), 1200, rngA)).toBeUndefined();
    expect(claimFriendName([{ name: 'Tobias', sex: 'male' }], 'female', new Set(), 1200, rngA))
      .toBeUndefined();
    // The stream is where it was: the next number is the one it would have
    // been had neither call happened.
    const rngB = makeRng(7);
    rngB.int(1000);
    expect(rngA.int(1000)).toBe(rngB.int(1000));
    expect(before).toBe(makeRng(7).int(1000));
  });

  it('hands out a name of the sex asked for, and only that sex', () => {
    const friends = bag();
    const taken = new Set<string>();
    const seen = new Set<string>();
    // Enough attempts that a one-in-ten roll empties a three-name bag.
    for (let i = 0; i < 400; i++) {
      const got = claimFriendName(friends, 'female', taken, 1200 + i, makeRng(i));
      if (got) seen.add(got);
    }
    expect([...seen].sort()).toEqual(['Ines', 'Marisol', 'Priya']);
  });

  it('spends each name exactly once, and then stops', () => {
    const friends = bag();
    const taken = new Set<string>();
    const handed: string[] = [];
    for (let i = 0; i < 800; i++) {
      const got = claimFriendName(friends, i % 2 ? 'male' : 'female', taken, 1200 + i, makeRng(i));
      if (got) handed.push(got);
    }
    expect(handed.length).toBe(MAX_FRIENDS);
    expect(new Set(handed).size).toBe(MAX_FRIENDS);
    expect(friends.every((f) => f.spentIn !== undefined)).toBe(true);
    // And the bag is now empty, so the no-dice rule above is back in force.
    const rng = makeRng(99);
    expect(claimFriendName(friends, 'female', taken, 1400, rng)).toBeUndefined();
    expect(rng.int(1000)).toBe(makeRng(99).int(1000));
  });

  /**
   * A friend called Edric while a living Edric holds the name: the name cannot
   * be handed out, and a name that cannot be handed out has not been spent.
   * Getting this wrong loses one of five silently — the player's friend is
   * marked used and never appears.
   */
  it('will not hand out a name somebody living already holds, and does not spend it', () => {
    const friends: FriendName[] = [{ name: 'Marisol', sex: 'female' }];
    const taken = new Set(['Marisol']);
    for (let i = 0; i < 200; i++) claimFriendName(friends, 'female', taken, 1200, makeRng(i));
    expect(friends[0]!.spentIn).toBeUndefined();

    // Released by the death of the holder, it becomes available again.
    taken.delete('Marisol');
    let got: string | undefined;
    for (let i = 0; i < 200 && !got; i++) got = claimFriendName(friends, 'female', taken, 1300, makeRng(i));
    expect(got).toBe('Marisol');
  });

  it('rolls at about the rate it says it does', () => {
    let hits = 0;
    const attempts = 4000;
    for (let i = 0; i < attempts; i++) {
      // A fresh single-name bag each time, so this measures the coin and not
      // the emptying of the bag.
      const friends: FriendName[] = [{ name: 'Marisol', sex: 'female' }];
      if (claimFriendName(friends, 'female', new Set(), 1200, makeRng(i))) hits += 1;
    }
    const rate = hits / attempts;
    // Three standard errors of a 0.1 coin over 4,000 draws is 0.014.
    expect(Math.abs(rate - FRIEND_NAME_CHANCE), `measured ${rate.toFixed(3)}`).toBeLessThan(0.02);
  });

  it('puts a name back when it is released, and only a spent one', () => {
    const friends = bag();
    friends[0]!.spentIn = 1200;
    expect(releaseFriendName(friends, 'Marisol', 1200)).toBe(true);
    expect(friends[0]!.spentIn).toBeUndefined();
    expect(releaseFriendName(friends, 'Marisol', 1200)).toBe(false);
    expect(releaseFriendName(friends, 'Somebody Else', 1200)).toBe(false);
  });

  /**
   * A friend called Rowan is also a name in `names.ts`'s own pool. Spent in
   * 1050, buried, retired, and handed to an unrelated newborn by `uniqueName`
   * in 1200 — releasing on THAT rename would put the name back in a bag it
   * already came out of, and one arrival would become two.
   */
  it('will not release a name that was spent in some other century', () => {
    const friends: FriendName[] = [{ name: 'Rowan', sex: 'male', spentIn: 1050 }];
    expect(releaseFriendName(friends, 'Rowan', 1200)).toBe(false);
    expect(friends[0]!.spentIn).toBe(1050);
    expect(releaseFriendName(friends, 'Rowan', 1050)).toBe(true);
  });
});

describe('the roster the signing takes', () => {
  it('trims, drops blanks, and keeps what is left', () => {
    const checked = normaliseFriends([
      { name: '  Marisol ', sex: 'female' },
      { name: '', sex: 'male' },
      { name: 'Tobias   Reyes', sex: 'male' },
    ]);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.friends).toEqual([
      { name: 'Marisol', sex: 'female' },
      { name: 'Tobias Reyes', sex: 'male' },
    ]);
  });

  /**
   * Two friends called Sam is a five-name bag that silently holds four: the
   * second can never be handed out, because the first put the name in
   * `takenNames`. It is refused at the door rather than deduplicated quietly,
   * so the player finds out on the screen where they can still fix it.
   */
  it('refuses two friends with the same name, however they were typed', () => {
    const checked = normaliseFriends([
      { name: 'Sam', sex: 'female' },
      { name: ' sam ', sex: 'male' },
    ]);
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    expect(checked.reason).toMatch(/two of them/i);
  });

  it('refuses a sixth, and an essay', () => {
    const six = normaliseFriends([...FIVE, { name: 'Ondine', sex: 'female' }]);
    expect(six.ok).toBe(false);
    const essay = normaliseFriends([{ name: 'x'.repeat(200), sex: 'female' }]);
    expect(essay.ok).toBe(false);
  });
});

describe('the signing asks, and the world remembers', () => {
  function found(friends?: { name: string; sex: 'male' | 'female' }[]) {
    const ctx = testWorld(content);
    const view = prologueView(ctx)!;
    const result = foundHouse(ctx, {
      houseName: 'Vayne',
      heirloom: view.heirlooms[0]!.heirloom,
      grudge: view.grudges[0]!.house,
      ...(friends ? { friends } : {}),
    });
    return { ctx, result };
  }

  it('asks for them, in the frame’s own voice', () => {
    const view = prologueView(testWorld(content))!;
    expect(view.friendsWanted).toBe(MAX_FRIENDS);
    expect(view.friendsPrompt.length).toBeGreaterThan(80);
  });

  it('keeps the five it was given', () => {
    const { ctx, result } = found(FIVE);
    expect(result.ok).toBe(true);
    expect(ctx.world.friends.map((f) => f.name)).toEqual(FIVE.map((f) => f.name));
  });

  it('founds perfectly well when nobody is named', () => {
    const { ctx, result } = found();
    expect(result.ok).toBe(true);
    expect(ctx.world.friends).toEqual([]);
    expect(ctx.world.founding).toBeDefined();
  });

  /**
   * A founding that half-happened is a run the player cannot restart and
   * cannot fix — the heirloom is in the house's hands, the grudge is in the
   * world, and `foundHouse` will refuse to run again because `w.founding` is
   * set. The roster is checked before any of that is written.
   */
  it('changes nothing at all when the roster is refused', () => {
    const ctx = testWorld(content);
    const view = prologueView(ctx)!;
    // The house holds its Regalia from `houses.yaml` before anybody founds
    // anything, so what is asserted is that the CHOSEN gift never arrived.
    const before = ctx.world.heirlooms.size;
    const gift = view.heirlooms[0]!.heirloom;
    expect(ctx.world.heirlooms.has(gift)).toBe(false);

    const result = foundHouse(ctx, {
      houseName: 'Vayne',
      heirloom: gift,
      grudge: view.grudges[0]!.house,
      friends: [{ name: 'Sam', sex: 'female' }, { name: 'Sam', sex: 'male' }],
    });

    expect(result.ok).toBe(false);
    expect(ctx.world.founding).toBeUndefined();
    expect(ctx.world.friends).toEqual([]);
    expect(ctx.world.heirlooms.size).toBe(before);
    expect(ctx.world.heirlooms.has(gift)).toBe(false);
  });

  it('crosses the save boundary with what it has already spent', () => {
    const { ctx } = found(FIVE);
    ctx.world.friends[1]!.spentIn = 1310;
    const after = loadGame(JSON.parse(JSON.stringify(saveGame(ctx))), content);
    expect(after.world.friends).toEqual(ctx.world.friends);
  });

  /**
   * The save must not SHARE the rows. A save is a snapshot, and one that kept
   * pointing at the live roster would go on spending names after it was taken
   * — a bug that only shows up in a save loaded much later, which is the worst
   * place in this codebase to find one.
   */
  it('takes a snapshot rather than a reference', () => {
    const { ctx } = found(FIVE);
    const saved = saveGame(ctx) as unknown as { friends: FriendName[] };
    ctx.world.friends[0]!.spentIn = 1400;
    expect(saved.friends[0]!.spentIn).toBeUndefined();
  });
});

describe('a name the player refused', () => {
  /**
   * The chronicler names every newborn and the player may overrule it. A
   * friend's name offered and declined has not been used, so it goes back in
   * the bag — the alternative spends one of five on a suggestion the player
   * never accepted, and nothing anywhere would report it.
   */
  it('goes back in the bag when the player renames the child', () => {
    const ctx = testWorld(content);
    ctx.world.friends = bag();

    // Play until a newborn happens to be offered one of the five.
    let offered: { person: string; name: string } | undefined;
    for (let y = 0; y < 200 && !offered; y++) {
      runYears(ctx, 1);
      for (const pending of ctx.world.pendingNames) {
        const spent = ctx.world.friends.find((f) => f.name === pending.suggested && f.spentIn !== undefined);
        if (spent) offered = { person: pending.person, name: spent.name };
      }
    }
    expect(offered, 'no newborn in two hundred years was offered one of the five').toBeDefined();

    expect(ctx.world.friends.find((f) => f.name === offered!.name)!.spentIn).toBeDefined();
    expect(renameChild(ctx, offered!.person, 'Wystan')).toBe(true);
    expect(ctx.world.friends.find((f) => f.name === offered!.name)!.spentIn).toBeUndefined();
  });
});
