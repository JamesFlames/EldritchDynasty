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

45 files and 535 tests became 53 and 692, and 59 and 809 after the passes
below; content drops since have taken it to 77 and 981. The repo total is
still mostly the editor's 4,440 lines of Vue, which need `jsdom` and
`@vue/test-utils` — a real decision, deliberately not taken here.

**What was already good, and was not traded away for a number:** the thirty-two
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

## The second pass, 2026-08-23

Two things the first survey named and one it could not see.

### The write-back store, and the bug it was hiding

`store.ts` was the largest node-testable module in the repo with no tests at
all, and the first survey named it as the next thing worth doing. Thirty-two
tests now cover it — `packages/editor/src/lib/store.test.ts`, running against
the **real content directory** with only the two transport functions faked, so
nothing writes to disk but everything parses and re-serialises the files the
game ships.

Thirteen of them failed on the first run, all to one cause.

**`doc.setIn(path, plainObject)` stores a raw JS object, not a YAML node.** It
*serialises* correctly — the written file is byte-for-byte what it should be,
which is exactly why this survived — but `doc.getIn([key, i, 'id'])` walks
nodes, and a raw object is not one, so it returns `undefined` from that moment
on. `locate` is built on `getIn`. So an item became invisible to the store the
instant it was first written:

- the **second** save of any event failed with `'…' is not in any loaded file`;
- `createItem` — which appends with `addIn` and then calls `saveItem` — could
  never locate what it had just appended, so **"+ new" never wrote to disk at
  all**.

Both looked like they had worked, because the live model updates either way and
the UI reads the live model. The author sees their new event in the list, and
the file on disk does not have it. `node()` wraps the value in `createNode`
before it goes in; the serialised output is unchanged, byte for byte.

### The field a digest cannot see

`digest` is computed from `saveGame`'s output, so it covers "every field the
format knows about" — its own comment says so, and that is the whole hole. Add
a field to `WorldState` and `createWorld`, forget `SavedGameS` and `saveGame`,
and the field is not in the format, so it is not in the digest, so **every
round-trip test in `save.test.ts` still passes** while the field silently
resets on load. CLAUDE.md names this failure ("it makes the field reset
silently on load, which looks exactly like a subsystem that stopped working two
centuries in") and nothing tested it.

`every field on the world crosses the boundary` compares world and save by
**key** rather than by value, on a world four hundred years old so its optional
fields (`narrator`, `guardianSince`, `headSince`, `respectChanged`) are all
set — and a fourth test pins that sample, so the guard fails loudly rather than
going quietly blind if a future change stops setting one of them. `houses` is
the one declared exception, rebuilt from content on load.

It was verified by adding a `vendetta: Map` to the world and confirming it goes
red naming the field, while every digest test around it stayed green.

## Still open

- **The editor's 4,440 lines of Vue.** Needs `jsdom` and `@vue/test-utils`.
  With `store.ts` covered, this is the remaining untested surface — and it is a
  real decision, still deliberately not taken.
- **`shell/src/main.mjs`.** Electron main process; its one piece of real logic,
  the path guard, is now shared and tested.

## Found, and then finished

Both of the things the second pass recorded as open were design calls rather
than defects, so they were reported rather than patched quietly. Both are now
settled.

### `TraitDef.conflictsWith` — removed

It arrived with the initial commit, was never referenced again, appears in no
design document, and the generated `docs/VOCABULARY.md` does not even surface
it. No content declares it; nothing in `core` reads it.

Implementing it would have been the worse of the two options. There is no pair
of traits in the game that conflicts — the one real stacking hazard the repo
has hit (`competent_physician` and `keeps_the_sickroom` both damping the
Plague, noted in `traits.yaml`) involves two traits the physician's template
deliberately carries **together**, and it was correctly fixed by tuning the
modifiers. Building a gate whose refusal branch no run would ever take trades
one invariant-11 violation for another, and this repo is named after the
second kind.

So the field is gone. If trait conflict is ever wanted, it is a line in the
schema and a single grant gate — `p.traits.add` currently has four production
call sites (`people/careers.ts`, `people/minting.ts`, `events/effects.ts`,
`sim.ts`), so the gate is the real work, not the field.

### Nested tales — now on the view

`world.tales` was born, circulated, mutated and saved, and `SessionView`
carried no field for any of it, so `teller` and `bias` — "required, not
optional colour" per `schema/src/tale.ts` — reached nobody. `chronicle`, `frame`
and `looseSecrets` all surfaced; this did not.

`SessionView.tales` now carries what is actually circulating: `teller`,
`bias`, `form`, `text`, `about`, the year it began and how far the telling has
drifted. Two things are deliberately absent:

- **`accuracy`**, the authored answer to how much of an account is true. The
  game never adjudicates between contradicting accounts in its own voice, and
  a client handed the answer key could sort them by truth. A test asserts the
  view never carries it, and fails if someone adds it back.
- **`claims`**, for a duller reason: they are authored against a slot `Target`
  and mean nothing until resolved against the cast the tale's event fired
  with, which circulation state does not carry. That is real work, not a field
  to copy.

**The instrument that was missing.** Every unit test passed throughout, and so
did the digest, because nothing was broken — the layer worked perfectly and
was invisible. Only "does it reach the player, in a run" catches that, so
`tales.slow.test.ts` now asks it: 18-26 accounts circulating at 2042, all 32
authored tales reached across eight runs, and at least one event showing the
player two accounts that disagree.

One note on method, since it cost a detour: the first measurement of this
returned **zero tales in every run**, which looked like the layer was dead
rather than merely unseen. The probe had passed `autoResolve: true` to
`newGame`, which takes `decider: 'ask' | 'chronicler'` — the unknown key was
ignored, the default parked the run on the first decision, and `advance(1000)`
turned about four years. A measurement harness is code, and a startling number
is a reason to check the harness before the game.
