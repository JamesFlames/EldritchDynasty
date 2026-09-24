import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { asId, indexContent, SlotSpecS, type HouseId } from '@ed/schema';
import {
  applyEffect, candidatesFor, marry, matchSubjects, phase, place, testWorld,
} from '@ed/core';

const content = indexContent(loadContent());

/**
 * ISSUE #132, STAGE 2 — "the house notices, and the player decides".
 *
 * Two slot roles that find who the founding bottleneck's crisis is about,
 * two effects that give it something to do, and the Match priority those
 * effects unlock. Stage 1 (the mortality recalibration) is covered in
 * `demography.test.ts`; this file is the mechanism Stage 1 could not close
 * on its own — a thinned line's last hope is often already blocked, not by
 * a rate, but by a marriage nothing in the engine could end.
 */

const soleHeirUnwed = SlotSpecS.parse({ role: 'sole_heir_unwed' });
const soleHeirSpent = SlotSpecS.parse({ role: 'sole_heir_spent' });

describe('sole_heir_unwed — exactly who a fresh match would help', () => {
  it('finds a blood, alive, unmarried adult of age', () => {
    const ctx = testWorld(content);
    const heir = place(ctx, { sex: 'female', age: 22, name: 'The Last Daughter' });

    expect(candidatesFor(soleHeirUnwed, ctx, {}).map((p) => p.id)).toContain(heir.id);
  });

  it('excludes anyone already married', () => {
    const ctx = testWorld(content);
    const heir = place(ctx, { sex: 'female', age: 22, name: 'Married Already' });
    const husband = place(ctx, { sex: 'male', age: 25, name: 'Her Husband' });
    marry(ctx, heir, husband);

    expect(candidatesFor(soleHeirUnwed, ctx, {}).map((p) => p.id)).not.toContain(heir.id);
  });

  it('excludes a retainer — of the household, not of the blood', () => {
    const ctx = testWorld(content);
    const hired = place(ctx, { sex: 'male', age: 25, name: 'The Cook' });
    hired.membership = [{ house: asId<HouseId>(ctx.world.playerHouse), kind: 'retainer', from: ctx.world.year }];

    expect(candidatesFor(soleHeirUnwed, ctx, {}).map((p) => p.id)).not.toContain(hired.id);
  });

  /**
   * The bug, stated as a test (issue #132). A cadet is still blood in the
   * lineage sense `livingBlood` reads, and `w.people.blood` alone would have
   * cast him — but `matchSubjects` deals hands only to the seat's own, so
   * casting a cadet promises a priority nothing downstream can act on. Traced
   * on a played seed: the house went to market for one for eleven straight
   * years and never once dealt him a hand, because he had left the main hall
   * before the scene ever cast him.
   */
  it('excludes a cadet — of the blood, but not of the hall the Match can reach', () => {
    const ctx = testWorld(content);
    const cadet = place(ctx, { sex: 'male', age: 25, name: 'The Cadet', branch: 'br_2' });
    cadet.membership = [{ house: asId<HouseId>(ctx.world.playerHouse), kind: 'cadet', branch: 'br_2', from: ctx.world.year }];

    expect(candidatesFor(soleHeirUnwed, ctx, {}).map((p) => p.id)).not.toContain(cadet.id);
  });

  it('excludes somebody outside the marriageable age band', () => {
    const ctx = testWorld(content);
    const tooYoung = place(ctx, { sex: 'male', age: 12, name: 'Too Young' });
    const tooOld = place(ctx, { sex: 'male', age: 60, name: 'Too Old' });

    const ids = candidatesFor(soleHeirUnwed, ctx, {}).map((p) => p.id);
    expect(ids).not.toContain(tooYoung.id);
    expect(ids).not.toContain(tooOld.id);
  });
});

describe('sole_heir_spent — a union nothing but ending it can help', () => {
  it('finds a man whose living wife is past childbearing', () => {
    const ctx = testWorld(content);
    const man = place(ctx, { sex: 'male', age: 40, name: 'The Spent Husband' });
    const wife = place(ctx, { sex: 'female', age: 55, name: 'His Wife' });
    marry(ctx, man, wife);

    expect(candidatesFor(soleHeirSpent, ctx, {}).map((p) => p.id)).toContain(man.id);
  });

  /**
   * Deliberately NOT symmetric. `rollBirths` gates conception on the
   * MOTHER's age alone, so ending HER marriage and finding her another does
   * not help a woman past childbearing — she is the reason nothing would
   * change. The bug, stated as a test: the first cut read the couple's
   * "mother" as herself when she was the blood one, which cast exactly the
   * case ending the marriage cannot fix.
   */
  it('excludes a woman past childbearing — remarrying her fixes nothing, whoever she marries', () => {
    const ctx = testWorld(content);
    const woman = place(ctx, { sex: 'female', age: 55, name: 'Not Fixable By This' });
    const husband = place(ctx, { sex: 'male', age: 40, name: 'Her Younger Husband' });
    marry(ctx, woman, husband);

    expect(candidatesFor(soleHeirSpent, ctx, {}).map((p) => p.id)).not.toContain(woman.id);
  });

  it('excludes a couple that could still conceive — the mother of the pair is within CHILDBEARING', () => {
    const ctx = testWorld(content);
    const man = place(ctx, { sex: 'male', age: 40, name: 'Still Trying' });
    const wife = place(ctx, { sex: 'female', age: 30, name: 'Still Able' });
    marry(ctx, man, wife);

    expect(candidatesFor(soleHeirSpent, ctx, {}).map((p) => p.id)).not.toContain(man.id);
  });

  it('excludes anyone unmarried', () => {
    const ctx = testWorld(content);
    const alone = place(ctx, { sex: 'male', age: 50, name: 'Never Married' });

    expect(candidatesFor(soleHeirSpent, ctx, {}).map((p) => p.id)).not.toContain(alone.id);
  });

  it('excludes a widow(er) — kill() already closed that marriage, which is exactly the case that does NOT need this', () => {
    const ctx = testWorld(content);
    const survivor = place(ctx, { sex: 'male', age: 40, name: 'The Widower' });
    const late = place(ctx, { sex: 'female', age: 55, name: 'The Late Wife' });
    marry(ctx, survivor, late);
    ctx.world.people.kill(late.id, ctx.world.year, 'in the ordinary way');

    expect(candidatesFor(soleHeirSpent, ctx, {}).map((p) => p.id)).not.toContain(survivor.id);
  });
});

