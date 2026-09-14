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
#
# Registered by BOTH agents. The paths come from `hookPaths` (lib-paths.sh),
# which reads Claude's `file_path` and Codex's `apply_patch` diff envelope
# alike — a Codex content edit carries no `file_path`, so reading that key
# alone meant this never ran under Codex and never said so.
set -uo pipefail

. "$(dirname "${BASH_SOURCE[0]}")/lib-paths.sh"

input=$(cat)
root=$(hookRoot)
paths=$(hookPaths "$input")
[ -z "$paths" ] && exit 0

# Any content YAML among them is enough: `validate` runs over the whole tree.
printf '%s\n' "$paths" | grep -qE '^packages/content/.*\.yaml$' || exit 0

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
