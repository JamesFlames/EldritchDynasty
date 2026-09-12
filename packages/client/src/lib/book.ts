import type { ChronicleEntry } from '@ed/core';

/**
 * READING THE BOOK (issue #69), as functions rather than as a component.
 *
 * `VIEW_CHRONICLE_LINES = 60` has always been commented *"the whole book is a
 * separate read"*, and the separate read was never built: the client drew the
 * last sixty entries of a book that ran to 3,576. §24 calls the chronicle
 * *"a persistent, scrollable, searchable document"* and *"the artefact players
 * will screenshot" —* and you cannot screenshot what the client will not draw.
 *
 * The pane's own logic lives here for the reason `assize.ts`, `jump.ts` and
 * `keys.ts` do: a filter written inline in a `computed` is a filter no test
 * can reach, and the one thing worth asserting about a search is what it does
 * NOT match.
 */

export type Lens = 'all' | 'blank' | 'improved' | 'illuminated';

export const LENSES: { id: Lens; label: string }[] = [
  { id: 'all', label: 'The whole book' },
  { id: 'blank', label: 'Left blank' },
  { id: 'improved', label: 'Improved' },
  { id: 'illuminated', label: 'Illuminated' },
];

export interface Reading {
  lens: Lens;
  /** Draw nothing before this year. Null is the beginning. */
  from: number | null;
  /** Free text, matched against the title and the body. */
  find: string;
}

/**
 * Whether one entry survives what the reader has asked for.
 *
 * The lens and the search are ANDed rather than exclusive: "the blanks, about
 * Wystan" is a question a player has, and it is the question this pane exists
 * to answer.
 *
 * The search never matches the YEAR. Typing `12` should not hand back the
 * whole twelfth century as though it had matched a word — the century buttons
 * are the year control, and a search that quietly did both would make the two
 * impossible to tell apart.
 */
export function reads(entry: ChronicleEntry, r: Reading): boolean {
  if (r.from !== null && entry.year < r.from) return false;
  if (r.lens === 'blank' && entry.text !== null) return false;
  if (r.lens === 'improved' && entry.record !== 'embellish') return false;
  if (r.lens === 'illuminated' && entry.weight !== 'illuminated') return false;

  const needle = r.find.trim().toLowerCase();
  if (!needle) return true;
  return `${entry.title ?? ''} ${entry.text ?? ''}`.toLowerCase().includes(needle);
}

/** One drawn line of the exported plate. */
export interface PlateRow {
  text: string;
  size: number;
  colour: string;
  italic?: boolean;
  /** A dated blank line: a rule across the page and no text. */
  rule?: boolean;
  gap: number;
}

export const PLATE = {
  width: 1200,
  pad: 64,
  head: 132,
  foot: 56,
  ink: '#241f18',
  soft: '#5d5344',
  faint: '#8b8067',
  rubric: '#7d2f26',
  rule: '#cdbfa4',
  ground: '#f4ecd8',
  serif: 'Georgia, "Iowan Old Style", "Palatino Linotype", serif',
} as const;

const SIZE: Record<string, number> = { line: 15, paragraph: 17, page: 19, illuminated: 22 };

/** How wide a string is, in the font the plate is about to draw it in. */
export type Measure = (text: string, font: string) => number;

/** Greedy wrap. Never drops a word, even one wider than the column. */
export function wrap(text: string, font: string, max: number, measure: Measure): string[] {
  const out: string[] = [];
  let row = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = row ? `${row} ${word}` : word;
    if (measure(next, font) > max && row) { out.push(row); row = word; }
    else row = next;
  }
  if (row) out.push(row);
  return out;
}

/**
 * The page, laid out. Pure, and separated from the drawing for two reasons:
 * the canvas height cannot be known until the layout is done — a fixed height
 * either clips the book or pads it with dead ground — and this is the half
 * with the omissions in it.
 *
 * AN OMISSION IS A RULED BLANK, not a skipped entry. It is the single most
 * striking thing this game produces and the thing a naive DOM-to-image pass
 * renders as nothing at all, so it is a row here with `rule` set and no text.
 */
export function plateRows(entries: readonly ChronicleEntry[], measure: Measure): PlateRow[] {
  const inner = PLATE.width - PLATE.pad * 2;
  const rows: PlateRow[] = [];

  for (const e of entries) {
    rows.push({ text: String(e.year), size: 11, colour: PLATE.faint, gap: 6 });
    const size = SIZE[e.weight] ?? 15;

    if (e.title && e.text !== null) {
      const font = `500 ${size + 1}px ${PLATE.serif}`;
      for (const l of wrap(e.title, font, inner, measure)) {
        rows.push({
          text: l,
          size: size + 1,
          colour: e.weight === 'illuminated' ? PLATE.rubric : PLATE.ink,
          gap: 4,
        });
      }
    }

    if (e.text === null) {
      rows.push({ text: '', size: 15, colour: PLATE.ink, rule: true, gap: 18 });
      continue;
    }

    const italic = e.record === 'embellish';
    const font = `${italic ? 'italic ' : ''}${size}px ${PLATE.serif}`;
    const wrapped = wrap(e.text, font, inner, measure);
    wrapped.forEach((l, i) => rows.push({
      text: l,
      size,
      colour: e.weight === 'line' ? PLATE.soft : PLATE.ink,
      italic,
      gap: i === wrapped.length - 1 ? 18 : 4,
    }));
  }

  return rows;
}

/** How tall the plate has to be to hold those rows. */
export function plateHeight(rows: readonly PlateRow[]): number {
  return Math.ceil(PLATE.head + rows.reduce((h, r) => h + r.size * 1.5 + r.gap, 0) + PLATE.foot);
}

/** What the plate says under the house's name. */
export function plateSubtitle(entries: readonly ChronicleEntry[], lens: Lens): string {
  const label = (LENSES.find((l) => l.id === lens) ?? LENSES[0]!).label.toLowerCase();
  if (!entries.length) return `nothing yet · ${label}`;
  return `${entries.length} entries · ${plateSpan(entries)} · ${label}`;
}

export function plateSpan(entries: readonly ChronicleEntry[]): string {
  if (!entries.length) return 'nothing';
  return `${entries[0]!.year}–${entries[entries.length - 1]!.year}`;
}

/** A filename a person would not be embarrassed to have in their downloads. */
export function plateName(houseName: string, entries: readonly ChronicleEntry[]): string {
  const house = houseName.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'the-house';
  return `${house}-${plateSpan(entries).replace('–', '-')}.png`;
}
