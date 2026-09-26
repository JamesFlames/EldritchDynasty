import { describe, expect, it } from 'vitest';
import { loadContent } from '@ed/content';
import { newGame, resumeGame } from '@ed/core';

const content = loadContent();

describe('house ambition (issue #210)', () => {
  it('chooses, replaces, clears, and derives progress from the world', () => {
    const g = newGame(content, { seed: 210, campaign: 'short', decider: 'chronicler' });
    expect(g.view().ambition).toBeUndefined();

    expect(g.setAmbition('restore_ledger')).toBe(true);
    const before = g.view().ambition!;
    expect(before.id).toBe('restore_ledger');
    expect(before.progress.current).toBe(g.ctx.world.clausesRecovered.size);

    g.ctx.world.clausesRecovered.add('test_clause');
    const after = g.view().ambition!;
    expect(after.progress.current).toBe(before.progress.current + 1);

    expect(g.setAmbition('secure_branches')).toBe(true);
    expect(g.view().ambition?.id).toBe('secure_branches');
    expect(g.setAmbition(null)).toBe(true);
    expect(g.view().ambition).toBeUndefined();
  });

  it('persists only the selected ambition and resumes it', () => {
    const g = newGame(content, { seed: 211, campaign: 'long', decider: 'chronicler' });
    g.setAmbition('raise_ascendant');
    const saved = JSON.parse(JSON.stringify(g.save()));

    expect(saved.houseAmbition).toBe('raise_ascendant');
    expect(saved.ambitionProgress).toBeUndefined();

    const resumed = resumeGame(saved, content, { decider: 'chronicler' });
    expect(resumed.view().ambition?.id).toBe('raise_ascendant');
  });

  it('does not alter simulation outcomes', () => {
    const withAmbition = newGame(content, { seed: 212, campaign: 'short', decider: 'chronicler' });
    const without = newGame(content, { seed: 212, campaign: 'short', decider: 'chronicler' });
    withAmbition.setAmbition('deepen_blood');

    withAmbition.advance(60);
    without.advance(60);

    const a = JSON.parse(JSON.stringify(withAmbition.save()));
    const b = JSON.parse(JSON.stringify(without.save()));
    delete a.savedAt; delete b.savedAt;
    delete a.houseAmbition; delete b.houseAmbition;
    expect(a).toEqual(b);
  });

  it('adapts campaign horizons without changing the catalogue', () => {
    const short = newGame(content, { seed: 213, campaign: 'short', decider: 'chronicler' });
    const long = newGame(content, { seed: 213, campaign: 'long', decider: 'chronicler' });
    short.setAmbition('raise_ascendant');
    long.setAmbition('raise_ascendant');

    expect(short.ambitionOptions()).toHaveLength(4);
    expect(long.ambitionOptions()).toHaveLength(4);
    expect(short.view().ambition?.progress.target).toBeLessThan(long.view().ambition!.progress.target);
  });
});
