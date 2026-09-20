import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadContent } from '@ed/content';
import {
  LADDER_ROLES, emptyFrequencyLedger, isLadderRole, recordTemplateFire, templateRationAllows,
  type SlotSpec,
} from '@ed/schema';
import {
  candidatesFor, foremostOf, measureAscension, phenotypeOf, place, secondForemostOf, standingOf, testWorld,
} from '@ed/core';
import { ladderCast } from './tools/ladder-policy.js';

const bundle = loadContent();

/** The role, unfiltered — the pool is the whole of what this role narrows. */
const FOREMOST: SlotSpec = { role: 'foremost', castBy: 'engine', filters: [], optional: false, bind: 'event' };
const SECOND: SlotSpec = { role: 'second_foremost', castBy: 'engine', filters: [], optional: false, bind: 'event' };

/**
 * THE MAN WHO IS CLIMBING (issue #41).
 *
 * The Hierophant gate asks for a Madness floor and says on its own face why
 * no run reaches it — *nothing has been asked of him that cost anything* —
 * and the reason nothing could be authored to ask him was that there was no
 * way to NAME him. Every slot role in the game named a position; the ladder
 * is not a position.
 */
describe('the foremost slot role', () => {
  it('casts one man, and he is the one standing highest', () => {
    const ctx = testWorld(bundle, 8090);
    const pool = candidatesFor(FOREMOST, ctx, {});
    const top = foremostOf(ctx);
    expect(top, 'the founding cast has nobody who can express').toBeTruthy();
    expect(pool.map((p) => p.id)).toEqual([top!.person.id]);
  });

  it('is the same man the house is measured by, so a scene and a client cannot disagree', () => {
    const ctx = testWorld(bundle, 8091);
    expect(measureAscension(ctx).foremost?.person).toBe(foremostOf(ctx)?.person.id);
  });

  /**
   * The pool IS the Madness gate for this role (invariant 1), which is what
   * lets `madness/gate` accept an outcome here without a `canExpress` filter.
   * If that ever stops being true, the rule stops being safe.
   */
  it('never casts anybody who cannot express, so dealing Madness to it is safe', () => {
    const ctx = testWorld(bundle, 8092);
    for (let i = 0; i < 8; i++) place(ctx, { sex: 'female', age: 20 + i, name: `Daughter ${i}` });
    for (const p of candidatesFor(FOREMOST, ctx, {})) {
      expect(p.sex, `${p.name} was cast as the family's foremost expresser`).toBe('male');
      expect(standingOf(ctx, p).blocked).not.toBe('he cannot express it');
    }
  });

  it('casts nobody at all in a house with no expressers, rather than the least worst person', () => {
    const ctx = testWorld(bundle, 8093);
    // A house of women is a house with nobody on the ladder. It used to hand
    // back whoever the store listed first, at rung `none`, and a client
    // printed him as standing highest of anyone.
    for (const p of ctx.world.people.all()) {
      if (p.status === 'alive') ctx.world.people.kill(p.id, ctx.world.year, 'making room for the fixture');
    }
    place(ctx, { sex: 'female', age: 30, name: 'The Last Daughter' });
    expect(foremostOf(ctx)).toBeUndefined();
    expect(measureAscension(ctx).foremost).toBeUndefined();
  });
});

/**
 * THE AUTHOR'S OWN RATION. `repeatable` and `cooldownYears` are declared on
 * every template and, outside the frame lane, were read by nothing — nine
 * shipped one-shots that could fire twice and seventeen cooldowns that held
 * nothing back (invariant 11).
 */
