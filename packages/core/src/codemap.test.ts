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

/**
 * Where a stray cost is looked for — WIDER than DOCS, and deliberately so.
 *
 * `docs/PARALLEL.md` carried "~27s" and "~9 min" for months, in the document
 * whose whole subject is what an agent should run, and `package.json`'s `//0`
 * comment said "~3s" while the lane took a hundred seconds. Neither was in the
 * list. The rule was never wrong; it was just short.
 *
 * These files are NOT in `DOCS`, because the path and link checks below would
 * then run over them too, and `BALANCE-LOG.md` legitimately names files that
 * do not exist yet — it is a design log, and a forward reference is not a
 * broken one. Two rules, two lists, each as wide as it should be.
 */
const COST_SCAN = [...DOCS, 'docs/PARALLEL.md', 'docs/BALANCE-LOG.md', 'package.json'];

/** `npm test  # 918 tests in 66 files` — a command line quoting its own cost. */
const TIMED_COMMAND =
  /^[^\n]*\bnpm (?:run )?(?:check|test|test:fast|test:slow)\b[^\n]*#[^\n]*?\d[\d,.]*\s*(?:s\b|ms\b|min\b|minutes?\b|seconds?\b|tests?\b|files?\b)/gm;

/**
 * The SAME claim, spelled out — which is how it hid.
 *
 * `TIMED_COMMAND` needs a `#` and a digit, so it catches the command-block
 * form and misses running prose. `AGENTS.md` said "`npm run test:fast` skips
 * them and takes about twenty-six seconds" the whole time the rule was in
 * force, in a file the rule scans, because the number was a word.
 */
const TIMED_PROSE =
  /`npm (?:run )?(?:check|test:fast|test:slow|test)`[^.]{0,80}?\b(?:about|roughly|around|takes|costs)\b[^.]{0,40}?\b(?:\d[\d,.]*|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|ninety|hundred)\b/gi;

