import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CirculatingTale } from '@ed/core';
import { accountsOf } from './tales.js';

const SRC = join(import.meta.dirname, '..');

function tale(over: Partial<CirculatingTale> & { id: string; about: string }): CirculatingTale {
  return {
    form: 'song', teller: 'a drover', bias: 'wants it to be funny',
    text: '…', since: 1100, mutations: 0,
    ...over,
  } as CirculatingTale;
}

describe('grouping the accounts of one event', () => {
  it('puts two accounts of the same night together', () => {
    const groups = accountsOf([
      tale({ id: 'a', about: 'the_drowning' }),
      tale({ id: 'b', about: 'the_fire' }),
      tale({ id: 'c', about: 'the_drowning' }),
    ]);
    expect(groups.map((g) => g.about)).toEqual(['the_drowning', 'the_fire']);
    expect(groups[0]!.tales.map((t) => t.id)).toEqual(['a', 'c']);
    expect(groups[1]!.tales.map((t) => t.id)).toEqual(['b']);
  });

  it('leaves a single account alone', () => {
    const groups = accountsOf([tale({ id: 'only', about: 'the_fire' })]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.tales).toHaveLength(1);
  });

  it('says nothing about a world that has heard nothing', () => {
    expect(accountsOf([])).toEqual([]);
  });

  /**
   * ── THE ACCEPTANCE THAT IS ACTUALLY HARD ──────────────────────────────────
   *
   * *"Nothing in the rendered pair lets a player rank them except the teller
   * and the bias. If a reviewer can tell which one the game thinks is true,
   * the layout has taken a side."*
   *
   * Grouping is easy. Not having an opinion is not. Every obvious ordering is
   * an argument: most-repeated says the loudest is truest, fewest mutations
   * says the least-drifted is, and either one is the game adjudicating in its
   * own voice, which it does not do.
   *
   * So the accounts keep the order the view handed them — the year each began
   * circulating — which is a fact about the telling that no client chose.
   */
  it('keeps the order it was given, and sorts by nothing of its own', () => {
    const given = [
      tale({ id: 'loud', about: 'x', mutations: 40, since: 1200, form: 'charm' }),
      tale({ id: 'quiet', about: 'x', mutations: 0, since: 1100, form: 'song' }),
    ];
    // Handed in that order, they come back in that order — the noisy one first
    // only because the caller had it first, and not because it is noisy.
    expect(accountsOf(given)[0]!.tales.map((t) => t.id)).toEqual(['loud', 'quiet']);
    expect(accountsOf([...given].reverse())[0]!.tales.map((t) => t.id)).toEqual(['quiet', 'loud']);
  });

  it('reads nothing that could rank one account above the other', () => {
    const source = readFileSync(join(SRC, 'lib/tales.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    for (const tell of ['mutations', 'accuracy', 'form', 'sort(', 'length >']) {
      expect(source, `the grouping reads \`${tell}\`, which is an opinion`).not.toContain(tell);
    }
  });
});

/**
 * And the layout, asserted on the template — because the failure here is not a
 * wrong value, it is a page that quietly argues.
 */
describe('the pair is drawn without a side being taken', () => {
  const abroad = readFileSync(join(SRC, 'components/Abroad.vue'), 'utf8');

  /**
   * Both accounts come out of ONE `v-for`. Markup written twice — a left and a
   * right, a first and a rest — is two things that can drift apart, and the
   * moment they do the layout has an opinion. One loop cannot.
   */
  it('renders both accounts from a single loop', () => {
    const loops = [...abroad.matchAll(/v-for="tale in /g)];
    expect(loops, 'the accounts are drawn by more than one loop').toHaveLength(1);
    expect(abroad).toMatch(/v-for="tale in group\.tales"/);
  });

  /** Equal columns. A column puts one above the other, and above is a claim. */
  it('faces them at equal width rather than stacking them', () => {
    expect(abroad.replace(/\s+/g, ' ')).toMatch(/\.facing\.pair \{[^}]*grid-template-columns: 1fr 1fr/);
  });

  /**
   * Nothing distinguishes ONE ACCOUNT from the other. Scoped to `.tale`
   * deliberately: the panel's own `:first-of-type` rules are about the first
   * GROUP in the list, which is a fact about the page and not a claim about
   * any night — the first draft of this test forbade the string outright and
   * failed on exactly that. What must never appear is a rule or an index that
   * reaches one of a pair and not the other.
   */
  it('never singles out one account of a pair', () => {
    const stripped = abroad.replace(/<!--[\s\S]*?-->/g, '');
    const partial = [
      'tales[0]', 'tales[1]',
      '.tale + .tale', '.tale:first', '.tale:last', '.tale:nth',
    ];
    for (const tell of partial) {
      expect(stripped, `\`${tell}\` reaches one account of a pair and not the other`)
        .not.toContain(tell);
    }
  });
});
