import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

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
  'packages/core/src/year', 'packages/core/src/genetics', 'packages/core/src/ages',
  'packages/core/src/tools', 'packages/content/tools', 'packages/editor/src/components',
  'packages/editor/src/lib', 'packages/content/events',
];

function resolves(ref: string, docDir: string): boolean {
  if (existsSync(join(REPO, ref))) return true;
  if (existsSync(join(REPO, docDir, ref))) return true;
  return SEARCH_ROOTS.some((root) => existsSync(join(REPO, root, ref)));
}

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
