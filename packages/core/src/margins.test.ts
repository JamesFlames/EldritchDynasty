import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REPO = join(import.meta.dirname, '../../..');

/**
 * ── A BATCH CLAIM GOES THROUGH `expectRate` OR `expectMean` ───────────────
 *
 * CLAUDE.md has said so since those helpers existed, and this file is the
 * first thing that checks. Measured on 2026-09-06: 11 call sites across 4
 * suites obeyed it, and 34 claims across 17 did not — the rule was followed
 * by roughly a quarter of the code it applies to. Twenty-two of the 34 are
 * converted; what is left, and why, is on `UNCONVERTED` below.
 *
 * WHY IT MATTERS IS NOT TIDINESS. `expectRate`/`expectMean` assert the claim
 * AND that the batch can carry it: at least two standard errors of margin,
 * failing with the batch size that would work. A bare `toBeGreaterThan(0.5)`
 * on a rate asserts only the first half, so a claim sitting on the boundary
 * passes or fails on the draw — and adding ANY template anywhere re-rolls
 * which scene wins every draw for a thousand years.
 *
 * Issue #115 is what one conversion looks like. Converting a single ceiling
 * in `burying.slow.test.ts` revealed that the claim beside it sat at MINUS
 * 0.04 standard errors — dead on the coin — and that its sibling could not
 * carry any floor at all at sixteen seeds. Both had been green for months.
 * Both were invisible while both were bare thresholds. The issue's own words:
 * "`main` is green today. It is green the way a coin lands heads."
 *
 * ── WHAT COUNTS AS A CLAIM ────────────────────────────────────────────────
 *
 * `expect(<expr>).toBeGreaterThan(<literal>)` in a `.slow.test.ts`, where the
 * expression looks statistical — it divides, or it is named for an average —
 * and the bound is not 0 or 1. Those two are excluded on purpose: `> 0` is a
 * non-vacuity check ("the scan looked at something"), not a claim about where
 * a distribution sits, and forcing it through a margin helper would be
 * ceremony.
 *
 * The detector is deliberately SYNTACTIC, like `lanes.test.ts`. It cannot
 * know whether a number is a rate, so it guesses from shape and is pinned by
 * count rather than trusted absolutely. What it buys is that a NEW unguarded
 * claim cannot arrive unnoticed, which is the failure mode that produced the
 * 34.
 */

/** Names that mean "this is a statistic", not "this is a count of things". */
const STATISTICAL = /\b(mean|median|rate|share|pct|percent|avg|average|corr|ratio|proportion|slope|frac)\b/i;

/** `.toBeGreaterThan(0.5)` and friends, allowing the chained-on-a-newline form. */
const BOUND = /^\s*\.\s*toBe(?:Greater|Less)Than(?:OrEqual)?\(\s*([^,()]*?)\s*[,)]/;

/**
 * A bound of 0 or 1 is a non-vacuity check rather than a claim about a
 * distribution: "somebody drifted", "the scan saw a run". Those are exactly
 * right as bare comparisons and a margin helper would make them worse.
 */
const NOT_A_CLAIM = new Set(['0', '1', '-1', '0.0']);

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[^\n]*?\/\/[^\n]*$/gm, '');
}

function slowSuites(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(join(REPO, dir))) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const rel = `${dir}/${entry}`;
    if (statSync(join(REPO, rel)).isDirectory()) slowSuites(rel, out);
    else if (entry.endsWith('.slow.test.ts')) out.push(rel);
  }
  return out;
}

/** The argument to `expect(`, with parentheses balanced, and where it ends. */
function argumentOf(text: string, from: number): { expr: string; end: number } {
  let depth = 1;
  let i = from;
  while (i < text.length && depth > 0) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') depth -= 1;
    i += 1;
  }
  return { expr: text.slice(from, i - 1), end: i };
}

export interface UnguardedClaim {
  line: number;
  subject: string;
  bound: string;
}

