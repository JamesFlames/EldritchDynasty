import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadContent } from '@ed/content';
import {
  CAMPAIGNS,
  newGame,
  type ChronicleEntry,
} from '@ed/core';

export const DEFAULT_PAIR_COUNT = 8;
export const DEFAULT_PAGE_LINES = 18;
export const DEFAULT_SEED_START = 8500;

type Period = 'early' | 'late';

export interface ClocklessEntry {
  title?: string;
  text: string | null;
}

export interface BlindExcerpt {
  period: Period;
  entries: ClocklessEntry[];
}

export interface BlindPair {
  id: string;
  seed: number;
  first: BlindExcerpt;
  second: BlindExcerpt;
}

export interface Material {
  pairs: BlindPair[];
  skipped: { seed: number; reason: string }[];
}

const DIRECT_TERM = /\b(?:the\s+)?Term\b/i;
const CAMPAIGN_LABEL = /\b(?:A\s+)?(?:Long|Short)\s+Line\b/gi;
const ABSOLUTE_YEAR = /\b(?:10|11|12|13|14|15)\d{2}\b/g;

function cleanSpacing(text: string): string {
  return text
    .replace(/[ \t]+([,.;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Remove only direct clock tells. The blind-reader protocol deliberately keeps
 * names, decisions, land, Muster, bearing consequences and career history:
 * those are the evidence a reader is supposed to use.
 */
export function stripClockTells(text: string): string {
  return cleanSpacing(
    text
      .replace(CAMPAIGN_LABEL, 'the line')
      .replace(ABSOLUTE_YEAR, '[year]'),
  );
}

function hasDirectTerm(entry: ChronicleEntry): boolean {
  return DIRECT_TERM.test(entry.title ?? '') || DIRECT_TERM.test(entry.text ?? '');
}

function clockless(entry: ChronicleEntry): ClocklessEntry {
  const title = entry.title === undefined ? undefined : stripClockTells(entry.title);
  const text = entry.text === null ? null : stripClockTells(entry.text);
  return {
    ...(title ? { title } : {}),
    text,
  };
}

function selectNearest(
  entries: readonly ChronicleEntry[],
  from: number,
  to: number,
  target: number,
  lineCount: number,
): ClocklessEntry[] {
  const candidates = entries
    .map((entry, sourceIndex) => ({ entry, sourceIndex }))
    .filter(({ entry }) => entry.year >= from && entry.year <= to && !hasDirectTerm(entry));

  if (candidates.length < lineCount) {
    throw new Error(`only ${candidates.length} clock-safe chronicle entries in ${from}-${to}; need ${lineCount}`);
  }

  return candidates
    .sort((a, b) =>
      Math.abs(a.entry.year - target) - Math.abs(b.entry.year - target)
      || a.entry.year - b.entry.year
      || a.sourceIndex - b.sourceIndex)
    .slice(0, lineCount)
    .sort((a, b) => a.entry.year - b.entry.year || a.sourceIndex - b.sourceIndex)
    .map(({ entry }) => clockless(entry));
}

function mix32(value: number): number {
  let x = value | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (x ^ (x >>> 16)) >>> 0;
}

export function earlyComesFirst(seed: number): boolean {
  return (mix32(seed ^ 0x85b11d) & 1) === 0;
}

export function buildPair(
  entries: readonly ChronicleEntry[],
  seed: number,
  id: string,
  lineCount = DEFAULT_PAGE_LINES,
): BlindPair {
  const campaign = CAMPAIGNS.long;
  const third = campaign.years / 3;
  const earlyFrom = campaign.startYear + 1;
  const earlyTo = Math.floor(campaign.startYear + third) - 1;
  const lateFrom = Math.ceil(campaign.startYear + (2 * third)) + 1;
  const lateTo = campaign.endYear - 1;

  const early: BlindExcerpt = {
    period: 'early',
    entries: selectNearest(
      entries,
      earlyFrom,
      earlyTo,
      campaign.startYear + campaign.years / 6,
      lineCount,
    ),
  };
  const late: BlindExcerpt = {
    period: 'late',
    entries: selectNearest(
      entries,
      lateFrom,
      lateTo,
      campaign.startYear + (5 * campaign.years) / 6,
      lineCount,
    ),
  };

  return earlyComesFirst(seed)
    ? { id, seed, first: early, second: late }
    : { id, seed, first: late, second: early };
}

function pairId(index: number): string {
  if (index < 0 || index >= 26) throw new Error('blind-reader pair count cannot exceed 26');
  return String.fromCharCode('A'.charCodeAt(0) + index);
}

export function generateMaterial(
  pairCount = DEFAULT_PAIR_COUNT,
  lineCount = DEFAULT_PAGE_LINES,
  seedStart = DEFAULT_SEED_START,
  maxAttempts = 200,
): Material {
  const content = loadContent();
  const campaign = CAMPAIGNS.long;
  const lateFrom = Math.ceil(campaign.startYear + (2 * campaign.years) / 3) + 1;
  const pairs: BlindPair[] = [];
  const skipped: Material['skipped'] = [];

  for (let offset = 0; offset < maxAttempts && pairs.length < pairCount; offset++) {
    const seed = seedStart + offset;
    const game = newGame(content, { seed, campaign: 'long', decider: 'chronicler' });
    game.advance(campaign.years);

    if (game.year < lateFrom) {
      skipped.push({ seed, reason: `line ended in ${game.year}, before the late-third material window` });
      continue;
    }

    try {
      pairs.push(buildPair(game.book(), seed, pairId(pairs.length), lineCount));
    } catch (error) {
      skipped.push({
        seed,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (pairs.length !== pairCount) {
    throw new Error(`built ${pairs.length}/${pairCount} pairs after ${maxAttempts} deterministic seed attempts`);
  }

  return { pairs, skipped };
}

function renderEntry(entry: ClocklessEntry): string {
  const lines: string[] = [];
  if (entry.title) lines.push(`**${entry.title}**`);
  // Chronicle blanks are designed evidence. Keep their visual place without
  // putting their removed date back into the reader sheet.
  lines.push(entry.text === null ? '*\u2003*' : entry.text);
  return lines.join('\n\n');
}

function renderExcerpt(excerpt: BlindExcerpt): string {
  return excerpt.entries.map(renderEntry).join('\n\n');
}

export function renderReaderSheet(material: Material): string {
  const lines = [
    '# Blind chronicle reader sheet',
    '',
    'For each pair, choose which excerpt comes later in its family history and write what made you think so.',
    'Dates and direct campaign-clock labels have been removed. Use only the history that remains.',
    '',
  ];

  for (const pair of material.pairs) {
    lines.push(
      `## Pair ${pair.id}`,
      '',
      `### ${pair.id}1`,
      '',
      renderExcerpt(pair.first),
      '',
      `### ${pair.id}2`,
      '',
      renderExcerpt(pair.second),
      '',
      'Later excerpt: ____',
      '',
      'Reason: ________________________________________________________________',
      '',
    );
  }
  return lines.join('\n');
}

export function renderAnswerKey(material: Material): string {
  const lines = [
    '# Blind chronicle answer key',
    '',
    'Keep this file away from readers until all judgements are recorded.',
    '',
  ];

  for (const pair of material.pairs) {
    const first = pair.first.period;
    const later = first === 'late' ? `${pair.id}1` : `${pair.id}2`;
    lines.push(`- Pair ${pair.id}: seed ${pair.seed}; ${pair.id}1 = ${first}; ${pair.id}2 = ${pair.second.period}; **later = ${later}**`);
  }

  if (material.skipped.length) {
    lines.push('', '## Deterministically skipped seeds', '');
    for (const skip of material.skipped) lines.push(`- ${skip.seed}: ${skip.reason}`);
  }

  return lines.join('\n') + '\n';
}

interface CliOptions {
  outDir: string;
  pairs: number;
  lines: number;
  seedStart: number;
}

function positiveInt(flag: string, raw: string | undefined): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${flag} needs a positive integer`);
  return value;
}

export function parseArgs(args: readonly string[]): CliOptions {
  const opts: CliOptions = {
    outDir: resolve('tmp', 'blind-reader-85'),
    pairs: DEFAULT_PAIR_COUNT,
    lines: DEFAULT_PAGE_LINES,
    seedStart: DEFAULT_SEED_START,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--out') opts.outDir = resolve(args[++i] ?? '');
    else if (arg === '--pairs') opts.pairs = positiveInt('--pairs', args[++i]);
    else if (arg === '--lines') opts.lines = positiveInt('--lines', args[++i]);
    else if (arg === '--seed-start') opts.seedStart = positiveInt('--seed-start', args[++i]);
    else throw new Error(`unknown argument: ${arg}`);
  }
  return opts;
}

export function main(args = process.argv.slice(2)): void {
  const opts = parseArgs(args);
  const material = generateMaterial(opts.pairs, opts.lines, opts.seedStart);
  mkdirSync(opts.outDir, { recursive: true });
  const reader = join(opts.outDir, 'reader-sheet.md');
  const key = join(opts.outDir, 'answer-key.md');
  writeFileSync(reader, renderReaderSheet(material), 'utf8');
  writeFileSync(key, renderAnswerKey(material), 'utf8');

  console.log(`wrote ${material.pairs.length} blind pairs to ${reader}`);
  console.log(`answer key: ${key}`);
  if (material.skipped.length) console.log(`skipped ${material.skipped.length} deterministic seed(s); see answer key`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
