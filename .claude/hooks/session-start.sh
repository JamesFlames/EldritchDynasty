#!/bin/bash
# Make a fresh remote session able to run `npm run check` immediately.
#
# A cold clone of this repo has no node_modules, so the first thing any agent
# does is notice that and decide whether it can afford `npm install`. It costs
# about eleven seconds. Deciding about it costs more than that.
#
# Fresh containers only: a local checkout already has its dependencies, and a
# hook that runs on every session start there is a tax with no payer.
#
# The gate used to be `CLAUDE_CODE_REMOTE = true` and nothing else. Codex never
# sets that variable — it sets none of its own, and passes `cwd` on stdin
# instead — so the copy of this script registered for Codex exited at line one
# of every session it ever ran in. It installed nothing, warmed nothing, and
# printed nothing to say so.
#
# So the gate asks the question it always meant: is this a checkout that has
# not been set up? A missing `node_modules` is true in every remote container
# and false in every working local clone, under either agent, on either
# platform.
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ] && [ -d node_modules/vitest ]; then
  exit 0
fi

# Orientation first: unshallow the clone, and print who is holding which issue.
# Both are invisible otherwise, and the shallow clone in particular makes git
# answer ancestry questions WRONGLY rather than refusing them — see
# tools/orient.sh, which explains what that cost.
bash tools/orient.sh || true

# `install`, not `ci`: the container image is cached after this hook completes,
# and `ci` deletes node_modules first, which throws that cache away every time.
if [ ! -d node_modules ] || [ ! -d node_modules/vitest ]; then
  echo "installing dependencies…"
  npm install --no-audit --no-fund
fi

# Warm the parsed-content cache (packages/content/src/index.ts). The first
# loadContent() of a session pays ~730ms to parse 74 YAML files and writes the
# result to node_modules/.cache; every test file after it pays ~225ms.
#
# `npm run validate` is the warmer because it already loads the content and
# takes about a second, so it costs nothing extra and answers a second question
# on the way past: whether this checkout's content is even valid. A failure
# here is worth printing and is not worth blocking the session over — the
# agent will run the same command and get the same list.
echo "warming the content cache…"
npm run validate || echo "content does not validate — see the errors above"
