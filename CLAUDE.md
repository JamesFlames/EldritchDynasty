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

# Timings measured on a four-core container. Scale them, do not trust them flat.
npm run check        # typecheck (incl. Vue templates) + validate content + test.
                     # ONE command before you claim anything works. ~9 min.
npm run test:fast    # ~26s — the fix-and-rerun loop. Skips the *.slow.test.ts
                     # suites, which play whole games; lanes.test.ts fails the
                     # build if one of those turns up in this lane.
npm test             # everything: 966 tests in 77 files, ~8.5 min
npm run typecheck    # tsc over packages, then vue-tsc over the editor's templates
npm run validate     # 25 content rules; exits non-zero on any error

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
ages → assize → lifecycle → guardian → quarrels → secrets → careers → table
     → library → economy → auction → succession → branches → marriage → births
     → arcs → ambient → frame → ascension → generation
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
game.order({ kind: 'tutor', person, attr: 'mind' });   // the table: also study,
                                          //   career, bid, withhold
const view = game.view();                 // plain data: halls, chronicle, tales, docket,
                                          //   clauses, the rung, the Assize's reading
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
  it alone with `runRule('your/rule', bundle)`, and hand it a bundle it must
  REJECT as well as one it must pass — a rule nobody has seen fail is
  indistinguishable from a rule that cannot fail.
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

966 in 77 files, grouped by the kind of failure they catch rather than by module.

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

**Also built, in the fun pass.** The **Assize** — the world's reading of the
house, and fifteen explicit responses across two arms (`assize.ts`). The
**table** — five standing orders the player gives on a turn of their own
choosing, and a steward who acts when they have not (`table.ts`). The
**Ascension Ladder** — §22's six rungs, their gates, and what is in the way of
the next one (`ascension.ts`). Bynames and dynastic ordinals, so no person in
the game is called `Garrick 788`.

**Also built, in the presentation pass (concept §24).** A **mark set** —
twenty-nine hand-drawn scribal marks in `editor/src/lib/marks.ts`, a closed
union with a `Record` over it, rendered by `Mark.vue`. They are not a toolbar
icon set: a manicule for *attend to this*, a pilcrow, an obelus for a line
struck, an asteriskos for a line not warranted. **Every event wears its own
metadata** — one mark per declared `purpose` and one for its `tier`, mapped in
`PURPOSE_MARK` / `TIER_MARK`, so nobody picks an icon and two templates with
the same row of marks are doing the same three jobs (the duplicate sweep, §25,
made visible). A procedural **wax seal** (`Seal.vue`), on the sigils' own
bargain, stamped on the illuminated tier. And **sound**: `lib/sound.ts`
synthesises §24's page turn, seal and bell, plus a boon, a blow and a plain
note read off each outcome's own effects by `lib/valence.ts` — no authored
valence field to drift. The **drone shifts by Age through the Age's authored
`register`**, so a new Age gets the right drone with no code change, and the
2042 frame kills it entirely.

Three things about that pass are worth knowing before touching it. The sound is
**synthesised, not sampled**, and the CSP on the built page (`default-src
'self'`) means it has to be — but the better reason is that a described bell can
be tested and a wav that plays silence cannot. Everything above the `Sound`
class is pure data for exactly that reason, and `sound.test.ts` never builds an
`AudioContext`. The **frame interrupts a deliberate step and not a fast-forward**:
holding every interlude from a "to 2042" press put twenty two-colour panels
above the docket, so long jumps send them to a ledger panel instead. And
`marks.test.ts` fails the build on a mark **nothing renders** — invariant 11 for
pictures, because a drawn-and-unwired icon typechecks forever.

**Not built.** The **game client** (the session surface is the seam for it, and
`window.ed.writeSave` is the other half of that seam). **Packaging** — no
`electron-builder`, no signing, no auto-update. **A Save/Load menu** — the
shell's disk layer is built and tested end to end by `npm run smoke`, but there
is no client to put a menu item in front of, so there is no menu.

