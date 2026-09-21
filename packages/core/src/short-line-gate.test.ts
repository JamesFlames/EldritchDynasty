import { describe, expect, it } from 'vitest';
import type { EndingId } from '@ed/schema';
import { shortLineVerdictOver } from './tools/short-line-gate.js';
import type { EndingRun } from './tools/ending-gate.js';

function run(ending: EndingId, seed: number): EndingRun {
  return {
    seed,
    policy: 'chronicler',
    ending,
    attested: 'adept',
    clauses: 4,
    survivors: 16,
    householdLow: 8,
    bloodLeft: 10,
    bloodLow: 4,
  };
}

function balanced(): EndingRun[] {
  const endings: EndingId[] = ['broken_line', 'settled', 'forgotten', 'devoured'];
  return Array.from({ length: 100 }, (_, i) => run(endings[i % endings.length]!, i));
}

describe('Short-Line ending distribution gate (#66)', () => {
  it('passes a non-degenerate four-ending distribution', () => {
    const v = shortLineVerdictOver(balanced());
    expect(v.ok, v.lines.join('\n')).toBe(true);
  });

  it('rejects an ending above the 40% ceiling', () => {
    const runs = Array.from({ length: 100 }, (_, i) =>
      run(i < 41 ? 'forgotten' : (['settled', 'broken_line', 'devoured'] as EndingId[])[i % 3]!, i));
    const v = shortLineVerdictOver(runs);
    expect(v.ok).toBe(false);
    expect(v.lines.join('\n')).toMatch(/dominates Short Line.*41\.0%/);
  });

  it('rejects a promised ending that never occurs', () => {
    const runs = Array.from({ length: 100 }, (_, i) =>
      run((['broken_line', 'settled', 'forgotten'] as EndingId[])[i % 3]!, i));
    const v = shortLineVerdictOver(runs);
    expect(v.ok).toBe(false);
    expect(v.lines.join('\n')).toMatch(/devoured did not occur/);
  });

  it('rejects Apotheosis even in a small validity-only batch', () => {
    const v = shortLineVerdictOver([run('apotheosis', 1)]);
    expect(v.ok).toBe(false);
    expect(v.lines.join('\n')).toMatch(/outside the Short-Line promise/);
  });

  it('does not pretend 24 runs can judge a 40% distribution threshold', () => {
    const v = shortLineVerdictOver(Array.from({ length: 24 }, (_, i) => run('forgotten', i)));
    expect(v.ok).toBe(true);
    expect(v.lines.join('\n')).toMatch(/validity only/);
  });
});
