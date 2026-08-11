/**
 * Prose lint, on its own — an ANNOTATION, never a build failure (issue #6).
 *
 *   npx tsx packages/core/src/tools/prose-lint.ts
 *
 * `prose/voice` is the one content rule that is warning-level ONLY (see
 * `schema/src/prose.ts`: "a linter that blocks writers gets disabled within a
 * fortnight"), so `npm run validate` already never fails because of it. This
 * exists to give those warnings somewhere better to land than the middle of
 * a validate log: printed as GitHub Actions `::warning::` workflow commands,
 * they show up as inline annotations in the Checks tab. Always exits 0.
 */
import { loadContent } from '@ed/content';
import { runRule } from '@ed/schema';

const escape = (s: string) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

const issues = runRule('prose/voice', loadContent());
for (const i of issues) {
  console.log(`::warning title=${escape(i.rule)} — ${escape(i.where)}::${escape(i.message)}`);
}
console.log(`prose lint: ${issues.length} issue(s) — annotations only, never a failure`);
process.exit(0);
