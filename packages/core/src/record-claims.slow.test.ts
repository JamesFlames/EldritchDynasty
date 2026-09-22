import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import {
  autoResolveDecision, bootstrap, makeRng, resolveRecord, stepYear,
  type RecordOption,
} from '@ed/core';

const bundle = loadContent();
const YEARS = 500;
const SEEDS = [1380, 1518, 1656, 1794];

interface ReadStats {
  entriesWithClaims: number;
  cards: number;
  cardsWithOurBook: number;
  truthfulPages: number;
  embellishedPages: number;
}

/**
 * Play with the docket OPEN so Match cards can be inspected before the
 * decision consumes them. Everything except the Record answer still goes
 * through the engine's ordinary auto resolver.
 */
function play(seed: number, answer: RecordOption): ReadStats {
  const ctx = bootstrap(bundle, seed, 1042);
  const rng = makeRng(seed * 17 + 138);
  let cards = 0;
  let cardsWithOurBook = 0;
  let truthfulPages = 0;
  let embellishedPages = 0;

  for (let i = 0; i < YEARS; i++) {
    const before = ctx.world.year;
    stepYear(ctx, false);

    let guard = 0;
    while (ctx.world.pendingDecisions.length) {
      if (guard++ > 500) throw new Error('decision queue did not drain');
      const decision = ctx.world.pendingDecisions[0]!;

      if (decision.kind === 'match') {
        cards += decision.cards.length;
        for (const card of decision.cards) {
          const pages = card.panel?.ourBook ?? [];
          if (pages.length) cardsWithOurBook += 1;
          for (const page of pages) {
            if (page.embellished) embellishedPages += 1;
            else truthfulPages += 1;
          }
        }
      }

      if (decision.kind === 'record') resolveRecord(ctx, decision.id, answer);
      else autoResolveDecision(ctx, decision, rng);
    }

    // Broken line or campaign term: the clock has deliberately stopped.
    if (ctx.world.year === before) break;
  }

  return {
    entriesWithClaims: ctx.world.chronicle.filter((e) => (e.claims?.length ?? 0) > 0).length,
    cards,
    cardsWithOurBook,
    truthfulPages,
    embellishedPages,
  };
}

const sum = (xs: ReadStats[], key: keyof ReadStats) => xs.reduce((n, x) => n + x[key], 0);

describe('truthful claims reach the Match panel over played runs (issue #138)', () => {
  it('four always-Record 500-year runs produce claimed pages and ourBook rows', () => {
    const runs = SEEDS.map((seed) => play(seed, 'record'));
    expect(sum(runs, 'entriesWithClaims')).toBeGreaterThan(0);
    expect(sum(runs, 'cards')).toBeGreaterThan(0);
    expect(sum(runs, 'cardsWithOurBook')).toBeGreaterThan(0);
    expect(sum(runs, 'truthfulPages')).toBeGreaterThan(0);
  });

  it('PanelPage.embellished has both reachable values across the two record policies', () => {
    const honest = SEEDS.map((seed) => play(seed, 'record'));
    const forged = SEEDS.map((seed) => play(seed, 'embellish'));
    expect(sum(honest, 'truthfulPages')).toBeGreaterThan(0);
    expect(sum(forged, 'embellishedPages')).toBeGreaterThan(0);
  });
});
