# Many agents, one repository

Everything below assumes the thing this project actually does: several Claude
sessions, each in its own container with its own clone, working different issues
at the same time. They cannot see each other's files, cannot message each other,
and all of them authenticate to GitHub as the same person.

---

## The one thing to know

**The limit on parallelism here is not merge conflicts. It is the frequency
pool.**

Two agents can each add ten events, each run `npm run check` green on their own
branch, and produce a `main` that fails gate 4 and gate 8 the moment both land —
without one line of overlap between the two diffs. The reason is in
[BALANCE-LOG.md](BALANCE-LOG.md)'s headline: a tier's share of the year is that
tier's weight times *how many templates carry it*, over the same product across
every other tier. Twenty-eight new common templates ration uncommon and rare, and
nothing anywhere reports it. `expectRate` margins go the same way — five tests
have broken on commits that changed nothing they measured, because adding ANY
template re-rolls which scene wins every draw for a thousand years.

Git will merge those two diffs without a murmur. So:

- **Code parallelises. Content serialises.** One content claim open at a time.
- **A branch is only green on the base it was checked against.** Rebase onto the
  landing `main`, then re-run — see [Landing](#landing), which is the rule that
  catches the paragraph above.

Everything else in this document is bookkeeping.

---

## Can an agent assign an issue to itself?

Mechanically yes, usefully no.

Every agent on this repository authenticates as **JamesFlames** — the GitHub
connector carries the owner's identity, not a per-agent one. `get_me` returns the
same login in every session. So an assignee says *a Claude is on this*; it cannot
say *which*, cannot be released by the right one, and cannot arbitrate a race:
assignees, labels and comments are all read-then-write over an API with no
compare-and-swap. Two agents that start a minute apart both read "unassigned" and
both assign.

**Git ref creation is a compare-and-swap.** Pushing a branch that already exists,
carrying a commit that is not a descendant of the one there, is rejected by the
server, always, by protocol. That is a real mutex and it needs no token, no
label, and no API — which matters, because a local agent and a web session do not
have the same tools, and both have `git push`.

So the lock is a ref and the tracker is the human view of it:

```bash
npm run agents                                   # who holds what
npm run agents -- take 93 --paths packages/core/src/economy
npm run agents -- check                          # my claim, and anyone overlapping
npm run agents -- release 93                     # when the work lands
npm run agents -- steal 93                       # only once a claim has gone stale (6h)
```

A claim is an orphan commit with an empty tree pushed to `claim/<issue>`. Orphan,
so no second claim can be a fast-forward of the first and quietly win; empty
tree, so taking one touches no file and can never be merged into anything by
accident. The commit message carries the agent, the lane and **the paths it means
to write** — which is the field that earns its keep, because `check` reports an
overlap before either agent has written a line.

The race is what `packages/core/src/tools/agents.test.ts` actually tests: a bare
repository, two clones, both taking the same issue, exactly one holding it. A
mutex nobody has watched lose is indistinguishable from no mutex.

Assign and label the issue as well if you like; it is what the team lead reads.
Just never treat it as the thing that stopped someone else from starting.

---

## Lanes

| Lane | Paths | How parallel |
|---|---|---|
| **client / editor / shell** | `packages/client`, `packages/editor`, `packages/shell` | Freely. Separate trees, separate typecheck, no shared statistics |
| **engine** | `packages/core/src/**` (not `tools/`), `packages/schema/src/**` | By subsystem, one agent per subsystem. Watch the hotspots below |
| **content** | `packages/content/**.yaml` | **One at a time.** Take `lane-content` as well as your issue |
| **gates & CI** | `packages/core/src/tools/**`, `vitest.config.ts`, `.github/workflows` | One at a time. Everyone's build depends on it |
| **docs** | `*.md`, `docs/**` | Freely, but append to `BALANCE-LOG.md` under a dated heading rather than editing in place |

### Engine hotspots — one writer each, whatever the issue says

These are single files that every second feature wants to touch. Declare them in
`--paths` and expect `check` to shout:

- `packages/schema/src/save.ts` — **`SAVE_FORMAT`** is one integer. Two agents
  both bump 10 → 11, git merges both cleanly on either side of the number, and
  one of the two migrations is silently not the format that shipped.
- The closed unions — `effect.ts`, `conditions.ts`, `target.ts`, `decider.ts`,
  `event.ts`. Two new `Effect` kinds is two agents in the same union and the same
  `assertNever` switch in `core`. The conflict is mechanical and obvious; the
  danger is resolving it by keeping one side's `case` and both sides' variants,
  which typechecks forever and does nothing (invariant 11).
- `packages/core/src/year/phases.ts` — the year table. Renaming or reordering
  reseeds a phase, so two agents inserting phases must not both guess where.
- `packages/core/src/session.ts` — the whole client surface. Small file, high
  demand.
- Generated: `packages/content/loci.yaml`, `docs/VOCABULARY.md`. **Never resolve
  a conflict in these by hand.** Take either side, then `npm run gen:loci` /
  `npm run gen:docs` and commit the regeneration.

---

## The protocol, end to end

1. **Claim before reading code.** `npm run agents -- take <issue> --paths <what
   you will write>`. Denied means denied — pick another issue rather than working
   it in parallel and discovering the other agent at merge time.
2. **Branch per agent**, as the session harness already does:
   `claude/<topic>-<suffix>`. One issue, one branch, one session.
3. **Work.** `npm run test:fast` (~27s) is the loop.
4. **Re-check the claim before the long run.** `npm run agents -- check` costs a
   fetch and tells you whether somebody landed in your paths while you worked.
5. **Land** — below.
6. **Release**: `npm run agents -- release <issue>` and close the issue.

**A release does not delete the ref, and cannot.** A web session's git proxy
refuses ref deletion — `git push --delete` comes back `403`, and there is no
GitHub tool in the session that deletes one either. So a release force-updates
the claim to a tombstone commit saying `released:`, which every agent reads as
free. It works identically on a laptop and in a container, which a delete does
not. `--prune` will attempt the delete as well, and shrugs when it is refused.

That same 403 is why there are **28 unmerged `claude/*` branches** on the remote:
no agent has ever been able to tidy up after itself. Branch cleanup is a job for
a human with a local checkout (`git push origin --delete <branch>`), or a
scheduled workflow. Do not ask an agent to do it and do not read a surviving
branch as work in flight.

## Landing

The repository's standing authorization is to fast-forward `main` as soon as
`npm run check` is green, with no PR ([AGENTS.md](../AGENTS.md#working-style)).
That holds with several agents running, with one addition, and the addition is
the whole point of this document:

```bash
git fetch origin main
git rebase origin/main          # not merge — main here is a straight line
npm run check                   # ON THE REBASED HEAD. ~9 min
git push origin HEAD:main       # rejected? someone landed first: rebase and re-run
```

**The check that matters is the one after the rebase.** A green run against the
base you forked from says nothing about the base you are landing on — that is
exactly the case where two content branches each pass and their merge does not.

- If the rebase brought in **content or anything in `core`**, run the full
  `npm run check` again. No shortcut.
- If it brought in **docs or another package's UI only**, `npm run test:fast` and
  `npm run gate` are enough.
- **Refactors**: `npm run digest -- 8 400` before and after. If the block moves,
  it was not a refactor — and because each phase draws its own RNG stream, a
  moved block names the system that moved it.
- **Content landings**: `npm run gate` after the rebase, always. Gate 4 (fire
  rate) and gate 8 (outcome reach) are the two that another agent's content can
  turn red without touching yours.

CI runs the same sequence on every push to `main` and on every PR, so a landing
that skipped a step is visible within about ten minutes. It is cheaper to find it
before the push.

---

## How many agents

Three or four concurrent, of which **at most one in content**.

The ceiling is not thinking time, it is the landing lane: `npm run check` is
about nine minutes and it has to be re-run after every rebase, so five agents
finishing together spend their afternoon re-checking each other. Give each agent
a different package where you can — client, editor, engine, content — and the
rebases stay empty.

Two shapes of work that should never run in parallel with anything, including
each other:

- **A balance change** (a frequency profile, a weight, a constant in
  `demography.ts`). It moves every number every other agent is measuring against.
- **A gates or vitest-config change.** It decides whether everyone else's build
  is telling the truth.

Take `lane-content` or `lane-gates` for those and let the others land first.

---

## Running them

- **Web**: one Claude Code session per issue. Each gets its own container and its
  own clone, which is the isolation you want and costs nothing to arrange.
- **Local**: one git worktree per agent —
  [`claude --worktree`](https://code.claude.com/docs/en/worktrees), or
  `isolation: worktree` on a subagent so parallel edits cannot collide in one
  checkout.

Either way the claim ref is the only thing the agents share, and it is the only
thing they need to.
