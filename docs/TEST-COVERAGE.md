# TEST COVERAGE

Measured 2026-08-20 on `main` with `@vitest/coverage-v8` over the full suite —
45 files, 535 tests, 345s under instrumentation — plus purpose-built probes for
the two things a coverage tool cannot express: which authored *outcomes* a run
can actually reach, and which of the condition and effect vocabularies have
ever been evaluated.

The house thesis is that **this codebase fails by doing nothing**
([FAILURES.md](FAILURES.md)). Line coverage is a poor instrument for that: a
statement executes just as happily when it is wrong. So the numbers below are
the map, and the proposals are drawn from what the map shows *is never
reached at all* — because in a codebase that fails silently, an unreached
branch and a broken one look identical from the outside.

It also lies in the other direction. Proposal 3 works through a file that
reports 84.9% statement coverage while a third of its predicates have never
been evaluated once — the dispatch chain is single-line `if`s, so v8 marks
them covered for being *asked*, not for being *taken*. Read the numbers below
as a starting point for questions, not as answers.

---

## The numbers

| Package | Lines | Note |
| --- | --- | --- |
| `schema` | **95.1%** | 2284 / 2401 |
| `core` | **86.8%** | 4907 / 5656 |
| `content` | 100% | the loader only; the YAML is not "lines" |
| `editor` | **0%** | 4440 lines, no test has ever imported one of them |
| `shell` | **0%** | 145 lines |
| **Total** | **56.95%** | branches 86.17%, functions 86.72% |

The 56.95% headline is mostly the editor dragging an otherwise well-tested
simulation down. Excluding `editor` and `shell`, the number is **89.3%**, and
that is the honest figure for the engine.

Where the engine's remaining gaps are:

```
core/src/tools        34.5%   CLI entrypoints — see proposal 7
core/src/events       91.4%   the vocabularies — see proposals 3 and 4
core/src/people       97.8%
core/src/year         97.2%
core/src/genetics     99.4%
```

**What is genuinely good, and should not be traded away for a coverage
number:** the `*.slow.test.ts` suites. Eighteen suites that simulate centuries
and assert the *shape* of a healthy run are the only instrument that catches a
house which quietly empties, and they earn their runtime. Nothing below
proposes weakening them. (`vitest.config.ts`'s header still says "Nine of them
cost ninety seconds"; there are eighteen now. Worth a one-line fix while
someone is in there.)

---

## Proposals

Ordered by what they would have caught, not by how much coverage they move.

### 1. Nothing measures whether an authored *outcome* is reachable

`gates.ts` gate 4 measures how often each of the **48 events** fires. The
content declares **92 `(event, choice, outcome)` triples**, and nothing
anywhere measures those.

A probe over 100 seeded 1000-year runs — the same sample size gate 4 uses, so
100,000 simulated years — finds **one outcome that never resolves once**, on an
event that fires in 85% of runs:

```
the_vessel_rite / take_the_gifted_one -> uncapped     0% of runs
```

An authored branch with its own label, its own `madness: +35` consequence and
its own clause reveal has never been shown to anyone. (The clause survives —
`take_the_safe_one` reveals it too — so gate 7 correctly reports nothing wrong.
Nothing else does either.)

What makes it dead is a **compound** gate, and that is the whole argument for
measuring it at runtime. The choice carries
`requires: { slot: VESSEL, attr: mind, op: gte, value: 40 }`, checked at ask
time by `choiceAvailability`. Taken alone the threshold is reachable: across
50,846 sampled adult person-years, 513 (1.0%) had `mind >= 40`, topping out at
68.8. But the branch needs that 1% person to be the one cast as VESSEL — a
`family_member`, 14 or older, unrelated to the ASCENDANT — in the specific
year the rite fires. The joint probability is effectively zero, and no static
analysis can see it. `outcomes/weights` passes this content, correctly: nothing
about it is statically impossible.

Sizing matters, and getting it wrong is easy. At **30** runs this same probe
also flagged `what_came_up_the_river_road / hold_the_gate -> driven_off`. At
100 runs that outcome resolves in **11%** — it is simply the rarest thing in
the game, not a dead one. The rarest *resolving* outcome sits at 4%
(`the_drowning / full_count -> lost`), so a floor anywhere under ~2% is safe
and a 30-run sample is not. Run it at 100 like gate 4.

