import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REPO = join(import.meta.dirname, '../../..');

/**
 * WHICH LANE A SUITE IS IN, ENFORCED RATHER THAN ASKED FOR.
 *
 * `vitest.config.ts` has said "a new suite that runs a century takes the
 * `.slow` suffix" since the two lanes were split. Nothing checked it, and
 * SEVEN suites did not: ascension, relationships, table, session-api, assize,
 * session and attention between them turned the fix-and-rerun loop from the
 * documented three seconds into a hundred, with `ascension.test.ts` alone
 * running twenty-four thousand-year games inside it.
 *
 * Nothing about that was visible. Every one of those suites passed, every
 * time; the only symptom was a loop nobody wanted to run, and three documents
 * quoting a number that had been wrong for months.
 *
 * So the rule is a test now. It is deliberately STRUCTURAL rather than a
 * stopwatch: a timing assertion in CI fails on a noisy machine and gets
 * muted, and the thing worth guarding is not a particular second count but
 * the reason for it — a suite that simulates centuries is not a loop.
 *
 * If a suite needs a millennium, it does not need an exemption. It needs the
 * suffix, and it keeps every assertion it had when it moves. Where the line
 * sits, and why it is drawn at whole games rather than at a year count, is on
 * `MILLENNIUM` below.
 */

/** A literal span of years handed to the clock. */
const SPANS = [
  /\badvance\(\s*(\d+)\s*\)/g,
  /\brunYears\(\s*[A-Za-z_$][\w$]*\s*,\s*(\d+)\s*\)/g,
];

/** A run to the end of the world, spelled out rather than given as a number. */
const TO_THE_END = /\badvance\(\s*2042\s*-/;

/**
 * A loop that opens whole games. `[^{}]` keeps this inside one block: the
 * first cut of it allowed any 900 characters and matched a loop here against
 * a `newGame` three tests further down, which flagged two suites that cost
 * about a second each.
 */
const BATCH = /for\s*\([^)]*\)\s*\{[^{}]{0,400}\bnewGame\s*\(/g;

/**
 * Eight hundred, and it is a measurement. A single `runYears(ctx, 600)` over
 * a built world costs `naming.test.ts` well under two seconds, and
 * `session-api.test.ts` turns two hundred years to have something to call
 * against for 1.1s all told — those are timing the CALL. What actually cost
 * the lane its ninety seconds was whole GAMES: millennium runs driven by
 * content, and batches of them. That is what this catches.
 *
 * It is a coarse net, not a cost model. A suite that finds a slow way to
 * spend a minute without tripping either rule is still in the wrong lane, and
 * the timing table in `vitest.config.ts` is where that gets noticed.
 */
const MILLENNIUM = 800;

function testFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(join(REPO, dir))) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const rel = `${dir}/${entry}`;
    if (statSync(join(REPO, rel)).isDirectory()) testFiles(rel, out);
    else if (entry === 'lanes.test.ts') continue;
    else if (entry.endsWith('.test.ts') && !entry.endsWith('.slow.test.ts')) out.push(rel);
  }
  return out;
}

/**
 * Comments describe the rule; only code pays for it. This file is skipped
 * outright by `testFiles` — a guard that has to spell out the patterns it
 * looks for will always contain them, and its own failure message was the
 * first thing it caught.
 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[^\n]*?\/\/[^\n]*$/gm, '');
}

function centuryScale(source: string): string[] {
  const text = stripComments(source);
  const found: string[] = [];

  for (const re of SPANS) {
    for (const m of text.matchAll(re)) {
      const years = Number(m[1]);
      if (years >= MILLENNIUM) found.push(`${m[0]} — ${years} years`);
    }
  }
  if (TO_THE_END.test(text)) found.push('advance(2042 - …) — a run to the end');
  const batches = [...text.matchAll(BATCH)].length;
  if (batches > 0) found.push(`${batches} × newGame inside a loop — a batch of runs`);

  return [...new Set(found)];
}

describe('the two lanes', () => {
  const files = testFiles('packages');

  it('finds the fast lane at all', () => {
    // A scan that silently walks nothing passes every assertion below it.
    expect(files.length).toBeGreaterThan(30);
    expect(files).toContain('packages/core/src/session-api.test.ts');
  });

  for (const file of files) {
    it(`${file} does not play whole games`, () => {
      const reasons = centuryScale(readFileSync(join(REPO, file), 'utf8'));
      expect(
        reasons,
        `${file} plays whole games in the fast lane. Move those tests to a ` +
        `'.slow.test.ts' sibling — they keep every assertion when they go:\n` +
        reasons.map((r) => `  ${r}`).join('\n'),
      ).toEqual([]);
    });
  }
});
