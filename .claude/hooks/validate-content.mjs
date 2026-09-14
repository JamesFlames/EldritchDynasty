#!/usr/bin/env node
/**
 * THE ONE-SECOND CHECK THAT GETS DEFERRED TO THE END OF A SESSION.
 *
 * `npm run validate` runs 36 content rules over every authored YAML file and
 * takes about a second. It is also the check most likely to be skipped, for a
 * mundane reason: an agent that has just finished writing YAML feels finished.
 * The cost of skipping it is not the second — it is finding the error after a
 * thirty-minute landing instead of immediately, with the file still in mind.
 *
 * Runs only for writes under `packages/content/`, and only for YAML. Never
 * fails the tool call: the write already happened, and the point is to put the
 * errors in front of the agent now rather than to undo anything.
 *
 * Node rather than bash for the reason `guard-edit.mjs` gives at length: the
 * shell version needed `jq` to read its own payload, and a hook that cannot
 * start is a hook that silently stops checking on one platform and not the
 * other. Registered by BOTH agents, so the paths come from `hookPaths` — a
 * Codex content edit carries no `file_path`, and reading that key alone meant
 * this never ran under Codex and never said so.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emit, hookPaths, readHookPayload, runNpm } from '../../tools/portable.mjs';

const ROOT = process.env.CLAUDE_PROJECT_DIR
  ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const payload = await readHookPayload();
const touched = hookPaths(payload, ROOT);
if (!touched.some((rel) => /^packages\/content\/.+\.ya?ml$/i.test(rel))) process.exit(0);

// `pipe`, not `inherit`: the verdict has to be READ before it can be reported,
// and a hook's raw stdout is not where an agent looks.
const { out } = runNpm(['run', '--silent', 'validate'], { cwd: ROOT, stdio: 'pipe' });

// The last line is the verdict: "36 rules · 0 errors · 0 warnings".
if (/· [1-9][0-9]* errors/.test(out)) {
  emit({
    systemMessage: `npm run validate FAILED after this content edit:\n${out}`,
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: out },
  });
}

process.exit(0);