describe('a template rations itself, not only its tier', () => {
  const once = { id: 'a_thing_that_happens_once', repeatable: false, cooldownYears: 0 };
  const slow = { id: 'a_thing_that_waits', repeatable: true, cooldownYears: 40 };

  it('lets anything fire that has never fired', () => {
    const ledger = emptyFrequencyLedger();
    expect(templateRationAllows(once, ledger, 1042)).toBe(true);
    expect(templateRationAllows(slow, ledger, 1042)).toBe(true);
  });

  it('never fires a one-shot twice, however many centuries pass', () => {
    const ledger = emptyFrequencyLedger();
    recordTemplateFire(once.id, ledger, 1042);
    expect(templateRationAllows(once, ledger, 1043)).toBe(false);
    expect(templateRationAllows(once, ledger, 2042)).toBe(false);
  });

  it('holds a cooldown for exactly as long as it says and not a year longer', () => {
    const ledger = emptyFrequencyLedger();
    recordTemplateFire(slow.id, ledger, 1042);
    expect(templateRationAllows(slow, ledger, 1081)).toBe(false);
    expect(templateRationAllows(slow, ledger, 1082)).toBe(true);
  });

  it('records the year, so a save carries the ration across a session', () => {
    const ledger = emptyFrequencyLedger();
    recordTemplateFire('anything', ledger, 1400);
    expect(ledger.templateLastFired['anything']).toBe(1400);
    expect(ledger.templateFires['anything']).toBe(1);
  });
});

/**
 * THE CONTENT HALF. A role nothing casts is vocabulary rather than a game,
 * and a bargain with no cost is a button.
 */
describe('the ladder charges the man on it', () => {
  // EVERY ladder role, from the one list — `second_foremost` names a man on
  // the same ladder and is charged by the same rites (issue #61, Stage E5).
  const events = bundle.events.filter(
    (e) => Object.values(e.slots).some((s) => isLadderRole(s.role)),
  );

  it('has content that casts him at all', () => {
    expect(events.length, 'nothing in the library asks anything of the man who is climbing').toBeGreaterThan(0);
  });

  it('offers a branch that costs him and a branch that does not, in every one of them', () => {
    for (const e of events) {
      if (e.interaction.kind === 'narration') continue;
      const slots = Object.entries(e.slots).filter(([, s]) => isLadderRole(s.role)).map(([id]) => id);
      /**
       * THREE ways to charge him, and only the first is an authored number.
       *
       * The second is a rite that names him ASCENDANT — the Vessel (issue
       * #43) deals no `madness` effect of its own and transfers the consumed
       * relative's Madness into him in full and uncapped, so a test that knew
       * only the first spelling read the largest cost on the ladder as a free
       * option.
       *
       * The third is a rite that names him SUBJECT, which is the unmaking:
       * the foremost man is the one taken apart, and what it costs him is his
       * life. That is the heaviest charge any scene in the game lays on the
       * man it casts, and it was invisible here for the same reason the second
       * one was — the cost is a rule about bodies rather than a number in the
       * template.
       */
      const costs = (c: typeof e.interaction.choices[number]) => c.outcomes.some(
        (o) => o.effects.some((f) => (f.kind === 'madness' && f.delta > 0
          && typeof f.target === 'object' && 'slot' in f.target && slots.includes(f.target.slot))
          || (f.kind === 'rite' && slots.includes(f.ascendant))
          || (f.kind === 'rite' && f.subject !== undefined && slots.includes(f.subject))),
      );
      const paying = e.interaction.choices.filter(costs);
      const free = e.interaction.choices.filter((c) => !costs(c));
      expect(paying.length, `${e.id} never charges the man it casts`).toBeGreaterThan(0);
      expect(free.length, `${e.id} has no way to refuse, so it is not a bargain`).toBeGreaterThan(0);
    }
  });

  it('rations every one of them, since the ladder is a pressure signal now', () => {
    // `ascension` entered PRESSURE_SIGNALS with these, and the pressure lane
    // draws before ambient every year: unrationed, one of them fired 83 times
    // in a thousand years.
    for (const e of events) {
      if (e.frequency === 'mythic' || e.frequency === 'rare') continue;
      expect(e.cooldownYears, `${e.id} is ladder pressure with no cooldown`).toBeGreaterThan(0);
    }
  });
});

