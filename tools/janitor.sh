#!/usr/bin/env bash
#
# THE TIDYING NO AGENT CAN DO FOR ITSELF.
#
# A Claude session's git proxy refuses ref deletion — 403, every time — so no
# agent has ever deleted its own merged branch or its own spent claim. That one
# restriction is the entire explanation for the thirty-odd `claude/*` branches
# on this remote. An Actions runner has no such limit, so the sweep lives here
# and `.github/workflows/janitor.yml` is four lines that call it.
#
# It is a script rather than YAML so that it can be READ and RUN. `DRY_RUN=1
# tools/janitor.sh` prints every action it would take and performs none of them,
# against whatever remote you point it at.
#
# WHAT IT KEYS OFF, AND WHY IT IS NOT THE ISSUE NUMBER.
#
# A branch lands as many issues as its agent claimed — an epic's three
# sub-issues, a fix and the test-gate it needed. So the unit of "this work is
# finished" is the BRANCH being an ancestor of main, and the claims are found
# from it: each claim records the branch holding it (`agent:`), so one merge
# retires all of them without anybody enumerating anything.
#
# Closing an issue is a different question from releasing a lock, and this
# script keeps them apart. A claim is retired on merge, always: the branch is
# gone, so the lock has no owner. An ISSUE is closed only where somebody said
# so — a closing keyword in a landing commit, which GitHub honours by itself on
# the default branch. An issue held by a merged branch that nobody named is
# REPORTED and left open, because a branch that lands part of an epic is the
# normal case and a script cannot tell it from one that finished.
#
#   DRY_RUN=1 tools/janitor.sh              # what would happen
#   JANITOR_RANGE=abc..def tools/janitor.sh # also close what those commits named
set -euo pipefail

DRY=${DRY_RUN:-0}
REMOTE=${REMOTE:-origin}
SUMMARY=${GITHUB_STEP_SUMMARY:-/dev/stdout}
RANGE=${JANITOR_RANGE:-}

say() { printf '%s\n' "$*" >> "$SUMMARY"; }
act() { if [ "$DRY" = 1 ]; then echo "would: $*"; else "$@" >/dev/null; fi; }
has_gh() { command -v gh >/dev/null 2>&1; }

# `gh` is absent when this is run locally. Say UNKNOWN rather than guessing
# CLOSED, so a missing tool can never close or retire anything.
issue_state() { has_gh && gh issue view "$1" --json state --jq .state 2>/dev/null || echo UNKNOWN; }

# A SHALLOW CLONE INVERTS EVERY ANSWER THIS SCRIPT GIVES, AND SAYS NOTHING.
#
# This is the bug that cost a repository its branch list. An agent container
# clones shallow — 59 commits of a 141-commit main — and `merge-base
# --is-ancestor` cannot walk past the graft boundary, so it returns FALSE for
# every branch older than the shallow window. Run here, the script reported
# "7 merged, 29 kept" and was wrong about all 29. Run on a runner with
# fetch-depth: 0 it reported the truth, and the truth looked like a rampage.
#
# There is no partial credit available: an ancestry test on a shallow clone is
# not conservative, it is arbitrary. So the script refuses to run on one.
if [ "$(git rev-parse --is-shallow-repository)" != false ]; then
  echo "REFUSED: this clone is shallow ($(git rev-list --count HEAD) commits reachable)." >&2
  echo "  Ancestry is unanswerable here and every branch would read as unmerged." >&2
  echo "  Use a runner with fetch-depth: 0, or \`git fetch --unshallow\` first." >&2
  exit 2
fi

git fetch -q "$REMOTE" '+refs/heads/*:refs/janitor/*' --prune
MAIN=$(git rev-parse refs/janitor/main)

# ---------------------------------------------------------------------------
# 1. Which branches have landed. `main` is the judge; nothing else is consulted.
# ---------------------------------------------------------------------------
declare -A MERGED=()
declare -a DOOMED=() ALIVE=()
say '### Branches'
kept=0

