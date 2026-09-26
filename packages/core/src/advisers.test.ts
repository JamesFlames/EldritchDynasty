import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Person } from '@ed/schema';
import type { PendingDecision } from './events/decisions.js';
import type { SimCtx } from './world.js';
import { adviceForDecision } from './advisers.js';

function person(id: string, name: string, career: string, born = 1060): Person {
  return {
    id, name, sex: 'male', sigilSeed: 1, houseOfOrigin: 'house_player',
    born, status: 'alive',
    trueParents: {}, claimedParents: {}, lineageDocuments: [],
    // Deliberately opaque: adviser code must never inspect it.
    genome: { ref: `hidden-${id}` } as never,
    traits: new Set(), awakening: { awakened: false, forced: false, declaredMundane: false },
    spellsKnown: [], career: { career, from: 1080 },
    membership: [{ house: 'house_player', kind: 'blood', from: born }],
    marriages: [], madness: 0, rites: [], acquired: {}, taught: [], castSlots: [], tier: 'hot',
  } as Person;
}

function matchDecision(): PendingDecision {
  return {
    kind: 'match', id: 'dec_match', year: 1100,
    subject: { id: 'subject', name: 'Ysolde', sex: 'female', age: 20 },
    cards: [
      {
        id: 'near', kind: 'household', name: 'Corin', sex: 'male', age: 22,
        house: 'house_player', houseName: 'House Player', blurb: 'Known to the house.',
        dowry: 0, kinship: 0.0625, line: 'ordinary', lineSeen: 6,
        words: 'close kin · deep blood',
        panel: {
          issue: [{ name: 'Cesse', relation: 'of his house', borne: 5, grown: 4 }],
          woken: [{ name: 'Aren', relation: 'his uncle', year: 1080, sex: 'male', expressed: true }],
          said: [], ourBook: [{ year: 1090, text: 'A known page.', embellished: false }],
        },
        person: 'corin', available: true,
      },
      {
        id: 'far', kind: 'outsider', name: 'Aldren', sex: 'male', age: 23,
        house: 'house_far', houseName: 'House Far', blurb: 'Little is known.',
        dowry: 20, kinship: 0, line: 'unknown', lineSeen: 0,
        words: 'no line anybody here has watched',
        panel: { issue: [], woken: [], said: [], ourBook: [] },
        available: true,
      },
    ],
  } as PendingDecision;
}

function ctxWith(hidden: string): SimCtx {
  const priest = person('priest', 'Father Orin', 'clergy');
  const reader = person('reader', 'Tomas', 'scholar');
  // Hidden truth is intentionally different between otherwise identical worlds.
  (priest as unknown as { genome: unknown }).genome = { secret: hidden };
  const people = new Map<string, Person>([[priest.id, priest], [reader.id, reader]]);
  return {
    world: {
      year: 1100,
      playerHouse: 'house_player',
      succession: [],
      people: {
        household: () => [...people.values()],
        get: (id: string) => people.get(id),
      },
    },
  } as unknown as SimCtx;
}

describe('living advisers', () => {
  it('lets two advisers disagree for reasons visible in their lenses', () => {
    const advice = adviceForDecision(ctxWith('truth-a'), matchDecision());
    expect(advice).toHaveLength(2);
    expect(advice.map((a) => a.adviser.name)).toEqual(['Father Orin', 'Tomas']);
    expect(advice[0]!.position).toContain('Aldren');
    expect(advice[1]!.position).toContain('Corin');
    expect(advice[0]!.cares).toContain('Church');
    expect(advice[1]!.cares).toContain('read');
  });

  it('does not change when hidden genetic truth contradicts the same public evidence', () => {
    expect(adviceForDecision(ctxWith('opposite-a'), matchDecision()))
      .toEqual(adviceForDecision(ctxWith('opposite-b'), matchDecision()));
  });

  it('keeps the adviser boundary free of hidden-state and future-RNG readers', () => {
    const source = readFileSync(join(import.meta.dirname, 'advisers.ts'), 'utf8');
    for (const forbidden of ['phenotypeOf', '.genome', 'bearing', 'streamFor', 'Math.random', 'overflowMadness']) {
      expect(source, `adviser code must not read ${forbidden}`).not.toContain(forbidden);
    }
  });
});
