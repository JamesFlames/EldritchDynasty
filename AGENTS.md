# AGENTS.md

Instructions for agents working in this repository.

**Eldritch Dynasty** is a text-based generational strategy game: 1,000 years, ~40 generations, one bloodline. The player never fights and never speaks a line of dialogue. They decide who marries whom, who is spent, what gets written down — and what each child is called.

Read `DesignConcepts/eldritch-dynasty-concept-brief.md` before changing anything that touches game rules. It is the authority; this file is the operating manual.

---

## Layout

```
packages/
  schema/    Zod schemas + types. THE SINGLE SOURCE OF TRUTH.
  core/      Pure simulation. Zero DOM. Seeded RNG. Deterministic.
  content/   Authored YAML: events, ages, characters, templates, arcs, loci.
  editor/    Vue 3 + Vite authoring tool. Imports `core` directly.
DesignConcepts/   Concept, data model, and event editor briefs.
Writing/          Voice contract and story-design references.
```

`packages/schema` is the only definition of what an event is. The editor validates against it, the game loads against it, CI checks the whole content directory against it. Never write a second one.

The editor imports `core` directly and never reimplements simulation logic. That is what makes preview trustworthy.

## Commands

```bash
npm install          # workspace install
npm test             # vitest — invariants, demography, economy, arcs, naming, minting
npm run typecheck    # tsc across every package
npm run dev          # editor at localhost:5173
npx tsx --tsconfig tsconfig.base.json packages/core/src/harness.ts 12 1000
node packages/content/tools/gen-loci.mjs   # regenerate loci.yaml
```

`loci.yaml` is **generated**. Edit `tools/gen-loci.mjs` and re-run; never hand-edit it.

---

## Non-negotiable invariants

These are not style preferences. Breaking one silently breaks the design, and every test in the suite exists because the opposite of it shipped at some point.

### 1. `canExpress` is the only Madness gate

A person can go mad **if and only if they are capable of expressing Eldritch Power** — male, with a non-null X-linked font. Never a woman, never a mundane man.

- There is **no** `if (female) madness = 0` clamp, and there must never be one. A clamp is something a later feature bypasses by accident; an unentered branch stays unentered.
- Every Madness source routes through `phenotypeOf(p).eldritch.canExpress`.
- An effect adding Madness to an ungated target is a **schema error**, not a silent no-op.

### 2. `PersonStore.kill` is the only death gate

Plague, duel, madness overflow, an authored `status` effect — all of it goes through `kill()`. A second place that ends a life is a second place that can kill the Narrator, and he does not die.

### 3. The Narrator does not die

**Daveed Gearithy** is the first character and the first head of the Eldritch House. When death is triggered for him it is *redirected*: he becomes the house's guardian spirit and makes its decisions from that day forward. He is the player, and the player has been him the whole time.

- Marked `becomesGuardian: true` on the seed character; handled inside `kill()`.
- Afterwards his status is `guardian` — never `alive` again, so succession, marriage, births and mortality all step around him.
- He stays castable forever via the `guardian` slot role, which reads status rather than liveness. A template written for 1042 can still name him in 2042.

### 4. Two magics, two rules

- **Eldritch Power** is given, X-linked, family-exclusive. Men express it, women carry it and never express it. It may never become reliable or schedulable.
- **Mystic** magic is taken from books. Women practise only the four **Threshold** affinities (life, death, light, darkness); men practise all eight. This gates *learnability* and has **no Madness consequence**.

`canLearn()` and `eldritch()` share no code, and that separation is the design.

### 5. Effects are enumerated, never scripted

The `Effect` union is closed. Adding a kind is a deliberate act with a compiler error at every switch that needs updating — the correct amount of friction.

### 6. Derived state is not storage

`PhenotypeCache` is **derived** — recomputed from the genome whenever the year changes. Anything life does to a person (education, injury, event effects) goes in `Person.acquired` and is re-applied on every recompute. Writing into the cache appears to work and is gone by next spring, which silently made every `attribute` effect in the game inert.

### 7. Events and people ration separately

`world.frequency` is the ledger for events; `world.characterFrequency` is the ledger for minted people. They were one, which meant a rare *event* firing barred rare *character* templates for fifty-five years, and minted people were never recorded at all — so a mythic cap of three produced five and a half per run.

