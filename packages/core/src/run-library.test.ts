import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import {
  bootstrap, digestOf, libraryClaimsContradict, libraryRunOf, loadGame, saveGame, viewOf,
} from '@ed/core';
import { readRunLibrary } from '@ed/schema';

const content = loadContent();

function finishedHouse() {
  const ctx = bootstrap(content, 7001, 1042, 'short');
  const person = ctx.world.people.household(ctx.world.playerHouse, ctx.world.year)[0]!;
  ctx.world.founding = {
    houseName: 'The House That Wrote It Larger',
    heirloom: 'portion_of_agelessness',
    grudge: 'house_marrow',
    year: 1042,
  };
  ctx.world.discrepancies.set('old_lie', {
    severity: 'major',
    provableBy: ['the_church'],
    state: 'buried',
  });
  ctx.world.chronicle.push({
    id: 'old_page',
    year: 1201,
    weight: 'paragraph',
    title: 'The Untroubled Son',
    text: `${person.name} came through the old rite untouched, and there was no madness in him.`,
    named: true,
    record: 'embellish',
    discrepancyId: 'old_lie',
    claims: [{ kind: 'attr', person: person.id, attr: 'madness', value: 0 }],
  });
  ctx.world.ending = { id: 'forgotten', year: 1342 };
  return { ctx, person };
}

describe('the Library of Houses', () => {
  it('extracts only what the finished family book exposed', () => {
    const { ctx, person } = finishedHouse();
    const run = libraryRunOf(ctx)!;

    expect(run.house).toBe('The House That Wrote It Larger');
    expect(run.entries).toHaveLength(1);
    expect(run.entries[0]!.people[person.id]).toBe(person.name);
    expect(run.entries[0]!.discrepancy).toEqual({ id: 'old_lie', state: 'buried' });

    const wire = JSON.stringify(run);
    expect(wire).not.toContain('trueParents');
    expect(wire).not.toContain('genome');
    expect(wire).not.toContain('treasury');
  });

  it('seeds a later account that contradicts the old claim field-for-field', () => {
    const { ctx } = finishedHouse();
    const run = libraryRunOf(ctx)!;
    const second = bootstrap(content, 7001, 1042, 'short', [run]);

    const memory = second.world.libraryMemories[0];
    expect(memory, 'the old house left no account in the second run').toBeDefined();
    expect(memory!.sourceHouse).toBe(run.house);
    expect(memory!.text).toContain(memory!.sourceText);

    const contradicts = memory!.sourceClaims.some((oldClaim) =>
      memory!.claims.some((newClaim) => libraryClaimsContradict(oldClaim, newClaim)));
    expect(contradicts, 'the retelling changed words without contradicting a closed claim').toBe(true);

    const heard = viewOf(second).tales.find((tale) => tale.id === memory!.id);
    expect(heard, 'the imported account never reached the ordinary tales surface').toBeDefined();
    expect(heard!.source?.house).toBe(run.house);
    expect(heard!.claims).toEqual(memory!.claims);
  });

  it('saves the chosen snapshot so later library changes cannot rewrite the run', () => {
    const { ctx } = finishedHouse();
    const run = libraryRunOf(ctx)!;
    const second = bootstrap(content, 7002, 1042, 'short', [run]);
    const before = second.world.libraryMemories.map((memory) => ({ ...memory }));

    const resumed = loadGame(saveGame(second), content);
    expect(resumed.world.libraryMemories).toEqual(before);
  });

  it('drops malformed historical entries instead of failing a new run', () => {
    const parsed = readRunLibrary({
      format: 1,
      runs: [{
        id: 'good-run',
        seed: 1,
        campaign: 'short',
        endedYear: 1342,
        house: 'House Good',
        ending: { id: 'forgotten', title: 'Forgotten' },
        entries: [
          {
            id: 'good',
            said: 'A line remained.',
            year: 1200,
            claims: [{ kind: 'trait', person: 'p_1', trait: 'marked', has: true }],
          },
          { id: 'bad', said: '', year: 'not a year', claims: [] },
        ],
      }, {
        id: 4,
        seed: 'wrong',
        entries: [],
      }],
    });

    expect(parsed.runs).toHaveLength(1);
    expect(parsed.runs[0]!.entries).toHaveLength(1);
    expect(parsed.runs[0]!.entries[0]!.id).toBe('good');
  });

  it('does not move the historical digest when the installation library is empty', () => {
    const empty = bootstrap(content, 8118, 1042, 'long', []);
    // digest() normalizes format 23 + an empty additive field back to the
    // format-22 fingerprint. Existing golden digest tests therefore remain
    // the independent guard that this value really is today's behaviour.
    expect(empty.world.libraryMemories).toEqual([]);
    expect(digestOf(empty)).toBe(digestOf(bootstrap(content, 8118, 1042, 'long')));
  });
});
