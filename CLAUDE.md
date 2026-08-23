# CLAUDE.md

Entry point for Claude Code in this repository. Read this first; it routes you to
the one other file your task actually needs.

**Eldritch Dynasty** is a text-based generational strategy game: 1,000 years,
~40 generations, one bloodline. The player is not a character — they are the will
of a family. They never fight, never explore and never speak a line of dialogue.
They decide **who marries whom**, **who is spent**, **what gets written down**,
and what each child is called.

> In year 1042 an ancestor signed something. In 2042 the other party comes to collect.

**Status:** pre-production. Simulation, content pipeline, authoring tool and
desktop shell all work. The *game client* is not built — `core/src/session.ts` is
the seam it will be written against.

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

```bash
npm install

npm run check        # typecheck (incl. Vue templates) + validate content + test.
                     # ONE command before you claim anything works. ~4 min.
npm run test:fast    # ~3s — skips the *.slow.test.ts century-scale suites. The loop.
npm test             # everything: 747 tests in 56 files
npm run typecheck    # tsc over packages, then vue-tsc over the editor's templates
npm run validate     # 22 content rules; exits non-zero on any error

npm run dev          # authoring tool at localhost:5173
npm run shell        # the same tool inside the Electron shell
npm run shell:preview                 # build the editor, then run the shell against dist
npm run smoke --workspace @ed/shell   # boot the shell, assert the renderer mounted, exit

npm run harness -- 16 1000            # 16 headless thousand-year runs, with balance numbers
npm run digest  -- 8 400              # fingerprint 8 runs; diff the block across commits
npm run gates   -- fire-rate          # a CI gate on its own
npm run gate:drag -- 200 1000 0 1 2 4 # the fecundity death-spiral sweep (issue #26)
npm run lint:prose                    # advice, never a gate
npm run gen:loci                      # regenerate loci.yaml
npm run gen:docs                      # regenerate docs/VOCABULARY.md from the schemas
```

`npm run digest` is how you **prove a refactor changed nothing**: run it before
and after. If the block moves, the change was not a refactor — and since each
year phase draws from its own RNG stream, a block that moves points straight at
the system that moved it.

`loci.yaml` and `docs/VOCABULARY.md` are **generated**. Never hand-edit either.

CI (`.github/workflows/check.yml`) runs typecheck → validate → test → gates 7, 4,
2 and 8 (clauses, fire rate, slot fillability, outcome reach), then prose lint as
annotations only.

---

## Layout

```
packages/
  schema/    Zod schemas + the types they infer. THE SINGLE SOURCE OF TRUTH.
  core/      Pure simulation. Zero DOM, no filesystem, seeded RNG, deterministic.
  content/   Authored YAML: events, ages, arcs, characters, careers, spellbooks, loci.
  editor/    Vue 3 + Vite authoring tool. Imports `core` directly.
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
whole world as plain, validated data (`SAVE_FORMAT` is 5).

### The year

`stepYear` is a clock; the year itself is a table in `core/src/year/phases.ts`.
Each phase declares what it must run **after** and why, and `year.test.ts` holds
the table to its own declarations.

```
ages → lifecycle → guardian → quarrels → careers → library → economy → auction
     → succession → branches → marriage → births → arcs → ambient → frame → generation
```

Every phase draws from `streamFor(world, phase.name)` — derived from
`(seed, year, name)`. Inserting a die roll in one phase does not move any other
phase's numbers. **A phase's name is part of the save in all but name: renaming
one reseeds it.** That is fine (it is a new system), but it is not cosmetic.

### The client surface

```ts
const game = newGame(loadContent(), { seed: 1042 });
game.advance(400);                        // stops the moment something needs an answer
game.choose(decision.id, 'send_the_boy'); // also: send, match, declineHand, record,
game.name(personId, 'Aubren');            //   letHimDecide, keepSuggestedNames
const view = game.view();                 // plain data: halls, chronicle, docket, clauses
const save = game.save();                 // versioned, validated, reloads bit-identically
```

Never reach into `ctx.world` from a client. If `session.ts` cannot express what
you need, the missing thing is a verb *there*.

---

## Invariants

The full text, with the reasoning and the bug behind each, is in
[AGENTS.md](AGENTS.md). These are not style preferences — every test in the suite
exists because the opposite of one of these shipped. The enforcement points are
greppable:

```bash
grep -rn "INVARIANT " packages --include=*.ts     # 25 of them
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
13. **A hall is not a house.** Cadet branches are households *inside* the
    player's house, keyed by `membership.branch`. Crowding is per hall. Moving
    someone closes one membership record and opens another — two open records
    puts them in two halls at once.

---

## Adding things

Full recipes live in [ARCHITECTURE.md](ARCHITECTURE.md). The shape of each:

- **An event** — YAML in `packages/content/events/`, or **+ new** in the editor.
  Exactly three distinct purposes, a frequency tier, a slot for every `{TOKEN}`.
  `npm run validate`. Bodies over five sentences go through `rothfuss-prose`.
- **A two-beat scene** — `next: { event, after, keep }` on an outcome. `keep`
  names the slots the follow-up casts with the same people. `desugar.ts` compiles
  it into a real `ArcDef` *inside the index*, never the bundle.
- **Anything longer** — an `ArcDef` in `packages/content/arcs/`, or the editor's
  Substories tab. Successors gate on `fromChoice` / `fromOutcome` / `fromTag` and
  a `when` with the running instance in scope (`arcFlag`, `arcVisited`).
