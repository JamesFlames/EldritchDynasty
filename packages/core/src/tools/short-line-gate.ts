/**
 * A SHORT LINE — acceptance instrument for issue #66.
 *
 * This is deliberately separate from the Long-Line ending gate. Short omits
 * Apotheosis by product definition and has its own acceptance: over a
 * judgeable batch (>=100 runs), every promised ending must occur and no single
 * ending may exceed 40%.
 *
 * The registered default is 100 runs so CI enforces the distribution claim,
 * rather than merely proving that every run ended in a valid Short outcome.
 */
import { loadContent } from '@ed/content';
import { indexContent, type Content, type ContentBundle, type EndingId } from '@ed/schema';
import { campaignDef } from '../campaign.js';
import { playToTheEnd, type EndingRun } from './ending-gate.js';

type Source = ContentBundle | Content;

export const SHORT_ENDINGS: readonly EndingId[] = [
  'unmade', 'broken_line', 'forgotten', 'devoured',
];

const JUDGEABLE_BATCH = 100;
const MAX_ENDING_SHARE = 0.40;

export interface ShortLineVerdict {
  ok: boolean;
  lines: string[];
}

export function shortLineVerdictOver(runs: EndingRun[]): ShortLineVerdict {
  const lines: string[] = [];
  const n = runs.length;
  const count = (id: EndingId) => runs.filter((r) => r.ending === id).length;

  for (const id of SHORT_ENDINGS) {
    const c = count(id);
    lines.push(`  ${id.padEnd(12)} ${String(c).padStart(4)}  ${n ? (100 * c / n).toFixed(1) : '0.0'}%`);
  }

  const apo = count('apotheosis');
  const invalid = runs.filter((r) => !SHORT_ENDINGS.includes(r.ending));
  const clauses = n ? runs.reduce((sum, r) => sum + r.clauses, 0) / n : 0;
  lines.push(`  --- ${n} Short-Line runs · clauses recovered mean ${clauses.toFixed(2)} · apotheosis ${apo}`);

  if (invalid.length) {
    lines.push(`  FAIL: ${invalid.length} run(s) produced an ending outside the Short-Line promise`);
    return { ok: false, lines };
  }

  if (n < JUDGEABLE_BATCH) {
    lines.push(`  (${n} runs cannot judge the 40% distribution ceiling; validity only)`);
    return { ok: true, lines };
  }

  const failures: string[] = [];
  for (const id of SHORT_ENDINGS) {
    const c = count(id);
    if (c === 0) failures.push(`  FAIL: ${id} did not occur in ${n} Short-Line runs`);
    const share = c / n;
    if (share > MAX_ENDING_SHARE) {
      failures.push(`  FAIL: ${id} dominates Short Line at ${(100 * share).toFixed(1)}% (ceiling 40%)`);
    }
  }

  lines.push(...failures);
  return { ok: failures.length === 0, lines };
}

export function gateShortLine(source: Source = loadContent(), runs = 100): ShortLineVerdict {
  const content = indexContent(source);
  const def = campaignDef('short');
  const played = Array.from({ length: runs }, (_, i) =>
    playToTheEnd(content, 6600 + i, def.years, 'chronicler', 'short'));

  const verdict = shortLineVerdictOver(played);
  return {
    ok: verdict.ok,
    lines: [`gate (short-line): ${runs} played runs x ${def.years} years`, ...verdict.lines],
  };
}

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('short-line-gate.ts');
if (isMain) {
  const runs = Number(process.argv[2] ?? 100);
  const verdict = gateShortLine(loadContent(), runs);
  for (const line of verdict.lines) console.log(line);
  process.exit(verdict.ok ? 0 : 1);
}
