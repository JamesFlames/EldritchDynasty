import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { compileTemplate, parse } from 'vue/compiler-sfc';

const SRC = join(import.meta.dirname, '..');

/**
 * EVERY TEMPLATE COMPILES.
 *
 * `vue-tsc` reads templates and catches a property that does not exist on a
 * prop — which is most of what goes wrong in one. It does not catch a template
 * that will not PARSE: an apostrophe inside a bound attribute got all the way
 * through `npm run typecheck` clean and then failed in the dev server with a
 * 500 and a blank page, which is this repository's house failure wearing a
 * different hat.
 *
 * The compiler is the only thing that can answer this, and it is already a
 * dependency. Two hundred milliseconds, and the answer is the same one Vite
 * would give.
 */
function templates(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) templates(path, out);
    else if (entry.endsWith('.vue')) out.push(path);
  }
  return out;
}

const files = templates(SRC);

describe('the templates', () => {
  it('there are some to check', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(files.map((f) => [f.slice(SRC.length + 1), f]))('%s compiles', (_name, path) => {
    const source = readFileSync(path, 'utf8');
    const { descriptor, errors } = parse(source, { filename: path });
    expect(errors.map(String)).toEqual([]);

    if (!descriptor.template) return;
    const compiled = compileTemplate({
      source: descriptor.template.content,
      filename: path,
      id: path,
    });
    expect(compiled.errors.map(String)).toEqual([]);
  });
});

/**
 * THE CLOCK IS FURNITURE (issue #53).
 *
 * It was the third arm of a `v-if` chain with the docket and the naming panel,
 * so the game's primary verb left the screen entirely whenever anything wanted
 * answering — and the line explaining why sat forty pixels lower, under the
 * pane switcher. The symptom, found by playing: pressing "a generation" six
 * times and arriving in 1045, every press eaten by a naming queue that had to
 * be noticed, scrolled to and cleared before the buttons came back.
 *
 * A conditional is one word to add and the failure is silent — the board still
 * renders, the game still plays, and the clock is just gone sometimes. So it
 * is asserted on the source, the way `verbs.test.ts` asserts its chain.
 */
describe('the clock never leaves the board', () => {
  const app = readFileSync(join(SRC, 'App.vue'), 'utf8');
  const opening = app.match(/<div class="panel clock"[^>]*>/);

  it('is drawn unconditionally', () => {
    expect(opening, 'the clock panel is not where this test looks for it').not.toBeNull();
    expect(opening![0], 'the clock is conditional again').not.toMatch(/\bv-(if|else|else-if|show)\b/);
  });

  /**
   * And the reason is ON it. Removing the buttons and explaining elsewhere is
   * the bug; greying them with the count is `Docket.vue`'s existing courtesy to
   * a choice nobody can take (concept §16).
   */
  it('greys its buttons with the reason rather than removing them', () => {
    const clock = app.slice(app.indexOf('<div class="panel clock"'));
    const buttons = [...clock.matchAll(/<button\b[\s\S]*?>/g)].slice(0, 4).map((m) => m[0]);
    expect(buttons).toHaveLength(4);
    for (const b of buttons) expect(b).toMatch(/:disabled="waiting"/);
  });
});

/**
 * THE BOOK, WHEN THE COLUMNS STACK (issue #57).
 *
 * The pane switcher offered three tabs and the board had three columns, and
 * the switcher only ever governed the middle one — fine at desktop width,
 * where the chronicle is always on screen. Below 1100px the columns stack and
 * the chronicle lands after a family tree that grows for a thousand years:
 * measured at 390px it began 1,761px down the page, with no control anywhere
 * that would take you to it. The game is about that book.
 *
 * Asserted on the source because the failure is a layout state no unit test
 * renders and no typecheck can see, and because the rules are four lines that
 * a tidy-up would read as redundant.
 */
describe('the chronicle when the columns stack', () => {
  const app = readFileSync(join(SRC, 'App.vue'), 'utf8');
  /** Collapsed, so the guard survives reformatting but not deletion. */
  const flat = app.replace(/\s+/g, ' ');
  const narrow = flat.slice(flat.indexOf('@media (max-width: 1100px)'));

  it('offers the chronicle as a fourth pane', () => {
    expect(flat, 'no control switches to the chronicle').toMatch(/pane = 'chronicle'/);
  });

  it('offers it only below the breakpoint, where it is not already on screen', () => {
    expect(flat).toMatch(/\.panes \.book \{ display: none; \}/);
    expect(narrow, 'the fourth tab is never shown').toMatch(/\.panes \.book \{ display: inline-block; \}/);
  });

  /**
   * The swap is the point. Rendering the chronicle in its own column AND as a
   * pane would put it on the page twice at narrow width, which is the kind of
   * thing that looks fine until somebody scrolls.
   */
  it('swaps the column for it rather than queueing it after the tree', () => {
    expect(narrow).toMatch(/\.board\[data-pane='chronicle'\] \.middle \{ display: none; \}/);
    expect(narrow).toMatch(/\.board:not\(\[data-pane='chronicle'\]\) \.right \{ display: none; \}/);
  });

  /**
   * Four clock buttons across 390px is 64px each, which is not a label. The
   * override has to come AFTER the rule it overrides — it sat above it for one
   * measurement and did precisely nothing, at identical specificity.
   */
  it('lets the clock buttons wrap rather than shrink', () => {
    expect(narrow).toMatch(/\.clock button \{ flex: 1 1 44%; \}/);
    expect(
      flat.lastIndexOf('.clock button { flex: 1 1 44%; }'),
      'the narrow override comes before the rule it overrides, so it does nothing',
    ).toBeGreaterThan(flat.lastIndexOf('.clock button { flex: 1; }'));
  });
});

/**
 * A REFUSAL BELONGS TO THE CONTROL THAT EARNED IT (issue #55).
 *
 * `Table.vue` issues eight kinds of order and drew one shared refusal line,
 * inside the purse, at the top. An order refused from The Papers printed its
 * reason roughly 1,500px above the button that had just been pressed — so the
 * player saw nothing happen, which is the failure this repository is least
 * able to detect and least able to afford.
 *
 * The pairing is derived from the file rather than listed here, so an order
 * added later fails this until it can say why it was refused.
 */
describe('every order on the table can say why it was refused', () => {
  const table = readFileSync(join(SRC, 'components/Table.vue'), 'utf8');
  const issued = [...new Set(
    [...table.matchAll(/actions\.order\(\{\s*kind:\s*'([a-z]+)'/g)].map((m) => m[1]!),
  )].sort();
  const surfaced = new Set(
    [...table.matchAll(/refusedIn\('([a-z]+)'\)/g)].map((m) => m[1]!),
  );

  it('issues the orders this test thinks it does', () => {
    expect(issued.length, 'no orders found — the matcher has drifted').toBeGreaterThan(5);
  });

  it.each(issued)("draws a refusal for '%s'", (kind) => {
    expect(surfaced.has(kind), `an order of kind '${kind}' has nowhere to report a refusal`).toBe(true);
  });

  /**
   * And the old shared line is gone rather than merely unused — leaving it
   * would let the next panel quietly reach for it again.
   */
  it('no longer takes the single shared refusal', () => {
    expect(table).not.toMatch(/\brefused:\s*string\s*\|\s*null/);
  });
});
