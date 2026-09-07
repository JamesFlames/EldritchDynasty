# CLAUDE.md

Entry point for Claude Code in this repository. Read this first; it routes you to
the one other file your task actually needs.

**Eldritch Dynasty** is a text-based generational strategy game: 1,000 years,
~40 generations, one bloodline. The player is not a character — they are the will
of a family. They never fight, never explore and never speak a line of dialogue.
They decide **who marries whom**, **who is spent**, **what gets written down**,
and what each child is called.

> In year 1042 an ancestor signed something. In 2042 the other party comes to collect.

**Status:** pre-production, and playable end to end — `npm run play`, written
against `core/src/session.ts` and nothing else. It opens on the signing, runs the
docket, the table, the tree and the chronicle, and closes in 2042 on one of five
endings chosen by reading the book the player wrote.

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
| The full rulebook — invariants in long form, tests, branches, gaps | [AGENTS.md](AGENTS.md) |
| Find code / add a verb, phase, rule, field | [ARCHITECTURE.md](ARCHITECTURE.md) — map + a recipe per change |
| Run something, land something, read CI | [docs/COMMANDS.md](docs/COMMANDS.md) |
| Author or edit content | [docs/VOCABULARY.md](docs/VOCABULARY.md) + [packages/content/AGENTS.md](packages/content/AGENTS.md) |
| Understand *why* something is shaped that way | [docs/FAILURES.md](docs/FAILURES.md) |
| Add content in bulk, or touch a frequency weight | [docs/BALANCE-LOG.md](docs/BALANCE-LOG.md) — what is built, and what every drop cost the tiers |
| Write or fix a test | [AGENTS.md](AGENTS.md#tests), then [docs/TEST-COVERAGE.md](docs/TEST-COVERAGE.md) |
| Game rules (the authority) | [DesignConcepts/eldritch-dynasty-concept-brief.md](DesignConcepts/eldritch-dynasty-concept-brief.md) |
| The world content is set in | [Background/eldritch-dynasty-world.md](Background/eldritch-dynasty-world.md) — §26 pre-commit checklist, §27 what is already fixed |
| Work inside one package | that package's own `AGENTS.md` |
| Work alongside other agents at the same time | [docs/PARALLEL.md](docs/PARALLEL.md) — lanes, claims, and what does not parallelise |
| What is not built yet | [the issue tracker](https://github.com/JamesFlames/EldritchDynasty/issues), one issue per system, in build order |

`docs/VOCABULARY.md` is **generated** (`npm run gen:docs`) and covers every
effect, condition, filter, slot role, purpose, phase and validation rule. Read it
instead of opening the schemas.

**For anything that exists, the code is the spec.** Three prose specifications
have been deleted from this repo for drifting from working code. Do not write a
fourth. Design for what does *not* exist yet lives in the issue tracker.

---

## Commands

The block below is the only place this repository states what a command costs.
Everything around it — how a session orients, what the landing does, how CI and
the janitor are shaped, and which commands answer a question nothing else can —
is in **[docs/COMMANDS.md](docs/COMMANDS.md)**.

```bash
npm install

# Measured on a four-core container, and perishable. Re-measure before quoting.
npm run check        # typecheck (vue-tsc too) + validate + test. ~30 min, and
                     # NOT the gates: landing on it broke main four times.
npm run land         # the landing: fetch, rebase, install, the whole set CI
                     # runs ON THAT head, push, wait for CI. AGENTS.md authorises it.
npm run verdict      # did CI answer? green / red / pending / ABSENT (not a pass)
npm run test:fast    # ~59s, the fix-and-rerun loop. Skips the *.slow.test.ts suites;
                     # lanes.test.ts fails the build if one turns up in this
                     # lane, or if a suite drives a batch through a tools
                     # module without declaring it.
npm test             # everything: 1,961 tests in 132 files, ~30 min
npm run typecheck    # tsc over packages, then vue-tsc over the editor's and the
                     # client's templates. ~22s
npm run validate     # 32 content rules; exits non-zero on any error. An error
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
npm run gate:drag / :blood / :ladder / :bearing   # the four measured sessions
npm run corpus                        # warm the run corpus. CI caches it
npm run mutate -- assize --limit 20   # break code on purpose; list what no test noticed
npm run lint:prose                    # advice, never a gate
npm run gen:loci                      # regenerate loci.yaml
npm run gen:docs                      # regenerate docs/VOCABULARY.md from the schemas

npm run scoreboard                    # red rate on main, and which job went red
npm run cost                          # re-measure the figures above; --write applies them
npm run agents                        # who holds which issue, across every running session
npm run agents -- take 93 --paths packages/core/src/economy
npm run agents -- check               # anyone else writing my paths? Run before the long check
npm run agents -- release 93          # when it lands. See docs/PARALLEL.md
```

`loci.yaml` and `docs/VOCABULARY.md` are **generated**. Never hand-edit either.

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

The data model, the twenty year phases in order, and the client seam are in
**[ARCHITECTURE.md](ARCHITECTURE.md)** (`#the-model-in-one-paragraph`, `#the-year`). In brief:
authored YAML → a `ContentBundle`, indexed once into a `Content` that never
changes; a `WorldState` is the only thing that mutates; a year is an ordered
table of named phases, each drawing from `streamFor(world, phase.name)`, so
inserting a die roll in one phase does not move another's numbers — **a phase's
name is part of the save in all but name, and renaming one reseeds it.** A
`SavedGame` is the whole world as plain, validated data; `SAVE_FORMAT` is 11.

`GameSession` (`core/src/session.ts`) is the whole client surface: `advance`,
`choose`, `name`, `order`, `found`, `view`, `epilogue`, `save`. Never reach into
`ctx.world` from a client. If `session.ts` cannot express what you need, the
missing thing is a verb *there* — `packages/client/src/lib/verbs.test.ts` fails
until a new one reaches something the player can click.

---

## Invariants

Sixteen, and none of them is a style preference: every test in the suite exists
because the opposite of one of these shipped. **The long form — the reasoning,
and the bug behind each — is in [AGENTS.md](AGENTS.md#non-negotiable-invariants).**
Read that before changing anything one of these touches.

```bash
grep -rn "INVARIANT " packages --include=*.ts     # 52 of them, 33 outside the tests
```

1. **`canExpress` is the only Madness gate.** Male, with a non-null X-linked font. No `if (female) madness = 0` clamp, ever.
2. **`PersonStore.kill` is the only death gate.** Plague, duel, overflow, an authored `status` effect — all of it.
3. **The Narrator does not die.** Daveed Gearithy's death is *redirected*: status `guardian`, never `alive` again, castable forever.
4. **Two magics, two rules.** Eldritch Power is given, X-linked, family-exclusive, and never reliable or schedulable; Mystic is taken from books, women to the four Threshold affinities, and carries no Madness. `canLearn()` and `eldritch()` share no code.
5. **The verbs are enumerated, never scripted.** `Effect`, `Condition`, `Filter`, `Target`, `Decider`, `SlotRole` are closed unions ending in `assertNever`. A permissive default makes a condition *pass*.
6. **Derived state is not storage.** `PhenotypeCache` is recomputed each year; what life does to a person goes in `Person.acquired`.
7. **Events and people ration separately.** `world.frequency` for events, `world.characterFrequency` for minted people.
8. **Determinism is per-world, not per-module.** Id sequences live on `WorldState.counters`. Never `Math.random()` in `core`.
9. **The docket blocks the clock.** Only `decidedBy: player` dockets. `decideBranch` is the one evaluator and returns on every path; `commitOutcome` is the one place an outcome is applied.
10. **Attributes are an open list; sex is a modifier on them.** Six loci plus a row in `attributes.yaml` — no engine change. Dimorphism is data, in points. Centre on `ctx.genetics.expected`; a cap is not an effect.
11. **A declared field that nothing reads is a bug, not a stub.** The case does the work, or the case does not exist.
12. **Nothing takes the seal out of the main house.** Code moving people between halls checks `castSlots.includes('head')` first.
13. **The world reacts, and says so.** `assize.ts` is the only rubber band; it moves money, standing, loyalty, grievance and mortality — never genetics, Madness or an authored outcome — and every response writes a chronicle line naming who did what.
14. **The ladder is measured, never stored as an achievement.** `ascension.ts` recomputes §22's gates yearly; `world.ascension.best` is all that is remembered.
15. **A hall is not a house.** Cadet branches are households inside the player's house, keyed by `membership.branch`. Crowding is per hall; two open membership records puts someone in two halls at once.
16. **Every post is a man's.** `canHoldPost` is the only placement gate, and all three doors that write `Person.career` ask it. No `sex` field on `CareerDef`.

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

**The rules are in [AGENTS.md](AGENTS.md#tests)** — the whole list, with the
failure behind each. The four that decide how a test gets written here:

- **`*.slow.test.ts` plays whole games.** A suite that plays one takes the
  suffix; `lanes.test.ts` fails the build either way, including when a suite
  drives a batch through a `tools/` module without declaring it.
- **Build the state you mean.** `core/src/testing.ts` gives `testWorld`, `place`,
  `marry`, `beget`, `phase`. Simulating four hundred years to reach a widow is
  not a test, it is a wait.
- **Never pin a test to one seed reaching one state.** Assert the mechanism —
  "standing falls as well as rises", not "six seeds end on six tiers".
- **A batch claim goes through `expectRate` or `expectMean`**, never a bare
  `toBeGreaterThan` on a rate or an average. They assert the claim AND that the
  batch can carry it, and fail with the batch size that would.

[docs/TEST-COVERAGE.md](docs/TEST-COVERAGE.md) is the coverage survey, what it
found, and why line coverage reads high on a dispatch chain nobody has taken a
branch of.

---

## Prose, and the skills

Five, and they do not overlap. Reach for the right one:

- **`eldritch-story`** — architecture and the frame. What a phase is *for*, how
  an Age pays its three debts, escalation stages, antagonist tiers, endings, the
  Ledger. Use it *before* writing content.
- **`rothfuss-prose`** — sentences, for **events**. Bodies, outcome text,
  chronicle entries, character blurbs. Plain and concrete, no archaisms. The
  contract every body over five sentences is held to.
- **`lovecraftian-prose`** — sentences, for the **frame and myth layer**.
  Elevated Dunsanian register, mythic distance, the incomprehensible described by
  its effects.
- **`frontend-design`**, **`interface-design`** — the client and the editor. No
  game rules.

**The register split is load-bearing.** Dunsanian diction in an event body is
register bleed, and so is plain reportage in an interlude.

The game never adjudicates between two contradicting accounts in its own voice.
There is no narrator who knows the truth — there is only Daveed, and he is not
neutral. No nested tale is neutral either: every one names a `teller` and a
`bias`, and CI fails a build where two accounts of one event agree on everything.

---

## Working style

The full version, including the standing authorization behind the landing, is in
[AGENTS.md](AGENTS.md#working-style).

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
- **Landing is `npm run land`, with no PR and no prompt.** It rebases onto
  `origin/main` and runs the whole set CI runs, gates included, ON that head;
  `npm run check` is not that set. Ask only if it stops.
  [docs/COMMANDS.md](docs/COMMANDS.md#the-landing) has the four verdicts.

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