describe('the ladder policy names the body it spends', () => {
  it('casts the strongest available Vessel instead of pressing Take with an empty cast', () => {
    const ctx = testWorld(bundle, 8181);
    const people = ctx.world.people.household(ctx.world.playerHouse, ctx.world.year)
      .filter((p) => p.status === 'alive');
    expect(people.length).toBeGreaterThan(1);
    const candidates = people.map((p) => ({
      id: p.id,
      name: p.name,
      age: ctx.world.year - p.born,
    }));
    const expected = [...people].sort((a, b) =>
      phenotypeOf(b, ctx.genetics, ctx.world.year).eldritch.carriedFont
      - phenotypeOf(a, ctx.genetics, ctx.world.year).eldritch.carriedFont
      || (a.id < b.id ? -1 : 1))[0]!;
    const fill = ladderCast(ctx, {
      cast: [{ slot: 'VESSEL', optional: false, candidates }],
    });
    expect(fill.VESSEL).toBe(expected.id);
  });
});

/**
 * THE SECOND MAN ON THE LADDER (§22's terminal irony, issue #61, Stage E5).
 *
 * God asks for a living Demigod standing BESIDE the man who ascends, and
 * until this role existed the content had no way to name him: every rite
 * template cast its ascendant `foremost`, a pool of exactly one, and the
 * three rite functions in `events/rites.ts` are the only writes to a living
 * man's power anywhere in the engine. Stage E4 established the rest of it
 * the expensive way — it gave a named heir the books, the tutor's terms, the
 * marriages and a career exemption, and his own power did not move, because
 * none of those touch power.
 */
describe('the second_foremost slot role', () => {
  it('casts the man one place below the foremost, and never the foremost himself', () => {
    const ctx = testWorld(bundle, 8090);
    // Two expressers is the state the role exists for, and a founding cast
    // does not reliably have one — build it rather than wait for it.
    for (let i = 0; i < 6; i++) place(ctx, { sex: 'male', age: 30 + i, name: `Son ${i}` });

    const top = foremostOf(ctx);
    const second = secondForemostOf(ctx);
    expect(top, 'the fixture has nobody who can express').toBeTruthy();
    expect(second, 'the fixture has only one expresser').toBeTruthy();
    expect(second!.person.id).not.toBe(top!.person.id);
  });

  it('reads off the same ranking as foremost, so the two cannot disagree about who is first', () => {
    const ctx = testWorld(bundle, 8091);
    for (let i = 0; i < 6; i++) place(ctx, { sex: 'male', age: 25 + i, name: `Cousin ${i}` });
    const top = foremostOf(ctx);
    const second = secondForemostOf(ctx);
    if (!top || !second) return;
    // Strictly not better: the second man may TIE the foremost on rung and
    // power — household order breaks it — but he may never outrank him.
    const a = top.standing;
    const b = second.standing;
    expect(b.power <= a.power || b.rung !== a.rung).toBe(true);
    expect(measureAscension(ctx).foremost?.person).toBe(top.person.id);
  });

  /**
   * The pool IS the Madness gate for this role, exactly as it is for
   * `foremost` (invariant 1) — which is what lets `madness/gate`, the rite
   * shape rule and `careers/gate` accept an outcome cast here with no
   * `canExpress` filter. All three ask `poolIsExpressers`, one list in
   * `rules.ts`, for precisely this reason.
   */
  it('never casts anybody who cannot express, so dealing a rite to it is safe', () => {
    const ctx = testWorld(bundle, 8092);
    for (let i = 0; i < 8; i++) place(ctx, { sex: 'female', age: 20 + i, name: `Daughter ${i}` });
    for (const p of candidatesFor(SECOND, ctx, {})) {
      expect(p.sex, `${p.name} was cast as the family's second expresser`).toBe('male');
      expect(standingOf(ctx, p).blocked).not.toBe('he cannot express it');
    }
  });

  it('casts nobody in a house with fewer than two expressers, which is most years', () => {
    const ctx = testWorld(bundle, 8093);
    for (const p of ctx.world.people.all()) {
      if (p.status === 'alive') ctx.world.people.kill(p.id, ctx.world.year, 'making room for the fixture');
    }
    place(ctx, { sex: 'female', age: 30, name: 'The Last Daughter' });
    expect(secondForemostOf(ctx)).toBeUndefined();
    expect(candidatesFor(SECOND, ctx, {})).toEqual([]);
  });

  it('is an empty pool rather than a second copy of the foremost when only one man expresses', () => {
    const ctx = testWorld(bundle, 8094);
    for (const p of ctx.world.people.all()) {
      if (p.status === 'alive') ctx.world.people.kill(p.id, ctx.world.year, 'making room for the fixture');
    }
    place(ctx, { sex: 'male', age: 34, name: 'The Only Son' });
    const top = foremostOf(ctx);
    if (!top) return;   // the placed man's genome may carry no font at all
    expect(secondForemostOf(ctx)).toBeUndefined();
  });
});

