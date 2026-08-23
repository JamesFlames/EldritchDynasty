# AGENTS.md

Instructions for agents working in this repository.

**Eldritch Dynasty** is a text-based generational strategy game: 1,000 years, ~40 generations, one bloodline. The player never fights and never speaks a line of dialogue. They decide who marries whom, who is spent, what gets written down — and what each child is called.

Read `DesignConcepts/eldritch-dynasty-concept-brief.md` before changing anything that touches game rules. It is the authority; this file is the operating manual.

**The design for everything the concept brief describes and the code does not have now lives in [the issue tracker](https://github.com/JamesFlames/EldritchDynasty/issues), not in this repo.** Read the issue before building any of it, and close the issue when you ship it. Each one is self-contained: the fact, the file paths, the type shapes, and the assertion that has to pass.

The unbuilt brief, its implementation plan, and the fertility do-to were folded into those issues and deleted — the same reason the data-model and event-editor briefs before them are gone. A specification that duplicates working code drifts, and every one of these drifted: the data-model brief was still claiming twelve heritable attributes and a `House` with a `roster`; the unbuilt brief was still saying `ModifierS` had seven kinds when it has eight. **For anything that exists, the code is the spec.** All three are recoverable in full from git history.

**Build order.** Phases are done in order; each parent issue lists its sub-issues and what blocks it.

| | | |
|---|---|---|
| [#7](https://github.com/JamesFlames/EldritchDynasty/issues/7) | **Phase 0** — Gates and instruments | *do this first — most of what follows fails green* |
| [#8](https://github.com/JamesFlames/EldritchDynasty/issues/8) | **Phase 1** — Decision log and replay | cheapest item; every later phase debugs easier for it |
| [#9](https://github.com/JamesFlames/EldritchDynasty/issues/9) | **Phase 2** — Make Discrepancies readable | ~30 lines; unblocks three phases |
| [#12](https://github.com/JamesFlames/EldritchDynasty/issues/12) | **Phase 3** — Checks and the influence modifiers | |
| [#13](https://github.com/JamesFlames/EldritchDynasty/issues/13) | **Phase 4** — Frame events | |
| [#14](https://github.com/JamesFlames/EldritchDynasty/issues/14) | **Phase 5** — Nested tales | |
| [#18](https://github.com/JamesFlames/EldritchDynasty/issues/18) | **Phase 6** — Library, careers, auction | Library first — the auction needs stock |
| [#19](https://github.com/JamesFlames/EldritchDynasty/issues/19) | **Phase 7** — Claims, RecordView, sigil drift | last: the only part needing a claim vocabulary |
| [#23](https://github.com/JamesFlames/EldritchDynasty/issues/23) | **Phase 8** — The editor | write-back first, or it edits a discarded copy |
| [#24](https://github.com/JamesFlames/EldritchDynasty/issues/24) | **Phase 9** — Open design decisions | design calls, not engineering |
| [#28](https://github.com/JamesFlames/EldritchDynasty/issues/28) | **Fertility** — what shipped, what is left | option A shipped; D next, B behind a constant |

---

## Layout

```
packages/
  schema/    Zod schemas + types. THE SINGLE SOURCE OF TRUTH.
  core/      Pure simulation. Zero DOM. Seeded RNG. Deterministic.
  content/   Authored YAML: events, ages, characters, templates, arcs, loci.
  editor/    Vue 3 + Vite authoring tool. Imports `core` directly.
  shell/     Electron wrapper. Owns the window and the disk. Owns no rules.
CLAUDE.md         The entry point: orientation, commands, and where to look next.
ARCHITECTURE.md   The map: where a thing lives, and how to add one.
DesignConcepts/   The concept brief. The authority on game rules.
Background/       The world bible: geography, law, money, technology, the Church.
.claude/skills/     eldritch-story (architecture + the frame), rothfuss-prose (events),
                    lovecraftian-prose (the frame's register).
```

Everything unbuilt — and every open design question — is in the issue tracker. See the build
order above.

**Read [Background/eldritch-dynasty-world.md](Background/eldritch-dynasty-world.md) before
authoring content.** The brief says what the game is about; the world file says what the game is
*in* — what a mile costs, who may arrest a Head, how long a letter takes to reach the king's city,
and why there is no printing press. Its §23 is a pre-commit checklist and its §24 registers
everything already fixed in code and content. Where the two disagree, the brief wins.

**Read [ARCHITECTURE.md](ARCHITECTURE.md) to find code.** It carries the package map, a table of which file owns which concept, and a recipe for each kind of change — adding an effect, a condition, a year phase, a validation rule, a field on the world. This file carries only what the code cannot say for itself.

`packages/schema` is the only definition of what an event is. The editor validates against it, the game loads against it, CI checks the whole content directory against it. Never write a second one.

The editor imports `core` directly and never reimplements simulation logic. That is what makes preview trustworthy.

## Commands

```bash
npm install
npm run check        # typecheck (incl. Vue templates) + validate content + test. Run this.
npm test
npm run typecheck    # tsc over the packages, then vue-tsc over the editor's templates
npm run validate     # content rules; exits non-zero on any error
npm run dev          # editor at localhost:5173
npm run shell        # Vite + the Electron shell together
npm run shell:preview            # build the editor, then run the shell against dist
npm run smoke --workspace @ed/shell   # boot the shell, assert the renderer mounted, exit

npm run harness -- 16 1000       # 16 thousand-year runs, with balance numbers
npm run digest  -- 8 400         # fingerprint 8 runs; diff the block across commits
npm run gen:loci                 # regenerate loci.yaml
```

`loci.yaml` is **generated**. Edit `tools/gen-loci.mjs` and re-run; never hand-edit it.

**`npm run digest` is how you show a refactor changed nothing.** Run it before and after. If the block moves, the change was not a refactor — and because each year phase draws from its own RNG stream, a block that moves points at the system that moved it.

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

### 5. The verbs are enumerated, never scripted

`Effect`, `Condition`, `Filter`, `Target`, `Decider` and `SlotRole` are closed unions. Adding a variant is a deliberate act with a compiler error at every site that has to keep up — the correct amount of friction.

That only holds because each of those sites now ends in `assertNever`. It did not before: a `switch` with no default and an `if ('x' in c)` chain ending in `return true` both accept a new variant in silence — the effect applies nothing, the condition **passes**, and every event carrying it fires unconditionally for a thousand years. Never end one of those functions with a permissive default.

### 6. Derived state is not storage

`PhenotypeCache` is **derived** — recomputed from the genome whenever the year changes. Anything life does to a person (education, injury, event effects) goes in `Person.acquired` and is re-applied on every recompute. Writing into the cache appears to work and is gone by next spring, which silently made every `attribute` effect in the game inert.

### 7. Events and people ration separately

`world.frequency` is the ledger for events; `world.characterFrequency` is the ledger for minted people. They were one, which meant a rare *event* firing barred rare *character* templates for fifty-five years, and minted people were never recorded at all — so a mythic cap of three produced five and a half per run.

### 8. Determinism is per-world, not per-module

Every conception derives its RNG stream from `(runSeed, mother, father, ordinal)`. **Id sequences live on `WorldState.counters`, never at module scope.** A module-level counter is shared by every simulation in the process, so the same seed diverges as soon as a third run exists between two others — and the harness runs thousands. This shipped once; `demography.slow.test.ts` now asserts against it.

Every year phase draws from its OWN stream, derived from `(seed, year, phase name)` — see `streamFor` in `rng.ts`. One shared year-RNG was deterministic and unrefactorable: adding a single `rng.bool()` to the mortality pass shifted every subsequent draw that year, so no change could be shown to preserve a run. A phase's name is therefore part of the save in all but name. Renaming one reseeds it, which is fine — it is a new system — but it is not a cosmetic edit.

Never introduce `Math.random()` into `core`.

### 9. The docket blocks the clock

`stepYear(ctx, false)` puts choice events and Record blocks on `world.pendingDecisions` and **does not advance the year** until they are answered. A choice resolved three years after its event is not a choice.

- **Not every branch is the player's.** `decidedBy` (`schema/src/decider.ts`) says who takes one: `player` dockets, `chance` draws, `state` reads a ladder of guards over the family's own condition, and `party` pools a `Check` over the people the player casts — his decision there is *who goes*, and `session.send` is how a client answers it. Only `player` stops the clock; a scene the content already decided is not a question, and putting it on the docket would offer the player a decision that is not his.
- **`decideBranch` is the one evaluator**, and both the docket path and auto-resolve go through it, for the same reason `commitOutcome` is the only place an outcome is applied. Every path through it returns a branch — a ladder no rung of which holds falls through to weight rather than returning nothing, because an unanswered decision stops the clock permanently.

- The blocked call returns a report with `blocked` set rather than silently doing nothing.
- `autoResolve` (the default, and what every test and the harness runs) answers through the *same* commit path — `commitOutcome` in `events/decisions.ts`. One place applies an outcome, spends the frequency ration, starts substories and advances the arc. Two paths would be two sets of rules.

### 10. Attributes are an open list, and sex is a modifier on them

Nothing in the engine counts attributes. An attribute is six loci in `gen-loci.mjs` and an entry in `attributes.yaml`; **Fecundity** was added that way and cost no engine change. The eight affinities *are* fixed, because the dyads and the Threshold restriction are a rule about the world (§7), not a list length.

- **Dimorphism is data, in points, male minus female**, declared on the attribute and applied as ±half so the population mean does not move. Strength carries 26 of it — men are stronger in about 19 pairs in 20. A shift that *sorted* the sexes would be a different and worse claim, and a one-sided shift would quietly change female mortality (`hazard *= 1 - strength/220`) and surface three systems away as a fertility bug.
- **Anything mapping an attribute onto a real quantity centres on `ctx.genetics.expected`**, computed from the locus table at bootstrap. A hardcoded centre stops being true the next time somebody edits `LOCI_PER_CORE`, and the symptom is every family in the game gaining or losing a child with nothing in the diff to say so.
- **A cap is not an effect.** Fecundity drives the annual conception chance as well as completed family size, because most couples never reach their cap — crowding and a dead husband get there first. The first cut made only the cap heritable and the top third of mothers bore *fewer* children than the bottom third. If a heritable number only touches a ceiling, measure whether the ceiling ever binds.

### 11. A declared field that nothing reads is a bug, not a stub

The four subsystems below were all "already there" — in the schema, in authored content, or named in the brief — and all of them did nothing. None threw. Each looked exactly like a working feature that had not come up yet.

- **Effects apply, or they are not effects.** `kind: relationship` was in the switch with a comment saying another subsystem handled it. There was no other subsystem, and four authored outcomes — including the seal feud's inherited grudge — discarded themselves. If you add an `Effect` kind, the switch case does the work or the case does not exist.
- **Contracts bind to a PERSON.** Binding a retainer to the house made `onEmployerDeath` unreachable, and `term` with it. Every field that decides how service ends was dead.
- **Every Age reveals a clause** (§18) — the design's own answer to promise debt, and it was not built. `ActiveAge.paid.clause` was written by nothing and `clauseBearing` was read by nothing, so runs reached 2042 with two clauses of nine and the God rung, which needs seven, could not be reached in any run.
- **Respect decays** (§17). It only ever moved when an authored effect moved it, so the endgame squeeze — Madness to ascend, Respect to be allowed to, Madness destroys Respect — had one of its three jaws missing.

- **A filter has to be able to see what it compares against.** `evalFilter` passes a `relation` filter whose counterpart slot is not cast yet, because a comparison with nobody is not one it can judge. `resolveSlots` filled slots alphabetically, so four authored constraints — `CHALLENGER` not `HEAD`, `PUPIL` not `TUTOR`, `HEAD` not `SON`, `NAMED_ANCESTOR` not `SUITOR` — read as constraints and narrowed nothing. `fillOrder` fills in dependency order now; `slots/references` fails the build on a cycle, which is the one case no order can satisfy.

Grep for a schema field before assuming it works. `onEmployerDeath: 0 refs in core` is the whole bug report.

### 12. Nothing takes the seal out of the main house

`foundCadetBranch` moves a man's wife and unmarried children with him. Twice that quietly moved the sitting **Head** into a branch — once as somebody's unmarried son, once as a Regent whose husband founded a hall — after which `speakerOf` found no head in the main hall, nobody there could ever leave again, and succession never noticed because the seat was filled. Any code that moves people between halls checks `castSlots.includes('head')` first.

### 13. A hall is not a house

Cadet branches are households inside the player's house, keyed by `membership.branch`. `people.household(house, year)` is still the whole family; `halls()` splits it.

- **Crowding is per hall.** `MAIN_HALL_SOFT_CAP` for the seat, `BRANCH_SOFT_CAP` for a branch. One brake over one household is why runs used to end with twenty people.
- The economy books the main hall; branches feed themselves, pay a tithe, and cost kin upkeep.
- Moving someone between halls closes one membership record and opens another. Two open records puts them in two halls at once and double-counts them everywhere.
- Succession scans the whole house and prefers the seat; a cadet who takes the seal is **recalled** to the main hall. A Head ruling from a branch is a Head whose own hall belongs to somebody else.

---

## Skills

Three, and they do not overlap. Reach for the right one:

- **`eldritch-story`** — architecture, and the frame. What a phase is *for*, how an Age pays its three debts (clause, standing change, rumour), the escalation stage each Age sits on, the two antagonist tiers, cast slots, endings, the two-class Ledger. Also owns the *prose* of the frame, interludes, prologue, Ledger clauses, nested tales and Age blurbs. Use it before writing content, not after.
- **`rothfuss-prose`** — sentences, for **events**. Event bodies, outcome text, chronicle entries, character blurbs. Plain and concrete. The voice contract every body over five sentences is held to.
- **`lovecraftian-prose`** — sentences, for the **frame and myth layer**. Elevated Dunsanian register, mythic distance, describing the incomprehensible by its effects.

**The register split is load-bearing.** Events are plain; the frame and myth layer are ornate. Dunsanian diction in an event body is register bleed, and so is plain reportage in an interlude.

## Where the rest of it lives

This file is the rules. Everything else has moved next to the code it is about,
so an agent loads only what its task needs:

| | |
|---|---|
| [CLAUDE.md](CLAUDE.md) | The entry point. Orientation, commands, the invariants in brief, and a table routing each task to the one file it needs. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | The map. Which file owns which concept, and a recipe for each kind of change. |
| [docs/VOCABULARY.md](docs/VOCABULARY.md) | **Generated.** Every effect, condition, filter, slot role, purpose, phase and rule. Read this instead of the schemas. |
| [docs/FAILURES.md](docs/FAILURES.md) | Bugs that shipped, and what each one teaches. All of them silent. |
| [packages/core/AGENTS.md](packages/core/AGENTS.md) | Simulation. |
| [packages/schema/AGENTS.md](packages/schema/AGENTS.md) | Types, validation, the save format. |
| [packages/content/AGENTS.md](packages/content/AGENTS.md) | Writing events and characters. |
| [packages/editor/AGENTS.md](packages/editor/AGENTS.md) | The authoring tool, and its silent-failure list. |

The enforcement points for the invariants above are greppable:

```bash
grep -rn "INVARIANT " packages --include=*.ts
```

## Naming the children

Every newborn of the player's household gets a generated name **and** a
`pendingNames` entry. The generated name means nothing downstream can ever hold
a nameless person; the queue is an offer, not a blocker. Ignoring it is a valid
way to play — the chronicler picked a name, and the chronicler is not you.

## Tests

809 in fifty-nine files, grouped by the kind of failure they catch rather than
by module.

- **`*.slow.test.ts` simulates centuries** — the suites that assert the shape of
  a healthy run. `npm run test:fast` skips them and takes two seconds; that is
  the fix-and-rerun loop. `npm run check` runs everything.
- **A gate is a function over a bundle, not a script.** Every gate in
  `tools/gates.ts` returns its verdict rather than printing it, so
  `gates.test.ts` can hand it content it must reject. A gate nobody has seen
  fail is indistinguishable from a gate that cannot fail; four of them were in
  that state for their whole lives.
- **Build the state you mean.** `core/src/testing.ts` gives you `testWorld`,
  `place`, `marry`, `beget` and `phase`. Simulating four hundred years to reach
  a widow is not a test, it is a wait.
- **Do not pin a test to one seed reaching one state.** Two did, and both failed
  the day the RNG streams were split, on a codebase where the behaviour they
  described was demonstrably intact. Assert the mechanism: "standing falls as
  well as rises", not "six seeds end on six tiers".
- **Measure fire rates when you touch arcs, slots or selection.** An event that
  never fires is not in the game, and nothing will tell you.

**The failure mode this codebase actually has is silence.** Nothing here throws.
A house that goes extinct by 1150, a chronicle that stops updating, an editor
loading a different bundle — all of them look like a working simulation from the
outside. Write tests that assert the shape of a healthy run, not that functions
return. [docs/FAILURES.md](docs/FAILURES.md) is the catalogue.

[docs/TEST-COVERAGE.md](docs/TEST-COVERAGE.md) is the coverage survey and what
it found — three live bugs, one mechanic that had never run, and why line
coverage reads high on a dispatch chain nobody has ever taken a branch of.
## Working style

- **Run the harness before claiming a balance change works.** One playthrough is 8–12 hours; batch simulation is the only viable balance method.
- When a test fails, work out whether the test or the code is wrong. Several "failures" here were correct behaviour asserted incorrectly — rare upward font mutation is *designed*.
- Prefer fixing the model over special-casing the symptom. Nearly every bug in this codebase has been structural: children in the wrong household, widows still married to dead men, cast slots never refilled, counters at module scope.
- **Merge a feature branch to `main` as soon as `npm run check` passes on it, without stopping to ask.** Standing authorization for this project specifically: run the full check, and if it is green, fast-forward `main` and push — no PR, no confirmation prompt. Fall back to asking only if `main` has moved since the branch forked (no longer a clean fast-forward) or the check does not pass.

## Do not

- Add a Madness path that skips `canExpress`.
- Add a death path that skips `kill()`.
- Add a second place that applies an event outcome. Everything goes through `commitOutcome`.
- Give a person a second open membership record.
- Put an id counter or any mutable simulation state at module scope.
- Make Eldritch Power reliable, schedulable, or manifest-on-demand at any tier.
- Spawn people outside `people/minting.ts`.
- Hand-edit `packages/content/loci.yaml`.
- End a switch or an `in`-chain over a closed union with a permissive default. Use `assertNever`.
- Add a field to `WorldState` without adding it to the save format. It will not fail — it will reset on load, quietly, and look like a subsystem that stopped working.
- Reach into `ctx.world` from a client. If `session.ts` cannot express what you need, the missing thing is a verb there.
- Let the game adjudicate between two contradicting accounts in its own voice. There is no narrator who knows the truth — there is only Daveed, and he is not neutral.

---

## Known gaps

- **The game client.** `core/src/session.ts` is the seam it gets written against and `window.ed` is the disk under it. Nothing above either exists.
- **Packaging.** The Electron shell runs from source and there is no installer — no `electron-builder`, no signing, no auto-update.
- **No Save/Load menu.** The shell's disk layer is built and covered end to end by `npm run smoke`; a menu item needs a client to be a menu item *in*, and there is not one. A menu that fires into a renderer nothing listens on is a declared thing nothing reads — invariant 11, with a keyboard shortcut.
- **Outcomes passing on a coin.** Gate 8 (outcome reach) requires every authored outcome to resolve at least once in a hundred thousand-year runs, and a handful still sit at 2-4%: `the_registrar_asks_for_the_book`'s two branches, `who_gets_the_physician/the_weak_one -> kept_them_both`, `the_coat_hung_up/let_him_stop -> home` and `the_turn_of_the_stave/mend_the_verse -> mended`. Any change to any phase's draws re-rolls them, so that gate can go red on content nobody touched. Two rounds of this are done and both are written up beside the content they moved: the Insurrection's four scenes at one measured weight (top of `packages/content/events/age_insurrection.yaml`), and the archive substory's launcher (`the_archive_and_the_wage_roll`, in `packages/content/events/retainers.yaml`). The frame layer is clear — every interlude is at 7% or better.
- **Measure the funnel, not the thing that looks thin.** Both frame interludes that sat at 1-2% were fine; they were starved four events upstream, by a launcher firing in 10 runs of a hundred and by a Discrepancy reachable only through a one-in-five Embellish. Neither was visible from the interlude, and raising the interlude's own weight would have bought nothing — a frame event is gated by `reads`, not drawn from a rationed pool. The frame's cadence caps how many interludes a run gets; the supply of open Discrepancies decides which ones they can be, so `arcs.slow.test.ts`'s batch mean is the wrong instrument for asking whether one is reachable and gate 8 is the right one.

### Closed, and how they behave now

- **A secret has legs.** `knowsSecrets` and `loyalty` are read — `core/src/people/secrets.ts`, and the `secrets` year phase. Loyalty rises while the house pays its staff and falls while it cannot; when service ends, each secret on the contract is tested against loyalty and against how badly they were let go, and what fails walks out on `world.looseSecrets` with the house that took them on. Years later it is told, and becomes an OPEN DISCREPANCY under its own id, provable by that house — from there the PRESSURE pass, the `discrepancy` condition, the frame's `reads` and the auction's chronicle pages all pick it up with no new vocabulary. `releaseContracts` reads the contract before it clears it, which is the whole trick: read after, a secret is one nobody knows. `secrets/wiring` fails the build if an id is also a content Discrepancy or a knowledge flag. `SAVE_FORMAT` is 6. `arcs/archive.yaml` still tells the story by hand and is now the illustration rather than the mechanism.
- **A run goes on disk.** `packages/shell/src/saves.mjs` and `packages/shell/tools/save-slot.mjs`: named slots under Electron's `userData`, atomic writes, a listing that reports a corrupt slot rather than dropping it, and export/import through the native dialog. `window.ed.writeSave`/`readSave`/`listSaves`/`deleteSave` is the bridge; `npm run smoke` round-trips one through the real preload and the real IPC. The shell checks exactly one thing about a save — that `format` is a number — and `SavedGameS` in core still decides whether a blob is a run.
- **Barrenness is a recessive** ([#25](https://github.com/JamesFlames/EldritchDynasty/issues/25), fertility option D, shipped). `del_hollow_year` is in the `DELETERIOUS` block, harmless carried and near-sterile homozygous, and floors `pairFecundity` — see `people/demography.ts` and `fertility.slow.test.ts`. This file and CLAUDE.md both still listed it as the next piece months after it landed, which is what a gap list does when nobody re-reads it against the code.

- **Checks resolve a choice.** `Check`, `PoolSpec` and `Choice.check` are evaluated — `core/src/events/checks.ts`, with `checks/wiring` failing the build when a check's bands name the wrong thing for its role. A `party` decider pools one over the people the player casts.
- **The Library, careers and the auction are built** (concept §§12, 14, 17). `people/library.ts` holds books, study and degradation behind the `spellbook` effect; `people/careers.ts` assigns them, prices them in breeding-pool absence and Madness cover; `auction.ts` announces lots, takes bids in coin or heirloom and resolves them. Each has its own year phase — `library`, `careers`, `auction`.
- **The market can read a line.** A Match card carries a word about the line's fertility, built off the candidate's mother and sisters and only from completed, married childbearing lives — never her genome. `lineSeen` says how many lives that word rests on. See `people/match.ts` and [#28](https://github.com/JamesFlames/EldritchDynasty/issues/28).

- **A substory remembers things.** `ArcInstance.localFlags` was declared, saved, initialised to `{}` and read by nothing. The `arc_flag` effect writes it and the `arcFlag` condition reads it back, so a successor can branch on what a beat three nodes upstream decided without that fact becoming a world flag every event in the game can see. Outside an arc both answer FALSE, never true. `arcVisited` asks the same question of the instance's history, and successors gate on `fromChoice` and `fromTag` as well as `fromOutcome` — which stops mattering only if nothing but the player ever takes a branch. See `arcs/flags` and `arc-memory.test.ts`.
- **A two-beat scene needs no arc file.** `Outcome.next` names the follow-up, when it comes due, and which slots it keeps; `schema/src/desugar.ts` compiles the chain into a real `ArcDef` inside `indexContent`, so there is still exactly one thing that runs a tree. It compiles into the INDEX and never the bundle — the authored YAML stays authored, and the editor renders compiled arcs read-only rather than being able to write one to disk.
- **The editor authors all of it.** Effects, slots, filters, checks, branches, outcomes, deciders, arcs and their successors, plus creating new events and substories. The effect/slot/check forms are generated from the Zod schemas (`reference.ts` → `fieldsOfSchema`), so a new `Effect` kind gets a form with no Vue edit. The Instruments tab's **Branch trace** resolves every non-player decider against the six test fixtures through the engine's own `decideBranch`, which is the only way to see what a `state` ladder does without running a century.

- **Cadet branches** (concept §16) are modelled — see invariant 10 and `people/branches.ts`. A man of the blood leaves the year his brother takes the seal; the family grows sideways to ~70 living across six halls by 2042 instead of ~20 in one.
- **The suitor draft** is built — `people/match.ts`. Blood of the main hall is dealt three cards, one of them usually a cousin, each with a house, a price and the kinship the documents claim; the rest of the world still pairs through `autoMarry`. A card is a `MintRecipe` rather than a person, so the two declined never enter the world. `wed` is the one marriage path both use.
- **Player choice** is wired — see invariant 9 and `events/decisions.ts`. Choice events, player-cast slots and the Record block all go on a docket that stops the clock, and `autoResolve` still answers them for the harness.
- **Electron** is set up in `packages/shell`. It owns the window, a validated content-write IPC, and a `--smoke` boot check; it owns no rules.
- **Fertility is heritable.** Fecundity is a Core attribute weighted seventy-thirty toward the mother, driving both completed family size and the annual conception chance — see invariant 10 and [#28](https://github.com/JamesFlames/EldritchDynasty/issues/28).
- **The Ledger pays out.** Every named, clause-bearing Age reveals one clause to a house that keeps an archivist. Runs recover 4–9 of the nine, and about three quarters reach the God gate of seven.
- **Hostility is an edge.** Grudges are recorded, inherited down the generations by their own policy, and decay. Content can gate on `grudgeAgainstUs`.
- **Standing decays.** A quiet forty-five years costs a tier, visible Madness costs tiers faster, and decay floors at Known — Unknown has to be done to you.
- **A run is a value.** `saveGame` produces a versioned, Zod-validated snapshot of everything the run has caused, and `loadGame` rebuilds it; a reloaded run continues bit-identically. Derived state — the phenotype cache, the house table, the content — is rebuilt rather than stored.
- **The client has a surface.** `core/src/session.ts` is the whole of what a game client needs: `advance`, `choose`, `record`, `letHimDecide`, `name`, `view`, `save`. `view()` returns plain data, so a UI built on it does not need to be told when to re-read.
- **A run has a decision log.** `commitOutcome`, `applyRecord` and `renameChild` append a `LoggedDecision` beside the save; `replay()` reconstructs a run from it and throws if the rebuild disagrees with its own record, rather than trusting a log nothing checks. See [#8](https://github.com/JamesFlames/EldritchDynasty/issues/8).
- **Discrepancies are readable.** A `discrepancy` condition (existence or exact state) and an `openDiscrepancies` count feed the PRESSURE selection pass; proving one costs Respect a full tier. `discrepancy/wiring` fails the build if a proved or buried id was never created, or `provableBy` names a house that does not exist. See [#9](https://github.com/JamesFlames/EldritchDynasty/issues/9).
- **The frame fires.** `tier: frame` has its own `YEAR_PHASES` entry, its own RNG stream, and its own ledger (`world.frame`) — it never touches the ambient Frequency ledger, so a frame firing never steals an ambient event's ration. It is gated by `reads` (a named Discrepancy's state, read straight off `world.discrepancies`) rather than `conditions`, casts only `listener_blood` (the sitting Head) and `listener_record` (the guardian — which is also why it cannot fire before the Narrator crosses over), and carries no effects, Record block or rumour by construction (`frame/shape` fails the build otherwise). Twelve to eighteen interludes across a run is the design target; `arcs.slow.test.ts` asserts the batch average lands there. See [#13](https://github.com/JamesFlames/EldritchDynasty/issues/13).
- **No nested tale is neutral.** `TaleDefS` and a `tales` collection exist and every tale names a `teller` and a `bias` — there is no way to author one that speaks in the game's own voice. `refs/known` fails the build if an event's `accounts` or a tale's `about` names something that does not exist; `tales/accounts` (CI gate 8) fails it if two accounts on one event do not contradict on at least one field — differing `bias` is the floor until the record layer's claim vocabulary (issue #19) raises the bar. A tale's circulation state (`world.tales`) is born the year the event it is `about` actually fires, not merely when some other event cites it, and the `generation` phase ticks whether it has started circulating and how many times it has mutated since. It **reaches a client** on `SessionView.tales` — only what is actually circulating, carrying `teller`, `bias`, `form`, `text` and how far the telling has drifted. `accuracy` is deliberately NOT on the view: it is the authored answer to how much of an account is true, and a client handed it could sort two contradicting accounts by truth, which is the one reading this layer exists to refuse. For its first life the layer circulated correctly, saved faithfully and surfaced nowhere, which no unit test and no digest could see — `tales.slow.test.ts` is the instrument that would have. `SAVE_FORMAT` is 5. See [#14](https://github.com/JamesFlames/EldritchDynasty/issues/14).