- **An attribute** — six loci in `tools/gen-loci.mjs`, a row in
  `attributes.yaml`, `npm run gen:loci`.
- **An `Effect` / `Condition` / `Filter` / `Decider` kind** — the variant in the
  schema, then the branch in `core`; the compiler demands it. Plus a test that
  the thing *changes something*.
- **A year phase** — one entry in `YEAR_PHASES` with `after` and `why`. It gets
  its own stream automatically; test it alone with `phase('name', ctx)`.
- **A validation rule** — one `ValidationRule` appended to `CONTENT_RULES`. Test
  it alone with `runRule('your/rule', bundle)`.
- **A field on the world** — `WorldState` **and** `createWorld` **and**
  `SavedGameS` **and** `saveGame`/`loadGame`. Skipping the last two does not
  fail; it makes the field reset silently on load, which looks exactly like a
  subsystem that stopped working two centuries in.

Frequency (`common | uncommon | rare | mythic`) is a **rationing tier, not a
weight synonym**: it drives caps, cooldowns, the drought curve, chronicle
typography, folklore and whether a Record block is required. Tune the profile and
measure in the harness; never tune by nudging a per-template `weight`.

Content **IDs are `snake_case` and are never renamed after commit** — save files
reference them. Slot names are not save-referenced and may be renamed.

---

## Tests

747 in 56 files, grouped by the kind of failure they catch rather than by module.

- **`*.slow.test.ts` simulates centuries** — the suites that assert the shape of
  a healthy run. `npm run test:fast` skips them. A new suite that runs a century
  takes the `.slow` suffix; one that does not, does not.
- **Build the state you mean.** `core/src/testing.ts` gives `testWorld`, `place`,
  `marry`, `beget`, `phase`. Simulating four hundred years to reach a widow is
  not a test, it is a wait.
- **Never pin a test to one seed reaching one state.** Two did, and both broke
  the day the RNG streams were split, on behaviour that was demonstrably intact.
  Assert the mechanism — "standing falls as well as rises", not "six seeds end on
  six tiers".
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

---

## What is built, and what is not

Verified against the code on 2026-08-23; `npm run check` green.

**Built.** Diploid genetics (loci, dominance, recombination, mutation, X-linked
Eldritch font); heritable Fecundity driving both family size and annual
conception, with the marriage market now reading a *line* off a woman's mother
and sisters rather than her genome; demography and mortality; cadet branches and
halls; succession and recall; the Match (three cards, one marriage); the docket
and player choice; Checks and party deciders; substories, inline `next` chains
and per-instance story memory; the frame layer and its interludes; Ages, the
Ledger and clause payout; Discrepancies and the record layer; nested tales with
teller and bias; grudges as inherited edges; standing decay; careers; the
library, study and spellbooks; the auction; heirlooms; the economy; all
eight household posts, hired off whichever templates can fill them; save/load
with bit-identical continuation, and saves on disk in named slots; the decision
log and `replay()`; the session surface; secrets that walk out of the house
with a released retainer and become Discrepancies somebody else can prove; the
Vue authoring tool with generated forms; the Electron shell.

**Not built.** The **game client** (the session surface is the seam for it, and
`window.ed.writeSave` is the other half of that seam). **Packaging** — no
`electron-builder`, no signing, no auto-update. **A Save/Load menu** — the
shell's disk layer is built and tested end to end by `npm run smoke`, but there
is no client to put a menu item in front of, so there is no menu.

**One thing to watch.** Gate 8 wants every authored outcome reached at least
once, and a handful sit at 2-4%. Any change anywhere in the simulation re-rolls
those, so a gate that goes red on an outcome you did not touch is usually
saying that outcome was passing on a coin. The fix is reach, measured — the
weight note at the top of `age_insurrection.yaml` and the one on
`the_archive_and_the_wage_roll` both say what was tried and where the ceiling
is — not a nudge until the gate goes quiet. **Measure the whole funnel before
moving anything**: both frame interludes that sat at 1-2% were starved four
events upstream, and nothing about the interlude itself was wrong. The thinnest
now are `the_registrar_asks_for_the_book`, `who_gets_the_physician`,
`the_coat_hung_up` and `the_turn_of_the_stave`; every frame interlude is at 7%
or better.

The gate measures **250 runs rather than 100**, which is the other half of the
same problem: at a hundred, a third of that tail showed zero on any given
measurement, and across one afternoon it named nine different casualties in
nine consecutive runs on content that was getting steadily healthier — four of
them the heavier half of their own branch. 250 costs about four minutes of CI
and buys a red that means something. The arithmetic is in `gates.ts`, and the
same lesson has now been learned three times in `record.slow.test.ts`: a fixed
seed block is a sample, and a threshold asserted on one sample of a noisy
statistic reports the sample rather than the game.

Two scheduling facts are worth knowing before adding content in bulk, both
measured and both counter-intuitive. **The frequency cooldown is global to its
tier**: uncommon bars the whole tier for twelve years after any uncommon
template fires, so a run has room for about 83 uncommon firings shared by every
uncommon template in the game, and each one you add divides that pool again.
Ordinary texture therefore belongs at `common`, which has no cooldown at all.
And **the rare tier is rationed by its draw weight, not by its cap** — 70
against common's 1000 — so the 22-a-run cap almost never binds and the tier
fires around 7 times in a thousand years, total.

This list was reconciled against the code on the date above, and AGENTS.md's
"Known gaps" was corrected to match — including barrenness as a recessive, which
both files listed as unbuilt for months after it shipped. Where any prose here and the code disagree,
**the code is the spec** — fix the prose.
