# ARCHITECTURE

The map. `AGENTS.md` carries the rules you cannot derive from the code; this
file tells you where the code is and how to add to it.

**Reading order for an agent.** Load the least you can:

| Task | Read |
|---|---|
| Author or edit content | [docs/VOCABULARY.md](docs/VOCABULARY.md) + [packages/content/AGENTS.md](packages/content/AGENTS.md) |
| Change a rule of the world | this file's table below → the one file it names |
| Add a verb (effect, condition, phase, rule) | the matching recipe below |
| Fix a failing test | the test file, then the one file it exercises |
| Understand why something is the way it is | [docs/FAILURES.md](docs/FAILURES.md) |

Each package has its own `AGENTS.md` with only the rules that apply inside it.

---

## The model, in one paragraph

Authored YAML is loaded into a **`ContentBundle`**, indexed once into a
**`Content`**, and never changes again during a run. A **`WorldState`** holds
everything the run has caused, and is the only thing that mutates. A
**`SimCtx`** is the pair of them plus two derived things — the locus table and
the set of names already spoken for. A **year** is an ordered list of named
**phases**, each of which takes `SimCtx` and its own RNG stream. A
**`GameSession`** is the narrow surface a client uses. A **`SavedGame`** is the
whole world as plain, validated data.

```
YAML ──assembleBundle──▶ ContentBundle ──indexContent──▶ Content ─┐
                                                                  ├─▶ SimCtx ──YEAR_PHASES──▶ WorldState
                                                       bootstrap ─┘        │
                                                                   saveGame│loadGame
                                                                           ▼
                                                                      SavedGame
```

---

## Packages

| Package | Holds | Never holds |
|---|---|---|
| `schema` | Zod schemas, the types they infer, content validation rules, the save format | Simulation logic, I/O |
| `core` | The simulation. Pure, seeded, deterministic | DOM, `Math.random`, filesystem |
| `content` | Authored YAML, and a loader that only reads files | Any statement about what a bundle *is* — that lives in `schema/src/assemble.ts` |
| `editor` | Vue 3 authoring tool. Imports `core` directly, so preview is the real thing | Reimplemented simulation |
| `shell` | Electron: the window and the disk | Rules |

---

## Where a thing lives

| If you are changing… | Go to | Guarded by |
|---|---|---|
| What an event/age/arc/character **is** | `schema/src/event.ts`, `age.ts`, `arc.ts`, `character.ts` | `rules.test.ts` |
| Which file a collection is **loaded from** | `schema/src/assemble.ts` → `CONTENT_LAYOUT` | `bundle.test.ts` |
| Looking a content id **up** | `schema/src/content-index.ts` | `bundle.test.ts` |
| A **validation** rule | `schema/src/rules.ts` → `CONTENT_RULES` | `rules.test.ts` |
| The **prose** contract | `schema/src/prose.ts` | `rules.test.ts` |
| The **save format** | `schema/src/save.ts` (shape) + `core/src/save.ts` (conversion) | `save.test.ts` |
| **What happens in a year** | `core/src/year/phases.ts` → `YEAR_PHASES` | `year.test.ts` |
| Death, birth, marriage rates | `core/src/people/demography.ts` | `demography.slow.test.ts`, `attributes.slow.test.ts` |
| Genetics — loci, meiosis, expression | `core/src/genetics/` | `sim.slow.test.ts`, `attributes.slow.test.ts` |
| Who can be **cast** in a slot | `core/src/events/slots.ts` → `candidatesFor` | `arcs.slow.test.ts` |
| What an **effect** does | `core/src/events/effects.ts` → `applyEffect` | `ledger.slow.test.ts` |
| What a **condition** tests | `core/src/events/conditions.ts` | — |
| Which events **fire** | `core/src/events/selection.ts` | `sim.slow.test.ts`, `arcs.slow.test.ts` |
| **Substories** | `core/src/events/arcs.ts` | `arcs.slow.test.ts` |
| The **docket** and the Record block | `core/src/events/decisions.ts` | `decisions.slow.test.ts` |
| Cadet **halls** | `core/src/people/branches.ts` | `branches.slow.test.ts` |
| Money and standing | `core/src/economy.ts` | `economy.slow.test.ts`, `ledger.slow.test.ts` |
| The Ledger — Ages and clauses | `core/src/ages/scheduler.ts` | `ledger.slow.test.ts` |
| What a **client** can do | `core/src/session.ts` | `session.test.ts` |
| Test scaffolding | `core/src/testing.ts` | `year.test.ts` |
| The generated reference | `schema/src/reference.ts` + `core/src/tools/gen-docs.ts` | `docs.test.ts` |