describe('the marriage effect ends a union on both sides', () => {
  it('closes the target\'s open marriage, and the spouse\'s side of it too', () => {
    const ctx = testWorld(content);
    const heir = place(ctx, { sex: 'male', age: 40, name: 'Seeking Annulment' });
    const spouse = place(ctx, { sex: 'female', age: 55, name: 'The Set-Aside Spouse' });
    marry(ctx, heir, spouse);

    applyEffect({ kind: 'marriage', op: 'end', target: { slot: 'HEIR' } }, ctx, { HEIR: heir.id });

    expect(heir.marriages.find((m) => m.spouse === spouse.id)?.to).toBe(ctx.world.year);
    expect(spouse.marriages.find((m) => m.spouse === heir.id)?.to).toBe(ctx.world.year);
  });

  it('is a no-op when the target has no open marriage', () => {
    const ctx = testWorld(content);
    const alone = place(ctx, { sex: 'male', age: 40, name: 'Nobody To End' });

    expect(() => applyEffect({ kind: 'marriage', op: 'end', target: { slot: 'HEIR' } }, ctx, { HEIR: alone.id }))
      .not.toThrow();
    expect(alone.marriages).toHaveLength(0);
  });
});

describe('the priorityMatch effect', () => {
  it('adds the target to world.priorityMatch', () => {
    const ctx = testWorld(content);
    const heir = place(ctx, { sex: 'male', age: 22, name: 'Now Waiting' });

    applyEffect({ kind: 'priorityMatch', target: { slot: 'HEIR' } }, ctx, { HEIR: heir.id });

    expect(ctx.world.priorityMatch).toContain(heir.id);
  });

  it('does not add the same person twice', () => {
    const ctx = testWorld(content);
    const heir = place(ctx, { sex: 'male', age: 22, name: 'Flagged Twice' });

    applyEffect({ kind: 'priorityMatch', target: { slot: 'HEIR' } }, ctx, { HEIR: heir.id });
    applyEffect({ kind: 'priorityMatch', target: { slot: 'HEIR' } }, ctx, { HEIR: heir.id });

    expect(ctx.world.priorityMatch.filter((id) => id === heir.id)).toHaveLength(1);
  });
});

describe('matchSubjects reads the priority (issue #132, Stage 2)', () => {
  it('bypasses the house-wide cooldown a priority person would otherwise be blocked by', () => {
    const ctx = testWorld(content);
    const heir = place(ctx, { sex: 'male', age: 22, name: 'The Last One', castSlots: ['head'] });
    // The house went to market for somebody, recently, for anybody.
    ctx.world.courted['somebody-else'] = ctx.world.year - 1;

    expect(matchSubjects(ctx).map((p) => p.id)).not.toContain(heir.id);

    ctx.world.priorityMatch = [heir.id];
    expect(matchSubjects(ctx).map((p) => p.id)).toContain(heir.id);
  });

  it('bypasses the priority person\'s OWN per-person cooldown', () => {
    const ctx = testWorld(content);
    const heir = place(ctx, { sex: 'male', age: 22, name: 'Recently Courted', castSlots: ['head'] });
    ctx.world.courted[heir.id] = ctx.world.year - 1;
    ctx.world.priorityMatch = [heir.id];

    expect(matchSubjects(ctx).map((p) => p.id)).toContain(heir.id);
  });

  it('outweighs a naturally higher-weight rival for the season\'s one hand', () => {
    const ctx = testWorld(content);
    // A canExpress heir would ordinarily win matchWeight outright (100 vs 0).
    // Flagging the OTHER candidate — the one the crisis is actually about —
    // must still win the single hand `MATCHES_PER_SEASON` deals.
    const rival = place(ctx, { sex: 'male', age: 22, name: 'The Natural Favourite', castSlots: ['head'] });
    const heir = place(ctx, { sex: 'female', age: 22, name: 'The Flagged One' });
    ctx.world.priorityMatch = [heir.id];

    const dealt = matchSubjects(ctx).map((p) => p.id);
    expect(dealt).toContain(heir.id);
    expect(dealt).not.toContain(rival.id);
  });
});

describe('the priority is spent the day a hand is actually dealt', () => {
  it('clears world.priorityMatch once the marriage phase deals for that person', () => {
    const ctx = testWorld(content);
    const heir = place(ctx, { sex: 'female', age: 22, name: 'About To Be Dealt For', castSlots: ['head'] });
    ctx.world.priorityMatch = [heir.id];
    // The marriage phase only runs on a year divisible by three.
    ctx.world.year += (3 - (ctx.world.year % 3)) % 3;

    phase('marriage', ctx);

    expect(ctx.world.priorityMatch).not.toContain(heir.id);
  });
});
