# CLAUDE.md

Entry point for Claude Code in this repository. Read this first; it routes you to
the one other file your task actually needs. Codex starts at `AGENTS.md` and
discovers the same project skills through `.agents/skills`; their canonical
instructions remain here under `.claude/skills` so the two agents cannot drift.

**Eldritch Dynasty** is a text-based generational strategy game: 1,000 years,
~40 generations, one bloodline. The player is not a character — they are the will
of a family. They never fight, never explore and never speak a line of dialogue.
They decide **who marries whom**, **who is spent**, **what gets written down**,
and what each child is called.

> In year 1042 an ancestor signed something. In 2042 the other party comes to collect.

**Status:** pre-production. Simulation, content pipeline, authoring tool and
desktop shell all work, and the game is playable end to end — `npm run play`,
written against `core/src/session.ts` and nothing else. It opens on the signing
(§3), runs the docket in all its kinds, the table, the tree and the chronicle,
and closes in 2042 on one of five endings chosen by reading the book the player
wrote.

---

## The one thing to know

**This codebase fails by doing nothing.** Nothing throws. A house that quietly
goes extinct by 1150, a chronicle that stops updating, an effect whose `case`
returns without acting, an event that never fires in any run — every one of them
looks exactly like a working simulation from the outside.

So: a test that asserts a function returns is worth almost nothing here. Assert
the *shape of a healthy run*. Grep for a schema field before assuming something
reads it — `onEmployerDeath: 0 refs in core` is the whole bug report.
[docs/FAILURES.md](docs/FAILURES.md) is the catalogue of the ones that shipped.

---

## Where to look, by task

Load the least you can. Do not read all of these.

