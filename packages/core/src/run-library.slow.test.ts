import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import {
  CAMPAIGNS, canonical, libraryRunOf, newGame,
} from '@ed/core';
import type { SavedGame } from '@ed/schema';

const content = loadContent();

function fixedLibraryRun() {
  const source = newGame(content, { seed: 9090, campaign: 'short', decider: 'chronicler' });
  const person = source.ctx.world.people.household(source.ctx.world.playerHouse, source.year)[0]!;
  source.ctx.world.chronicle.push({
    id: 'library_gate_page',
    year: 1200,
    weight: 'paragraph',
    text: `${person.name} was entered in the book as untouched by the rite.`,
    named: true,
    record: 'embellish',
    claims: [{ kind: 'attr', person: person.id, attr: 'madness', value: 0 }],
  });
  source.ctx.world.ending = { id: 'forgotten', year: CAMPAIGNS.short.endYear };
  return libraryRunOf(source.ctx)!;
}

function withoutNarrativeMemory(save: SavedGame): string {
  const { libraryMemories: _libraryMemories, ...mechanical } = save;
  // Format 23 exists because populated memories need persistence. For the
  // comparison itself the envelope number is not a game mechanic.
  return canonical({ ...mechanical, format: 22 });
}

describe('Library of Houses has no material advantage', () => {
  const oldHouse = fixedLibraryRun();

  it('keeps paired runs byte-identical outside the narrative memory field', () => {
    // Stronger than a mean-within-margin check: every paired seed must finish
    // with the same treasury, respect, genomes, acreage, ladder, and ending,
    // because no simulation system is allowed to read libraryMemories.
    for (const seed of [811, 912, 1013, 1114]) {
      const empty = newGame(content, { seed, campaign: 'short', decider: 'chronicler' });
      const seeded = newGame(content, {
        seed,
        campaign: 'short',
        decider: 'chronicler',
        libraryRuns: [oldHouse],
      });

      empty.advance(CAMPAIGNS.short.years + 1);
      seeded.advance(CAMPAIGNS.short.years + 1);

      expect(seeded.ctx.world.libraryMemories.length, `seed ${seed} imported nothing`).toBeGreaterThan(0);
      expect(
        withoutNarrativeMemory(seeded.save()),
        `seed ${seed}: the library changed something material`,
      ).toBe(withoutNarrativeMemory(empty.save()));
    }
  });
});
