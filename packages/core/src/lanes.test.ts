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

/**
 * ── THE SECOND WAY INTO THE WRONG LANE: SOMEBODY ELSE'S LOOP ──────────────
 *
 * Everything above reads a suite's own text for a span or a batch. That is
 * the whole net, and `gates.test.ts` walked straight through it: no
 * `newGame`, no `advance`, no `runYears` anywhere in the file — and 61.1
 * seconds, 41% of the entire fast lane, because the runs happen INSIDE the
 * gate functions it calls. The rule was enforced and the lane was still
 * wrong, which is this repository's favourite shape of bug.
 *
 * A stopwatch is still the wrong instrument, for the reason given at the top
 * of this file. So the rule is DECLARATION rather than duration: a fast-lane
 * suite may drive a batch through somebody else's entry point, but it has to
 * say so here, with what it drives. A file that quietly starts playing
 * millennia through a gate fails this until a person writes down the cost —
 * and writing it down is where somebody asks whether it belongs in the loop.
 *
 * WHICH MODULES COUNT IS NOT A LIST ANYBODY MAINTAINS, same as everywhere
 * else in this file: a module under `tools/` (or `harness.ts`) that contains
 * `bootstrap`, `runYears`, `newGame` or `TEST_FAMILIES` exists to drive
 * batches, and importing from one is what gets declared. File-level on
 * purpose — an earlier cut of this resolved individual function names and
 * flagged `gen-docs.ts`, whose local `table()` helper collides with a
 * `table()` in a file that does play. A generic name is not evidence.
 */
const BATCH_SEED = /\b(bootstrap|runYears|newGame|TEST_FAMILIES)\b/;

/**
 * The fast-lane suites allowed to drive a batch through a tools module, and
 * what each of them actually drives. Costs measured 2026-09-06 on a four-core
 * container, alongside the rest of the suite.
 *
 * `gates.test.ts` is the reason this exists and is also the answer to it: a
 * gate nobody has watched refuse is indistinguishable from a gate that cannot
 * refuse, so proving each one still has teeth means running it — at two seeds
 * and five years, which is far too small to mean anything about the game and
 * exactly the right size to mean something about the gate.
 */
const DRIVES_A_BATCH: Record<string, string> = {
  'packages/core/src/gates.test.ts':
    'every gate, at 2 runs x 5 years, to prove each still refuses what it must — 16s '
    + '(was 61s: gate 2 rebuilt six worlds per event, and gate 9 replayed one batch per set of floors)',
  'packages/core/src/blood.test.ts':
    'the blood gate\'s founder recipe, one built house, no played years — 1.9s',
  'packages/core/src/bearing-gate.test.ts':
    'the bearing verdict over hand-built columns; plays nothing — 0.0s',
  'packages/core/src/ending-gate.test.ts':
    'the ending verdict over hand-built runs; plays nothing — 0.0s',
  'packages/core/src/war-gate.test.ts':
    'the war verdict over hand-built runs; plays nothing — 0.0s',
};

function batchDrivingModules(): Set<string> {
  const out = new Set<string>();
  const dirs = ['packages/core/src/tools'];
  const extra = ['packages/core/src/harness.ts'];
  const candidates = [
    ...dirs.flatMap((d) => readdirSync(join(REPO, d))
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      .map((f) => `${d}/${f}`)),
    ...extra,
  ];
  for (const rel of candidates) {
    if (BATCH_SEED.test(readFileSync(join(REPO, rel), 'utf8'))) {
      out.add(rel.slice(rel.lastIndexOf('/') + 1).replace(/\.ts$/, ''));
    }
  }
  return out;
}

/** The tools modules a suite imports from, by stem. */
function importsOfBatchDrivers(source: string, drivers: Set<string>): string[] {
  const text = stripComments(source);
  const found = new Set<string>();
  for (const m of text.matchAll(/from\s*'([^']+)'/g)) {
    const spec = m[1]!;
    const stem = spec.slice(spec.lastIndexOf('/') + 1).replace(/\.js$/, '');
    if (drivers.has(stem)) found.add(stem);
  }
  return [...found];
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

  describe('and the batches driven through somebody else\'s loop', () => {
    const drivers = batchDrivingModules();

    it('finds the batch-driving modules at all', () => {
      // A scan that matches nothing declares every suite innocent.
      expect(drivers.has('gates')).toBe(true);
      expect(drivers.has('harness')).toBe(true);
      // And does not sweep in a tools module that drives nothing.
      expect(drivers.has('gen-docs')).toBe(false);
      expect(drivers.has('prose-lint')).toBe(false);
    });

    for (const file of files) {
      it(`${file} declares any batch it drives`, () => {
        const driven = importsOfBatchDrivers(readFileSync(join(REPO, file), 'utf8'), drivers);
        if (!driven.length) {
          expect(
            DRIVES_A_BATCH[file],
            `${file} declares that it drives a batch and no longer does. Drop its `
            + 'entry from DRIVES_A_BATCH — a declaration nobody has to earn is a '
            + 'permission slip.',
          ).toBeUndefined();
          return;
        }
        expect(
          DRIVES_A_BATCH[file],
          `${file} drives a batch through ${driven.join(', ')} — those modules play `
          + 'whole games on its behalf, and nothing above this can see it.\n'
          + 'If it belongs in the fast lane, say what it drives and what that costs '
          + 'in DRIVES_A_BATCH. If it does not, it takes the .slow suffix.',
        ).toBeTypeOf('string');
      });
    }
  });
});