| Task | Read |
|---|---|
| Anything at all | this file |
| The full rulebook, invariants, gaps | [AGENTS.md](AGENTS.md) |
| Find code / add a verb, phase, rule, field | [ARCHITECTURE.md](ARCHITECTURE.md) — map + a recipe per change |
| Author or edit content | [docs/VOCABULARY.md](docs/VOCABULARY.md) + [packages/content/AGENTS.md](packages/content/AGENTS.md) |
| Understand *why* something is shaped that way | [docs/FAILURES.md](docs/FAILURES.md) |
| Add content in bulk, or touch a frequency weight | [docs/BALANCE-LOG.md](docs/BALANCE-LOG.md) — what is built, and what every drop cost the tiers |
| Game rules (the authority) | [DesignConcepts/eldritch-dynasty-concept-brief.md](DesignConcepts/eldritch-dynasty-concept-brief.md) |
| The world content is set in | [Background/eldritch-dynasty-world.md](Background/eldritch-dynasty-world.md) — §23 pre-commit checklist, §24 what is already fixed |
| Work inside one package | that package's own `AGENTS.md` |
| What is not built yet | [the issue tracker](https://github.com/JamesFlames/EldritchDynasty/issues), one issue per system, in build order |

`docs/VOCABULARY.md` is **generated** (`npm run gen:docs`) and covers every
effect, condition, filter, slot role, purpose, phase and validation rule. Read it
instead of opening the schemas.

**For anything that exists, the code is the spec.** Three prose specifications
have been deleted from this repo for drifting from working code. Do not write a
fourth. Design for what does *not* exist yet lives in the issue tracker.

---

## Commands

A fresh session on the web installs dependencies and warms the content cache
before you get here — `.claude/hooks/session-start.sh`, registered as a
SessionStart hook. Locally it does nothing; you already have `node_modules`.

```bash
npm install

# Timings measured on a four-core container. Scale them, do not trust them flat.
npm run check        # typecheck (incl. Vue templates) + validate content + test.
                     # ONE command before you claim anything works. ~9 min.
npm run test:fast    # ~27s — the fix-and-rerun loop. Skips the *.slow.test.ts
                     # suites, which play whole games; lanes.test.ts fails the
                     # build if one of those turns up in this lane.
npm test             # everything: 1,085 tests in 83 files, ~7 min
npm run typecheck    # tsc over packages, then vue-tsc over the editor's and the
                     # client's templates
npm run validate     # 28 content rules; exits non-zero on any error. An error
                     # names the file it is in: `events/rites.yaml → event:the_drowning`

npm run dev          # authoring tool at localhost:5173
npm run play         # the game at localhost:5174. Both run at once, on purpose
npm run shell        # the same tool inside the Electron shell
npm run shell:preview                 # build the editor, then run the shell against dist
npm run smoke --workspace @ed/shell   # boot the shell, assert the renderer mounted, exit

npm run harness -- 16 1000            # 16 headless thousand-year runs, with balance numbers
npm run digest  -- 8 400              # fingerprint 8 runs; diff the block across commits
npm run gate                          # every gate — what CI will say, in one command
npm run gates   -- fire-rate          # one of them on its own, when you know which
npm run gate:drag -- 200 1000 0 1 2 4 # the fecundity death-spiral sweep (issue #26)
npm run gate:blood -- 6 1000          # does the marriage decision move the blood (issue #41).
                                      # PLAYS the Match by policy; the others let the chronicler
npm run gate:ladder -- 12 1000        # does the ladder charge the man climbing it (issue #41).
                                      # Two played columns, one verb apart. Also in `npm run gate`
npm run gate:bearing -- 84 1000       # is bearing a moral or a tax (issue #45)? Three played
                                      # columns, POOLED and cut in three by the reading itself
npm run lint:prose                    # advice, never a gate
npm run gen:loci                      # regenerate loci.yaml
npm run gen:docs                      # regenerate docs/VOCABULARY.md from the schemas
```

`npm run digest` is how you **prove a refactor changed nothing**: run it before
and after. If the block moves, the change was not a refactor — and since each
year phase draws from its own RNG stream, a block that moves points straight at
the system that moved it.

`loci.yaml` and `docs/VOCABULARY.md` are **generated**. Never hand-edit either.

CI (`.github/workflows/check.yml`) runs typecheck → validate → test →
`npm run gate`, then prose lint as annotations only. The gate step runs
everything in `GATES` rather than a list of names, because the list used to be
kept by remembering and gate 2 was left off it.

---

## Layout

```
packages/
  schema/    Zod schemas + the types they infer. THE SINGLE SOURCE OF TRUTH.
  core/      Pure simulation. Zero DOM, no filesystem, seeded RNG, deterministic.
  content/   Authored YAML: events, ages, arcs, characters, careers, spellbooks, loci.
  editor/    Vue 3 + Vite authoring tool. Imports `core` directly.
  client/    Vue 3 + Vite game. `GameSession` is the only thing it can see.
  shell/     Electron wrapper. Owns the window and the disk. Owns no rules.
```

Workspaces, TypeScript strict (`noUncheckedIndexedAccess` on), ESM throughout,
path aliases `@ed/schema`, `@ed/core`, `@ed/content`.

`packages/schema` is the only definition of what an event is. The editor
validates against it, the game loads against it, CI checks the whole content
directory against it. **Never write a second one.** The editor imports `core`
directly and never reimplements simulation logic — that is what makes preview
trustworthy.

### The model, in one paragraph

Authored YAML is loaded into a **`ContentBundle`**, indexed once into a
**`Content`**, and never changes again during a run. A **`WorldState`** holds
everything the run has caused and is the only thing that mutates. A **`SimCtx`**
is the pair plus the locus table and the names already spoken for. A **year** is
an ordered list of named **phases**, each taking `SimCtx` and its own RNG stream.
A **`GameSession`** is the narrow surface a client uses. A **`SavedGame`** is the
whole world as plain, validated data (`SAVE_FORMAT` is 7).

### The year

`stepYear` is a clock; the year itself is a table in `core/src/year/phases.ts` —
[ARCHITECTURE.md](ARCHITECTURE.md#the-year) lists the twenty phases in order,
with what each must run after. Each draws from `streamFor(world, phase.name)`,
derived from `(seed, year, name)`, so inserting a die roll in one phase does not
move any other phase's numbers. **A phase's name is part of the save in all but
name: renaming one reseeds it.** That is fine — it is a new system — but it is
not cosmetic.

### The client surface

`GameSession` is the whole of it: `advance`, `choose`, `name`, `order`, `found`,
`view`, `epilogue`, `save`. The signatures are in `core/src/session.ts`, which
is short, and `packages/client` is written against it and nothing else.

Never reach into `ctx.world` from a client. If `session.ts` cannot express what
you need, the missing thing is a verb *there* — four were added while the slice
was built, and `packages/client/src/lib/verbs.test.ts` fails until a new one
reaches something the player can click.

---

## Invariants

The full text, with the reasoning and the bug behind each, is in
[AGENTS.md](AGENTS.md). These are not style preferences — every test in the suite
exists because the opposite of one of these shipped. The enforcement points are
greppable:

```bash
grep -rn "INVARIANT " packages --include=*.ts     # 32 of them
```

1. **`canExpress` is the only Madness gate.** Mad if and only if capable of
   expressing Eldritch Power: male, with a non-null X-linked font. No
   `if (female) madness = 0` clamp, ever — a clamp is a thing a later feature
   bypasses by accident; an unentered branch stays unentered.
2. **`PersonStore.kill` is the only death gate.** Plague, duel, madness overflow,
   an authored `status` effect — all of it goes through `kill()`.
3. **The Narrator does not die.** Daveed Gearithy's death is *redirected*: he
   becomes the house's guardian spirit and decides from that day on. He is the
   player, and the player has been him the whole time. Status `guardian`, never
   `alive` again; still castable forever via the `guardian` slot role.
4. **Two magics, two rules.** Eldritch Power is given, X-linked,
   family-exclusive; men express it, women carry it and never express it; it may
   never become reliable or schedulable. Mystic magic is *taken from books*;
   women practise only the four **Threshold** affinities, men all eight, and it
   carries no Madness consequence. `canLearn()` and `eldritch()` share no code.
5. **The verbs are enumerated, never scripted.** `Effect`, `Condition`, `Filter`,
   `Target`, `Decider` and `SlotRole` are closed unions, and every site handling
   one ends in `assertNever`. Never end such a switch or `in`-chain with a
   permissive default: a condition that falls through *passes*, and the event
   carrying it then fires unconditionally for a thousand years.
6. **Derived state is not storage.** `PhenotypeCache` is recomputed whenever the
   year moves. Anything life does to a person goes in `Person.acquired`. Writing
   into the cache appears to work and is gone by next spring.
7. **Events and people ration separately.** `world.frequency` for events,
   `world.characterFrequency` for minted people.
8. **Determinism is per-world, not per-module.** Id sequences live on
   `WorldState.counters`, never at module scope — a module-level counter is
   shared by every simulation in the process. Never introduce `Math.random()`
   into `core`.
9. **The docket blocks the clock.** `stepYear(ctx, false)` parks choice events
   and Record blocks on `world.pendingDecisions` and does not advance the year.
   Only `decidedBy: player` dockets; `chance`, `state` and `party` resolve
   themselves. `decideBranch` is the one evaluator and returns a branch on
   *every* path; `commitOutcome` is the one place an outcome is applied,
   including for `autoResolve`.
10. **Attributes are an open list; sex is a modifier on them.** An attribute is
    six loci in `gen-loci.mjs` plus a row in `attributes.yaml` — no engine
    change. Dimorphism is data, in points, male minus female, applied as ±half.
    Anything mapping an attribute onto a real quantity centres on
    `ctx.genetics.expected`. A cap is not an effect: measure whether the ceiling
    ever binds.
11. **A declared field that nothing reads is a bug, not a stub.** If you add an
    `Effect` kind, the case does the work or the case does not exist.
12. **Nothing takes the seal out of the main house.** Any code moving people
    between halls checks `castSlots.includes('head')` first.
13. **The world reacts, and says so.** `assize.ts` is the only rubber band, it
    is explicit, and every response writes a chronicle line naming who did
    what. It moves money, standing, loyalty, grievance and mortality — never
    genetics, never Madness, never an authored outcome. A hidden nudge is a lie
    the player can feel and cannot name.
14. **The ladder is measured, never stored as an achievement.** `ascension.ts`
    reads §22's gates every year off people and content; `world.ascension.best`
    is the only thing remembered, because a family that made a Hierophant once
    made one. `eldritchPower` normalises onto §22's 0–100 scale from the locus
    table — invariant 10's rule, applied to the ladder.
15. **A hall is not a house.** Cadet branches are households *inside* the
    player's house, keyed by `membership.branch`. Crowding is per hall. Moving
    someone closes one membership record and opens another — two open records
    puts them in two halls at once.

---

## Adding things

**Every recipe is in [ARCHITECTURE.md](ARCHITECTURE.md#recipes)**, step by step:
an event, a two-beat scene, an arc, an attribute, an `Effect` / `Condition` /
`Filter` / `Decider` kind, a year phase, a validation rule, a field on the world.
Go there for the steps. These are the traps in them, which is what this file is
for:

- **A declared kind that nothing dispatches typechecks forever.** Add the schema
  variant *and* the branch in `core`, plus a test that the thing changes
  something. The compiler will demand the branch; nothing demands that it works.
- **A field on the world must reach the save format.** `WorldState` **and**
  `createWorld` **and** `SavedGameS` **and** `saveGame`/`loadGame`. Skipping the
  last two does not fail — it makes the field reset silently on load, which looks
  exactly like a subsystem that stopped working two centuries in.
- **A validation rule needs a bundle it must REJECT**, not only one it passes. A
  rule nobody has seen fail is indistinguishable from a rule that cannot fail.
- **An event needs exactly three distinct purposes and a slot for every
  `{TOKEN}`.** Run `npm run validate`. Bodies over five sentences go through
  `rothfuss-prose`.

Frequency (`common | uncommon | rare | mythic`) is a **rationing tier, not a
weight synonym**: it drives caps, cooldowns, the drought curve, chronicle
typography, folklore and whether a Record block is required. Tune the profile and
measure in the harness; never tune by nudging a per-template `weight`. What that
costs the other tiers is in [docs/BALANCE-LOG.md](docs/BALANCE-LOG.md), measured.

Content **IDs are `snake_case` and are never renamed after commit** — save files
reference them. Slot names are not save-referenced and may be renamed.

---

## Tests

Grouped by the kind of failure they catch rather than by module — the count
and what the run costs are in the command block above.

- **`*.slow.test.ts` plays whole games** — the suites that assert the shape of a
  healthy run. `npm run test:fast` skips them and costs 26s. A new suite that
  plays a whole game takes the `.slow` suffix; one that does not, does not, and
  `lanes.test.ts` now fails the build either way. It had to: for months the rule
  was only asked for, seven suites ignored it, and the lane cost 100s while every
  one of them passed.
- **The slow lane's floor is its longest FILE**, because vitest parallelises per
  file — `ledger` at 162s and `branches` at 115s each held the whole suite up on
  their own, and are split by test. Never by seed range: these are batch
  statistics, and taking seeds out of a batch changes what it claims.
- **Build the state you mean.** `core/src/testing.ts` gives `testWorld`, `place`,
  `marry`, `beget`, `phase`. Simulating four hundred years to reach a widow is
  not a test, it is a wait.
- **Never pin a test to one seed reaching one state.** Two did, and both broke
  the day the RNG streams were split, on behaviour that was demonstrably intact.
  Assert the mechanism — "standing falls as well as rises", not "six seeds end on
  six tiers".
- **A batch claim goes through `expectRate` or `expectMean`** (`core/src/testing.ts`),
  never a bare `toBeGreaterThan` on a rate or an average. They assert the claim
  AND that the batch can carry it — at least two standard errors of margin —
  and fail with the batch size that would. Five tests have now broken on
  commits that changed nothing they measured, because adding ANY template
  re-rolls which scene wins every draw for a thousand years. A thin margin is
  invisible until it is spent; this makes it a build failure with a
  prescription instead of a mystery.
- **A gate is a function over a bundle, not a script.** Every gate in
  `tools/gates.ts` returns its verdict so `gates.test.ts` can hand it content it
  must reject.
- **Measure fire rates when you touch arcs, slots or selection.** An event that
  never fires is not in the game, and nothing will tell you.

[docs/TEST-COVERAGE.md](docs/TEST-COVERAGE.md) is the coverage survey, what it
found, and why line coverage reads high on a dispatch chain nobody has taken a
branch of.

---

## Prose, and the three skills

They do not overlap. Reach for the right one:

- **`eldritch-story`** — architecture and the frame. What a phase is *for*, how
  an Age pays its three debts, escalation stages, antagonist tiers, endings, the
  Ledger. Use it *before* writing content.
- **`rothfuss-prose`** — sentences, for **events**. Bodies, outcome text,
  chronicle entries, character blurbs. Plain and concrete, no archaisms. The
  contract every body over five sentences is held to.
- **`lovecraftian-prose`** — sentences, for the **frame and myth layer**.
  Elevated Dunsanian register, mythic distance, the incomprehensible described by
  its effects.

**The register split is load-bearing.** Dunsanian diction in an event body is
register bleed, and so is plain reportage in an interlude.

The game never adjudicates between two contradicting accounts in its own voice.
There is no narrator who knows the truth — there is only Daveed, and he is not
neutral. No nested tale is neutral either: every one names a `teller` and a
`bias`, and CI fails a build where two accounts of one event agree on everything.

---

## Working style

- **Run the harness before claiming a balance change works.** One playthrough is
  8–12 hours; batch simulation is the only viable balance method.
- When a test fails, work out whether the test or the code is wrong. Several
  "failures" here were correct behaviour asserted incorrectly — rare upward font
  mutation is *designed*.
- **Prefer fixing the model over special-casing the symptom.** Nearly every bug
  here has been structural: children in the wrong household, widows still married
  to dead men, cast slots never refilled, counters at module scope.
- `npm run typecheck:editor` (vue-tsc) is not optional. Plain `tsc` cannot read
  `.vue` templates, and a template error is always silent: the click lands and
  nothing happens.
- In the editor, **edit `store.bundle`, read `props.content`.** Editing
  `content.events` works for most events and silently loses the edit for any
  event a `next` chain touches.
- **Merging:** AGENTS.md records standing authorization to fast-forward `main`
  and push as soon as `npm run check` is green on a feature branch — no PR, no
  prompt. That lapses if `main` has moved since the branch forked or the check
  does not pass; ask then.

## Do not

- Add a Madness path that skips `canExpress`, or a death path that skips `kill()`.
- Add a second place that applies an event outcome. Everything goes through
  `commitOutcome`.
- Give a person a second open membership record.
- Put an id counter, or any mutable simulation state, at module scope.
- Make Eldritch Power reliable, schedulable, or manifest-on-demand at any tier.
- Spawn people outside `core/src/people/minting.ts`.
- Hand-edit `packages/content/loci.yaml` or `docs/VOCABULARY.md`.
- End a switch or `in`-chain over a closed union with a permissive default.
- Add a field to `WorldState` without adding it to the save format.
- Reach into `ctx.world` from a client.
- Keep a hand-written copy of a closed union anywhere — the editor's forms are
  generated off the Zod schemas for exactly this reason.
- Let the game adjudicate between two contradicting accounts in its own voice.
  There is no narrator who knows the truth — there is only Daveed, and he is not
  neutral.

---

## What is built, and what is not

The built/not-built inventory, and the measured record of what every content
drop did to the frequency tiers, is **[docs/BALANCE-LOG.md](docs/BALANCE-LOG.md)**.

Read it before adding content in bulk or touching a weight. Its headline, so
that nobody has to open it to learn the thing that has bitten five times: **the
size of a tier's pool is not what `frequency:` reports, and a tier's share of
the year is not a property of the tier** — it is that tier's weight times how
many templates carry it, over the same product across every other tier. Twenty-
eight new COMMON templates ration uncommon and rare without one line of their
own content changing, and nothing anywhere reports it.