/**
 * THE ENFORCEMENT POINT FOR A RULE THAT FAILED FIVE TIMES (issue #61, Stage E5).
 *
 * AGENTS.md's "Do not" has said *keep no hand-written copy of a closed union
 * anywhere* since the list existed, and the ladder roles were copied by hand in
 * FIVE places regardless: `madness/gate`, the rite shape rule, `careers/gate`,
 * `costsTheClimber`, and `rites.slow.test.ts`'s own `charges()`. Adding
 * `second_foremost` broke every one of them at once, and NONE of them failed to
 * compile — a `role === 'foremost'` comparison is valid TypeScript that quietly
 * answers "no" about a role it has never heard of.
 *
 * What each silence cost, in the order they were found:
 *
 *   the three rules      would have demanded a `canExpress` filter on a slot
 *                        whose pool IS the gate, so the author restates the role
 *   `costsTheClimber`    read the second man's Vessel — the largest charge the
 *                        ladder lays on anybody — as a FREE option, so no gate
 *                        column ever took it deliberately
 *   `charges()`          same, in a slow-lane suite the fast lane cannot see, so
 *                        a house that had REFUSED the rite ended up carrying it
 *
 * The compiler cannot catch this and a reviewer did not. A sweep can, and it is
 * cheap. `LADDER_ROLES` in `schema/event.ts` is the one list; anything asking
 * whether a slot is on the ladder asks `isLadderRole`.
 */
describe('nothing hand-copies the ladder roles', () => {
  const REPO = join(import.meta.dirname, '../../..');
  /** Where the list is allowed to be written out: the definition itself. */
  const DEFINES_IT = 'packages/schema/src/event.ts';
  const HAND_COPY = /\.role\s*(?:===|!==)\s*['"](?:foremost|second_foremost)['"]/;

  const sources = (dir: string, out: string[] = []): string[] => {
    for (const e of readdirSync(join(REPO, dir), { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) sources(rel, out);
      else if (/\.(ts|vue)$/.test(e.name)) out.push(rel);
    }
    return out;
  };

  it('asks isLadderRole instead of comparing against the role name', () => {
    const offenders = sources('packages')
      .filter((f) => f !== DEFINES_IT)
      .filter((f) => HAND_COPY.test(readFileSync(join(REPO, f), 'utf8')));
    expect(
      offenders,
      'a hand-written copy of the ladder roles — it compiles, and it silently '
      + 'answers "no" about any role added after it was written. Use `isLadderRole` '
      + `(\`${DEFINES_IT}\`), which reads the one list.`,
    ).toEqual([]);
  });

  /** And the list itself has to still be the thing the enum declares. */
  it('keeps LADDER_ROLES a subset of the SlotRole union it claims to index', () => {
    const declared = readFileSync(join(REPO, DEFINES_IT), 'utf8');
    for (const role of LADDER_ROLES) {
      expect(declared, `${role} is in LADDER_ROLES but not in SlotRoleS`)
        .toContain(`'${role}',`);
    }
  });
});