### 8. Determinism is per-world, not per-module

Every conception derives its RNG stream from `(runSeed, mother, father, ordinal)`. **Id sequences live on `WorldState.counters`, never at module scope.** A module-level counter is shared by every simulation in the process, so the same seed diverges as soon as a third run exists between two others — and the harness runs thousands. This shipped once; `demography.test.ts` now asserts against it.

Never introduce `Math.random()` into `core`.

---

## Writing events

### The prose rule

**Any event body longer than five sentences must be written in Patrick Rothfuss's style**, per `Writing/PatrickRothfussProse.md`. Five sentences or fewer is a note; past that it is prose, and it is held to the contract.

- Plain concrete words. Strong verbs instead of verb-plus-adverb.
- **Sound and temperature before sight.**
- Describe rooms by what is absent.
- Jagged rhythm — long, long, short. **Land on a short sentence**, and never explain it.
- No archaisms (`ere`, `mayhap`, `whilst`); age is carried by content, not grammar.
- **Never put a slot token in the final sentence.** A five-syllable generated name destroys a four-beat close.

`validateBundle()` counts all of this and reports warnings — warnings on purpose, since a linter that blocks writers gets disabled within a fortnight. A body failing four checks at once is genuinely off-voice.

### Frequency

Every event **and every character template** declares `common | uncommon | rare | mythic`. It is a rationing tier, not a weight synonym (`packages/schema/src/frequency.ts`).

| | Cap | Cooldown | Record block | Folklore | Chronicle |
|---|---|---|---|---|---|
| **common** | none | none | forbidden | never | one line |
| **uncommon** | none | 12 yr | optional | optional | paragraph |
| **rare** | 22/run | 55 yr | **required** | always | page, named |
| **mythic** | 3/run | 170 yr | **required** | always | illuminated, named, once ever |

Mythic events are not *unlikely*, they are *rationed* — a steep drought curve guarantees a run gets its mythic moments; the cap guarantees it never gets many. Tune the profile and measure in the harness; never tune by adjusting per-template `weight`.

### Other requirements

- Exactly three purposes per template, from the closed vocabulary.
- Bodies reference slots as `{SLOT}`. Undefined slots are errors.
- An arc-bound slot with `onMissing: continue_absent` **must** supply `absentBody`.
- IDs are `snake_case` and never renamed after commit — save files reference them.

## Characters

Two distinct things, and they are not interchangeable:

- **`characters/founding.yaml`** — the twelve authored individuals who exist in 1042. Genomes are still *rolled*; `bias` nudges an authored intent without pinning it.
- **`characters/templates.yaml`** — recipes for everyone the next thousand years produces: suitors, grooms, rivals, tutors, midwives, wanderers. Nothing spawns people outside `people/minting.ts`.

A template's most consequential field is `houses`, because it decides whether that person carries anything — and the player can never see it. Review templates with the editor's **Roll 24** preview, not by reading the form: a recipe that reads like deep blood and produces nothing but nulls looks completely correct on paper.

`previewTemplate` must stay side-effect free. Rolling twenty-four suitors to inspect a recipe must not add twenty-four people to the world.

## Naming the children

Every newborn of the player's household gets a generated name **and** a `pendingNames` entry. The generated name means nothing downstream can ever hold a nameless person; the queue is an offer, not a blocker. `renameChild` applies it, logs a chronicle line, and drains the queue. Ignoring the offer is a valid way to play — the chronicler picked a name, and the chronicler is not you.

---

## The editor

Four views, all reading real simulation state — nothing in the editor is mocked.

| View | What it is for |
|---|---|
| **Events** | Frequency picker showing what each tier *obliges*, live voice-contract lint, per-Age coverage |
| **Characters** | Character templates, with a rolled 24-person preview and the gene pool's real carrier rate |
| **Family tree** | Generational SVG with procedural inherited sigils; hot lines mark maternal font transmission |
| **Simulate** | Run to 2042, name the children, watch frequency drive chronicle typography |

### Editor gotchas, all of which cost real time

