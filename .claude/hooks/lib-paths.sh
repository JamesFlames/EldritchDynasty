#!/usr/bin/env bash
#
# THE PATHS A TOOL CALL TOUCHES, UNDER EITHER AGENT.
#
# Both guards used to read `.tool_input.file_path` and nothing else. That is
# the CLAUDE payload. Codex sends a different shape for the same act: the tool
# is `apply_patch`, and the files it writes are named inside a unified-diff
# envelope on `.tool_input.command`, as `*** Update File: <path>` lines. There
# is no `file_path` key in it at all.
#
# So under Codex `jq -r '.tool_input.file_path // empty'` returned empty, the
# guard hit its `[ -z "$path" ] && exit 0` line, and every rule it enforces
# passed silently on the exact edit it exists to refuse. A guard that cannot
# read the payload is indistinguishable from no guard, and neither one ever
# prints anything — this repository's signature failure, inside its own
# enforcement.
#
# `hookPaths` prints one repo-relative path per line, for either shape, and
# prints nothing it cannot parse. Anything unparsed means the caller allows the
# call: a guard that blocks on its own bug is worse than the bug.
set -uo pipefail

# The repo root, derived from this file rather than from the environment.
# CLAUDE_PROJECT_DIR is set when Claude Code runs the hook, absent when a human
# pipes a payload in to test it, and never set by Codex — which passes `cwd` on
# stdin instead and sets no variable of its own.
hookRoot() {
  if [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
    printf '%s' "$CLAUDE_PROJECT_DIR"
  else
    (cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
  fi
}

# usage: hookPaths "$input"
hookPaths() {
  local input=$1 root rel
  root=$(hookRoot)

  # CLAUDE: one absolute path, on the input or on the response.
  local direct
  direct=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_response.filePath // empty' 2>/dev/null || true)

  # CODEX: an apply_patch envelope. `*** Add|Update|Delete File: <path>`, and
  # `*** Move to: <path>` for the destination half of a rename — a rename INTO
  # a generated file is still an edit of it.
  local patched
  patched=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null | \
    sed -n 's/^\*\*\* \(Add\|Update\|Delete\) File: //p; s/^\*\*\* Move to: //p' || true)

  # A while-read rather than word splitting: a path may contain a space, and
  # the one that does is the one that gets past the guard.
  local p
  printf '%s\n%s\n' "$direct" "$patched" | while IFS= read -r p; do
    [ -z "$p" ] && continue
    rel=${p#"$root/"}      # absolute (Claude) → relative
    rel=${rel#./}          # `./x` (Codex sometimes) → `x`
    printf '%s\n' "$rel"
  done
}