**Proposal:** a gate 8, `npm run gates -- outcome-reach`, in `tools/gates.ts`,
built the same way as gate 4 and reading the same source — `world.decisionLog`
already records `{event, choiceId, outcomeId}` for every commit, so this needs
no new instrumentation at all. Fail on any declared triple resolving in 0% of
100 runs; print the rarest ten the way gate 4 does. Add it to `check.yml`
beside the other two.

This is cheap now, at 48 events and 92 outcomes. It is the check that stops
being writable by hand at four hundred.

### 2. Half the content-validation rules have never been proven to catch anything

`rules.ts` is 22 rules raising issues from **72 call sites**. **35 of those 72
(49%) never execute in the test suite** — the rule runs, finds the shipped
content clean, and returns. Its failure path has never fired.

Five rules have *no* exercised failure path at all:

| Rule | Failure paths, none exercised |
| --- | --- |
| `frame/shape` | 8 |
| `frequency/obligations` | 6 |
| `slots/arc-bound` | 2 |
| `event/shape` | 2 |
| `traits/mystic-restriction` | 1 |

And these are partly exercised: `arcs/wiring` 8/13 dead, `refs/known` 4/8,
`checks/wiring` 3/5, `arcs/flags` 2/3, `arcs/inline` 2/3, `slots/references`
2/3, `ages/coverage` 1/2.

This matters more here than in most codebases, because `npm run validate` is
what stands between an author and a broken build, and a validator that has
never rejected anything is indistinguishable from one that cannot. `frame/shape`
is the sharpest case: AGENTS.md says a frame event "carries no effects, Record
block or rumour by construction (`frame/shape` fails the build otherwise)".
Nothing has ever demonstrated that it does.

**Proposal:** `rules.test.ts` already has the right shape — 25 negative
fixtures that mutate a bundle and assert one rule catches it. Extend it to
cover the 35 dead sites, starting with the five rules that have nothing. Each
is a handful of lines against `runRule`, and the file's existing helpers make
them nearly mechanical.

### 3. Nine condition kinds have never been evaluated, by a test or by content

`conditions.ts` declares 28 condition kinds, 25 of them real predicates (the
other three are the `all`/`any`/`not` combinators). Nine appear in **no content
file and no test**:

```
clausesRecovered   familyAny   familySize   inRegency   hasExpressingHead
grudgeAgainstUs    ageRegister   ageStacked   ageNamed
```

They are implemented in `core/src/events/conditions.ts` and they are authoring
vocabulary. The first time someone writes `{ hasExpressingHead: true }` into a
YAML file, that line will be the first time the expression has ever been
evaluated in the history of the project.

**Line coverage cannot see this, and it is worth knowing why.** The evaluator
is a chain of single-line guards:

```ts
if ('familySize' in c) return compare(w.people.household(...).length, ...);
```

v8 counts that statement as covered as soon as *any* condition is evaluated,
because the `in` test runs every time. So `conditions.ts` reports 84.9%
statements while nine of its twenty-five predicates have never once been
*taken*. Only the multi-line kinds — `familyAny`, `hasExpressingHead`,
`grudgeAgainstUs`, `ageRegister` — show up as uncovered at all. If you read
this file's coverage number and stopped, you would conclude it was fine.

**Proposal:** a truth-table suite over the condition vocabulary, in the shape
`arc-memory.test.ts` already uses for `arcFlag` — build the state with
`testWorld`/`place`/`marry`, assert true, flip one fact, assert false. One
table, one case per kind, no century simulated. The `assertNever`
fallthroughs at `conditions.ts:112` and `:154` are also unreached, which means
nothing proves a malformed condition currently fails *loudly*.

### 4. Two effect verbs have never executed, and one of them looks wrong

`EffectS` declares 22 effect kinds. Shipped content uses 17. Of the five
unused, `career` and `spellbook` have unit tests and `schedule` is reached
through desugared `Outcome.next`; **`rumour` and `recast` have neither a test
nor a use in content** — `effects.ts:98-104` and `:163-166` never run. Unlike
the condition chain in proposal 3, these are `switch` cases with multi-line
bodies, so the coverage number means what it says.

