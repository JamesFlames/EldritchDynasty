# TEST COVERAGE

Measured 2026-08-20 with `@vitest/coverage-v8` over the full suite, plus two
probes for the things a coverage tool cannot express: which authored *outcomes*
a run can actually reach, and which of the condition and effect vocabularies
have ever been evaluated.

Everything the survey found has been fixed. This file is kept as the record of
what was blind and what the fixes were, and as the method for asking the
question again.

The house thesis is that **this codebase fails by doing nothing**
([FAILURES.md](FAILURES.md)). Line coverage is a poor instrument for that: a
statement executes just as happily when it is wrong. What made the survey worth
running was the other half — what is never reached at all — because in a
codebase that fails silently, an unreached branch and a broken one look
identical from the outside.

---

## The numbers

| Package | Before | After |
| --- | --- | --- |
| `schema` | 95.1% | **99.0%** |
| `core` | 86.8% | **91.3%** |
| `content` | 100% | 100% |
| `editor` | 0% | 1.1% (the two node-testable modules) |
| `shell` | 0% | 0% |
| **Engine** (core + schema + content) | 89.3% | **93.6%** |
| **Repo total** | 56.95% | 60.4% |
| Branches / functions | 86.2% / 86.7% | **89.2% / 91.0%** |

45 files and 535 tests became 53 and 692. The repo total is still mostly the
editor's 4,440 lines of Vue, which need `jsdom` and `@vue/test-utils` — a real
decision, deliberately not taken here.

**What was already good, and was not traded away for a number:** the eighteen
`*.slow.test.ts` suites that simulate centuries and assert the *shape* of a
healthy run. They are the only instrument that catches a house which quietly
empties.

---

## What the survey found, and what fixing it turned up

Four of the eight findings were dead tests. Three were live bugs that the
tests found on the way through, and one was a whole mechanic that had never
run.

### Bugs the fixes uncovered

**`recast` freed the wrong role.** `effects.ts` filtered the literal string
`'head'` out of `castSlots` whatever slot it was pointed at, contradicting the
comment directly above it. On any non-head slot it freed nothing — so
`maintainCast` never refilled the slot and the effect was a no-op that looked
like it had worked — and if the person standing there happened to hold the
seal, it took the seal off them instead. The role now comes from the template,
threaded through `EvalScope` the way arc memory already was. Three tests in
`effect-verbs.test.ts` fail against the old line.

**The content-write guard had drifted.** The same check was written four times
across two transports. The dev server's PUT half omitted the trailing
separator, so a sibling `packages/content-x/` passed a check the GET half
blocked; the two transports also disagreed about whether non-YAML was
writable. One implementation now, in `packages/content/tools/content-path.mjs`,
written with `path.relative` so the separator bug cannot come back.

**The diff view drew an elision that had not happened.** `collapseContext`
started `lastKept` at `-2`, so the first kept line at index 0 satisfied
`i > lastKept + 1` and emitted a gap — a `⋯` above the first line of every diff
that began at the top of the file. Cosmetic, and exactly the kind of thing 0%
coverage hides.

### The mechanic that had never run

The auction has bought spellbooks since the auction existed and **nothing ever
read one**. `gainSpellbook` was reachable only through a `spellbook` effect no
content authored, so a thousand-year run ended with sixty-odd volumes on the
shelf, degrading, and `Person.spellsKnown` empty in every house that ever
lived — 0 readers across 12 × 1000y. Eleven books carried `studyYears` and the
Scholar carried `studySpeed: 0.7`, both measuring a wait nobody was having;
`effectiveStudyYears` had zero callers.

`spellbook.op: study` is the door in — the same arrival with the years in front
of it, carried by `world.studies` and collected by a new `library` year phase.
The `schedule` effect could not have done it: that schedules an *event*, recast
from scratch when due, and a study belongs to one person for a length of time
only that person's career knows. Content: `the_book_comes_down`. **19 readers
now, across the same 12 runs.**

