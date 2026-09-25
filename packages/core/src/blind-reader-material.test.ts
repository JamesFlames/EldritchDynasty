import { describe, expect, it } from 'vitest';
import type { ChronicleEntry } from './world.js';
import {
  buildPair,
  earlyComesFirst,
  parseArgs,
  renderAnswerKey,
  renderReaderSheet,
  stripClockTells,
} from '../../../tools/blind-reader-material.js';

function entry(year: number, text: string | null, title?: string): ChronicleEntry {
  return {
    year,
    weight: 'line',
    ...(title ? { title } : {}),
    text,
    named: false,
  };
}

function fixture(): ChronicleEntry[] {
  const out: ChronicleEntry[] = [];
  for (let year = 1043; year < 1208; year += 2) {
    out.push(entry(year, `The house bought land while Alice held office in ${year}.`, 'A Long Line'));
  }
  for (let year = 1377; year < 1541; year += 2) {
    out.push(entry(year, `Alice's old bargain still cost the house in ${year}.`, year === 1539 ? 'the Term' : undefined));
  }
  return out;
}

describe('blind-reader material (#85)', () => {
  it('removes direct clock tells without deleting the historical evidence', () => {
    const cleaned = stripClockTells('In A Long Line, Alice bought Blackacre in 1451.');
    expect(cleaned).toBe('In the line, Alice bought Blackacre in [year].');
    expect(cleaned).toContain('Alice');
    expect(cleaned).toContain('Blackacre');
  });

  it('takes equal pages from inside the early and late thirds and excludes the Term', () => {
    const pair = buildPair(fixture(), 8500, 'A', 12);
    expect(pair.first.entries).toHaveLength(12);
    expect(pair.second.entries).toHaveLength(12);

    const all = [...pair.first.entries, ...pair.second.entries]
      .flatMap((e) => [e.title ?? '', e.text ?? ''])
      .join('\n');
    expect(all).not.toMatch(/\b(?:10|11|12|13|14|15)\d{2}\b/);
    expect(all).not.toMatch(/\b(?:Long|Short) Line\b/i);
    expect(all).not.toMatch(/\bTerm\b/i);
    expect(all).toMatch(/Alice/);
  });

  it('randomises order reproducibly and keeps the answer out of the reader sheet', () => {
    const pair = buildPair(fixture(), 8501, 'A', 10);
    expect(earlyComesFirst(8501)).toBe(earlyComesFirst(8501));

    const material = { pairs: [pair], skipped: [] };
    const reader = renderReaderSheet(material);
    const key = renderAnswerKey(material);

    expect(reader).not.toContain('seed 8501');
    expect(reader).not.toMatch(/= early|= late|later = A[12]/i);
    expect(key).toContain('seed 8501');
    expect(key).toMatch(/later = A[12]/);
  });

  it('parses an explicit output directory and bounded positive counts', () => {
    const opts = parseArgs(['--out', 'tmp/x', '--pairs', '5', '--lines', '14', '--seed-start', '9000']);
    expect(opts.pairs).toBe(5);
    expect(opts.lines).toBe(14);
    expect(opts.seedStart).toBe(9000);
    expect(opts.outDir).toMatch(/tmp[/\\]x$/);
    expect(() => parseArgs(['--pairs', '0'])).toThrow(/positive integer/);
  });
});