**The one thing that is still convergent.** The blood **dilutes** across a run
and no play concentrates it: measured, an oracle player who always takes the
card whose person actually carries the most font still watches the family's
carried font fall from ~25 in the founding generation to 6–11 and stay there
for eight centuries. Cousin marriage — §7's One Permutation, "not a temptation,
it is the mechanism" — is on 46% of hands now and does not beat recombination
plus the deleterious load, which kills concentrating lines before the channel
can rise. Everything downstream follows: the ladder stalls at Adept, the
Vessel's cost is never paid, and the Broken Line cannot happen. This is a
genetics balance problem in the family that issue #26 and `gate:drag` already
exist for, and it wants a measured session of its own — not a nudge.

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

A content drop moves this list wholesale and that is not a sign of damage. The
forty-four templates added in `village`, `customs`, `roads`, `the_trade`,
`papers` and `the_quiet_names` took the outcome count from 243 to 338, and the
thinnest are now `who_gets_the_physician` and `the_turn_of_the_stave`, both of
which were on the previous list too. Nothing went dead.

The fifty added in `the_hall`, `feasts`, `the_turning_year`, `bramme`,
`the_young` and `neighbours` took it from 338 to 474, and cost one thing that
is worth reading before the next drop. `frame_the_missing_third_returns` went
to zero in `arcs.slow.test.ts`'s sixty-seed batch — and it had been at two
fires in sixty all along, because its whole reach was one lie, told when the
chronicler embellishes a rare arc node, and OPEN only until somebody proved
it. Sampled over an independent 120 seeds the premise holds in 17.5% of runs
and the coverage batch happened to draw 5%; the fix was to drop `state: open`
from its read, which is what `FrameReadS`'s own note has been warning about
since the frame was built — an interlude waiting on one particular lie in one
particular state is an interlude most runs never see. It is at 12.5% now.
Nothing else went dead. The thinnest outcomes after that drop sit at 0.8%,
1.2% and 1.6% — `retained` under `the_physician_from_bramme`, `forgiven`
under `the_reeve_at_ingathering`, `opened` under `the_match_that_never_comes`
— and the thinnest templates are `the_hall_after` at 2% and
`the_physician_from_bramme` at 3%, both of them Plague Age, which is
Age-gated and thin by construction.

**The fifty RARE templates after that are the most instructive drop so far,
because the tier they joined was not the size it looked.** `frequency: rare`
returned 44 templates; the AMBIENT rare pool — what actually competes in the
yearly draw — was **nine**, because 25 of the 44 were `tier: frame` (rationed
off `world.frame`) and 10 were arc nodes (excluded by construction). Nine
templates were sharing 7.25 firings a run, and every raise of the rare weight
from 40 to 320 had been buying share for those nine. **Count the pool you are
joining, not the tier you are declaring.**

Fifty more took that pool to 59 and three things followed, all measured:

- **The weight stopped mattering.** 320 → 14.0 ambient firings a run, 220 →
  13.6, 150 → 12.7. A pool that big wins the draw whenever it is *eligible*,
  and eligibility is the cooldown. That is the state a rationed tier is
  supposed to be in and it took content rather than a knob to get there.
- **So the cooldown moved, 55 → 30**, and it is the first time that lever has
  been pulled. Not to quiet a gate: `rites.yaml` has always opened by calling
  this tier "a few per century" and at 55 years with nine templates it
  delivered 0.7. Measured: cd 55 → 14.0 firings and the median template
  reached in 17% of runs, cd 40 → 18.1 / 25%, cd 30 → 21.8 / 33%, cd 22 →
  22.0 / 33%. It stops at 30 because `perRunCap` takes over, which is the
  right place for a rationed tier to stop. The cost is eight common firings a
  run and nothing from uncommon or mythic.
