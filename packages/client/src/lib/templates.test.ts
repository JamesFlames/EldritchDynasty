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
