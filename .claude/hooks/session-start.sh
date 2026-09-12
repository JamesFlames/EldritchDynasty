#!/bin/bash
# Make a fresh remote session able to run `npm run check` immediately.
#
# A cold clone of this repo has no node_modules, so the first thing any agent
# does is notice that and decide whether it can afford `npm install`. It costs
# about eleven seconds. Deciding about it costs more than that.
#
# Web sessions only: a local checkout already has its dependencies, and a hook
# that runs on every session start there is a tax with no payer.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

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