- **Every pre-existing rare template lost six sevenths of its share**, and the
  two that other content hangs off went dark. `the_drowning` fell from 13 runs
  in 60 to **two**, taking `the_drowning_lie` — which three frame interludes
  read — to zero; `the_seal_questioned`, which is the mouth of `arc_seal`, took
  the whole arc down with it. Both are now weighted for what actually rations
  them (600 and 340) with the measurement written next to them, and the
  argument is `the_drowning_repeated`'s: **what rations a template can be its
  CAST or its CONDITION rather than its tier, and a flat weight is then wrong.**
  `the_cart_from_the_chapter_house` is the same shape one tier down — it only
  fires while the Assize reads the house at −0.25 or worse — and went to zero
  in the same batch at weight 105. It is 320 now and back to 11 runs in 60.

Four more frame interludes were reading one specific lie in one specific
state, which is the failure `FrameReadS`'s own note describes and the second
time this list has recorded it. All four now read the lie's existence rather
than its state.

The drop also moved two thresholds that were sitting *on* their statistic
rather than above it, and both were checked against the content before being
touched. Late motherhood measured 1.97% with the drop and 2.00% without it,
against a ceiling of 2% — the drop did not move it, the ceiling was a coin
flip, and it is 2.5% now. The auto-player's Adept rate genuinely did fall,
from 9 chronicler runs in 24 to 7, because the rare tier's firings come out of
the common pool where the library and the table live; that test now samples 24
seeds instead of 12, and the number it asserts is that the second rung is
*reachable*, not that it is reached at a rate.

**A hundred more COMMON templates after that, and the tier arithmetic behaved
exactly as this list now predicts it will.** `the_kitchen`, `wick_trades`,
`weather`, `indoors`, `cloth`, `the_body`, `letters`, `small_money`, `beasts`
and `the_old` took the common pool from 105 to 205 and cut uncommon from 71.3
firings a run to 62.5, rare from 21.5 to 19.8 and mythic from 1.1 to **0.67**,
which is most runs seeing no mythic event at all. The profile answers it —
uncommon 800 → 1100, rare 320 → 400, and **mythic 5 → 9, the first time that
number has ever been touched.** Mythic had never needed draw weight because it
is rationed by its cap and its drought curve; at 5 it had almost none, and
every common drop had been quietly pushing it further under. All three are
back (64.2 / 20.4 / 1.13) and the thousand-year treasury is back with them,
1766 against 1772 before the drop.

**What that drop actually cost was four tests, and three of them were finding
real things.** A suitor template minted brides at 16 against `eligibleToMarry`'s
own floor of 17 — a bride the marriage code would have refused had she already
existed, who can then bear at 16, which `demography.slow.test.ts` calls a bug
and is right to. Gate 2 found that no test fixture had anybody over 70 or any
woman over 52, which is a real gap in a game that now has a whole file about
the old. And the relationship-edge guard turned out to be asserting a LEVEL
when the bug it was written for is an ACCUMULATOR: a hundred templates that
each note what the household thought took the count at 2042 from about 7 to
about 35 with nothing about pruning changed at all. It samples across the run
now and asserts the sawtooth — 72, 65, 5, 2, 73 across a millennium — because
a map that never comes back down is the bug and a map that peaks and empties
is the system working.

The fourth was the fourth occurrence of the same lesson. Branch grievance is
one number per surviving hall at one instant, with a heavy tail; six seeds is
thirty observations and the top of that sample is carried by one hall. Over 24
independent seeds the maximum is 100.0 both before and after the drop; over
the test's own six it moved from 98.2 to 49.8. Same for the oldest surviving
feud, which clears thirty years in about four runs in five and came up 19 on
the one seed that test sampled. Both take a batch now.

**And a check that the drop is the reason for.** `events/player-share`
(rule 25) fails the build if fewer than a quarter of templates actually ask
the player something — `decidedBy: player`, a `party` decider, a
`castBy: player` slot, or a Record block. A `state` ladder, a `chance` draw
and a narration resolve themselves, and that is the cheap half of the library
to write: a run full of texture looks exactly like a run full of decisions
from the outside, with the same fire rates and the same green gates. The
floor is at 25% against content standing at 81%, which is where a guard
belongs — it is for the six-hundredth template, not this one.