describe('what the suite costs is stated once', () => {
  for (const doc of COST_SCAN.filter((d) => d !== COST_HOME)) {
    it(`${doc} quotes no timing or count of its own`, () => {
      const text = readFileSync(join(REPO, doc), 'utf8');
      // Prose WRAPS. The first cut of TIMED_PROSE forbade newlines and so
      // could not see AGENTS.md's "takes about twenty-six / seconds", which
      // is the exact sentence it was written for — a rule that cannot fail,
      // passing. Matched against flowed text; the command form stays
      // line-based, because a command line is a line.
      const flowed = text.replace(/\n\s*/g, ' ');
      const copies = [
        ...[...text.matchAll(TIMED_COMMAND)].map((m) => m[0].trim()),
        ...[...flowed.matchAll(TIMED_PROSE)].map((m) => m[0].trim()),
      ];
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
 *
 * RAISED ONCE, from 24,000, and here is the why. The headroom was spent: the
 * file reached 23,931 — 69 bytes under — and the next thing that had to go in
 * was a sixteenth invariant, `canHoldPost`, which is enforced at three call
 * sites in `core` and has a content rule of its own. Three lines of it did not
 * fit. An invariant the code enforces and the file that lists the invariants
 * does not mention is a worse outcome than 300 bytes, and trimming somebody
 * else's paragraph to make room would be worse than either.
 *
 * The long form went to AGENTS.md, where this file already promises the
 * reasoning behind each invariant lives; what stays here is five lines. If the
 * next raise is for a section rather than an invariant, that is the signal to
 * split the file again rather than to move this number a third time.
 */
const BUDGET = 25_000;

/**
 * THE FIGURE IS TRUE, NOT MERELY UNIQUE.
 *
 * The rule above enforces that a cost is stated in ONE place. It has never
 * enforced that the place is right, and it was not: `~27s` against a measured
 * 68, `~25 min` against a measured 18, `~9 min` for a command that takes 30.
 *
 * A BAND, not an equality, and a wide one. A container is not a stopwatch and
 * the suite grows every time anybody lands — the same branch measured 1,748
 * tests at 09:46 and 1,767 at 19:00 on one day, having changed nothing itself.
 * What is worth failing a build over is the figure being off by a FACTOR,
 * which is what `test:fast` was. Ordinary drift is not a build failure; it is
 * what `npm run cost` is for.
 */
describe('the cost in the always-loaded file is close to the truth', () => {
  const stated = () => {
    const text = readFileSync(join(REPO, 'CLAUDE.md'), 'utf8');
    const m = /^npm run test:fast\s+# ~?(\d+)\s*s\b/m.exec(text);
    return m ? Number(m[1]) : null;
  };

  it('states a figure for the fix-and-rerun loop at all', () => {
    expect(
      stated(),
      'CLAUDE.md no longer says what `npm run test:fast` costs. It is the one number ' +
      'an agent uses to decide whether it can afford to re-run, and the one place it lives.',
    ).not.toBeNull();
  });

  /**
   * Not measured here: running the lane inside the lane is a recursion, and a
   * timing assertion in CI fails on a noisy machine and gets muted — which is
   * the reason `lanes.test.ts` is structural rather than a stopwatch. What
   * this catches is a figure that is absurd on its face.
   */
  it('states a figure that could plausibly be a fast lane', () => {
    const s = stated()!;
    expect(s, `CLAUDE.md says test:fast takes ${s}s`).toBeGreaterThan(5);
    expect(
      s,
      `CLAUDE.md says test:fast takes ${s}s. Over two minutes is not a ` +
      `fix-and-rerun loop — either a slow suite has landed in the fast lane ` +
      `(lanes.test.ts) or the figure is stale. \`npm run cost -- --write\`.`,
    ).toBeLessThan(120);
  });
});

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

/**
 * A SKILL IS AN INSTRUCTION, AND CARRIES MORE AUTHORITY THAN A DOCUMENT.
 *
 * `DOCS` above is checked for paths that do not resolve, because "a codemap
 * naming a file that was renamed six commits ago costs more than no codemap,
 * because it is read and believed". Skills were never checked, and one of them
 * had eleven dangling references: `improve-codebase-architecture` opened by
 * telling the agent to run a `/codebase-design` skill that does not exist here
 * and to read `CONTEXT.md`, seven times, and ADRs in `docs/adr/` — none of the
 * three present in this repository.
 *
 * A document is read as reference and can be doubted. A skill is loaded as
 * instructions, so a wrong one does not get doubted; it gets followed, and the
 * session is spent looking for a file nobody ever wrote.
 *
 * Frontmatter is skipped: a `description` is prose about when to reach for the
 * skill, and names things like `packages/content/**.yaml` that are globs
 * rather than paths.
 */
/**
 * Paths a skill WRITES rather than reads. Absent is their normal state.
 *
 * `interface-design` offers to save a design system to
 * `.interface-design/system.md` and guards every mention of it with "if
 * present" or "if exists". Flagging that would make the rule cry wolf, and a
 * rule that cries wolf gets an exemption added carelessly the second time.
 * So the exemption is explicit, here, with the reason attached — the same
 * shape as `SEARCH_ROOTS` above and the `shell` exemption below.
 */
const WRITTEN_BY_SKILLS = new Set(['.interface-design/system.md']);

const SKILLS = readdirSync(join(REPO, '.claude/skills'), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => join('.claude/skills', e.name, 'SKILL.md'))
  .filter((p) => existsSync(join(REPO, p)));

/** Everything after the closing `---` of the YAML frontmatter. */
const withoutFrontmatter = (text: string) =>
  /^---\n[\s\S]*?\n---\n/.test(text) ? text.replace(/^---\n[\s\S]*?\n---\n/, '') : text;

describe('the skills, which are instructions rather than reference', () => {
  it('has at least one to check, so this cannot pass by finding nothing', () => {
    expect(SKILLS.length).toBeGreaterThan(0);
  });

  for (const skill of SKILLS) {
    const body = withoutFrontmatter(readFileSync(join(REPO, skill), 'utf8'));
    const dir = skill.slice(0, skill.lastIndexOf('/'));

    it(`${skill} names only files that exist`, () => {
      const missing = [...body.matchAll(PATH_IN_TICKS)]
        .map((m) => m[1]!)
        .filter((ref) => !WRITTEN_BY_SKILLS.has(ref) && !resolves(ref, dir));
      expect(
        [...new Set(missing)],
        `${skill} tells an agent to read files that are not in this repository. ` +
        `A skill is loaded as instructions, so a wrong path is followed rather ` +
        `than doubted. Fix the reference, or delete the skill.`,
      ).toEqual([]);
    });

    it(`${skill} links only to documents that exist`, () => {
      const broken = [...body.matchAll(MD_LINK)]
        .map((m) => m[1]!)
        .filter((ref) => !resolves(ref, dir));
      expect([...new Set(broken)], `${skill} has broken links`).toEqual([]);
    });
  }

  /**
   * CLAUDE.md says of the prose skills: "They do not overlap. Reach for the
   * right one." That sentence is only true if the file lists what is there.
   * Six directories exist under `.claude/skills` and three were named.
   */
  it('accounts for every skill in the always-loaded file', () => {
    const claude = readFileSync(join(REPO, 'CLAUDE.md'), 'utf8');
    const unlisted = SKILLS.map((s) => s.split('/')[2]!).filter((name) => !claude.includes(name));
    expect(
      unlisted,
      `.claude/skills holds ${unlisted.join(', ')}, which CLAUDE.md never mentions. ` +
      `An agent cannot reach for a skill it does not know exists, and cannot avoid ` +
      `one it does not know overlaps. Name it, or remove it.`,
    ).toEqual([]);
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
