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