`rumour` is a subtle one worth spelling out. Content *does* seed rumours, but
through the declarative event-level block (`event.ts:366`), handled separately
at `effects.ts:318`. The effect *verb* — `{ kind: rumour, op: seed | feed |
correct }` — is what has never run, and `correct` is the only path in the
engine that removes a rumour from the world. Nothing has ever demonstrated a
rumour can be retracted.

`recast` is worth reading now rather than the day someone authors it:

```ts
case 'recast': {
  // Free the slot's occupant from the role so `maintainCast` refills it.
  const p = w.people.get(fill[eff.slot] ?? '');
  if (p) p.castSlots = p.castSlots.filter((s) => s !== 'head');
  break;
}
```

The comment says "the role"; the code says `'head'`, hardcoded, regardless of
what role `eff.slot` carries. `castSlots` holds role names — `'head'`,
`'the_match'` — so `{ kind: recast, slot: VESSEL }` on a `family_member` slot
frees nothing it meant to, and would strip the seal from whoever stood there
if they happened to hold it. Nothing in the repo would tell you. One unit test
would.

**Proposal:** one small test per unexercised effect verb and op, asserting the
world change it claims. Same argument as proposal 3, same cost.

### 5. A whole mechanic is wired up and inert — coverage is what found it

`people/library.ts:117-121`:

```ts
/** Scholar's "faster study": a career's `studySpeed` multiplies the years content schedules a `gain` after. */
export function effectiveStudyYears(ctx, p, def) { ... }
```

**It has zero callers.** Following the thread:

- `spellbooks.yaml` sets `studyYears` on **11 books** (one at 6 years).
- `careers.yaml` gives the Scholar `studySpeed: 0.7`.
- `effectiveStudyYears` is the only reader of either. Nothing calls it.
- The docstring says the years content "schedules a `gain` after" — i.e. via
  the `schedule` effect. **No content file uses `kind: schedule`.**
- `schedule` writes `world.scheduled`; the only reader is `forcedCandidates`
  in `selection.ts:224-240`, and **its loop body never executes** in the whole
  suite. So `SCHEDULE_PATIENCE`, the five-year requeue, and the
  remove-before-resolve fix that `selection.ts:36-38` documents as a bug they
  already shipped once — none of it has ever run.

Five artifacts, one unbuilt feature, no test, and nothing in the repo says so.
Spellbook study is currently instantaneous and the Scholar's defining perk does
nothing. This is exactly the `ArcInstance.localFlags` pattern AGENTS.md
describes, and it is live right now.

**Proposal:** decide whether delayed study is in or out. If in, wire it and
test the `schedule` → `forcedCandidates` round trip end to end (schedule an
event, advance past it, assert it arrives; schedule one that cannot cast,
assert it requeues and then gives up at 40 years). If out, delete
`effectiveStudyYears` and `studySpeed` so the content stops lying about them.
Either way the round-trip test should exist, because `schedule` is live
vocabulary an author can reach for tomorrow.

### 6. The read/view API — what a UI actually calls — is the least covered part of the engine

The simulation is at 89%. The façade over it is not, and the gaps are
systematic rather than scattered:

| Never called by any test | |
| --- | --- |
| `GameSession.declineHand` | a real player action — "the house waits for a better year" |
| `hallOf` | `session.ts:328` |
| `branchReport` | `branches.ts:358-370` |
| `frequencyReport` | `selection.ts:247-259` |
| `GameSession.send` | `session.ts:119-126` — the mission dispatch path |
| `store.promote` | `store.ts:119-123` — the hot/cold tier mechanism |
| `heldBooks`, `loseLibraryCopy` | `library.ts:31-32, 47-48` |
| `describeDecision` | `replay.ts:61-75` — what the harness prints to bisect a run |

`session.ts` function coverage is 78.9%: roughly one in five functions on the
player-facing API is never called. These are the functions the editor's
Instruments tab and any future client depend on, and several of them
(`branchReport`, `frequencyReport`, `describeDecision`) are *diagnostics* —
the code you reach for when something is already wrong, which is the worst
possible time to discover it throws.

**Proposal:** one `session-api.test.ts` that drives a short game through the
public façade — `newGame`, `advance`, `choose`, `send`, `declineHand`,
`record`, `name`, `view`, `save` — and asserts each returns a coherent view.
Fast, no century, and it pins the contract the UI is written against.