The same finding's other half — `world.scheduled` is written only by the
`schedule` effect and read only by `forcedCandidates`, whose loop body had
never executed — is covered directly in `study.test.ts`, including
`SCHEDULE_PATIENCE` and the five-year requeue.

### Dead tests, now live

**Gate 8 (outcome-reach), new.** Gate 4 measures how often each of the 48
events fires; the content declares 94 `(event, choice, outcome)` triples and
nothing measured those. Built on `world.decisionLog`, which replay already
recorded. It found what it was written for on its first run:
`the_vessel_rite/take_the_gifted_one` required `VESSEL.mind >= 40`, a number
authored against the 0–100 *range* rather than the population — median 10, p90
16 among the kin the rite can cast. The branch was offered once in 85 firings
and taken never. At 16 it lands in 6% of runs.

Sample size is the whole design. At **30** runs the probe also flagged
`hold_the_gate -> driven_off`, which at 100 runs resolves in 11% — the rarest
thing in the game, not a dead one. It runs at 100, like gate 4.

**Gate 2 was run by nothing** — not CI, not a test — since it was written.
Now in `check.yml` alongside gate 8.

**Every gate is now a function over a bundle** returning a verdict rather than
printing one, because a gate nobody has seen fail is indistinguishable from a
gate that cannot fail. `gates.test.ts` hands each one content it must reject.

**35 of 72 issue-raising sites in `rules.ts` never fired.** Five rules had no
exercised failure path at all — `frame/shape` (8 sites),
`frequency/obligations` (6), `slots/arc-bound`, `event/shape`,
`traits/mystic-restriction`. `frame/shape` was the sharpest: AGENTS.md says a
frame event "carries no effects, Record block or rumour by construction
(`frame/shape` fails the build otherwise)", and nothing had ever demonstrated
that it does. All 71 sites now fire; `rules.ts` is at 100% statements.

**Nine of 25 condition predicates had never been evaluated**, by a test or by
a line of content. `conditions.test.ts` asks every predicate a question it must
answer TRUE and one it must answer FALSE — a predicate stuck on `true` gates
nothing, and content gated on nothing fires in every run forever.

**`rumour` and `recast` effect verbs had never executed**, and neither had the
two `assertNever` fallthroughs, both of which used to `return true`.

**The view API.** One function in five on `GameSession` had never been called:
`declineHand` is a real move nobody had made, and `branchReport`,
`frequencyReport` and `describeDecision` are diagnostics — reached for when
something is already wrong, which is the worst moment to find out they throw.

---

## The methodological note worth keeping

**Line coverage reads high on exactly the code this survey was about.**
`conditions.ts` reported 84.9% statements while a third of its predicates had
never returned an answer, because the evaluator is a chain of single-line
guards:

```ts
if ('familySize' in c) return compare(w.people.household(...).length, ...);
```

v8 marks that covered the moment *any* condition is evaluated — the `in` test
runs every time. Only the multi-line kinds showed as uncovered. Read a
dispatch chain's coverage number as a starting point for questions, never as
an answer.

---

## Asking again

```
npm i --no-save @vitest/coverage-v8@2.1.8
npx vitest run --coverage --coverage.provider=v8 \
  --coverage.include='packages/**/src/**' \
  --coverage.exclude='packages/**/*.test.ts'
```

Coverage tooling is deliberately *not* in `package.json`. It is a probe to run
on purpose when asking this question, for the same reason `digest.ts` is not a
checked-in golden: a coverage threshold in CI gets satisfied rather than read.
The two questions it cannot answer — outcome reach, and vocabulary reach — are
gate 8 and the truth tables, and those *are* wired in.

## Still open

- **The editor's 4,440 lines of Vue.** Needs `jsdom` and `@vue/test-utils`.
  `store.ts` (225 lines of comment-preserving YAML write-back that touches real
  files) is node-testable today and is the next thing worth doing.
- **`shell/src/main.mjs`.** Electron main process; its one piece of real logic,
  the path guard, is now shared and tested.