After all of that: 382 templates, 832 authored outcomes, 140 nested tales, and
all five gates green. The thinnest outcomes are `held` under
`the_guardian_disagrees` and `it_was_the_yard_man` under `what_hangs_in_smoke`
at 0.8%, and the thinnest templates are `the_hall_after` and
`the_year_two_woke` at 2% — one Age-gated and one needing the rarest person in
the game, twice, at once. The thinnest outcomes are `spent_well` under
`who_gets_the_physician` and `the_room_notices` under `the_turn_of_the_stave`
at 0.4%, and the thinnest template is `the_hall_after` at 2% — Plague Age,
Age-gated, and thin by construction, as it was two drops ago.

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
And **the rare tier is rationed by its draw weight, not by its cap** — the
22-a-run cap almost never binds, because a rare template loses the yearly draw
to the common pool long before the cap or the fifty-five-year cooldown is
reached.

**And a fifth, which is the one to read before adding anything in bulk: the
size of a tier's pool is not what `frequency:` reports.** Frame events ration
off `world.frame` and arc nodes are excluded from the ambient pool by
construction, so a tier can look like 44 templates and behave like nine. Count
it. The rare drop above is what happens when nobody does.

**A third fact, and it is the one that actually bites: a tier's share of the
year is not a property of the tier.** It is the tier's weight times how many
templates carry it times their own weights, over the same product summed across
every other tier — so twenty-eight new COMMON templates ration uncommon and rare
without one line of their content changing, and nothing anywhere reports it.
Measured over sixty thousand-year runs when those twenty-eight went in: uncommon
fell from 93.1 firings a run to 75.0, rare from 24.0 to 14.1, and
`the_coat_hung_up` from 13.3% of runs to zero, which is how gate 4 found it. The
answer is the profile and not the templates — uncommon and rare live in
`schema/src/frequency.ts`, both with every measurement written next to them,
and raising them restores the tier's share of the draw without touching its
ration.

**And a fourth, which is where that knob stops.** Fifty more COMMON templates
(`the_hall`, `feasts`, `the_turning_year`, `bramme`, `the_young`,
`neighbours`) took the common pool from 55 templates to 105 and did it again:
uncommon 79.6 firings a run to 65.8, rare 15.5 to 11.8, over 24 thousand-year
runs with nothing else changed. Sweeping the weight back, over 32 runs:
400 → uncommon 66.0, rare 11.5 · 700 → 71.4 / 13.5 · 1000 → 73.7 / 13.8.
**The curve flattens and does not reach**, and that is not the weight failing.
It is the twelve-year cooldown, which caps uncommon near 83 firings a run and
had it at 79.6 — within four per cent of its own ceiling — before the drop. A
tier already pressed against its ration cannot be given its old share back by
weight, because the years it wants are years it is barred from. Uncommon is
800 now and rare 320, which recovers about three quarters of it; the last
quarter is the cooldown's, and the cooldown is the ration. Gate 4 and gate 8
are green there, which is the test that actually matters.

**Presence modifiers are the same instrument.** Seven career traits with
`event_weight` multipliers, none above 1.3 and none suppressing anything, took
`wend.yaml`'s inline two-beat scene from 53% of runs to 35%: a tag lifted is
every untagged template in the pool pushed down. They pay out in `check_bonus`
and `attribute` now. And watch the money — a new common template is cheaper on
average than the expensive scenes it displaces, which is why the median
thousand-year treasury rose by half before the new commons were repriced against
the ones they crowd out.

This list was reconciled against the code on the date above, and AGENTS.md's
"Known gaps" was corrected to match — including barrenness as a recessive, which
both files listed as unbuilt for months after it shipped. Where any prose here and the code disagree,
**the code is the spec** — fix the prose.
