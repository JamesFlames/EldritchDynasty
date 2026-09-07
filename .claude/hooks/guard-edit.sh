#!/usr/bin/env bash
#
# THE TWO CHEAPEST RULES IN CLAUDE.md, ENFORCED WHERE THEY ARE BROKEN.
#
# Every invariant in this repository is guarded by a test, and a test is 68
# seconds away at best and half an hour at worst. Two of the rules in the
# "Do not" list are one-line checks on the path being written, and both were
# prose only:
#
# ONE: `packages/content/loci.yaml` and `docs/VOCABULARY.md` are GENERATED.
# Hand-editing either produces a file that the next `npm run gen:loci` writes
# over, and docs/PARALLEL.md is explicit that a merge conflict in them must
# never be resolved by hand. The edit succeeds, looks right, and is gone.
#
# TWO: A FIELD ON `WorldState` MUST REACH THE SAVE FORMAT. CLAUDE.md already
# says what it looks like when it does not: "it makes the field reset silently
# on load, which looks exactly like a subsystem that stopped working two
# centuries in."
#
# The first is a refusal, and it names the command that fixes it — a refusal
# that names the fix costs one turn; the alternative costs a full check. The
# second is a WARNING, because the legitimate two-step edit exists (add the
# field, then add it to the save format) and a refusal would make it
# impossible. A hook that blocks correct work gets switched off within a week.
#
# Reads the tool call as JSON on stdin. Never fails the tool call by accident:
# anything it cannot parse it allows, because a guard that blocks on its own
# bug is worse than the bug.
set -uo pipefail

input=$(cat)
path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)
[ -z "$path" ] && exit 0

# The root, derived from this script rather than from the environment:
# CLAUDE_PROJECT_DIR is set when the harness runs the hook and absent when a
# human pipes a payload in to test it, and a guard that only works under one
# of those is a guard nobody can check.
root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
rel=${path#"$root/"}

deny() {
  jq -nc --arg reason "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
}

case "$rel" in
  packages/content/loci.yaml)
    deny "packages/content/loci.yaml is GENERATED and this edit would be overwritten by the next \`npm run gen:loci\`. Edit packages/content/tools/gen-loci.mjs instead, then regenerate and commit the result. (CLAUDE.md, Do not.)"
    ;;
  docs/VOCABULARY.md)
    deny "docs/VOCABULARY.md is GENERATED from the Zod schemas and this edit would be overwritten by the next \`npm run gen:docs\`. Change the schema in packages/schema/src, then regenerate and commit the result. (CLAUDE.md, Do not.)"
    ;;
esac

# The save-format warning. Only fires when the edit actually ADDS a field: the
# hook sees the new text, so it can tell a field being added from a comment
# being reworded, and warning on every touch of the file would train the reader
# to skip it.
if [ "$rel" = "packages/core/src/world.ts" ]; then
  added=$(printf '%s' "$input" | jq -r '.tool_input.new_string // .tool_input.content // empty' 2>/dev/null || true)
  if printf '%s' "$added" | grep -qE '^\s+[a-zA-Z_][a-zA-Z0-9_]*[?]?:\s'; then
    if git -C "$root" diff --quiet -- packages/schema/src/save.ts 2>/dev/null; then
      jq -nc '{
        systemMessage: "WorldState edited and packages/schema/src/save.ts is untouched. A field on the world must reach WorldState AND createWorld AND SavedGameS AND saveGame/loadGame. Skipping the last two does not fail — the field resets silently on load, which looks exactly like a subsystem that stopped working two centuries in. (CLAUDE.md, Adding things.)"
      }'
    fi
  fi
fi

exit 0