- **No TypeScript `as` casts in template expressions.** `@click="tab = t.id as typeof tab"` compiles, the click lands, and nothing happens — silently. Use a handler function.
- **`{` in template literals collides with Vue's `{{ }}`.** Build such strings in `<script>`.
- **`triggerRef` is not enough for a long-lived mutable world.** An intermediate computed returning `ctx.value.world` yields the same reference every time, so Vue short-circuits and every computed *downstream of it* silently stops updating while its siblings keep working. Use the explicit `version` counter pattern in `SimRunner.vue`.
- **The browser and node load content by two different implementations.** When they drift, the editor simply simulates a different game. `schema/src/bundle.test.ts` guards this; add new collections to *both* loaders.

---

## Tests

67 tests in seven files. They are grouped by the kind of failure they catch, not by module.

| File | Catches |
|---|---|
| `sim.test.ts` | The genetic invariants — X inheritance, the expression gate, frequency caps, the Narrator, Age stochasticity |
| `demography.test.ts` | Houses that quietly empty or quietly explode, pedigree corruption, determinism |
| `naming.test.ts` | The naming queue and the rename path |
| `minting.test.ts` | Character templates match their own recipes; preview has no side effects |
| `bundle.test.ts` | The two content loaders agree |
| `economy.test.ts` | Acquired attributes persist; the two ledgers stay separate; money means something |
| `arcs.test.ts` | Every authored event actually fires; substories survive their cast |

**The failure mode this codebase actually has is silence.** Nothing here throws. A house that goes extinct by 1150, a chronicle that stops updating, an editor loading a different bundle — all of them look like a working simulation from the outside. Write tests that assert the *shape of a healthy run*, not just that functions return.

Illustrative bugs, all found by tests or probes, none of which threw:

- `Math.max(0, (age - 45) ** 2)` — the square is always positive, so the clamp did nothing and the mortality curve ran backwards. A one-year-old carried a 12% annual hazard, almost no child reached seventeen, and every run went extinct. The clamp belongs *inside* the square.
- Removing that bug then doubled the household every 25 years, because every adult married and bred for 27 years. The brakes are completed fertility per couple and a household soft cap.
- **Attribute effects evaporated** on the next tick — see invariant 6.
- **No annual economy existed.** The treasury only moved when an event spent it, and every money event spends, so the house passed −1,000 crowns by 1400. Nothing checks a negative treasury: the only symptom was that retainers silently stopped being hired around 1150, and the tutor, midwife and archivist quietly left the game.
- **Two arc bugs killed a three-node substory.** A node that did not declare the arc's bound slot was treated as having an unfillable one and cancelled the whole arc; and `inherit` gave up if a man died childless. The seal feud's final scene fired **zero times in twenty thousand simulated years**. Run `arcs.test.ts` — the fire-rate gate is the only thing that catches this class.

**Measure fire rates when you touch arcs, slots, or selection.** An event that never fires is not in the game, and nothing will tell you.

## Working style

- **Run the harness before claiming a balance change works.** One playthrough is 8–12 hours; batch simulation is the only viable balance method.
- When a test fails, work out whether the test or the code is wrong. Several "failures" here were correct behaviour asserted incorrectly — rare upward font mutation is *designed*.
- Prefer fixing the model over special-casing the symptom. Nearly every bug in this codebase has been structural: children in the wrong household, widows still married to dead men, cast slots never refilled, counters at module scope.

## Do not

- Add a Madness path that skips `canExpress`.
- Add a death path that skips `kill()`.
- Put an id counter or any mutable simulation state at module scope.
- Make Eldritch Power reliable, schedulable, or manifest-on-demand at any tier.
- Spawn people outside `people/minting.ts`.
- Hand-edit `packages/content/loci.yaml`.
- Let the game adjudicate between two contradicting accounts in its own voice. There is no narrator who knows the truth — there is only Daveed, and he is not neutral.

---

## Known gaps

- **Cadet branches** (concept §16) are not modelled. Non-heir children stay in the main household and are damped by the crowding brake rather than founding branches of their own.
- **Player choice** is not wired into the sim loop: `stepYear(ctx, autoResolve)` picks randomly. The Record mechanic (Record / Omit / Embellish) is authored in content and applied by effects, but nothing asks the player yet.
- **Electron** is not set up. The editor runs on Vite; the shell is a later wrapper.
- Runs still end with a small household (~20 living at 2042). Whether that is correct austerity or under-tuned fertility is an open balance question.
