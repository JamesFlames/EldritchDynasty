import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SAVE_FORMAT } from '@ed/schema';

const REPO = join(import.meta.dirname, '../../..');

/**
 * THE MAP MUST MATCH THE GROUND.
 *
 * `ARCHITECTURE.md` exists so an agent can find one file instead of reading
 * twenty, and the per-package `AGENTS.md` files exist so it loads only the
 * rules for where it is working. Both are worth exactly as much as their
 * accuracy: a codemap naming a file that was renamed six commits ago costs more
 * than no codemap, because it is read and believed.
 *
 * So the paths are checked. This is cheap, it runs in the fast suite, and it is
 * the only thing standing between a helpful map and a confident wrong one.
 */

const DOCS = [
  'CLAUDE.md',
  'AGENTS.md',
  'ARCHITECTURE.md',
  'README.md',
  'docs/FAILURES.md',
  'docs/TEST-COVERAGE.md',
  'packages/core/AGENTS.md',
  'packages/schema/AGENTS.md',
  'packages/content/AGENTS.md',
  'packages/editor/AGENTS.md',
  'packages/client/AGENTS.md',
];

/** `path/like/this.ts` inside backticks. Bare prose is not checked. */
const PATH_IN_TICKS = /`([A-Za-z0-9_./-]+\.(?:ts|md|yaml|mjs|json|vue))`/g;
/** [text](relative/link) — skip anchors and absolute URLs. */
const MD_LINK = /\[[^\]]*\]\((?!https?:|#)([^)]+)\)/g;

/**
 * Where a shorthand path may be resolved from. The docs write
 * `core/src/testing.ts` rather than `packages/core/src/testing.ts`, which reads
 * better and is unambiguous — so `packages` is a root, not a prefix anyone types.
 */
const SEARCH_ROOTS = [
  '', 'packages', 'packages/core/src', 'packages/schema/src', 'packages/content',
  'packages/editor/src', 'packages/core/src/people', 'packages/core/src/events',
  'packages/client/src', 'packages/client/src/lib', 'packages/client/src/components',
  'packages/core/src/year', 'packages/core/src/genetics', 'packages/core/src/ages',
  'packages/core/src/tools', 'packages/content/tools', 'packages/editor/src/components',
  'packages/editor/src/lib', 'packages/content/events',
];

function resolves(link: string, docDir: string): boolean {
  // `ARCHITECTURE.md#the-year` names a file and a heading in it. Only the file
  // half is a path; the fragment is checked by nothing, which is honest — a
  // renamed heading is a worse link, not a wrong one.
  const ref = link.split('#')[0]!;
  if (!ref) return true;
  if (existsSync(join(REPO, ref))) return true;
  if (existsSync(join(REPO, docDir, ref))) return true;
  return SEARCH_ROOTS.some((root) => existsSync(join(REPO, root, ref)));
}

/**
 * ONE PLACE STATES WHAT THE SUITE COSTS.
 *
 * `npm run test:fast` was documented as "~3s", "~2s", "two seconds" and "about
 * eight seconds" in four different files while actually taking a hundred, and
 * `npm test` had three different test counts across five. The sweep that fixed
 * them read a fixed list of files and missed two more — `ARCHITECTURE.md` still
 * said ~2s and `README.md` still claimed 699 tests, both found later by accident.
 *
 * A number that appears in five documents is wrong in four of them eventually.
 * So the command block lives in `CLAUDE.md` and every other document links to
 * it, and this fails the build if a second copy grows back.
 */
const COST_HOME = 'CLAUDE.md';

/** `npm test  # 918 tests in 66 files` — a command line quoting its own cost. */
const TIMED_COMMAND =
  /^[^\n]*\bnpm (?:run )?(?:check|test|test:fast|test:slow)\b[^\n]*#[^\n]*?\d[\d,.]*\s*(?:s\b|ms\b|min\b|minutes?\b|seconds?\b|tests?\b|files?\b)/gm;

describe('what the suite costs is stated once', () => {
  for (const doc of DOCS.filter((d) => d !== COST_HOME)) {
    it(`${doc} quotes no timing or count of its own`, () => {
      const copies = [...readFileSync(join(REPO, doc), 'utf8').matchAll(TIMED_COMMAND)]
        .map((m) => m[0].trim());
      expect(
        copies,
        `${doc} states what a command costs. Link to ${COST_HOME}#commands ` +
        `instead — a number kept in two files is wrong in one of them within a ` +
        `few commits, and this one has been wrong in four at once:\n` +
        copies.map((c) => `  ${c}`).join('\n'),
      ).toEqual([]);
    });
  }
});

/**
 * THE ALWAYS-LOADED FILE STAYS SMALL.
 *
 * `CLAUDE.md` is read in full at the start of every session, before the task is
 * known — it is the one document whose size is a tax on every piece of work
 * done in this repo. It reached 38KB, 44% of which was a changelog of what each
 * content drop did to the frequency tiers: the right thing to have written
 * down, in the wrong file. It is `docs/BALANCE-LOG.md` now.
 *
 * Nothing about that was visible, which is the usual story here. A document
 * does not fail; it just quietly costs more every session, and the cost is
 * paid by whoever reads it next.
 *
 * The ceiling has about 20% of headroom over where the split left it. It is not
 * a style rule — if a section is worth the tax, raise the number deliberately
 * and say why here. What it forbids is drifting back by accident.
 */
const BUDGET = 24_000;

describe('the file that loads every session', () => {
  it(`stays under ${BUDGET / 1000}KB`, () => {
    const bytes = readFileSync(join(REPO, 'CLAUDE.md'), 'utf8').length;
    expect(
      bytes,
      `CLAUDE.md is ${bytes} bytes, over its ${BUDGET} budget. Move what only ` +
      `some tasks need into a document the routing table points at, the way ` +
      `docs/BALANCE-LOG.md was split out — or raise the budget on purpose.`,
    ).toBeLessThan(BUDGET);
  });
});

/**
 * THE NUMBER IN THE ALWAYS-LOADED FILE.
 *
 * `CLAUDE.md` said `SAVE_FORMAT` was 7 while `schema/src/save.ts` said 10 —
 * three formats of drift, in the one document that is read in full at the
 * start of every session before the task is known. It is the single worst
 * place in the repo for a stale number, because it is guaranteed to be read
 * and believed, and nothing anywhere reported it.
 *
 * It was found by hand, twice. This is the third time it will not be.
 */
describe('the save format, as the always-loaded file states it', () => {
  it(`says ${SAVE_FORMAT}, because that is what the schema says`, () => {
    const text = readFileSync(join(REPO, 'CLAUDE.md'), 'utf8');
    const stated = /`SAVE_FORMAT` is (\d+)/.exec(text);
    expect(stated, 'CLAUDE.md no longer states the save format at all').toBeTruthy();
    expect(
      Number(stated![1]),
      `CLAUDE.md says SAVE_FORMAT is ${stated?.[1]}, schema/src/save.ts says ${SAVE_FORMAT}`,
    ).toBe(SAVE_FORMAT);
  });
});

describe('the codemap', () => {
  for (const doc of DOCS) {
    describe(doc, () => {
      const text = readFileSync(join(REPO, doc), 'utf8');
      const docDir = doc.includes('/') ? doc.slice(0, doc.lastIndexOf('/')) : '';

      it('names only files that exist', () => {
        const missing = [...text.matchAll(PATH_IN_TICKS)]
          .map((m) => m[1]!)
          .filter((ref) => !resolves(ref, docDir));
        expect([...new Set(missing)], `${doc} names files that are not there`).toEqual([]);
      });

      it('links only to documents that exist', () => {
        const broken = [...text.matchAll(MD_LINK)]
          .map((m) => m[1]!)
          .filter((ref) => !resolves(ref, docDir));
        expect([...new Set(broken)], `${doc} has broken links`).toEqual([]);
      });
    });
  }

  it('gives every package its own scoped AGENTS.md', () => {
    const packages = readdirSync(join(REPO, 'packages'), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    for (const pkg of packages) {
      // `shell` owns no rules — it is a window and a disk — so it is exempt.
      if (pkg === 'shell') continue;
      expect(
        existsSync(join(REPO, 'packages', pkg, 'AGENTS.md')),
        `packages/${pkg} has no AGENTS.md, so an agent working there gets the root file or nothing`,
      ).toBe(true);
    }
  });

  it('routes from the root file rather than restating', () => {
    const root = readFileSync(join(REPO, 'AGENTS.md'), 'utf8');
    for (const doc of DOCS.filter((d) => d !== 'AGENTS.md' && d !== 'README.md')) {
      expect(root, `AGENTS.md never points at ${doc}`).toContain(doc);
    }
  });
});
