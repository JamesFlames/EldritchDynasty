# COMMANDS

The command block itself lives in [AGENTS.md](../AGENTS.md#commands) and is the
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

### A landing has to outlive the session that started it

An hour of work, in a container that is paused between turns. **Start it in a
background the harness tracks** — in Claude Code, the Bash tool's
`run_in_background` — and **never with `nohup … &`**, which the shell knows
about and nothing else does. Twice on 2026-09-08 a `nohup` landing was killed
by that pause and left no exit code, no error and a log that simply stopped
mid-suite on a green tick; the same command under a tracked run reached
`landed, and judged.`

**`npm run land -- --status` is the reading**, and it exists because working
it out took four probes — `ps aux`, a log tail, `cat .git/land.lock`, `git
worktree list` — none of which an agent thinks to run until it already
suspects something. It answers one of three things:

| Reading | What it means |
|---|---|
| `no landing is running` | nothing to recover; start one |
| `a landing is RUNNING … at <step>` | leave it alone, it is between steps |
| `a landing DIED … at <step>` | recover — and the step says how |

The step is the whole point of the lock carrying more than a pid. A landing
killed at `test` **pushed nothing**. One killed at `verdict` **put a commit on
`main` and did not stay to hear the answer** — the absent verdict above,
arriving by a different road, and the one case where re-landing is the wrong
move: run `npm run verdict` against that commit instead. Killed at `push`
itself is genuinely ambiguous, and is reported as ambiguous rather than
guessed: check `git log --oneline -1 origin/main`.

The next `npm run land` clears a dead lock by itself, prints the same reading
on the way past, and sweeps the worktree the killed landing left registered —
`process.on('exit')` does not run for a process that was killed, so those
accumulate in `/tmp` otherwise.

## CI, and the janitor

`.github/workflows/check.yml` runs **eight runners in parallel** — `lint`
(typecheck + validate + prose annotations), `test` as a four-way vitest shard,
`gates` in two lanes (`batch` and `war`), and a `corpus` warm that nothing
waits on (the shards run concurrently, so a warm can only ever pay forward
into the next run). Serial, it reported only the
FIRST thing wrong, so a moved gate hid behind a failing test and cost another
whole run to find; each job now answers independently, and every matrix sets
`fail-fast: false` so a shard cannot cancel its siblings and rebuild that
failure mode one level down.

**The gates job was the longest thing in CI, not the tests.** Measured off run
123's own timestamps: `test 34m04s`, `gates 36m24s` — against comments that had
claimed 13m and 8m since run 98. Two gates were ninety per cent of the gates
job (`war` 16m38s, `fire-rate` 16m05s), and `outcome-reach` and
`vocabulary-reach` cost three and four milliseconds because they read
`fire-rate`'s batch. So the lanes are `war` alone against everything else:
splitting anywhere else would play a 250-run batch twice. Sharding the test
job on its own would have taken a 37-minute build to 37 minutes.

**The landing is a separate problem, and it got its own fix.** Sharding buys
the verdict; it cannot help `npm run land`, which runs on one container. So
the landing overlaps instead: `typecheck` and `validate` still go first and
alone — twenty-three seconds that catch a broken template before anything
spends forty minutes — and then `test` and `gates` run AT THE SAME TIME.
Vitest takes a worker per core; `npm run gates` is a single node process
walking the gate table in a serial loop, so it held one core for thirty-six
minutes while three sat idle. About 196 core-minutes of work that took 76
minutes of clock packs into roughly 49.

It reports BOTH, too. A serial landing died at the first failure, so a red
test hid a moved gate and cost another 76 minutes to find it — the argument
this file already made about CI's jobs, which had been true of the landing the
whole time.

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
- **`npm run cost`** re-measures the figures in AGENTS.md's block; `--write`
  applies them. They are measured on a four-core container and are perishable.
- **`npm run scoreboard`** gives the red rate on `main` and which job went red.
- **`npm run agents`** is the claim protocol — see [PARALLEL.md](PARALLEL.md).
  `check` before the long run says whether somebody landed in your paths while
  you worked.

`packages/content/loci.yaml` and `docs/VOCABULARY.md` are **generated**
(`npm run gen:loci`, `npm run gen:docs`). Never hand-edit either;
`.claude/hooks/guard-edit.sh` denies the attempt.
