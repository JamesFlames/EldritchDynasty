# COMMANDS

The command block itself lives in [CLAUDE.md](../CLAUDE.md#commands) and is the
only copy — a number kept in two files is wrong in one of them within a few
commits, and `npm run test:fast` was once documented at four different figures
at once while actually taking a hundred seconds. `packages/core/src/codemap.test.ts`
fails the build if a second copy grows back, so **quote no timing here**.

This file is the part that is prose rather than a line: how a session starts,
what the landing actually does, what CI is shaped like, and which of those
commands answer a question nothing else can.

---

## How a session starts

A fresh session on the web orients itself, installs dependencies and warms the
content cache before an agent reads anything — `.claude/hooks/session-start.sh`,
registered as a SessionStart hook. Locally it does nothing; you already have
`node_modules` and a whole history.

**Orienting is `tools/orient.sh`, and it is not cosmetic.** The clone arrives
SHALLOW — a third of the history — and a shallow clone does not refuse ancestry
questions, it answers them wrongly: `git branch --merged`, `git log main..x` and
every "has this landed?" come back false past the graft boundary. A cleanup
script trusted that answer once and reported 29 branches as unmerged that were
all merged. The hook unshallows so the answers are real, then prints which
issues other sessions are holding. What that cost before it existed is in
[PARALLEL.md](PARALLEL.md).

## The landing

`npm run land` is the whole landing, and [AGENTS.md](../AGENTS.md#working-style)
records standing authorization to run it and push with no PR and no prompt.

It fetches, rebases onto `origin/main`, installs, and runs **the whole set CI
runs on that rebased head** — typecheck, validate, test and `npm run gate` —
then pushes and waits for CI. `npm run check` is NOT that set: it omits the
gates, which are a third of what CI does, and landing on it broke `main` four
times. `packages/core/src/tools/land.test.ts` derives the step set from
`.github/workflows/check.yml`, so a new CI job the landing does not run fails
the build.

The wait matters because a push is not finished until a verdict comes back, and
there are **four** answers: green, red, **pending** (CI started and has not
finished) and **absent** (a run that concluded in seconds with no steps, out of
Actions minutes). An absence looks exactly like a pass in every UI. A red build
is yours to fix; an absent one is not, and is still not a pass — say so, and
name the commit. `npm run verdict` asks on its own; `npm run land -- --no-verdict`
skips the wait.

## CI, and the janitor

`.github/workflows/check.yml` runs **three jobs in parallel** — `lint`
(typecheck + validate + prose annotations), `test`, and `gates` (`npm run gate`).
Serial, it reported only the FIRST thing wrong, so a moved gate hid behind a
failing test and cost another whole run to find; each job now answers
independently.

Everything runs on every push to `main`, because this repository fast-forwards
without pull requests and a PR-gated job would run approximately never. The gate
step runs everything in `GATES` rather than a list of names, because the list
used to be kept by remembering and gate 2 was left off it.

`janitor.yml` runs `tools/janitor.sh` on every push to `main`: it deletes
branches already merged there, retires every claim ref those branches were
holding, and closes what a landing commit named. **An agent's own git proxy
refuses ref deletion**, so that housekeeping cannot happen anywhere else — do
not try it, and do not read a surviving branch as work in flight.
`DRY_RUN=1 tools/janitor.sh` shows what it would do.

## The ones that answer a question nothing else can

- **`npm run digest` proves a refactor changed nothing.** Run it before and
  after. If the fingerprint block moves it was not a refactor — and since each
  year phase draws from its own RNG stream, a moved block points at the system
  that moved it.
- **`npm run harness`** is the only viable balance method. One playthrough is
  8–12 hours; never claim a balance change works without a batch behind it.
- **`npm run mutate`** breaks code on purpose and lists what no test noticed. A
  PROBE, run deliberately — never a CI threshold.
- **`npm run gate:drag` / `:blood` / `:ladder` / `:bearing`** are the four
  measured sessions; their arguments and findings are in
  [BALANCE-LOG.md](BALANCE-LOG.md).
- **`npm run cost`** re-measures the figures in CLAUDE.md's block; `--write`
  applies them. They are measured on a four-core container and are perishable.
- **`npm run scoreboard`** gives the red rate on `main` and which job went red.
- **`npm run agents`** is the claim protocol — see [PARALLEL.md](PARALLEL.md).
  `check` before the long run says whether somebody landed in your paths while
  you worked.

`packages/content/loci.yaml` and `docs/VOCABULARY.md` are **generated**
(`npm run gen:loci`, `npm run gen:docs`). Never hand-edit either;
`.claude/hooks/guard-edit.sh` denies the attempt.