# DECIDE FIRST, DELETE AFTER, AND REFUSE A SWEEP THAT WANTS EVERYTHING.
#
# The first run of this script deleted 29 branches it should have kept. The
# decision was wrong on the runner and right in two local runs over the same
# refs, and the reason it could act on that wrongness is that it deleted inside
# the loop that decided — no pass ever saw the whole answer, so nothing could
# notice the answer was absurd.
#
# It looks at the whole set now. A repository where nearly every branch is
# merged is possible; a repository where nearly every branch is merged AND
# nobody has tidied up for a month is the shape of a bug, and the cost of
# pausing on the rare true positive is one dispatch.
# A second, weaker net. It is NOT a correctness check — this repository's first
# honest sweep really was 27 of 29, because nobody had ever been able to delete
# a merged branch. It exists so that a future failure of a different shape has
# to be waved through by a person rather than discovered afterwards.
LOUD=${JANITOR_MAX_SHARE:-60}   # pause if more than this % of branches are doomed
while read -r ref; do
  branch=${ref#refs/janitor/}
  case "$branch" in main|claim/*) continue;; esac
  sha=$(git rev-parse "$ref")
  if git merge-base --is-ancestor "$sha" "$MAIN"; then
    DOOMED+=("$branch")
  else
    ALIVE+=("$branch")
  fi
  # Diagnostics to the LOG rather than the summary: the summary is where the
  # first run's decisions went, which is exactly why the log showed a wall of
  # deletions and no reason for any of them.
  echo "decide $branch: $(git rev-parse --short "$sha") vs main $(git rev-parse --short "$MAIN") → $(git merge-base --is-ancestor "$sha" "$MAIN" && echo MERGED || echo keep) · behind $(git rev-list --count "$sha".."$MAIN" 2>/dev/null || echo '?') ahead $(git rev-list --count "$MAIN".."$sha" 2>/dev/null || echo '?')"
done < <(git for-each-ref --format='%(refname)' refs/janitor/)

total=$(( ${#DOOMED[@]} + ${#ALIVE[@]} ))
if [ "$total" -gt 0 ] && [ $(( ${#DOOMED[@]} * 100 / total )) -gt "$LOUD" ]; then
  say "**PAUSED** — ${#DOOMED[@]} of $total branches came back \"merged\", over the ${LOUD}% ceiling."
  say 'Nothing was deleted. Read the per-branch decisions in the log; if they are right,'
  say 're-run with a higher `max_share`. A backlog nobody could tidy legitimately looks like this.'
  echo "REFUSED: ${#DOOMED[@]}/$total doomed, over ${LOUD}%" >&2
  exit 1
fi

for branch in ${DOOMED[@]+"${DOOMED[@]}"}; do
  MERGED[$branch]=1
  act git push "$REMOTE" --delete "$branch"
  say "- deleted \`$branch\` — merged"
done
while read -r ref; do
  branch=${ref#refs/janitor/}
  case "$branch" in main|claim/*) continue;; esac
  if [ -n "${MERGED[$branch]:-}" ]; then continue; fi
  if true; then
    kept=$((kept + 1))
    days=$(( ( $(date +%s) - $(git log -1 --format=%ct "$ref") ) / 86400 ))
    # Not merged. Work in flight and a session that died in 2026 look identical
    # from here, and only one of them is safe to act on — so this reports.
    [ "$days" -ge 14 ] && say "- kept \`$branch\` — NOT merged, last commit ${days}d ago"
  fi
done < <(git for-each-ref --format='%(refname)' refs/janitor/)
say ''
say "${#MERGED[@]} deleted, $kept left standing."

# ---------------------------------------------------------------------------
# 2. The issues a landing commit said it finished. GitHub does this itself and
#    does it faster; this is the backstop for the shapes it skips, and a no-op
#    whenever the platform already acted.
#
#    ONE KEYWORD PER ISSUE. `Closes #12, closes #13` closes both; `Closes #12,
#    #13` closes only #12 — GitHub's rule, and this regex reads it the same way
#    on purpose, so what the janitor reports and what GitHub did never diverge.
# ---------------------------------------------------------------------------
declare -A NAMED=()
if [ -n "$RANGE" ]; then
  say ''
  say '### Issues named by this push'
  while read -r n; do
    [ -z "$n" ] && continue
    NAMED[$n]=1
    if [ "$(issue_state "$n")" = OPEN ]; then
      act gh issue close "$n" --reason completed --comment "Landed on \`main\`."
      say "- closed #$n"
    fi
  done < <(git log --format=%B "$RANGE" 2>/dev/null \
            | grep -oiE '(clos(e|es|ed)|fix(e[sd])?|resolv(e|es|ed)) +#[0-9]+' \
            | grep -oE '[0-9]+' | sort -un)
fi

# ---------------------------------------------------------------------------
# 3. The claims. One merge retires every claim its branch was holding.
# ---------------------------------------------------------------------------
say ''
say '### Claims'
held=0
while read -r ref; do
  slug=${ref#refs/janitor/claim/}
  body=$(git log -1 --format=%B "$ref")
  agent=$(sed -n 's/^agent: //p' <<<"$body" | head -1)
  reason='' landed=0
  if grep -q '^released:' <<<"$body"; then
    reason="released by the agent"
  elif [ -n "$agent" ] && [ -n "${MERGED[$agent]:-}" ]; then
    reason="\`$agent\` landed"; landed=1
  elif [[ "$slug" =~ ^[0-9]+$ ]] && [ "$(issue_state "$slug")" = CLOSED ]; then
    reason="issue #$slug is closed"
  fi

  if [ -n "$reason" ]; then
    act git push "$REMOTE" --delete "claim/$slug"
    say "- retired \`claim/$slug\` — $reason"
    # The multi-issue case, said out loud: a branch that LANDED while still
    # holding an issue nobody's commit named. Usually an epic delivered in
    # parts. Never closed from here — only reported. An agent that put an issue
    # down by hand said what it meant by releasing it, so that case is silent.
    if [ "$landed" = 1 ] && [[ "$slug" =~ ^[0-9]+$ ]] && [ -z "${NAMED[$slug]:-}" ] && [ "$(issue_state "$slug")" = OPEN ]; then
      say "  - ⚠ #$slug is still OPEN and no landing commit named it. Close it or re-claim it."
    fi
  else
    held=$((held + 1))
    hours=$(( ( $(date +%s) - $(git log -1 --format=%ct "$ref") ) / 3600 ))
    say "- \`claim/$slug\` held by ${agent:-someone}, ${hours}h"
  fi
done < <(git for-each-ref --format='%(refname)' refs/janitor/claim/)
say ''
say "$held claim(s) still open."
