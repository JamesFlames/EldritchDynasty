import type { Issue } from './validate.js';

/**
 * THE VOICE CONTRACT, applied to anything long enough to have a shape.
 *
 * A body of five sentences or fewer is a note. Past that it is prose, and it is
 * held to `.claude/skills/rothfuss-prose/reference/prose-manual.md`. Most of
 * that spec is judgement, but a useful minority is countable, and the countable
 * part is where imitation usually fails — so count it.
 *
 * All warnings, never errors. A linter that blocks writers gets disabled within
 * a fortnight. The value is that a body failing four of these at once is
 * genuinely off-voice, and the panel makes that visible in a way a style guide
 * in another folder never will.
 */
export const PROSE_SENTENCE_THRESHOLD = 5;

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function proseIssues(where: string, body: string): Issue[] {
  const out: Issue[] = [];
  const sentences = splitSentences(body);
  if (sentences.length <= PROSE_SENTENCE_THRESHOLD) return out;

  const words = body.split(/\s+/).filter(Boolean);
  const lens = sentences.map((s) => s.split(/\s+/).length);
  const warn = (rule: string, message: string) =>
    out.push({ level: 'warning', rule, where, message });

  // Strong verbs over verb+adverb (prose spec §5.2)
  const adverbs = words.filter((w) => /ly[.,;:!?"']*$/i.test(w) && w.length > 5).length;
  if (adverbs / words.length > 0.025) {
    warn('prose/adverbs', `adverb density ${(100 * adverbs / words.length).toFixed(1)}% — strong verbs over verb+adverb`);
  }

  // The jagged profile: long, long, short (§2.1-2.3)
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length);
  if (sd < 5) warn('prose/rhythm', `flat rhythm (sentence-length sd ${sd.toFixed(1)}) — vary the cadence`);

  // Paragraphs land on a short sentence (§2.1)
  const last = lens[lens.length - 1]!;
  if (last > 12) warn('prose/landing', `no landing — final sentence is ${last} words; land on something short`);

  // Never explain the punch line (§2.1)
  if (lens.length >= 2 && last <= 12 && lens[lens.length - 2]! <= 12) {
    warn('prose/landing', 'explained landing — two short closers in a row; cut one');
  }

  // Age is carried by content, not grammar (§5.4)
  const archaic = body.match(/\b(ere|mayhap|betwixt|whilst|'twas|forsooth|verily)\b/gi);
  if (archaic) warn('prose/archaism', `archaism: ${[...new Set(archaic.map((a) => a.toLowerCase()))].join(', ')}`);

  // Sound and temperature before sight (§7)
  const first = sentences[0]!.toLowerCase();
  const visual = /\b(saw|looked|bright|dark|colour|color|gleam|shone|visible)\b/.test(first);
  const sensed = /\b(cold|warm|heat|quiet|loud|silence|smell|sound|damp|dry|still)\b/.test(first);
  if (visual && !sensed) warn('prose/opening', 'sight-first opening — reach for sound or temperature before sight');

  // A slot token in the landing breaks the close on some fills (§16.1)
  if (/\{[A-Z_][A-Z0-9_]*\}/.test(sentences[sentences.length - 1]!)) {
    warn('prose/landing', 'variable in the landing — a five-syllable name destroys a four-beat close');
  }

  return out;
}
