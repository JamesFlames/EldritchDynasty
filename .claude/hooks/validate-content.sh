#!/usr/bin/env bash
#
# THE ONE-SECOND CHECK THAT GETS DEFERRED TO THE END OF A SESSION.
#
# `npm run validate` runs 32 content rules over every authored YAML file and
# takes about a second. It is also the check most likely to be skipped, for a
# mundane reason: an agent that has just finished writing YAML feels finished.
# The cost of skipping it is not the second — it is finding the error after a
# thirty-minute landing instead of immediately, with the file still in mind.
#
# Runs only for writes under `packages/content/`, and only for YAML. Never
# fails the tool call: the write already happened, and the point is to put the
# errors in front of the agent now rather than to undo anything.
set -uo pipefail

input=$(cat)
path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_response.filePath // empty' 2>/dev/null || true)
[ -z "$path" ] && exit 0

# The root, derived from this script rather than from the environment:
# CLAUDE_PROJECT_DIR is set when the harness runs the hook and absent when a
# human pipes a payload in to test it, and a guard that only works under one
# of those is a guard nobody can check.
root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
rel=${path#"$root/"}
case "$rel" in
  packages/content/*.yaml|packages/content/**/*.yaml) ;;
  *) exit 0 ;;
esac

cd "$root" || exit 0
out=$(npm run --silent validate 2>&1) || true

# The last line is the verdict: "32 rules · 0 errors · 0 warnings".
if printf '%s' "$out" | grep -qE '· [1-9][0-9]* errors'; then
  jq -nc --arg out "$out" '{
    systemMessage: ("npm run validate FAILED after this content edit:\n" + $out),
    hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: $out }
  }'
fi

exit 0
