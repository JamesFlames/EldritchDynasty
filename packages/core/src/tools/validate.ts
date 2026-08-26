/**
 * Validate the whole content directory.
 *
 *   npm run validate
 *
 * Exits non-zero on any error, so it is the gate a commit hook or CI wants.
 * Warnings are printed and do not fail: the voice contract and the Age-coverage
 * heuristics are advice, and a linter that blocks writers gets turned off.
 */
import { loadContent } from '@ed/content';
import { CONTENT_RULES, validateBundle, type ContentSources, type Issue } from '@ed/schema';

export function report(): { errors: Issue[]; warnings: Issue[]; sources: ContentSources } {
  const sources: ContentSources = new Map();
  const issues = validateBundle(loadContent(undefined, sources));
  return {
    errors: issues.filter((i) => i.level === 'error'),
    warnings: issues.filter((i) => i.level === 'warning'),
    sources,
  };
}

/**
 * `event:the_drowning/outcome` names a thing. Acting on it started with a grep
 * for the id, every time, for every issue — and `assembleBundle` has always
 * known which file the id came from. Now it says:
 *
 *   ERROR  [event/purposes] events/rites.yaml → event:the_drowning: ...
 *
 * The `where` is kept whole rather than replaced. It is the token an author
 * searches for and the thing the editor groups by; the path is added in front
 * of it, not instead of it.
 */
export function locate(where: string, sources: ContentSources): string {
  const colon = where.indexOf(':');
  const id = (colon === -1 ? where : where.slice(colon + 1)).split('/')[0]!;
  const file = sources.get(id);
  return file ? `${file} → ${where}` : where;
}

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('validate.ts');
if (isMain) {
  const { errors, warnings, sources } = report();
  const byRule = new Map<string, number>();
  for (const w of warnings) byRule.set(w.rule, (byRule.get(w.rule) ?? 0) + 1);

  console.log(`${CONTENT_RULES.length} rules · ${errors.length} errors · ${warnings.length} warnings`);
  for (const e of errors) console.log(`  ERROR  [${e.rule}] ${locate(e.where, sources)}: ${e.message}`);
  for (const [rule, n] of [...byRule].sort()) {
    const about = CONTENT_RULES.find((r) => r.id === rule)?.about ?? '';
    console.log(`  warn   ${String(n).padStart(3)} × ${rule}  — ${about}`);
  }
  if (process.argv.includes('--verbose')) {
    for (const w of warnings) console.log(`         [${w.rule}] ${locate(w.where, sources)}: ${w.message}`);
  }
  process.exit(errors.length ? 1 : 0);
}