### 7. Gate 2 exists and nothing runs it

`tools/gates.ts` defines four gates. `check.yml` runs two.

- `clauses` (7) — in CI ✅
- `fire-rate` (4) — in CI ✅
- `purposes` (6) — not in CI, but covered by `npm run validate`, which is ✅
- **`slot-fillability` (2) — run by nothing.** Not CI, not a test, not another
  script.

It was written for issue #22 to catch a template the ambient pool starves
before gate 4 notices. It has never run in CI. Its only dependency,
`TEST_FAMILIES` in `tools/testFamilies.ts`, shows **0% function coverage** —
all six fixture builders are unexecuted.

Separately, `gate:drag` — the death-spiral gate guarding the fecundity
constant, described in `package.json` as the thing to run "before ever moving
that constant" — is 21% covered and manual-only.

**Proposal:** add `npm run gates -- slot-fillability` to `check.yml`, and give
the gate bodies themselves a test that feeds each one a deliberately broken
bundle and asserts it returns `false`. A gate that cannot fail is not a gate,
and right now nothing distinguishes the two.

### 8. The editor is 0%, and its two node-testable modules need no new infrastructure

4440 lines, no test has ever imported one. Most of it is Vue components and
testing those needs `jsdom` and `@vue/test-utils`, neither installed — a real
decision, not a quick win.

But two modules under `editor/src/lib/` are ordinary TypeScript that
`vitest.config.ts` would pick up today:

- **`diff.ts`** — 65 lines of hand-rolled LCS, zero coverage. Pure functions
  over two strings; a table-driven test is fifteen minutes. It is what the
  author reads before writing to disk, per issue #21.
- **`store.ts`** — 225 lines of comment-preserving YAML write-back. It patches
  `doc.setIn` on a live `yaml.Document` and writes files. `import.meta.glob`
  in `content.ts` is the only vite-ism in the way, and it is behind one import.

While reading these: **the two copies of the write-path guard have drifted.**
`editor/vite.config.ts` checks the same thing twice, differently.

```ts
// line 32, the GET path — correct
if (target !== CONTENT && !target.startsWith(CONTENT + '/')) throw new Error('path escapes content root');

// line 53, the PUT path — weaker
if (!target.startsWith(CONTENT)) throw new Error('path escapes content root');
```

Without the trailing separator, a sibling directory passes:

| `path` | resolves to | strict (GET) | weak (PUT) |
| --- | --- | --- | --- |
| `events/ok.yaml` | `packages/content/events/ok.yaml` | allow | allow |
| `../content-x/a.yaml` | `packages/content-x/a.yaml` | **block** | **ALLOW** |
| `../../etc/passwd` | `<repo>/etc/passwd` | block | block |
| `/etc/passwd` | `/etc/passwd` | block | block |

The write path is the weaker of the two. `shell/src/main.mjs:72,86` carries a
third and fourth copy of the same check.
It is a dev-server and local-shell surface, not a remote one, so the severity
is modest — but it is a guard nobody has tested, written out four times, and
already inconsistent.

**Proposal:** lift the check into one exported `resolveContentPath()` and test
it against a table of escapes (`../`, absolute paths, `content-x` siblings,
symlink-ish shapes). Then `diff.ts`. Defer the Vue components until someone
wants to spend the `jsdom` dependency.

---

## Suggested order

1. **Proposal 5** — a shipped mechanic is inert *right now*. Decide, then fix or delete.
2. **Proposal 1** — the outcome-reach gate. It has already found a dead branch no existing check can see, and is cheap at 48 events.
3. **Proposal 8's guard** — a four-times-duplicated check that has already drifted.
4. **Proposal 2** — the 35 dead validation paths, starting with `frame/shape`.
5. **Proposals 3, 4, 6, 7** — vocabulary truth tables, the façade suite, gate 2 into CI.

## Reproducing the measurement

```
npm i --no-save @vitest/coverage-v8@2.1.8
npx vitest run --coverage --coverage.provider=v8 \
  --coverage.include='packages/**/src/**' --coverage.exclude='packages/**/*.test.ts'
```

Coverage tooling is deliberately *not* added to `package.json`. It is a probe
to run on purpose when asking this question, for the same reason `digest.ts`
is not a checked-in golden: a coverage threshold in CI gets satisfied rather
than read.
