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
import { CONTENT_RULES, validateBundle, type Issue } from '@ed/schema';

export function report(): { errors: Issue[]; warnings: Issue[] } {
  const issues = validateBundle(loadContent());
  return {
    errors: issues.filter((i) => i.level === 'error'),
    warnings: issues.filter((i) => i.level === 'warning'),
  };
}

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('validate.ts');
if (isMain) {
  const { errors, warnings } = report();
  const byRule = new Map<string, number>();
  for (const w of warnings) byRule.set(w.rule, (byRule.get(w.rule) ?? 0) + 1);

  console.log(`${CONTENT_RULES.length} rules · ${errors.length} errors · ${warnings.length} warnings`);
  for (const e of errors) console.log(`  ERROR  [${e.rule}] ${e.where}: ${e.message}`);
  for (const [rule, n] of [...byRule].sort()) {
    const about = CONTENT_RULES.find((r) => r.id === rule)?.about ?? '';
    console.log(`  warn   ${String(n).padStart(3)} × ${rule}  — ${about}`);
  }
  if (process.argv.includes('--verbose')) {
    for (const w of warnings) console.log(`         [${w.rule}] ${w.where}: ${w.message}`);
  }
  process.exit(errors.length ? 1 : 0);
}