---

## The year

`stepYear` is a clock; the year itself is a table in `core/src/year/phases.ts`.
Each phase declares what it must run **after** and why, and `year.test.ts`
holds the table to its own declarations.

```
ages → lifecycle → guardian → quarrels → economy → succession
     → branches → marriage → births → arcs → ambient → generation
```

Every phase draws from `streamFor(world, phase.name)` — its own stream, derived
from `(seed, year, name)`. Inserting a die roll in one phase does not move any
other phase's numbers. **A phase's name is part of the save in all but name:
renaming one reseeds it.**

---

## Recipes

### Add an event
Write it in `packages/content/events/*.yaml`. Three distinct purposes, a
frequency tier, slots for every `{TOKEN}` in the body. `npm run validate`.
Bodies over five sentences go through the `rothfuss-prose` skill.

### Add an attribute
Six loci in `packages/content/tools/gen-loci.mjs`, one row in
`attributes.yaml`, `npm run gen:loci`. No engine change — nothing counts
attributes. Anything mapping it onto a real quantity centres on
`ctx.genetics.expected`.

### Add an `Effect` kind
1. A variant in `EffectS` (`schema/src/event.ts`).
2. A `case` in `applyEffect` (`core/src/events/effects.ts`) — **the compiler
   will demand it**; `assertNever` is the last line of that switch.
3. A cross-reference check in `refs/known` if it names other content.
4. A test that the effect *changes something*. A case that compiles and does
   nothing is the bug this codebase actually has.

### Add a `Condition` or `Filter`
A variant in `schema/src/conditions.ts`, then a branch in
`core/src/events/conditions.ts`. Both functions end in `assertNever`, so a
missing branch fails to compile rather than silently returning `true`.

### Add a year phase
One entry in `YEAR_PHASES`, with `after` and `why` filled in. It gets its own
RNG stream automatically. Test it alone with `phase('yourphase', ctx)`.

### Add a validation rule
One `ValidationRule` in `schema/src/rules.ts`, appended to `CONTENT_RULES`. Test
it alone with `runRule('your/rule', bundle)`.

### Add a field to the world
1. The field on `WorldState` (`core/src/world.ts`) and its initial value in
   `createWorld`.
2. The field in `SavedGameS` (`schema/src/save.ts`).
3. Read and write it in `saveGame` / `loadGame` (`core/src/save.ts`).

Skipping 2–3 does not fail. It makes the field reset silently on load, which
looks exactly like a subsystem that stopped working two centuries in.
`save.test.ts`'s "continues identically after loading" is what catches it.

### Write a test
Use `core/src/testing.ts`: `testWorld`, `place`, `marry`, `beget`, `phase`.
Build the state you mean rather than simulating four hundred years to reach it.
Reserve long runs for assertions about the *shape of a healthy run* — those
genuinely need one.

---

## Commands

```bash
npm run check      # typecheck (incl. Vue templates) + validate content + test
npm run test:fast  # ~2s — skips the *.slow.test.ts century-scale suites
npm test           # everything
npm run validate   # content rules; exits non-zero on any error
npm run dev        # editor at localhost:5173
npm run shell      # editor in the Electron shell

npm run harness -- 16 1000   # 16 thousand-year runs, with balance numbers
npm run digest  -- 8 400     # fingerprint 8 runs; diff across commits
npm run gen:loci             # regenerate loci.yaml (never hand-edit it)
npm run gen:docs             # regenerate docs/VOCABULARY.md from the schemas
```

`npm run digest` is the tool for "this refactor changes nothing": run it before
and after. If the block moves, the change was not a refactor.

---

## What the compiler now enforces

These used to be prose rules in `AGENTS.md`. They are checks now, and the entry
in `AGENTS.md` is gone.

| Rule | Enforced by |
|---|---|
| Every `Effect`, `Condition`, `Filter`, `Target` and slot role is handled | `assertNever` at each switch |
| The save format matches the runtime types | `SAVE_SHAPES_AGREE` in `schema/src/save.ts` |
| Both content loaders agree | There is one loader; `CONTENT_LAYOUT` is the only table |
| Every collection has a place to load from | `bundle.test.ts` |
| Phase ordering matches its declarations | `year.test.ts` |
| A missing content id is loud | `Content.mustEvent` / `mustArc` / `mustAge` |
| A named content file is present | `assembleBundle` throws |
| Vue templates typecheck | `npm run typecheck:editor` (`vue-tsc`) |
| The vocabulary reference is current | `docs.test.ts` |
| Every condition and filter in the schema is evaluated | `docs.test.ts` |
