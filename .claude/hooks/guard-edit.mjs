#!/usr/bin/env node
/**
 * THE TWO CHEAPEST RULES IN AGENTS.md, ENFORCED WHERE THEY ARE BROKEN.
 *
 * Every invariant in this repository is guarded by a test, and a test is 59
 * seconds away at best and half an hour at worst. Two of the rules in the
 * "Do not" list are one-line checks on the path being written, and both were
 * prose only:
 *
 * ONE: `packages/content/loci.yaml` and `docs/VOCABULARY.md` are GENERATED.
 * Hand-editing either produces a file that the next `npm run gen:loci` writes
 * over, and docs/PARALLEL.md is explicit that a merge conflict in them must
 * never be resolved by hand. The edit succeeds, looks right, and is gone.
 *
 * TWO: A FIELD ON `WorldState` MUST REACH THE SAVE FORMAT. AGENTS.md already
 * says what it looks like when it does not: the field resets silently on load,
 * which looks exactly like a subsystem that stopped working two centuries in.
 *
 * The first is a refusal, and it names the command that fixes it — a refusal
 * that names the fix costs one turn; the alternative costs a full check. The
 * second is a WARNING, because the legitimate two-step edit exists (add the
 * field, then add it to the save format) and a refusal would make it
 * impossible. A hook that blocks correct work gets switched off within a week.
 *
 * NODE RATHER THAN BASH, AND THAT IS NOT A STYLE CHOICE. This was a bash
 * script that piped stdin through `jq`. On a Windows checkout neither is
 * necessarily there, and a hook that cannot start does not announce it — the
 * guard silently stops guarding and the generated file gets hand-edited on one
 * platform and not the other. `portability.test.ts` now fails the build if a
 * hook goes back to naming a shell.
 *
 * REGISTERED BY BOTH AGENTS — `.claude/settings.json` and `.codex/hooks.json`
 * name this same file. They send different payloads for the same act, so the
 * paths come from `hookPaths` rather than from one hardcoded key: a Codex
 * `apply_patch` names its files inside a diff envelope and carries no
 * `file_path` at all, so reading that key alone meant this guard allowed every
 * edit it exists to refuse, under Codex, in silence.
 *
 * Reads the tool call as JSON on stdin. Never fails the tool call by accident:
 * anything it cannot parse it allows, because a guard that blocks on its own
 * bug is worse than the bug.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emit, hookPaths, readHookPayload } from '../../tools/portable.mjs';

/**
 * The root, derived from this script rather than from the environment:
 * CLAUDE_PROJECT_DIR is set when the harness runs the hook and absent when a
 * human pipes a payload in to test it, and a guard that only works under one
 * of those is a guard nobody can check.
 */
const ROOT = process.env.CLAUDE_PROJECT_DIR
  ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const DENIALS = {
  'packages/content/loci.yaml':
    'packages/content/loci.yaml is GENERATED and this edit would be overwritten by the next '
    + '`npm run gen:loci`. Edit packages/content/tools/gen-loci.mjs instead, then regenerate '
    + 'and commit the result. (AGENTS.md, Do not.)',
  'docs/VOCABULARY.md':
    'docs/VOCABULARY.md is GENERATED from the Zod schemas and this edit would be overwritten by '
    + 'the next `npm run gen:docs`. Change the schema in packages/schema/src, then regenerate '
    + 'and commit the result. (AGENTS.md, Do not.)',
};

const SAVE_WARNING =
  'WorldState edited and packages/schema/src/save.ts is untouched. A field on the world must '
  + 'reach WorldState AND createWorld AND SavedGameS AND saveGame/loadGame. Skipping the last two '
  + 'does not fail — the field resets silently on load, which looks exactly like a subsystem that '
  + 'stopped working two centuries in. (AGENTS.md, Adding things.)';

/** Does the text being written ADD a field, or merely reword a comment? */
const addsAField = (text) => /^\s+[a-zA-Z_][a-zA-Z0-9_]*\??:\s/m.test(text ?? '');

/** No local change to save.ts. `--quiet` exits 0 when the file is untouched. */
function saveFormatUntouched(root) {
  try {
    const r = spawnSync('git', ['-C', root, 'diff', '--quiet', '--', 'packages/schema/src/save.ts'], {
      stdio: 'ignore',
    });
    return !r.error && r.status === 0;
  } catch {
    return false;
  }
}

const payload = await readHookPayload();
const paths = hookPaths(payload, ROOT);
if (paths.length === 0) process.exit(0);

// ANY path in the call, not the first one. One Codex patch writes several
// files and the generated one need not be at the top of the envelope.
for (const rel of paths) {
  const reason = DENIALS[rel];
  if (!reason) continue;
  emit({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  });
  process.exit(0);
}

if (paths.includes('packages/core/src/world.ts')) {
  const added = payload?.tool_input?.new_string ?? payload?.tool_input?.content ?? '';
  if (addsAField(added) && saveFormatUntouched(ROOT)) emit({ systemMessage: SAVE_WARNING });
}

process.exit(0);
