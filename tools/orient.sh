#!/usr/bin/env bash
#
# WHAT AN AGENT NEEDS TO KNOW BEFORE IT KNOWS ANYTHING ELSE.
#
# Two facts, printed at session start, because both of them are invisible and
# both have already cost this repository something.
#
# ONE: THE CLONE ARRIVES SHALLOW, AND GIT LIES ABOUT HISTORY WHEN IT IS.
#
# A fresh session gets 59 commits of a 141-commit main and `.git/shallow` on
# disk. `git merge-base --is-ancestor` cannot walk past the graft boundary and
# does not fail there — it answers FALSE. So `git branch --merged`, `git log
# main..branch` and every "has this landed?" come back wrong, in the direction
# that looks cautious, which is why the wrong answer gets believed. A cleanup
# script trusted it once and reported 29 branches as unmerged that were all
# merged; the repair took an hour and deleted the same branches twice.
#
# Documenting that was not enough — this codebase's own history is a list of
# rules that were only ever asked for. So the trap is removed instead: the
# session unshallows, and the question becomes answerable.
#
# TWO: SOMEBODY ELSE MAY BE HOLDING THE ISSUE YOU ARE ABOUT TO START.
#
# Claims live on refs nobody has to read a document to see (docs/PARALLEL.md).
# Printing them here is the difference between a protocol and a suggestion.
#
# Never fails a session. No `set -e`, every step forgiving, exit 0 at the end:
# an orientation step that can break a session is worse than no orientation.
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")}" || exit 0
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

if [ "$(git rev-parse --is-shallow-repository 2>/dev/null)" = true ]; then
  before=$(git rev-list --count HEAD 2>/dev/null || echo '?')
  echo "unshallowing — ancestry is unanswerable in a shallow clone…"
  if git fetch --quiet --unshallow 2>/dev/null; then
    echo "  history: $before commits → $(git rev-list --count HEAD 2>/dev/null || echo '?')"
  else
    echo "  COULD NOT UNSHALLOW. Do not trust \`git branch --merged\`, \`git log main..x\`"
    echo "  or any 'has this landed' answer in this session — see docs/PARALLEL.md."
  fi
fi

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')
echo "you are on: $branch"

# WHAT `main` LAST GOT BACK FROM CI.
#
# An agent that arrives to a red or unjudged trunk should know before it
# starts, not after it has rebased onto one. Seven commits landed unjudged over
# sixteen hours in September 2026 and the only reason anybody found out was
# somebody reading the Actions list by hand a day later.
#
# Reads `refs/verdict/<sha>`, written by .github/workflows/verdict.yml. No API
# and no token: the Actions API answers a session's curl with 403, and this has
# to work in the place where that is true.
if git fetch --quiet origin '+refs/verdict/*:refs/verdict/*' 2>/dev/null; then
  head=$(git rev-parse origin/main 2>/dev/null || echo '')
  if [ -n "$head" ]; then
    line=$(git log -1 --format=%B "refs/verdict/$head" 2>/dev/null | sed -n 's/^conclusion: //p')
    case "$line" in
      success) echo "main: green on ${head:0:7}" ;;
      '')      echo "main: NO VERDICT on ${head:0:7} — CI has not answered for it. Not a pass." ;;
      *)       echo "main: $line on ${head:0:7} — trunk is not green. \`npm run verdict\` for the jobs." ;;
    esac
  fi
fi

# The claims other sessions are holding right now. `agents.mjs` fetches, so this
# is current rather than remembered; if the remote is unreachable it says so and
# the session continues.
if command -v node >/dev/null 2>&1 && [ -f "$HERE/agents.mjs" ]; then
  node "$HERE/agents.mjs" list 2>/dev/null || echo "could not read claims — \`npm run agents\` before taking an issue"
fi

exit 0