export function unguardedClaims(source: string): UnguardedClaim[] {
  const text = stripComments(source);
  const found: UnguardedClaim[] = [];

  for (const m of text.matchAll(/\bexpect\(/g)) {
    const { expr, end } = argumentOf(text, m.index + m[0].length);
    const bound = BOUND.exec(text.slice(end));
    if (!bound) continue;

    const literal = bound[1]!;
    // Only a literal bound. `toBeGreaterThan(SEEDS.length / 2)` is a claim
    // about the batch's own size, which is not a distribution claim.
    if (!/^-?[0-9]*\.?[0-9]+$/.test(literal)) continue;
    if (NOT_A_CLAIM.has(literal)) continue;

    // The subject only — an assertion message may say anything it likes.
    const subject = expr.split(',')[0]!;
    /**
     * A DIVISION INSIDE AN INDEX IS NOT A RATE.
     *
     * `oldest[Math.floor(oldest.length / 2)]` is how a median is taken, and
     * the detector flagged it as a proportion because it contains a slash.
     * Bracketed subscripts are blanked before the test — found by reading
     * every hit it produced rather than by trusting the count, which is the
     * only way a syntactic rule like this one gets to be trusted at all.
     */
    const withoutIndices = subject.replace(/\[[^\]]*\]/g, '[]');
    // Either guard. Both take a `floor` or a `ceiling`, so there are two
    // functions and not four — a ceiling is a floor read in a mirror.
    if (/\bexpect(Rate|Mean)\s*\(/.test(subject)) continue;
    if (!withoutIndices.includes('/') && !STATISTICAL.test(withoutIndices)) continue;

    found.push({
      line: text.slice(0, m.index).split('\n').length,
      subject: subject.trim().replace(/\s+/g, ' ').slice(0, 70),
      bound: literal,
    });
  }
  return found;
}

/**
 * ── THE RATCHET ──────────────────────────────────────────────────────────
 *
 * What is left, and how many claims each suite still makes bare. It is a DEBT
 * REGISTER, not a permission list, and it moves in one direction:
 *
 *   more than the number here  → a new unguarded claim arrived. Use one of
 *                                the four guards in `testing.ts`.
 *   fewer than the number here → one was converted. Lower the number, or
 *                                delete the entry. The ratchet only tightens.
 *   a file that is not here    → any unguarded claim at all fails.
 *
 * The "fewer" direction is the half that makes this work, and it earned its
 * keep the day it was written: a commit on `main` converted two claims in
 * suites this register knew about, and the register said so rather than
 * quietly accepting a looser bound than it had recorded.
 *
 * ── WHY THESE ARE STILL HERE ──────────────────────────────────────────────
 *
 * Not laziness, and worth writing down so nobody converts them badly. Every
 * remaining claim is one the four guards CANNOT EXPRESS, because it is not a
 * claim about a rate or about a mean:
 *
 *   attributes  seven of its nine are `Math.abs(mean(a) - mean(b)) < x` — a
 *               DIFFERENCE of two means, whose standard error combines both
 *               samples. Forcing it through `expectMean` would compute
 *               the margin of the wrong statistic and report confidence it
 *               has not got, which is worse than the bare threshold: it would
 *               look guarded. It wants a two-sample helper.
 *   genetics    a regression SLOPE with a literal band around it. The
 *               standard error of a slope is a different calculation again.
 *   attributes  two share-of-a-distribution bounds that are neither a rate
 *               over runs nor a mean over runs.
 *
 * A helper for the first two is real work and the right next step; until it
 * exists, a bare threshold that is honestly bare beats a guarded one that is
 * lying. The register keeps them visible and stops the count growing.
 */
const UNCONVERTED: Record<string, number> = {
  'packages/core/src/attributes.slow.test.ts': 9,
  'packages/core/src/genetics.slow.test.ts': 2,
  'packages/core/src/record.slow.test.ts': 1,
};

describe('batch claims carry their margin', () => {
  const files = slowSuites('packages');

  it('finds the slow lane at all', () => {
    // A scan that walks nothing passes every assertion below it.
    expect(files.length).toBeGreaterThan(30);
    expect(files).toContain('packages/core/src/record.slow.test.ts');
  });

  it('and the detector recognises the shape it is looking for', () => {
    // Guarding the guard: if this stops matching, every count below goes to
    // zero and the whole file reads as a clean bill of health.
    const claim = unguardedClaims('expect(hits / runs).toBeGreaterThan(0.5);');
    expect(claim).toHaveLength(1);
    expect(claim[0]!.bound).toBe('0.5');

    // And the three things it must NOT flag.
    expect(unguardedClaims('expect(hits / runs).toBeGreaterThan(0);')).toEqual([]);
    expect(unguardedClaims('expect(expectRate({ hits, n })).toBeGreaterThan(0.5);')).toEqual([]);
    expect(unguardedClaims('expect(expectMean({ values, ceiling })).toBeLessThan(0.5);')).toEqual([]);
    expect(unguardedClaims('expect(people.length).toBeGreaterThan(12);')).toEqual([]);
    // A median: the slash is a subscript, not a proportion.
    expect(unguardedClaims('expect(xs[Math.floor(xs.length / 2)]).toBeGreaterThan(30);')).toEqual([]);
  });

  for (const file of files) {
    it(`${file} guards its batch claims`, () => {
      const claims = unguardedClaims(readFileSync(join(REPO, file), 'utf8'));
      const owed = UNCONVERTED[file] ?? 0;
      const shown = claims.map((c) => `  L${c.line}: ${c.subject} — bound ${c.bound}`).join('\n');

      if (claims.length > owed) {
        expect.fail(
          `${file} makes ${claims.length} unguarded batch claim(s), ${owed} of which are `
          + 'known debt:\n' + shown + '\n\n'
          + 'A claim about a rate or an average goes through expectRate/expectMean '
          + '(core/src/testing.ts). They assert the claim AND that the batch can carry '
          + 'it — two standard errors of margin — and fail with the batch size that '
          + 'would. A bare threshold asserts only the first half, and issue #115 is what '
          + 'that costs: a claim sitting at minus 0.04 standard errors, green for months, '
          + 'passing on the draw.',
        );
      }

      if (claims.length < owed) {
        expect.fail(
          `${file} now makes ${claims.length} unguarded batch claim(s), not the ${owed} `
          + 'recorded in UNCONVERTED. Somebody converted one — good. Lower the number, or '
          + 'delete the entry if it is zero. This register only tightens; one that nobody '
          + 'prunes turns back into a permission list.',
        );
      }
    });
  }

  /**
   * And nothing may be listed that no longer exists, or the register slowly
   * fills with files that were deleted or renamed.
   */
  it('the register names only files that are still here', () => {
    const missing = Object.keys(UNCONVERTED).filter((f) => !files.includes(f));
    expect(missing, `UNCONVERTED lists ${missing.join(', ')}, which no longer exist`).toEqual([]);
  });

  /**
   * The headline, asserted so that it cannot quietly grow. This is the number
   * Track A2 exists to bring down, and the one worth quoting.
   */
  it('and the total debt is what the register says it is', () => {
    const total = files.reduce(
      (n, f) => n + unguardedClaims(readFileSync(join(REPO, f), 'utf8')).length, 0,
    );
    const owed = Object.values(UNCONVERTED).reduce((a, b) => a + b, 0);
    expect(total, `${total} unguarded batch claims across the slow lane, register says ${owed}`)
      .toBe(owed);
  });
});
