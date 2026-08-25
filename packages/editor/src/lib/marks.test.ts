import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventTierS, PurposeS } from '@ed/schema';
import {
  MARKS, MARK_NAMES, PURPOSE_LABEL, PURPOSE_MARK, TIER_MARK,
  type MarkName,
} from './marks';

/**
 * An icon set fails the way everything else here fails: by doing nothing. A
 * path with a typo'd coordinate draws off the 24-box and renders as an empty
 * square; a mark nobody ever passes to `Mark.vue` is dead weight that still
 * typechecks. Neither throws. So these assert the shape of a healthy SET,
 * not that a function returned.
 */

const SRC = fileURLToPath(new URL('..', import.meta.url));

/** Every source file under `editor/src`, so we can ask who draws what. */
function sources(dir: string, out: { path: string; text: string }[] = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, e.name);
    if (e.isDirectory()) sources(path, out);
    else if (/\.(ts|vue)$/.test(e.name)) out.push({ path, text: readFileSync(path, 'utf8') });
  }
  return out;
}

describe('the marks are drawable', () => {
  it('every mark has geometry and a label', () => {
    for (const name of MARK_NAMES) {
      const m = MARKS[name];
      expect(m.strokes.length + (m.fills?.length ?? 0), `${name} draws nothing`).toBeGreaterThan(0);
      expect(m.label.trim(), `${name} has no label`).not.toBe('');
    }
  });

  it('every path starts with a move and uses only path commands', () => {
    for (const name of MARK_NAMES) {
      for (const d of [...MARKS[name].strokes, ...(MARKS[name].fills ?? [])]) {
        expect(d[0], `${name}: "${d.slice(0, 24)}…" does not open with M`).toMatch(/[Mm]/);
        const illegal = d.replace(/[MmLlHhVvCcSsQqTtAaZz0-9.,\s+-]/g, '');
        expect(illegal, `${name}: illegal path characters ${illegal}`).toBe('');
      }
    }
  });

  /**
   * The one that actually catches things. A `12` typed as `120` puts the mark
   * off-canvas, which looks exactly like a mark that is not there — and the
   * contact sheet is the only other place it would ever have shown up.
   *
   * This counts every number in the path, radii and arc flags included, rather
   * than parsing properly. That is deliberate: radii and flags are small by
   * construction here, so the loose check costs nothing and needs no parser.
   */
  it('every coordinate stays inside the 24-box', () => {
    for (const name of MARK_NAMES) {
      for (const d of [...MARKS[name].strokes, ...(MARKS[name].fills ?? [])]) {
        for (const n of d.match(/-?\d+(\.\d+)?/g) ?? []) {
          expect(Math.abs(Number(n)), `${name}: ${n} is off the 24-box in "${d.slice(0, 30)}…"`)
            .toBeLessThanOrEqual(24);
        }
      }
    }
  });
});

describe('an event wears its own metadata', () => {
  it('draws a mark for every purpose the schema allows', () => {
    for (const p of PurposeS.options) {
      expect(MARKS[PURPOSE_MARK[p]], `no mark drawn for purpose ${p}`).toBeDefined();
      expect(PURPOSE_LABEL[p]?.trim(), `no label for purpose ${p}`).toBeTruthy();
    }
  });

  it('draws a mark for every tier the schema allows', () => {
    for (const t of EventTierS.options) {
      expect(MARKS[TIER_MARK[t]], `no mark drawn for tier ${t}`).toBeDefined();
    }
  });

  /**
   * Three purposes sharing two marks means an event's row of icons is telling
   * the author something untrue about the template — the whole point of
   * putting them there is that three marks means three different jobs.
   */
  it('gives every purpose a mark of its own', () => {
    const used = PurposeS.options.map((p) => PURPOSE_MARK[p]);
    expect(new Set(used).size, `two purposes share a mark: ${used.join(', ')}`).toBe(used.length);
  });

  it('gives every tier a mark of its own', () => {
    const used = EventTierS.options.map((t) => TIER_MARK[t]);
    expect(new Set(used).size, `two tiers share a mark: ${used.join(', ')}`).toBe(used.length);
  });
});

describe('nothing in the set is dead', () => {
  const views = () => sources(SRC).filter(
    (f) => !f.path.endsWith('marks.ts') && !f.path.endsWith('marks.test.ts'),
  );
  const names = (f: { text: string }, name: string) =>
    f.text.includes(`'${name}'`) || f.text.includes(`"${name}"`);

  /**
   * Invariant 11, for pictures. A mark that no view ever passes to `Mark.vue`
   * is a declared thing nothing reads — and unlike an unused constant, it
   * carries the cost of somebody having drawn it and everybody after assuming
   * it means something.
   *
   * A mark counts as drawn two ways. Most are named outright by a view. The
   * purpose and tier marks are not: a view passes `PURPOSE_MARK[p]`, and the
   * name never appears anywhere but the table. So those count as drawn when
   * the table that carries them is itself used, which the test below pins.
   */
  it('every mark is drawn by something', () => {
    const files = views();
    const throughTable = new Set<string>([
      ...Object.values(PURPOSE_MARK),
      ...Object.values(TIER_MARK),
    ]);
    const undrawn = MARK_NAMES.filter(
      (name) => !throughTable.has(name) && !files.some((f) => names(f, name)),
    );
    expect(undrawn, `drawn but never rendered: ${undrawn.join(', ')}`).toEqual([]);
  });

  /**
   * The other half of the above, and the half that would actually rot: if
   * nothing reads `PURPOSE_MARK`, then thirteen marks are dead and the test
   * above cheerfully passes them all.
   */
  it('the purpose and tier tables are read by a view', () => {
    const files = views();
    expect(files.some((f) => f.text.includes('PURPOSE_MARK')), 'nothing renders PURPOSE_MARK').toBe(true);
    expect(files.some((f) => f.text.includes('TIER_MARK')), 'nothing renders TIER_MARK').toBe(true);
  });
});

/** Spot-check that the union and the table cannot drift apart. */
it('MARK_NAMES is the union', () => {
  const names: MarkName[] = MARK_NAMES;
  expect(names.length).toBe(Object.keys(MARKS).length);
  expect(new Set(names).size).toBe(names.length);
});
